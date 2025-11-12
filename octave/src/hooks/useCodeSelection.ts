/**
 * useCodeSelection Hook
 *
 * Handles code selection actions from the editor (ask, explain, optimize, add-tests).
 * Automatically processes the action and clears it after handling.
 *
 * @example
 * useCodeSelection({
 *   codeSelectionAction,
 *   onCodeSelectionHandled: () => clearAction(),
 *   executePrompt: (prompt, attachments, mode) => {...},
 *   setCodeAttachment: (attachment) => {...}
 * });
 */

import { useEffect } from 'react';
import type { AttachedFile } from '@/components/workspace/ChatInput';

interface CodeSelectionAction {
  type: 'ask' | 'explain' | 'optimize' | 'add-tests';
  code: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

interface UseCodeSelectionParams {
  codeSelectionAction: CodeSelectionAction | null;
  onCodeSelectionHandled?: () => void;
  executePrompt: (
    prompt: string,
    attachments: AttachedFile[],
    thinkingMode: 'normal' | 'extended' | 'plan',
    architectMode: boolean
  ) => void;
  setCodeAttachment: (attachment: {
    code: string;
    filePath: string;
    lineStart: number;
    lineEnd: number;
  } | null) => void;
}

export function useCodeSelection({
  codeSelectionAction,
  onCodeSelectionHandled,
  executePrompt,
  setCodeAttachment,
}: UseCodeSelectionParams): void {
  useEffect(() => {
    if (!codeSelectionAction) return;

    const { type, code, filePath, lineStart, lineEnd } = codeSelectionAction;

    if (type === 'ask') {
      // For "Ask" action: Attach code to chat input for manual sending
      setCodeAttachment({ code, filePath, lineStart, lineEnd });
    } else {
      // For other actions: Auto-generate and send prompt
      const lineInfo = lineEnd !== lineStart ? `${lineStart}-${lineEnd}` : `${lineStart}`;
      let prompt = '';

      if (type === 'explain') {
        prompt = `Explain this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\``;
      } else if (type === 'optimize') {
        prompt = `Optimize this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\`\n\nProvide specific improvements for performance, readability, and maintainability.`;
      } else if (type === 'add-tests') {
        prompt = `Generate comprehensive tests for this code from ${filePath}:${lineInfo}:\n\n\`\`\`\n${code}\n\`\`\`\n\nInclude unit tests, edge cases, and integration tests where appropriate.`;
      }

      if (prompt) {
        executePrompt(prompt, [], 'normal', false);
      }
    }

    // Clear the action after handling
    onCodeSelectionHandled?.();
  }, [codeSelectionAction, onCodeSelectionHandled, executePrompt, setCodeAttachment]);
}
