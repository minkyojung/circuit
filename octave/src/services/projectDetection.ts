/**
 * Project Detection Service
 * Automatically detects project type, framework, package manager, and configuration
 */

import type {
  ProjectDetectionResult,
  ProjectType,
  Framework,
  PackageManager,
  LanguageServer,
} from '../types/project';
import {
  CONFIG_FILE_MATCHERS,
  DEPENDENCY_MATCHERS,
  LANGUAGE_SERVER_RECOMMENDATIONS,
} from '../types/project';

/**
 * Detect project type from a workspace directory
 */
export async function detectProject(workspacePath: string): Promise<ProjectDetectionResult> {
  const detectedFiles = await scanConfigFiles(workspacePath);
  const fileScores = calculateFileScores(detectedFiles);

  // Determine primary project type
  const projectType = determineProjectType(fileScores);

  // Determine framework (if applicable)
  const framework = await determineFramework(workspacePath, projectType, detectedFiles);

  // Determine package manager
  const packageManager = determinePackageManager(detectedFiles);

  // Get recommended language servers
  const languageServers = LANGUAGE_SERVER_RECOMMENDATIONS[projectType] || [];

  // Detect runtime version
  const runtimeVersion = await detectRuntimeVersion(workspacePath, projectType);

  // Build config files map
  const configFiles = {
    typescript: detectedFiles.includes('tsconfig.json') ? 'tsconfig.json' : undefined,
    eslint: findEslintConfig(detectedFiles),
    prettier: findPrettierConfig(detectedFiles),
    git: detectedFiles.includes('.git') ? '.git' : undefined,
  };

  // Calculate overall confidence
  const confidence = calculateConfidence(fileScores, projectType);

  return {
    type: projectType,
    framework,
    packageManager,
    languageServers,
    runtimeVersion,
    configFiles,
    confidence,
  };
}

/**
 * Scan workspace directory for configuration files
 */
async function scanConfigFiles(workspacePath: string): Promise<string[]> {
  try {
    // Request file list from main process via IPC
    const files = await window.electron.fs.readDirectory(workspacePath);

    // Filter to only config files we care about
    const configFileNames = CONFIG_FILE_MATCHERS.map((m) => m.fileName);
    const detectedFiles = files.filter((file) =>
      configFileNames.includes(file) || isConfigFile(file)
    );

    return detectedFiles;
  } catch (error) {
    console.error('Failed to scan config files:', error);
    return [];
  }
}

/**
 * Check if a file is a configuration file we care about
 */
function isConfigFile(fileName: string): boolean {
  const configPatterns = [
    '.eslintrc',
    '.prettierrc',
    '.gitignore',
    'tsconfig',
    'vite.config',
    'webpack.config',
    'rollup.config',
  ];

  return configPatterns.some((pattern) => fileName.includes(pattern));
}

/**
 * Calculate scores for each detected file
 */
function calculateFileScores(detectedFiles: string[]): Map<ProjectType, number> {
  const scores = new Map<ProjectType, number>();

  for (const file of detectedFiles) {
    const matcher = CONFIG_FILE_MATCHERS.find((m) => m.fileName === file);
    if (matcher) {
      const currentScore = scores.get(matcher.projectType) || 0;
      scores.set(matcher.projectType, currentScore + matcher.confidence);
    }
  }

  return scores;
}

/**
 * Determine the most likely project type based on file scores
 */
function determineProjectType(scores: Map<ProjectType, number>): ProjectType {
  if (scores.size === 0) {
    return 'unknown';
  }

  // Find the project type with the highest score
  let maxScore = 0;
  let bestType: ProjectType = 'unknown';

  for (const [type, score] of scores.entries()) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type;
    }
  }

  return bestType;
}

/**
 * Determine framework by analyzing dependencies
 */
async function determineFramework(
  workspacePath: string,
  projectType: ProjectType,
  detectedFiles: string[]
): Promise<Framework | undefined> {
  // First check for framework-specific config files
  for (const file of detectedFiles) {
    const matcher = CONFIG_FILE_MATCHERS.find(
      (m) => m.fileName === file && m.framework
    );
    if (matcher?.framework) {
      return matcher.framework;
    }
  }

  // Then check dependencies
  if (projectType === 'node' || projectType === 'typescript' || projectType === 'react') {
    return await detectNodeFramework(workspacePath);
  }

  if (projectType === 'python') {
    return await detectPythonFramework(workspacePath);
  }

  return undefined;
}

/**
 * Detect Node.js framework from package.json
 */
async function detectNodeFramework(workspacePath: string): Promise<Framework | undefined> {
  try {
    const packageJsonPath = `${workspacePath}/package.json`;
    const packageJsonContent = await window.electron.fs.readFile(packageJsonPath);
    const packageJson = JSON.parse(packageJsonContent);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Check dependencies against matchers
    for (const [depName, matcher] of Object.entries(DEPENDENCY_MATCHERS)) {
      if (allDeps[depName]) {
        return matcher.framework;
      }
    }

    // Check for common framework dependencies
    if (allDeps.next) return 'next';
    if (allDeps.nuxt) return 'nuxt';
    if (allDeps['@sveltejs/kit']) return 'sveltekit';
    if (allDeps.svelte) return 'svelte';
    if (allDeps.vue) return 'vue';
    if (allDeps.react) return 'react';
    if (allDeps['@angular/core']) return 'angular';
    if (allDeps['@nestjs/core']) return 'nest';
    if (allDeps.express) return 'express';

    return 'none';
  } catch (error) {
    console.error('Failed to detect Node framework:', error);
    return undefined;
  }
}

/**
 * Detect Python framework from requirements or pyproject.toml
 */
async function detectPythonFramework(workspacePath: string): Promise<Framework | undefined> {
  try {
    // Check for Django's manage.py
    const manageExists = await window.electron.fs.fileExists(`${workspacePath}/manage.py`);
    if (manageExists) return 'django';

    // Check requirements.txt
    const reqPath = `${workspacePath}/requirements.txt`;
    const reqExists = await window.electron.fs.fileExists(reqPath);
    if (reqExists) {
      const requirements = await window.electron.fs.readFile(reqPath);
      if (requirements.includes('django')) return 'django';
      if (requirements.includes('fastapi')) return 'fastapi';
      if (requirements.includes('flask')) return 'flask';
    }

    // Check pyproject.toml
    const pyprojectPath = `${workspacePath}/pyproject.toml`;
    const pyprojectExists = await window.electron.fs.fileExists(pyprojectPath);
    if (pyprojectExists) {
      const pyproject = await window.electron.fs.readFile(pyprojectPath);
      if (pyproject.includes('django')) return 'django';
      if (pyproject.includes('fastapi')) return 'fastapi';
      if (pyproject.includes('flask')) return 'flask';
    }

    return 'none';
  } catch (error) {
    console.error('Failed to detect Python framework:', error);
    return undefined;
  }
}

/**
 * Determine package manager from lock files
 */
function determinePackageManager(detectedFiles: string[]): PackageManager {
  // Check for lock files in order of preference
  if (detectedFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (detectedFiles.includes('bun.lockb')) return 'bun';
  if (detectedFiles.includes('yarn.lock')) return 'yarn';
  if (detectedFiles.includes('package-lock.json')) return 'npm';

  // Python
  if (detectedFiles.includes('poetry.lock')) return 'poetry';
  if (detectedFiles.includes('Pipfile')) return 'pipenv';
  if (detectedFiles.includes('requirements.txt')) return 'pip';

  // Rust
  if (detectedFiles.includes('Cargo.lock')) return 'cargo';

  // Go
  if (detectedFiles.includes('go.sum')) return 'go mod';

  // Java/Kotlin
  if (detectedFiles.includes('pom.xml')) return 'maven';
  if (detectedFiles.includes('build.gradle') || detectedFiles.includes('build.gradle.kts')) {
    return 'gradle';
  }

  // Ruby
  if (detectedFiles.includes('Gemfile')) return 'bundler';

  // PHP
  if (detectedFiles.includes('composer.json')) return 'composer';

  return 'unknown';
}

/**
 * Detect runtime version from config files
 */
async function detectRuntimeVersion(
  workspacePath: string,
  projectType: ProjectType
): Promise<string | undefined> {
  try {
    if (projectType === 'node' || projectType === 'typescript' || projectType === 'react') {
      // Check package.json engines field
      const packageJsonPath = `${workspacePath}/package.json`;
      const packageJsonContent = await window.electron.fs.readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent);

      if (packageJson.engines?.node) {
        return packageJson.engines.node;
      }

      // Check .nvmrc
      const nvmrcPath = `${workspacePath}/.nvmrc`;
      const nvmrcExists = await window.electron.fs.fileExists(nvmrcPath);
      if (nvmrcExists) {
        const version = await window.electron.fs.readFile(nvmrcPath);
        return version.trim();
      }
    }

    if (projectType === 'python') {
      // Check .python-version
      const pythonVersionPath = `${workspacePath}/.python-version`;
      const pythonVersionExists = await window.electron.fs.fileExists(pythonVersionPath);
      if (pythonVersionExists) {
        const version = await window.electron.fs.readFile(pythonVersionPath);
        return version.trim();
      }

      // Check pyproject.toml
      const pyprojectPath = `${workspacePath}/pyproject.toml`;
      const pyprojectExists = await window.electron.fs.fileExists(pyprojectPath);
      if (pyprojectExists) {
        const content = await window.electron.fs.readFile(pyprojectPath);
        const pythonVersionMatch = content.match(/python\s*=\s*"([^"]+)"/);
        if (pythonVersionMatch) {
          return pythonVersionMatch[1];
        }
      }
    }

    return undefined;
  } catch (error) {
    console.error('Failed to detect runtime version:', error);
    return undefined;
  }
}

/**
 * Find ESLint configuration file
 */
function findEslintConfig(detectedFiles: string[]): string | undefined {
  const eslintConfigs = [
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    '.eslintrc',
  ];

  return detectedFiles.find((file) => eslintConfigs.includes(file));
}

/**
 * Find Prettier configuration file
 */
function findPrettierConfig(detectedFiles: string[]): string | undefined {
  const prettierConfigs = [
    '.prettierrc',
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    'prettier.config.js',
  ];

  return detectedFiles.find((file) => prettierConfigs.includes(file));
}

/**
 * Calculate overall detection confidence
 */
function calculateConfidence(scores: Map<ProjectType, number>, selectedType: ProjectType): number {
  const selectedScore = scores.get(selectedType) || 0;
  const totalScore = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);

  if (totalScore === 0) return 0;

  // Confidence is the ratio of selected type's score to total
  const confidence = selectedScore / totalScore;

  // Boost confidence if we found required files
  const hasRequiredFiles = CONFIG_FILE_MATCHERS.some(
    (m) => m.projectType === selectedType && m.required
  );

  return hasRequiredFiles ? Math.min(confidence + 0.2, 1) : confidence;
}

/**
 * Get human-readable project type name
 */
export function getProjectTypeName(type: ProjectType): string {
  const names: Record<ProjectType, string> = {
    node: 'Node.js',
    typescript: 'TypeScript',
    react: 'React',
    next: 'Next.js',
    vue: 'Vue.js',
    svelte: 'Svelte',
    python: 'Python',
    django: 'Django',
    fastapi: 'FastAPI',
    flask: 'Flask',
    rust: 'Rust',
    go: 'Go',
    java: 'Java',
    kotlin: 'Kotlin',
    ruby: 'Ruby',
    php: 'PHP',
    unknown: 'Unknown',
  };

  return names[type];
}

/**
 * Get human-readable framework name
 */
export function getFrameworkName(framework: Framework): string {
  const names: Record<Framework, string> = {
    react: 'React',
    next: 'Next.js',
    vue: 'Vue.js',
    nuxt: 'Nuxt.js',
    svelte: 'Svelte',
    sveltekit: 'SvelteKit',
    angular: 'Angular',
    express: 'Express',
    nest: 'NestJS',
    django: 'Django',
    fastapi: 'FastAPI',
    flask: 'Flask',
    rails: 'Ruby on Rails',
    laravel: 'Laravel',
    none: 'None',
  };

  return names[framework];
}

/**
 * Get icon for project type (returns emoji or icon name)
 */
export function getProjectTypeIcon(type: ProjectType): string {
  const icons: Record<ProjectType, string> = {
    node: '⬢',
    typescript: 'TS',
    react: '⚛️',
    next: '▲',
    vue: 'V',
    svelte: '🔥',
    python: '🐍',
    django: '🎸',
    fastapi: '⚡',
    flask: '🌶️',
    rust: '🦀',
    go: '🐹',
    java: '☕',
    kotlin: 'K',
    ruby: '💎',
    php: '🐘',
    unknown: '📦',
  };

  return icons[type];
}
