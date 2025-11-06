/**
 * Compact Handlers
 *
 * Session compaction using Claude Code CLI.
 * Summarizes old messages to reduce token usage while preserving context.
 *
 * Strategy:
 * 1. Take messages array and split: old messages vs recent messages
 * 2. Send old messages to Claude CLI for summarization
 * 3. Return summary message
 * 4. Frontend combines: [summary] + [recent 10 messages]
 */

import { ipcMain } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as os from 'os';

const CLAUDE_CLI_PATH = path.join(os.homedir(), '.claude/local/claude');

interface CompactRequest {
  sessionId: string;
  messages: any[]; // Message[] from frontend
  keepRecentCount?: number;
}

interface CompactResult {
  success: boolean;
  summary?: string;
  originalMessageCount?: number;
  keptMessageCount?: number;
  tokensBeforeEstimate?: number;
  tokensAfterEstimate?: number;
  error?: string;
}

/**
 * Register compact IPC handlers
 */
export function registerCompactHandlers() {
  console.log('[compactHandlers] Registering session compact handlers');

  /**
   * Compact a session by summarizing old messages
   */
  ipcMain.handle('session:compact', async (event, request: CompactRequest): Promise<CompactResult> => {
    try {
      const { messages, keepRecentCount = 10 } = request;

      console.log('[Compact] Starting compact for', messages.length, 'messages');

      // Validation
      if (messages.length < 20) {
        return {
          success: false,
          error: 'Not enough messages to compact (minimum 20)',
        };
      }

      // Split messages
      const messagesToSummarize = messages.slice(0, -keepRecentCount);
      const recentMessages = messages.slice(-keepRecentCount);

      console.log('[Compact] Summarizing', messagesToSummarize.length, 'messages, keeping', recentMessages.length);

      // Estimate tokens (rough: 4 chars = 1 token)
      const estimateTokens = (msgs: any[]) => {
        const totalChars = msgs.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
        return Math.ceil(totalChars / 4);
      };

      const tokensBeforeEstimate = estimateTokens(messages);

      // Generate summary using Claude CLI
      const summary = await generateSummary(messagesToSummarize);

      // Estimate tokens after
      const summaryTokens = Math.ceil(summary.length / 4);
      const recentTokens = estimateTokens(recentMessages);
      const tokensAfterEstimate = summaryTokens + recentTokens;

      console.log('[Compact] ✅ Summary generated:', summary.length, 'chars');
      console.log('[Compact] Token reduction:', tokensBeforeEstimate, '→', tokensAfterEstimate,
        `(${Math.round((1 - tokensAfterEstimate / tokensBeforeEstimate) * 100)}% saved)`);

      return {
        success: true,
        summary,
        originalMessageCount: messagesToSummarize.length,
        keptMessageCount: recentMessages.length,
        tokensBeforeEstimate,
        tokensAfterEstimate,
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
 * Generate summary using Claude CLI
 */
async function generateSummary(messages: any[]): Promise<string> {
  return new Promise((resolve, reject) => {
    // Build summary prompt
    const conversationText = messages.map((msg, idx) => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      const content = msg.content || '';
      return `${idx + 1}. ${role}: ${content}`;
    }).join('\n\n');

    const summaryPrompt = `You are analyzing a conversation to create a compact summary. This summary will be used as context for continuing the conversation, so preserve all essential information.

**Analyze the following ${messages.length} messages and create a comprehensive summary:**

${conversationText}

---

**Create a structured summary that includes:**

1. **Main Topics & Goals**: What is the user trying to achieve?
2. **Key Decisions**: Architectural choices, technology selections, design decisions
3. **Code Implementations**: Files created/modified, functions implemented, APIs designed
4. **Current State**: What's working, what's in progress, what's pending
5. **Important Context**: Technical details, constraints, requirements that must be remembered
6. **Unresolved Issues**: Bugs to fix, features to add, problems to solve

**Format the summary as a clear, structured document. Be thorough but concise.**`;

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
        reject(new Error(`Claude CLI failed with code ${code}`));
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
        reject(new Error(`Failed to parse Claude response: ${error.message}`));
      }
    });

    claude.on('error', (error) => {
      console.error('[Compact] Claude process error:', error);
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
