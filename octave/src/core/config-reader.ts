/**
 * Phase 1: .circuit/circuit.config.md 파일 읽기
 *
 * 목표: 파일이 있으면 읽어서 콘솔에 출력
 */

export interface OctaveConfig {
  projectPath: string
  configExists: boolean
  strategy?: string
  configContent?: string
  error?: string
}

/**
 * .circuit/circuit.config.md 파일을 찾아서 읽기 시도
 */
export async function readOctaveConfig(projectPath: string): Promise<OctaveConfig> {
  console.log('[Octave] Checking for .circuit/ config...')
  console.log('[Octave] Project path:', projectPath)

  if (!projectPath) {
    return {
      projectPath: '',
      configExists: false,
      error: 'Project path is empty'
    }
  }

  try {
    // Use secure IPC bridge for file operations
    const configPath = `${projectPath}/.circuit/circuit.config.md`

    // 파일 존재 여부 확인
    const exists = await window.electron.fs.fileExists(configPath)
    if (!exists) {
      return {
        projectPath,
        configExists: false,
        error: 'Config file not found'
      }
    }

    // 파일 읽기
    const configContent = await window.electron.fs.readFile(configPath)

    // Strategy 추출 (간단한 파싱)
    const strategyMatch = configContent.match(/Strategy:\s*(\w+)/i)
    const strategy = strategyMatch ? strategyMatch[1] : undefined

    return {
      projectPath,
      configExists: true,
      strategy,
      configContent
    }
  } catch (error) {
    console.error('[Octave] Error reading config:', error)
    return {
      projectPath,
      configExists: false,
      error: String(error)
    }
  }
}

/**
 * Phase 0 테스트용: 콘솔에 로그만 출력
 */
export function logOctaveStatus(config: OctaveConfig) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔧 Octave Test-Fix Loop')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Project:', config.projectPath)
  console.log('Config exists:', config.configExists)

  if (config.strategy) {
    console.log('Strategy:', config.strategy)
  }

  if (config.error) {
    console.log('Status:', config.error)
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}
