/**
 * Development Tools
 *
 * Utilities for development and debugging.
 * Exposed globally as window.devTools in development mode.
 */

import { resetGitHubOnboarding } from './onboarding';

export const devTools = {
  /**
   * Reset GitHub onboarding to see it again
   */
  resetGitHubOnboarding: () => {
    resetGitHubOnboarding();
    console.log('✅ GitHub onboarding reset. Reload the page to see it again.');
    console.log('Run: location.reload()');
  },

  /**
   * Reset regular onboarding
   */
  resetOnboarding: () => {
    localStorage.removeItem('circuit-onboarding');
    console.log('✅ Regular onboarding reset. Reload the page to see it again.');
    console.log('Run: location.reload()');
  },

  /**
   * Reset all onboarding
   */
  resetAllOnboarding: () => {
    resetGitHubOnboarding();
    localStorage.removeItem('circuit-onboarding');
    console.log('✅ All onboarding reset. Reload the page to see it again.');
    console.log('Run: location.reload()');
  },

  /**
   * Reset all onboarding and reload
   */
  resetAndReload: () => {
    resetGitHubOnboarding();
    localStorage.removeItem('circuit-onboarding');
    console.log('✅ All onboarding reset. Reloading...');
    window.location.reload();
  },

  /**
   * Clear GitHub OAuth token (for testing login flow)
   */
  clearGitHubToken: async () => {
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      await ipcRenderer.invoke('github:oauth:logout');
      console.log('✅ GitHub OAuth token cleared');
    } catch (error) {
      console.error('❌ Failed to clear GitHub token:', error);
    }
  },

  /**
   * Reset everything (onboarding + GitHub token)
   */
  resetEverything: async () => {
    try {
      // Reset onboarding
      resetGitHubOnboarding();
      localStorage.removeItem('circuit-onboarding');

      // Clear GitHub token
      const ipcRenderer = window.electron.ipcRenderer;
      await ipcRenderer.invoke('github:oauth:logout');

      console.log('✅ Everything reset (onboarding + GitHub token)');
      console.log('Reloading in 1 second...');

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('❌ Failed to reset everything:', error);
    }
  },

  /**
   * Show onboarding status
   */
  showOnboardingStatus: async () => {
    const githubOnboarding = localStorage.getItem('circuit-github-onboarding');
    const regularOnboarding = localStorage.getItem('circuit-onboarding');

    console.log('📊 Onboarding Status:');
    console.log('─────────────────────');

    if (githubOnboarding) {
      const data = JSON.parse(githubOnboarding);
      console.log('GitHub Onboarding: ✅ Complete');
      console.log('  - Completed at:', new Date(data.completedAt).toLocaleString());
      console.log('  - Cloned repos:', data.clonedRepos);
    } else {
      console.log('GitHub Onboarding: ❌ Not complete');
    }

    if (regularOnboarding) {
      const data = JSON.parse(regularOnboarding);
      console.log('Regular Onboarding: ✅ Complete');
      console.log('  - Completed at:', new Date(data.completedAt).toLocaleString());
      console.log('  - Skipped:', data.skipped);
    } else {
      console.log('Regular Onboarding: ❌ Not complete');
    }

    // Check GitHub token
    try {
      const ipcRenderer = window.electron.ipcRenderer;
      const tokenResult = await ipcRenderer.invoke('github:oauth:get-token');
      console.log('GitHub Token:', tokenResult.success ? '✅ Present' : '❌ Missing');
    } catch {
      console.log('GitHub Token: ❌ Error checking');
    }
  },

  /**
   * Show help
   */
  help: () => {
    console.log(`
🛠️  Development Tools
─────────────────────

Onboarding Reset:
  devTools.resetGitHubOnboarding()  - Reset GitHub onboarding
  devTools.resetOnboarding()        - Reset regular onboarding
  devTools.resetAllOnboarding()     - Reset all onboarding
  devTools.resetAndReload()         - Reset all + auto reload

GitHub Token:
  devTools.clearGitHubToken()       - Clear GitHub OAuth token

Complete Reset:
  devTools.resetEverything()        - Reset onboarding + token + reload

Status:
  devTools.showOnboardingStatus()   - Show current onboarding state

Help:
  devTools.help()                   - Show this help message
    `);
  },
};

// Expose devTools globally in development mode
if (typeof window !== 'undefined') {
  (window as any).devTools = devTools;

  // Auto-show help message in development
  if (import.meta.env.DEV) {
    console.log('🛠️  DevTools loaded! Type devTools.help() for available commands.');
  }
}
