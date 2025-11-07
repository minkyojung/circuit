/**
 * Onboarding Type Definitions
 */

export type OnboardingStep = 'system-check' | 'repository' | 'complete';

export interface SystemCheckResult {
  // macOS
  macOSVersion: string;

  // Claude Code
  claudeCodeInstalled: boolean;
  claudeCodeAuthenticated: boolean;
  claudeCodeVersion?: string;
  claudeCodeMethod?: 'keychain' | 'file' | 'env' | 'none';
  claudeCodeSubscription?: 'free' | 'pro' | 'max';
  claudeCodeError?: string;

  // Git
  gitInstalled: boolean;
  gitConfigured: boolean;
  gitVersion?: string;
  gitUserName?: string;
  gitUserEmail?: string;
  gitConfigIssues?: string[];

  // GitHub
  githubAuthenticated: boolean;
  githubMethod?: 'ssh' | 'https' | 'gh-cli' | 'none';
  githubUsername?: string;
  githubError?: string;
  githubSuggestions?: string[];

  // Node.js (optional)
  nodeInstalled: boolean;
  nodeVersion?: string;
}

export interface RepositoryInfo {
  path: string;
  name: string;
  defaultBranch: string;
  remote?: string;
  branchCount?: number;
  lastCommit?: string;
}

export interface OnboardingState {
  // Current step
  currentStep: OnboardingStep;

  // Phase 1: System Check
  systemCheck: SystemCheckResult | null;

  // Phase 2: Repository
  repository: RepositoryInfo | null;

  // Phase 3: Workspace
  workspaceId: string | null;

  // Meta
  completedAt?: number;
  skipped: boolean;
}

export interface OnboardingStorage {
  version: number;
  completedAt: number;
  repository?: string;
  skipped: boolean;
}
