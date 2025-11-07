/**
 * File Change Detector Service
 *
 * Parses Claude responses to detect file edits and auto-open them
 * Extracted from WorkspaceChatEditor.tsx handleResponseComplete
 */

// @ts-ignore
const { ipcRenderer } = window.require('electron');

export class FileChangeDetector {
  /**
   * Parse Claude response to detect edited files
   * Returns array of file paths mentioned in the response (only files that exist)
   */
  static async parseFileChanges(response: string, workspaceRoot: string): Promise<string[]> {
    const candidateFiles: string[] = [];

    // Pattern 1: <file_path>path/to/file.ts</file_path>
    const filePathMatches = response.matchAll(/<file_path>(.*?)<\/file_path>/g);
    for (const match of filePathMatches) {
      candidateFiles.push(match[1]);
    }

    // Pattern 2: "I'll edit src/App.tsx" or "수정했습니다" with README.md
    const editMentions = response.matchAll(
      /(?:edit|modify|update|create|추가|수정|변경|생성)(?:했습니다)?[^.]*?([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi
    );
    for (const match of editMentions) {
      const filePath = match[1];
      if (!candidateFiles.includes(filePath)) {
        candidateFiles.push(filePath);
      }
    }

    // Pattern 3: File paths mentioned anywhere (e.g., README.md, src/App.tsx)
    const filePathPattern = /\b([a-zA-Z0-9_\-]+(?:\/[a-zA-Z0-9_\-]+)*\.[a-z]+)\b/gi;
    const allFileMatches = response.matchAll(filePathPattern);
    for (const match of allFileMatches) {
      const filePath = match[1];
      // Only include if it looks like a real file (not just any word.extension)
      if (
        !candidateFiles.includes(filePath) &&
        (filePath.includes('/') ||
          filePath.toUpperCase() === filePath ||
          filePath.includes('README'))
      ) {
        candidateFiles.push(filePath);
      }
    }

    // Pattern 4: Code blocks with file paths
    const codeBlockMatches = response.matchAll(
      /```[a-z]*\s*(?:\/\/|#)?\s*([a-zA-Z0-9_\-/.]+\.[a-z]+)/gi
    );
    for (const match of codeBlockMatches) {
      const filePath = match[1];
      if (!candidateFiles.includes(filePath)) {
        candidateFiles.push(filePath);
      }
    }

    console.log('[FileChangeDetector] Candidate files found:', candidateFiles);

    // ✅ NEW: Validate file existence
    const validFiles: string[] = [];
    for (const file of candidateFiles) {
      // Build absolute path
      const absolutePath = file.startsWith('/') || file.match(/^[A-Z]:\\/)
        ? file
        : `${workspaceRoot}/${file}`;

      try {
        // Check if file exists using Electron IPC
        const exists = await ipcRenderer.invoke('file-exists', absolutePath);
        if (exists) {
          validFiles.push(file);
          console.log('[FileChangeDetector] ✅ File exists:', file);
        } else {
          console.warn('[FileChangeDetector] ⚠️ File does not exist, ignoring:', file);
        }
      } catch (error) {
        console.error('[FileChangeDetector] Error checking file existence:', file, error);
      }
    }

    console.log('[FileChangeDetector] Valid files to open:', validFiles);
    return validFiles;
  }

  /**
   * Process file changes and trigger onFileEdit callback for each file
   */
  static async processFileChanges(
    response: string,
    workspaceRoot: string,
    onFileEdit: (filePath: string) => void
  ): Promise<string[]> {
    const editedFiles = await this.parseFileChanges(response, workspaceRoot);

    console.log('[FileChangeDetector] Processing', editedFiles.length, 'valid file changes');

    // Auto-open edited files (only files that exist)
    editedFiles.forEach((file) => {
      console.log('[FileChangeDetector] Auto-opening:', file);
      onFileEdit(file);
    });

    return editedFiles;
  }
}
