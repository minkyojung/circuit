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

/**
 * 파일 경로가 감시 대상인지 확인
 */
export function shouldWatch(filePath: string): boolean {
  return WATCHED_EXTENSIONS.some(ext => filePath.endsWith(ext))
}

/**
 * 파일 변경 이벤트 생성
 */
export function createChangeEvent(
  type: 'add' | 'change' | 'unlink',
  path: string
): FileChangeEvent {
  return {
    type,
    path,
    timestamp: Date.now()
  }
}

/**
 * 이벤트를 사람이 읽기 좋은 형식으로 변환
 */
export function formatEvent(event: FileChangeEvent): string {
  const typeEmoji = {
    'add': '➕',
    'change': '✏️',
    'unlink': '🗑️'
  }

  const emoji = typeEmoji[event.type] || '📄'
  const time = new Date(event.timestamp).toLocaleTimeString()

  return `${emoji} [${time}] ${event.type.toUpperCase()}: ${event.path}`
}
