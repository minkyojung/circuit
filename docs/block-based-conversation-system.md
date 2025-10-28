# 블록 기반 대화 시스템 설계

> **Version**: 1.0
> **Last Updated**: October 28, 2025
> **Status**: Design Phase

## 📋 목차

1. [개요](#개요)
2. [핵심 철학](#핵심-철학)
3. [전체 아키텍처](#전체-아키텍처)
4. [Command Palette (Cmd+K)](#command-palette-cmdk)
5. [Timeline View (Cmd+T)](#timeline-view-cmdt)
6. [Bookmarks (Cmd+B)](#bookmarks-cmdb)
7. [블록 기반 메시지 시스템](#블록-기반-메시지-시스템)
8. [데이터베이스 스키마](#데이터베이스-스키마)
9. [구현 로드맵](#구현-로드맵)

---

## 개요

### 문제 정의

기존 방식에서는 대화 목록을 UI에 표시하는 데 집중했지만, 실제 사용자가 필요한 것은:
- ❓ "아까 Claude가 알려준 bcrypt 코드 어디갔지?"
- ❓ "어제 bear에서 뭐했더라?"
- ❓ "이 JWT 설명 나중에 다시 봐야 하는데"
- ❓ "다른 워크스페이스에서 비슷한 문제 어떻게 풀었더라?"

### 해결 방안

**대화 목록을 보여주는 게 아니라, 필요한 정보를 빠르게 찾게 하자**

1. **Command Palette**: 통합 검색으로 대화/메시지/코드 즉시 접근
2. **Timeline**: 시간 흐름으로 작업 히스토리 시각화 + Git 통합
3. **Bookmarks**: 중요한 내용 저장 및 재사용
4. **Block-based Storage**: Warp 터미널에서 영감받은 블록 단위 저장

---

## 핵심 철학

### 설계 원칙

```
1. 기본 UI는 최소화 (메시지에 집중)
2. 검색이 기본 행동 (Browse < Search)
3. 키보드 중심 (마우스는 보조)
4. 컨텍스트 기반 추천 (수동 < 자동)
5. 원자 단위로 저장 (블록 기반)
```

### 참고한 제품

- **VSCode Command Palette**: 통합 검색 패러다임
- **Warp Terminal**: 블록 기반 아키텍처
- **Raycast**: 키보드 중심 UX
- **Notion**: 블록 기반 콘텐츠

---

## 전체 아키텍처

### 레이아웃 구조

```
┌─────────────┬──────────────┬─────────────────────┐
│  Sidebar    │   Editor     │  Chat Panel         │
│  (220px)    │   (flex-1)   │  (400-600px)        │
├─────────────┼──────────────┼─────────────────────┤
│ Repository  │              │ ┌─────────────────┐ │
│ Workspaces  │              │ │ 💬 Fix login    │ │
│ Files       │  Code        │ │ [🔍][📅][🔖]   │ │
│             │  Editor      │ └─────────────────┘ │
│             │              │                     │
│             │              │  Messages (Blocks)  │
│             │              │                     │
│             │              │  [Input...]  [Send] │
└─────────────┴──────────────┴─────────────────────┘
```

### 정보 역할 분리

| 영역 | 역할 | 주요 정보 |
|------|------|----------|
| **Left Sidebar** | "Where am I working?" | Repository, Workspace, Files |
| **Center (Editor)** | "What am I editing?" | Code, Diff, Preview |
| **Right Panel** | "What am I discussing?" | Conversation, Messages (Blocks) |

### 기본 상태

- **대화 목록 숨김**: 우측 패널은 현재 대화만 표시
- **검색 중심**: `Cmd+K`로 모든 대화/메시지 검색
- **컨텍스트 전환**: 헤더 아이콘 `[🔍][📅][🔖]`로 빠른 접근

---

## Command Palette (Cmd+K)

### 개념

VSCode/Raycast 스타일의 **통합 검색 인터페이스**. 모든 대화/메시지/블록을 한 곳에서 검색.

### UI 스펙

```
┌─────────────────────────────────────────────┐
│ 🔍 Search conversations, messages, code...  │
├─────────────────────────────────────────────┤
│ 📊 Filters: [All] [bear] [Today] [Bookmarked]│
├─────────────────────────────────────────────┤
│                                             │
│ 💬 CONVERSATIONS                            │
│ ┌─────────────────────────────────────────┐│
│ │ 💬 Fix login bug in authentication      ││
│ │    bear • Oct 28, 2:30 PM • 12 messages ││
│ └─────────────────────────────────────────┘│
│                                             │
│ 💡 MESSAGES                                 │
│ │ "You can use bcrypt for password..."    ││
│ │    From: Fix login bug • 2 hours ago    ││
│ └─────────────────────────────────────────┘│
│                                             │
│ 📦 CODE SNIPPETS                            │
│ │ const hashPassword = async (pwd) => ... ││
│ │    From: Fix login bug • bear           ││
│ └─────────────────────────────────────────┘│
│                                             │
│ 🔖 BOOKMARKS                                │
│ │ ⭐ JWT implementation guide              ││
│ │    Saved Oct 25 • 3 references          ││
│ └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### 동작 방식

#### 1. 기본 상태 (입력 없음)
- **Recent**: 최근 5개 대화
- **Pinned**: 고정된 대화 (있으면)
- **Today**: 오늘 생성/활동한 대화

#### 2. 실시간 검색

```
사용자 입력: "auth"

결과:
💬 Fix login bug in authentication (제목 매칭)
💬 JWT authentication setup (제목 매칭)
💡 "Let's implement authentication..." (메시지 내용 매칭)
📦 function authenticate(user) { ... } (코드 블록 매칭)
```

**검색 범위**:
- 대화 제목
- 메시지 내용 (user + assistant)
- 코드 블록
- 북마크 제목/메모

**매칭 알고리즘**:
- Fuzzy search (오타 허용)
- 단어 순서 무관
- 최근 대화 우선 순위

#### 3. 필터 조합

```
[@bear] 클릭 → bear 워크스페이스만
[Today] 클릭 → 오늘 대화만
[Bookmarked] 클릭 → 북마크된 항목만

조합: [@bear] + [Today] = 오늘 bear에서 한 대화
```

#### 4. 특수 쿼리 (Advanced)

| 쿼리 | 의미 |
|------|------|
| `@bear auth` | bear 워크스페이스에서 "auth" 검색 |
| `#bookmarked jwt` | 북마크된 항목 중 "jwt" 검색 |
| `>code hash` | 코드 블록만 검색 |
| `>command npm` | 명령어 블록만 검색 |
| `yesterday` | 어제 대화 |
| `last week` | 지난주 대화 |

### 키보드 단축키

| 키 | 동작 |
|---|------|
| `Cmd+K` | Command Palette 열기 |
| `↑` `↓` | 결과 탐색 |
| `Enter` | 선택한 대화/메시지 열기 |
| `Cmd+Enter` | 새 탭에서 열기 (미래) |
| `Cmd+Backspace` | 선택한 대화 삭제 |
| `Cmd+B` | 선택한 항목 북마크 |
| `Esc` | 닫기 |
| `Tab` | 필터 순환 |

### 결과 선택 시 동작

#### 대화 선택
→ 해당 대화로 전환
→ Command Palette 닫힘

#### 메시지 선택
→ 해당 대화 열기
→ 선택한 메시지로 스크롤
→ 메시지 하이라이트 (노란 배경 2초)

#### 코드 블록 선택
→ 코드가 포함된 메시지로 이동
→ 코드 블록 하이라이트
→ 자동으로 클립보드 복사 (선택사항)

#### 북마크 선택
→ 북마크된 메시지/블록으로 이동

---

## Timeline View (Cmd+T)

### 개념

시간 흐름으로 모든 대화와 활동을 시각화. **Git 커밋, 파일 변경, 대화를 통합 표시**.

### UI 스펙

```
┌───────────────────────────────────────────┐
│ 📅 Timeline                    [X] Close  │
├───────────────────────────────────────────┤
│ Filters: [@bear] [💬 Chats] [📝 Commits] │
├───────────────────────────────────────────┤
│                                           │
│ 📅 Today, Oct 28                          │
│ ├─────────────────────────────────────┐  │
│ │ 2:30 PM                             │  │
│ │ 💬 Fix login bug                    │  │
│ │ 📍 bear workspace                   │  │
│ │ ├─ 12 messages                      │  │
│ │ ├─ 📝 Commit a3f2b1: "Fix auth"    │  │
│ │ ├─ 📄 Modified: auth.ts, login.tsx │  │
│ │ └─ 🔖 Bookmarked: "bcrypt usage"   │  │
│ │ [Open] [Export] [Delete]            │  │
│ └─────────────────────────────────────┘  │
│                                           │
│ ├─────────────────────────────────────┐  │
│ │ 10:15 AM                            │  │
│ │ 💬 Refactor sidebar                 │  │
│ │ 📍 curitiba workspace               │  │
│ │ ├─ 8 messages                       │  │
│ │ ├─ 📝 WIP (no commit yet)           │  │
│ │ └─ 💡 Status: In progress           │  │
│ │ [Open] [Continue]                   │  │
│ └─────────────────────────────────────┘  │
│                                           │
│ 📅 Yesterday, Oct 27                      │
│ │ 4:20 PM - Add dark mode              │  │
│ │ ✅ Completed • 2 commits             │  │
│ └─ [Show details]                       │  │
└───────────────────────────────────────────┘
```

### 대화 카드 정보

각 대화 카드에 포함되는 정보:

1. **타임스탬프**: 대화 시작/마지막 활동 시간
2. **대화 제목**: 사용자 지정 또는 자동 생성
3. **워크스페이스**: 어디서 작업했는지
4. **메시지 수**: 총 대화 길이
5. **연결된 Git 활동**:
   - 관련 커밋 (같은 파일, 비슷한 시간)
   - 변경된 파일 목록
   - 브랜치 정보
6. **북마크**: 이 대화에서 북마크한 내용
7. **상태**: In progress / Completed / Archived
8. **태그**: (미래) 사용자 지정 태그

### Git 통합 로직

#### 대화-커밋 자동 연결 조건

```typescript
// 대화와 커밋이 "관련있다"고 판단하는 조건
1. 대화 중 언급된 파일이 커밋에 포함됨
2. 대화 시간과 커밋 시간이 가까움 (±2시간)
3. 커밋 메시지에 대화 관련 키워드 포함
4. 같은 워크스페이스/브랜치

// 예시
대화: "Fix login bug" (2:30 PM, auth.ts 언급)
커밋: a3f2b1 "Fix auth validation" (3:15 PM, auth.ts 수정)
→ 자동으로 연결됨
```

#### 수동 연결

- 대화 카드에서 "Link to commit" 버튼
- 커밋 해시 입력 또는 선택

### 필터 기능

```
워크스페이스: [@bear] [@curitiba] [All]
타입: [💬 Chats] [📝 Commits] [🔖 Bookmarks] [All]
날짜: [Today] [Yesterday] [This Week] [This Month] [All Time]
상태: [In Progress] [Completed] [Archived]
```

### 인터랙션

| 액션 | 동작 |
|------|------|
| **카드 클릭** | 해당 대화 열기, Timeline 닫힘 |
| **카드 호버** | 메시지 미리보기 툴팁 표시 |
| **카드 우클릭** | 컨텍스트 메뉴 (Open, Export, Link to commit, Delete) |

---

## Bookmarks (Cmd+B)

### 개념

중요한 메시지/코드/설명을 저장하고 빠르게 접근.

### UI 스펙

```
┌───────────────────────────────────────────┐
│ 🔖 Bookmarks                   [X] Close  │
├───────────────────────────────────────────┤
│ 🔍 Search bookmarks...                    │
├───────────────────────────────────────────┤
│                                           │
│ ⭐ JWT implementation guide               │
│ "Use jsonwebtoken library for..."        │
│ From: Fix login bug • Oct 28             │
│ [Open] [Copy] [Delete]                    │
│                                           │
│ ⭐ Bcrypt password hashing                │
│ ```js                                     │
│ const hash = await bcrypt.hash(pwd, 10)  │
│ ```                                       │
│ From: Fix login bug • Oct 28             │
│ [Open] [Copy code] [Delete]               │
│                                           │
│ + Add current message                     │
└───────────────────────────────────────────┘
```

### 북마크 생성 방법

#### 메시지 북마크
1. 메시지 호버 → 별 아이콘 클릭
2. 또는 메시지 우클릭 → "Bookmark"
3. 북마크 제목 입력 (선택사항)
4. 태그 추가 (선택사항)

#### 코드 블록 북마크
- 코드 블록 위에 "Bookmark this code" 버튼
- 자동으로 코드 + 설명 저장

### 사용 시나리오

1. **나중에 참고**: "이 설명 나중에 봐야지" → 북마크
2. **문서화**: 북마크 모아서 Markdown 내보내기
3. **지식 베이스**: 자주 쓰는 패턴 북마크
4. **빠른 복사**: 코드 스니펫 재사용

---

## 블록 기반 메시지 시스템

### 철학: Warp Terminal에서 영감

Warp 터미널은 Command + Output을 **하나의 블록**으로 묶어서:
- ✅ 독립적 복사 (명령어만, 출력만)
- ✅ 빠른 네비게이션 (블록 간 점프)
- ✅ 재실행 (명령어를 다시 입력창에)
- ✅ 북마크 (특정 블록만 저장)

우리도 메시지를 **블록 단위**로 저장하여:
- ✅ 코드만 복사
- ✅ 특정 설명만 북마크
- ✅ 파일 변경사항만 검색
- ✅ 명령어 실행 + 결과 추적

### 데이터 구조

#### 기존 구조 (블록 없음)

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;  // ← 전체가 하나의 긴 텍스트
  timestamp: number;
}
```

**문제점**:
- ❌ 코드만 복사하려면? → 수동으로 선택
- ❌ 특정 설명만 북마크? → 전체 메시지 북마크
- ❌ 파일 변경사항만 검색? → 불가능

#### 새 구조 (블록 기반)

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  blocks: Block[];  // ← 여러 블록으로 구성
  timestamp: number;
  metadata: MessageMetadata;
}

interface Block {
  id: string;               // 블록 고유 ID
  messageId: string;        // 부모 메시지
  type: BlockType;          // 블록 타입
  content: string;          // 블록 내용
  metadata: BlockMetadata;  // 블록별 메타데이터
  order: number;            // 메시지 내 순서
}

type BlockType =
  | 'text'          // 일반 텍스트/설명
  | 'code'          // 코드 스니펫
  | 'command'       // 실행 가능한 명령어
  | 'file'          // 파일 참조/변경사항
  | 'diff'          // Git diff
  | 'error'         // 에러 메시지/경고
  | 'result'        // 실행 결과/출력
  | 'diagram'       // Mermaid 다이어그램
  | 'link'          // URL/외부 참조
  | 'quote'         // 인용/참조
  | 'list'          // 체크리스트/TODO
  | 'table';        // 표
```

### 블록 타입 상세

#### 1. Text Block (일반 텍스트)

```typescript
{
  type: 'text',
  content: '로그인 버그를 고치려면 bcrypt를 사용해야 합니다.',
  metadata: {}
}
```

**용도**: Claude의 설명, 사용자 질문

---

#### 2. Code Block (코드)

```typescript
{
  type: 'code',
  content: 'const hash = await bcrypt.hash(password, 10);',
  metadata: {
    language: 'typescript',
    fileName: 'auth.ts',
    lineStart: 45,
    lineEnd: 45,
    isExecutable: false
  }
}
```

**특수 기능**:
- `[Copy]` → 코드만 복사
- `[Insert to file]` → 파일에 바로 삽입
- `[Open in editor]` → 에디터에서 해당 줄 열기
- Syntax highlighting

**UI 예시**:

```
┌─────────────────────────────────────┐
│ 📄 auth.ts:45                 [Copy]│
├─────────────────────────────────────┤
│ const hash = await bcrypt.hash(    │
│   password,                         │
│   10                                │
│ );                                  │
├─────────────────────────────────────┤
│ [Insert to file] [Open] [Bookmark] │
└─────────────────────────────────────┘
```

---

#### 3. Command Block (실행 명령어)

```typescript
{
  type: 'command',
  content: 'npm install bcrypt',
  metadata: {
    exitCode: 0,
    executedAt: '2024-10-28T14:30:00Z',
    isExecutable: true
  }
}
```

**특수 기능**:
- `[Run]` → 터미널에서 실행
- 실행 결과를 다음 블록으로 자동 추가

**Warp처럼 실행 결과 블록 자동 추가**:

```
Command Block: npm install bcrypt
   ↓ [Run] 클릭
Result Block (자동 생성):
┌─────────────────────────────────────┐
│ Output:                             │
│ added 1 package in 2.3s             │
│ ✅ Exit code: 0                     │
└─────────────────────────────────────┘
```

---

#### 4. File Block (파일 참조)

```typescript
{
  type: 'file',
  content: 'auth.ts에서 validatePassword 함수를 수정했습니다.',
  metadata: {
    filePath: '/src/auth.ts',
    changeType: 'modified'
  }
}
```

**특수 기능**:
- `[Open file]` → 파일 열기
- 파일 아이콘 + 이름 표시
- Git 상태 표시 (M, A, D)

---

#### 5. Diff Block (Git diff)

```typescript
{
  type: 'diff',
  content: `
- const hash = crypto.createHash('md5');
+ const hash = await bcrypt.hash(password, 10);
  `,
  metadata: {
    filePath: '/src/auth.ts',
    additions: 1,
    deletions: 1
  }
}
```

**특수 기능**:
- Syntax highlighting (diff 문법)
- `[Apply]` → 변경사항 적용
- `[Revert]` → 되돌리기

**UI 예시**:

```
┌─────────────────────────────────────┐
│ 📝 Diff: src/auth.ts   [+1] [-1]   │
├─────────────────────────────────────┤
│ - const hash = crypto.createHash... │ ← 빨간 배경
│ + const hash = await bcrypt.hash... │ ← 초록 배경
├─────────────────────────────────────┤
│ [Apply] [Revert] [Copy]             │
└─────────────────────────────────────┘
```

---

#### 6. Error Block (에러)

```typescript
{
  type: 'error',
  content: 'TypeError: Cannot read property \'hash\' of undefined',
  metadata: {
    fileName: 'auth.ts',
    lineStart: 45
  }
}
```

**특수 UI**:
- 빨간 배경 또는 테두리
- 🚨 아이콘
- `[Fix with AI]` 버튼 (미래)

---

#### 7. Diagram Block (다이어그램)

```typescript
{
  type: 'diagram',
  content: `
graph TD
  A[User] -->|Login| B[Auth Service]
  B -->|Hash| C[bcrypt]
  `,
  metadata: {
    diagramType: 'mermaid'
  }
}
```

**렌더링**:
- Mermaid.js로 실시간 렌더링
- `[Edit]` 버튼으로 수정 가능

---

#### 8. List Block (체크리스트)

```typescript
{
  type: 'list',
  content: `
- [x] Install bcrypt
- [ ] Update auth.ts
- [ ] Write tests
  `,
  metadata: {
    totalItems: 3,
    completedItems: 1
  }
}
```

**인터랙티브**:
- 체크박스 클릭 가능
- 상태 저장
- 진행률 표시 (1/3)

---

### 블록 파싱 규칙

**원본 Claude 응답**:

```markdown
로그인 버그를 고치려면 다음과 같이 bcrypt를 사용하세요:

```typescript
// auth.ts
const hash = await bcrypt.hash(password, 10);
```

먼저 bcrypt를 설치해야 합니다:

```bash
npm install bcrypt
```

이렇게 하면 MD5 대신 안전한 해싱을 사용하게 됩니다.
```

**파싱 결과** (5개 블록):

```typescript
[
  {
    type: 'text',
    content: '로그인 버그를 고치려면 다음과 같이 bcrypt를 사용하세요:',
    order: 0
  },
  {
    type: 'code',
    content: 'const hash = await bcrypt.hash(password, 10);',
    metadata: { language: 'typescript', fileName: 'auth.ts' },
    order: 1
  },
  {
    type: 'text',
    content: '먼저 bcrypt를 설치해야 합니다:',
    order: 2
  },
  {
    type: 'command',
    content: 'npm install bcrypt',
    metadata: { language: 'bash', isExecutable: true },
    order: 3
  },
  {
    type: 'text',
    content: '이렇게 하면 MD5 대신 안전한 해싱을 사용하게 됩니다.',
    order: 4
  }
]
```

### 블록 기반 강력한 기능들

#### 1. 블록별 액션

각 블록에 호버하면 액션 버튼 표시:

```
┌─────────────────────────────────────┐
│ Code Block                    [⋮]  │
│ const hash = ...                    │
│                                     │
│ [Copy] [Insert] [Bookmark] [Share] │
└─────────────────────────────────────┘
```

드롭다운 메뉴:
- 📋 Copy block
- 📌 Bookmark
- 🔗 Copy link to block
- ✏️ Edit in place
- 🗑️ Delete block
- 💬 Add comment

#### 2. 블록 간 참조 (Cross-reference)

```
사용자: "아까 말한 bcrypt 코드 어디갔지?"

Claude: "여기 있습니다: →[Block #abc123]"
         ↑ 클릭하면 해당 블록으로 점프
```

#### 3. 블록 북마크

Command Palette에서 북마크된 블록 검색:

```
Cmd+K → "bcrypt"

Results:
🔖 Code Block: bcrypt.hash(...)
   From: "Fix login bug" • Oct 28
   [Open] [Copy] [Remove bookmark]
```

#### 4. 블록 검색 (세밀한 검색)

```
Cmd+K → ">code bcrypt"

Results:
📦 Code Block (3 results):
   1. const hash = await bcrypt.hash(...)
      From: "Fix login bug" • auth.ts

   2. import bcrypt from 'bcrypt';
      From: "Setup auth" • auth.ts
```

**검색 필터**:
- `>code` → 코드 블록만
- `>command` → 명령어만
- `>file:auth.ts` → auth.ts 관련만
- `>error` → 에러 블록만

#### 5. 블록 재사용

이전 대화의 코드 블록을 현재 대화에 삽입:

```
[Block Selector UI]
┌─────────────────────────────────────┐
│ Select blocks to insert:            │
│ ☑ bcrypt.hash(...) - auth.ts:45    │
│ ☑ bcrypt.compare(...) - auth.ts:67 │
│ ☐ import bcrypt - auth.ts:1        │
│                                     │
│ [Insert selected blocks]            │
└─────────────────────────────────────┘
```

#### 6. 블록 실행 히스토리

Command 블록 실행 기록:

```
Command: npm test
Executed: 5 times
Last run: Oct 28, 3:45 PM
Last exit code: 0

[Run again] [Show all executions]
```

#### 7. 블록 내보내기

선택한 블록만 Markdown으로 내보내기:

```
[Export selected to Markdown]
→ README.md에 바로 붙여넣기 가능
```

---

## 데이터베이스 스키마

### Blocks 테이블

```sql
CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'text', 'code', 'command', etc.
  content TEXT NOT NULL,
  metadata JSON,       -- 블록별 메타데이터
  order_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,

  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_blocks_message_id ON blocks(message_id);
CREATE INDEX idx_blocks_type ON blocks(type);
CREATE INDEX idx_blocks_created_at ON blocks(created_at);

-- Full-text search
CREATE VIRTUAL TABLE blocks_fts USING fts5(
  content,
  content='blocks',
  content_rowid='rowid'
);
```

### Block Metadata 구조

```typescript
interface BlockMetadata {
  // 공통
  createdAt: string;

  // Code 블록
  language?: string;        // 'typescript', 'bash', etc.
  fileName?: string;        // 'auth.ts'
  lineStart?: number;
  lineEnd?: number;
  isExecutable?: boolean;

  // Command 블록
  exitCode?: number;
  executedAt?: string;

  // File 블록
  filePath?: string;
  changeType?: 'created' | 'modified' | 'deleted';

  // Diff 블록
  additions?: number;
  deletions?: number;

  // Link 블록
  url?: string;
  title?: string;

  // 북마크
  isBookmarked?: boolean;
  bookmarkNote?: string;

  // 참조
  referencedBy?: string[];  // 다른 블록이 참조
  references?: string[];    // 이 블록이 참조
}
```

### Block Bookmarks 테이블

```sql
CREATE TABLE block_bookmarks (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  title TEXT,
  note TEXT,
  tags JSON,              -- ['authentication', 'security']
  created_at TEXT NOT NULL,

  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);
```

### Block References 테이블

```sql
CREATE TABLE block_references (
  from_block_id TEXT NOT NULL,
  to_block_id TEXT NOT NULL,
  created_at TEXT NOT NULL,

  PRIMARY KEY (from_block_id, to_block_id),
  FOREIGN KEY (from_block_id) REFERENCES blocks(id) ON DELETE CASCADE,
  FOREIGN KEY (to_block_id) REFERENCES blocks(id) ON DELETE CASCADE
);
```

### Block Executions 테이블

```sql
CREATE TABLE block_executions (
  id TEXT PRIMARY KEY,
  block_id TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  exit_code INTEGER,
  output TEXT,
  duration_ms INTEGER,

  FOREIGN KEY (block_id) REFERENCES blocks(id) ON DELETE CASCADE
);
```

### Conversation Commit Links 테이블

```sql
CREATE TABLE conversation_commit_links (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  commit_hash TEXT NOT NULL,
  auto BOOLEAN NOT NULL,           -- 자동 연결인지
  confidence REAL,                 -- 자동 연결 신뢰도 (0-1)
  linked_at TEXT NOT NULL,

  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_commit_links_conversation ON conversation_commit_links(conversation_id);
CREATE INDEX idx_commit_links_commit ON conversation_commit_links(commit_hash);
```

---

## 구현 로드맵

### Phase 1: Command Palette (1-2주)

**목표**: 기본 통합 검색 기능

- [ ] Command Palette UI (모달)
- [ ] 대화 제목 검색
- [ ] 최근 대화 표시
- [ ] 키보드 네비게이션 (↑↓ Enter Esc)
- [ ] 대화 전환 기능
- [ ] 기본 필터 (워크스페이스, 날짜)

**완료 조건**:
- `Cmd+K`로 검색창 열기
- 대화 제목으로 검색 가능
- Enter로 대화 전환

---

### Phase 2: 블록 기본 시스템 (1-2주)

**목표**: Text, Code, Command 블록만

- [ ] Block 데이터 구조
- [ ] Blocks 테이블 생성
- [ ] 메시지 파싱 (Markdown → Blocks)
- [ ] 블록 렌더링 (Text, Code, Command만)
- [ ] 블록별 Copy 버튼
- [ ] Code 블록 Syntax highlighting

**완료 조건**:
- Claude 응답이 블록으로 파싱됨
- 각 블록별로 Copy 가능
- 코드 블록에 언어별 하이라이팅

---

### Phase 3: Command Palette 고급 검색 (1주)

**목표**: 메시지 내용 및 블록 검색

- [ ] 메시지 내용 검색 (Full-text search)
- [ ] 코드 블록 검색
- [ ] Fuzzy search 알고리즘
- [ ] 블록 타입 필터 (`>code`, `>command`)
- [ ] 검색 결과 하이라이팅
- [ ] 특수 쿼리 (`@workspace`, `#bookmarked`)

**완료 조건**:
- "bcrypt" 검색 시 관련 블록 표시
- `>code hash` 검색으로 코드만 필터

---

### Phase 4: Timeline View (1-2주)

**목표**: 시간 기반 대화 시각화

- [ ] Timeline UI
- [ ] 날짜별 그룹핑
- [ ] 대화 카드 (메시지 수, 워크스페이스 표시)
- [ ] 필터 기능 (워크스페이스, 날짜, 타입)
- [ ] Git 커밋 연동 로직 (자동 연결)
- [ ] 대화 상태 관리 (In progress/Completed)

**완료 조건**:
- `Cmd+T`로 Timeline 표시
- 오늘/어제 대화 시간순 표시
- Git 커밋이 대화 카드에 연결됨

---

### Phase 5: Bookmarks (1주)

**목표**: 중요 내용 저장 및 재사용

- [ ] Bookmark UI (Cmd+B)
- [ ] 메시지 북마크 기능
- [ ] 블록 북마크 기능
- [ ] 북마크 검색
- [ ] 태그 시스템
- [ ] Block Bookmarks 테이블

**완료 조건**:
- 메시지/블록에 ⭐ 아이콘
- `Cmd+B`로 북마크 목록 표시
- Command Palette에서 북마크 검색

---

### Phase 6: 블록 액션 (1주)

**목표**: 블록 인터랙션 강화

- [ ] 블록 호버 → 액션 버튼
- [ ] Command 블록 실행 (`[Run]`)
- [ ] Result 블록 자동 생성
- [ ] 블록 링크 복사
- [ ] 블록 드롭다운 메뉴 (Copy, Bookmark, Edit, Delete)
- [ ] Block Executions 테이블

**완료 조건**:
- Command 블록에서 `[Run]` 클릭 시 실행
- 실행 결과가 Result 블록으로 자동 추가
- 각 블록마다 [⋮] 메뉴 표시

---

### Phase 7: 고급 블록 타입 (1주)

**목표**: Diff, File, Error, Diagram 블록

- [ ] File 블록 렌더링
- [ ] Diff 블록 (Git diff syntax highlighting)
- [ ] Error 블록 (빨간 테두리)
- [ ] Diagram 블록 (Mermaid.js 렌더링)
- [ ] List 블록 (체크리스트 인터랙티브)

**완료 조건**:
- Diff 블록이 +/- 색상으로 표시
- Mermaid 다이어그램 렌더링
- 체크리스트 클릭 시 상태 저장

---

### Phase 8: 블록 검색 & 참조 (1주)

**목표**: 블록 간 연결 및 재사용

- [ ] 블록 타입별 검색 필터
- [ ] 블록 간 참조 시스템 (→[Block #abc])
- [ ] 블록 재사용 UI (Block Selector)
- [ ] Block References 테이블
- [ ] 참조된 블록 하이라이팅

**완료 조건**:
- `>code:auth.ts` 검색으로 파일별 코드 필터
- 블록 링크 클릭 시 해당 블록으로 점프
- 이전 대화 블록을 현재 대화에 삽입 가능

---

### Phase 9: 내보내기 & 고급 기능 (1주)

**목표**: 외부 도구 연동

- [ ] Markdown 내보내기 (대화 전체)
- [ ] 북마크 모음 내보내기
- [ ] 선택한 블록만 내보내기
- [ ] 대화 아카이브
- [ ] Pin conversation
- [ ] 대화 상태 자동 감지 (완료/진행중)

**완료 조건**:
- 대화를 Markdown으로 내보내기
- 북마크를 하나의 파일로 내보내기
- Pin된 대화가 Command Palette 상단에 고정

---

## 총 예상 시간

| Phase | 기능 | 예상 시간 |
|-------|------|----------|
| 1 | Command Palette | 1-2주 |
| 2 | 블록 기본 시스템 | 1-2주 |
| 3 | 고급 검색 | 1주 |
| 4 | Timeline View | 1-2주 |
| 5 | Bookmarks | 1주 |
| 6 | 블록 액션 | 1주 |
| 7 | 고급 블록 타입 | 1주 |
| 8 | 블록 검색 & 참조 | 1주 |
| 9 | 내보내기 & 고급 | 1주 |
| **총계** | | **9-12주** |

---

## 성공 지표

### 정량적 지표

- **검색 속도**: < 100ms (1000개 대화 기준)
- **블록 파싱 속도**: < 50ms per message
- **Command Palette 응답 시간**: < 50ms
- **Timeline 로딩**: < 200ms

### 정성적 지표

- ✅ 사용자가 "아까 뭐라고 했지?" → 5초 안에 찾기
- ✅ 코드 재사용 시 복사-붙여넣기 대신 블록 삽입
- ✅ 작업 히스토리를 Timeline에서 한눈에 파악
- ✅ 중요한 내용은 북마크로 저장하여 반복 활용

---

## 참고 자료

### 영감받은 제품

- [Warp Terminal - Blocks](https://docs.warp.dev/features/blocks)
- [VSCode Command Palette](https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette)
- [Raycast](https://www.raycast.com/)
- [Notion - Blocks](https://www.notion.so/)

### 관련 기술

- **Full-text Search**: SQLite FTS5
- **Fuzzy Search**: Fuse.js
- **Markdown Parsing**: Marked.js
- **Syntax Highlighting**: Shiki / Prism
- **Diagram Rendering**: Mermaid.js
- **Git Integration**: Simple-git

---

## 다음 단계

1. **검토**: 이 문서를 팀과 공유하고 피드백 수집
2. **프로토타입**: Phase 1 (Command Palette) 빠르게 구현
3. **사용자 테스트**: 프로토타입으로 UX 검증
4. **반복 개선**: 피드백 반영하여 설계 업데이트
5. **본격 구현**: Phase 2부터 순차적으로 구현

---

**문서 버전**: 1.0
**최종 수정**: 2025-10-28
**작성자**: Claude + William Jung
