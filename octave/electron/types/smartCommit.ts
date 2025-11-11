/**
 * Smart Commit Types
 *
 * Type definitions for the Smart Commit feature that analyzes
 * git changes and creates atomic, well-structured commits.
 */

/**
 * Commit Type (Conventional Commits)
 */
export type CommitType = 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore' | 'style' | 'perf';

/**
 * Single commit group
 */
export interface CommitGroup {
  id: string;
  type: CommitType;
  scope?: string;                 // Optional scope (e.g., "auth", "api")
  title: string;                  // Short description (50 chars max)
  message: string;                // Full conventional commit message
  files: string[];                // Relative file paths
  reasoning: string;              // Why these files are grouped
}

/**
 * Analysis result from Claude
 */
export interface SmartCommitPlan {
  groups: CommitGroup[];
  totalFiles: number;
  analysis: string;               // Overall assessment
  complexity: 'simple' | 'moderate' | 'complex';
  warnings: Warning[];
  estimatedTime: number;          // Seconds
}

/**
 * Warning types
 */
export interface Warning {
  type: 'large-commit' | 'mixed-concerns' | 'missing-tests' | 'breaking-change';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Execution progress
 */
export interface ExecutionProgress {
  stage: 'analyzing' | 'executing' | 'complete' | 'error';
  currentGroup?: number;
  totalGroups?: number;
  currentCommit?: {
    title: string;
    files: string[];
  };
  completedShas?: string[];       // Commit SHAs for undo
  error?: string;
}

/**
 * Options for smart commit
 */
export interface SmartCommitOptions {
  mode: 'auto' | 'review';        // Auto execute or require review
  forceAuto?: boolean;            // Override warnings
  maxGroups?: number;             // Max commits to create (default: 10)
  maxFilesPerGroup?: number;      // Max files per commit (default: 20)
}

/**
 * Changed file information
 */
export interface ChangedFile {
  path: string;
  status: 'M' | 'A' | 'D' | 'R' | '??' | 'MM';  // Git status codes
  additions?: number;
  deletions?: number;
}
