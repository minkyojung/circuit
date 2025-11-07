/**
 * Audio Capture for Electron
 * Handles microphone recording
 */

const fs = require('fs').promises
const path = require('path')
const os = require('os')

// 녹음 상태 관리
const recordingState = {
  isRecording: false,
  chunks: [],
  startTime: null,
  tempFilePath: null
}

/**
 * 녹음 시작
 * Note: 실제 오디오 캡처는 렌더러 프로세스에서 MediaRecorder API로 처리
 * 메인 프로세스는 상태 관리만 담당
 */
async function startRecording() {
  try {
    if (recordingState.isRecording) {
      return { success: false, error: 'Already recording' }
    }

    console.log('[AudioCapture] Starting recording...')

    recordingState.isRecording = true
    recordingState.startTime = Date.now()
    recordingState.chunks = []

    // 임시 파일 경로 생성
    const tempDir = path.join(os.tmpdir(), 'circuit-voice')
    await fs.mkdir(tempDir, { recursive: true })
    recordingState.tempFilePath = path.join(tempDir, 'recording-' + Date.now() + '.webm')

    return { success: true }

  } catch (error) {
    console.error('[AudioCapture] Failed to start recording:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 녹음 중지
 * @param {Buffer} audioData - 렌더러에서 전송한 오디오 데이터
 */
async function stopRecording(audioData) {
  try {
    if (!recordingState.isRecording) {
      return { success: false, error: 'Not recording' }
    }

    console.log('[AudioCapture] Stopping recording...')

    recordingState.isRecording = false

    // 오디오 데이터 저장
    if (audioData && recordingState.tempFilePath) {
      await fs.writeFile(recordingState.tempFilePath, audioData)
      console.log('[AudioCapture] Audio saved to:', recordingState.tempFilePath)
    }

    const duration = Date.now() - recordingState.startTime

    return {
      success: true,
      filePath: recordingState.tempFilePath,
      duration
    }

  } catch (error) {
    console.error('[AudioCapture] Failed to stop recording:', error)
    recordingState.isRecording = false
    return { success: false, error: error.message }
  }
}

/**
 * 녹음 취소
 */
async function cancelRecording() {
  try {
    console.log('[AudioCapture] Cancelling recording...')

    recordingState.isRecording = false
    recordingState.chunks = []

    // 임시 파일 삭제
    if (recordingState.tempFilePath) {
      try {
        await fs.unlink(recordingState.tempFilePath)
      } catch (error) {
        // 파일이 없을 수 있음, 무시
      }
      recordingState.tempFilePath = null
    }

    return { success: true }

  } catch (error) {
    console.error('[AudioCapture] Failed to cancel recording:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 녹음 상태 조회
 */
function getRecordingState() {
  return {
    isRecording: recordingState.isRecording,
    duration: recordingState.isRecording
      ? Date.now() - recordingState.startTime
      : 0
  }
}

module.exports = {
  startRecording,
  stopRecording,
  cancelRecording,
  getRecordingState
}
