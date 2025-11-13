# Voice Features Integration Roadmap - Octave Codebase Analysis

## Quick Reference: Where Voice Features Would Go

### 1. Frontend Integration Points (React Components)

**ChatInput.tsx** - Primary Enhancement
- Add voice button next to file attachment button
- Location: Control bar at bottom of input
- State to add: `isRecording`, `recordingDuration`, `transcription`
- Handler pattern:
  ```typescript
  const handleStartRecording = async () => {
    setIsRecording(true)
    await ipcRenderer.invoke('audio:start-recording', { ... })
  }
  ```

**Settings Dialog** - Configuration
- Add voice settings section
- Options:
  - Input provider (Whisper, system speech-to-text)
  - Language selection
  - Microphone device selection
  - Output voice (text-to-speech if enabled)
  - Voice speed/pitch controls
  
**Message Structure** - Voice Metadata
- Store in message.metadata:
  ```typescript
  {
    audioUrl?: string  // Recording data URL
    transcription?: string  // Final transcription
    voiceOrigin?: 'user_input'
    duration?: number  // In seconds
    confidence?: number  // Transcription confidence
  }
  ```

### 2. Electron Main Process (main.cjs)

**New IPC Handlers Needed:**
```javascript
// Audio device management
ipcMain.handle('audio:list-devices', (event) => {
  // Return list of microphone/speaker devices
})

ipcMain.handle('audio:start-recording', (event, options) => {
  // Start recording audio from microphone
  // Returns recordingId
})

ipcMain.handle('audio:stop-recording', (event, recordingId) => {
  // Stop recording and return audio data
})

ipcMain.handle('audio:transcribe', (event, audioData, language) => {
  // Send to Whisper API or local speech-to-text
})

ipcMain.handle('audio:play', (event, audioUrl) => {
  // Play audio through speaker (for TTS responses)
})

// Audio settings
ipcMain.handle('audio:get-settings', (event) => {
  // Return current audio configuration
})

ipcMain.handle('audio:set-settings', (event, settings) => {
  // Persist audio settings
})
```

**Integration with Existing Pattern:**
- Follow same async/await pattern as `message:save`
- Use event broadcasting for streaming audio chunks
- Emit events for progress: `audio:recording-started`, `audio:transcribing`, `audio:transcribe-complete`

### 3. Settings & Configuration

**Extend OctaveSettings** (circuit/src/types/settings.ts):
```typescript
export interface OctaveSettings {
  // ... existing settings ...
  
  audio: {
    inputEnabled: boolean
    outputEnabled: boolean
    
    input: {
      provider: 'system' | 'whisper-api' | 'whisper-local'
      language: string  // 'en', 'es', etc.
      microphoneId?: string
      noiseReduction: boolean
      echoCancellation: boolean
    }
    
    output: {
      provider: 'system' | 'elevenlabs' | 'openai-tts'
      voiceId?: string
      speed: number  // 0.5 - 2.0
      pitch: number  // -20 to 20
    }
    
    privacy: {
      recordingsRetention: 'session' | 'day' | 'week' | 'never'
      analyticsEnabled: boolean
      cloudProcessingConsent: boolean
    }
  }
}
```

**Feature Flags** (circuit/src/config/features.ts):
```typescript
export const FEATURES = {
  // ... existing ...
  VOICE_INPUT: import.meta.env.VITE_FEATURE_VOICE_INPUT === 'true',
  VOICE_OUTPUT: import.meta.env.VITE_FEATURE_VOICE_OUTPUT === 'true',
  AUDIO_STREAMING: import.meta.env.VITE_FEATURE_AUDIO_STREAMING === 'true',
} as const
```

### 4. State Management Pattern

**Voice Context** (new: circuit/src/contexts/VoiceContext.tsx):
```typescript
interface VoiceContextType {
  // Recording state
  isRecording: boolean
  recordingDuration: number
  transcription: string | null
  
  // Playback state
  isPlaying: boolean
  playbackDuration: number
  
  // Device state
  availableDevices: AudioDevice[]
  selectedMicrophoneId: string
  selectedSpeakerId: string
  
  // Methods
  startRecording: () => Promise<void>
  stopRecording: () => Promise<{ audio: ArrayBuffer, transcription: string }>
  playAudio: (audioUrl: string) => Promise<void>
  listDevices: () => Promise<AudioDevice[]>
}

export const VoiceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Implementation mirrors SettingsProvider pattern
}

export const useVoice = () => useContext(VoiceContext)
```

### 5. Message Flow with Voice

**Voice Input Flow:**
```
User clicks voice button
  ↓
handleStartRecording() {
  setIsRecording(true)
  await ipcRenderer.invoke('audio:start-recording')
  // Show recording UI (waveform, duration)
}
  ↓
User clicks stop
  ↓
handleStopRecording() {
  const { audio, transcription } = await ipcRenderer.invoke('audio:stop-recording')
  setTranscription(transcription)
  // Optionally: Auto-populate input with transcription
  // Or: Create draft message with transcription + audio
}
  ↓
User confirms message
  ↓
Create Message with:
  - content: transcription
  - metadata.audioUrl: data URL of recording
  - metadata.voiceOrigin: 'user_input'
  ↓
Send to Claude with both text and audio context
```

**Voice Output Flow (if TTS enabled):**
```
Claude response received
  ↓
If VOICE_OUTPUT feature enabled:
  1. Extract response text
  2. await ipcRenderer.invoke('audio:synthesize', { text, voice, speed })
  3. Receive audioUrl in response
  ↓
Show play button in message
  ↓
User clicks play
  ↓
await ipcRenderer.invoke('audio:play', audioUrl)
  ↓
Audio plays through speakers
```

### 6. UI/UX Considerations

**Voice Button Location:**
```
┌─ ChatInput ─────────────────────────────────────┐
│                                                  │
│ [Text Input Area                            ]   │
│                                                  │
│ Control Bar:                                     │
│ [Attach] [Model] [Thinking] [Plan] [Voice] ► │
│                   Left side            Right    │
└──────────────────────────────────────────────────┘
```

**Recording UI:**
```
During Recording:
  Recording: 0:03
  [🎤] Stop | [Cancel]
  [Waveform visualization]

With Transcription:
  "what is the meaning of life"
  [Confidence: 95%]
  [Edit] [Use] [Discard]
```

**Settings Panel:**
```
Audio Settings
├── Input Settings
│   ├── Enable voice input (toggle)
│   ├── Provider: Whisper API
│   ├── Language: English
│   ├── Microphone: Built-in Microphone
│   └── Advanced:
│       ├── Noise reduction
│       └── Echo cancellation
├── Output Settings (if TTS enabled)
│   ├── Provider: OpenAI TTS
│   ├── Voice: Alloy
│   ├── Speed: [====●====]
│   └── Speaker: Built-in Speaker
└── Privacy
    ├── Keep recordings for: This session only
    └── Analytics: Off
```

### 7. Keyboard Shortcuts

Add to existing shortcut system:
```typescript
// circuit/src/hooks/useKeyboardShortcuts.ts

// Voice shortcuts
if (e.key === 'v' && e.metaKey && !input) {
  // Start recording (when not typing)
  handleStartRecording()
}

if (e.key === 'Escape' && isRecording) {
  // Cancel recording
  handleStopRecording(true) // discard
}
```

### 8. Error Handling

Following existing patterns:
```typescript
try {
  const result = await ipcRenderer.invoke('audio:start-recording')
  if (!result.success) {
    toast.error(`Failed to start recording: ${result.error}`)
    return
  }
  // Continue
} catch (error) {
  console.error('[VoiceInput] Recording error:', error)
  toast.error('Microphone access denied or unavailable')
}
```

### 9. Testing Strategy

**Unit Tests:**
- Voice state management
- Transcription formatting
- Audio metadata attachment

**Integration Tests:**
- Recording → Transcription → Message creation
- Message save with audio metadata
- Settings persistence for audio options

**E2E Tests:**
- Full voice message workflow
- Microphone permission handling
- Audio playback in messages

### 10. Migration Checklist

To add voice features:

- [ ] Create `/circuit/src/contexts/VoiceContext.tsx`
- [ ] Extend `OctaveSettings` with audio config
- [ ] Add feature flags to `features.ts`
- [ ] Update `ChatInput.tsx` with voice button
- [ ] Create `VoiceButton` component
- [ ] Create audio IPC handlers in `main.cjs`
- [ ] Add settings UI in `SettingsDialog.tsx`
- [ ] Extend `Message` metadata types
- [ ] Create audio playback in message renderer
- [ ] Add keyboard shortcuts
- [ ] Set up error handling/toast notifications
- [ ] Write tests for voice flows
- [ ] Add documentation to .env.example

---

## Implementation Priority

### Phase 1: Foundation (Low Risk)
- Settings types and UI
- Feature flags
- IPC handler stubs
- Voice button UI (disabled)

### Phase 2: Recording (Medium Risk)
- Microphone access
- Audio recording
- Visual feedback (waveform, duration)
- Stop/cancel functionality

### Phase 3: Transcription (Medium Risk)
- Whisper API integration
- Transcription display
- Edit/confirm transcription
- Message creation with audio metadata

### Phase 4: Playback (Low Risk)
- Text-to-speech integration
- Audio playback in messages
- Voice settings for TTS

### Phase 5: Polish (Low Risk)
- Keyboard shortcuts
- Analytics
- Privacy settings
- Recording cleanup

---

## Key Architecture Advantages

1. **Existing IPC Pattern**: All audio operations follow established message/invoke patterns
2. **Feature Flags**: Can develop voice features independently, toggle on/off easily
3. **Settings Infrastructure**: Already have pattern for storing voice preferences
4. **Message System**: Existing metadata system accommodates audio attachment seamlessly
5. **Context Providers**: Can create VoiceContext following SettingsContext pattern
6. **Error Handling**: Established try/catch + toast notification pattern

---

## Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| Microphone access denial | Request permissions gracefully, show helpful UI |
| Large audio files | Stream to API, compress before storing |
| Transcription latency | Show loading state, allow user to continue typing |
| Privacy concerns | Clear settings, data retention policies, local options |
| Cross-platform audio | Use Electron's native audio APIs where possible |
| Memory leaks in recording | Proper cleanup in useEffect, abort signals |

---

## Related Files to Review

For implementation:
- `/circuit/src/components/workspace/ChatInput.tsx` - Input component pattern
- `/circuit/src/contexts/SettingsContext.tsx` - Settings pattern
- `/circuit/src/config/features.ts` - Feature flag pattern
- `/circuit/electron/main.cjs` - IPC handler pattern
- `/circuit/src/components/SettingsDialog.tsx` - Settings UI pattern
- `/circuit/src/types/conversation.ts` - Message metadata structure

