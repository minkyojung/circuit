# MCP Server Troubleshooting Guide

Octave 앱에 새로운 MCP 서버를 추가할 때 발생할 수 있는 문제와 해결 방법을 정리한 문서입니다.

---

## 📋 목차

1. [패키지 검증](#1-패키지-검증)
2. [TypeScript 빌드 파이프라인](#2-typescript-빌드-파이프라인)
3. [ES Module vs CommonJS](#3-es-module-vs-commonjs)
4. [Import 경로 문제](#4-import-경로-문제)
5. [React Hooks 무한 루프](#5-react-hooks-무한-루프)
6. [MCP 연결 에러](#6-mcp-연결-에러)

---

## 1. 패키지 검증

### 문제: `npm error 404 Not Found`

새로운 MCP 서버를 추가했는데 설치 시 404 에러가 발생하는 경우.

```bash
npm error 404  '@modelcontextprotocol/server-git@*' is not in this registry.
```

### 원인

npm registry에 존재하지 않는 패키지를 사용하려고 시도

### 해결 방법

#### Step 1: 패키지 존재 여부 확인

```bash
npm view <package-name> version
```

**예시:**
```bash
# ❌ 실패 (패키지 없음)
npm view @modelcontextprotocol/server-git version
# npm error 404 Not Found

# ✅ 성공 (패키지 있음)
npm view @mseep/git-mcp-server version
# 1.2.0
```

#### Step 2: 대체 패키지 검색

```bash
# npm search로 검색
npm search mcp git

# 또는 Web 검색
# "modelcontextprotocol git server npm package 2025"
```

#### Step 3: `DiscoverTab.tsx` 업데이트

```typescript
// ❌ Before (존재하지 않는 패키지)
{
  id: '@modelcontextprotocol/server-git',
  name: 'server-git',
  displayName: 'Git',
  // ...
}

// ✅ After (실제 존재하는 패키지)
{
  id: '@mseep/git-mcp-server',
  name: 'git-mcp-server',
  displayName: 'Git',
  // ...
}
```

### 체크리스트

- [ ] npm registry에서 패키지 존재 여부 확인
- [ ] 패키지 버전 확인
- [ ] GitHub 저장소 확인 (활발하게 유지보수되는지)
- [ ] MCP SDK 버전 호환성 확인

---

## 2. TypeScript 빌드 파이프라인

### 문제: `Unexpected token '.'`

Electron main process에서 TypeScript 파일을 직접 import 시도 시 발생.

```
Error: Unexpected token '.'
Expected * for generator, private key, identifier or async
```

### 원인

Node.js는 기본적으로 TypeScript를 실행할 수 없음. `.ts` 파일을 직접 import하면 파싱 에러 발생.

### 해결 방법

#### Step 1: `tsconfig.electron.json` 생성

```json
{
  "compilerOptions": {
    "module": "ESNext",           // ES module 출력
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist-electron",  // 컴파일 출력 디렉토리
    "rootDir": "./electron",      // 소스 디렉토리
    "noEmit": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "bundler",
    "strict": false,
    "types": ["node"]
  },
  "include": ["electron/**/*.ts"],
  "exclude": ["node_modules", "dist-electron"]
}
```

#### Step 2: `package.json`에 빌드 스크립트 추가

```json
{
  "scripts": {
    "build:electron": "tsc -p tsconfig.electron.json",
    "dev": "npm run build:electron && concurrently ...",
    "build": "tsc -b && vite build && npm run build:electron"
  }
}
```

#### Step 3: 빌드 테스트

```bash
npm run build:electron
```

컴파일 성공 시 `dist-electron/` 디렉토리에 `.js` 파일 생성됨.

---

## 3. ES Module vs CommonJS

### 문제: `exports is not defined in ES module scope`

`package.json`에 `"type": "module"`이 있을 때, TypeScript가 CommonJS로 컴파일하면 발생.

```
exports is not defined in ES module scope
This file is being treated as an ES module because it has a '.js' file extension
```

### 원인

- `package.json`: `"type": "module"` → 모든 `.js`를 ES module로 처리
- `tsconfig.electron.json`: `"module": "CommonJS"` → `exports.xyz` 문법 생성
- 충돌!

### 해결 방법

#### `tsconfig.electron.json` 수정

```json
{
  "compilerOptions": {
    "module": "ESNext",           // ✅ CommonJS → ESNext
    "moduleResolution": "bundler" // ✅ node → bundler
  }
}
```

#### 검증

컴파일 후 `dist-electron/*.js` 파일 확인:

```javascript
// ✅ ES module 문법
export class MCPServerManager { ... }
export function getMCPManager() { ... }

// ❌ CommonJS 문법 (에러 발생)
exports.MCPServerManager = class MCPServerManager { ... }
module.exports.getMCPManager = function() { ... }
```

---

## 4. Import 경로 문제

### 문제: `Cannot find module './historyStorage'`

ES module에서 상대 경로 import 시 확장자가 없으면 발생.

```
Cannot find module '/Users/.../dist-electron/historyStorage'
imported from /Users/.../dist-electron/mcp-manager.js
```

### 원인

ES module은 **파일 확장자 필수**:

```typescript
// ❌ Error (확장자 없음)
import { getHistoryStorage } from './historyStorage'

// ✅ Correct (확장자 있음)
import { getHistoryStorage } from './historyStorage.js'
```

### 해결 방법

#### TypeScript 소스 파일에 `.js` 확장자 추가

**주의**: TypeScript 소스에서도 `.js` 확장자 사용!

```typescript
// electron/mcp-manager.ts
import { getHistoryStorage } from './historyStorage.js'  // ✅
import { getPrivacyFilter } from './privacyFilter.js'    // ✅

// electron/historyHandlers.ts
import { getHistoryStorage } from './historyStorage.js'  // ✅
import type { HistoryQuery } from './historyStorage.js'  // ✅
```

#### 검증

```bash
# 컴파일 후 확인
head -n 15 dist-electron/mcp-manager.js

# 출력:
# import { getHistoryStorage } from './historyStorage.js'; ✅
# import { getPrivacyFilter } from './privacyFilter.js';   ✅
```

---

## 5. React Hooks 무한 루프

### 문제: `Maximum update depth exceeded`

`useEffect`와 `useCallback`에서 객체 참조가 계속 변경되어 발생.

```
Maximum update depth exceeded. This can happen when a component calls
setState inside useEffect, but useEffect either doesn't have a dependency
array, or one of the dependencies changes on every render.
```

### 원인

```typescript
export function useCallHistory(query: HistoryQuery = {}): UseCallHistoryResult {
  // ❌ query 객체가 매번 새로운 참조로 생성됨
  const fetchHistory = useCallback(async (cursor?: number) => {
    // ...
  }, [query])  // 무한 루프!

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])  // fetchHistory가 매번 재생성됨
}
```

### 해결 방법

#### `useMemo`로 안정적인 의존성 생성

```typescript
import { useState, useEffect, useCallback, useMemo } from 'react'

export function useCallHistory(query: HistoryQuery = {}): UseCallHistoryResult {
  // ✅ query의 각 필드를 의존성으로 사용
  const queryKey = useMemo(() => JSON.stringify(query), [
    query.serverId,
    query.toolName,
    query.status,
    query.after,
    query.before,
    query.cursor,
    query.limit,
    query.searchQuery,
  ])

  // ✅ queryKey는 값이 변경될 때만 재생성됨
  const fetchHistory = useCallback(async (cursor?: number) => {
    // ...
  }, [queryKey])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])
}
```

### 패턴

**객체/배열 의존성 → 개별 필드로 분해**

```typescript
// ❌ Bad
useCallback(() => { ... }, [config])

// ✅ Good
useCallback(() => { ... }, [config.a, config.b, config.c])

// ✅ Better (복잡한 객체)
const configKey = useMemo(() => JSON.stringify(config), [
  config.a,
  config.b,
  config.c,
])
useCallback(() => { ... }, [configKey])
```

---

## 6. MCP 연결 에러

### 문제: `MCP error -32000: Connection closed`

MCP 서버 시작 시 즉시 연결이 끊김.

```
Failed to start: MCP error -32000: Connection closed
```

### 원인들

1. **패키지가 npm에 없음** → [패키지 검증](#1-패키지-검증) 참고
2. **서버 실행 명령어 오류**
3. **필수 인자 누락**
4. **서버 크래시**

### 디버깅 방법

#### Step 1: 서버 로그 확인

```bash
# Octave 서버 로그 확인
tail -f ~/.circuit/logs/<server-id>.log

# 예시
tail -f ~/.circuit/logs/modelcontextprotocol-server-git.log
```

#### Step 2: 수동 실행 테스트

```bash
# 서버 명령어를 직접 실행해보기
npx -y @mseep/git-mcp-server --version

# 정상 작동하면 버전 출력됨
# 에러 발생 시:
# - npm error 404: 패키지 없음
# - Command not found: 잘못된 명령어
# - 다른 에러: 서버 설정 문제
```

#### Step 3: 설정 확인

```bash
# Octave 설정 파일 확인
cat ~/.circuit/config.json
```

올바른 설정 예시:

```json
{
  "servers": {
    "mseep-git-mcp-server": {
      "id": "mseep-git-mcp-server",
      "name": "Git",
      "packageId": "@mseep/git-mcp-server",
      "command": "npx",
      "args": ["-y", "@mseep/git-mcp-server"],
      "autoStart": true,
      "autoRestart": true
    }
  }
}
```

#### Step 4: 잘못된 설정 제거

```bash
# 설치 실패한 서버 제거
cat ~/.circuit/config.json | jq 'del(.servers["invalid-server-id"])' > ~/.circuit/config.json.tmp
mv ~/.circuit/config.json.tmp ~/.circuit/config.json
```

---

## 🔧 빠른 체크리스트

새 MCP 서버 추가 시 확인 사항:

### 추가 전
- [ ] npm registry에서 패키지 존재 확인
- [ ] 패키지 버전 및 문서 확인
- [ ] 필수 인자 및 설정 확인

### TypeScript 빌드
- [ ] `tsconfig.electron.json` 설정 확인 (`module: "ESNext"`)
- [ ] 상대 import에 `.js` 확장자 추가
- [ ] `npm run build:electron` 성공 확인
- [ ] `dist-electron/` 파일들이 ES module 형식인지 확인

### React Hooks
- [ ] `useCallback`/`useEffect` 의존성 확인
- [ ] 객체/배열 의존성 → 개별 필드로 분해
- [ ] 무한 루프 없는지 콘솔 확인

### 설치 테스트
- [ ] DiscoverTab에서 설치 시도
- [ ] `~/.circuit/logs/` 에서 로그 확인
- [ ] 수동 실행 테스트 (`npx -y <package>`)
- [ ] InstalledTab에서 상태 확인

---

## 📚 참고 자료

- [Model Context Protocol - GitHub](https://github.com/modelcontextprotocol)
- [MCP Servers Repository](https://github.com/modelcontextprotocol/servers)
- [TypeScript ES Module Guide](https://www.typescriptlang.org/docs/handbook/esm-node.html)
- [React Hooks - useCallback](https://react.dev/reference/react/useCallback)
- [React Hooks - useMemo](https://react.dev/reference/react/useMemo)

---

## 🆘 여전히 문제가 해결되지 않는다면

1. **Electron 콘솔 확인**: Developer Tools에서 상세 에러 로그 확인
2. **서버 로그 확인**: `~/.circuit/logs/<server-id>.log`
3. **GitHub Issues**: Octave 저장소에 이슈 등록
4. **MCP 서버 저장소**: 해당 MCP 서버의 GitHub 저장소에서 이슈 확인

---

*마지막 업데이트: 2025-10-23*
