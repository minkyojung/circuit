/**
 * Whisper v3 Turbo Integration
 * Speech-to-Text using OpenAI Whisper API
 */

const fs = require('fs').promises
const path = require('path')
const FormData = require('form-data')
const axios = require('axios')

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * Whisper v3 Turbo로 음성 전사
 * @param {string} audioFilePath - 음성 파일 경로
 * @param {object} options - 전사 옵션
 * @returns {Promise<object>} 전사 결과
 */
async function transcribeAudio(audioFilePath, options = {}) {
  try {
    const {
      language = 'ko',  // 한국어 기본
      prompt = '',      // 컨텍스트 힌트
      temperature = 0.0 // 일관성을 위해 낮은 temperature
    } = options

    console.log('[Whisper] Transcribing audio:', audioFilePath)

    // OpenAI API 호출
    const formData = new FormData()
    const audioBuffer = await fs.readFile(audioFilePath)
    formData.append('file', audioBuffer, {
      filename: path.basename(audioFilePath),
      contentType: 'audio/webm'
    })
    formData.append('model', 'whisper-1')  // v3 turbo
    formData.append('language', language)
    if (prompt) formData.append('prompt', prompt)
    formData.append('temperature', temperature.toString())
    formData.append('response_format', 'verbose_json')

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': 'Bearer ' + OPENAI_API_KEY
        },
        timeout: 30000  // 30초 타임아웃
      }
    )

    const result = response.data

    console.log('[Whisper] Transcription success:', result.text)

    return {
      success: true,
      transcription: result.text,
      confidence: result.confidence || 0.9,  // verbose_json에 포함될 수 있음
      language: result.language || language,
      duration: result.duration || 0
    }

  } catch (error) {
    console.error('[Whisper] Transcription failed:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * 로컬 Whisper 모델 (향후 구현)
 * WhisperKit 또는 로컬 모델 사용
 */
async function transcribeAudioLocal(audioFilePath, options = {}) {
  // TODO: 로컬 Whisper 구현
  console.warn('[Whisper] Local transcription not yet implemented')
  return {
    success: false,
    error: 'Local transcription not implemented'
  }
}

module.exports = {
  transcribeAudio,
  transcribeAudioLocal
}
