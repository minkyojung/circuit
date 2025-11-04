# 🎤 음성 기능 구현 가이드 (Week 1 Day 1-2 완료)

## ✅ 완료된 작업

### 1. 타입 정의
- **circuit/src/types/voice.ts**
  - VoiceCommandParseResult
  - AgentTask
  - VoiceInputState
  - VoiceFeedbackState
  - MultiAgentState
  - VoiceSettings

### 2. React Context
- **circuit/src/contexts/VoiceContext.tsx**
  - VoiceProvider
  - useVoice hook
  - 녹음 상태 관리
  - 음성 피드백 큐 시스템
  - 멀티 에이전트 상태 관리

### 3. UI 컴포넌트
- **circuit/src/components/voice/VoiceButton.tsx**
  - 녹음 시작/중지 버튼
  - 녹음 시간 표시
  - 취소 버튼

- **circuit/src/components/voice/TranscriptionDisplay.tsx**
  - 전사 결과 표시
  - 신뢰도 표시

### 4. Electron 백엔드
- **circuit/electron/voice/whisper.js**
  - Whisper API 통합
  - transcribeAudio() 함수

- **circuit/electron/voice/audioCapture.js**
  - 녹음 상태 관리
  - 파일 저장 처리

- **circuit/electron/voice/ipcHandlers.js**
  - voice:start-recording
  - voice:stop-recording
  - voice:cancel-recording
  - voice:synthesize (stub)
  - voice:play-audio (stub)
  - multi-agent:execute (stub)

---

## 🔧 통합 방법

### Step 1: main.cjs에 Voice 핸들러 등록

**circuit/electron/main.cjs** 파일에 다음을 추가:

```javascript
// 파일 상단에 추가
const { registerVoiceHandlers } = require('./voice/ipcHandlers')

// app.whenReady() 블록 내에 추가 (기존 IPC 핸들러 등록 후)
app.whenReady().then(async () => {
  // ... 기존 코드 ...

  // Voice IPC 핸들러 등록
  registerVoiceHandlers()

  // ... 기존 코드 ...
})
```

### Step 2: App.tsx에 VoiceProvider 추가

**circuit/src/App.tsx** 파일 수정:

```typescript
import { VoiceProvider } from '@/contexts/VoiceContext'

// ... 기존 코드 ...

function App() {
  return (
    <SettingsProvider>
      <VoiceProvider>  {/* 추가 */}
        <Router>
          {/* ... 기존 컴포넌트들 ... */}
        </Router>
      </VoiceProvider>  {/* 추가 */}
    </SettingsProvider>
  )
}
```

### Step 3: ChatInput에 VoiceButton 추가

**circuit/src/components/workspace/ChatInput.tsx** 파일 수정:

```typescript
import { VoiceButton } from '@/components/voice/VoiceButton'
import { TranscriptionDisplay } from '@/components/voice/TranscriptionDisplay'
import { useVoice } from '@/contexts/VoiceContext'

// ... 컴포넌트 내부 ...

const { inputState } = useVoice()

// Control bar에 VoiceButton 추가 (파일 첨부 버튼 옆)
<div className="flex items-center gap-2">
  <FileInput ... />
  <VoiceButton size="sm" />  {/* 추가 */}
  <Button>Send</Button>
</div>

// 전사 결과 표시 (input 위)
{inputState.finalTranscription && (
  <TranscriptionDisplay className="mb-2" />
)}
```

전사된 텍스트를 자동으로 입력창에 넣으려면:

```typescript
const { inputState } = useVoice()

useEffect(() => {
  if (inputState.finalTranscription) {
    // 전사 결과를 input에 자동 입력
    setValue(inputState.finalTranscription)
  }
}, [inputState.finalTranscription])
```

### Step 4: 환경 변수 설정

**.env** 파일에 추가:

```bash
# OpenAI API Key (Whisper용)
OPENAI_API_KEY=sk-...

# 향후 추가될 설정들
# ELEVENLABS_API_KEY=...
# ELEVENLABS_VOICE_ID=...
```

### Step 5: 의존성 설치

```bash
cd circuit
npm install form-data axios
```

---

## 🧪 테스트 방법

### 1. 기본 녹음/전사 테스트

1. 앱 실행
2. ChatInput에서 Voice 버튼 클릭
3. 마이크 권한 허용
4. 몇 초간 말하기
5. Voice 버튼 다시 클릭 (중지)
6. 전사 결과 확인

**기대 결과**:
- 녹음 중 버튼이 빨간색으로 변경
- 녹음 시간 표시
- 전사 결과가 TranscriptionDisplay에 표시
- 신뢰도 표시

### 2. 개발자 콘솔 로그 확인

```
[VoiceContext] Starting recording...
[AudioCapture] Starting recording...
[VoiceContext] Recording started

[VoiceContext] Stopping recording...
[AudioCapture] Stopping recording...
[AudioCapture] Audio saved to: /tmp/circuit-voice/recording-xxx.webm
[Whisper] Transcribing audio: /tmp/circuit-voice/recording-xxx.webm
[Whisper] Transcription success: "안녕하세요 테스트입니다"
[VoiceContext] Recording stopped. Transcription: "안녕하세요 테스트입니다"
```

### 3. 오류 처리 테스트

**시나리오 1: OPENAI_API_KEY 없음**
- 기대: 전사 실패 메시지 표시
- 로그: `[Whisper] Transcription failed: ...`

**시나리오 2: 마이크 권한 거부**
- 기대: 녹음 시작 실패
- 로그: `[AudioCapture] Failed to start recording: ...`

---

## 📋 다음 단계 (Week 1 Day 3-4)

### Intent Parser 구현

1. **circuit/src/lib/voice/intentParser.ts** 생성
   - GPT-4 프롬프트 작성
   - 음성 → AgentTask[] 변환
   - 테스트 케이스 작성

2. **테스트 시나리오**:
```typescript
// 입력: "Victoria는 버그 고쳐줘"
// 출력: { agents: [{ name: 'Victoria', task: '버그 수정', ... }] }

// 입력: "버그 고치고 테스트 작성해줘"
// 출력: {
//   agents: [
//     { name: 'Victoria', task: '버그 수정', dependencies: [] },
//     { name: 'Alex', task: '테스트 작성', dependencies: [0] }
//   ]
// }
```

3. **ChatInput 통합**:
```typescript
const { finalTranscription } = inputState

const handleSend = async () => {
  // 음성 명령 파싱
  const parseResult = await parseVoiceCommand(finalTranscription)

  if (parseResult.isMultiAgent) {
    // 멀티 에이전트 실행
    await executeMultiAgentCommand(parseResult)
  } else {
    // 일반 메시지로 전송
    setValue(finalTranscription)
  }
}
```

---

## 🐛 알려진 이슈

### Issue 1: 실제 오디오 캡처 미구현
**현상**: `voice:start-recording`은 상태만 관리, 실제 마이크 캡처 없음

**해결**:
- 렌더러 프로세스에서 MediaRecorder API 사용
- `navigator.mediaDevices.getUserMedia()` 호출
- audioDataBase64를 `voice:stop-recording`에 전달

**수정 위치**: VoiceContext.tsx

```typescript
const startRecording = async () => {
  // MediaRecorder API로 실제 녹음
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mediaRecorder = new MediaRecorder(stream)

  mediaRecorder.ondataavailable = (e) => {
    chunks.push(e.data)
  }

  mediaRecorder.start()
  // ... IPC 호출
}

const stopRecording = async () => {
  mediaRecorder.stop()

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(chunks, { type: 'audio/webm' })
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // IPC로 전송
    await ipcRenderer.invoke('voice:stop-recording', base64)
  }
}
```

### Issue 2: TTS 미구현
**현상**: `voice:synthesize`가 stub

**해결**: Week 2 Day 8-9에 ElevenLabs 통합

---

## 📊 진행 상황

```
Week 1 Progress: ████████░░░░░░░░░░░░ 40%

✅ Day 1-2: 기본 인프라 (완료)
⬜ Day 3-4: Intent Parser
⬜ Day 5-7: Multi-Agent Orchestrator
⬜ Week 2: TTS + UI + 통합
```

---

## 💡 빠른 디버깅 팁

### VoiceContext 상태 확인
```typescript
const { inputState, feedbackState, multiAgentState } = useVoice()

console.log('Voice State:', {
  isRecording: inputState.isRecording,
  transcription: inputState.finalTranscription,
  confidence: inputState.confidence
})
```

### IPC 호출 테스트
```javascript
// Electron 개발자 도구 콘솔에서
const { ipcRenderer } = require('electron')

// 녹음 테스트
await ipcRenderer.invoke('voice:start-recording')
// ... 몇 초 대기 ...
const result = await ipcRenderer.invoke('voice:stop-recording', null)
console.log(result)
```

### Whisper API 직접 테스트
```bash
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: multipart/form-data" \
  -F file="@recording.webm" \
  -F model="whisper-1" \
  -F language="ko"
```

---

**다음**: Intent Parser 구현 시작!
