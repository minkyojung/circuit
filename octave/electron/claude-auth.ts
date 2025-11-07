/**
 * Claude Code Authentication Detection
 *
 * Checks if Claude Code is installed and authenticated by examining:
 * 1. macOS Keychain (primary method)
 * 2. Credential files (Linux/containers fallback)
 * 3. Environment variables
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ClaudeAuthStatus {
  installed: boolean;
  authenticated: boolean;
  method: 'keychain' | 'file' | 'env' | 'none';
  version?: string;
  expiresAt?: Date;
  isExpired?: boolean;
  subscriptionType?: 'free' | 'pro' | 'max';
  error?: string;
}

const CLAUDE_CLI_PATH = join(homedir(), '.claude', 'local', 'claude');

/**
 * Check if Claude Code CLI is installed
 */
export function isClaudeInstalled(): boolean {
  try {
    return existsSync(CLAUDE_CLI_PATH);
  } catch {
    return false;
  }
}

/**
 * Get Claude CLI version
 */
export async function getClaudeVersion(): Promise<string | null> {
  try {
    const result = spawnSync(CLAUDE_CLI_PATH, ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    if (result.status === 0 && result.stdout) {
      return result.stdout.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check Claude Code authentication status
 * Tries multiple methods in order of reliability
 */
export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  // Check installation first
  const installed = isClaudeInstalled();
  if (!installed) {
    return {
      installed: false,
      authenticated: false,
      method: 'none',
      error: 'Claude Code CLI not found',
    };
  }

  const version = await getClaudeVersion();

  // Method 1: macOS Keychain (most reliable)
  if (process.platform === 'darwin') {
    const keychainAuth = checkMacOSKeychain();
    if (keychainAuth.authenticated) {
      return {
        ...keychainAuth,
        installed: true,
        version: version || undefined,
      };
    }
  }

  // Method 2: Credential files (Linux/containers)
  const fileAuth = checkCredentialFiles();
  if (fileAuth.authenticated) {
    return {
      ...fileAuth,
      installed: true,
      version: version || undefined,
    };
  }

  // Method 3: Environment variables
  const envAuth = checkEnvironmentVariables();
  if (envAuth.authenticated) {
    return {
      ...envAuth,
      installed: true,
      version: version || undefined,
    };
  }

  return {
    installed: true,
    authenticated: false,
    method: 'none',
    version: version || undefined,
    error: 'No authentication found - please log in to Claude Code app',
  };
}

/**
 * Check macOS Keychain for Claude Code credentials
 */
function checkMacOSKeychain(): ClaudeAuthStatus {
  try {
    const username = process.env.USER || '';
    const result = spawnSync(
      'security',
      ['find-generic-password', '-s', 'Claude Code-credentials', '-a', username, '-w'],
      { encoding: 'utf8', timeout: 5000 }
    );

    if (result.status === 0 && result.stdout) {
      const credentials = JSON.parse(result.stdout.trim());

      // Handle both new and legacy formats
      const oauth = credentials.claudeAiOauth || credentials.oauthAccount;

      if (oauth) {
        const expiresAt = new Date(oauth.expiresAt);
        const isExpired = expiresAt < new Date();

        return {
          installed: true,
          authenticated: !isExpired,
          method: 'keychain',
          expiresAt,
          isExpired,
          subscriptionType: oauth.subscriptionType,
          error: isExpired ? 'Token expired - please re-login to Claude Code app' : undefined,
        };
      }
    }
  } catch (error) {
    console.error('[ClaudeAuth] Keychain check failed:', error);
  }

  return {
    installed: true,
    authenticated: false,
    method: 'none',
  };
}

/**
 * Check credential files (Linux/containers)
 */
function checkCredentialFiles(): ClaudeAuthStatus {
  const paths = [
    join(homedir(), '.claude', '.credentials.json'),
    join(homedir(), '.claude.json'),
  ];

  for (const path of paths) {
    try {
      if (existsSync(path)) {
        const data = JSON.parse(readFileSync(path, 'utf8'));
        const oauth = data.claudeAiOauth || data.oauthAccount;

        if (oauth) {
          const expiresAt = new Date(oauth.expiresAt);
          const isExpired = expiresAt < new Date();

          return {
            installed: true,
            authenticated: !isExpired,
            method: 'file',
            expiresAt,
            isExpired,
            subscriptionType: oauth.subscriptionType,
            error: isExpired ? 'Token expired' : undefined,
          };
        }
      }
    } catch {
      continue;
    }
  }

  return {
    installed: true,
    authenticated: false,
    method: 'none',
  };
}

/**
 * Check environment variables
 */
function checkEnvironmentVariables(): ClaudeAuthStatus {
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    return {
      installed: true,
      authenticated: true,
      method: 'env',
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    return {
      installed: true,
      authenticated: true,
      method: 'env',
    };
  }

  return {
    installed: true,
    authenticated: false,
    method: 'none',
  };
}

/**
 * Open Claude Code desktop app (for login)
 */
export async function openClaudeApp(): Promise<{ success: boolean; error?: string }> {
  try {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);

    if (process.platform === 'darwin') {
      await execAsync('open -a Claude');
    } else if (process.platform === 'win32') {
      await execAsync('start claude://');
    } else {
      // Linux
      await execAsync('claude &');
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to open Claude app',
    };
  }
}
