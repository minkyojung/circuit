/**
 * Onboarding Type Definitions
 */

export type OnboardingStep = 'system-check' | 'repository' | 'complete';

export interface SystemCheckResult {
  macOSVersion: string;
  claudeCodeInstalled: boolean;
  claudeCodeVersion?: string;
  gitInstalled: boolean;
  gitVersion?: string;
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
