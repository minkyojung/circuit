/**
 * Project Configuration Service
 * Manages .circuit/project.json file for workspace-level project settings
 */

import type { ProjectConfig, AIRule, ProjectType, Framework } from '../types/project';
import { DEFAULT_PROJECT_CONFIG } from '../types/project';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

const PROJECT_CONFIG_FILENAME = 'project.json';
const CIRCUIT_DIR = '.circuit';

// System-level AI rules that are always applied (inspired by "The Architect")
const SYSTEM_AI_RULES = [
  'You are "The Architect," a Principal Software Engineer. Write code that is clear, elegant, and maintainable. Complexity is a sign of incomplete thinking.',
  'Solve problems, don\'t just fulfill orders. Focus on the underlying problem and question flawed premises. Reframe problems to reveal better solutions.',
  'Leave the codebase better than you found it. Refactor, clean, and improve as a natural part of your workflow. Take ownership and pride in your work.',
  'Master the principles (DRY, KISS, SOLID) but be pragmatic. Know when to bend rules to serve simplicity and timely delivery. Understand trade-offs.',
  'Build antifragile systems. Anticipate failure points, edge cases, and invalid data. Write defensive, resilient code that prepares for the worst.',
  'Before coding, outline a high-level plan. Think in terms of components, data flow, and APIs. Whiteboard the solution mentally.',
  'Where logic is non-obvious, leave concise comments explaining the "why" - the strategic reason behind the implementation. Trust code to explain the "what".',
  'Be your own harshest critic. Review your work critically before sharing. Look for weaknesses, simplifications, and potential bugs.',
];

/**
 * Get the path to project.json for a workspace
 */
function getProjectConfigPath(workspacePath: string): string {
  return `${workspacePath}/${CIRCUIT_DIR}/${PROJECT_CONFIG_FILENAME}`;
}

/**
 * Get the path to .circuit directory for a workspace
 */
function getCircuitDir(workspacePath: string): string {
  return `${workspacePath}/${CIRCUIT_DIR}`;
}

/**
 * Load project configuration from .circuit/project.json
 * If file doesn't exist, returns undefined
 */
export async function loadProjectConfig(
  workspacePath: string
): Promise<ProjectConfig | undefined> {
  try {
    const configPath = getProjectConfigPath(workspacePath);

    // Check if file exists
    const exists = await ipcRenderer.invoke('file-exists', configPath);
    if (!exists) {
      return undefined;
    }

    // Read and parse file
    const content = await ipcRenderer.invoke('read-file', configPath);
    const config: ProjectConfig = JSON.parse(content);

    return config;
  } catch (error) {
    console.error('Failed to load project config:', error);
    return undefined;
  }
}

/**
 * Save project configuration to .circuit/project.json
 * Creates .circuit directory if it doesn't exist
 */
export async function saveProjectConfig(
  workspacePath: string,
  config: ProjectConfig
): Promise<boolean> {
  try {
    // Ensure .circuit directory exists
    const circuitDir = getCircuitDir(workspacePath);
    const dirExists = await ipcRenderer.invoke('directory-exists', circuitDir);

    if (!dirExists) {
      await ipcRenderer.invoke('create-directory', circuitDir);
    }

    // Update timestamp
    const updatedConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };

    // Write file
    const configPath = getProjectConfigPath(workspacePath);
    const content = JSON.stringify(updatedConfig, null, 2);
    await ipcRenderer.invoke('write-file', configPath, content);

    return true;
  } catch (error) {
    console.error('Failed to save project config:', error);
    return false;
  }
}

/**
 * Create a new project configuration with default values
 * Optionally merge with detected project information
 */
export async function createProjectConfig(
  workspacePath: string,
  overrides?: Partial<ProjectConfig>
): Promise<ProjectConfig> {
  const now = new Date().toISOString();

  const config: ProjectConfig = {
    ...DEFAULT_PROJECT_CONFIG,
    ...overrides,
    createdAt: now,
    updatedAt: now,
  };

  // Save to disk
  await saveProjectConfig(workspacePath, config);

  return config;
}

/**
 * Update existing project configuration
 * Merges with existing config
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
 * Delete project configuration file
 */
export async function deleteProjectConfig(workspacePath: string): Promise<boolean> {
  try {
    const configPath = getProjectConfigPath(workspacePath);
    await ipcRenderer.invoke('delete-file', configPath);
    return true;
  } catch (error) {
    console.error('Failed to delete project config:', error);
    return false;
  }
}

// ============================================================================
// AI Rules Management
// ============================================================================

/**
 * Add a new AI rule to project config
 */
export async function addAIRule(
  workspacePath: string,
  rule: Omit<AIRule, 'id' | 'order'>
): Promise<AIRule | undefined> {
  let config = await loadProjectConfig(workspacePath);

  // If no config exists, create a new one
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
  const config = await loadProjectConfig(workspacePath);
  if (!config) return [];

  return config.ai.rules.sort((a, b) => a.order - b.order);
}

/**
 * Get enabled AI rules as formatted string for AI context
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
// Cursor Rules Import/Export
// ============================================================================

/**
 * Import rules from Cursor's .cursorrules file
 */
export async function importCursorRules(workspacePath: string): Promise<number> {
  try {
    const cursorRulesPath = `${workspacePath}/.cursorrules`;

    // Check if file exists
    const exists = await ipcRenderer.invoke('file-exists', cursorRulesPath);
    if (!exists) {
      return 0;
    }

    // Read file
    const content = await ipcRenderer.invoke('read-file', cursorRulesPath);

    // Parse rules (each line is a rule, ignore empty lines and comments)
    const lines = content.split('\n');
    const rules: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        rules.push(trimmed);
      }
    }

    // Add rules to project config
    let addedCount = 0;
    for (const ruleContent of rules) {
      const added = await addAIRule(workspacePath, {
        content: ruleContent,
        enabled: true,
        category: 'general',
      });

      if (added) {
        addedCount++;
      }
    }

    return addedCount;
  } catch (error) {
    console.error('Failed to import Cursor rules:', error);
    return 0;
  }
}

/**
 * Export rules to Cursor's .cursorrules format
 */
export async function exportCursorRules(workspacePath: string): Promise<boolean> {
  try {
    const rules = await getAIRules(workspacePath);
    const enabledRules = rules.filter((r) => r.enabled);

    if (enabledRules.length === 0) {
      return false;
    }

    // Format as .cursorrules file
    const lines = [
      '# Circuit AI Coding Rules',
      '# Exported from Circuit project configuration',
      '',
      ...enabledRules.map((r) => r.content),
    ];

    const content = lines.join('\n');

    // Write file
    const cursorRulesPath = `${workspacePath}/.cursorrules`;
    await ipcRenderer.invoke('write-file', cursorRulesPath, content);

    return true;
  } catch (error) {
    console.error('Failed to export Cursor rules:', error);
    return false;
  }
}

// ============================================================================
// Project Metadata Updates
// ============================================================================

/**
 * Update project type
 */
export async function updateProjectType(
  workspacePath: string,
  type: ProjectType,
  framework?: Framework
): Promise<boolean> {
  const updates: Partial<ProjectConfig> = { type };
  if (framework) {
    updates.framework = framework;
  }

  const result = await updateProjectConfig(workspacePath, updates);
  return result !== undefined;
}

/**
 * Update AI code style preference
 */
export async function updateCodeStyle(
  workspacePath: string,
  codeStyle: ProjectConfig['ai']['codeStyle']
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  config.ai.codeStyle = codeStyle;

  await saveProjectConfig(workspacePath, config);
  return true;
}

/**
 * Add preferred pattern
 */
export async function addPreferredPattern(
  workspacePath: string,
  pattern: string
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  if (!config.ai.preferredPatterns.includes(pattern)) {
    config.ai.preferredPatterns.push(pattern);
    await saveProjectConfig(workspacePath, config);
  }

  return true;
}

/**
 * Remove preferred pattern
 */
export async function removePreferredPattern(
  workspacePath: string,
  pattern: string
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  config.ai.preferredPatterns = config.ai.preferredPatterns.filter((p) => p !== pattern);
  await saveProjectConfig(workspacePath, config);

  return true;
}

/**
 * Update AI context exclusions
 */
export async function updateExcludeFromContext(
  workspacePath: string,
  patterns: string[]
): Promise<boolean> {
  const config = await loadProjectConfig(workspacePath);
  if (!config) return false;

  config.ai.excludeFromContext = patterns;
  await saveProjectConfig(workspacePath, config);

  return true;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize project configuration for a new workspace
 * Detects project type and creates config file
 */
export async function initializeProjectConfig(workspacePath: string): Promise<ProjectConfig> {
  // Check if config already exists
  const existing = await loadProjectConfig(workspacePath);
  if (existing) {
    return existing;
  }

  // Import from projectDetection service
  const { detectProject } = await import('./projectDetection');

  // Detect project
  const detection = await detectProject(workspacePath);

  // Get workspace name from path
  const workspaceName = workspacePath.split('/').pop() || 'Untitled Project';

  // Create config with detected information
  const config = await createProjectConfig(workspacePath, {
    name: workspaceName,
    type: detection.type,
    framework: detection.framework,
    packageManager: detection.packageManager,
    environment: {
      runtime: detection.runtimeVersion,
    },
  });

  // Try to import Cursor rules if they exist
  await importCursorRules(workspacePath);

  return config;
}

/**
 * Check if project config exists
 */
export async function projectConfigExists(workspacePath: string): Promise<boolean> {
  const configPath = getProjectConfigPath(workspacePath);
  const exists = await ipcRenderer.invoke('file-exists', configPath);
  return exists;
}
