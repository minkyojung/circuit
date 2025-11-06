/**
 * Compact Handlers - Enhanced Version
 *
 * Session compaction using Claude Code CLI with intelligent message preservation.
 * Summarizes old messages to reduce token usage while preserving critical context.
 *
 * Improvements:
 * - Accurate token counting with @anthropic-ai/tokenizer
 * - Smart context preservation (initial + important + recent)
 * - Message importance classification
 * - Metadata extraction (files, errors, decisions)
 * - Enhanced summary prompt with structure
 * - Better error handling with retry logic
 */

import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { countTokens } from '@anthropic-ai/tokenizer';

const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude');
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: any;
}

interface CompactRequest {
  sessionId: string;
  messages: Message[];
  keepRecentCount?: number;
  keepInitialCount?: number;
}

interface CompactResult {
  success: boolean;
  summary?: string;
  originalMessageCount?: number;
  keptMessageCount?: number;
  summarizedMessageCount?: number;
  tokensBeforeEstimate?: number;
  tokensAfterEstimate?: number;
  preservedMessages?: Message[];  // Important messages kept
  error?: string;
}

interface MessageAnalysis {
  message: Message;
  importance: 'critical' | 'high' | 'medium' | 'low';
  hasFileChanges: boolean;
  hasErrors: boolean;
  isDecision: boolean;
  extractedContext: string[];
}

/**
 * Register compact IPC handlers
 */
export function registerCompactHandlers() {
  console.log('[compactHandlers] Registering session compact handlers');

  /**
   * Compact a session by summarizing old messages with smart preservation
   */
  ipcMain.handle('session:compact', async (event, request: CompactRequest): Promise<CompactResult> => {
    try {
      const { messages, keepRecentCount = 10, keepInitialCount = 3 } = request;

      console.log('[Compact] Starting compact for', messages.length, 'messages');
      console.log('[Compact] Strategy: Keep initial', keepInitialCount, '+ recent', keepRecentCount, '+ important messages');

      // Validation
      if (messages.length < 20) {
        return {
          success: false,
          error: 'Not enough messages to compact (minimum 20)',
        };
      }

      // Calculate tokens before
      const tokensBeforeEstimate = calculateTotalTokens(messages);
      console.log('[Compact] Tokens before:', tokensBeforeEstimate);

      // Phase 1: Analyze all messages for importance
      console.log('[Compact] Phase 1: Analyzing message importance...');
      const analyses = messages.map(msg => analyzeMessage(msg));

      // Phase 2: Smart message selection
      console.log('[Compact] Phase 2: Selecting messages to keep...');
      const selection = selectMessagesToKeep(analyses, keepInitialCount, keepRecentCount);

      console.log('[Compact] Selection result:', {
        initial: selection.initialMessages.length,
        important: selection.importantMessages.length,
        recent: selection.recentMessages.length,
        toSummarize: selection.toSummarize.length,
      });

      // Validation: ensure we have messages to summarize
      if (selection.toSummarize.length === 0) {
        return {
          success: false,
          error: 'No messages to summarize after smart selection',
        };
      }

      // Phase 3: Generate enhanced summary
      console.log('[Compact] Phase 3: Generating enhanced summary...');
      const summary = await generateEnhancedSummary(
        selection.toSummarize,
        selection.extractedContext
      );

      // Calculate tokens after
      const keptMessages = [
        ...selection.initialMessages,
        ...selection.importantMessages,
        ...selection.recentMessages,
      ];
      const summaryTokens = countTokens(summary);
      const keptTokens = calculateTotalTokens(keptMessages);
      const tokensAfterEstimate = summaryTokens + keptTokens;

      const savedPercentage = Math.round((1 - tokensAfterEstimate / tokensBeforeEstimate) * 100);

      console.log('[Compact] ✅ Summary generated:', {
        summaryLength: summary.length,
        summaryTokens,
        keptTokens,
        totalAfter: tokensAfterEstimate,
        savedPercentage: savedPercentage + '%',
      });

      return {
        success: true,
        summary,
        originalMessageCount: messages.length,
        summarizedMessageCount: selection.toSummarize.length,
        keptMessageCount: keptMessages.length,
        tokensBeforeEstimate,
        tokensAfterEstimate,
        preservedMessages: selection.importantMessages,
      };

    } catch (error: any) {
      console.error('[Compact] Error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  console.log('[compactHandlers] ✅ Compact handlers registered');
}

/**
 * Calculate total tokens for messages using accurate tokenizer
 */
function calculateTotalTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => {
    const content = msg.content || '';
    return sum + countTokens(content);
  }, 0);
}

/**
 * Analyze message importance and extract context
 */
function analyzeMessage(message: Message): MessageAnalysis {
  const content = message.content.toLowerCase();
  const metadata = message.metadata || {};

  // Extract important context markers
  const extractedContext: string[] = [];

  // Check for file changes
  const hasFileChanges =
    content.includes('file') ||
    content.includes('create') ||
    content.includes('modify') ||
    content.includes('delete') ||
    metadata.thinkingSteps?.some((step: any) =>
      step.tool === 'Edit' || step.tool === 'Write'
    );

  // Check for errors
  const hasErrors =
    content.includes('error') ||
    content.includes('bug') ||
    content.includes('fail') ||
    content.includes('warning');

  // Check for decisions
  const isDecision =
    content.includes('decide') ||
    content.includes('choose') ||
    content.includes('architecture') ||
    content.includes('design') ||
    content.includes('implement') ||
    content.includes('approach');

  // Extract file references
  const fileMatches = message.content.match(/[a-zA-Z0-9_\-/.]+\.(ts|tsx|js|jsx|py|go|rs|cpp|java|md|json|yaml|yml)/g);
  if (fileMatches) {
    extractedContext.push(...fileMatches.map(f => `File: ${f}`));
  }

  // Extract function/class names
  const codeMatches = message.content.match(/`([a-zA-Z_][a-zA-Z0-9_]*)`/g);
  if (codeMatches) {
    extractedContext.push(...codeMatches.slice(0, 5).map(m => `Code: ${m}`));
  }

  // Determine importance
  let importance: 'critical' | 'high' | 'medium' | 'low' = 'low';

  if (hasErrors && hasFileChanges) {
    importance = 'critical';  // Error + file change = critical
  } else if (isDecision || (hasFileChanges && message.role === 'assistant')) {
    importance = 'high';  // Decisions or code changes
  } else if (hasFileChanges || hasErrors || message.role === 'user') {
    importance = 'medium';  // User questions or issues
  }

  return {
    message,
    importance,
    hasFileChanges,
    hasErrors,
    isDecision,
    extractedContext,
  };
}

/**
 * Smart message selection: initial + important + recent
 */
function selectMessagesToKeep(
  analyses: MessageAnalysis[],
  keepInitialCount: number,
  keepRecentCount: number
) {
  // Always keep first N messages (project context)
  const initialMessages = analyses.slice(0, keepInitialCount).map(a => a.message);

  // Always keep last N messages (recent context)
  const recentMessages = analyses.slice(-keepRecentCount).map(a => a.message);

  // Middle messages: select important ones
  const middleAnalyses = analyses.slice(keepInitialCount, -keepRecentCount);

  // Keep critical and high importance messages from middle
  const importantMessages = middleAnalyses
    .filter(a => a.importance === 'critical' || a.importance === 'high')
    .map(a => a.message);

  // Messages to summarize: medium and low importance from middle
  const toSummarize = middleAnalyses
    .filter(a => a.importance !== 'critical' && a.importance !== 'high')
    .map(a => a.message);

  // Extract all context from ALL messages (even ones we'll summarize)
  const extractedContext = analyses
    .flatMap(a => a.extractedContext)
    .filter((value, index, self) => self.indexOf(value) === index); // Unique

  return {
    initialMessages,
    importantMessages,
    recentMessages,
    toSummarize,
    extractedContext,
  };
}

/**
 * Generate enhanced summary with structure and context preservation
 */
async function generateEnhancedSummary(
  messagesToSummarize: Message[],
  extractedContext: string[],
  retryCount: number = 0
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build conversation text with better formatting
    const conversationText = messagesToSummarize.map((msg, idx) => {
      const role = msg.role === 'user' ? '👤 User' : '🤖 Assistant';
      const content = msg.content || '';
      const timestamp = new Date(msg.timestamp).toLocaleString();

      // Truncate very long messages for summary prompt
      const truncated = content.length > 2000
        ? content.slice(0, 2000) + '\n...[truncated]'
        : content;

      return `---\n**Message ${idx + 1}** (${timestamp})\n${role}:\n${truncated}`;
    }).join('\n\n');

    // Build context section
    const contextSection = extractedContext.length > 0
      ? `\n\n**Key Context Extracted:**\n${extractedContext.slice(0, 20).join('\n')}`
      : '';

    const summaryPrompt = `You are creating a compact summary of a conversation to preserve essential context for continuing the conversation.

**${messagesToSummarize.length} messages to summarize:**

${conversationText}
${contextSection}

---

**Create a well-structured summary that includes:**

## 1. Conversation Overview
- What is the main goal or problem being addressed?
- What stage is the project/task at?

## 2. Key Technical Decisions
- Architecture choices made
- Technology selections and rationale
- Design patterns or approaches decided

## 3. Code Changes & Files
- Files created, modified, or deleted
- Functions/classes implemented
- APIs or interfaces designed
- Configuration changes

## 4. Important Technical Details
- Constraints or requirements mentioned
- Performance considerations
- Edge cases or special handling
- Dependencies or integrations

## 5. Current Status
- What's completed and working
- What's in progress
- What's pending or blocked

## 6. Unresolved Items
- Open questions
- Bugs to fix
- Features to implement
- Things to investigate

**Format:** Use markdown with clear sections. Be thorough but concise. Preserve specific names, paths, values, and technical details.`;

    // Spawn Claude CLI
    const claude = spawn(CLAUDE_CLI_PATH, [
      '--print',
      '--output-format', 'json',
      '--model', 'sonnet',
    ], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Send prompt
    const input = JSON.stringify({
      role: 'user',
      content: summaryPrompt
    });

    claude.stdin.write(input);
    claude.stdin.end();

    // Collect response
    let stdout = '';
    let stderr = '';

    claude.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    claude.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Compact] Claude stderr:', data.toString());
    });

    claude.on('close', (code) => {
      if (code !== 0) {
        console.error('[Compact] Claude CLI failed with code:', code);
        console.error('[Compact] stderr:', stderr);

        // Retry logic
        if (retryCount < MAX_RETRIES) {
          console.log(`[Compact] Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(async () => {
            try {
              const result = await generateEnhancedSummary(messagesToSummarize, extractedContext, retryCount + 1);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, RETRY_DELAY_MS * (retryCount + 1));
          return;
        }

        reject(new Error(`Claude CLI failed after ${MAX_RETRIES} retries (code ${code})`));
        return;
      }

      try {
        // Parse JSON response
        const result = JSON.parse(stdout);

        // Extract text content
        let summary = '';
        if (result.content && Array.isArray(result.content)) {
          summary = result.content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        } else if (typeof result === 'string') {
          summary = result;
        } else {
          summary = JSON.stringify(result);
        }

        if (!summary || summary.trim().length === 0) {
          reject(new Error('Empty summary received from Claude'));
          return;
        }

        resolve(summary);
      } catch (error: any) {
        console.error('[Compact] Failed to parse Claude response:', error);
        console.error('[Compact] stdout:', stdout);

        // Retry on parse error
        if (retryCount < MAX_RETRIES) {
          console.log(`[Compact] Retrying due to parse error (${retryCount + 1}/${MAX_RETRIES})...`);
          setTimeout(async () => {
            try {
              const result = await generateEnhancedSummary(messagesToSummarize, extractedContext, retryCount + 1);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          }, RETRY_DELAY_MS * (retryCount + 1));
          return;
        }

        reject(new Error(`Failed to parse Claude response after ${MAX_RETRIES} retries: ${error.message}`));
      }
    });

    claude.on('error', (error) => {
      console.error('[Compact] Claude process error:', error);

      // Retry on process error
      if (retryCount < MAX_RETRIES) {
        console.log(`[Compact] Retrying due to process error (${retryCount + 1}/${MAX_RETRIES})...`);
        setTimeout(async () => {
          try {
            const result = await generateEnhancedSummary(messagesToSummarize, extractedContext, retryCount + 1);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        }, RETRY_DELAY_MS * (retryCount + 1));
        return;
      }

      reject(error);
    });
  });
}

/**
 * Cleanup handler
 */
export function cleanupCompactHandlers() {
  console.log('[compactHandlers] Cleanup complete');
}
