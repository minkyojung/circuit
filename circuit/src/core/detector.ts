/**
 * Phase 2: Project Type Detection
 *
 * package.json을 분석해서 프로젝트 타입과 확신도 반환
 */

export type ProjectType = 'react' | 'nextjs' | 'node-api' | 'unknown'

export interface DetectionResult {
  type: ProjectType
  confidence: number  // 0.0 ~ 1.0
  reasons: string[]   // 감지 근거
}

export interface PackageJson {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  [key: string]: any
}

/**
 * package.json 내용으로 프로젝트 타입 감지
 */
export function detectProjectType(packageJson: PackageJson): DetectionResult {
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  }

  const reasons: string[] = []
  let type: ProjectType = 'unknown'
  let confidence = 0

  // Next.js 체크 (가장 높은 우선순위)
  if (allDeps['next']) {
    type = 'nextjs'
    confidence = 0.95
    reasons.push(`✓ next@${allDeps['next']} 발견`)

    if (allDeps['react']) {
      reasons.push(`✓ react@${allDeps['react']} 포함`)
    }

    return { type, confidence, reasons }
  }

  // React 체크 (Next.js 아닌 경우)
  if (allDeps['react']) {
    type = 'react'
    confidence = 0.9
    reasons.push(`✓ react@${allDeps['react']} 발견`)

    if (allDeps['react-dom']) {
      reasons.push(`✓ react-dom 포함`)
    }

    if (allDeps['vite'] || allDeps['@vitejs/plugin-react']) {
      confidence = 0.95
      reasons.push('✓ Vite 설정 발견')
    }

    return { type, confidence, reasons }
  }

  // Node API 체크 (React/Next 아닌 경우)
  const apiFrameworks = ['express', 'fastify', 'koa', '@hapi/hapi']
  const foundFramework = apiFrameworks.find(fw => allDeps[fw])

  if (foundFramework) {
    type = 'node-api'
    confidence = 0.85
    reasons.push(`✓ ${foundFramework} 발견`)

    if (allDeps['typescript'] || allDeps['@types/node']) {
      confidence = 0.9
      reasons.push('✓ TypeScript 설정')
    }

    return { type, confidence, reasons }
  }

  // 아무것도 못 찾음
  return {
    type: 'unknown',
    confidence: 0,
    reasons: ['❌ 알려진 프레임워크를 찾을 수 없습니다']
  }
}

/**
 * 확신도에 따른 UI 메시지 생성
 */
export function getConfidenceMessage(confidence: number): string {
  if (confidence >= 0.9) return '높은 확신'
  if (confidence >= 0.7) return '중간 확신'
  if (confidence >= 0.5) return '낮은 확신'
  return '불확실'
}

/**
 * ProjectType을 사람이 읽기 좋은 이름으로 변환
 */
export function getProjectTypeName(type: ProjectType): string {
  const names: Record<ProjectType, string> = {
    'react': 'React',
    'nextjs': 'Next.js',
    'node-api': 'Node.js API',
    'unknown': 'Unknown'
  }
  return names[type]
}

/**
 * ProjectType에 맞는 템플릿 파일명 반환
 */
export function getTemplateFilename(type: ProjectType): string {
  if (type === 'unknown') return 'react.md'  // 기본값
  return `${type}.md`
}
