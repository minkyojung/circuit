/**
 * Phase 3: File Change Detection
 *
 * chokidar로 파일 변경 감지 (콘솔 로그만 출력)
 */

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink'
  path: string
  timestamp: number
}

export interface WatchConfig {
  projectPath: string
  ignored?: string[]
}

/**
 * 기본 무시 패턴
 */
export const DEFAULT_IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.circuit/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.vite/**',
  '**/*.log',
]

/**
 * 감시할 파일 확장자
 */
export const WATCHED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]
