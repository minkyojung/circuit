# Test-Fix Loop Architecture

> **Inspiration:** Conductor의 `/.claude/commands/` 패턴
>
> 선언적 설정 + 타이핑 기반 사용성 + MCP 확장성

---

## 🎯 Core Principles

1. **Zero Config, Full Power**
   - 기본값으로 즉시 동작
   - 필요할 때만 커스터마이징

2. **Declarative, Not Imperative**
   - .md 파일로 전략 선언
   - JSON/YAML 대신 자연어 + 코드

3. **Context-Aware**
   - 프로젝트 타입 자동 감지
   - 적절한 전략 자동 선택

4. **MCP-First**
   - 모든 도구는 MCP 서버
   - 확장 가능, 교체 가능

---

## 📁 Directory Structure

```
/.circuit/
│
├── strategies/              # 테스트 전략 (프로젝트별)
│   ├── default.md          # 기본 전략 (자동 감지 실패 시)
│   ├── react.md            # React 프로젝트
│   ├── node-api.md         # Node.js API
│   ├── nextjs.md           # Next.js
│   └── python-fastapi.md   # Python FastAPI
│
├── hooks/                   # 이벤트 기반 훅
│   ├── on-file-change.md   # 파일 변경 감지 시
│   ├── on-test-fail.md     # 테스트 실패 시
│   ├── on-fix-attempt.md   # 수정 시도 시
│   └── on-success.md       # 성공 시
│
├── mcps/                    # MCP 서버 설정
│   ├── test-runner.json    # Vitest/Jest/Pytest 등
│   ├── linter.json         # ESLint/Ruff 등
│   └── ai-fixer.json       # Claude/GPT 등
│
└── circuit.config.md        # 전역 설정
```

---

## 🔧 How It Works

### **1. Project Detection (Auto)**

Circuit이 프로젝트 타입을 자동 감지:

```typescript
// 감지 로직
const detectors = {
  react: () => hasFile('package.json') && hasDep('react'),
  nextjs: () => hasFile('next.config.js'),
  nodeApi: () => hasFile('package.json') && !hasDep('react'),
  python: () => hasFile('pyproject.toml') || hasFile('requirements.txt'),
}

// 결과: "React 프로젝트 감지! /.circuit/strategies/react.md 로딩"
```

---

### **2. Strategy Definition (Declarative)**

`/.circuit/strategies/react.md`:

```markdown
# React Test-Fix Strategy

## Auto-Run Conditions
- File patterns: `src/**/*.{ts,tsx}`
- Ignore: `**/*.test.ts`, `**/*.stories.tsx`
- Debounce: 500ms

## Test Commands
1. **Unit Tests**
   ```bash
   npm run test -- --passWithNoTests
   ```

2. **Type Check**
   ```bash
   npm run type-check
   ```

3. **Lint**
   ```bash
   npm run lint
   ```

## AI Fix Prompt Template
When tests fail, send this context to AI:

```
File: {file_path}
Error: {error_message}
Stack: {stack_trace}

Related files:
{related_components}

Recent changes (last commit):
{git_diff}

Fix this error and ensure:
- Types are correct
- Tests pass
- No lint errors
```

## Success Criteria
- All tests pass
- No type errors
- Lint score: 0 errors, <5 warnings

## Max Iterations
5 (prevent infinite loops)
```

---

### **3. Hook System (Event-Driven)**

`/.circuit/hooks/on-test-fail.md`:

```markdown
# On Test Fail Hook

## 1. Extract Context
- File path
- Error message & stack trace
- Related imports (up to 3 levels)
- Git blame (who last modified failing line)

## 2. Enrich with MCP Data
- **Filesystem MCP**: Find similar test files
- **Git MCP**: Get recent commits affecting this file
- **Docs MCP**: Fetch relevant library docs (e.g., React Testing Library)

## 3. Generate Fix Request
Use AI MCP to generate fix with full context:

```json
{
  "model": "claude-sonnet-4",
  "prompt": "{from strategy template}",
  "context": {
    "file": "...",
    "error": "...",
    "related": [...],
    "docs": [...]
  }
}
```

## 4. Apply Fix
- Use Edit MCP to apply changes
- Re-run tests automatically
- If fail → retry (max 5x)
- If success → notify user

## 5. Learn
Save to `.circuit/history/`:
- Error pattern
- Successful fix
- Time taken
- Use for future similar errors
```

---

### **4. MCP Configuration**

`/.circuit/mcps/test-runner.json`:

```json
{
  "id": "test-runner",
  "name": "Test Runner MCP",
  "auto_detect": true,
  "strategies": {
    "react": {
      "command": "npm",
      "args": ["run", "test"],
      "env": {
        "CI": "true",
        "NODE_ENV": "test"
      }
    },
    "python": {
      "command": "pytest",
      "args": ["-v", "--tb=short"]
    }
  },
  "output_parser": {
    "success_pattern": "Tests: \\d+ passed",
    "error_pattern": "FAIL .+",
    "extract_file": "at (.+):(\\d+):(\\d+)"
  }
}
```

---

## 💬 User Interaction (Conductor-style)

### **Manual Trigger (타이핑)**

```bash
# 터미널에서
$ circuit test-fix

# 또는 IDE command palette
> Circuit: Start Test-Fix Loop
```

### **Auto Mode (Background)**

```markdown
<!-- /.circuit/circuit.config.md -->

# Circuit Config

## Auto Mode
- Enabled: true
- Watch patterns: `src/**/*`
- Quiet mode: false (show notifications)

## Notifications
- On test start: "🧪 Testing..."
- On fix attempt: "🔧 Attempting fix (3/5)..."
- On success: "✅ Fixed in 2.3s!"
- On max retries: "❌ Could not auto-fix. See details..."
```

---

## 🔄 Complete Flow Example

### **Scenario: React 컴포넌트 수정**

```
1. User edits: src/components/Button.tsx

2. Circuit detects change (500ms debounce)
   → "🧪 Running tests for Button.tsx..."

3. Run test suite:
   ✓ npm run type-check
   ✗ npm run test
     Error: Cannot read property 'onClick' of undefined
     at Button.tsx:23

4. Extract context:
   - File: Button.tsx
   - Error line: 23
   - Related: Button.test.tsx, types/button.ts
   - Last modified by: William (2 min ago)

5. Enrich with MCP:
   - Filesystem MCP: Find similar Button patterns
   - Docs MCP: Fetch React event handler docs

6. AI Fix (Claude):
   "The error occurs because props.onClick is optional
    but not checked before use. Apply optional chaining."

   Fix: onClick?.() instead of onClick()

7. Apply fix (Edit MCP)
   → Re-run tests

8. ✅ All tests pass!
   Notification: "✅ Auto-fixed in 3.2s (1 attempt)"

9. Save to history:
   /.circuit/history/2025-10-21-button-fix.json
```

---

## 🎨 UI/UX (Inspired by Conductor)

### **Status Bar (IDE)**
```
Circuit: ✅ All tests passing | Last fix: 2m ago
         (click for details)
```

### **Notification (macOS/Desktop)**
```
┌─────────────────────────────┐
│ Circuit                      │
├─────────────────────────────┤
│ 🔧 Auto-fixing Button.tsx   │
│ Attempt 2/5... (3.1s)       │
└─────────────────────────────┘
```

### **History Panel**
```
Recent Fixes:
✅ Button.tsx      2m ago  1 attempt  3.2s
✅ Header.test.tsx 15m ago 3 attempts 8.7s
❌ api/users.ts    1h ago  5 attempts (manual fix required)
```

---

## 🧠 Smart Features

### **1. Learning from History**
```typescript
// /.circuit/history/patterns.json
{
  "common_errors": {
    "Cannot read property X of undefined": {
      "frequency": 23,
      "avg_fix_time": "4.2s",
      "common_solution": "Add optional chaining or null check",
      "success_rate": 0.87
    }
  }
}

// When similar error occurs:
// → Circuit suggests: "Based on 23 similar fixes, try optional chaining?"
```

### **2. Context Expansion**
```
First attempt fails → Expand context:
- Initially: Just the failing file
- Retry 1: + Related imports
- Retry 2: + Test files
- Retry 3: + Recent commits
- Retry 4: + Library docs
- Retry 5: + Ask user for hint
```

### **3. Multi-File Fixes**
```
Error affects multiple files:
→ Circuit: "This fix requires changes in 3 files:
  1. Button.tsx (prop type)
  2. types/button.ts (interface)
  3. Button.test.tsx (test assertion)

  Apply all? [Y/n]"
```

---

## 🔌 MCP Extension Points

### **Custom Test Runners**
```json
// /.circuit/mcps/custom-e2e.json
{
  "id": "playwright-e2e",
  "command": "npx playwright test",
  "when": "manual",  // Don't auto-run (too slow)
  "trigger": "circuit e2e"
}
```

### **Custom AI Models**
```json
// /.circuit/mcps/ai-fixer.json
{
  "providers": [
    {
      "name": "claude-sonnet-4",
      "priority": 1,
      "use_when": "complex_errors"
    },
    {
      "name": "gpt-4o",
      "priority": 2,
      "use_when": "simple_errors"
    },
    {
      "name": "local-llama",
      "priority": 3,
      "use_when": "offline"
    }
  ]
}
```

---

## 🚀 Implementation Phases

### **Phase 1: MVP (2 weeks)**
- [ ] Project detection (React, Node, Python)
- [ ] Single strategy: `default.md`
- [ ] File watcher
- [ ] Test runner (npm test)
- [ ] Error extraction
- [ ] AI fix (Claude API)
- [ ] Basic loop (max 5 iterations)

### **Phase 2: Polish (1 week)**
- [ ] Multiple strategies (react.md, node-api.md, etc.)
- [ ] Hook system (on-test-fail.md)
- [ ] MCP configuration
- [ ] History tracking
- [ ] Desktop notifications

### **Phase 3: Smart Features (1 week)**
- [ ] Learning from history
- [ ] Context expansion
- [ ] Multi-file fixes
- [ ] Custom MCP support

---

## 💡 Key Differentiators

| Feature | Circuit | Cursor/Claude Code |
|---------|---------|-------------------|
| Auto test-fix loop | ✅ | ❌ |
| Declarative config | ✅ (.md files) | ❌ |
| Learning from history | ✅ | ❌ |
| Multi-iteration fix | ✅ (auto) | ⚠️ (manual) |
| Context expansion | ✅ (smart) | ⚠️ (static) |
| MCP extensible | ✅ | ❌ |

---

## 📚 References

- Conductor commands pattern: `/.claude/commands/*.md`
- MCP protocol: https://modelcontextprotocol.io
- Test automation best practices: [Research papers]

---

_Last Updated: 2025-10-21_
