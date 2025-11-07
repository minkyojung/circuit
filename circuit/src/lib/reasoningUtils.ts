/**
 * Reasoning utilities for extracting and formatting file changes from thinking steps
 */

import type { ThinkingStep } from '@/types/thinking';
import type { FileChange } from './fileChangeAggregator';
import type { Block } from '@/types/conversation';

/**
 * Extracts file changes (Edit/Write operations) from thinking steps
 */
export function extractFileChanges(steps: ThinkingStep[]): FileChange[] {
  const fileChanges: FileChange[] = [];
  const seenFiles = new Set<string>();

  for (const step of steps) {
    if (step.type !== 'tool-use') continue;
    if (!step.filePath) continue;

    // Only track Edit and Write operations
    if (step.tool !== 'Edit' && step.tool !== 'Write') continue;

    // Calculate diff stats
    const stats = calculateDiffStats(step);

    // Deduplicate by file path (keep last occurrence)
    const key = step.filePath;
    if (seenFiles.has(key)) {
      // Update existing entry
      const existingIndex = fileChanges.findIndex(fc => fc.filePath === key);
      if (existingIndex !== -1) {
        fileChanges[existingIndex] = {
          filePath: step.filePath,
          changeType: step.tool === 'Write' ? 'created' : 'modified',
          additions: stats.additions,
          deletions: stats.deletions,
        };
      }
    } else {
      seenFiles.add(key);
      fileChanges.push({
        filePath: step.filePath,
        changeType: step.tool === 'Write' ? 'created' : 'modified',
        additions: stats.additions,
        deletions: stats.deletions,
      });
    }
  }

  return fileChanges;
}

/**
 * Calculate diff statistics from a ThinkingStep
 */
export function calculateDiffStats(step: ThinkingStep): { additions: number; deletions: number } {
  if (step.tool === 'Edit' && step.oldString && step.newString) {
    return calculateSimpleDiff(step.oldString, step.newString);
  }

  if (step.tool === 'Write' && step.content) {
    // For Write operations, count lines as additions
    const lines = step.content.split('\n').length;
    return { additions: lines, deletions: 0 };
  }

  return { additions: 0, deletions: 0 };
}

/**
 * Calculate simple line-based diff statistics
 * (Simplified version of FileChangeAggregator logic)
 */
function calculateSimpleDiff(oldContent: string, newContent: string): { additions: number; deletions: number } {
  const oldLines = oldContent.split('\n').filter(l => l.trim());
  const newLines = newContent.split('\n').filter(l => l.trim());

  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  const additions = newLines.filter(line => !oldSet.has(line)).length;
  const deletions = oldLines.filter(line => !newSet.has(line)).length;

  return { additions, deletions };
}

/**
 * Format diff stats into a human-readable string
 * Examples: "+135", "+135 -12", "-42"
 */
export function formatDiffStats(additions: number, deletions: number): string {
  const parts: string[] = [];

  if (additions > 0) parts.push(`+${additions}`);
  if (deletions > 0) parts.push(`-${deletions}`);

  return parts.length > 0 ? parts.join(' ') : '';
}

/**
 * Get file name from file path
 */
export function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath;
}

/**
 * Convert FileSummaryBlock to FileChange[] format
 * Provides a unified data structure for file change display
 */
export function convertFileSummaryBlockToFileChanges(block: Block): FileChange[] {
  if (block.type !== 'file-summary' || !block.metadata?.files) {
    return [];
  }

  return block.metadata.files.map(file => ({
    filePath: file.filePath,
    changeType: file.changeType,
    additions: file.additions,
    deletions: file.deletions,
  }));
}
