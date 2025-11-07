import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react'
import type {
  VoiceInputState,
  VoiceFeedbackState,
  VoiceCommandParseResult,
  MultiAgentState,
  VoiceFeedbackItem,
  AgentTask
} from '@/types/voice'

const ipcRenderer = window.electron.ipcRenderer;

interface VoiceContextType {
  // 음성 입력 상태
  inputState: VoiceInputState

  // 음성 피드백 상태
  feedbackState: VoiceFeedbackState

  // 멀티 에이전트 상태
  multiAgentState: MultiAgentState | null

  // 메서드
  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  cancelRecording: () => void

  playFeedback: (message: string, agentName?: string) => Promise<void>
  stopFeedback: () => void

  executeMultiAgentCommand: (parseResult: VoiceCommandParseResult) => Promise<void>
}

const VoiceContext = createContext<VoiceContextType | null>(null)

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inputState, setInputState] = useState<VoiceInputState>({
    isRecording: false,
    recordingDuration: 0,
    partialTranscription: '',
    finalTranscription: '',
    confidence: 0
  })

  const [feedbackState, setFeedbackState] = useState<VoiceFeedbackState>({
    isPlaying: false,
    queue: []
  })

  const [multiAgentState, setMultiAgentState] = useState<MultiAgentState | null>(null)

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // 녹음 시작
  const startRecording = useCallback(async () => {
    try {
      console.log('[VoiceContext] Starting recording...')

      const result = await ipcRenderer.invoke('voice:start-recording')

      if (!result.success) {
        throw new Error(result.error || 'Failed to start recording')
      }

      setInputState(prev => ({
        ...prev,
        isRecording: true,
        recordingStartTime: Date.now(),
        partialTranscription: '',
        finalTranscription: '',
        error: undefined
      }))

      // 녹음 시간 업데이트
      recordingIntervalRef.current = setInterval(() => {
        setInputState(prev => ({
          ...prev,
          recordingDuration: Date.now() - (prev.recordingStartTime || Date.now())
        }))
      }, 100)

      console.log('[VoiceContext] Recording started')

    } catch (error) {
      console.error('[VoiceContext] Failed to start recording:', error)
      setInputState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      throw error
    }
  }, [])

  // 녹음 중지
  const stopRecording = useCallback(async () => {
    try {
      console.log('[VoiceContext] Stopping recording...')

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current)
        recordingIntervalRef.current = null
      }

      const result = await ipcRenderer.invoke('voice:stop-recording')

      if (!result.success) {
        throw new Error(result.error || 'Failed to stop recording')
      }

      setInputState(prev => ({
        ...prev,
        isRecording: false,
        finalTranscription: result.transcription || '',
        confidence: result.confidence || 0,
        audioDataUrl: result.audioDataUrl,
        error: undefined
      }))

      console.log('[VoiceContext] Recording stopped. Transcription:', result.transcription)

    } catch (error) {
      console.error('[VoiceContext] Failed to stop recording:', error)
      setInputState(prev => ({
        ...prev,
        isRecording: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      throw error
    }
  }, [])

  // 녹음 취소
  const cancelRecording = useCallback(() => {
    console.log('[VoiceContext] Cancelling recording...')

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current)
      recordingIntervalRef.current = null
    }

    ipcRenderer.invoke('voice:cancel-recording').catch(console.error)

    setInputState({
      isRecording: false,
      recordingDuration: 0,
      partialTranscription: '',
      finalTranscription: '',
      confidence: 0
    })
  }, [])

  // 음성 피드백 재생
  const playFeedback = useCallback(async (message: string, agentName?: string) => {
    try {
      console.log('[VoiceContext] Playing feedback:', message)

      const feedbackItem: VoiceFeedbackItem = {
        id: Date.now().toString(),
        message,
        timestamp: Date.now(),
        agentName
      }

      // TTS 생성
      const result = await ipcRenderer.invoke('voice:synthesize', {
        text: message,
        voice: 'alloy',
        speed: 1.1
      })

      if (!result.success) {
        console.warn('[VoiceContext] TTS failed, using text only:', result.error)
        // TTS 실패해도 메시지는 표시
        setFeedbackState(prev => ({
          ...prev,
          queue: [...prev.queue, feedbackItem]
        }))
        return
      }

      feedbackItem.audioUrl = result.audioUrl

      setFeedbackState(prev => ({
        ...prev,
        queue: [...prev.queue, feedbackItem]
      }))

      // 큐가 비어있으면 즉시 재생
      if (feedbackState.queue.length === 0 && !feedbackState.isPlaying) {
        playNextInQueue(feedbackItem)
      }

    } catch (error) {
      console.error('[VoiceContext] Failed to play feedback:', error)
    }
  }, [feedbackState])

  const playNextInQueue = useCallback(async (item: VoiceFeedbackItem) => {
    if (!item.audioUrl) return

    setFeedbackState(prev => ({
      ...prev,
      isPlaying: true,
      currentMessage: item.message
    }))

    try {
      await ipcRenderer.invoke('voice:play-audio', item.audioUrl)
    } catch (error) {
      console.error('[VoiceContext] Audio playback failed:', error)
    }

    setFeedbackState(prev => ({
      isPlaying: false,
      currentMessage: undefined,
      queue: prev.queue.slice(1)
    }))

    // 다음 큐 재생
    if (feedbackState.queue.length > 1) {
      playNextInQueue(feedbackState.queue[1])
    }
  }, [feedbackState])

  const stopFeedback = useCallback(() => {
    console.log('[VoiceContext] Stopping feedback')
    setFeedbackState({ isPlaying: false, queue: [] })
  }, [])

  // 멀티 에이전트 명령 실행
  const executeMultiAgentCommand = useCallback(async (parseResult: VoiceCommandParseResult) => {
    const jobId = Date.now().toString()

    console.log('[VoiceContext] Executing multi-agent command:', parseResult)

    const initialState: MultiAgentState = {
      jobId,
      tasks: parseResult.agents.map(agent => ({
        ...agent,
        status: 'pending' as const,
        progress: 0
      })),
      status: 'running',
      startedAt: Date.now(),
      overallProgress: 0
    }

    setMultiAgentState(initialState)

    try {
      // IPC로 멀티 에이전트 작업 시작
      const result = await ipcRenderer.invoke('multi-agent:execute', {
        jobId,
        tasks: parseResult.agents
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to execute multi-agent command')
      }

      // 작업 시작 피드백
      const agentNames = parseResult.agents.map(a => a.name).join(', ')
      await playFeedback(`${parseResult.agents.length}개 작업 시작했습니다: ${agentNames}`)

    } catch (error) {
      console.error('[VoiceContext] Failed to execute multi-agent command:', error)

      setMultiAgentState(prev => prev ? {
        ...prev,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      } : null)
    }
  }, [playFeedback])

  // 멀티 에이전트 진행 상황 업데이트 리스너
  useEffect(() => {
    const handleAgentProgress = (_event: any, data: {
      jobId: string
      taskIndex: number
      status: AgentTask['status']
      progress: number
      result?: string
      error?: string
    }) => {
      console.log('[VoiceContext] Agent progress:', data)

      setMultiAgentState(prev => {
        if (!prev || prev.jobId !== data.jobId) return prev

        const updatedTasks = [...prev.tasks]
        updatedTasks[data.taskIndex] = {
          ...updatedTasks[data.taskIndex],
          status: data.status,
          progress: data.progress,
          result: data.result,
          error: data.error,
          ...(data.status === 'running' && !updatedTasks[data.taskIndex].startedAt
            ? { startedAt: Date.now() }
            : {}),
          ...(data.status === 'completed' || data.status === 'failed'
            ? { completedAt: Date.now() }
            : {})
        }

        const overallProgress = updatedTasks.reduce((sum, task) => sum + task.progress, 0) / updatedTasks.length

        const allCompleted = updatedTasks.every(t => t.status === 'completed' || t.status === 'failed')

        return {
          ...prev,
          tasks: updatedTasks,
          overallProgress,
          status: allCompleted ? 'completed' : 'running',
          completedAt: allCompleted ? Date.now() : undefined
        }
      })

      // 진행 상황 음성 피드백
      if (data.result) {
        const task = multiAgentState?.tasks[data.taskIndex]
        playFeedback(data.result, task?.name)
      }
    }

    ipcRenderer.on('multi-agent:progress', handleAgentProgress)

    return () => {
      ipcRenderer.removeListener('multi-agent:progress', handleAgentProgress)
    }
  }, [multiAgentState, playFeedback])

  const value: VoiceContextType = {
    inputState,
    feedbackState,
    multiAgentState,
    startRecording,
    stopRecording,
    cancelRecording,
    playFeedback,
    stopFeedback,
    executeMultiAgentCommand
  }

  return (
    <VoiceContext.Provider value={value}>
      {children}
    </VoiceContext.Provider>
  )
}

export const useVoice = () => {
  const context = useContext(VoiceContext)
  if (!context) {
    throw new Error('useVoice must be used within VoiceProvider')
  }
  return context
}
