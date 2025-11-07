/**
 * Onboarding Utilities
 * Handles system checks, storage, and onboarding state
 */

import type { SystemCheckResult, OnboardingStorage } from '@/types/onboarding';

const ONBOARDING_STORAGE_KEY = 'circuit-onboarding';
const ONBOARDING_VERSION = 1;

/**
 * Check if onboarding has been completed
 */
export function isOnboardingComplete(): boolean {
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

  // Claude Code check
  let claudeCodeInstalled = false;
  let claudeCodeVersion: string | undefined;
  try {
    const result = await ipcRenderer.invoke('check-claude-code');
    claudeCodeInstalled = result.installed;
    claudeCodeVersion = result.version;
  } catch (error) {
    console.error('Failed to check Claude Code:', error);
  }

  // Git check
  let gitInstalled = false;
  let gitVersion: string | undefined;
  try {
    const result = await ipcRenderer.invoke('check-git');
    gitInstalled = result.installed;
    gitVersion = result.version;
  } catch (error) {
    console.error('Failed to check Git:', error);
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
    claudeCodeVersion,
    gitInstalled,
    gitVersion,
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
