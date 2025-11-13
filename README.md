# Octave

> **AI-Native Desktop IDE** - Chat와 Code Editor가 하나로 통합된 워크플로우

Octave는 AI 기반 개발을 위한 데스크톱 애플리케이션입니다. VS Code처럼 코드를 작성하면서 동시에 Claude와 실시간으로 대화하고, 파일 수정, Git 작업, 터미널 실행을 하나의 화면에서 처리할 수 있습니다.

---

## ✨ 주요 기능

### 🤖 AI Chat + Code Editor 통합
- **Split View**: 왼쪽에 Chat, 오른쪽에 Code Editor
- **실시간 파일 수정**: AI가 제안한 변경사항을 즉시 에디터에 반영
- **Multi-conversation**: 워크스페이스별 대화 내역 관리
- **Block 기반 렌더링**: 코드, Diff, Diagram(Mermaid), 테이블 등 구조화된 응답

### 📂 Workspace 기반 격리
- **Git Worktree 통합**: 각 워크스페이스는 독립된 Git 브랜치
- **멀티 워크스페이스**: 하나의 프로젝트에서 여러 작업 동시 진행
- **컨텍스트 격리**: 워크스페이스마다 별도의 대화 내역과 파일 상태

### 🛠 Agent System
- **Task 기반 실행**: Claude Code CLI를 활용한 자동화 작업
- **Background Workers**: 백그라운드에서 장시간 실행되는 작업 처리
- **Todo/Task 관리**: AI가 작업을 계획하고 단계별로 실행
- **Plan Mode**: 복잡한 작업을 AI가 미리 계획하고 사용자 승인 후 실행

### 🎨 개발자 경험
- **Monaco Editor**: VS Code와 동일한 에디터 경험
- **LSP 지원**: 언어별 자동완성, 타입 체크, 에러 표시
- **통합 터미널**: xterm 기반 터미널, 셸 훅 관리
- **Git 통합**: Status, Commit, Branch, PR 관리
- **Quick File Open**: `Cmd/Ctrl+P`로 빠른 파일 검색

### 🔌 확장성
- **MCP 통합**: Model Context Protocol 기반 외부 도구 연결
- **GitHub 연동**: OAuth 인증, PR/Issue 관리
- **Multi-model 지원**: Claude 3.5 Sonnet, Claude 3 Haiku 등 선택 가능
- **커스텀 설정**: AI Rules, 터미널 설정, 테마 등

---

## 🚀 빠른 시작

### 설치

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 프로덕션 빌드
npm run build
npm run package
```

### 시스템 요구사항

- **Node.js**: v20 이상
- **npm**: v9 이상
- **OS**: macOS, Linux (Windows 지원 예정)
- **Claude Code CLI**: 필수 (인증용)

---

## 📁 프로젝트 구조

```
octave/
├── src/                           # React 프론트엔드
│   ├── App.tsx                    # 메인 앱 (워크스페이스/탭 관리)
│   ├── components/
│   │   ├── workspace/             # Chat/Editor 패널
│   │   ├── blocks/                # 블록 렌더러 (코드, Diff, 다이어그램 등)
│   │   ├── git/                   # Git UI
│   │   ├── settings/              # 설정 패널
│   │   ├── editor/                # 탭/에디터 그룹 관리
│   │   └── ...
│   ├── services/
│   │   ├── IPCEventBridge.ts      # Electron IPC 통신
│   │   ├── MessageProcessor.ts    # Chat 메시지 파싱
│   │   └── ...
│   ├── hooks/                     # React hooks
│   ├── contexts/                  # React contexts
│   └── types/                     # TypeScript 타입 정의
│
└── electron/                      # Electron 메인 프로세스
    ├── main.cjs                   # 진입점
    ├── conversationHandlers.ts    # Chat IPC 핸들러
    ├── conversationStorage.ts     # SQLite 대화 저장소
    ├── agentManager.ts            # Agent 실행 관리
    ├── agentWorker.ts             # Task 실행 워커
    ├── mcp-manager.ts             # MCP 서버 관리
    ├── gitHandlers.ts             # Git 작업
    ├── lspClient.ts               # LSP 클라이언트
    └── terminalManager.ts         # 터미널 관리
```

---

## 🏗 기술 스택

### Frontend
- **React 19** + **Vite** (번들링)
- **TypeScript** (타입 안전성)
- **Tailwind CSS** + **Radix UI** (UI 컴포넌트)
- **Monaco Editor** (코드 에디팅)
- **xterm.js** (터미널)
- **Mermaid** (다이어그램)
- **React Markdown** + **Shiki** (마크다운/코드 하이라이팅)
- **Framer Motion** (애니메이션)

### Backend (Electron)
- **Electron 38** (데스크톱 앱)
- **better-sqlite3** (로컬 DB)
- **simple-git** (Git 작업)
- **chokidar** (파일 감시)
- **node-pty** (터미널 에뮬레이션)

### AI & Integrations
- **@modelcontextprotocol/sdk** (MCP 프로토콜)
- **@anthropic-ai/tokenizer** (토큰 카운팅)
- **Claude Code CLI** (Agent 실행)
- **Vercel AI SDK** (스트리밍 Chat)

---

## 🎯 핵심 개념

### 1. Conversation Storage
- **SQLite 기반**: 대화 내역, 메시지, 블록 구조화 저장
- **Workspace 격리**: 각 워크스페이스는 독립된 대화 리스트
- **Block 단위 파싱**: Text, Code, Diff, Diagram, Command 등으로 구조화

### 2. Agent System
- **Claude Code CLI 통합**: 서브프로세스로 실행하여 파일 수정, 검색 등 수행
- **Task Queue**: 순차적 또는 병렬 실행
- **Status Tracking**: pending → in_progress → completed
- **Error Handling**: 실패 시 재시도 또는 사용자 알림

### 3. MCP Runtime (개발 중)
- **서버 라이프사이클 관리**: install/start/stop/restart
- **Health Monitoring**: 30초마다 헬스체크
- **Tool/Prompt Discovery**: MCP 서버가 제공하는 기능 자동 탐색
- **Playground Mode**: 설치 전 기능 테스트 (계획 중)

### 4. Workspace Isolation
- **Git Worktree**: 각 워크스페이스는 별도 브랜치
- **Independent State**: 파일 변경, 대화 내역, Git 상태 독립
- **PR Integration**: 워크스페이스별 PR 연결 (planned)

---

## 🧪 테스트

```bash
# 유닛 테스트 실행
npm test

# UI 테스트 (Vitest UI)
npm run test:ui

# Coverage 리포트
npm run test:coverage
```

---

## 🔧 개발 가이드

### IPC 통신
- **Frontend → Backend**: `window.electronAPI.*` 사용
- **Backend → Frontend**: `mainWindow.webContents.send` 사용
- **파일 위치**: `octave/electron/preload.ts`, `octave/src/services/IPCEventBridge.ts`

### 새 기능 추가
1. **Frontend**: `src/components/` 에 React 컴포넌트 추가
2. **Backend**: `electron/*Handlers.ts` 에 IPC 핸들러 추가
3. **IPC 연결**: `preload.ts`와 `IPCEventBridge.ts`에 메서드 등록
4. **타입 정의**: `src/types/` 에 TypeScript 타입 추가

### Database 스키마 수정
- **파일**: `octave/electron/conversationStorage.ts`
- **마이그레이션**: `initDatabase()` 함수에서 `CREATE TABLE` 수정
- **주의**: 기존 데이터 백업 필요

---

## 🗺 로드맵

### 현재 상태 (v0.0.4)
- ✅ Chat + Code Editor 통합
- ✅ Workspace 관리
- ✅ Agent System (Claude Code CLI)
- ✅ Git 통합
- ✅ 통합 터미널
- ✅ 자동 업데이트

### 계획 중
- [ ] **MCP Package Manager**: MCP 서버 검색/설치/관리 UI
- [ ] **Test-Fix Loop**: 코드 변경 감지 → 자동 테스트 → AI 피드백
- [ ] **Unified Context**: 외부 문서/로그/슬랙 통합
- [ ] **Deployment Intelligence**: 배포 전 자동 검증
- [ ] **AI Code Review**: PR 자동 리뷰 및 제안

자세한 내용은 [PRODUCT_VISION.md](./PRODUCT_VISION.md) 및 [IDEAS.md](./IDEAS.md) 참고

---

## 📚 추가 문서

- **[PRODUCT_VISION.md](./PRODUCT_VISION.md)**: MCP Package Manager 비전
- **[IDEAS.md](./IDEAS.md)**: JTBD 아이디어 & 로드맵
- **[AGENT_WORKER_ARCHITECTURE.md](./AGENT_WORKER_ARCHITECTURE.md)**: Agent System 상세 설계
- **[WORKSPACE_ARCHITECTURE.md](./WORKSPACE_ARCHITECTURE.md)**: Workspace 격리 원리
- **[MCP_RUNTIME_ARCHITECTURE.md](./MCP_RUNTIME_ARCHITECTURE.md)**: MCP 런타임 설계
- **[FEATURE_ROADMAP.md](./FEATURE_ROADMAP.md)**: 기능별 구현 계획

---

## 🤝 기여

현재 활발하게 개발 중입니다. 이슈나 PR은 환영합니다!

### 개발 환경 설정
```bash
# 1. 저장소 클론
git clone <repository-url>
cd octave

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

### 코드 스타일
- **ESLint**: `npm run lint` 로 확인
- **TypeScript**: 엄격한 타입 체크 (`strict: true`)
- **Component**: Radix UI + Tailwind CSS 사용
- **Hooks**: Custom hooks는 `src/hooks/` 에 작성

---

## 📄 라이선스

MIT License

---

## 🔗 관련 링크

- **Anthropic Claude**: https://claude.ai
- **Model Context Protocol (MCP)**: https://modelcontextprotocol.io
- **Electron**: https://www.electronjs.org
- **Monaco Editor**: https://microsoft.github.io/monaco-editor

---

_Last Updated: 2025-11-11_
_Version: 0.0.4_