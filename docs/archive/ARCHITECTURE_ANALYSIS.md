# Circuit Test-Fix Loop: 상세 아키텍처 분석

## 📍 1. 디렉토리 위치 분석

### **Option A: 프로젝트 루트만 (`/project/.circuit/`)**

**장점:**
- Git으로 팀과 공유 가능
- 프로젝트별 전략 명확
- Monorepo에서 각 패키지별 설정

**단점:**
- 새 프로젝트마다 설정 반복
- 개인 선호도 저장 불가

---

### **Option B: 홈 디렉토리만 (`~/.circuit/`)**

**장점:**
- 모든 프로젝트 공통 설정
- 한 번만 설정

**단점:**
- 팀과 공유 불가
- 프로젝트별 커스터마이징 어려움

---

### **⭐ 추천: Hybrid (우선순위 시스템)**

```
~/.circuit/                    # Global (낮은 우선순위)
├── strategies/
│   ├── default.md            # 기본 전략
│   ├── react.md
│   └── node-api.md
├── mcps/
│   ├── test-runner.json      # 전역 MCP 설정
│   └── ai-provider.json      # API 키 등
└── preferences.json          # 개인 선호도

/project/.circuit/             # Local (높은 우선순위)
├── strategies/
│   └── custom.md             # 이 프로젝트만의 전략 (override)
├── history/                  # 이 프로젝트 fix 히스토리
│   └── 2025-10-21.json
└── circuit.config.md         # 프로젝트 설정
```

**동작 방식:**
1. Circuit 시작 → `~/.circuit/` 로드 (global defaults)
2. 프로젝트 감지 → `/project/.circuit/` 로드 (local overrides)
3. Local이 Global보다 우선
4. 없으면 Global 사용

**팀 협업:**
```gitignore
# .gitignore
.circuit/mcps/ai-provider.json  # API 키는 개인 비밀
.circuit/preferences.json        # 개인 선호도

# .circuit/strategies/ 는 git에 포함 (팀과 공유)
```

---

## 🎯 2. Auto-detect vs 명시적 선택

### **비교표**

| 특성 | Auto-detect | 명시적 선택 | Hybrid ⭐ |
|------|-------------|-------------|----------|
| **초기 설정** | 불필요 | 필수 | 확인만 |
| **정확도** | 85-90% | 100% | 95%+ |
| **복합 프로젝트** | 혼란 가능 | 명확 | 확인 후 결정 |
| **사용 편의성** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **팀 협업** | 불일치 가능 | 일관성 보장 | 일관성 보장 |

---

### **Auto-detect 로직 (예시)**

```typescript
// Project detection rules
const detectors = [
  {
    name: 'nextjs',
    priority: 1, // 높을수록 먼저 체크
    detect: () =>
      hasFile('next.config.js') ||
      hasFile('next.config.ts') ||
      hasDependency('next'),
    strategy: 'nextjs.md'
  },
  {
    name: 'react',
    priority: 2,
    detect: () =>
      hasDependency('react') &&
      !hasDependency('next'), // Next.js 아닌 경우만
    strategy: 'react.md'
  },
  {
    name: 'node-api',
    priority: 3,
    detect: () =>
      hasFile('package.json') &&
      !hasDependency('react') &&
      (hasDependency('express') || hasDependency('fastify')),
    strategy: 'node-api.md'
  },
  {
    name: 'python-fastapi',
    priority: 1,
    detect: () =>
      hasFile('pyproject.toml') &&
      hasDependency('fastapi', 'pyproject.toml'),
    strategy: 'python-fastapi.md'
  }
]
```

**문제 케이스:**
- Monorepo: 여러 프로젝트 타입 혼재
- Micro-frontend: React + Next.js 공존
- Full-stack: Frontend (React) + Backend (Node) 같은 repo

---

### **⭐ 추천: Hybrid (Smart Detection + Confirmation)**

```
1. Circuit 시작
   ↓
2. Auto-detect 실행
   → 결과: "Next.js + TypeScript"
   ↓
3. 첫 실행 시 확인 요청:

   ┌──────────────────────────────────┐
   │ 프로젝트 타입 감지               │
   ├──────────────────────────────────┤
   │ ✓ Next.js 14                     │
   │ ✓ TypeScript                     │
   │ ✓ Tailwind CSS                   │
   │                                  │
   │ 전략: nextjs.md 사용             │
   │                                  │
   │ [확인] [수정] [자세히]           │
   └──────────────────────────────────┘

4. 사용자 선택:
   - [확인] → .circuit/circuit.config.md 생성
     ```markdown
     # Circuit Config
     strategy: nextjs
     auto_detected: true
     confirmed_at: 2025-10-21
     ```

   - [수정] → 전략 선택 UI 표시

   - [자세히] → 감지 근거 표시
     "✓ next.config.ts 발견
      ✓ package.json: next@14.0.0
      ✓ app/ 디렉토리 구조"

5. 이후 실행:
   → .circuit/circuit.config.md 있으면 재확인 안 함
   → 단, package.json 변경 감지 시 재확인 제안
```

**장점:**
- 첫 사용자: 즉시 시작 (한 번만 확인)
- 정확성: 사용자가 최종 승인
- 팀: config.md를 git에 커밋 → 일관성

---

## 🤖 3. AI 모델 - Claude Code 재사용 가능성

### **Claude Code 구조 조사 필요사항**

1. **Claude Code API 키 저장 위치?**
   - `~/.claude/config.json`?
   - `~/.config/claude/credentials`?
   - Keychain/Credential Manager?

2. **Claude Code의 아키텍처?**
   - CLI tool?
   - Language Server (LSP)?
   - IPC 서버?
   - VS Code Extension만?

3. **통신 방법?**
   - HTTP API?
   - stdio?
   - IPC socket?

---

### **시나리오별 분석**

#### **Scenario A: Claude Code가 설정 파일에 API 키 저장**

```json
// ~/.claude/config.json (가정)
{
  "apiKey": "sk-ant-...",
  "model": "claude-sonnet-4-5",
  "endpoint": "https://api.anthropic.com"
}
```

**Circuit 구현:**
```typescript
// Circuit이 Claude Code 설정 읽기
import { readFileSync } from 'fs'
import { homedir } from 'os'

function getClaudeAPIKey() {
  const configPath = `${homedir()}/.claude/config.json`

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    return config.apiKey
  } catch (error) {
    // Fallback: Circuit 자체 설정
    return getCircuitAPIKey()
  }
}
```

**장점:**
- 사용자가 API 키 재입력 불필요
- 동일한 모델/설정 사용

**단점:**
- Claude Code 설정 위치가 변경되면 깨짐
- Security: 다른 앱이 API 키 읽기 (일반적으로 file permission으로 보호되긴 함)

---

#### **Scenario B: Claude Code가 IPC 서버 제공**

```typescript
// Claude Code가 이런 API 제공한다면 (가정)
// ~/.claude/ipc.sock 또는 http://localhost:7777

// Circuit에서 사용
const response = await fetch('http://localhost:7777/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Fix this error: ...' }
    ]
  })
})
```

**장점:**
- API 키 공유 불필요
- Claude Code 버전 업데이트 시 자동 반영
- Usage quota도 Claude Code와 공유

**단점:**
- Claude Code가 실행 중이어야 함
- IPC API를 제공하지 않으면 불가능

---

#### **Scenario C: Circuit 자체 API 키 설정 (Fallback)**

```markdown
<!-- ~/.circuit/mcps/ai-provider.json -->
{
  "providers": [
    {
      "name": "claude-code-shared",
      "type": "anthropic",
      "config_path": "~/.claude/config.json",  // 먼저 시도
      "priority": 1
    },
    {
      "name": "circuit-own",
      "type": "anthropic",
      "api_key": "sk-ant-...",  // Fallback
      "priority": 2
    },
    {
      "name": "openai",
      "type": "openai",
      "api_key": "sk-...",
      "priority": 3
    }
  ]
}
```

**동작:**
1. Claude Code 설정 찾기 시도
2. 없으면 Circuit 자체 API 키 사용
3. 그것도 없으면 사용자에게 설정 요청

---

### **⭐ 추천: A + C 조합**

```typescript
// ai-provider.ts
export async function getAIProvider(): Promise<AIProvider> {
  // 1. Claude Code 설정 시도
  const claudeCodeKey = tryReadClaudeCodeConfig()
  if (claudeCodeKey) {
    return new AnthropicProvider(claudeCodeKey, 'claude-sonnet-4-5')
  }

  // 2. Circuit 자체 설정 시도
  const circuitKey = tryReadCircuitConfig()
  if (circuitKey) {
    return new AnthropicProvider(circuitKey, 'claude-sonnet-4-5')
  }

  // 3. 사용자에게 설정 요청
  throw new Error('AI provider not configured. Please set up API key.')
}
```

**UI Flow:**
```
Circuit 첫 실행
↓
AI Provider 감지 시도
↓
Claude Code 설정 발견?
  Yes → "Claude Code 설정 사용 (API 키: sk-ant-***abc)"
        [확인] → 완료

  No → "API 키 설정 필요"
       Option 1: [Claude Code와 연동]
       Option 2: [Circuit에 직접 설정]
       Option 3: [나중에 하기]
```

**비용 측면:**
- Claude Code API 키 재사용 → Circuit 사용료 없음 (사용자 부담)
- 또는 Circuit Pro 플랜: Circuit이 제공하는 API 사용 (Circuit 비용 부담, 단순한 UX)

---

## 🖥️ 4. Desktop App 구조

### **현재 상황**
- Circuit은 이미 Electron 기반
- Sidebar + Main content 구조 존재

### **Test-Fix Loop UI 통합**

```
Circuit Desktop App
├── Sidebar (기존)
│   ├── Developer Tab
│   └── [새로 추가] Test-Fix Tab ⭐
│
└── Main Area
    └── Test-Fix Dashboard
        ├── Active Tests (실시간)
        ├── Fix Suggestions (승인 대기)
        └── History (과거 기록)
```

---

### **Test-Fix Tab UI 설계**

```
┌─────────────────────────────────────────────────┐
│ Test-Fix Loop                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🟢 Active                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🧪 Testing Button.tsx...                    │ │
│ │ ━━━━━━━━━━━━━━━━━━━━━━ 100%               │ │
│ │ ✓ Type check (0.3s)                         │ │
│ │ ✗ Unit tests (1.2s) - 1 failed              │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💡 Fix Suggestions (2)                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ Button.tsx:23                               │ │
│ │ TypeError: Cannot read 'onClick'            │ │
│ │                                             │ │
│ │ AI Suggestion:                              │ │
│ │ -  props.onClick()                          │ │
│ │ +  props.onClick?.()                        │ │
│ │                                             │ │
│ │ Confidence: 95% • Similar fix: 3 times      │ │
│ │ [Apply] [Edit] [Reject]                     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 📊 History (Today: 5 fixes, 4 successful)       │
│ ┌─────────────────────────────────────────────┐ │
│ │ ✅ Header.tsx      10:23 AM  (1 attempt)    │ │
│ │ ✅ Button.tsx      10:15 AM  (2 attempts)   │ │
│ │ ❌ api/users.ts    10:02 AM  (manual fix)   │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [⚙️ Settings] [📁 View Strategies]              │
└─────────────────────────────────────────────────┘
```

---

### **CLI Integration (Optional)**

Desktop app이 주이지만, CLI도 제공 가능:

```bash
# CLI가 Desktop app에 IPC 요청
$ circuit test-fix
→ Desktop app 열림 + Test-Fix 탭 활성화

# 또는 headless mode
$ circuit test-fix --headless
→ 터미널에서 진행 상황 표시
```

---

## 🎯 5. Hook → Action → AI 제안 → 결과 저장 구조

### **기존 아이디어 vs 새 요구사항**

| 단계 | 기존 (자동 수정) | 새로운 (제안 기반) ⭐ |
|------|-----------------|---------------------|
| 1. Trigger | File change | File change |
| 2. Test | Run tests | Run tests |
| 3. Fail | Extract error | Extract error |
| 4. AI | Generate fix | **Generate suggestion** |
| 5. Apply | **Auto-apply** | **User approval** |
| 6. Re-test | Auto re-test | Re-test after approval |
| 7. Result | Log success/fail | **Save suggestion + decision** |

---

### **새로운 워크플로우 (상세)**

```
┌─────────────────────────────────────────┐
│ 1. Hook Trigger                         │
│    - File change detected               │
│    - Debounce: 500ms                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 2. Action: Run Tests                    │
│    - Type check                         │
│    - Unit tests                         │
│    - Lint                               │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 3. Test Failed?                         │
│    Yes → Extract Context                │
│    No → Done ✅                          │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 4. Extract Context                      │
│    - Error message & stack trace        │
│    - File content                       │
│    - Related imports                    │
│    - Git blame                          │
│    - Recent commits                     │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 5. AI: Generate Suggestion (NOT FIX)    │
│    Input:                               │
│    {                                    │
│      "error": "...",                    │
│      "context": {...},                  │
│      "task": "suggest_fix"  ⭐          │
│    }                                    │
│                                         │
│    Output:                              │
│    {                                    │
│      "suggestion": {                    │
│        "file": "Button.tsx",            │
│        "changes": [                     │
│          {                              │
│            "line": 23,                  │
│            "old": "props.onClick()",    │
│            "new": "props.onClick?.()"   │
│          }                              │
│        ],                               │
│        "explanation": "...",            │
│        "confidence": 0.95,              │
│        "similar_fixes": 3               │
│      }                                  │
│    }                                    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 6. Show Suggestion to User              │
│    ┌─────────────────────────────────┐  │
│    │ 💡 Fix Suggestion               │  │
│    │                                 │  │
│    │ Button.tsx:23                   │  │
│    │ -  props.onClick()              │  │
│    │ +  props.onClick?.()            │  │
│    │                                 │  │
│    │ Reason: Optional prop check     │  │
│    │ Confidence: 95%                 │  │
│    │                                 │  │
│    │ [Apply] [Edit] [Reject]         │  │
│    └─────────────────────────────────┘  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 7. User Decision                        │
│    A) Apply → Go to step 8              │
│    B) Edit → Modify → Go to step 8      │
│    C) Reject → Go to step 9 (log only)  │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 8. Apply Fix & Re-test                  │
│    - Apply changes to file              │
│    - Run tests again                    │
│    - Success? → Step 9                  │
│    - Fail? → Step 5 (retry, max 5x)    │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│ 9. Save Result                          │
│    {                                    │
│      "id": "fix-001",                   │
│      "timestamp": "2025-10-21 14:32",   │
│      "file": "Button.tsx",              │
│      "error": {                         │
│        "message": "...",                │
│        "line": 23                       │
│      },                                 │
│      "suggestion": {                    │
│        "old": "...",                    │
│        "new": "...",                    │
│        "confidence": 0.95               │
│      },                                 │
│      "user_action": "approved",  ⭐     │
│      "outcome": "success",       ⭐     │
│      "tests_passed": true,              │
│      "time_taken": "3.2s",              │
│      "attempts": 1                      │
│    }                                    │
│                                         │
│    Saved to:                            │
│    .circuit/history/2025-10-21.json     │
└─────────────────────────────────────────┘
```

---

### **데이터 구조 (Result Storage)**

```json
// .circuit/history/2025-10-21.json
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
        "column": 5,
        "stack": "..."
      },

      "context": {
        "related_files": ["Button.test.tsx", "types/button.ts"],
        "git_blame": {
          "author": "William",
          "commit": "abc123",
          "time": "2 minutes ago"
        }
      },

      "ai_suggestion": {
        "model": "claude-sonnet-4-5",
        "changes": [
          {
            "line": 23,
            "old_code": "props.onClick()",
            "new_code": "props.onClick?.()",
            "diff": "@@ -23,1 +23,1 @@\n- props.onClick()\n+ props.onClick?.()"
          }
        ],
        "explanation": "The onClick prop is optional but not checked before calling. Use optional chaining to prevent runtime errors.",
        "confidence": 0.95,
        "similar_fixes": [
          {
            "file": "Header.tsx",
            "date": "2025-10-19",
            "success": true
          }
        ]
      },

      "user_decision": {
        "action": "approved",  // "approved" | "rejected" | "edited"
        "timestamp": "2025-10-21T14:32:18Z",
        "edited_changes": null  // null이면 원래 제안 그대로
      },

      "outcome": {
        "status": "success",  // "success" | "failed" | "partial"
        "tests_passed": true,
        "time_taken_seconds": 3.2,
        "attempts": 1,
        "final_code": "props.onClick?.()"
      },

      "metadata": {
        "strategy_used": "react.md",
        "max_iterations": 5,
        "auto_mode": true
      }
    }
  ],

  "summary": {
    "total_fixes": 5,
    "successful": 4,
    "failed": 1,
    "approval_rate": 0.8,  // 80% approved
    "avg_time": 4.5,
    "avg_attempts": 1.8
  }
}
```

---

### **History UI (Desktop App)**

```
┌───────────────────────────────────────────────────┐
│ Test-Fix History                                  │
├───────────────────────────────────────────────────┤
│                                                   │
│ 📅 Today (5 fixes, 80% success rate)              │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ✅ Button.tsx:23                 14:32  3.2s  │ │
│ │    TypeError: Cannot read 'onClick'           │ │
│ │    → Applied: props.onClick?.()               │ │
│ │    [View Details]                             │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ✅ Header.tsx:45                 14:15  8.7s  │ │
│ │    Type error: string | undefined             │ │
│ │    → Applied: title ?? 'Default'              │ │
│ │    (3 attempts)                               │ │
│ │    [View Details]                             │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ ┌───────────────────────────────────────────────┐ │
│ │ ❌ api/users.ts:67              10:02  25.3s  │ │
│ │    Database connection error                  │ │
│ │    → Rejected: Too complex for auto-fix       │ │
│ │    (5 attempts, all failed)                   │ │
│ │    [View Details] [Retry Now]                 │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ 📊 This Week                                      │
│ ┌───────────────────────────────────────────────┐ │
│ │ Total: 23 fixes                               │ │
│ │ Success: 19 (83%)                             │ │
│ │ Avg time: 5.2s                                │ │
│ │ Avg attempts: 1.9                             │ │
│ │                                               │ │
│ │ Top errors:                                   │ │
│ │ 1. Optional chaining (8)                      │ │
│ │ 2. Type mismatch (5)                          │ │
│ │ 3. Null check (4)                             │ │
│ └───────────────────────────────────────────────┘ │
│                                                   │
│ [Export History] [Clear Old Data]                │
└───────────────────────────────────────────────────┘
```

**Detail View (클릭 시):**

```
┌─────────────────────────────────────────────────┐
│ Fix Detail: Button.tsx:23                       │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🕐 Timeline                                      │
│ ├─ 14:32:10  File changed                       │
│ ├─ 14:32:11  Tests started                      │
│ ├─ 14:32:12  Test failed (1.2s)                 │
│ ├─ 14:32:13  AI analyzing...                    │
│ ├─ 14:32:15  Suggestion ready                   │
│ ├─ 14:32:18  User approved                      │
│ ├─ 14:32:18  Fix applied                        │
│ └─ 14:32:19  Tests passed ✅                     │
│                                                 │
│ 🐛 Error                                         │
│ TypeError: Cannot read property 'onClick'       │
│ of undefined at Button.tsx:23:5                 │
│                                                 │
│ Stack trace:                                    │
│ at onClick (Button.tsx:23:5)                    │
│ at HTMLUnknownElement.callCallback (...)        │
│                                                 │
│ 💡 AI Suggestion                                 │
│ Model: claude-sonnet-4-5                        │
│ Confidence: 95%                                 │
│                                                 │
│ Change:                                         │
│ -  props.onClick()                              │
│ +  props.onClick?.()                            │
│                                                 │
│ Explanation:                                    │
│ The onClick prop is optional but not checked... │
│                                                 │
│ Similar fixes (3):                              │
│ - Header.tsx (2 days ago) ✅                    │
│ - Footer.tsx (1 week ago) ✅                    │
│ - Menu.tsx (1 week ago) ✅                      │
│                                                 │
│ 👤 User Decision                                 │
│ Action: Approved (no edits)                     │
│ Time to decide: 3 seconds                       │
│                                                 │
│ ✅ Outcome                                       │
│ Status: Success                                 │
│ Tests passed: Yes                               │
│ Time taken: 3.2s                                │
│ Attempts: 1                                     │
│                                                 │
│ [Copy Fix] [Apply to Similar Cases]            │
└─────────────────────────────────────────────────┘
```

---

## 🔍 6. 추가 고려사항

### **A. Notification System**

```
데스크톱 알림 (macOS/Windows)
┌─────────────────────────────┐
│ Circuit                      │
├─────────────────────────────┤
│ 💡 Fix suggestion ready     │
│ Button.tsx:23               │
│                             │
│ [Review Now] [Later]        │
└─────────────────────────────┘

클릭 → Desktop app 열림 + 해당 제안 하이라이트
```

---

### **B. Batch Suggestions**

```
여러 파일에서 동시에 에러 발생 시:

┌─────────────────────────────────────────┐
│ 🔥 3 fix suggestions ready              │
├─────────────────────────────────────────┤
│ 1. Button.tsx:23 (95% confidence)       │
│ 2. Header.tsx:45 (88% confidence)       │
│ 3. Footer.tsx:12 (92% confidence)       │
│                                         │
│ [Review All] [Apply All High Conf]      │
└─────────────────────────────────────────┘

"Apply All High Conf" → 90% 이상만 자동 적용
나머지는 수동 리뷰
```

---

### **C. Learning & Improvement**

```json
// .circuit/patterns.json (자동 생성)
{
  "learned_patterns": [
    {
      "error_pattern": "Cannot read property '(.+)' of undefined",
      "common_cause": "Optional prop not checked",
      "success_rate": 0.87,
      "typical_fix": "Use optional chaining",
      "occurrences": 23
    }
  ]
}

// 다음번 비슷한 에러 → 더 빠르고 정확한 제안
```

---

## ✅ 실현 가능성 종합 평가

| 요구사항 | 가능 여부 | 난이도 | 비고 |
|---------|---------|--------|------|
| 1. 디렉토리 구조 | ✅ 완전 가능 | ⭐ 쉬움 | Hybrid 추천 |
| 2. Auto-detect | ✅ 완전 가능 | ⭐⭐ 보통 | Confirmation UI 필요 |
| 3. Claude Code 재사용 | ⚠️ 조건부 | ⭐⭐⭐ 어려움 | 설정 파일 위치 조사 필요 |
| 4. Desktop App | ✅ 완전 가능 | ⭐⭐ 보통 | 기존 Electron 활용 |
| 5. 제안 기반 흐름 | ✅ 완전 가능 | ⭐⭐⭐ 복잡 | UX 설계 중요 |

---

## 🚀 추천 구현 순서

### **Week 1: 핵심 흐름**
1. 디렉토리 구조 (Hybrid)
2. Project detection (Auto + Confirmation)
3. File watcher
4. Test runner
5. Error extraction

### **Week 2: AI Integration**
1. AI provider (Claude API)
2. Suggestion generation
3. Context enrichment
4. Diff 생성

### **Week 3: Desktop UI**
1. Test-Fix Tab 추가
2. Suggestion card UI
3. Apply/Edit/Reject 버튼
4. History view

### **Week 4: Polish**
1. Notification system
2. History detail view
3. Pattern learning
4. Settings UI

---

다음 단계로 어떤 걸 진행할까요?
1. 디렉토리 구조 실제 구현?
2. Project detection 로직 작성?
3. UI 목업 디자인?
