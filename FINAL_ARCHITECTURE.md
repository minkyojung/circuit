# Octave Test-Fix Loop: Final Architecture

> **최종 결정:** 단순하고 명확한 방식 채택 (하이브리드 제거)
>
> **철학:** Conductor.build의 단순함 + 바이브코더 친화적 UX

---

## 🎯 Core Decisions

### **1. 디렉토리 구조: Local Only**

```
/project/.circuit/              # 프로젝트별로만 존재
├── strategies/
│   └── react.md               # 테스트 전략
├── hooks/
│   ├── on-test-fail.md        # 실패 시 동작
│   └── on-success.md          # 성공 시 동작
├── mcps/
│   ├── test-runner.json       # 테스트 실행 설정
│   └── ai-provider.json       # API 설정 (gitignore)
├── history/                   # Fix 히스토리 (gitignore)
│   └── 2025-10-21.json
└── circuit.config.md          # 프로젝트 설정
```

**Global 설정 없음** (Conductor.build 방식)

**API 키 관리:**
- OS Keychain에 저장 (파일 아님)
- macOS: Keychain
- Windows: Credential Manager
- Linux: Secret Service
- 모든 프로젝트에서 재사용

**`.gitignore`:**
```
.circuit/mcps/ai-provider.json   # API 설정 (있다면)
.circuit/history/                # 개인 히스토리
```

**팀과 공유:**
```
.circuit/strategies/             # ✅ Git 포함
.circuit/hooks/                  # ✅ Git 포함
.circuit/circuit.config.md       # ✅ Git 포함
```

---

### **2. Auto-detect: Smart Default**

**확신도 기반 자동화:**

```typescript
const result = autoDetect()

if (result.confidence >= 0.9) {
  // 90% 이상: 자동 사용 (확인 안 함)
  useStrategy(result.strategy)
  showNotification(`✅ ${result.name} 전략 활성화`)

} else if (result.confidence >= 0.5) {
  // 50-90%: 간단 확인
  const confirmed = await ask(`${result.name} 맞나요? [Y/n]`)
  if (confirmed) useStrategy(result.strategy)

} else {
  // 50% 미만: 선택 UI
  const chosen = await showStrategyPicker()
  useStrategy(chosen)
}
```

**Detection Rules:**

```typescript
const detectors = [
  {
    name: 'Next.js',
    priority: 10,
    files: ['next.config.js', 'next.config.ts'],
    deps: ['next'],
    confidence: 0.95
  },
  {
    name: 'React',
    priority: 8,
    deps: ['react'],
    excludeDeps: ['next'],  // Next.js 아닌 경우만
    confidence: 0.90
  },
  {
    name: 'Node API',
    priority: 5,
    files: ['package.json'],
    deps: ['express', 'fastify', 'koa'],
    excludeDeps: ['react'],
    confidence: 0.85
  }
]
```

**사용자 경험:**

```bash
# Case 1: 명확한 프로젝트 (80%)
$ circuit init
  ✅ Next.js 전략 자동 활성화
  (아무것도 안 물어봄)

# Case 2: 애매한 프로젝트 (15%)
$ circuit init
  React + TypeScript 감지됨
  이대로 진행할까요? [Y/n]
  → Enter
  ✅ 활성화

# Case 3: 모르는 프로젝트 (5%)
$ circuit init
  프로젝트 타입 선택:
  [1] React
  [2] Next.js
  [3] Node API
  [4] Custom
  → 1
  ✅ React 전략 활성화
```

---

### **3. AI Provider: 우선순위 시스템**

**API 키 찾기 순서:**

```typescript
async function getAIProvider(): Promise<AIProvider> {
  // 1순위: Claude Code 설정 (재사용)
  const claudeKey = await tryReadClaudeCodeConfig()
  if (claudeKey) {
    console.log('✅ Claude Code API 키 재사용')
    return new AnthropicProvider(claudeKey)
  }

  // 2순위: OS Keychain
  const keychainKey = await keychain.getPassword('circuit', 'anthropic-api')
  if (keychainKey) {
    console.log('✅ 저장된 API 키 사용')
    return new AnthropicProvider(keychainKey)
  }

  // 3순위: 사용자 입력 요청
  const userKey = await promptAPIKey()
  await keychain.setPassword('circuit', 'anthropic-api', userKey)
  return new AnthropicProvider(userKey)
}
```

**Claude Code 설정 읽기:**

```typescript
// ~/.claude/settings.json 또는 config.json
async function tryReadClaudeCodeConfig(): Promise<string | null> {
  const possiblePaths = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude', 'config.json'),
    path.join(os.homedir(), '.config', 'claude', 'settings.json'),
  ]

  for (const configPath of possiblePaths) {
    try {
      const config = JSON.parse(await fs.readFile(configPath, 'utf-8'))
      if (config.apiKey || config.anthropic?.apiKey) {
        return config.apiKey || config.anthropic.apiKey
      }
    } catch {
      continue
    }
  }

  return null
}
```

**사용자 경험:**

```bash
# Case 1: Claude Code 사용자 (50%)
$ circuit init
  🔍 Claude Code API 키 발견 (sk-ant-***abc)
  재사용할까요? [Y/n]
  → Enter
  ✅ 완료

# Case 2: 처음 사용 (50%)
$ circuit init
  Anthropic API 키 입력:
  → sk-ant-___________
  ✅ OS Keychain에 안전 저장
  (모든 프로젝트 재사용됨)
```

**중요: 우리는 중간에 안 끼임**
```
User API Key → Anthropic API (직접 호출)
              (Octave은 키만 찾아줌)
```

---

## 🔄 Test-Fix Loop Workflow

### **전체 흐름**

```
1. File Change Detected
   ↓
2. Run Tests (debounce 500ms)
   - Type check
   - Unit tests
   - Lint
   ↓
3. Test Failed?
   No → ✅ Done
   Yes → Continue
   ↓
4. Extract Context
   - Error message & stack
   - File content
   - Related imports
   - Git blame
   - Recent commits
   ↓
5. AI: Generate Suggestion (NOT auto-fix)
   {
     "changes": [...],
     "explanation": "...",
     "confidence": 0.95
   }
   ↓
6. Show Suggestion in Desktop App
   ┌────────────────────────────┐
   │ 💡 Fix Suggestion          │
   │ Button.tsx:23              │
   │ -  props.onClick()         │
   │ +  props.onClick?.()       │
   │                            │
   │ Confidence: 95%            │
   │ [Apply] [Edit] [Reject]    │
   └────────────────────────────┘
   ↓
7. User Decision
   A) Apply → Step 8
   B) Edit → Modify → Step 8
   C) Reject → Step 9
   ↓
8. Apply & Re-test
   Success? → Step 9
   Fail? → Step 5 (max 5 iterations)
   ↓
9. Save Result to History
   .circuit/history/2025-10-21.json
```

---

## 📁 File Formats

### **Strategy File: `.circuit/strategies/react.md`**

```markdown
# React Test-Fix Strategy

## Auto-Run Conditions
- File patterns: `src/**/*.{ts,tsx}`
- Ignore: `**/*.test.ts`, `**/*.stories.tsx`
- Debounce: 500ms

## Test Commands
1. **Type Check**
   ```bash
   npm run type-check
   ```

2. **Unit Tests**
   ```bash
   npm run test -- --passWithNoTests
   ```

3. **Lint**
   ```bash
   npm run lint -- --max-warnings 0
   ```

## AI Prompt Template
```
File: {file_path}
Error: {error_message}
Stack: {stack_trace}

Related files:
{related_imports}

Recent changes:
{git_diff}

Suggest a fix with:
- Exact code changes
- Clear explanation
- Confidence score
```

## Success Criteria
- All tests pass
- No type errors
- No lint errors

## Max Iterations
5
```

---

### **Config File: `.circuit/circuit.config.md`**

```markdown
# Octave Configuration

## Project Info
- Name: My React App
- Type: react
- Strategy: react.md
- Auto-detected: true
- Confirmed: 2025-10-21

## Settings
- Auto mode: true
- Notifications: true
- Max iterations: 5
- Debounce: 500ms

## Test Commands
Override if needed:
- Type check: `tsc --noEmit`
- Tests: `vitest run`
- Lint: `eslint src/`
```

---

### **History File: `.circuit/history/2025-10-21.json`**

```json
{
  "date": "2025-10-21",
  "fixes": [
    {
      "id": "fix-001",
      "timestamp": "2025-10-21T14:32:15Z",
      "trigger": "file_change",
      "file": "src/components/Button.tsx",

      "error": {
        "type": "TypeError",
        "message": "Cannot read property 'onClick' of undefined",
        "line": 23,
        "stack": "..."
      },

      "ai_suggestion": {
        "model": "claude-sonnet-4-5",
        "changes": [
          {
            "line": 23,
            "old": "props.onClick()",
            "new": "props.onClick?.()"
          }
        ],
        "explanation": "Use optional chaining for optional prop",
        "confidence": 0.95
      },

      "user_decision": {
        "action": "approved",
        "timestamp": "2025-10-21T14:32:18Z",
        "edited": false
      },

      "outcome": {
        "status": "success",
        "tests_passed": true,
        "time_taken_seconds": 3.2,
        "attempts": 1
      }
    }
  ],

  "summary": {
    "total": 5,
    "successful": 4,
    "failed": 1,
    "approval_rate": 0.8,
    "avg_time_seconds": 4.5
  }
}
```

---

## 🖥️ Desktop App UI

### **New Tab: Test-Fix**

```
Octave Desktop App
├── Sidebar
│   ├── Developer (기존)
│   └── Test-Fix ⭐ (신규)
│
└── Main Area
    ├── Active Tests (실시간 진행)
    ├── Suggestions (승인 대기)
    └── History (과거 기록)
```

---

### **Active Tests Panel**

```
┌─────────────────────────────────────────────┐
│ 🧪 Active Tests                             │
├─────────────────────────────────────────────┤
│                                             │
│ Testing Button.tsx...                       │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━ 100%            │
│                                             │
│ ✓ Type check (0.3s)                         │
│ ✗ Unit tests (1.2s) - 1 failed              │
│ ⏳ Generating fix suggestion...             │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **Suggestions Panel**

```
┌─────────────────────────────────────────────┐
│ 💡 Fix Suggestions (2)                      │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Button.tsx:23                           │ │
│ │ TypeError: Cannot read 'onClick'        │ │
│ │                                         │ │
│ │ Suggested Fix:                          │ │
│ │ -  props.onClick()                      │ │
│ │ +  props.onClick?.()                    │ │
│ │                                         │ │
│ │ Reason: Optional chaining for safety   │ │
│ │ Confidence: 95%                         │ │
│ │ Similar fixes: 3 times                  │ │
│ │                                         │ │
│ │ [Apply] [Edit] [Reject]                 │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Header.tsx:45                           │ │
│ │ Type error: string | undefined          │ │
│ │ ...                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```

---

### **History Panel**

```
┌─────────────────────────────────────────────┐
│ 📊 History                                  │
├─────────────────────────────────────────────┤
│                                             │
│ Today (5 fixes, 80% success)                │
│                                             │
│ ✅ Button.tsx:23       14:32  3.2s  (1×)   │
│ ✅ Header.tsx:45       14:15  8.7s  (3×)   │
│ ❌ api/users.ts:67     10:02  25s   (5×)   │
│ ✅ Footer.tsx:12       09:45  2.1s  (1×)   │
│ ✅ Nav.tsx:89          09:30  4.5s  (2×)   │
│                                             │
│ This Week                                   │
│ ┌─────────────────────────────────────────┐ │
│ │ Total: 23 fixes                         │ │
│ │ Success: 19 (83%)                       │ │
│ │ Avg time: 5.2s                          │ │
│ │                                         │ │
│ │ Top errors:                             │ │
│ │ 1. Optional chaining (8)                │ │
│ │ 2. Type mismatch (5)                    │ │
│ │ 3. Null check (4)                       │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [View All] [Export] [Clear Old]             │
└─────────────────────────────────────────────┘
```

---

## 🚀 Implementation Plan

### **Phase 1: Core Infrastructure (Week 1)**

**Day 1-2: Project Setup**
- [ ] Directory structure (`.circuit/`)
- [ ] Config file parsing (`circuit.config.md`)
- [ ] Strategy file parsing (`strategies/*.md`)

**Day 3-4: Detection & Initialization**
- [ ] Auto-detect logic (confidence-based)
- [ ] `circuit init` command
- [ ] Template system (React, Next.js, Node)

**Day 5-7: File Watching & Test Running**
- [ ] File watcher (500ms debounce)
- [ ] Test runner integration (npm, vitest, jest)
- [ ] Error extraction & parsing

---

### **Phase 2: AI Integration (Week 2)**

**Day 1-2: API Provider**
- [ ] Claude Code config reader
- [ ] OS Keychain integration
- [ ] API key priority system

**Day 3-4: Suggestion Generation**
- [ ] Context extraction (file, error, git)
- [ ] AI prompt construction
- [ ] Suggestion parsing

**Day 5-7: Loop Logic**
- [ ] Iteration management (max 5)
- [ ] Context expansion (retry logic)
- [ ] Success/failure detection

---

### **Phase 3: Desktop UI (Week 3)**

**Day 1-2: Tab & Layout**
- [ ] New "Test-Fix" tab in sidebar
- [ ] Main area layout (Active, Suggestions, History)

**Day 3-4: Suggestion UI**
- [ ] Suggestion card component
- [ ] Code diff display
- [ ] Apply/Edit/Reject buttons

**Day 5-7: History UI**
- [ ] History list component
- [ ] Detail view modal
- [ ] Export functionality

---

### **Phase 4: Polish (Week 4)**

**Day 1-2: Notifications**
- [ ] Desktop notifications (macOS/Windows)
- [ ] In-app toast messages
- [ ] Status bar indicator

**Day 3-4: Learning**
- [ ] Pattern detection
- [ ] Similar fix suggestions
- [ ] Statistics & insights

**Day 5-7: Testing & Docs**
- [ ] E2E tests
- [ ] User documentation
- [ ] Video tutorial

---

## 📊 Success Metrics

### **User Metrics**
- Setup time: < 2 minutes (auto-detect + API key)
- First fix: < 5 minutes from install
- Approval rate: > 70% (suggestions accepted)
- Time saved: 80%+ (30min → 5min per feature)

### **Technical Metrics**
- Detection accuracy: > 90%
- Suggestion confidence: > 85% average
- Fix success rate: > 75% (1st attempt)
- Performance: < 500ms UI response

---

## 🔒 Security & Privacy

### **API Key Storage**
- ✅ OS Keychain (encrypted)
- ❌ Plain text files
- ❌ Git commits

### **Data Privacy**
- History: Local only (`.circuit/history/`)
- No telemetry by default
- Opt-in analytics (future)

### **Code Safety**
- All changes require user approval
- No auto-commit
- Full diff preview before apply

---

## 🎯 Future Enhancements

### **Phase 5+: Advanced Features**

1. **Multi-file fixes**
   - Detect changes affecting multiple files
   - Suggest coordinated fixes

2. **Learning & Patterns**
   - Project-specific pattern library
   - Team-shared patterns

3. **Integration**
   - GitHub Actions integration
   - Pre-commit hooks
   - CI/CD pipeline

4. **Pro Features**
   - Octave-hosted API (no key needed)
   - Team collaboration
   - Advanced analytics

---

_Last Updated: 2025-10-21_
_Status: Final Architecture - Ready for Implementation_
