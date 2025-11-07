/**
 * IPC Handlers for Monaco Editor Language Support
 *
 * Provides TypeScript configuration, type definitions, and future LSP integration
 * for Monaco editor in the renderer process.
 */

import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TsConfigResult {
  success: boolean;
  config?: any;
  compilerOptions?: any;
  error?: string;
}

/**
 * Register all Monaco/Language support IPC handlers
 */
export function registerMonacoHandlers(): void {
  /**
   * Load and parse tsconfig.json from a workspace
   */
  ipcMain.handle(
    'monaco:load-tsconfig',
    async (event, workspacePath: string): Promise<TsConfigResult> => {
      try {
        console.log('[MonacoHandlers] Loading tsconfig.json from:', workspacePath);

        // Try to find tsconfig.json
        const tsconfigPath = path.join(workspacePath, 'tsconfig.json');

        // Check if file exists
        try {
          await fs.access(tsconfigPath);
        } catch {
          console.log('[MonacoHandlers] tsconfig.json not found');
          return {
            success: false,
            error: 'tsconfig.json not found in workspace',
          };
        }

        // Read and parse tsconfig.json
        const content = await fs.readFile(tsconfigPath, 'utf-8');
        const tsconfig = JSON.parse(content);

        console.log('[MonacoHandlers] Successfully loaded tsconfig.json');

        // Extract compiler options
        const compilerOptions = tsconfig.compilerOptions || {};

        // Convert tsconfig to Monaco-compatible format
        const monacoCompilerOptions = convertToMonacoCompilerOptions(compilerOptions);

        return {
          success: true,
          config: tsconfig,
          compilerOptions: monacoCompilerOptions,
        };
      } catch (error: any) {
        console.error('[MonacoHandlers] Error loading tsconfig:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  /**
   * Get list of available type definitions in node_modules/@types
   */
  ipcMain.handle(
    'monaco:list-type-definitions',
    async (event, workspacePath: string): Promise<{ success: boolean; types?: string[]; error?: string }> => {
      try {
        const typesDir = path.join(workspacePath, 'node_modules', '@types');

        // Check if @types directory exists
        try {
          await fs.access(typesDir);
        } catch {
          console.log('[MonacoHandlers] @types directory not found');
          return {
            success: true,
            types: [],
          };
        }

        // List all type definition packages
        const entries = await fs.readdir(typesDir, { withFileTypes: true });
        const typePackages = entries
          .filter(entry => entry.isDirectory())
          .map(entry => entry.name);

        console.log(`[MonacoHandlers] Found ${typePackages.length} type definition packages`);

        return {
          success: true,
          types: typePackages,
        };
      } catch (error: any) {
        console.error('[MonacoHandlers] Error listing type definitions:', error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  /**
   * Load a specific type definition file
   */
  ipcMain.handle(
    'monaco:load-type-definition',
    async (event, workspacePath: string, packageName: string): Promise<{ success: boolean; content?: string; error?: string }> => {
      try {
        // Try to find index.d.ts in the package
        const typePath = path.join(workspacePath, 'node_modules', '@types', packageName, 'index.d.ts');

        try {
          const content = await fs.readFile(typePath, 'utf-8');
          return {
            success: true,
            content,
          };
        } catch {
          // If index.d.ts not found, try package.json to find main .d.ts file
          const packageJsonPath = path.join(workspacePath, 'node_modules', '@types', packageName, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

          const mainTypes = packageJson.types || packageJson.typings;
          if (mainTypes) {
            const mainTypePath = path.join(workspacePath, 'node_modules', '@types', packageName, mainTypes);
            const content = await fs.readFile(mainTypePath, 'utf-8');
            return {
              success: true,
              content,
            };
          }

          return {
            success: false,
            error: 'Type definition file not found',
          };
        }
      } catch (error: any) {
        console.error(`[MonacoHandlers] Error loading type definition for ${packageName}:`, error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );

  /**
   * Load type definitions from a regular package (not @types)
   * Used for packages like Next.js that include their own types
   */
  ipcMain.handle(
    'monaco:load-package-types',
    async (event, workspacePath: string, packageName: string): Promise<{ success: boolean; content?: string; error?: string }> => {
      try {
        const packagePath = path.join(workspacePath, 'node_modules', packageName);

        // Check if package exists
        try {
          await fs.access(packagePath);
        } catch {
          return {
            success: false,
            error: `Package ${packageName} not found in node_modules`,
          };
        }

        // Read package.json to find types entry
        const packageJsonPath = path.join(packagePath, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        const typesEntry = packageJson.types || packageJson.typings;

        if (!typesEntry) {
          return {
            success: false,
            error: `Package ${packageName} does not include type definitions`,
          };
        }

        // Read the type definition file
        const typesPath = path.join(packagePath, typesEntry);
        const content = await fs.readFile(typesPath, 'utf-8');

        return {
          success: true,
          content,
        };
      } catch (error: any) {
        console.error(`[MonacoHandlers] Error loading package types for ${packageName}:`, error);
        return {
          success: false,
          error: error.message,
        };
      }
    }
  );
}

/**
 * Convert TSConfig compiler options to Monaco-compatible format
 */
function convertToMonacoCompilerOptions(tsconfig: any): any {
  // Monaco uses the same TypeScript compiler options,
  // but we need to map some specific options and ensure compatibility

  const monacoOptions: any = {
    // Copy all standard compiler options
    ...tsconfig,

    // Ensure these are set for Monaco
    allowNonTsExtensions: true,

    // Module resolution
    moduleResolution: mapModuleResolution(tsconfig.moduleResolution),
    module: mapModule(tsconfig.module),
    target: mapTarget(tsconfig.target),

    // JSX
    jsx: mapJsx(tsconfig.jsx),

    // Lib files
    lib: tsconfig.lib || ['es2020', 'dom'],

    // Paths - Monaco doesn't support these directly, but we can include them
    paths: tsconfig.paths,
    baseUrl: tsconfig.baseUrl,
  };

  return monacoOptions;
}

/**
 * Map module resolution mode to Monaco enum
 */
function mapModuleResolution(value?: string): number {
  if (!value) return 2; // NodeJs

  const map: Record<string, number> = {
    'classic': 1,
    'node': 2,
    'node16': 3,
    'nodenext': 3,
    'bundler': 99, // Monaco may not support this yet
  };

  return map[value.toLowerCase()] ?? 2;
}

/**
 * Map module kind to Monaco enum
 */
function mapModule(value?: string): number {
  if (!value) return 99; // ESNext

  const map: Record<string, number> = {
    'none': 0,
    'commonjs': 1,
    'amd': 2,
    'umd': 3,
    'system': 4,
    'es6': 5,
    'es2015': 5,
    'es2020': 6,
    'es2022': 7,
    'esnext': 99,
  };

  return map[value.toLowerCase()] ?? 99;
}

/**
 * Map target to Monaco enum
 */
function mapTarget(value?: string): number {
  if (!value) return 7; // ES2020

  const map: Record<string, number> = {
    'es3': 0,
    'es5': 1,
    'es6': 2,
    'es2015': 2,
    'es2016': 3,
    'es2017': 4,
    'es2018': 5,
    'es2019': 6,
    'es2020': 7,
    'es2021': 8,
    'es2022': 9,
    'esnext': 99,
  };

  return map[value.toLowerCase()] ?? 7;
}

/**
 * Map JSX mode to Monaco enum
 */
function mapJsx(value?: string): number {
  if (!value) return 0; // None

  const map: Record<string, number> = {
    'none': 0,
    'preserve': 1,
    'react': 2,
    'react-native': 3,
    'react-jsx': 4,
    'react-jsxdev': 5,
  };

  return map[value.toLowerCase()] ?? 0;
}
