# Circuit App Store 등록 분석: 온보딩 설계 및 기능 제약사항

**작성일**: 2025-11-07
**목적**: App Store 등록을 위한 온보딩 플로우 설계, 유저 요구사항 정리, 지원 불가 기능 파악

---

## 📋 목차

1. [앱 개요](#1-앱-개요)
2. [시스템 요구사항](#2-시스템-요구사항)
3. [필수 사전 준비사항](#3-필수-사전-준비사항)
4. [온보딩 플로우 설계 (제안)](#4-온보딩-플로우-설계-제안)
5. [필수 권한 및 설정](#5-필수-권한-및-설정)
6. [현재 지원하지 않는 기능](#6-현재-지원하지-않는-기능)
7. [App Store 등록 전 필수 사항](#7-app-store-등록-전-필수-사항)
8. [유저 여정 분석](#8-유저-여정-분석)
9. [위험 요소 및 대응 방안](#9-위험-요소-및-대응-방안)

---

## 1. 앱 개요

### 1.1 Circuit이란?

**Circuit**은 개발자를 위한 macOS 전용 데스크톱 애플리케이션으로, **MCP(Model Context Protocol) 패키지 매니저**이자 **AI 기반 개발 도우미**입니다.

**핵심 가치 제안**:
- **MCP 서버 통합 관리**: npm처럼 MCP 서버를 검색, 설치, 업데이트
- **Claude AI와의 실시간 대화**: 확장된 사고(Extended Thinking), 계획(Planning) 모드 지원
- **Git Worktree 기반 워크스페이스**: 브랜치별 격리된 작업 환경
- **터미널 통합**: Warp 스타일 커맨드 블록으로 명령어 실행 및 결과 확인
- **메모리/컨텍스트 관리**: 토큰 사용량 최적화 및 장기 기억 저장

**원래 목적**: 테스트 자동 수정 도구 → **진화**: MCP 생태계 관리 플랫폼

---

### 1.2 타겟 유저

**주요 타겟**:
1. **MCP DIY러 (50%)** - AI로 간단한 MCP 서버를 만들고 테스트하려는 개발자
2. **MCP 초보 탐험가 (30%)** - Claude, Cursor 등 AI 코딩 도구를 3-6개월 사용했으나 MCP 활용법을 모르는 사용자
3. **MCP 파워유저 (20%)** - 10개 이상의 MCP 서버를 설치하고 적극 활용하는 사용자

**Pain Points**:
- "MCP 서버를 설치했는데 제대로 작동하는지 확인할 방법이 없음"
- "테스트 사이클이 너무 느림 (5분/회 × 10회 = 50분)"
- "서버가 제공하는 기능을 발견할 방법이 없음"

---

## 2. 시스템 요구사항

### 2.1 하드웨어 요구사항

| 항목 | 최소 사양 | 권장 사양 |
|------|----------|----------|
| **운영체제** | macOS 12 (Monterey) 이상 | macOS 13 (Ventura) 이상 |
| **프로세서** | Intel Core i5 또는 Apple M1 | Apple M2 이상 |
| **메모리** | 8GB RAM | 16GB RAM 이상 |
| **저장공간** | 500MB 여유 공간 | 1GB 여유 공간 |
| **디스플레이** | 1280x800 이상 | 1920x1080 이상 |

**특별 요구사항**:
- **Git 설치 필수** (Command Line Tools 포함)
- **Node.js 18 이상** 설치 필수
- **인터넷 연결** 필수 (Claude AI API 통신)

---

### 2.2 소프트웨어 종속성

**필수 설치 항목**:

1. **Claude Code CLI** (`~/.claude/local/claude`)
   - Circuit의 AI 기능은 Claude Code CLI에 의존
   - 사용자의 기존 Claude Code 인증 재사용
   - **설치 방법**: [https://claude.ai/download](https://claude.ai/download)
   - **검증 방법**: 터미널에서 `~/.claude/local/claude --version` 실행

2. **Git** (버전 2.25 이상)
   - Git worktree 기능 사용 (브랜치별 격리 작업공간)
   - **설치 확인**: `git --version`

3. **Node.js** (18.x 이상)
   - MCP 서버 실행에 필요
   - **설치 확인**: `node --version`

**선택 설치 항목**:
- **Vercel MCP 통합** (선택) - Vercel 프로젝트 관리용
  - 환경변수: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`

---

## 3. 필수 사전 준비사항

### 3.1 유저가 직접 해야 하는 것들

**1단계: Claude Code 계정 및 CLI 설치**
```bash
# Claude Code CLI 다운로드 및 설치
# https://claude.ai/download 에서 macOS용 다운로드

# 설치 확인
~/.claude/local/claude --version

# 로그인 (최초 1회)
~/.claude/local/claude login
```

**중요**: Circuit은 독립적인 AI API 키를 요구하지 않음. 사용자의 기존 Claude Code 인증을 재사용합니다.

---

**2단계: Git 설정**
```bash
# Git 설치 확인
git --version

# Git 사용자 정보 설정 (최초 1회)
git config --global user.name "Your Name"
git config --global user.email "your@email.com"

# 기존 프로젝트를 Git 저장소로 초기화 (필요시)
cd /path/to/your/project
git init
git add .
git commit -m "Initial commit"
```

**중요**: Circuit의 워크스페이스 기능은 Git repository가 필수입니다.

---

**3단계: Node.js 설치** (MCP 서버 사용자만 해당)
```bash
# Homebrew로 Node.js 설치
brew install node

# 설치 확인
node --version
npm --version
```

---

**4단계: 프로젝트 준비**
- Circuit을 사용할 Git 저장소 준비
- 최소 1개 이상의 커밋 존재해야 함
- 브랜치 생성 및 관리가 가능한 상태여야 함

---

### 3.2 Circuit이 자동으로 처리하는 것들

Circuit 설치 후 **자동으로** 생성/관리되는 것들:

1. **`~/.circuit/` 디렉토리**
   - 설정 파일 저장
   - SQLite 데이터베이스 (대화 내역, 메모리, 작업 관리)
   - MCP 서버 설치 경로

2. **데이터베이스 초기화**
   - Conversations (대화 내역)
   - Messages (메시지 블록)
   - Memory (장기 기억)
   - Todos (작업 관리)
   - Settings (사용자 설정)

3. **IPC 핸들러 등록**
   - 50개 이상의 Electron IPC 채널 자동 설정

4. **HTTP API 서버** (포트 3737)
   - MCP 도구 호출 프록시
   - localhost만 접근 가능 (CORS 제한)

---

## 4. 온보딩 플로우 설계 (제안)

**현재 상태**: Circuit은 **온보딩 플로우가 없습니다**. 앱 실행 시 바로 메인 화면이 나타나며, 사용자가 직접 설정해야 합니다.

**문제점**:
- 처음 사용자는 무엇을 해야 할지 모름
- Claude Code CLI 미설치 시 에러 발생 (친절한 안내 없음)
- Git repository 없이 실행하면 워크스페이스 생성 불가

---

### 4.1 제안된 온보딩 플로우

#### **Phase 1: Welcome Screen (최초 실행 시)**

```
┌──────────────────────────────────────────┐
│          Welcome to Circuit!             │
│                                          │
│  🚀 MCP 패키지 매니저 & AI 개발 도우미   │
│                                          │
│  Circuit을 사용하기 전에 다음 항목을      │
│  확인해주세요:                            │
│                                          │
│  ✅ macOS 12 이상                        │
│  ⬜ Claude Code CLI 설치                 │
│  ⬜ Git 설치 및 설정                      │
│  ⬜ Node.js 18 이상 (MCP 사용 시)        │
│                                          │
│         [시스템 검사 시작]                │
└──────────────────────────────────────────┘
```

**구현 방법**:
- 최초 실행 시 `~/.circuit/first-run` 파일 존재 여부 확인
- 없으면 Welcome Dialog 표시
- "시스템 검사 시작" 버튼 클릭 → Phase 2로 이동

---

#### **Phase 2: System Check (자동 검증)**

```
┌──────────────────────────────────────────┐
│        시스템 요구사항 검사 중...         │
│                                          │
│  ✅ macOS 13.5 (Ventura) 감지            │
│  ❌ Claude Code CLI 미설치               │
│     → 설치 가이드 보기                    │
│  ✅ Git 2.39.0 설치됨                    │
│  ✅ Node.js 20.11.0 설치됨               │
│                                          │
│  [설치 가이드 열기]  [건너뛰기]          │
└──────────────────────────────────────────┘
```

**자동 검사 항목**:
1. **macOS 버전** (OK)
2. **Claude Code CLI**: `~/.claude/local/claude --version` 실행
   - 실패 시: "Claude Code 다운로드 페이지 열기" 버튼 제공
3. **Git**: `git --version` 실행
   - 실패 시: Xcode Command Line Tools 설치 안내
4. **Node.js**: `node --version` 실행
   - 선택 사항이므로 실패해도 경고만 표시

---

#### **Phase 3: Claude Code Login Verification**

```
┌──────────────────────────────────────────┐
│      Claude Code 인증 확인               │
│                                          │
│  Circuit은 Claude Code CLI를 사용합니다. │
│  먼저 Claude Code에 로그인해주세요.       │
│                                          │
│  [터미널 열기 - 로그인 명령어 복사]       │
│                                          │
│  또는 직접 실행:                          │
│  ~/.claude/local/claude login            │
│                                          │
│  [로그인 완료 - 다음]  [건너뛰기]        │
└──────────────────────────────────────────┘
```

**구현 방법**:
- "터미널 열기" 버튼 클릭 시:
  - macOS Terminal.app 실행
  - 자동으로 `~/.claude/local/claude login` 명령어 입력 (가능하면)

---

#### **Phase 4: Workspace Setup**

```
┌──────────────────────────────────────────┐
│       첫 번째 워크스페이스 설정           │
│                                          │
│  Circuit은 Git repository를 기반으로     │
│  워크스페이스를 생성합니다.               │
│                                          │
│  [기존 Git 저장소 선택]                   │
│  [새 Git 저장소 생성]                     │
│                                          │
│  또는 나중에 설정하기                     │
│  [건너뛰기 - 메인 화면으로]               │
└──────────────────────────────────────────┘
```

**옵션 1: 기존 Git 저장소 선택**
- macOS 파일 선택기 열기
- Git repository 감지 (`.git` 폴더 존재 확인)
- Repository 정보 표시 (이름, 브랜치 수, 최근 커밋)

**옵션 2: 새 Git 저장소 생성**
- 빈 폴더 선택
- `git init` 자동 실행
- 초기 커밋 생성 (`.gitignore` 포함)

---

#### **Phase 5: Quick Tutorial (인터랙티브 가이드)**

```
┌──────────────────────────────────────────┐
│          Circuit 둘러보기 (1/3)          │
│                                          │
│  💬 Claude와 대화하기                    │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │ User: Hello Claude!                │ │
│  │                                    │ │
│  │ Assistant: Hello! How can I help? │ │
│  └────────────────────────────────────┘ │
│                                          │
│  메시지를 입력하고 Cmd+Enter로 전송       │
│                                          │
│         [다음]  [건너뛰기]                │
└──────────────────────────────────────────┘
```

**투어 순서**:
1. **대화 패널**: Claude와 메시지 주고받기
2. **워크스페이스 전환**: 사이드바에서 브랜치 선택
3. **터미널 사용**: 명령어 실행 및 결과 확인
4. **메모리 관리**: 장기 기억 저장하기
5. **설정**: 테마, 모델 선택

---

#### **Phase 6: Onboarding Complete**

```
┌──────────────────────────────────────────┐
│           설정 완료!                      │
│                                          │
│  🎉 Circuit을 사용할 준비가 되었습니다.  │
│                                          │
│  다음 단계:                               │
│  • MCP 서버 설치하기 (선택)               │
│  • 첫 번째 대화 시작하기                  │
│  • 단축키 보기 (Cmd+K)                   │
│                                          │
│         [Circuit 시작하기]                │
└──────────────────────────────────────────┘
```

---

### 4.2 온보딩 스킵 옵션

모든 단계에서 **"건너뛰기"** 버튼 제공:
- 숙련된 사용자는 즉시 메인 화면으로
- 하지만 필수 조건(Claude Code CLI) 미충족 시 경고 표시

---

### 4.3 재방문 온보딩

설정 메뉴에서 **"온보딩 다시 보기"** 옵션 제공:
- Settings → Help → "Show Onboarding Again"
- `~/.circuit/first-run` 파일 삭제 후 재시작

---

## 5. 필수 권한 및 설정

### 5.1 macOS 시스템 권한

Circuit이 요청하는 권한:

| 권한 | 용도 | 필수 여부 | 요청 시점 |
|------|------|----------|-----------|
| **파일 시스템 접근** | - `~/.circuit/` 폴더 생성<br>- Git repository 읽기/쓰기<br>- 설정 파일 저장 | 필수 | 최초 실행 |
| **네트워크 접근** | - Claude AI API 통신<br>- Vercel API (선택)<br>- Git remote 동기화 | 필수 | 최초 AI 요청 시 |
| **프로세스 실행 권한** | - Claude Code CLI 실행<br>- Git 명령어 실행<br>- Terminal (node-pty) | 필수 | 최초 AI/Git 사용 시 |
| **Full Disk Access** | Git repository 외부 파일 접근 (선택) | 선택 | 파일 탐색 시 |

**중요**: Circuit은 다음 권한을 **요청하지 않습니다**:
- ❌ 카메라
- ❌ 마이크 (음성 기능은 코드에 있으나 미완성)
- ❌ 위치 정보
- ❌ 연락처
- ❌ 캘린더

---

### 5.2 보안 고려사항

**현재 보안 설정 (개발 모드)**:
```javascript
webPreferences: {
  nodeIntegration: true,        // ⚠️ 프로덕션에서 false로 변경 필요
  contextIsolation: false,      // ⚠️ 프로덕션에서 true로 변경 필요
}
```

**프로덕션 권장 설정**:
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  enableRemoteModule: false,
  preload: path.join(__dirname, 'preload.js')
}
```

**민감 데이터 처리**:
- API 토큰 (Vercel, 커스텀 MCP) - 환경변수로 관리
- Git credential - Git의 기본 credential helper 사용
- 대화 내역 - 로컬 SQLite에 저장 (암호화 없음)
- 사용자 설정 - `~/.circuit/config.json` (평문)

**보안 개선 필요 사항**:
1. 대화 내역 암호화 (선택적)
2. API 토큰 키체인 저장
3. HTTPS 강제 (현재 HTTP API는 localhost만)

---

### 5.3 네트워크 설정

**열리는 포트**:
- **5173**: Vite 개발 서버 (개발 모드만)
- **3737**: Circuit HTTP API 서버 (MCP 프록시)
- **3000+**: Terminal 세션 (동적 포트)

**외부 통신**:
- `api.anthropic.com` - Claude AI API
- `api.vercel.com` - Vercel MCP (선택)
- `github.com` / `gitlab.com` - Git remote 동기화

**방화벽 설정**:
- Circuit은 인바운드 연결을 받지 않음
- 아웃바운드만 허용하면 됨

---

## 6. 현재 지원하지 않는 기능

### 6.1 완전히 구현되지 않은 기능

**1. 음성 인터페이스** (`VoiceContext`, `voice/` 폴더 존재)
- **상태**: 코드는 존재하나 UI 미연결
- **파일**: `/circuit/electron/voice/*.ts`
- **영향**: 사용자에게 노출되지 않음
- **대응**: App Store 설명에 명시하지 말 것

**2. 브라우저 프리뷰**
- **상태**: 문서만 존재 (`BROWSER_PREVIEW_IMPLEMENTATION.md`)
- **영향**: 웹 개발 프로젝트에서 실시간 프리뷰 불가
- **대안**: 사용자가 별도로 `npm run dev` 실행

**3. Workflow 저장 및 실행**
- **상태**: 계획 단계 (`ROADMAP.md`)
- **영향**: 반복 작업 자동화 불가
- **대안**: 수동으로 단계별 실행

**4. Git Merge Conflict 해결 UI**
- **상태**: Git 통합은 있으나 충돌 해결 도구 없음
- **영향**: 충돌 시 사용자가 외부 도구 사용해야 함
- **대안**: VS Code, Tower, GitKraken 등 사용

**5. MCP 서버 마켓플레이스**
- **상태**: 컨셉만 존재 (`PRODUCT_VISION.md`)
- **영향**: MCP 서버 검색 및 원클릭 설치 불가
- **대안**: 사용자가 GitHub에서 수동 검색 및 설치

---

### 6.2 부분적으로만 지원되는 기능

**1. 파일 편집**
- **지원**: Monaco Editor 통합 완료
- **미지원**:
  - 파일 이름 변경 (TODO: `FileExplorer.tsx`)
  - 파일 삭제
  - 폴더 생성
- **대응**: "읽기 및 편집만 가능" 명시

**2. Terminal**
- **지원**: xterm.js 기반 터미널 에뮬레이션
- **미지원**:
  - 인터랙티브 프로그램 (vim, nano 등 일부 동작 불안정)
  - 복잡한 ANSI escape sequence
- **대응**: "기본 명령어만 지원" 명시

**3. Git 통합**
- **지원**: Worktree 생성, 브랜치 전환, 상태 확인
- **미지원**:
  - 시각적 diff 뷰어
  - 커밋 히스토리 그래프 (Git Graph 기능은 Feature Flag)
  - PR 생성 (TODO: `WorkspaceItem.tsx`)
  - Merge/Rebase 작업

**4. MCP 서버 관리**
- **지원**: `mcp-manager.ts` 존재
- **미지원**:
  - 자동 설치 (npm registry 연동 없음)
  - 버전 관리
  - 의존성 해결
- **대응**: Phase 1 기능으로 개발 중 명시

---

### 6.3 플랫폼 제약사항

**1. macOS 전용**
- **제약**: Windows, Linux 지원 없음
- **이유**:
  - `vibrancy`, `trafficLightPosition` 등 macOS 전용 API 사용
  - Git worktree 기능은 Linux에서도 작동하나 테스트 안 됨
- **대응**: "macOS 12+ 전용" 명확히 표시

**2. Apple Silicon (M1/M2/M3) vs Intel**
- **현재**: Universal Binary 미생성
- **영향**: Intel Mac에서 Rosetta 2 필요할 수 있음
- **대응**: `electron-builder` 설정에 `target: "universal"` 추가 필요

**3. 언어 지원**
- **현재**: UI는 영어만 (일부 한국어 주석)
- **영향**: 국제화 (i18n) 없음
- **대응**: "English only" 명시

---

### 6.4 성능 제약사항

**1. 대용량 Repository**
- **제약**: 파일 수 10,000개 이상 시 느려질 수 있음
- **이유**: Chokidar 파일 감시 오버헤드
- **대응**: `.gitignore` 활용 권장

**2. 긴 대화 내역**
- **제약**: 메시지 100개 이상 시 스크롤 성능 저하 가능
- **이유**: 가상화(virtualization) 미적용
- **대응**: Auto-compact 기능 활성화

**3. 동시 MCP 서버**
- **제약**: 10개 이상 동시 실행 시 메모리 사용량 증가
- **이유**: 각 서버가 별도 Node.js 프로세스
- **대응**: Lazy loading (첫 호출 시 시작) 구현 예정

---

### 6.5 데이터 동기화 및 백업

**지원하지 않는 것**:
- ❌ 클라우드 동기화 (대화 내역, 설정)
- ❌ 자동 백업
- ❌ 멀티 디바이스 지원

**데이터 위치**:
- 모든 데이터는 `~/.circuit/` 폴더에 저장
- 사용자가 직접 백업해야 함

**대응 방안**:
- FAQ에 "백업 방법" 추가:
  ```bash
  cp -r ~/.circuit ~/.circuit-backup
  ```

---

## 7. App Store 등록 전 필수 사항

### 7.1 기술적 요구사항

**1. Code Signing 및 Notarization**
- **현재 상태**: ❌ 미설정
- **필수 작업**:
  - [ ] Apple Developer ID 인증서 발급
  - [ ] `electron-builder.yml` 생성 및 signing 설정
  - [ ] Notarization 설정 (Apple ID + App-specific password)
  - [ ] Entitlements 파일 생성

**예시 `electron-builder.yml`**:
```yaml
appId: com.yourcompany.circuit
productName: Circuit
copyright: Copyright © 2025

mac:
  category: public.app-category.developer-tools
  icon: ./public/icon.icns
  target:
    - target: dmg
      arch: [x64, arm64]
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: ./build/entitlements.mac.plist
  entitlementsInherit: ./build/entitlements.mac.plist
  notarize:
    teamId: YOUR_TEAM_ID

files:
  - dist/**/*
  - dist-electron/**/*
  - node_modules/**/*
  - package.json

dmg:
  title: Circuit
  icon: ./public/icon.icns
  window:
    width: 540
    height: 380
```

**2. Entitlements 파일** (`build/entitlements.mac.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

**3. 보안 설정 수정**
- [ ] `contextIsolation: true` 변경
- [ ] `nodeIntegration: false` 변경
- [ ] `preload.js` 스크립트 작성
- [ ] IPC 핸들러를 preload script에서만 노출

---

### 7.2 App Store 메타데이터

**1. 앱 이름 및 설명**

**앱 이름**: Circuit
**부제목**: MCP Package Manager & AI Dev Assistant

**짧은 설명** (170자 제한):
```
Circuit은 Claude AI와 통합된 개발자 도구입니다. MCP 서버를 쉽게 관리하고, Git worktree로 브랜치를 격리하며, AI와 실시간 대화하세요.
```

**상세 설명**:
```
Circuit - MCP 패키지 매니저 & AI 개발 도우미

주요 기능:
• Claude AI와의 실시간 대화 (Extended Thinking, Planning 모드)
• MCP(Model Context Protocol) 서버 통합 관리
• Git Worktree 기반 워크스페이스 격리
• 통합 터미널 (Warp 스타일 커맨드 블록)
• 메모리/컨텍스트 관리로 토큰 최적화
• Monaco Editor 통합 코드 편집
• 작업 관리 (AI 생성 Todo 리스트)

필수 요구사항:
• macOS 12 이상
• Claude Code CLI 설치 필요
• Git 설치 필수
• Node.js 18+ (MCP 사용 시)

Circuit은 GitKraken이 Git을 시각화한 것처럼 MCP 생태계를 시각화하고 관리 가능하게 만듭니다.

지원 언어: English
```

**2. 카테고리**
- **Primary**: Developer Tools
- **Secondary**: Productivity

**3. 키워드** (100자 제한):
```
AI, Claude, MCP, Developer, Git, Terminal, Productivity, Code Editor
```

---

### 7.3 스크린샷 및 프리뷰 (필수)

**요구사항**:
- 최소 3개, 최대 10개 스크린샷
- 크기: 1280x800 또는 2560x1600 (Retina)

**제안 스크린샷 순서**:
1. **메인 화면** - Chat + Editor 분할 뷰
2. **Extended Thinking** - 확장된 사고 패널 열린 상태
3. **Workspace 관리** - 사이드바에서 여러 브랜치 표시
4. **Terminal 통합** - 명령어 블록 및 결과
5. **MCP 서버 관리** (Phase 1 완료 시)
6. **메모리 리스트** - 장기 기억 카드
7. **설정 화면** - 테마 및 모델 선택

**프리뷰 영상** (선택):
- 30초 - 1분 길이
- 주요 기능 데모 (대화 → AI 응답 → 코드 적용)

---

### 7.4 개인정보 보호 정책

**수집하는 데이터**:
- ❌ 개인 식별 정보 없음
- ⚠️ 대화 내역 (로컬 저장만, 서버 전송 안 함)
- ⚠️ API 사용량 통계 (Claude Code CLI 경유)

**외부 전송 데이터**:
- Claude AI API:
  - 사용자가 입력한 메시지
  - 파일 첨부 내용
  - 시스템 프롬프트
- Vercel API (선택):
  - 프로젝트 정보 (사용자가 MCP 활성화 시)

**개인정보 보호 정책 예시**:
```
Circuit Privacy Policy

Data Collection:
Circuit does not collect or transmit personal information. All conversations and settings are stored locally on your Mac at ~/.circuit/

Third-Party Services:
- Anthropic (Claude AI): User messages are sent to Claude AI via Claude Code CLI, subject to Anthropic's privacy policy.
- Vercel (optional): If you enable Vercel MCP integration, project data is sent to Vercel APIs.

Local Storage:
- Conversations and messages: ~/.circuit/conversations.db
- User settings: ~/.circuit/config.json
- Memory entries: ~/.circuit/memory.db

No data is uploaded to Circuit servers because Circuit does not operate any servers.

For questions: privacy@yourcompany.com
```

---

### 7.5 버전 관리 전략

**현재 버전**: `0.0.0` (package.json)

**제안 버전 체계** (Semantic Versioning):
- **v1.0.0** - App Store 첫 출시
  - 최소 기능: Chat, Workspace, Terminal, Settings
  - Phase 1 MCP Manager 완료 필요
- **v1.1.0** - MCP Playground 추가
- **v1.2.0** - Voice 인터페이스
- **v2.0.0** - 클라우드 동기화

**릴리스 노트 작성 가이드**:
```markdown
## v1.0.0 - Initial Release

### Features
- Real-time chat with Claude AI (Sonnet 4.5, Opus 4, Haiku 4)
- Git Worktree-based workspace isolation
- Integrated terminal with command blocks
- Memory/context management
- Monaco Editor integration

### Requirements
- macOS 12+
- Claude Code CLI
- Git 2.25+

### Known Issues
- Voice interface not yet available
- MCP marketplace coming in v1.1
```

---

## 8. 유저 여정 분석

### 8.1 첫 사용 경험 (First-Time User Experience)

**시나리오**: MCP 초보 탐험가 (Claude 3개월 사용)

**여정**:
1. **다운로드** (App Store) → **설치** (드래그 & 드롭)
2. **첫 실행** → Welcome Screen
3. **시스템 검사** → ❌ Claude Code CLI 미설치 감지
4. **설치 가이드** → Claude Code 다운로드 페이지 열기
5. **Claude Code 설치 및 로그인** (5분)
6. **Circuit 재실행** → ✅ 시스템 검사 통과
7. **Workspace 설정** → 기존 Git repo 선택
8. **첫 대화** → "Hello Claude!"
9. **성공** → AI 응답 확인

**소요 시간**: 15-20분 (Claude Code 설치 포함)

**Pain Points**:
- Claude Code CLI 설치 방법 모름 → **해결**: 상세 가이드 제공
- Git repo 없음 → **해결**: "새 Git repo 생성" 옵션 제공

---

### 8.2 일상적 사용 (Daily Workflow)

**시나리오**: MCP DIY러 (자체 MCP 서버 개발 중)

**여정**:
1. **Circuit 실행** → 최근 workspace 자동 복원
2. **코드 수정** → Monaco Editor에서 MCP 서버 코드 편집
3. **Terminal** → `node my-server.js` 실행
4. **테스트** → Claude에게 "Use my-server to list tools"
5. **에러 확인** → Claude 응답에서 JSON-RPC 에러 발견
6. **디버깅** → Terminal 로그 확인 → 코드 수정
7. **재테스트** → 성공

**소요 시간**: 10초/사이클 (기존 5분 → **30배 빠름**)

**핵심 가치**: 빠른 피드백 루프

---

### 8.3 고급 사용 (Power User)

**시나리오**: MCP 파워유저 (10개 서버 관리)

**여정**:
1. **대시보드** → 설치된 10개 MCP 서버 상태 확인
2. **성능 모니터링** → 응답 시간, 에러율 확인
3. **Playground** → 새 서버 도구 테스트
4. **Memory 추가** → 자주 쓰는 프롬프트 저장
5. **Workflow 실행** (향후 기능)

**소요 시간**: 1-2시간 (서버 관리 및 최적화)

---

## 9. 위험 요소 및 대응 방안

### 9.1 기술적 위험

**1. Claude Code CLI 의존성**
- **위험**: Claude Code CLI가 업데이트되면 Circuit 호환성 깨질 수 있음
- **대응**:
  - Claude Code CLI 버전 체크
  - 호환성 테스트 자동화
  - 최소 지원 버전 명시 (`~/.claude/local/claude --version`)

**2. Electron 보안 취약점**
- **위험**: `contextIsolation: false`로 인한 RCE 가능성
- **대응**:
  - v1.0 출시 전 `contextIsolation: true`로 변경
  - Preload script 작성
  - 정기적 Electron 업데이트

**3. Native Module Rebuild**
- **위험**: `better-sqlite3`, `node-pty` 빌드 실패
- **대응**:
  - Postinstall script로 자동 rebuild
  - Universal Binary로 빌드 (Intel + Apple Silicon)
  - 에러 메시지 개선

---

### 9.2 사용자 경험 위험

**1. 온보딩 중단율**
- **위험**: Claude Code CLI 설치가 너무 복잡해서 포기
- **대응**:
  - Welcome Screen에서 "왜 필요한지" 설명
  - 설치 가이드 비디오 제공
  - "나중에 설정" 옵션 제공

**2. 빈 워크스페이스 문제**
- **위험**: Git repo 없는 사용자가 막힘
- **대응**:
  - "새 Git repo 생성" 자동화
  - 샘플 프로젝트 제공 (선택)

**3. 에러 메시지 불친절**
- **위험**: 기술적 에러 메시지로 인한 혼란
- **대응**:
  - 에러 메시지 한글화 (향후)
  - 해결 방법 링크 제공
  - FAQ 작성

---

### 9.3 법적/규정 위험

**1. App Store 심사 거부**
- **위험**: Code signing 없이 제출
- **대응**:
  - 체크리스트 작성 (Section 7 참고)
  - 테스트 빌드로 사전 검증

**2. Anthropic API 이용약관 위반**
- **위험**: Claude Code CLI의 부적절한 사용
- **대응**:
  - 사용자의 기존 인증 재사용 (별도 API 키 없음)
  - Anthropic 이용약관 링크 제공

**3. 오픈소스 라이선스**
- **위험**: MIT/Apache 라이선스 준수 안 함
- **대응**:
  - `LICENSES.txt` 파일 생성 (모든 의존성 라이선스 명시)
  - About 화면에 "Open Source Licenses" 링크

---

### 9.4 성능 위험

**1. 메모리 누수**
- **위험**: 장시간 실행 시 메모리 사용량 증가
- **대응**:
  - React DevTools Profiler로 분석
  - 메모리 프로파일링 (Chrome DevTools)
  - Electron 업데이트

**2. 대용량 파일 처리**
- **위험**: 1MB 이상 파일 편집 시 느림
- **대응**:
  - Monaco Editor 파일 크기 제한
  - 큰 파일 경고 표시

---

## 10. 결론 및 권장 사항

### 10.1 App Store 등록 전 필수 체크리스트

**기술적 준비**:
- [ ] `electron-builder.yml` 생성 및 테스트
- [ ] Code signing 인증서 발급 및 설정
- [ ] Notarization 설정 및 테스트
- [ ] `contextIsolation: true` 변경 및 preload script 작성
- [ ] Entitlements 파일 작성
- [ ] Universal Binary 빌드 (Intel + Apple Silicon)
- [ ] 버전 `0.0.0` → `1.0.0` 변경

**UX 준비**:
- [ ] Welcome Screen 구현
- [ ] System Check 자동화
- [ ] Onboarding Tutorial 구현
- [ ] 에러 메시지 개선 (특히 Claude Code CLI 관련)
- [ ] FAQ 작성

**메타데이터 준비**:
- [ ] 앱 설명 작성 (한국어, 영어)
- [ ] 스크린샷 7-10개 촬영 (Retina)
- [ ] 프리뷰 영상 제작 (30-60초)
- [ ] 개인정보 보호 정책 작성
- [ ] LICENSES.txt 생성

**테스트**:
- [ ] 클린 macOS에서 설치 테스트
- [ ] Claude Code CLI 없는 환경에서 테스트
- [ ] Git 없는 환경에서 테스트
- [ ] 메모리 누수 테스트 (24시간 실행)
- [ ] 다양한 Git repository 크기 테스트

---

### 10.2 출시 전 우선순위 작업

**High Priority (v1.0 필수)**:
1. Code Signing & Notarization 설정
2. Welcome Screen + System Check 구현
3. Claude Code CLI 설치 가이드 상세화
4. 보안 설정 수정 (`contextIsolation: true`)
5. 스크린샷 및 메타데이터 준비

**Medium Priority (v1.0 권장)**:
6. Onboarding Tutorial (interactive tour)
7. FAQ 및 문서화
8. 에러 메시지 개선
9. 성능 최적화 (메모리 누수 수정)

**Low Priority (v1.1 이후)**:
10. MCP Playground 완성
11. Voice 인터페이스
12. 한글 UI

---

### 10.3 최종 권고사항

**출시 타이밍**:
- **현재 상태**: 기능은 80% 완성, 배포 준비는 20%
- **권장 출시 시점**: 2-3주 후 (기술적 준비 1주 + UX 개선 1주 + 테스트 1주)

**최소 기능 세트 (MVP)**:
- Chat with Claude ✅
- Workspace Management ✅
- Terminal Integration ✅
- Settings ✅
- **Welcome Screen** ⬜ (구현 필요)
- **System Check** ⬜ (구현 필요)

**제외 기능 (v1.1 이후)**:
- MCP Marketplace
- Voice Interface
- Browser Preview
- Workflow Automation

**성공 지표**:
- 온보딩 완료율 > 70%
- Claude Code CLI 설치 가이드 클릭률 > 50%
- 첫 대화 성공률 > 90%
- 첫 주 유지율 > 60%

---

## 부록 A: 참고 파일 경로

**설정 파일**:
- `~/.circuit/` - 사용자 데이터 디렉토리
- `~/.circuit/config.json` - 설정
- `~/.circuit/conversations.db` - 대화 내역
- `~/.circuit/memory.db` - 메모리

**프로젝트 파일**:
- `/circuit/electron/main.cjs` - Electron 메인 프로세스
- `/circuit/src/App.tsx` - React 메인 컴포넌트
- `/circuit/src/components/SettingsDialog.tsx` - 설정 UI
- `/circuit/electron/mcp-manager.ts` - MCP 서버 관리
- `/circuit/electron/conversationHandlers.ts` - 대화 IPC

**문서**:
- `/PRODUCT_VISION.md` - 제품 비전
- `/circuit/MAC_DISTRIBUTION_ANALYSIS.md` - 배포 분석
- `/circuit/README.md` - 프로젝트 소개

---

## 부록 B: 외부 리소스 링크

**필수 다운로드**:
- Claude Code: https://claude.ai/download
- Git: https://git-scm.com/download/mac
- Node.js: https://nodejs.org/

**개발 문서**:
- Electron: https://www.electronjs.org/docs
- electron-builder: https://www.electron.build/
- MCP Protocol: https://modelcontextprotocol.io/

**Apple Developer**:
- Code Signing: https://developer.apple.com/support/code-signing/
- Notarization: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- App Store Guidelines: https://developer.apple.com/app-store/review/guidelines/

---

**문서 종료**
