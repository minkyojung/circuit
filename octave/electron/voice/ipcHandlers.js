/**
 * Voice IPC Handlers
 * Electron Main Process handlers for voice features
 */

const { ipcMain } = require('electron')
const fs = require('fs').promises
const path = require('path')
const os = require('os')
const { transcribeAudio } = require('./whisper')
const { startRecording, stopRecording, cancelRecording } = require('./audioCapture')

/**
 * Voice IPC 핸들러 등록
 * main.cjs에서 호출하여 등록
 */
function registerVoiceHandlers() {
  console.log('[Voice] Registering voice IPC handlers...')

  // 녹음 시작
  ipcMain.handle('voice:start-recording', async (event) => {
    try {
      const result = await startRecording()
      return result
    } catch (error) {
      console.error('[Voice] Start recording error:', error)
      return { success: false, error: error.message }
    }
  })

  // 녹음 중지 및 전사
  ipcMain.handle('voice:stop-recording', async (event, audioDataBase64) => {
    try {
      // Base64 오디오 데이터를 Buffer로 변환
      const audioData = audioDataBase64
        ? Buffer.from(audioDataBase64, 'base64')
        : null

      // 녹음 중지
      const stopResult = await stopRecording(audioData)
      if (!stopResult.success) {
        return stopResult
      }

      const { filePath } = stopResult

      if (!filePath) {
        return {
          success: false,
          error: 'No audio file path'
        }
      }

      // Whisper로 전사
      const transcriptionResult = await transcribeAudio(filePath, {
        language: 'ko'
      })

      if (!transcriptionResult.success) {
        return transcriptionResult
      }

      // Data URL 생성 (UI에서 재생 가능하도록)
      const audioBuffer = await fs.readFile(filePath)
      const base64Audio = audioBuffer.toString('base64')
      const audioDataUrl = 'data:audio/webm;base64,' + base64Audio

      // 임시 파일 삭제
      await fs.unlink(filePath).catch(() => {})

      return {
        success: true,
        transcription: transcriptionResult.transcription,
        confidence: transcriptionResult.confidence,
        audioDataUrl,
        duration: stopResult.duration,
        language: transcriptionResult.language
      }

    } catch (error) {
      console.error('[Voice] Stop recording error:', error)
      return { success: false, error: error.message }
    }
  })

  // 녹음 취소
  ipcMain.handle('voice:cancel-recording', async (event) => {
    try {
      const result = await cancelRecording()
      return result
    } catch (error) {
      console.error('[Voice] Cancel recording error:', error)
      return { success: false, error: error.message }
    }
  })

  // TTS 합성 (stub - ElevenLabs는 다음 단계)
  ipcMain.handle('voice:synthesize', async (event, { text, voice, speed }) => {
    try {
      console.log('[Voice] TTS synthesize (stub):', text)
      // TODO: ElevenLabs 또는 OpenAI TTS 통합
      return {
        success: false,
        error: 'TTS not yet implemented'
      }
    } catch (error) {
      console.error('[Voice] TTS error:', error)
      return { success: false, error: error.message }
    }
  })

  // 오디오 재생 (stub)
  ipcMain.handle('voice:play-audio', async (event, audioUrl) => {
    try {
      console.log('[Voice] Play audio (stub):', audioUrl)
      // TODO: 시스템 오디오 재생
      return { success: true }
    } catch (error) {
      console.error('[Voice] Play audio error:', error)
      return { success: false, error: error.message }
    }
  })

  // 멀티 에이전트 실행 (stub)
  ipcMain.handle('multi-agent:execute', async (event, { jobId, tasks }) => {
    try {
      console.log('[MultiAgent] Execute (stub):', jobId, tasks)
      // TODO: Multi-Agent Orchestrator 구현
      return { success: false, error: 'Multi-agent not yet implemented' }
    } catch (error) {
      console.error('[MultiAgent] Execute error:', error)
      return { success: false, error: error.message }
    }
  })

  console.log('[Voice] Voice IPC handlers registered successfully')
}

module.exports = {
  registerVoiceHandlers
}
