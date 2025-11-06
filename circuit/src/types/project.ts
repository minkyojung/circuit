/**
 * Project type definitions for Circuit
 * Handles project detection, configuration, and metadata
 */

// Project types based on primary language/runtime
export type ProjectType =
  | 'node'
  | 'typescript'
  | 'react'
  | 'next'
  | 'vue'
  | 'svelte'
  | 'python'
  | 'django'
  | 'fastapi'
  | 'flask'
  | 'rust'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'ruby'
  | 'php'
  | 'unknown';

// Framework detection
export type Framework =
  | 'react'
  | 'next'
  | 'vue'
  | 'nuxt'
  | 'svelte'
  | 'sveltekit'
  | 'angular'
  | 'express'
  | 'nest'
  | 'django'
  | 'fastapi'
  | 'flask'
  | 'rails'
  | 'laravel'
  | 'none';

// Package manager types
export type PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'pipenv'
  | 'cargo'
  | 'go mod'
  | 'maven'
  | 'gradle'
  | 'composer'
  | 'bundler'
  | 'unknown';

// Language Server Protocol servers
export type LanguageServer =
  | 'typescript-language-server'
  | 'pyright'
  | 'pylsp'
  | 'rust-analyzer'
  | 'gopls'
  | 'jdtls' // Java
  | 'kotlin-language-server'
  | 'solargraph' // Ruby
  | 'intelephense' // PHP
  | 'eslint'
  | 'prettier';

// Code style/linting configurations
export type CodeStyle =
  | 'airbnb'
  | 'standard'
  | 'google'
  | 'prettier'
  | 'custom'
  | 'none';

// Project detection result
export interface ProjectDetectionResult {
  // Primary project type
  type: ProjectType;

  // Framework (if applicable)
  framework?: Framework;

  // Package manager
  packageManager: PackageManager;

  // Detected language servers (recommended to install)
  languageServers: LanguageServer[];

  // Runtime version (e.g., "20.x" for Node, "3.11" for Python)
  runtimeVersion?: string;

  // Detected configuration files
  configFiles: {
    typescript?: string; // tsconfig.json path
    eslint?: string; // .eslintrc path
    prettier?: string; // .prettierrc path
    git?: string; // .git path
  };

  // Detected dependencies (sample, not exhaustive)
  dependencies?: {
    production: string[];
    development: string[];
  };

  // Detection confidence (0-1)
  confidence: number;
}

// AI coding rules for the project
export interface AIRule {
  id: string;
  content: string;
  enabled: boolean;
  order: number; // For prioritization
  category?: 'style' | 'architecture' | 'testing' | 'security' | 'performance' | 'general';
}

// Project configuration stored in .circuit/project.json
export interface ProjectConfig {
  // Schema version for future migrations
  version: string;

  // Project metadata
  name: string;
  type: ProjectType;
  framework?: Framework;
  packageManager?: PackageManager;

  // AI behavior configuration
  ai: {
    // Custom coding rules (like Cursor's .cursorrules)
    rules: AIRule[];

    // Preferred code style
    codeStyle: CodeStyle;

    // Preferred patterns (free-form strings)
    preferredPatterns: string[];

    // Files/directories to exclude from AI context
    excludeFromContext: string[];
  };

  // Environment configuration
  environment: {
    nodeVersion?: string;
    pythonVersion?: string;
    runtime?: string;
  };

  // Optional: recommended MCP servers for this project type
  recommendedMCPServers?: string[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Default project configuration
export const DEFAULT_PROJECT_CONFIG: Omit<ProjectConfig, 'createdAt' | 'updatedAt'> = {
  version: '1.0',
  name: 'Untitled Project',
  type: 'unknown',
  ai: {
    rules: [
      {
        id: 'default-architect-1',
        content: 'You are "The Architect," a Principal Software Engineer. Write code that is clear, elegant, and maintainable. Complexity is a sign of incomplete thinking.',
        enabled: true,
        order: 0,
        category: 'general',
      },
      {
        id: 'default-architect-2',
        content: 'Solve problems, don\'t just fulfill orders. Focus on the underlying problem and question flawed premises. Reframe problems to reveal better solutions.',
        enabled: true,
        order: 1,
        category: 'architecture',
      },
      {
        id: 'default-architect-3',
        content: 'Leave the codebase better than you found it. Refactor, clean, and improve as a natural part of your workflow. Take ownership and pride in your work.',
        enabled: true,
        order: 2,
        category: 'general',
      },
      {
        id: 'default-architect-4',
        content: 'Master the principles (DRY, KISS, SOLID) but be pragmatic. Know when to bend rules to serve simplicity and timely delivery. Understand trade-offs.',
        enabled: true,
        order: 3,
        category: 'architecture',
      },
      {
        id: 'default-architect-5',
        content: 'Build antifragile systems. Anticipate failure points, edge cases, and invalid data. Write defensive, resilient code that prepares for the worst.',
        enabled: true,
        order: 4,
        category: 'security',
      },
      {
        id: 'default-architect-6',
        content: 'Before coding, outline a high-level plan. Think in terms of components, data flow, and APIs. Whiteboard the solution mentally.',
        enabled: true,
        order: 5,
        category: 'architecture',
      },
      {
        id: 'default-architect-7',
        content: 'Where logic is non-obvious, leave concise comments explaining the "why" - the strategic reason behind the implementation. Trust code to explain the "what".',
        enabled: true,
        order: 6,
        category: 'style',
      },
      {
        id: 'default-architect-8',
        content: 'Be your own harshest critic. Review your work critically before sharing. Look for weaknesses, simplifications, and potential bugs.',
        enabled: true,
        order: 7,
        category: 'general',
      },
    ],
    codeStyle: 'prettier',
    preferredPatterns: [],
    excludeFromContext: [
      'node_modules',
      'dist',
      'build',
      '.next',
      '.vercel',
      '*.min.js',
      '*.bundle.js',
      'coverage',
      '.git',
    ],
  },
  environment: {},
};

// Config file matchers for detection
export interface ConfigFileMatcher {
  // File name to look for
  fileName: string;

  // Project type it indicates
  projectType: ProjectType;

  // Framework it indicates (optional)
  framework?: Framework;

  // Package manager it indicates (optional)
  packageManager?: PackageManager;

  // Detection confidence boost (0-1)
  confidence: number;

  // Required for this project type?
  required?: boolean;
}

// Detection configuration
export const CONFIG_FILE_MATCHERS: ConfigFileMatcher[] = [
  // Node.js ecosystem
  { fileName: 'package.json', projectType: 'node', confidence: 0.9 },
  { fileName: 'package-lock.json', projectType: 'node', packageManager: 'npm', confidence: 0.3 },
  { fileName: 'yarn.lock', projectType: 'node', packageManager: 'yarn', confidence: 0.3 },
  { fileName: 'pnpm-lock.yaml', projectType: 'node', packageManager: 'pnpm', confidence: 0.3 },
  { fileName: 'bun.lockb', projectType: 'node', packageManager: 'bun', confidence: 0.3 },

  // TypeScript
  { fileName: 'tsconfig.json', projectType: 'typescript', confidence: 0.7 },

  // React
  { fileName: 'next.config.js', projectType: 'next', framework: 'next', confidence: 0.95 },
  { fileName: 'next.config.ts', projectType: 'next', framework: 'next', confidence: 0.95 },
  { fileName: 'vite.config.ts', projectType: 'react', confidence: 0.5 },

  // Vue
  { fileName: 'nuxt.config.ts', projectType: 'vue', framework: 'nuxt', confidence: 0.95 },
  { fileName: 'vue.config.js', projectType: 'vue', framework: 'vue', confidence: 0.8 },

  // Svelte
  { fileName: 'svelte.config.js', projectType: 'svelte', framework: 'svelte', confidence: 0.95 },

  // Python
  { fileName: 'requirements.txt', projectType: 'python', confidence: 0.8 },
  { fileName: 'pyproject.toml', projectType: 'python', confidence: 0.9 },
  { fileName: 'poetry.lock', projectType: 'python', packageManager: 'poetry', confidence: 0.4 },
  { fileName: 'Pipfile', projectType: 'python', packageManager: 'pipenv', confidence: 0.4 },
  { fileName: 'manage.py', projectType: 'django', framework: 'django', confidence: 0.9 },

  // Rust
  { fileName: 'Cargo.toml', projectType: 'rust', packageManager: 'cargo', confidence: 0.95, required: true },
  { fileName: 'Cargo.lock', projectType: 'rust', confidence: 0.3 },

  // Go
  { fileName: 'go.mod', projectType: 'go', packageManager: 'go mod', confidence: 0.95, required: true },
  { fileName: 'go.sum', projectType: 'go', confidence: 0.3 },

  // Java/Kotlin
  { fileName: 'pom.xml', projectType: 'java', packageManager: 'maven', confidence: 0.9 },
  { fileName: 'build.gradle', projectType: 'java', packageManager: 'gradle', confidence: 0.9 },
  { fileName: 'build.gradle.kts', projectType: 'kotlin', packageManager: 'gradle', confidence: 0.9 },

  // Ruby
  { fileName: 'Gemfile', projectType: 'ruby', packageManager: 'bundler', confidence: 0.9 },
  { fileName: 'config.ru', projectType: 'ruby', framework: 'rails', confidence: 0.7 },

  // PHP
  { fileName: 'composer.json', projectType: 'php', packageManager: 'composer', confidence: 0.9 },
  { fileName: 'artisan', projectType: 'php', framework: 'laravel', confidence: 0.9 },
];

// Dependency-based framework detection
export interface DependencyMatcher {
  // Dependency name (from package.json, requirements.txt, etc.)
  dependencyName: string;

  // Framework it indicates
  framework: Framework;

  // Confidence boost
  confidence: number;
}

export const DEPENDENCY_MATCHERS: DependencyMatcher[] = [
  // React ecosystem
  { dependencyName: 'react', framework: 'react', confidence: 0.9 },
  { dependencyName: 'next', framework: 'next', confidence: 0.95 },
  { dependencyName: '@remix-run/react', framework: 'react', confidence: 0.9 },

  // Vue
  { dependencyName: 'vue', framework: 'vue', confidence: 0.9 },
  { dependencyName: 'nuxt', framework: 'nuxt', confidence: 0.95 },

  // Svelte
  { dependencyName: 'svelte', framework: 'svelte', confidence: 0.9 },
  { dependencyName: '@sveltejs/kit', framework: 'sveltekit', confidence: 0.95 },

  // Angular
  { dependencyName: '@angular/core', framework: 'angular', confidence: 0.95 },

  // Node.js frameworks
  { dependencyName: 'express', framework: 'express', confidence: 0.8 },
  { dependencyName: '@nestjs/core', framework: 'nest', confidence: 0.95 },

  // Python frameworks
  { dependencyName: 'django', framework: 'django', confidence: 0.95 },
  { dependencyName: 'fastapi', framework: 'fastapi', confidence: 0.95 },
  { dependencyName: 'flask', framework: 'flask', confidence: 0.9 },

  // Ruby
  { dependencyName: 'rails', framework: 'rails', confidence: 0.95 },

  // PHP
  { dependencyName: 'laravel/framework', framework: 'laravel', confidence: 0.95 },
];

// Language server recommendations based on project type
export const LANGUAGE_SERVER_RECOMMENDATIONS: Record<ProjectType, LanguageServer[]> = {
  node: ['typescript-language-server', 'eslint', 'prettier'],
  typescript: ['typescript-language-server', 'eslint', 'prettier'],
  react: ['typescript-language-server', 'eslint', 'prettier'],
  next: ['typescript-language-server', 'eslint', 'prettier'],
  vue: ['typescript-language-server', 'eslint', 'prettier'],
  svelte: ['typescript-language-server', 'eslint', 'prettier'],
  python: ['pyright', 'eslint'], // eslint for any JS config files
  django: ['pyright'],
  fastapi: ['pyright'],
  flask: ['pyright'],
  rust: ['rust-analyzer'],
  go: ['gopls'],
  java: ['jdtls'],
  kotlin: ['kotlin-language-server'],
  ruby: ['solargraph'],
  php: ['intelephense'],
  unknown: [],
};

// MCP server recommendations based on project type
export const MCP_SERVER_RECOMMENDATIONS: Record<ProjectType, string[]> = {
  node: ['typescript-mcp', 'npm-mcp', 'git-mcp'],
  typescript: ['typescript-mcp', 'npm-mcp', 'git-mcp'],
  react: ['typescript-mcp', 'npm-mcp', 'git-mcp', 'react-devtools-mcp'],
  next: ['typescript-mcp', 'npm-mcp', 'git-mcp', 'vercel-mcp'],
  vue: ['typescript-mcp', 'npm-mcp', 'git-mcp'],
  svelte: ['typescript-mcp', 'npm-mcp', 'git-mcp'],
  python: ['python-mcp', 'pip-mcp', 'git-mcp'],
  django: ['python-mcp', 'pip-mcp', 'git-mcp', 'django-mcp'],
  fastapi: ['python-mcp', 'pip-mcp', 'git-mcp'],
  flask: ['python-mcp', 'pip-mcp', 'git-mcp'],
  rust: ['rust-analyzer-mcp', 'cargo-mcp', 'git-mcp'],
  go: ['gopls-mcp', 'go-mcp', 'git-mcp'],
  java: ['jdtls-mcp', 'maven-mcp', 'git-mcp'],
  kotlin: ['kotlin-mcp', 'gradle-mcp', 'git-mcp'],
  ruby: ['ruby-mcp', 'bundler-mcp', 'git-mcp'],
  php: ['php-mcp', 'composer-mcp', 'git-mcp'],
  unknown: ['git-mcp'],
};
