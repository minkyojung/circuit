/**
 * Smart Commit Types (Frontend)
 */

export type CommitType = 'feat' | 'fix' | 'refactor' | 'docs' | 'test' | 'chore' | 'style' | 'perf';

export interface CommitGroup {
  id: string;
  type: CommitType;
  scope?: string;
  title: string;
  message: string;
  files: string[];
  reasoning: string;
}

export interface SmartCommitPlan {
  groups: CommitGroup[];
  totalFiles: number;
  analysis: string;
  complexity: 'simple' | 'moderate' | 'complex';
  warnings: Warning[];
  estimatedTime: number;
}

export interface Warning {
  type: 'large-commit' | 'mixed-concerns' | 'missing-tests' | 'breaking-change';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ExecutionProgress {
  stage: 'analyzing' | 'executing' | 'complete' | 'error';
  currentGroup?: number;
  totalGroups?: number;
  currentCommit?: {
    title: string;
    files: string[];
  };
  completedShas?: string[];
  error?: string;
}
