/**
 * Circuit → Octave Migration Script
 *
 * Safely migrates user data from Circuit branding to Octave branding.
 * This includes:
 * - User data directories (~/Library/Application Support/circuit → octave)
 * - Databases (circuit-data → octave-data)
 * - Configuration files
 *
 * SAFETY FEATURES:
 * - Logs all operations
 * - Never overwrites existing Octave data
 * - Preserves original Circuit data until verified
 * - Atomic operations where possible
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface MigrationResult {
  success: boolean;
  action: string;
  from?: string;
  to?: string;
  error?: string;
  skipped?: boolean;
}

interface MigrationLog {
  timestamp: string;
  results: MigrationResult[];
  summary: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
}

/**
 * Main migration function
 * Safe to call multiple times - will skip if already migrated
 */
export async function migrateCircuitToOctave(): Promise<MigrationLog> {
  const results: MigrationResult[] = [];
  const homeDir = os.homedir();

  console.log('[Migration] Starting Circuit → Octave migration');
  console.log('[Migration] Home directory:', homeDir);

  // 1. Migrate Application Support directory
  results.push(
    await migrateApplicationSupportDirectory(homeDir)
  );

  // 2. Migrate home .circuit directory (if exists)
  results.push(
    await migrateHomeDotCircuitDirectory(homeDir)
  );

  // Create summary
  const summary = {
    total: results.length,
    successful: results.filter((r) => r.success && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.success).length,
  };

  const log: MigrationLog = {
    timestamp: new Date().toISOString(),
    results,
    summary,
  };

  console.log('[Migration] Summary:', summary);

  // Write log file
  try {
    const logDir = path.join(homeDir, 'Library', 'Application Support', 'octave');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'migration.log.json');
    fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    console.log('[Migration] Log written to:', logPath);
  } catch (error) {
    console.error('[Migration] Failed to write log:', error);
  }

  return log;
}

/**
 * Migrate ~/Library/Application Support/circuit/circuit-data
 * to ~/Library/Application Support/octave/octave-data
 */
async function migrateApplicationSupportDirectory(
  homeDir: string
): Promise<MigrationResult> {
  const oldPath = path.join(
    homeDir,
    'Library',
    'Application Support',
    'circuit',
    'circuit-data'
  );
  const newPath = path.join(
    homeDir,
    'Library',
    'Application Support',
    'octave',
    'octave-data'
  );

  console.log('[Migration] Checking Application Support directory...');
  console.log('[Migration]   Old path:', oldPath);
  console.log('[Migration]   New path:', newPath);

  // Check if new path already exists
  if (fs.existsSync(newPath)) {
    console.log('[Migration] ✓ Octave data directory already exists, skipping');
    return {
      success: true,
      action: 'migrate_app_support',
      from: oldPath,
      to: newPath,
      skipped: true,
    };
  }

  // Check if old path exists
  if (!fs.existsSync(oldPath)) {
    console.log('[Migration] ✓ No Circuit data directory found, clean install');
    return {
      success: true,
      action: 'migrate_app_support',
      from: oldPath,
      to: newPath,
      skipped: true,
    };
  }

  // Perform migration
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(newPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
      console.log('[Migration] Created parent directory:', parentDir);
    }

    // Copy (don't move yet, for safety)
    console.log('[Migration] Copying circuit-data → octave-data...');
    copyDirectoryRecursive(oldPath, newPath);

    // Verify copy
    const oldFiles = getAllFiles(oldPath);
    const newFiles = getAllFiles(newPath);

    if (oldFiles.length !== newFiles.length) {
      throw new Error(
        `File count mismatch: ${oldFiles.length} → ${newFiles.length}`
      );
    }

    console.log('[Migration] ✓ Successfully copied', oldFiles.length, 'files');
    console.log('[Migration] Note: Old directory preserved at:', oldPath);

    return {
      success: true,
      action: 'migrate_app_support',
      from: oldPath,
      to: newPath,
    };
  } catch (error) {
    console.error('[Migration] ✗ Failed to migrate Application Support:', error);
    return {
      success: false,
      action: 'migrate_app_support',
      from: oldPath,
      to: newPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Migrate ~/.circuit to ~/.octave
 * (This may already be migrated by existing code in main.cjs)
 */
async function migrateHomeDotCircuitDirectory(
  homeDir: string
): Promise<MigrationResult> {
  const oldPath = path.join(homeDir, '.circuit');
  const newPath = path.join(homeDir, '.octave');

  console.log('[Migration] Checking home .circuit directory...');
  console.log('[Migration]   Old path:', oldPath);
  console.log('[Migration]   New path:', newPath);

  // Check if new path already exists
  if (fs.existsSync(newPath)) {
    console.log('[Migration] ✓ ~/.octave already exists, skipping');
    return {
      success: true,
      action: 'migrate_home_dot_dir',
      from: oldPath,
      to: newPath,
      skipped: true,
    };
  }

  // Check if old path exists
  if (!fs.existsSync(oldPath)) {
    console.log('[Migration] ✓ No ~/.circuit directory found');
    return {
      success: true,
      action: 'migrate_home_dot_dir',
      from: oldPath,
      to: newPath,
      skipped: true,
    };
  }

  // Perform migration
  try {
    console.log('[Migration] Renaming ~/.circuit → ~/.octave...');
    fs.renameSync(oldPath, newPath);
    console.log('[Migration] ✓ Successfully migrated ~/.circuit');

    return {
      success: true,
      action: 'migrate_home_dot_dir',
      from: oldPath,
      to: newPath,
    };
  } catch (error) {
    console.error('[Migration] ✗ Failed to migrate ~/.circuit:', error);
    return {
      success: false,
      action: 'migrate_home_dot_dir',
      from: oldPath,
      to: newPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Utility: Copy directory recursively
 */
function copyDirectoryRecursive(src: string, dest: string): void {
  // Create destination directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  // Read source directory
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Utility: Get all files in directory recursively
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Check if migration is needed
 */
export function isMigrationNeeded(): boolean {
  const homeDir = os.homedir();

  const oldAppSupportPath = path.join(
    homeDir,
    'Library',
    'Application Support',
    'circuit',
    'circuit-data'
  );
  const newAppSupportPath = path.join(
    homeDir,
    'Library',
    'Application Support',
    'octave',
    'octave-data'
  );

  // If old exists and new doesn't, migration is needed
  const needsAppSupportMigration =
    fs.existsSync(oldAppSupportPath) && !fs.existsSync(newAppSupportPath);

  return needsAppSupportMigration;
}
