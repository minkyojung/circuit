/**
 * Onboarding Utilities
 * Handles system checks, storage, and onboarding state
 */

import type { SystemCheckResult, OnboardingStorage } from '@/types/onboarding';

const ONBOARDING_STORAGE_KEY = 'octave-onboarding';
const GITHUB_ONBOARDING_STORAGE_KEY = 'octave-github-onboarding';
const ONBOARDING_VERSION = 1;

// Legacy keys for migration from v0.0.4
const LEGACY_ONBOARDING_KEY = 'circuit-onboarding';
const LEGACY_GITHUB_ONBOARDING_KEY = 'circuit-github-onboarding';

/**
 * Migrate legacy localStorage keys from 'circuit-*' to 'octave-*'
 * This ensures users upgrading from v0.0.4 don't see onboarding again.
 *
 * @internal Called automatically by isOnboardingComplete() and isGitHubOnboardingComplete()
 */
function migrateLocalStorageKeys(): void {
  try {
    // Migrate main onboarding key
    const legacyOnboarding = localStorage.getItem(LEGACY_ONBOARDING_KEY);
    if (legacyOnboarding && !localStorage.getItem(ONBOARDING_STORAGE_KEY)) {
      console.log('[Onboarding] Migrating from v0.0.4: circuit-onboarding → octave-onboarding');
      localStorage.setItem(ONBOARDING_STORAGE_KEY, legacyOnboarding);
      localStorage.removeItem(LEGACY_ONBOARDING_KEY);
    }

    // Migrate GitHub onboarding key
    const legacyGitHub = localStorage.getItem(LEGACY_GITHUB_ONBOARDING_KEY);
    if (legacyGitHub && !localStorage.getItem(GITHUB_ONBOARDING_STORAGE_KEY)) {
      console.log('[Onboarding] Migrating from v0.0.4: circuit-github-onboarding → octave-github-onboarding');
      localStorage.setItem(GITHUB_ONBOARDING_STORAGE_KEY, legacyGitHub);
      localStorage.removeItem(LEGACY_GITHUB_ONBOARDING_KEY);
    }
  } catch (error) {
    console.error('[Onboarding] Failed to migrate localStorage keys:', error);
  }
}

/**
 * Check if onboarding has been completed
 */
export function isOnboardingComplete(): boolean {
  // Run migration first
  migrateLocalStorageKeys();

  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!stored) return false;

    const data: OnboardingStorage = JSON.parse(stored);
    return data.version === ONBOARDING_VERSION && (data.completedAt > 0 || data.skipped);
  } catch {
    return false;
  }
}

/**
 * Mark onboarding as complete
 */
export function completeOnboarding(repository?: string): void {
  const data: OnboardingStorage = {
    version: ONBOARDING_VERSION,
    completedAt: Date.now(),
    repository,
    skipped: false,
  };
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Skip onboarding
 */
export function skipOnboarding(): void {
  const data: OnboardingStorage = {
    version: ONBOARDING_VERSION,
    completedAt: Date.now(),
    skipped: true,
  };
  localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Reset onboarding (for testing)
 */
export function resetOnboarding(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

/**
 * Run system checks
 */
export async function runSystemCheck(): Promise<SystemCheckResult> {
  const ipcRenderer = window.electron.ipcRenderer;

  // macOS version
  const macOSVersion = await getMacOSVersion();

  // Claude Code authentication check
  let claudeCodeInstalled = false;
  let claudeCodeAuthenticated = false;
  let claudeCodeVersion: string | undefined;
  let claudeCodeMethod: 'keychain' | 'file' | 'env' | 'none' = 'none';
  let claudeCodeSubscription: 'free' | 'pro' | 'max' | undefined;
  let claudeCodeError: string | undefined;

  try {
    const result = await ipcRenderer.invoke('check-claude-auth');
    if (result.success && result.auth) {
      claudeCodeInstalled = result.auth.installed;
      claudeCodeAuthenticated = result.auth.authenticated;
      claudeCodeVersion = result.auth.version;
      claudeCodeMethod = result.auth.method;
      claudeCodeSubscription = result.auth.subscriptionType;
      claudeCodeError = result.auth.error;
    }
  } catch (error) {
    console.error('Failed to check Claude Code:', error);
    claudeCodeError = 'Check failed';
  }

  // Git configuration check
  let gitInstalled = false;
  let gitConfigured = false;
  let gitVersion: string | undefined;
  let gitUserName: string | undefined;
  let gitUserEmail: string | undefined;
  let gitConfigIssues: string[] | undefined;

  try {
    const result = await ipcRenderer.invoke('check-git-config');
    if (result.success && result.config) {
      gitInstalled = result.config.installed;
      gitConfigured = result.config.configured;
      gitVersion = result.config.version;
      gitUserName = result.config.userName;
      gitUserEmail = result.config.userEmail;
      gitConfigIssues = result.config.issues;
    }
  } catch (error) {
    console.error('Failed to check Git:', error);
  }

  // GitHub authentication check
  let githubAuthenticated = false;
  let githubMethod: 'ssh' | 'https' | 'gh-cli' | 'none' = 'none';
  let githubUsername: string | undefined;
  let githubError: string | undefined;
  let githubSuggestions: string[] | undefined;

  try {
    const result = await ipcRenderer.invoke('check-github-auth');
    if (result.success && result.auth) {
      githubAuthenticated = result.auth.authenticated;
      githubMethod = result.auth.method;
      githubUsername = result.auth.username;
      githubError = result.auth.error;
      githubSuggestions = result.auth.suggestions;
    }
  } catch (error) {
    console.error('Failed to check GitHub:', error);
  }

  // Node.js check (optional)
  let nodeInstalled = false;
  let nodeVersion: string | undefined;
  try {
    const result = await ipcRenderer.invoke('check-node');
    nodeInstalled = result.installed;
    nodeVersion = result.version;
  } catch (error) {
    console.error('Failed to check Node.js:', error);
  }

  return {
    macOSVersion,
    claudeCodeInstalled,
    claudeCodeAuthenticated,
    claudeCodeVersion,
    claudeCodeMethod,
    claudeCodeSubscription,
    claudeCodeError,
    gitInstalled,
    gitConfigured,
    gitVersion,
    gitUserName,
    gitUserEmail,
    gitConfigIssues,
    githubAuthenticated,
    githubMethod,
    githubUsername,
    githubError,
    githubSuggestions,
    nodeInstalled,
    nodeVersion,
  };
}

/**
 * Get macOS version
 */
async function getMacOSVersion(): Promise<string> {
  if (typeof window !== 'undefined' && window.platform === 'darwin') {
    // Get version from main process if available
    try {
      const version = await window.electron.ipcRenderer.invoke('get-macos-version');
      return version;
    } catch {
      return 'macOS (version unknown)';
    }
  }
  return 'Unknown OS';
}

/**
 * GitHub Onboarding Functions
 */

interface GitHubOnboardingStorage {
  version: number;
  completedAt: number;
  clonedRepos: string[];
  skipped: boolean;
}

/**
 * Check if GitHub onboarding has been completed
 * Checks both localStorage flag AND GitHub OAuth token
 */
export async function isGitHubOnboardingComplete(): Promise<boolean> {
  // Run migration first
  migrateLocalStorageKeys();

  try {
    // Check localStorage flag
    const stored = localStorage.getItem(GITHUB_ONBOARDING_STORAGE_KEY);
    if (!stored) return false;

    const data: GitHubOnboardingStorage = JSON.parse(stored);
    if (data.version !== ONBOARDING_VERSION) return false;
    if (data.skipped) return false;
    if (data.completedAt === 0) return false;

    // Also check if GitHub OAuth token exists
    const ipcRenderer = window.electron.ipcRenderer;
    const tokenResult = await ipcRenderer.invoke('github:oauth:get-token');

    return tokenResult.success && !!tokenResult.accessToken;
  } catch {
    return false;
  }
}

/**
 * Mark GitHub onboarding as complete
 */
export function completeGitHubOnboarding(clonedRepos: string[]): void {
  const data: GitHubOnboardingStorage = {
    version: ONBOARDING_VERSION,
    completedAt: Date.now(),
    clonedRepos,
    skipped: false,
  };
  localStorage.setItem(GITHUB_ONBOARDING_STORAGE_KEY, JSON.stringify(data));
}

/**
 * Reset GitHub onboarding (for testing)
 */
export function resetGitHubOnboarding(): void {
  localStorage.removeItem(GITHUB_ONBOARDING_STORAGE_KEY);
}

/**
 * Check if Claude Code is authenticated
 */
export async function checkClaudeCodeAuth(): Promise<boolean> {
  try {
    const result = await window.electron.ipcRenderer.invoke('check-claude-code-auth');
    return result.authenticated;
  } catch (error) {
    console.error('Failed to check Claude Code auth:', error);
    return false;
  }
}

/**
 * Open terminal with command
 */
export async function openTerminalWithCommand(command: string): Promise<void> {
  try {
    await window.electron.ipcRenderer.invoke('open-terminal', command);
  } catch (error) {
    console.error('Failed to open terminal:', error);
  }
}
