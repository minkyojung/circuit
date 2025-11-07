/**
 * Git & GitHub Authentication Detection
 *
 * Checks:
 * 1. Git installation and version
 * 2. Git configuration (user.name, user.email)
 * 3. GitHub authentication (SSH, HTTPS, gh CLI)
 */

import { spawnSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface GitConfigStatus {
  installed: boolean;
  version?: string;
  configured: boolean;
  userName?: string;
  userEmail?: string;
  issues: string[];
}

export interface GitHubAuthStatus {
  authenticated: boolean;
  method: 'ssh' | 'https' | 'gh-cli' | 'none';
  username?: string;
  error?: string;
  suggestions?: string[];
}

/**
 * Check if Git is installed and get version
 */
export async function checkGitInstalled(): Promise<{
  installed: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = spawnSync('git', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    if (result.status === 0 && result.stdout) {
      const version = result.stdout.trim().replace('git version ', '');
      return {
        installed: true,
        version,
      };
    }

    return {
      installed: false,
      error: 'Git command failed',
    };
  } catch {
    return {
      installed: false,
      error: 'Git not found in PATH',
    };
  }
}

/**
 * Check Git configuration (user.name, user.email)
 */
export async function checkGitConfig(): Promise<GitConfigStatus> {
  const gitCheck = await checkGitInstalled();

  if (!gitCheck.installed) {
    return {
      installed: false,
      configured: false,
      issues: ['Git is not installed'],
    };
  }

  const issues: string[] = [];
  let userName: string | undefined;
  let userEmail: string | undefined;

  // Check user.name
  try {
    const result = spawnSync('git', ['config', '--get', 'user.name'], {
      encoding: 'utf8',
      timeout: 3000,
    });

    if (result.status === 0 && result.stdout) {
      userName = result.stdout.trim();
    } else {
      issues.push('user.name is not configured');
    }
  } catch {
    issues.push('user.name is not configured');
  }

  // Check user.email
  try {
    const result = spawnSync('git', ['config', '--get', 'user.email'], {
      encoding: 'utf8',
      timeout: 3000,
    });

    if (result.status === 0 && result.stdout) {
      userEmail = result.stdout.trim();
    } else {
      issues.push('user.email is not configured');
    }
  } catch {
    issues.push('user.email is not configured');
  }

  return {
    installed: true,
    version: gitCheck.version,
    configured: issues.length === 0,
    userName,
    userEmail,
    issues,
  };
}

/**
 * Configure Git (user.name, user.email)
 */
export async function configureGit(
  name: string,
  email: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Set user.name
    execSync(`git config --global user.name "${name}"`, {
      encoding: 'utf8',
      timeout: 3000,
    });

    // Set user.email
    execSync(`git config --global user.email "${email}"`, {
      encoding: 'utf8',
      timeout: 3000,
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure Git',
    };
  }
}

/**
 * Check GitHub authentication (SSH, HTTPS, gh CLI)
 */
export async function checkGitHubAuth(): Promise<GitHubAuthStatus> {
  // Method 1: Try SSH
  const sshAuth = await checkGitHubSSH();
  if (sshAuth.authenticated) {
    return sshAuth;
  }

  // Method 2: Try GitHub CLI
  const ghAuth = await checkGitHubCLI();
  if (ghAuth.authenticated) {
    return ghAuth;
  }

  // Method 3: Try HTTPS with credential helper
  const httpsAuth = await checkGitHubHTTPS();
  if (httpsAuth.authenticated) {
    return httpsAuth;
  }

  // Not authenticated - provide suggestions
  return {
    authenticated: false,
    method: 'none',
    suggestions: [
      'Set up SSH keys: https://docs.github.com/en/authentication/connecting-to-github-with-ssh',
      'Install GitHub CLI: https://cli.github.com/',
      'Configure Git credential helper: git config --global credential.helper osxkeychain',
    ],
  };
}

/**
 * Check GitHub SSH authentication
 */
async function checkGitHubSSH(): Promise<GitHubAuthStatus> {
  try {
    const result = spawnSync('ssh', ['-T', 'git@github.com'], {
      encoding: 'utf8',
      timeout: 10000,
    });

    // GitHub returns exit code 1 on successful auth (refuses shell access)
    const output = (result.stdout || '') + (result.stderr || '');
    const match = output.match(/Hi ([^!]+)!/);

    if (match) {
      return {
        authenticated: true,
        method: 'ssh',
        username: match[1],
      };
    }

    // Check if SSH keys exist
    const sshKeys = [
      join(homedir(), '.ssh', 'id_rsa'),
      join(homedir(), '.ssh', 'id_ed25519'),
      join(homedir(), '.ssh', 'id_ecdsa'),
    ];

    const hasKeys = sshKeys.some((key) => existsSync(key));

    return {
      authenticated: false,
      method: 'none',
      error: hasKeys
        ? 'SSH keys exist but not added to GitHub account'
        : 'No SSH keys found',
    };
  } catch {
    return {
      authenticated: false,
      method: 'none',
      error: 'SSH authentication failed',
    };
  }
}

/**
 * Check GitHub CLI authentication
 */
async function checkGitHubCLI(): Promise<GitHubAuthStatus> {
  try {
    // Check if gh is installed
    const versionResult = spawnSync('gh', ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    if (versionResult.status !== 0) {
      return {
        authenticated: false,
        method: 'none',
        error: 'GitHub CLI not installed',
      };
    }

    // Check auth status
    const authResult = spawnSync('gh', ['auth', 'status'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    const output = (authResult.stdout || '') + (authResult.stderr || '');

    if (output.includes('Logged in to github.com')) {
      // Extract username
      const match = output.match(/Logged in to github.com as ([^\s(]+)/);
      return {
        authenticated: true,
        method: 'gh-cli',
        username: match?.[1],
      };
    }

    return {
      authenticated: false,
      method: 'none',
      error: 'GitHub CLI not authenticated',
    };
  } catch {
    return {
      authenticated: false,
      method: 'none',
      error: 'GitHub CLI check failed',
    };
  }
}

/**
 * Check HTTPS authentication (credential helper)
 */
async function checkGitHubHTTPS(): Promise<GitHubAuthStatus> {
  try {
    // Test with a public repo (read-only, won't trigger auth prompt)
    const result = spawnSync(
      'git',
      ['ls-remote', 'https://github.com/octocat/Hello-World.git'],
      {
        encoding: 'utf8',
        timeout: 15000,
      }
    );

    if (result.status === 0) {
      return {
        authenticated: true,
        method: 'https',
      };
    }

    return {
      authenticated: false,
      method: 'none',
      error: 'HTTPS authentication failed',
    };
  } catch {
    return {
      authenticated: false,
      method: 'none',
      error: 'HTTPS check failed',
    };
  }
}

/**
 * Generate SSH key for GitHub
 */
export async function generateSSHKey(
  email: string
): Promise<{ success: boolean; publicKey?: string; error?: string }> {
  try {
    const keyPath = join(homedir(), '.ssh', 'id_ed25519');

    // Check if key already exists
    if (existsSync(keyPath)) {
      const { readFileSync } = await import('fs');
      const publicKey = readFileSync(`${keyPath}.pub`, 'utf8');
      return {
        success: true,
        publicKey,
      };
    }

    // Generate new key (no passphrase for simplicity)
    execSync(`ssh-keygen -t ed25519 -C "${email}" -f "${keyPath}" -N ""`, {
      encoding: 'utf8',
      timeout: 10000,
    });

    const { readFileSync } = await import('fs');
    const publicKey = readFileSync(`${keyPath}.pub`, 'utf8');

    return {
      success: true,
      publicKey,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate SSH key',
    };
  }
}

/**
 * Test SSH connection to GitHub
 */
export async function testGitHubSSHConnection(): Promise<{
  authenticated: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const result = spawnSync('ssh', ['-T', 'git@github.com'], {
      encoding: 'utf8',
      timeout: 10000,
    });

    const output = (result.stdout || '') + (result.stderr || '');
    const match = output.match(/Hi ([^!]+)!/);

    if (match) {
      return {
        authenticated: true,
        username: match[1],
      };
    }

    return {
      authenticated: false,
      error: 'SSH key not recognized by GitHub',
    };
  } catch (error) {
    return {
      authenticated: false,
      error: error instanceof Error ? error.message : 'SSH connection failed',
    };
  }
}
