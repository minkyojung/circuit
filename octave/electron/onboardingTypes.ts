/**
 * Onboarding Types
 *
 * Type definitions for the onboarding flow
 */

export interface OnboardingState {
  step: number
  completed: boolean
  user: GitHubUser | null
  availableRepos: Repository[]
  selectedRepos: string[]
  clonedPath: string | null
}

export interface OnboardingResult {
  success: boolean
  projectPath?: string
  user?: GitHubUser
  error?: string
  canRetry?: boolean
}

export interface GitHubUser {
  username: string
  name: string
  email: string
  avatarUrl: string
}

export interface Repository {
  id: number
  name: string
  fullName: string
  description: string
  cloneUrl: string
  sshUrl: string
  htmlUrl: string
  private: boolean
  stars: number
  language: string
  updatedAt: string
  defaultBranch: string
  owner: {
    login: string
  }
  permissions?: {
    admin: boolean
    push: boolean
    pull: boolean
  }
}

export interface EnvironmentStatus {
  git: GitStatus
  gitConfig: GitConfigStatus
  cli: CLIStatus
}

export interface GitStatus {
  installed: boolean
  version?: string
  status: 'ok' | 'error'
  message?: string
}

export interface GitConfigStatus {
  configured: boolean
  name?: string
  email?: string
  status: 'ok' | 'warning'
  message?: string
}

export interface CLIStatus {
  installed: boolean
  version?: string
  authenticated: boolean
  username?: string
  action: 'none' | 'login' | 'install'
  status: 'ok' | 'warning' | 'info'
  message?: string
}

export interface OnboardingProgress {
  stage: 'auth' | 'env-check' | 'repos' | 'cloning' | 'config' | 'cli' | 'complete'
  percent: number
  message: string
}
