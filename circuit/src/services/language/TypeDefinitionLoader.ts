/**
 * Type Definition Loader
 *
 * Responsible for loading TypeScript type definitions from various sources:
 * - node_modules/@types packages
 * - Framework-specific types (React, Next.js, etc.)
 * - Built-in fallback types
 *
 * Design:
 * - Centralized: All type loading logic in one place
 * - Cacheable: Results can be cached for performance
 * - Extensible: Easy to add new type sources
 */

import type { TypeDefinition } from './types';

// @ts-ignore - Electron IPC
const { ipcRenderer } = window.require('electron');

export class TypeDefinitionLoader {
  private cache = new Map<string, TypeDefinition>();

  /**
   * Load type definitions from node_modules/@types
   */
  async loadFromNodeModules(
    workspacePath: string,
    packageNames: string[]
  ): Promise<TypeDefinition[]> {
    const results: TypeDefinition[] = [];

    for (const packageName of packageNames) {
      // Check cache first
      const cacheKey = `@types/${packageName}`;
      if (this.cache.has(cacheKey)) {
        results.push(this.cache.get(cacheKey)!);
        continue;
      }

      try {
        const result = await ipcRenderer.invoke(
          'monaco:load-type-definition',
          workspacePath,
          packageName
        );

        if (result.success && result.content) {
          const typeDef: TypeDefinition = {
            packageName: `@types/${packageName}`,
            content: result.content,
            uri: `file:///node_modules/@types/${packageName}/index.d.ts`,
            source: 'node_modules',
          };

          this.cache.set(cacheKey, typeDef);
          results.push(typeDef);
        }
      } catch (error) {
        console.warn(`[TypeDefinitionLoader] Failed to load @types/${packageName}:`, error);
      }
    }

    return results;
  }

  /**
   * Load type definitions from a regular package (e.g., next, vue)
   */
  async loadFromPackage(
    workspacePath: string,
    packageName: string
  ): Promise<TypeDefinition | null> {
    // Check cache first
    if (this.cache.has(packageName)) {
      return this.cache.get(packageName)!;
    }

    try {
      const result = await ipcRenderer.invoke(
        'monaco:load-package-types',
        workspacePath,
        packageName
      );

      if (result.success && result.content) {
        const typeDef: TypeDefinition = {
          packageName,
          content: result.content,
          uri: `file:///node_modules/${packageName}/index.d.ts`,
          source: 'node_modules',
        };

        this.cache.set(packageName, typeDef);
        return typeDef;
      }
    } catch (error) {
      console.warn(`[TypeDefinitionLoader] Failed to load ${packageName} types:`, error);
    }

    return null;
  }

  /**
   * Get built-in fallback type definitions
   * These are minimal types that work without any packages installed
   */
  getBuiltinTypes(): TypeDefinition[] {
    return [
      {
        packageName: 'react-builtin',
        content: this.getReactBuiltinTypes(),
        uri: 'file:///builtin/react.d.ts',
        source: 'builtin',
      },
    ];
  }

  /**
   * Load all essential type definitions for a workspace
   * This includes common packages and framework-specific types
   */
  async loadEssentialTypes(workspacePath: string): Promise<TypeDefinition[]> {
    console.log('[TypeDefinitionLoader] Loading essential type definitions...');

    const results: TypeDefinition[] = [];

    // 1. Load built-in fallbacks first
    results.push(...this.getBuiltinTypes());

    // 2. Check what @types packages are available
    try {
      const typesResult = await ipcRenderer.invoke(
        'monaco:list-type-definitions',
        workspacePath
      );

      if (typesResult.success && typesResult.types?.length > 0) {
        // Load common/important packages
        const importantPackages = ['react', 'react-dom', 'node'];
        const availablePackages = typesResult.types.filter((t: string) =>
          importantPackages.includes(t)
        );

        const nodeModulesTypes = await this.loadFromNodeModules(
          workspacePath,
          availablePackages
        );
        results.push(...nodeModulesTypes);
      }
    } catch (error) {
      console.warn('[TypeDefinitionLoader] No @types packages available:', error);
    }

    // 3. Load framework-specific types (Next.js, etc.)
    const frameworkPackages = ['next'];
    for (const packageName of frameworkPackages) {
      const packageTypes = await this.loadFromPackage(workspacePath, packageName);
      if (packageTypes) {
        results.push(packageTypes);
      }
    }

    console.log(`[TypeDefinitionLoader] ✅ Loaded ${results.length} type definition packages`);
    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Built-in React type definitions (minimal fallback)
   */
  private getReactBuiltinTypes(): string {
    return `
declare namespace React {
  // Basic types
  type ReactNode = string | number | boolean | null | undefined | ReactElement | ReactFragment;
  type ReactElement = any;
  type ReactFragment = any;

  // Component types
  interface FunctionComponent<P = {}> {
    (props: P): ReactNode;
  }
  type FC<P = {}> = FunctionComponent<P>;

  // Hooks
  function useEffect(effect: () => void | (() => void), deps?: any[]): void;
  function useState<S>(initialState: S | (() => S)): [S, (newState: S | ((prev: S) => S)) => void];
  function useRef<T>(initialValue: T): { current: T };
  function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
  function useMemo<T>(factory: () => T, deps: any[]): T;
  function useContext<T>(context: Context<T>): T;
  function useReducer<R extends Reducer<any, any>>(
    reducer: R,
    initialState: ReducerState<R>,
    initializer?: undefined
  ): [ReducerState<R>, Dispatch<ReducerAction<R>>];

  // Context
  interface Context<T> {
    Provider: ComponentType<{ value: T }>;
    Consumer: ComponentType<{ children: (value: T) => ReactNode }>;
  }
  function createContext<T>(defaultValue: T): Context<T>;

  // Other
  type ComponentType<P = {}> = FC<P>;
  type Reducer<S, A> = (prevState: S, action: A) => S;
  type ReducerState<R extends Reducer<any, any>> = R extends Reducer<infer S, any> ? S : never;
  type ReducerAction<R extends Reducer<any, any>> = R extends Reducer<any, infer A> ? A : never;
  type Dispatch<A> = (value: A) => void;
}

declare module 'react' {
  export = React;
}
`;
  }
}
