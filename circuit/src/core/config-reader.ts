/**
 * Phase 1: .circuit/circuit.config.md 파일 읽기
 *
 * 목표: 파일이 있으면 읽어서 콘솔에 출력
 */

export interface CircuitConfig {
  projectPath: string
  configExists: boolean
  strategy?: string
  configContent?: string
  error?: string
}

/**
 * .circuit/circuit.config.md 파일을 찾아서 읽기 시도
 */
export async function readCircuitConfig(projectPath: string): Promise<CircuitConfig> {
  console.log('[Circuit] Checking for .circuit/ config...')
  console.log('[Circuit] Project path:', projectPath)

  if (!projectPath) {
    return {
      projectPath: '',
      configExists: false,
      error: 'Project path is empty'
    }
  }

  try {
    // Node.js fs module을 사용해서 파일 읽기
    const fs = window.require('fs')
    const path = window.require('path')

    const configPath = path.join(projectPath, '.circuit', 'circuit.config.md')

    // 파일 존재 여부 확인
    if (!fs.existsSync(configPath)) {
      return {
        projectPath,
        configExists: false,
        error: 'Config file not found'
      }
    }

    // 파일 읽기
    const configContent = fs.readFileSync(configPath, 'utf-8')

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
    console.error('[Circuit] Error reading config:', error)
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
export function logCircuitStatus(config: CircuitConfig) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🔧 Circuit Test-Fix Loop')
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
