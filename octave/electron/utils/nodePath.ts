/**
 * Node.js Path Detection Utility
 *
 * Finds the Node.js binary path across different installation methods and platforms.
 * Essential for Electron GUI apps that don't inherit shell environment variables.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Common Node.js installation paths on macOS
 */
const COMMON_NODE_PATHS = [
  '/opt/homebrew/bin',              // Apple Silicon Homebrew
  '/usr/local/bin',                 // Intel Mac Homebrew
  '/usr/bin',                       // System default
  '/bin',                           // System fallback
];

/**
 * Get Node.js binary directory path
 *
 * Strategy:
 * 1. Try to find node using shell environment (works in most cases)
 * 2. Check common installation paths
 * 3. Check version managers (nvm, fnm)
 * 4. Fallback to /usr/local/bin
 *
 * @returns Directory containing node binary (e.g., '/opt/homebrew/bin')
 */
export function getNodePath(): string {
  // Strategy 1: Use 'which node' with expanded PATH
  try {
    const expandedPath = buildExpandedPath();

    const nodePath = execSync('which node', {
      encoding: 'utf-8',
      shell: '/bin/zsh',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: expandedPath
      }
    }).trim();

    if (nodePath && existsSync(nodePath)) {
      const nodeDir = nodePath.substring(0, nodePath.lastIndexOf('/'));
      console.log('[NodePath] Found node via which:', nodeDir);
      return nodeDir;
    }
  } catch (error) {
    console.warn('[NodePath] which node failed:', (error as Error).message);
  }

  // Strategy 2: Check common paths directly
  for (const dir of COMMON_NODE_PATHS) {
    const nodeBinary = join(dir, 'node');
    if (existsSync(nodeBinary)) {
      console.log('[NodePath] Found node at common path:', dir);
      return dir;
    }
  }

  // Strategy 3: Check version managers
  const versionManagerPath = findNodeInVersionManagers();
  if (versionManagerPath) {
    console.log('[NodePath] Found node in version manager:', versionManagerPath);
    return versionManagerPath;
  }

  // Fallback
  console.warn('[NodePath] Could not find node, using fallback: /usr/local/bin');
  return '/usr/local/bin';
}

/**
 * Build comprehensive PATH including all common locations
 */
function buildExpandedPath(): string {
  const home = homedir();
  const paths = [
    ...COMMON_NODE_PATHS,
    // Version managers (with wildcards expanded)
    ...findNvmPaths(home),
    ...findFnmPaths(home),
    // User's existing PATH
    process.env.PATH || ''
  ];

  return paths.filter(Boolean).join(':');
}

/**
 * Find Node.js in nvm installations
 */
function findNvmPaths(home: string): string[] {
  const nvmDir = process.env.NVM_DIR || join(home, '.nvm');

  try {
    const versionsDir = join(nvmDir, 'versions', 'node');
    if (!existsSync(versionsDir)) return [];

    const fs = require('fs');
    const versions = fs.readdirSync(versionsDir);

    return versions
      .map((version: string) => join(versionsDir, version, 'bin'))
      .filter((path: string) => existsSync(path));
  } catch {
    return [];
  }
}

/**
 * Find Node.js in fnm installations
 */
function findFnmPaths(home: string): string[] {
  const fnmDir = process.env.FNM_DIR || join(home, '.fnm');

  try {
    const versionsDir = join(fnmDir, 'node-versions');
    if (!existsSync(versionsDir)) return [];

    const fs = require('fs');
    const versions = fs.readdirSync(versionsDir);

    return versions
      .map((version: string) => join(versionsDir, version, 'installation', 'bin'))
      .filter((path: string) => existsSync(path));
  } catch {
    return [];
  }
}

/**
 * Find Node.js in version managers (nvm, fnm)
 */
function findNodeInVersionManagers(): string | null {
  const home = homedir();

  // Check nvm
  const nvmPaths = findNvmPaths(home);
  if (nvmPaths.length > 0) {
    return nvmPaths[0]; // Use first found version
  }

  // Check fnm
  const fnmPaths = findFnmPaths(home);
  if (fnmPaths.length > 0) {
    return fnmPaths[0]; // Use first found version
  }

  return null;
}

/**
 * Get enhanced environment with Node.js in PATH
 *
 * Use this when spawning processes that need node
 *
 * @example
 * spawn('claude', args, { env: getNodeEnv() })
 */
export function getNodeEnv(): NodeJS.ProcessEnv {
  const nodePath = getNodePath();

  return {
    ...process.env,
    PATH: `${nodePath}:${process.env.PATH || '/usr/bin:/bin'}`
  };
}
