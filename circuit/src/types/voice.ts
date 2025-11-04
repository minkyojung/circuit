/**
 * Voice Types - Multi-Agent Voice Control
 */

/**
 * 음성 명령 파싱 결과
 */
export interface VoiceCommandParseResult {
  /** 파싱된 에이전트 작업들 */
  agents: AgentTask[]

  /** 멀티 에이전트 명령 여부 */
  isMultiAgent: boolean

  /** 파싱 신뢰도 (0.0-1.0) */
  confidence: number

  /** 원본 전사 */
  originalTranscription: string

  /** 파싱 근거 */
  reasoning?: string

  /** 파싱 오류 (있을 경우) */
  error?: string
}

/**
 * 에이전트 작업
 */
export interface AgentTask {
  /** 에이전트 이름 */
  name: 'Victoria' | 'Alex' | 'Sam' | 'GitBot'

  /** 작업 설명 */
  task: string

  /** 우선순위 (1=highest) */
  priority: number

  /** 의존하는 다른 에이전트 작업 (인덱스) */
  dependencies: number[]

  /** 워크스페이스 ID (할당 후) */
  workspaceId?: string

  /** 작업 상태 */
  status: 'pending' | 'running' | 'completed' | 'failed'

  /** 진행률 (0-100) */
  progress: number

  /** 시작 시간 */
  startedAt?: number

  /** 완료 시간 */
  completedAt?: number

  /** 결과 메시지 */
  result?: string

  /** 오류 메시지 */
  error?: string
}

/**
 * 음성 입력 상태
 */
export interface VoiceInputState {
  /** 녹음 중 여부 */
  isRecording: boolean

  /** 녹음 시작 시간 */
  recordingStartTime?: number

  /** 녹음 지속 시간 (ms) */
  recordingDuration: number

  /** 부분 전사 (실시간) */
  partialTranscription: string

  /** 최종 전사 */
  finalTranscription: string

  /** 전사 신뢰도 */
  confidence: number

  /** 오디오 데이터 URL */
  audioDataUrl?: string

  /** 에러 */
  error?: string
}

/**
 * 음성 피드백 상태
 */
export interface VoiceFeedbackState {
  /** 재생 중 여부 */
  isPlaying: boolean

  /** 현재 재생 중인 메시지 */
  currentMessage?: string

  /** 재생 큐 */
  queue: VoiceFeedbackItem[]
}

/**
 * 음성 피드백 아이템
 */
export interface VoiceFeedbackItem {
  id: string
  message: string
  audioUrl?: string
  timestamp: number
  agentName?: string
}

/**
 * 멀티 에이전트 오케스트레이션 상태
 */
export interface MultiAgentState {
  /** 전체 작업 ID */
  jobId: string

  /** 모든 에이전트 작업 */
  tasks: AgentTask[]

  /** 전체 상태 */
  status: 'idle' | 'running' | 'completed' | 'failed'

  /** 시작 시간 */
  startedAt?: number

  /** 완료 시간 */
  completedAt?: number

  /** 진행률 (0-100) */
  overallProgress: number

  /** 에러 */
  error?: string
}

/**
 * 음성 설정
 */
export interface VoiceSettings {
  /** 음성 입력 활성화 */
  inputEnabled: boolean

  /** 음성 출력 (TTS) 활성화 */
  outputEnabled: boolean

  /** STT 제공자 */
  sttProvider: 'whisper-api' | 'whisper-local'

  /** TTS 제공자 */
  ttsProvider: 'elevenlabs' | 'openai'

  /** 언어 */
  language: string

  /** TTS 음성 ID */
  voiceId?: string

  /** TTS 속도 */
  speed: number
}
