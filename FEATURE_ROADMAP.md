# Octave 실제 코딩 사용을 위한 기능 분석 및 개선 로드맵

> **작성일**: 2025-11-05
> **목적**: Octave를 실제 프로덕션 코딩 환경에서 사용 가능하도록 만들기 위한 체계적인 기능 분석 및 구현 로드맵

---

## 📋 목차

1. [분석 방법론](#분석-방법론)
2. [현재 Octave 상태 요약](#현재-circuit-상태-요약)
3. [Phase별 필요 기능](#phase별-필요-기능)
4. [우선순위 요약](#우선순위-요약)
5. [구현 로드맵](#구현-로드맵)
6. [측정 지표](#측정-지표)

---

## 📋 분석 방법론

이 분석은 다음 3가지 관점에서 수행되었습니다:

1. **Cursor 온보딩 프로세스** - 사용자가 처음 설정하는 것들
2. **실제 개발 워크플로우** - 개발 단계별 필요 기능
3. **현재 Octave 대비 갭 분석** - 무엇이 부족한가

### 우선순위 정의

- **P0 (Critical)**: 없으면 실제 코딩 불가능한 필수 기능
- **P1 (High)**: 생산성에 큰 영향을 주는 중요 기능
- **P2 (Medium)**: 있으면 좋은 편의 기능
- **P3 (Nice-to-have)**: 장기적으로 고려할 고급 기능

---

## 🎯 현재 Octave 상태 요약

### ✅ 잘 구현된 기능

- **Workspace 관리**: Git worktree 기반 독립 환경
- **Monaco 에디터**: VS Code 수준의 코드 편집
- **AI 통합**: Claude 채팅, 코드 완성, 설명/최적화
- **MCP 생태계**: 서버 관리, Timeline, 모니터링
- **Terminal**: Classic + Modern(Warp-style) 지원
- **Git 기본**: Commit, PR, Conflict 해결
- **Problems 패널**: TypeScript 타입 에러 표시

### ❌ 주요 갭 (Cursor 대비)

- **검색/치환**: 프로젝트 전체 검색 불가
- **디버깅**: Breakpoint, Step, Inspect 없음
- **테스트 러너**: 통합 테스트 UI 없음
- **Auto Import**: Import 자동 추가 없음
- **Refactoring**: Rename Symbol, Extract Function 없음
- **패키지 관리**: Dependencies UI 없음
- **Git 고급**: Blame, Stash, History 없음

---

## 🛠️ Phase별 필요 기능

---

## **Phase 1: 온보딩 & 초기 설정**

> **목표**: 새 프로젝트를 열었을 때 즉시 코딩 가능한 환경 자동 구성

### P0 (Critical) - 초기 설정 마법사

#### 1. 프로젝트 타입 자동 감지

**요구사항**:
- `package.json` 존재 → Node.js/React/Next.js 프로젝트
- `requirements.txt` 존재 → Python 프로젝트
- `Cargo.toml` 존재 → Rust 프로젝트
- `go.mod` 존재 → Go 프로젝트
- 자동으로 적절한 language server 설치 제안

**구현 방향**:
```typescript
interface ProjectDetection {
  type: 'node' | 'python' | 'rust' | 'go' | 'java' | 'unknown';
  framework?: 'react' | 'next' | 'vue' | 'django' | 'fastapi';
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'poetry';
  languageServers: string[]; // 설치 필요한 LSP
}
```

#### 2. `.circuit/project.json` 자동 생성

**파일 구조**:
```json
{
  "name": "my-project",
  "type": "typescript-react",
  "ai": {
    "rules": [
      "항상 TypeScript strict mode 사용",
      "Tailwind CSS 우선 사용",
      "함수형 컴포넌트만 사용"
    ],
    "codeStyle": "airbnb",
    "preferredPatterns": [
      "React hooks over class components",
      "Async/await over promises"
    ]
  },
  "environment": {
    "nodeVersion": "20.x",
    "packageManager": "pnpm"
  },
  "excludeFromAI": [
    "node_modules",
    "dist",
    "*.min.js"
  ]
}
```

#### 3. AI 코딩 규칙 설정 UI

**Settings 탭에 새 섹션 추가**:

```
┌─ AI Coding Rules ─────────────────────────────┐
│                                               │
│ Project Rules (shared with team)             │
│ ┌───────────────────────────────────────────┐ │
│ │ • Always use TypeScript strict mode      │ │
│ │ • Prefer functional components           │ │
│ │ • Use Tailwind for styling               │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ [+ Add Rule]  [Import from Template]          │
│                                               │
│ Templates:                                    │
│ • React + TypeScript Best Practices          │
│ • Node.js API Development                    │
│ • Python Django Project                      │
│                                               │
└───────────────────────────────────────────────┘
```

**Cursor의 `.cursorrules` 호환**:
- `.cursorrules` 파일 자동 읽기
- Octave 형식으로 변환
- Git에 커밋 가능

### P1 (High) - 팀 설정 공유

#### 1. 설정 파일 Git 커밋

**구현**:
- `.circuit/settings.json` - 팀 공유 설정
- `.circuit/settings.local.json` - 개인 설정 (gitignore)
- Settings UI에서 "Share with team" 체크박스

**파일 우선순위**:
```
개인 설정 > 팀 설정 > 기본값
```

#### 2. 온보딩 체크리스트

**첫 실행 시 표시**:
```
┌─ Welcome to Octave! ─────────────────────────┐
│                                               │
│ Let's set up your workspace:                  │
│                                               │
│ ✓ Git user info detected (John Doe)          │
│ ⚠ Anthropic API key missing                  │
│   [Enter API Key]                             │
│                                               │
│ ✓ Detected: TypeScript React project         │
│ ⚠ Recommended MCP servers:                    │
│   • TypeScript LSP                            │
│   • ESLint                                    │
│   • Prettier                                  │
│   [Install All]                               │
│                                               │
│ ☐ Set up AI coding rules                     │
│   [Configure Now]  [Skip]                     │
│                                               │
│ [Complete Setup]                              │
└───────────────────────────────────────────────┘
```

---

## **Phase 2: 코드 작성 단계**

> **목표**: VS Code/Cursor 수준의 에디터 기능 제공

### P0 (Critical) - 기본 에디터 기능 강화

#### 1. 자동 Import 추가

**동작 방식**:
```typescript
// 사용자가 "useState" 타이핑 시
import { useState } from 'react'; // ← 자동 추가

function MyComponent() {
  const [count, setCount] = useState(0);
  //     ↑ Quick Fix 전구 아이콘 표시
}
```

**구현**:
- TypeScript Language Server의 `getCodeFixesAtPosition` 사용
- 단축키: `Cmd+.` 또는 `Ctrl+.`
- Quick Fix 메뉴에서 선택 가능
- 여러 import 후보가 있을 경우 선택 UI

**UI 위치**: Monaco editor context menu + Code Action lightbulb

#### 2. 코드 스니펫 시스템

**VS Code `.code-snippets` 포맷 호환**:
```json
{
  "React Functional Component": {
    "prefix": "rfc",
    "body": [
      "import React from 'react';",
      "",
      "interface ${1:ComponentName}Props {",
      "  $2",
      "}",
      "",
      "export const ${1:ComponentName}: React.FC<${1:ComponentName}Props> = (props) => {",
      "  return (",
      "    <div>",
      "      $0",
      "    </div>",
      "  );",
      "};"
    ],
    "description": "React functional component with TypeScript"
  }
}
```

**기능**:
- 프로젝트별 커스텀 스니펫 (`.circuit/snippets.json`)
- 전역 스니펫 (`~/.circuit/snippets/`)
- AI로 스니펫 생성: 코드 선택 → "Save as Snippet"
- 스니펫 관리 UI (Settings > Snippets)

**스니펫 관리 UI**:
```
┌─ Snippets ────────────────────────────────────┐
│                                               │
│ Project Snippets (3)                          │
│ • rfc - React Functional Component            │
│ • api - API Route Handler                     │
│ • test - Test Case Template                   │
│                                               │
│ Global Snippets (12)                          │
│ • log - console.log                           │
│ • imp - import statement                      │
│                                               │
│ [+ New Snippet]  [Import from File]           │
│                                               │
└───────────────────────────────────────────────┘
```

#### 3. Go to Definition / Find References

**구현**:
- `F12` - Go to Definition
- `Shift+F12` - Find All References
- `Alt+F12` - Peek Definition (inline popup)
- TypeScript/JavaScript language server 통합

**References 패널**:
```
┌─ References: useState ────────────────────────┐
│                                               │
│ src/components/Counter.tsx (2)                │
│   12: import { useState } from 'react';       │
│   15: const [count, setCount] = useState(0);  │
│                                               │
│ src/hooks/useAuth.ts (1)                      │
│   8: const [user, setUser] = useState(null);  │
│                                               │
└───────────────────────────────────────────────┘
```

#### 4. 코드 포맷팅 자동화

**구현**:
- Prettier, ESLint 자동 실행
- 설정 파일 자동 감지 (`.prettierrc`, `.eslintrc`)
- Format on Save 토글 (Settings)
- 단축키: `Shift+Alt+F`

**Settings UI**:
```
┌─ Code Formatting ─────────────────────────────┐
│                                               │
│ ☑ Format on Save                              │
│ ☑ Format on Paste                             │
│                                               │
│ Formatter: [Prettier ▼]                       │
│                                               │
│ ☑ Auto-fix ESLint errors on save             │
│                                               │
└───────────────────────────────────────────────┘
```

### P1 (High) - AI 코드 작성 강화

#### 1. 인라인 AI 편집 (Cursor의 Cmd+K 스타일)

**동작 방식**:
```typescript
// 1. 사용자가 코드 선택
const fetchUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};

// 2. Cmd+K 누름 → 프롬프트 입력
// "에러 처리 추가해줘"

// 3. AI가 diff 생성 (Accept/Reject 버튼)
const fetchUser = async (id: string) => {
+ try {
    const response = await fetch(`/api/users/${id}`);
+   if (!response.ok) {
+     throw new Error(`Failed to fetch user: ${response.statusText}`);
+   }
    return response.json();
+ } catch (error) {
+   console.error('Error fetching user:', error);
+   throw error;
+ }
};
```

**UI 컴포넌트**:
- Inline diff view (Monaco diff editor)
- Accept (✓) / Reject (✗) 버튼
- 여러 제안이 있을 경우 ← → 화살표로 선택
- Esc로 취소

#### 2. AI Composer (긴 생성 작업)

**사용 사례**:
```
프롬프트: "React 컴포넌트 생성: UserProfile with avatar, bio, and stats"

AI 생성:
1. src/components/UserProfile.tsx (컴포넌트)
2. src/components/UserProfile.module.css (스타일)
3. src/components/__tests__/UserProfile.test.tsx (테스트)
4. src/types/user.ts (타입 정의)
```

**UI**:
```
┌─ AI Composer ─────────────────────────────────┐
│                                               │
│ What do you want to build?                    │
│ ┌───────────────────────────────────────────┐ │
│ │ UserProfile component with avatar, bio,   │ │
│ │ and social stats                          │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ AI will generate:                             │
│ • UserProfile.tsx (component)                 │
│ • UserProfile.module.css (styles)             │
│ • UserProfile.test.tsx (tests)                │
│ • user.ts (types)                             │
│                                               │
│ [Generate]  [Cancel]                          │
└───────────────────────────────────────────────┘
```

#### 3. 코드 리뷰 제안

**동작**:
- 파일 저장 시 자동 분석 (옵션)
- 우클릭 → "Review this code"
- AI가 개선점 제안

**리뷰 패널**:
```
┌─ Code Review ─────────────────────────────────┐
│                                               │
│ src/components/UserList.tsx                   │
│                                               │
│ ⚠ Performance Issue (Line 42)                │
│   Unnecessary re-renders due to inline        │
│   function creation.                          │
│   [Fix] [Ignore]                              │
│                                               │
│ ⚠ Security (Line 56)                          │
│   SQL injection vulnerability.                │
│   Use parameterized queries.                  │
│   [Fix] [Learn More]                          │
│                                               │
│ ℹ Style (Line 12)                             │
│   Consider using destructuring.               │
│   [Fix] [Ignore]                              │
│                                               │
└───────────────────────────────────────────────┘
```

### P2 (Medium) - 편의 기능

#### 1. 멀티 커서 완전 지원

- `Cmd+D` - 다음 같은 단어 선택
- `Cmd+Shift+L` - 모든 같은 단어 선택
- `Alt+Click` - 커서 추가
- `Alt+Shift+↑/↓` - 위/아래에 커서 추가

#### 2. 코드 폴딩 UI

- 함수/클래스 접기/펴기 아이콘
- 폴딩 상태 저장 (workspace별)
- `Cmd+K Cmd+0` - 모두 접기
- `Cmd+K Cmd+J` - 모두 펴기

#### 3. Breadcrumb 네비게이션

```
src > components > UserProfile > UserProfileHeader > Avatar
                                  ↑ 클릭 시 symbol 목록 표시
```

---

## **Phase 3: 코드 탐색 & 검색 단계**

> **목표**: 대규모 코드베이스에서 빠른 검색 및 네비게이션

### P0 (Critical) - 검색 & 치환

#### 1. Global Search Panel (Cmd+Shift+F)

**UI Layout**:
```
┌─ SEARCH ──────────────────────────────────────┐
│                                               │
│ Search: useState                              │
│ ┌───────────────────────────────────────────┐ │
│ │                                           │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ Replace: useSignal                            │
│ ┌───────────────────────────────────────────┐ │
│ │                                           │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ ☑ Case Sensitive (Aa)                        │
│ ☑ Match Whole Word (Ab)                      │
│ ☑ Use Regular Expression (.*)                │
│                                               │
│ Files to include: *.ts,*.tsx                  │
│ Files to exclude: node_modules,dist           │
│                                               │
├───────────────────────────────────────────────┤
│                                               │
│ 🔍 42 results in 8 files                     │
│                                               │
│ ▼ src/components/UserProfile.tsx (5 matches) │
│     12: import { useState } from 'react';     │
│     15: const [name, setName] = useState(''); │
│     18: const [age, setAge] = useState(0);    │
│     ...                                       │
│                                               │
│ ▼ src/hooks/useAuth.ts (3 matches)           │
│     8: const [user, setUser] = useState(null);│
│     ...                                       │
│                                               │
│ [Replace All]  [Replace in File]              │
│                                               │
└───────────────────────────────────────────────┘
```

**기능**:
- Ripgrep 기반 빠른 검색
- 결과 클릭 시 해당 파일 열기 + 하이라이트
- Replace preview (dry-run)
- Batch replace with undo
- Search history 저장

#### 2. Find in Current File (Cmd+F)

**UI**: Editor 상단 오버레이
```
┌─────────────────────────────────────────────────┐
│ Find: [useState        ] [↑] [↓] [×]  3/10     │
│ Replace: [useSignal       ] [Replace] [All]     │
│ [Aa] [Ab] [.*] [☐]                              │
└─────────────────────────────────────────────────┘
```

**기능**:
- `Enter` - 다음 매칭
- `Shift+Enter` - 이전 매칭
- 모든 매칭 하이라이트
- 스크롤바에 매칭 위치 표시 (minimap)

#### 3. Replace in Files

**안전 장치**:
- Replace 전 Diff 미리보기
- "Replace All" 전 확인 다이얼로그
- Undo 가능 (Git으로 복원)

### P1 (High) - 고급 검색

#### 1. AI Semantic Search

**사용 예시**:
```
프롬프트: "사용자 인증 처리하는 코드 찾아줘"

AI 분석:
→ 키워드: auth, login, token, session, verify
→ 파일: src/auth/, src/middleware/
→ 함수: authenticateUser, verifyToken, checkSession

결과:
• src/auth/AuthProvider.tsx
• src/middleware/authMiddleware.ts
• src/hooks/useAuth.ts
```

**구현**: MCP filesystem tool + Claude API

#### 2. Search History

**UI**: Search panel 하단
```
Recent Searches:
• useState → useSignal (2 hours ago)
• TODO: (yesterday)
• import.*from.*react (3 days ago)
```

#### 3. Exclude Patterns

**Default excludes**:
- `node_modules/`
- `.git/`
- `dist/`, `build/`
- `*.min.js`
- `.next/`, `.vercel/`

**Custom patterns**: `.circuit/search-ignore`

---

## **Phase 4: 디버깅 & 테스팅 단계**

> **목표**: 통합된 테스트 실행 및 디버깅 환경

### P0 (Critical) - 테스트 러너

#### 1. Test Explorer UI

**Layout**: Right Panel의 새 탭
```
┌─ TESTS ───────────────────────────────────────┐
│                                               │
│ [▶ Run All] [↻ Run Failed] [⚙ Configure]     │
│                                               │
│ 🔍 Filter: [____________]                     │
│                                               │
│ ▼ src/                                        │
│   ▼ components/                               │
│     ▶ UserProfile.test.tsx (3 tests)          │
│       ✓ renders correctly                     │
│       ✗ handles click event                   │
│         Expected: "clicked"                   │
│         Received: undefined                   │
│       ⊙ shows loading state                   │
│   ▼ hooks/                                    │
│     ✓ useAuth.test.ts (5 tests)               │
│                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                               │
│ Tests: 8 passed, 1 failed, 1 skipped         │
│ Duration: 2.3s                                │
│                                               │
└───────────────────────────────────────────────┘
```

**기능**:
- Jest, Vitest, Pytest 자동 감지
- 테스트 파일 감지: `*.test.ts`, `*.spec.ts`, `test_*.py`
- 개별 테스트 실행 버튼
- 실패한 테스트만 재실행
- Watch mode 지원
- Coverage 리포트

#### 2. 테스트 결과 인라인 표시

**Editor gutter에 아이콘 표시**:
```typescript
describe('UserProfile', () => {
  ✓ it('renders correctly', () => {  // ← 녹색 체크
      ...
    });

  ✗ it('handles click', () => {      // ← 빨간 X
      expect(result).toBe('clicked');
      // Hover: Expected "clicked", received undefined
    });
});
```

**CodeLens 버튼**:
```typescript
// ▶ Run Test | Debug Test
it('renders correctly', () => {
  ...
});
```

#### 3. AI 테스트 생성 강화

**동작**:
1. 함수 우클릭 → "Generate Tests"
2. AI가 edge case 분석
3. 테스트 코드 생성
4. Coverage 측정

**예시**:
```typescript
// Original function
function divide(a: number, b: number): number {
  return a / b;
}

// AI-generated test
describe('divide', () => {
  it('divides two positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('handles division by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('handles negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('handles floating point', () => {
    expect(divide(10, 3)).toBeCloseTo(3.333, 3);
  });
});
```

### P1 (High) - 디버거 통합

#### 1. Visual Debugger

**Breakpoint 설정**: Line number 옆 클릭
```typescript
function fetchUser(id: string) {
  🔴 const url = `/api/users/${id}`;  // ← Breakpoint
     const response = await fetch(url);
     return response.json();
   }
```

**Debug Panel**:
```
┌─ DEBUG ───────────────────────────────────────┐
│                                               │
│ [▶ Continue] [⏭ Step Over] [⏬ Step Into]     │
│ [⏏ Step Out] [↻ Restart] [⏹ Stop]            │
│                                               │
│ ▼ VARIABLES                                   │
│   Local                                       │
│     id: "123"                                 │
│     url: "/api/users/123"                     │
│     response: Promise {<pending>}             │
│   Closure                                     │
│     apiKey: "sk-..."                          │
│                                               │
│ ▼ WATCH                                       │
│     response.status: 200                      │
│     response.ok: true                         │
│                                               │
│ ▼ CALL STACK                                  │
│     fetchUser (api.ts:42)                     │
│     handleClick (UserProfile.tsx:18)          │
│     onClick (index.tsx:12)                    │
│                                               │
│ ▼ BREAKPOINTS                                 │
│     ✓ api.ts:42                               │
│     ✓ UserProfile.tsx:18                      │
│                                               │
└───────────────────────────────────────────────┘
```

**지원 런타임**:
- Node.js (Chrome DevTools Protocol)
- Python (debugpy)
- Go (delve)

#### 2. 디버그 콘솔

**REPL 환경**:
```
> response.status
200

> JSON.stringify(response.headers)
{"content-type": "application/json", ...}

> id = "456"  // 변수 값 변경
"456"
```

### P2 (Medium) - 고급 도구

#### 1. 로그 뷰어

```
┌─ LOGS ────────────────────────────────────────┐
│                                               │
│ Filters: [INFO ▼] [api.ts ▼] [Last hour ▼]   │
│                                               │
│ 14:32:01 INFO  [api.ts:42] Fetching user 123  │
│ 14:32:01 DEBUG [db.ts:12] SELECT * FROM users │
│ 14:32:02 ERROR [api.ts:48] User not found     │
│          Stack trace:                         │
│            at fetchUser (api.ts:48)           │
│            at handleClick (UserProfile.tsx:18)│
│                                               │
└───────────────────────────────────────────────┘
```

#### 2. 성능 프로파일러

- CPU 프로파일링
- 메모리 힙 스냅샷
- Flame graph 시각화

---

## **Phase 5: 의존성 관리 & 빌드**

> **목표**: 패키지 설치, 업데이트, 보안 관리 간소화

### P0 (Critical) - 패키지 관리

#### 1. Dependencies Panel

**Layout**: Right Panel의 새 탭
```
┌─ DEPENDENCIES ────────────────────────────────┐
│                                               │
│ [+ Add] [↻ Update All] [🔒 Security Scan]    │
│                                               │
│ 📦 Production (23 packages)                   │
│                                               │
│ react                    18.2.0 → 18.3.1 ⬆    │
│   Latest stable release                       │
│   [Update] [Changelog]                        │
│                                               │
│ next                     14.0.0 ✓             │
│   You're on the latest version                │
│                                               │
│ typescript               5.3.3 → 5.4.2 ⚠      │
│   Breaking changes in 5.4.0                   │
│   [Update] [See Changes]                      │
│                                               │
│ lodash                   4.17.19 🔴           │
│   Security vulnerability (CVE-2021-23337)     │
│   [Update to 4.17.21] [Details]               │
│                                               │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│                                               │
│ 🛠 Development (12 packages)                  │
│                                               │
│ @types/react             ^18.2.0 ✓            │
│ vitest                   1.0.0 → 2.0.0 ⬆      │
│ eslint                   8.55.0 ✓             │
│                                               │
└───────────────────────────────────────────────┘
```

**기능**:
- 실시간 최신 버전 확인
- Breaking change 경고
- 보안 취약점 표시 (CVE)
- 의존성 트리 시각화
- Unused dependencies 감지

#### 2. 패키지 검색 & 설치

**Command Palette**: "Add Dependency"
```
┌─ Add Dependency ──────────────────────────────┐
│                                               │
│ Search: [zustand____________]                 │
│                                               │
│ zustand                                  4.5.0 │
│   Bear necessities for state management       │
│   ★ 42.3k  📦 2.1M/week  ⟳ 2 days ago        │
│   [+ Install]                                 │
│                                               │
│ zustand-persist                          0.4.0 │
│   Persist middleware for Zustand              │
│   ★ 1.2k   📦 50k/week   ⟳ 3 months ago      │
│   [+ Install]                                 │
│                                               │
└───────────────────────────────────────────────┘
```

**설치 옵션**:
- Production vs Development
- 버전 선택 (latest, specific, range)
- 패키지 매니저 자동 감지 (npm/yarn/pnpm)

#### 3. 보안 취약점 알림

**자동 스캔**: 프로젝트 열 때 + 매일
```
┌─ Security Alert ──────────────────────────────┐
│                                               │
│ ⚠ 3 vulnerabilities found in dependencies     │
│                                               │
│ 🔴 Critical (1)                               │
│   lodash@4.17.19 - Prototype Pollution        │
│   CVE-2021-23337                              │
│   Fix: Update to 4.17.21                      │
│   [Fix Now]                                   │
│                                               │
│ 🟡 Moderate (2)                               │
│   axios@0.21.0 - SSRF vulnerability           │
│   Fix: Update to 0.21.4                       │
│   [Fix Now] [Ignore]                          │
│                                               │
│ [Fix All] [View Report]                       │
└───────────────────────────────────────────────┘
```

**Commands**:
- `npm audit fix` 자동 실행
- Ignore 옵션 (.circuit/security-ignore.json)
- CI/CD 통합 (PR에 보안 리포트)

### P1 (High) - 빌드 통합

#### 1. Task Runner

**package.json scripts 자동 감지**:
```
┌─ TASKS ───────────────────────────────────────┐
│                                               │
│ ▶ dev        - Start development server       │
│ ▶ build      - Build for production           │
│ ▶ test       - Run test suite                 │
│ ▶ lint       - Lint code                      │
│ ▶ deploy     - Deploy to production           │
│                                               │
│ [+ Add Custom Task]                           │
│                                               │
└───────────────────────────────────────────────┘
```

**실행 방법**:
- 클릭하여 실행
- Command Palette: "Run Task"
- 단축키 설정 가능

#### 2. Build Output Panel

**구조화된 빌드 로그**:
```
┌─ BUILD OUTPUT ────────────────────────────────┐
│                                               │
│ ▶ npm run build                               │
│                                               │
│ ✓ Linting...                           (2.1s) │
│ ✓ Type checking...                     (4.3s) │
│ ✓ Compiling...                         (8.7s) │
│   ├─ src/pages/index.tsx              (0.5s) │
│   ├─ src/pages/about.tsx              (0.3s) │
│   └─ src/components/**                (2.1s) │
│                                               │
│ ⚠ Warnings (2)                                │
│   Line 42: Unused variable 'oldCode'          │
│   [Fix] [Ignore]                              │
│                                               │
│ ✓ Build completed successfully       (15.2s) │
│                                               │
│ Output: dist/ (2.3 MB)                        │
│                                               │
└───────────────────────────────────────────────┘
```

**기능**:
- 에러 클릭 시 해당 파일로 점프
- Warning 원클릭 수정
- 빌드 시간 측정 및 비교

#### 3. Watch Mode 통합

**Status Bar 표시**:
```
⚡ Dev Server Running | ✓ HMR Connected | 🔥 2 modules updated
```

**알림**:
- 빌드 완료 시 사운드/알림
- 에러 발생 시 토스트 메시지
- HMR 실패 시 전체 새로고침 제안

---

## **Phase 6: Git & 협업**

> **목표**: 고급 Git 기능 및 팀 협업 도구

### P0 (Critical) - 코어 Git 기능

#### 1. Git Blame in Editor

**Gutter에 표시**:
```typescript
// @john  3d  Fix authentication bug
const fetchUser = async (id: string) => {
// @sarah 1h  Add error handling
  try {
// @john  3d  Fix authentication bug
    const response = await fetch(`/api/users/${id}`);
// @sarah 1h  Add error handling
    if (!response.ok) throw new Error('Failed');
    return response.json();
  } catch (error) {
    console.error(error);
  }
};
```

**Hover tooltip**:
```
┌─────────────────────────────────────────────┐
│ John Doe (john@example.com)                 │
│ 3 days ago (2025-11-02 14:32)              │
│                                             │
│ Commit: abc1234                             │
│ Message: Fix authentication bug             │
│                                             │
│ [View Commit] [View File History]          │
└─────────────────────────────────────────────┘
```

**Commands**:
- `Alt+G` - Toggle Git Blame
- 우클릭 → "Git Blame this Line"

#### 2. File History

**Timeline 뷰**:
```
┌─ FILE HISTORY: src/components/UserProfile.tsx ┐
│                                                │
│ ○ 2 hours ago - Sarah Chen                    │
│   Add error handling for avatar loading       │
│   [View Diff] [Restore]                        │
│                                                │
│ ○ 3 days ago - John Doe                        │
│   Fix authentication bug                       │
│   [View Diff] [Restore]                        │
│                                                │
│ ○ 1 week ago - Sarah Chen                      │
│   Initial UserProfile component               │
│   [View Diff] [Restore]                        │
│                                                │
│ [Load More]                                    │
└────────────────────────────────────────────────┘
```

**Diff 뷰**:
- Side-by-side 비교
- Inline diff
- 특정 커밋으로 복원

#### 3. Stash 관리

**Stash Panel**:
```
┌─ STASH ────────────────────────────────────────┐
│                                                │
│ stash@{0} - On main: WIP on user profile      │
│   2 hours ago                                  │
│   • 3 files changed                            │
│   [Apply] [Pop] [Drop] [View Diff]             │
│                                                │
│ stash@{1} - On feat/new-ui: Experimental UI   │
│   Yesterday                                    │
│   • 5 files changed                            │
│   [Apply] [Pop] [Drop] [View Diff]             │
│                                                │
│ [+ Create Stash]                               │
└────────────────────────────────────────────────┘
```

**Quick Stash**:
- Command Palette: "Stash Changes"
- 메시지 입력 옵션
- Include untracked files 옵션

### P1 (High) - 협업 기능

#### 1. Pull Request 뷰

**PR List Panel**:
```
┌─ PULL REQUESTS ────────────────────────────────┐
│                                                │
│ Filters: [Open ▼] [Assigned to me ▼]          │
│                                                │
│ #42 feat: Add user profile page                │
│     sarah • 2 hours ago • 5 comments           │
│     ✓ Checks passed • 2 approvals needed       │
│     [View] [Checkout]                          │
│                                                │
│ #41 fix: Memory leak in WebSocket             │
│     john • Yesterday • 12 comments             │
│     ⚠ Checks failed • Requested changes        │
│     [View] [Checkout]                          │
│                                                │
│ #40 docs: Update API documentation            │
│     alice • 3 days ago • Ready to merge        │
│     ✓ Approved by 2 reviewers                  │
│     [Merge] [View]                             │
│                                                │
└────────────────────────────────────────────────┘
```

**PR Detail View**:
```
┌─ PR #42: Add user profile page ────────────────┐
│                                                │
│ sarah wants to merge 3 commits into main       │
│                                                │
│ ▼ Conversation (5)                             │
│   john: "Looks good! Just one comment..."      │
│   sarah: "Fixed, thanks!"                      │
│                                                │
│ ▼ Commits (3)                                  │
│   • feat: Add UserProfile component            │
│   • style: Add CSS for profile page            │
│   • test: Add UserProfile tests                │
│                                                │
│ ▼ Files Changed (7)                            │
│   src/components/UserProfile.tsx      +120 -0  │
│   src/styles/profile.css              +45 -0   │
│   ...                                          │
│                                                │
│ ▼ Checks                                       │
│   ✓ Build (2.3s)                               │
│   ✓ Tests (15.2s)                              │
│   ✓ Lint (1.1s)                                │
│                                                │
│ [💬 Comment] [✓ Approve] [✗ Request Changes]  │
└────────────────────────────────────────────────┘
```

**Inline PR Comments**:
- 코드에 직접 코멘트 표시
- Resolved/Unresolved 필터
- Reply 스레드

#### 2. Live Share (실시간 협업)

**세션 시작**:
```
┌─ Start Live Share ─────────────────────────────┐
│                                                │
│ Share this link with collaborators:            │
│ https://circuit.live/session/abc123            │
│ [Copy Link]                                    │
│                                                │
│ Permissions:                                   │
│ ☑ Allow editing                                │
│ ☑ Allow terminal access                        │
│ ☐ Allow debugging                              │
│                                                │
│ Participants (0)                               │
│ Waiting for others to join...                  │
│                                                │
│ [End Session]                                  │
└────────────────────────────────────────────────┘
```

**협업 중**:
```
Editor 상단에 참가자 커서 표시:
┌────────────────────────────────────────────────┐
│ 👤 John (blue) editing App.tsx:42              │
│ 👤 Sarah (green) viewing utils.ts              │
└────────────────────────────────────────────────┘
```

**기능**:
- 실시간 커서 공유
- 동시 편집
- 음성 채널 통합?
- 터미널 공유

#### 3. Branch Management 강화

**Branch Panel**:
```
┌─ BRANCHES ─────────────────────────────────────┐
│                                                │
│ [+ New Branch] [🔄 Fetch] [🗑 Cleanup]         │
│                                                │
│ ✓ main (active) ━━ origin/main                │
│   Up to date                                   │
│                                                │
│ ○ feat/user-profile ━━ origin/feat/user-profile│
│   ↑2 ahead, ↓1 behind                          │
│   [Checkout] [Pull] [Push]                     │
│                                                │
│ ○ fix/memory-leak ━━ (no remote)              │
│   Local only                                   │
│   [Checkout] [Push] [Delete]                   │
│                                                │
│ ▼ Remote Branches (12)                         │
│   ○ origin/feat/new-ui                         │
│   ○ origin/fix/auth-bug                        │
│   ...                                          │
│                                                │
└────────────────────────────────────────────────┘
```

**기능**:
- Branch 생성/삭제/체크아웃
- Merge vs Rebase 선택
- Remote branch 추적
- Stale branch 감지 및 정리

### P2 (Medium) - 고급 Git

#### 1. Interactive Rebase

```
┌─ Interactive Rebase ───────────────────────────┐
│                                                │
│ Rebase feat/user-profile onto main             │
│                                                │
│ Drag to reorder commits:                       │
│                                                │
│ [pick] feat: Add UserProfile component         │
│ [squash] fix: Fix typo in UserProfile         │
│ [pick] test: Add UserProfile tests             │
│ [edit] style: Add CSS (will pause here)        │
│ [drop] debug: Add console.logs                 │
│                                                │
│ Actions:                                       │
│ • pick - keep commit as-is                     │
│ • squash - merge with previous commit          │
│ • edit - pause to amend commit                 │
│ • drop - remove commit                         │
│                                                │
│ [Start Rebase] [Cancel]                        │
└────────────────────────────────────────────────┘
```

#### 2. Cherry-pick UI

```
┌─ Cherry Pick ──────────────────────────────────┐
│                                                │
│ Select commits to apply to current branch:     │
│                                                │
│ From: feat/experimental                        │
│                                                │
│ ☑ abc1234 - Fix authentication bug             │
│ ☐ def5678 - Add experimental UI (conflicts?)   │
│ ☑ ghi9012 - Update dependencies                │
│                                                │
│ [Apply Selected] [Cancel]                      │
└────────────────────────────────────────────────┘
```

---

## **Phase 7: 배포 & 모니터링**

> **목표**: 배포 프로세스 통합 및 프로덕션 모니터링

### P1 (High) - 배포 통합

#### 1. Deployment Panel

```
┌─ DEPLOYMENTS ──────────────────────────────────┐
│                                                │
│ 🚀 Production                                  │
│    ✓ main@abc1234 (2 hours ago)               │
│    https://app.example.com                     │
│    • Build time: 2m 15s                        │
│    • Deploy time: 45s                          │
│    [View Logs] [Rollback]                      │
│                                                │
│ 🧪 Preview Deployments (3)                     │
│    ✓ feat/new-ui@def5678 (active)             │
│      https://feat-new-ui-abc.vercel.app        │
│      [Open] [View Logs] [Promote to Prod]      │
│                                                │
│    ✓ fix/auth@ghi9012                          │
│      https://fix-auth-xyz.vercel.app           │
│      [Open] [View Logs]                        │
│                                                │
│ [Deploy Current Branch]                        │
└────────────────────────────────────────────────┘
```

**지원 플랫폼**:
- Vercel (MCP 서버 이미 있음)
- Netlify
- AWS (CloudFormation)
- Railway
- Fly.io

#### 2. 환경 변수 관리

```
┌─ ENVIRONMENT VARIABLES ────────────────────────┐
│                                                │
│ Environment: [Production ▼]                   │
│                                                │
│ DATABASE_URL                                   │
│ postgres://...                                 │
│ [Edit] [Delete]                                │
│                                                │
│ API_KEY                                        │
│ sk-••••••••••••••••                            │
│ 🔒 Encrypted                                   │
│ [Edit] [Delete]                                │
│                                                │
│ NEXT_PUBLIC_APP_URL                            │
│ https://app.example.com                        │
│ [Edit] [Delete]                                │
│                                                │
│ [+ Add Variable] [Import from .env]            │
│                                                │
│ ⚠ Local .env files are for development only   │
│   Use this panel for production secrets       │
└────────────────────────────────────────────────┘
```

**보안 기능**:
- 민감한 값 마스킹
- 1Password/Bitwarden 통합
- Git에 커밋 방지
- 환경별 분리 (dev/staging/prod)

#### 3. 빌드 로그 스트리밍

```
┌─ DEPLOY LOG: feat/new-ui ─────────────────────┐
│                                                │
│ 14:32:01 ▶ Building...                         │
│ 14:32:03   ✓ Cloning repository                │
│ 14:32:05   ✓ Installing dependencies          │
│ 14:32:45   ✓ Running build command            │
│ 14:34:12   ✓ Optimizing assets                │
│ 14:34:30   ✓ Generating static pages           │
│ 14:34:55 ▶ Deploying...                        │
│ 14:35:02   ✓ Uploading to CDN                  │
│ 14:35:15   ✓ Configuring domains               │
│ 14:35:20 ✓ Deployment complete!                │
│                                                │
│ URL: https://feat-new-ui-abc.vercel.app        │
│                                                │
│ [Copy URL] [Open] [Download Logs]              │
└────────────────────────────────────────────────┘
```

### P2 (Medium) - 모니터링

#### 1. Performance Monitoring

**Vercel Analytics 통합**:
```
┌─ ANALYTICS ────────────────────────────────────┐
│                                                │
│ Time Range: [Last 7 days ▼]                   │
│                                                │
│ Core Web Vitals                                │
│ • LCP: 1.2s (Good)                             │
│ • FID: 45ms (Good)                             │
│ • CLS: 0.05 (Good)                             │
│                                                │
│ Top Pages by Traffic                           │
│ 1. /dashboard - 12.3k views                    │
│ 2. /profile - 8.1k views                       │
│ 3. /settings - 3.2k views                      │
│                                                │
│ Slowest Pages                                  │
│ 1. /dashboard - 2.8s avg                       │
│ 2. /reports - 2.1s avg                         │
│                                                │
│ [View Full Report]                             │
└────────────────────────────────────────────────┘
```

#### 2. Error Tracking

**Sentry 통합**:
```
┌─ ERRORS ───────────────────────────────────────┐
│                                                │
│ Filters: [Last 24h ▼] [Unresolved ▼]          │
│                                                │
│ 🔴 TypeError: Cannot read property 'id'        │
│    Occurred 42 times in last hour              │
│    Affecting 12 users                          │
│                                                │
│    at fetchUser (api.ts:48)                    │
│    at handleClick (UserProfile.tsx:18)         │
│                                                │
│    [Jump to Code] [Mark Resolved] [Ignore]     │
│                                                │
│ 🟡 Network Error: Failed to fetch              │
│    Occurred 8 times today                      │
│    Affecting 3 users                           │
│                                                │
│    [View Details] [Mark Resolved]              │
│                                                │
└────────────────────────────────────────────────┘
```

**기능**:
- 에러 클릭 시 해당 코드 위치로 이동
- Source map 자동 연동
- 사용자 영향도 분석
- 에러 트렌드 그래프

---

## **Phase 8: UX & 생산성 개선**

> **목표**: 일상적인 워크플로우 최적화

### P0 (Critical) - 기본 UX

#### 1. Command Palette 강화

**현재**: Quick Open만 있음 (`Cmd+P`)
**추가**: Command Palette (`Cmd+Shift+P`)

```
┌─ Command Palette ──────────────────────────────┐
│                                                │
│ > [run build_______________]                   │
│                                                │
│ Tasks: Run Build Script                        │
│ Git: Commit Changes                     Cmd+Enter│
│ File: Save All                          Cmd+K S│
│ View: Toggle Terminal                   Ctrl+` │
│ AI: Generate Tests for Current File            │
│ Search: Find in Files                   Cmd+Shift+F│
│ Debug: Start Debugging                  F5     │
│ Terminal: Create New Terminal           Ctrl+Shift+`│
│                                                │
│ Recently Used:                                 │
│ • Run Dev Server                               │
│ • Format Document                              │
│ • Toggle Git Blame                             │
│                                                │
└────────────────────────────────────────────────┘
```

**기능**:
- 모든 명령 검색 가능
- 퍼지 매칭
- 최근 사용 명령 우선 표시
- 키보드 단축키 표시
- Custom commands 추가 가능

#### 2. Notification Center

**Status Bar 알림 아이콘**:
```
┌─ Notifications ────────────────────────────────┐
│                                                │
│ ✓ Build completed successfully (2m ago)        │
│   [View Output]                                │
│                                                │
│ ✗ 2 tests failed (5m ago)                      │
│   • UserProfile: handles click event           │
│   • useAuth: logs out correctly                │
│   [Run Failed Tests] [View]                    │
│                                                │
│ 💬 Sarah commented on PR #42 (10m ago)         │
│   "Looks good! Just one question..."           │
│   [View PR]                                    │
│                                                │
│ ⚠ 3 security vulnerabilities found (1h ago)    │
│   [View Details] [Fix All]                     │
│                                                │
│ [Clear All]                                    │
└────────────────────────────────────────────────┘
```

**알림 설정**:
- 빌드 완료
- 테스트 실패
- PR 리뷰 요청
- Git push 성공/실패
- 배포 완료
- 보안 경고

#### 3. Recent Files (Cmd+E)

```
┌─ Recent Files ─────────────────────────────────┐
│                                                │
│ Filter: [____________]                         │
│                                                │
│ Today                                          │
│ • UserProfile.tsx (5 minutes ago)              │
│ • api.ts (10 minutes ago)                      │
│ • useAuth.ts (30 minutes ago)                  │
│                                                │
│ Yesterday                                      │
│ • Dashboard.tsx                                │
│ • utils.ts                                     │
│                                                │
│ Pinned                                         │
│ 📌 App.tsx                                     │
│ 📌 types.ts                                    │
│                                                │
└────────────────────────────────────────────────┘
```

### P1 (High) - 생산성 도구

#### 1. Refactoring Tools

**Context Menu**: 코드 선택 → "Refactor..."

```
┌─ Refactor ─────────────────────────────────────┐
│                                                │
│ • Rename Symbol                         F2     │
│ • Extract Function                      Ctrl+Shift+R│
│ • Extract Variable                             │
│ • Extract Constant                             │
│ • Inline Variable                              │
│ • Move to New File                             │
│ • Convert to Arrow Function                    │
│ • Convert to Async/Await                       │
│                                                │
└────────────────────────────────────────────────┘
```

**예시: Extract Function**
```typescript
// Before (선택된 코드)
const result = data
  .filter(item => item.active)
  .map(item => item.id)
  .sort();

// After
const result = getActiveIds(data);

function getActiveIds(data: Item[]): number[] {
  return data
    .filter(item => item.active)
    .map(item => item.id)
    .sort();
}
```

#### 2. Code Actions

**Quick Fix (Cmd+.)**:
```
┌─ Quick Fix ────────────────────────────────────┐
│                                                │
│ • Add missing import                           │
│ • Add type annotation                          │
│ • Remove unused variable                       │
│ • Fix ESLint error                             │
│ • Convert to template literal                  │
│ • Add await                                    │
│                                                │
└────────────────────────────────────────────────┘
```

**Batch Actions**:
- "Organize Imports" - 모든 import 정리
- "Remove Unused Imports" - 미사용 import 제거
- "Fix All ESLint" - 자동 수정 가능한 모든 린트 에러 수정

#### 3. Workspace Presets

**레이아웃 저장/복원**:
```
┌─ Workspace Presets ────────────────────────────┐
│                                                │
│ Built-in Presets:                              │
│ • Frontend Dev                                 │
│   Editor (60%) + Browser Preview (40%)         │
│                                                │
│ • Backend Dev                                  │
│   Editor (50%) + Terminal (30%) + Logs (20%)   │
│                                                │
│ • Code Review                                  │
│   Diff View (70%) + PR Comments (30%)          │
│                                                │
│ • Debugging                                    │
│   Editor (50%) + Debug Panel (30%) + Console (20%)│
│                                                │
│ Custom Presets:                                │
│ • My Full Stack Setup                          │
│   [Load] [Edit] [Delete]                       │
│                                                │
│ [+ Save Current Layout]                        │
└────────────────────────────────────────────────┘
```

### P2 (Medium) - 고급 UX

#### 1. Vim Mode

**Settings > Keybindings**:
```
☐ Enable Vim mode

Vim Configuration:
• Leader key: [Space]
• Relative line numbers: ☑
• System clipboard: ☑
• Custom mappings: [Configure]
```

**구현**: Monaco vim extension

#### 2. Zen Mode

**단축키**: `Cmd+K Z`

```
전체 화면 에디터
사이드바, 패널, 탭바 모두 숨김
Esc로 나가기
```

**Settings**:
- Center layout (에디터 중앙 정렬)
- Max line width
- Hide line numbers
- Hide minimap

#### 3. Minimap

**Editor 오른쪽에 표시**:
```
┌──────────────────┬─┐
│                  │█│ ← Minimap (코드 전체 미리보기)
│   Code here      │ │
│                  │█│
│                  │ │
│                  │█│
└──────────────────┴─┘
```

**기능**:
- 현재 viewport 하이라이트
- 검색 매칭 표시
- Git diff 표시
- 클릭하여 이동

---

## **Phase 9: 확장성 & 커스터마이징**

> **목표**: 사용자/팀이 Octave를 자신의 워크플로우에 맞게 확장

### P1 (High) - Extension System

#### 1. Octave Extension API

**Extension 구조**:
```typescript
// extension.ts
import { OctaveExtension } from '@circuit/api';

export function activate(context: ExtensionContext) {
  // 1. Register a command
  context.registerCommand('myExtension.sayHello', () => {
    context.window.showMessage('Hello from my extension!');
  });

  // 2. Add a status bar item
  const statusBar = context.createStatusBarItem();
  statusBar.text = '$(rocket) My Extension';
  statusBar.command = 'myExtension.openPanel';
  statusBar.show();

  // 3. Register a language provider
  context.registerCompletionProvider('typescript', {
    provideCompletions(document, position) {
      return [
        {
          label: 'myCustomSnippet',
          insertText: 'console.log("Custom!");',
        },
      ];
    },
  });

  // 4. Add a panel
  context.registerPanel({
    id: 'myExtension.panel',
    title: 'My Extension',
    render: () => <MyExtensionPanel />,
  });

  // 5. Listen to events
  context.onDidOpenTextDocument((doc) => {
    console.log('Opened:', doc.fileName);
  });
}

export function deactivate() {
  // Cleanup
}
```

**Extension Manifest** (`package.json`):
```json
{
  "name": "circuit-eslint-integration",
  "version": "1.0.0",
  "engines": {
    "circuit": "^1.0.0"
  },
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "eslint.fixAll",
        "title": "ESLint: Fix All"
      }
    ],
    "configuration": {
      "title": "ESLint",
      "properties": {
        "eslint.enable": {
          "type": "boolean",
          "default": true
        }
      }
    }
  }
}
```

#### 2. Extension Marketplace

**UI**:
```
┌─ EXTENSIONS ───────────────────────────────────┐
│                                                │
│ [Search extensions...___________] [⚙ Manage]  │
│                                                │
│ Recommended for You                            │
│                                                │
│ 🎨 Theme: Dracula Official                     │
│    ★★★★★ (2.3M installs)                      │
│    [Install]                                   │
│                                                │
│ 🔧 Prettier - Code Formatter                   │
│    ★★★★★ (18M installs)                       │
│    ✓ Installed  [Configure]                    │
│                                                │
│ 🚀 GitLens - Git Supercharged                  │
│    ★★★★★ (12M installs)                       │
│    [Install]                                   │
│                                                │
│ Popular                                        │
│ • Python                                       │
│ • Docker                                       │
│ • REST Client                                  │
│ • Live Server                                  │
│                                                │
└────────────────────────────────────────────────┘
```

**VS Code Extension 호환성**:
- Language providers (일부)
- Themes
- 기본 commands
- Snippets

#### 3. Custom Commands

**`.circuit/commands.json`**:
```json
{
  "commands": [
    {
      "id": "myWorkflow.deployToStaging",
      "title": "Deploy to Staging",
      "sequence": [
        { "type": "bash", "command": "npm run build" },
        { "type": "bash", "command": "npm run test" },
        {
          "type": "ai",
          "prompt": "Review the build output and confirm it's safe to deploy"
        },
        { "type": "bash", "command": "vercel deploy --prod=false" }
      ],
      "keybinding": "Cmd+Shift+D"
    }
  ]
}
```

**실행 시**:
```
┌─ Running: Deploy to Staging ───────────────────┐
│                                                │
│ ✓ Step 1: npm run build (15.2s)               │
│ ✓ Step 2: npm run test (8.1s)                 │
│ ⏳ Step 3: AI Review in progress...            │
│   "Build output looks good. All tests passed.  │
│    Safe to deploy."                            │
│ ⏳ Step 4: vercel deploy --prod=false          │
│                                                │
└────────────────────────────────────────────────┘
```

### P2 (Medium) - 커스터마이징

#### 1. Theme Marketplace

**VS Code theme 가져오기**:
```
Settings > Appearance > Themes

[Import VS Code Theme]

Enter theme name: "Andromeda"
[Search npmjs.com] [Import from file]

✓ Theme imported successfully
  Would you like to use it now? [Yes] [No]
```

#### 2. Custom Keybindings Editor

```
┌─ KEYBOARD SHORTCUTS ───────────────────────────┐
│                                                │
│ Search: [save________________]                 │
│                                                │
│ Command                   Keybinding  When     │
│ ───────────────────────── ────────── ───────── │
│ File: Save                Cmd+S      editorFocus│
│ File: Save All            Cmd+K S    -         │
│ File: Save As             Cmd+Shift+S editorFocus│
│                                                │
│ [+ Add Keybinding]                             │
│                                                │
│ Presets:                                       │
│ • Default                                      │
│ • VS Code                                      │
│ • Vim                                          │
│ • Emacs                                        │
│                                                │
│ [Export] [Import] [Reset to Default]           │
└────────────────────────────────────────────────┘
```

---

## 📊 우선순위 요약

### P0 (Critical) - Q1 2025 목표

**반드시 구현해야 실제 코딩 가능**:

1. **검색 & 네비게이션**
   - Global Search & Replace (Cmd+Shift+F)
   - Find in Current File (Cmd+F)
   - Go to Definition (F12)
   - Find All References (Shift+F12)

2. **에디터 핵심 기능**
   - Auto Import
   - Code Snippets
   - Format on Save
   - Quick Fix (Cmd+.)

3. **테스팅**
   - Test Explorer UI
   - Test 실행/결과 표시
   - Watch mode

4. **패키지 관리**
   - Dependencies Panel
   - 패키지 설치 UI
   - 보안 스캔

5. **UX 기본**
   - Command Palette
   - Notification Center
   - Recent Files

### P1 (High) - Q2 2025 목표

**생산성을 크게 높이는 기능**:

1. **AI 코딩 강화**
   - Inline AI 편집 (Cmd+K)
   - AI Composer
   - AI 코드 리뷰

2. **Git 고급**
   - Git Blame
   - File History
   - Stash 관리

3. **빌드 & 배포**
   - Task Runner
   - Build Output Panel
   - Deployment Panel

4. **Refactoring**
   - Rename Symbol
   - Extract Function
   - Code Actions

5. **Extension System**
   - Extension API
   - Marketplace

### P2 (Medium) - Q3-Q4 2025

**장기적 개선 사항**:

- Visual Debugger
- Live Share
- Performance Monitoring
- Error Tracking
- Vim Mode
- Interactive Rebase
- Custom Keybindings

---

## 🗓️ 구현 로드맵

### **Q1 2025: Foundation (12주)**

#### Week 1-2: 검색 인프라
- ✅ Global Search (ripgrep 통합)
- ✅ Find in Current File
- ✅ Replace in Files

#### Week 3-4: 에디터 강화
- ✅ Auto Import (TypeScript LS)
- ✅ Go to Definition / Find References
- ✅ Code Snippets System

#### Week 5-6: 코드 품질
- ✅ Format on Save (Prettier/ESLint)
- ✅ Quick Fix UI
- ✅ Code Actions

#### Week 7-8: 테스팅
- ✅ Test Explorer (Jest/Vitest)
- ✅ Test 실행/결과 표시
- ✅ Inline test 상태 표시

#### Week 9-10: 패키지 관리
- ✅ Dependencies Panel
- ✅ 패키지 검색/설치
- ✅ 보안 스캔 (npm audit)

#### Week 11-12: UX 개선
- ✅ Command Palette
- ✅ Notification Center
- ✅ Recent Files

**Q1 마일스톤**: Octave로 기본적인 코딩 작업 완전히 가능

---

### **Q2 2025: Productivity (12주)**

#### Week 1-3: AI 코딩 강화
- 🔨 Inline AI 편집 (Cmd+K)
- 🔨 Diff view with Accept/Reject
- 🔨 AI Composer (멀티파일 생성)

#### Week 4-5: Git 고급
- 🔨 Git Blame in editor
- 🔨 File History timeline
- 🔨 Stash 관리 UI

#### Week 6-7: 빌드 시스템
- 🔨 Task Runner
- 🔨 Build Output Panel
- 🔨 Watch mode 통합

#### Week 8-9: 배포
- 🔨 Deployment Panel
- 🔨 환경 변수 관리
- 🔨 빌드 로그 스트리밍

#### Week 10-11: Refactoring
- 🔨 Rename Symbol (F2)
- 🔨 Extract Function/Variable
- 🔨 Move to File

#### Week 12: Extension System
- 🔨 Extension API 설계
- 🔨 Extension loader
- 🔨 기본 extension 포트

**Q2 마일스톤**: Octave가 Cursor/VS Code와 비슷한 생산성 제공

---

### **Q3 2025: Advanced Tools (12주)**

#### Week 1-4: Visual Debugger
- 🔮 Breakpoint 설정
- 🔮 Variables panel
- 🔮 Call stack
- 🔮 Debug console

#### Week 5-6: 협업
- 🔮 PR 뷰 & 코멘트
- 🔮 Branch Management UI
- 🔮 Live Share (실험적)

#### Week 7-8: 모니터링
- 🔮 Performance monitoring
- 🔮 Error tracking (Sentry)
- 🔮 Analytics dashboard

#### Week 9-10: Extension Marketplace
- 🔮 Marketplace UI
- 🔮 Extension discovery
- 🔮 Auto-update

#### Week 11-12: 고급 UX
- 🔮 Workspace Presets
- 🔮 Vim Mode
- 🔮 Minimap

**Q3 마일스톤**: Octave가 전문 개발자 도구로 성숙

---

### **Q4 2025: Polish & Scale (12주)**

- 🔮 Interactive Rebase
- 🔮 Cherry-pick UI
- 🔮 Custom Keybindings Editor
- 🔮 Theme Marketplace
- 🔮 로그 뷰어
- 🔮 성능 프로파일러
- 🔮 코드 리뷰 자동화
- 🔮 팀 설정 동기화

**Q4 마일스톤**: Octave 1.0 정식 출시

---

## 📈 측정 지표 (성공 기준)

### 1. 사용자 리텐션
- **DAU (Daily Active Users)**: Octave를 매일 여는 사용자 수
- **주 평균 세션 시간**: 하루 평균 사용 시간
- **7-day retention**: 설치 후 1주일 후에도 사용하는 비율
- **30-day retention**: 설치 후 1개월 후에도 사용하는 비율

**목표**:
- Q1: 7-day retention 40%
- Q2: 7-day retention 60%, 30-day retention 30%
- Q3: 7-day retention 70%, 30-day retention 50%
- Q4: 7-day retention 80%, 30-day retention 60%

### 2. 기능 사용률

**주간 액티브 사용자 중 각 기능을 사용한 비율**:

| 기능 | Q1 목표 | Q2 목표 | Q3 목표 |
|-----|---------|---------|---------|
| Global Search | 80% | 90% | 95% |
| Auto Import | 70% | 80% | 85% |
| Test Explorer | 40% | 60% | 70% |
| AI 인라인 편집 | - | 50% | 70% |
| Debugger | - | - | 40% |

### 3. 생산성 지표

**사용자 설문 기반 측정**:
- "Octave가 개발 속도를 얼마나 높였나요?" (1-10)
- "Octave를 주요 에디터로 사용하시나요?" (Yes/No)
- "Cursor/VS Code 대비 만족도" (1-10)

**객관적 지표**:
- 평균 코드 작성 시간 (분/파일)
- 평균 디버깅 시간
- 평균 PR 생성 시간

### 4. AI 효율성

- **AI 제안 수용률**: Accept / (Accept + Reject)
  - 목표: >60%
- **AI가 생성한 코드 비율**: AI 생성 / 전체 코드
  - 목표: 30-40%
- **Context 적중률**: AI가 필요한 파일을 찾은 비율
  - 목표: >80%

### 5. 품질 지표

- **버그 리포트**: 주간 버그 리포트 수
- **Crash rate**: 사용자당 크래시 발생 빈도
- **응답 시간**: 주요 작업의 평균 응답 시간
  - Search: <100ms
  - Go to Definition: <200ms
  - AI 응답: <2s (첫 토큰)

### 6. 커뮤니티 성장

- **GitHub Stars**: 목표 10,000 (2025 말)
- **Discord 회원**: 목표 5,000
- **Extension 개수**: 목표 50개
- **기여자 수**: 목표 100명

---

## 🎯 Octave의 차별점 유지

**구현하면서 절대 잊지 말아야 할 것**:

### 1. MCP 우선 설계
- 모든 새 기능은 MCP 서버로 확장 가능해야 함
- Octave = MCP 생태계의 허브
- Cursor는 MCP 소비자, Octave는 MCP 관리자

### 2. Workspace Isolation
- Git worktree 기반 독립 환경
- 각 workspace는 완전히 격리된 컨텍스트
- Branch 간 충돌 없음

### 3. AI Observability
- MCP Timeline - 모든 AI 도구 호출 추적
- 디버깅 가능한 AI
- 성능 측정 가능

### 4. Memory System
- 프로젝트 지식 영구 저장
- AI가 학습하는 시스템
- 팀 지식 공유

### 5. Multi-Repository
- 하나의 UI에서 여러 repo 관리
- Monorepo 친화적
- 마이크로서비스 개발에 최적

---

## 🚦 실행 계획

### **즉시 시작 (This Week)**

1. **Global Search 구현**
   - 파일: `src/components/search/GlobalSearch.tsx` 생성
   - ripgrep Node.js 바인딩 추가
   - Right Panel에 Search 탭 추가

2. **Auto Import**
   - Monaco TypeScript language features 활용
   - Quick Fix provider 추가
   - 단축키 바인딩

3. **Test Explorer 기반**
   - `src/components/testing/TestExplorer.tsx` 생성
   - Jest/Vitest config 파서
   - 테스트 실행 IPC 핸들러

### **다음 스프린트 (Next 2 Weeks)**

1. **Inline AI 편집**
   - Monaco diff editor 통합
   - AI diff 생성 API
   - Accept/Reject UI

2. **Code Snippets**
   - VS Code snippet 파서
   - Snippet storage (SQLite)
   - Monaco snippet provider

3. **Dependencies Panel**
   - package.json / requirements.txt 파서
   - npm registry API 통합
   - npm audit 통합

### **한 달 내 (End of Month)**

1. **Command Palette**
   - 모든 명령 레지스트리 구축
   - Keybinding 시스템
   - 검색 알고리즘

2. **Git Blame**
   - simple-git blame API 사용
   - Gutter decoration
   - Hover tooltip

3. **Test Runner**
   - Jest/Vitest programmatic API
   - 실시간 테스트 결과 스트리밍
   - CodeLens "Run Test" 버튼

---

## 💡 구현 우선순위 결정 원칙

각 기능을 구현할 때 이 순서로 고려:

1. **사용 빈도**: 개발자가 하루에 몇 번 사용하나?
2. **대체 불가능성**: 이것 없으면 Octave를 못 쓰나?
3. **구현 난이도**: ROI (투입 시간 대비 가치)
4. **차별점 강화**: Octave의 고유한 강점을 더 강화하나?
5. **의존성**: 다른 기능의 전제 조건인가?

**예시**:
- **Global Search**: 빈도 ⭐⭐⭐⭐⭐, 대체불가 ⭐⭐⭐⭐⭐, 난이도 ⭐⭐⭐ → **최우선**
- **Vim Mode**: 빈도 ⭐⭐, 대체불가 ⭐, 난이도 ⭐⭐⭐⭐ → **후순위**

---

## 📚 참고 자료

### Cursor 분석
- Cursor 온보딩 플로우
- Cursor Rules 시스템
- Inline editing UX

### VS Code 참고
- [VS Code API](https://code.visualstudio.com/api)
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)

### 경쟁 제품 분석
- Cursor
- Windsurf
- GitHub Copilot
- Replit
- Zed

---

## 🎉 마무리

이 로드맵을 따르면 Octave가 **2025년 말까지 실제 프로덕션 코딩에 완전히 사용 가능한 수준**이 됩니다.

핵심은:
1. **Q1**: 기본 기능 (검색, 편집, 테스팅) - "사용 가능"
2. **Q2**: 생산성 (AI, Git, 빌드) - "Cursor와 비슷"
3. **Q3-Q4**: 고급 기능 (디버깅, 협업, 확장) - "Octave만의 강점"

**Octave의 비전**: "MCP 생태계의 VS Code"

---

**다음 액션**:
1. ✅ 이 문서를 팀과 공유
2. ⏳ Q1 스프린트 계획 수립
3. ⏳ Global Search 구현 시작
4. ⏳ 주간 진행 상황 리뷰 미팅 설정

---

*마지막 업데이트: 2025-11-05*
*작성자: The Architect*
*문서 버전: 1.0*
