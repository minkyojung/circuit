/**
 * File Change Detector Service
 *
 * Parses Claude responses to detect file edits and auto-open them
 * Extracted from WorkspaceChatEditor.tsx handleResponseComplete
 */

export class FileChangeDetector {
  /**
   * Parse Claude response to detect edited files
   * Returns array of file paths mentioned in the response
   */
  static parseFileChanges(response: string): string[] {
    const files: string[] = [];

    // Pattern 1: <file_path>path/to/file.ts</file_path>
    const filePathMatches = response.matchAll(/<file_path>(.*?)<\/file_path>/g);
    for (const match of filePathMatches) {
      files.push(match[1]);
    }

    // Pattern 2: "I'll edit src/App.tsx" or "수정했습니다" with README.md
    const editMentions = response.matchAll(
      /(?:edit|modify|update|create|추가|수정|변경|생성)(?:했습니다)?[^.]*?([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi
    );
    for (const match of editMentions) {
      const filePath = match[1];
      if (!files.includes(filePath)) {
        files.push(filePath);
      }
    }

    // Pattern 3: File paths mentioned anywhere (e.g., README.md, src/App.tsx)
    const filePathPattern = /\b([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)*\.[a-z]+)\b/gi;
    const allFileMatches = response.matchAll(filePathPattern);
    for (const match of allFileMatches) {
      const filePath = match[1];
      // Only include if it looks like a real file (not just any word.extension)
      if (
        !files.includes(filePath) &&
        (filePath.includes('/') ||
          filePath.toUpperCase() === filePath ||
          filePath.includes('README'))
      ) {
        files.push(filePath);
      }
    }

    // Pattern 4: Code blocks with file paths
    const codeBlockMatches = response.matchAll(
      /```[a-z]*\s*(?:\/\/|#)?\s*([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi
    );
    for (const match of codeBlockMatches) {
      const filePath = match[1];
      if (!files.includes(filePath)) {
        files.push(filePath);
      }
    }

    console.log('[FileChangeDetector] Detected files:', files);
    return files;
  }

  /**
   * Process file changes and trigger onFileEdit callback for each file
   */
  static processFileChanges(
    response: string,
    onFileEdit: (filePath: string) => void
  ): string[] {
    const editedFiles = this.parseFileChanges(response);

    console.log('[FileChangeDetector] Processing', editedFiles.length, 'file changes');

    // Auto-open edited files
    editedFiles.forEach((file) => {
      console.log('[FileChangeDetector] Auto-opening:', file);
      onFileEdit(file);
    });

    return editedFiles;
  }
}
