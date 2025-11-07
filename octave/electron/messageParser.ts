/**
 * Message Parser - Converts Markdown messages to structured blocks
 *
 * This module is responsible for parsing Claude's responses (in Markdown format)
 * into structured Block objects for granular rendering, search, and interaction.
 *
 * Philosophy:
 * - Keep parsing logic simple and predictable
 * - Preserve original content (lossless)
 * - Make blocks independently actionable (copy, bookmark, execute)
 */

import { randomUUID } from 'crypto';

/**
 * Block represents a single semantic unit within a message.
 * Inspired by Warp Terminal's block-based architecture.
 */
export interface Block {
  id: string;              // Unique block ID
  messageId: string;       // Parent message ID
  type: BlockType;         // Block type classification
  content: string;         // Block content (original text)
  metadata: BlockMetadata; // Type-specific metadata
  order: number;           // Order within message (0-indexed)
  createdAt: string;       // ISO timestamp
}

/**
 * Block types supported in the system.
 * Start with essential types, expand later.
 */
export type BlockType =
  | 'text'       // Plain text or Markdown prose
  | 'code'       // Code snippet with syntax
  | 'command'    // Executable shell command
  | 'file'       // File reference
  | 'diff'       // Git diff
  | 'error'      // Error message
  | 'result'     // Command output
  | 'diagram'    // Mermaid diagram
  | 'link'       // URL reference
  | 'quote'      // Quote block
  | 'list'       // List (generic)
  | 'checklist'  // Checklist with checkboxes
  | 'table'      // Table data
  | 'tool'       // Tool invocation (AI SDK integration)
  | 'file-summary'; // Summary of file changes in a message

/**
 * Metadata specific to each block type.
 * Stored as JSON in the database.
 */
export interface BlockMetadata {
  // Common
  createdAt?: string;

  // Code block
  language?: string;        // e.g., 'typescript', 'python', 'bash'
  fileName?: string;        // e.g., 'auth.ts'
  lineStart?: number;       // Starting line number
  lineEnd?: number;         // Ending line number
  isExecutable?: boolean;   // Can this code be run?

  // Command block
  exitCode?: number;        // Last execution exit code
  executedAt?: string;      // Last execution timestamp

  // File block
  filePath?: string;        // e.g., '/src/auth.ts'
  changeType?: 'created' | 'modified' | 'deleted';

  // Diff block
  additions?: number;       // Lines added
  deletions?: number;       // Lines deleted

  // Error block
  errorType?: string;       // e.g., 'TypeError', 'SyntaxError'
  stack?: string;           // Stack trace

  // Diagram block
  diagramType?: 'mermaid' | 'graphviz';

  // List block
  totalItems?: number;
  completedItems?: number;

  // Link blocks
  title?: string;
  description?: string;

  // Quote blocks
  author?: string;
  source?: string;

  // Bookmarking
  isBookmarked?: boolean;
  bookmarkNote?: string;

  // Tool blocks (AI SDK integration)
  toolName?: string;
  toolCallId?: string;
  type?: string;
  state?: 'input-streaming' | 'input-available' | 'output-available' | 'output-error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: unknown;
  duration?: number;  // Execution duration in milliseconds
  status?: 'pending' | 'running' | 'success' | 'error';
  suggestedFix?: string;  // Error blocks
  errorCode?: string | number;  // Error blocks

  // File summary blocks
  files?: Array<{
    filePath: string;
    changeType: 'created' | 'modified' | 'deleted';
    additions: number;
    deletions: number;
    toolCallId?: string;
  }>;
  totalAdditions?: number;
  totalDeletions?: number;
  totalFiles?: number;
}

/**
 * Parsing result with diagnostics
 */
export interface ParseResult {
  blocks: Block[];
  warnings: string[];  // Non-fatal issues during parsing
  errors: string[];    // Fatal issues (should be rare)
}

/**
 * Main parser function - converts Markdown message to blocks
 *
 * @param content - Raw Markdown content from Claude
 * @param messageId - Parent message ID
 * @returns ParseResult with blocks and diagnostics
 *
 * Algorithm:
 * 1. Detect code blocks (```language...```)
 * 2. Split remaining text into text blocks
 * 3. Classify code blocks by language (bash/sh → command, others → code)
 * 4. Preserve order
 * 5. Generate unique IDs
 */
export function parseMessageToBlocks(
  content: string,
  messageId: string
): ParseResult {
  const blocks: Block[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    // Regex to match code blocks: ```language\n...code...\n```
    // Captures: language (optional), code content
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let order = 0;

    // Process code blocks and text between them
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const matchStart = match.index;
      const matchEnd = codeBlockRegex.lastIndex;

      // Text before this code block
      if (matchStart > lastIndex) {
        const textContent = content.slice(lastIndex, matchStart).trim();
        if (textContent) {
          blocks.push(createTextBlock(textContent, messageId, order++));
        }
      }

      // Code block
      const language = match[1] || 'plaintext';
      const codeContent = match[2].trim();

      // Classify block type
      const isCommand = ['bash', 'sh', 'shell', 'zsh'].includes(language.toLowerCase());
      const isDiff = language.toLowerCase() === 'diff' || isDiffBlock(codeContent);

      if (isCommand) {
        blocks.push(createCommandBlock(codeContent, messageId, order++));
      } else if (isDiff) {
        blocks.push(createDiffBlock(codeContent, messageId, order++));
      } else {
        blocks.push(createCodeBlock(codeContent, language, messageId, order++));
      }

      lastIndex = matchEnd;
    }

    // Remaining text after last code block
    if (lastIndex < content.length) {
      const textContent = content.slice(lastIndex).trim();
      if (textContent) {
        blocks.push(createTextBlock(textContent, messageId, order++));
      }
    }

    // Edge case: No code blocks at all
    if (blocks.length === 0 && content.trim()) {
      blocks.push(createTextBlock(content.trim(), messageId, 0));
    }

  } catch (error) {
    errors.push(`Parsing failed: ${error instanceof Error ? error.message : String(error)}`);

    // Fallback: Create a single text block with entire content
    blocks.push(createTextBlock(content, messageId, 0));
  }

  return { blocks, warnings, errors };
}

/**
 * Create a text block
 */
function createTextBlock(
  content: string,
  messageId: string,
  order: number
): Block {
  return {
    id: randomUUID(),
    messageId,
    type: 'text',
    content,
    metadata: {},
    order,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a code block
 */
function createCodeBlock(
  content: string,
  language: string,
  messageId: string,
  order: number
): Block {
  return {
    id: randomUUID(),
    messageId,
    type: 'code',
    content,
    metadata: {
      language,
      isExecutable: false, // Code is not directly executable
    },
    order,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a command block (executable)
 */
function createCommandBlock(
  content: string,
  messageId: string,
  order: number
): Block {
  return {
    id: randomUUID(),
    messageId,
    type: 'command',
    content,
    metadata: {
      language: 'bash',
      isExecutable: true,
    },
    order,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Create a diff block
 */
function createDiffBlock(
  content: string,
  messageId: string,
  order: number
): Block {
  // Count additions and deletions
  const lines = content.split('\n');
  const additions = lines.filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  const deletions = lines.filter(l => l.startsWith('-') && !l.startsWith('---')).length;

  return {
    id: randomUUID(),
    messageId,
    type: 'diff',
    content,
    metadata: {
      additions,
      deletions,
    },
    order,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Advanced parser (future): Detect file references, diffs, diagrams
 *
 * Patterns to detect:
 * - File references: "In auth.ts:45", "Modified: src/auth.ts"
 * - Diffs: Lines starting with +/- (after ```)
 * - Diagrams: Code blocks with language 'mermaid'
 * - Errors: Stack traces, error keywords
 *
 * For now, these are left as text blocks.
 */

/**
 * Utility: Extract file references from text
 * Example: "In auth.ts:45" → { fileName: 'auth.ts', lineNumber: 45 }
 */
export function extractFileReferences(text: string): Array<{fileName: string; lineNumber?: number}> {
  const references: Array<{fileName: string; lineNumber?: number}> = [];

  // Pattern: filename.ext:lineNumber or just filename.ext
  const fileRefRegex = /(\w+\.\w+)(?::(\d+))?/g;

  let match: RegExpExecArray | null;
  while ((match = fileRefRegex.exec(text)) !== null) {
    references.push({
      fileName: match[1],
      lineNumber: match[2] ? parseInt(match[2], 10) : undefined,
    });
  }

  return references;
}

/**
 * Utility: Detect if code block is a diff
 */
export function isDiffBlock(content: string): boolean {
  const lines = content.split('\n');
  const diffLines = lines.filter(line => line.startsWith('+') || line.startsWith('-'));

  // If >30% of lines are diff markers, consider it a diff block
  return diffLines.length > lines.length * 0.3;
}

/**
 * Test helper: Parse a sample message and log blocks
 */
export function testParser(sampleMessage: string): void {
  console.log('=== Testing Message Parser ===\n');
  console.log('Input:\n', sampleMessage);
  console.log('\n--- Parsing ---\n');

  const result = parseMessageToBlocks(sampleMessage, 'test-message-id');

  console.log(`Found ${result.blocks.length} blocks:`);
  result.blocks.forEach((block, i) => {
    console.log(`\n[${i}] ${block.type.toUpperCase()} (order: ${block.order})`);
    console.log(`    ID: ${block.id}`);
    console.log(`    Content: ${block.content.slice(0, 50)}...`);
    console.log(`    Metadata:`, block.metadata);
  });

  if (result.warnings.length > 0) {
    console.log('\nWarnings:', result.warnings);
  }
  if (result.errors.length > 0) {
    console.log('\nErrors:', result.errors);
  }
}

// Example usage:
if (require.main === module) {
  const sampleMessage = `로그인 버그를 고치려면 다음과 같이 bcrypt를 사용하세요:

\`\`\`typescript
// auth.ts
const hash = await bcrypt.hash(password, 10);
const isValid = await bcrypt.compare(inputPassword, hash);
\`\`\`

먼저 bcrypt를 설치해야 합니다:

\`\`\`bash
npm install bcrypt
npm install --save-dev @types/bcrypt
\`\`\`

이렇게 하면 MD5 대신 안전한 해싱을 사용하게 됩니다.`;

  testParser(sampleMessage);
}
