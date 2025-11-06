/**
 * Project Configuration Service - LocalStorage Version
 * Temporary implementation using localStorage until IPC handlers are registered
 */

import type { ProjectConfig, AIRule } from '../types/project';
import { DEFAULT_PROJECT_CONFIG } from '../types/project';
import { SYSTEM_AI_RULES } from './projectConfig';

/**
 * Get localStorage key for workspace
 */
function getStorageKey(workspacePath: string): string {
  return `circuit:project:${workspacePath}`;
}

/**
 * Load project configuration from localStorage
 */
export async function loadProjectConfig(
  workspacePath: string
): Promise<ProjectConfig | undefined> {
  try {
    const key = getStorageKey(workspacePath);
    const stored = localStorage.getItem(key);

    if (!stored) {
      return undefined;
    }

    const config: ProjectConfig = JSON.parse(stored);
    return config;
  } catch (error) {
    console.error('Failed to load project config from localStorage:', error);
    return undefined;
  }
}

/**
 * Save project configuration to localStorage
 */
export async function saveProjectConfig(
  workspacePath: string,
  config: ProjectConfig
): Promise<boolean> {
  try {
    const key = getStorageKey(workspacePath);

    // Update timestamp
    const updatedConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };

    // Save to localStorage
    localStorage.setItem(key, JSON.stringify(updatedConfig, null, 2));

    return true;
  } catch (error) {
    console.error('Failed to save project config to localStorage:', error);
    return false;
  }
}

/**
 * Create a new project configuration
 */
export async function createProjectConfig(
  workspacePath: string,
  overrides?: Partial<ProjectConfig>
): Promise<ProjectConfig> {
  const now = new Date().toISOString();

  // Get workspace name from path
  const workspaceName = workspacePath.split('/').pop() || 'Untitled Project';

  const config: ProjectConfig = {
    ...DEFAULT_PROJECT_CONFIG,
    name: workspaceName,
    ...overrides,
    createdAt: now,
    updatedAt: now,
  };

  // Save to localStorage
  await saveProjectConfig(workspacePath, config);

  return config;
}

/**
 * Update existing project configuration
 */
export async function updateProjectConfig(
  workspacePath: string,
  updates: Partial<ProjectConfig>
): Promise<ProjectConfig | undefined> {
  const existing = await loadProjectConfig(workspacePath);

  if (!existing) {
    console.error('Cannot update: project config does not exist');
    return undefined;
  }

  const updated: ProjectConfig = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const success = await saveProjectConfig(workspacePath, updated);

  return success ? updated : undefined;
}

/**
 * Delete project configuration
 */
export async function deleteProjectConfig(workspacePath: string): Promise<boolean> {
  try {
    const key = getStorageKey(workspacePath);
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to delete project config from localStorage:', error);
    return false;
  }
}

// ============================================================================
// AI Rules Management
// ============================================================================

/**
 * Add a new AI rule
 */
export async function addAIRule(
  workspacePath: string,
  rule: Omit<AIRule, 'id' | 'order'>
): Promise<AIRule | undefined> {
  let config = await loadProjectConfig(workspacePath);

  // Create config if it doesn't exist
  if (!config) {
    config = await createProjectConfig(workspacePath);
  }

  // Generate ID
  const id = `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Determine order (append to end)
  const order = config.ai.rules.length;

  const newRule: AIRule = {
    ...rule,
    id,
    order,
  };

  // Add to rules
  config.ai.rules.push(newRule);

  // Save
  await saveProjectConfig(workspacePath, config);

  return newRule;
}

/**
 * Update an existing AI rule
 */
export async function updateAIRule(
  workspacePath: string,
  ruleId: string,
  updates: Partial<AIRule>
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  const ruleIndex = config.ai.rules.findIndex((r) => r.id === ruleId);
  if (ruleIndex === -1) return false;

  // Update rule
  config.ai.rules[ruleIndex] = {
    ...config.ai.rules[ruleIndex],
    ...updates,
  };

  // Save
  await saveProjectConfig(workspacePath, config);

  return true;
}

/**
 * Delete an AI rule
 */
export async function deleteAIRule(workspacePath: string, ruleId: string): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  // Filter out the rule
  config.ai.rules = config.ai.rules.filter((r) => r.id !== ruleId);

  // Re-order remaining rules
  config.ai.rules.forEach((rule, index) => {
    rule.order = index;
  });

  // Save
  await saveProjectConfig(workspacePath, config);

  return true;
}

/**
 * Reorder AI rules
 */
export async function reorderAIRules(
  workspacePath: string,
  ruleIds: string[]
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  // Create a map for quick lookup
  const ruleMap = new Map(config.ai.rules.map((r) => [r.id, r]));

  // Reorder based on provided IDs
  const reordered: AIRule[] = [];
  for (let i = 0; i < ruleIds.length; i++) {
    const rule = ruleMap.get(ruleIds[i]);
    if (rule) {
      reordered.push({
        ...rule,
        order: i,
      });
    }
  }

  config.ai.rules = reordered;

  // Save
  await saveProjectConfig(workspacePath, config);

  return true;
}

/**
 * Get AI rules sorted by order
 */
export async function getAIRules(workspacePath: string): Promise<AIRule[]> {
  let config = await loadProjectConfig(workspacePath);

  // Create config if it doesn't exist
  if (!config) {
    config = await createProjectConfig(workspacePath);
  }

  return config.ai.rules.sort((a, b) => a.order - b.order);
}

/**
 * Get enabled AI rules as formatted string for AI context
 * Includes both system-level "The Architect" rules and project-specific rules
 */
export async function getAIRulesContext(workspacePath: string): Promise<string> {
  // Get user-defined rules
  const rules = await getAIRules(workspacePath);
  const enabledUserRules = rules.filter((r) => r.enabled);

  // Combine system rules + user rules
  const allRules = [...SYSTEM_AI_RULES, ...enabledUserRules.map((r) => r.content)];

  if (allRules.length === 0) {
    return '';
  }

  const rulesText = allRules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');

  return `# AI Coding Guidelines\n\nFollow these principles and rules when writing code:\n\n${rulesText}`;
}

// ============================================================================
// Cursor Rules Import/Export (Placeholder - requires file system)
// ============================================================================

/**
 * Import rules from Cursor's .cursorrules file
 * NOTE: Requires IPC file system handlers
 */
export async function importCursorRules(workspacePath: string): Promise<number> {
  console.warn('importCursorRules: Requires IPC file system - not available in localStorage mode');
  return 0;
}

/**
 * Export rules to Cursor's .cursorrules format
 * NOTE: Requires IPC file system handlers
 */
export async function exportCursorRules(workspacePath: string): Promise<boolean> {
  console.warn('exportCursorRules: Requires IPC file system - not available in localStorage mode');
  return false;
}

/**
 * Check if project config exists
 */
export async function projectConfigExists(workspacePath: string): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  return config !== undefined;
}

/**
 * Initialize project configuration for a new workspace
 */
export async function initializeProjectConfig(workspacePath: string): Promise<ProjectConfig> {
  // Check if config already exists
  const existing = await loadProjectConfig(workspacePath);
  if (existing) {
    return existing;
  }

  // Get workspace name from path
  const workspaceName = workspacePath.split('/').pop() || 'Untitled Project';

  // Create config
  const config = await createProjectConfig(workspacePath, {
    name: workspaceName,
    type: 'unknown', // Will be detected later
  });

  return config;
}

// ============================================================================
// Architect Mode Management
// ============================================================================

/**
 * Get architect mode status
 */
export async function getArchitectMode(workspacePath: string): Promise<boolean> {
  let config = await loadProjectConfig(workspacePath);

  // Create config if it doesn't exist
  if (!config) {
    config = await createProjectConfig(workspacePath);
  }

  return config.ai.architectMode ?? false;
}

/**
 * Set architect mode
 */
export async function setArchitectMode(
  workspacePath: string,
  enabled: boolean
): Promise<boolean> {
  let config = await loadProjectConfig(workspacePath);

  // Create config if it doesn't exist
  if (!config) {
    config = await createProjectConfig(workspacePath);
  }

  config.ai.architectMode = enabled;
  await saveProjectConfig(workspacePath, config);

  return true;
}

/**
 * Toggle architect mode
 */
export async function toggleArchitectMode(workspacePath: string): Promise<boolean> {
  const current = await getArchitectMode(workspacePath);
  await setArchitectMode(workspacePath, !current);
  return !current;
}
