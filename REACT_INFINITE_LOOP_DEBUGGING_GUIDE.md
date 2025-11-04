# React 무한 루프 디버깅 가이드

> **문제 발생일**: 2025-01-05
> **해결 소요 시간**: 약 3시간
> **핵심 교훈**: 에러 메시지보다 로그 타임라인 분석이 더 중요하다

## 📋 목차

1. [문제 증상](#문제-증상)
2. [근본 원인 분석](#근본-원인-분석)
3. [해결 방법](#해결-방법)
4. [재발 방지 가이드](#재발-방지-가이드)
5. [React 무한 루프 패턴 사전](#react-무한-루프-패턴-사전)

---

## 문제 증상

### 에러 메시지
```
Uncaught Error: Maximum update depth exceeded.
This can happen when a component repeatedly calls setState
inside componentWillUpdate or componentDidUpdate.
React limits the number of nested updates to prevent infinite loops.
```

### 에러 스택 패턴
```javascript
at setRef (chunk-XWW6MF7Y.js:18:12)
at chunk-XWW6MF7Y.js:27:23
at Array.map (<anonymous>)
at chunk-XWW6MF7Y.js:26:27
at setRef (chunk-XWW6MF7Y.js:18:12)
at chunk-XWW6MF7Y.js:27:23
// ... 무한 반복
```

### 증상
- 워크스페이스 선택 시 앱 크래시
- 화면이 아무것도 렌더링되지 않음
- 콘솔에 무한 에러 로그

---

## 근본 원인 분석

### 🎯 진짜 원인: ChatInput의 useEffect 무한 루프

**파일**: `circuit/src/components/workspace/ChatInput.tsx` (Line 117-150)

#### 문제 코드
```typescript
useEffect(() => {
  if (!codeAttachment) {
    setAttachedFiles(prev => prev.filter(f => f.type !== 'code/selection'))
    return
  }

  // ❌ 문제: attachedFiles를 읽고 있음
  const exists = attachedFiles.some(f => f.id === codeAttachmentId)
  if (!exists) {
    setAttachedFiles(prev => [...prev, codeFile])
  }
}, [codeAttachment, attachedFiles]) // ⚠️ attachedFiles가 의존성 배열에!
```

#### 무한 루프 메커니즘
```
1. useEffect 실행
   ↓
2. setAttachedFiles() 호출
   ↓
3. attachedFiles 상태 변경
   ↓
4. useEffect 의존성 (attachedFiles) 변화 감지
   ↓
5. useEffect 재실행 → 1번으로 돌아감 💥
```

#### 해결 방법
```typescript
useEffect(() => {
  if (!codeAttachment) {
    setAttachedFiles(prev => prev.filter(f => f.type !== 'code/selection'))
    return
  }

  const codeAttachmentId = `code-${codeAttachment.filePath}-${codeAttachment.lineStart}-${codeAttachment.lineEnd}`

  // ✅ setState 콜백 안에서 체크
  setAttachedFiles(prev => {
    const exists = prev.some(f => f.id === codeAttachmentId)
    if (exists) {
      return prev // ✅ 변경 없음 → 리렌더 없음
    }
    return [...prev, codeFile]
  })
}, [codeAttachment]) // ✅ attachedFiles 제거!
```

---

### 🔧 기여 원인들 (직접적 원인은 아니지만 개선 필요)

#### 1. useClaudeMetrics의 에러 처리
**파일**: `circuit/src/hooks/useClaudeMetrics.ts`

**문제**: IPC handler가 없을 때 console.error + setError로 무한 재시도
```typescript
// ❌ 이전
catch (err) {
  console.error('[useClaudeMetrics] Start error:', err);
  setError(err.message); // setState → 리렌더
}

// ✅ 수정
catch (err) {
  console.warn('[useClaudeMetrics] Metrics not available (this is OK):', err);
  // setError 호출 안 함
}
```

#### 2. ClassicTerminal의 workspace.path 의존성
**파일**: `circuit/src/components/terminal/ClassicTerminal.tsx` (Line 204)

**문제**: workspace.path가 의존성 배열에 있었음
```typescript
// ❌ 이전
}, [workspace.id, getOrCreateTerminal, createPtySession, workspace.path])

// ✅ 수정 (주석에 이미 명시되어 있었음!)
}, [workspace.id, getOrCreateTerminal, createPtySession])
// workspace.path used from closure
```

#### 3. Virtual Scroller의 getScrollElement 미메모이제이션
**파일들**:
- `circuit/src/components/workspace/WorkspaceChatEditor.tsx` (Line 1892)
- `circuit/src/components/terminal/BlockList.tsx` (Line 34)

**문제**: 매 렌더링마다 새로운 함수 생성
```typescript
// ❌ 이전
const virtualizer = useVirtualizer({
  getScrollElement: () => scrollContainerRef.current, // 새 함수
})

// ✅ 수정
const getScrollElement = useCallback(() => scrollContainerRef.current, []);
const virtualizer = useVirtualizer({
  getScrollElement, // 안정적인 참조
})
```

#### 4. useAutoCompact의 조건부 Hook 호출
**파일**: `circuit/src/hooks/useAutoCompact.ts`

**문제**: React Hooks Rules 위반
```typescript
// ❌ 이전 (조건부 hook 호출)
const { context } = useWorkspaceContext(
  externalContext ? undefined : workspaceId
);

// ✅ 수정 (hook 제거, context를 필수 prop으로)
export function useAutoCompact(options: { context: ContextMetrics | null }) {
  const { context } = options; // prop으로 받음
}
```

#### 5. WorkspaceChatEditor의 IPC listener 재등록
**파일**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx` (Line 1456-1504)

**문제**: 핸들러가 의존성 배열에 있어 계속 재등록
```typescript
// ❌ 이전
useEffect(() => {
  ipcRenderer.on('event', handleSomething)
  return () => ipcRenderer.removeListener('event', handleSomething)
}, [handleSomething, ...7개 핸들러]) // 핸들러 변경 시마다

// ✅ 수정 (Ref 패턴)
const handlersRef = useRef({ handleSomething, ... })
handlersRef.current = { handleSomething, ... }

useEffect(() => {
  const wrapped = (...args) => handlersRef.current.handleSomething(...args)
  ipcRenderer.on('event', wrapped)
  return () => ipcRenderer.removeListener('event', wrapped)
}, []) // 한 번만 등록
```

#### 6. AppSidebar의 loadStatuses 재생성
**파일**: `circuit/src/components/AppSidebar.tsx` (Line 137-189)

**문제**: 함수가 메모이제이션 안 됨 + 배열 참조 불안정
```typescript
// ❌ 이전
const loadStatuses = async (workspaceList) => { ... }
useEffect(() => { ... }, [workspaces, loadStatuses])

// ✅ 수정
const loadStatuses = useCallback(async (workspaceList) => { ... }, [])
const workspacesRef = useRef(workspaces)
useEffect(() => { ... }, [workspaces.length, loadStatuses])
```

#### 7. WorkspaceChatEditor에 key prop 누락
**파일**: `circuit/src/App.tsx` (Line 461)

**문제**: workspace 변경 시 컴포넌트 재사용
```typescript
// ❌ 이전
<WorkspaceChatEditor workspace={selectedWorkspace} ... />

// ✅ 수정
<WorkspaceChatEditor
  key={selectedWorkspace.id}
  workspace={selectedWorkspace}
  ...
/>
```

---

## 해결 방법

### 최종 수정 파일 목록

| 파일 | 문제 | 중요도 |
|------|------|--------|
| `ChatInput.tsx` | useEffect 무한 루프 | ⭐⭐⭐ **근본 원인** |
| `useClaudeMetrics.ts` | 에러 처리 | ⭐⭐ 기여 요인 |
| `ClassicTerminal.tsx` | 의존성 배열 | ⭐⭐ 기여 요인 |
| `WorkspaceChatEditor.tsx` | virtualizer + IPC | ⭐⭐ 기여 요인 |
| `BlockList.tsx` | virtualizer | ⭐ 개선 |
| `useAutoCompact.ts` | 조건부 hook | ⭐ 개선 |
| `AppSidebar.tsx` | 함수 메모이제이션 | ⭐ 개선 |
| `App.tsx` | key prop | ⭐ 개선 |

### 커밋 히스토리
```bash
2c78702 fix: attempt to resolve infinite render loop with multiple optimizations
232f207 fix: resolve infinite render loop - root cause fixes
59027a3 fix: memoize getScrollElement in BlockList to prevent infinite loop
e2a91f8 fix: remove workspace.path from ClassicTerminal useEffect deps
473eb49 fix: silence useClaudeMetrics errors to prevent infinite loops
ccffcf4 fix: FOUND IT! ChatInput useEffect infinite loop
```

---

## 재발 방지 가이드

### 1. 디버깅 전략

#### ✅ DO: 로그 타임라인 분석
```
Line 40: ClassicTerminal 초기화
Line 41: TerminalContext 터미널 생성
Line 42: 💥 에러 발생
```
→ **ClassicTerminal 초기화 시점에 문제 집중**

#### ❌ DON'T: 에러 메시지만 믿기
- "circuit:metrics-start not found" 에러가 많이 보였지만 **진짜 원인이 아니었음**
- useClaudeMetrics를 먼저 수정했지만 문제 지속
- **에러는 증상일 뿐, 원인이 아닐 수 있다!**

#### 올바른 접근 순서
1. **에러 로그의 타임라인 분석** (어떤 순서로 발생?)
2. **에러 스택 트레이스 역추적** (어느 컴포넌트?)
3. **해당 컴포넌트의 useEffect/useState 체크**
4. **의존성 배열 검증**

### 2. useEffect 작성 규칙

#### Rule 1: 의존성 배열에 setState가 업데이트하는 상태 넣지 않기
```typescript
// ❌ 나쁜 예
useEffect(() => {
  if (someCondition) {
    setState(...)
  }
}, [state]) // state가 변경되면 다시 실행 → 무한 루프

// ✅ 좋은 예
useEffect(() => {
  setState(prev => {
    if (someCondition(prev)) {
      return newValue
    }
    return prev // 변경 없으면 prev 반환
  })
}, [dependency]) // state 제거
```

#### Rule 2: 함수는 항상 useCallback으로 메모이제이션
```typescript
// ❌ 나쁜 예
const handleSomething = () => { ... }
useEffect(() => { ... }, [handleSomething]) // 매번 재생성

// ✅ 좋은 예
const handleSomething = useCallback(() => { ... }, [deps])
useEffect(() => { ... }, [handleSomething])
```

#### Rule 3: 배열/객체 참조는 ref 패턴 사용
```typescript
// ❌ 나쁜 예
useEffect(() => {
  loadData(items)
}, [items]) // 배열 참조 변경 시마다

// ✅ 좋은 예
const itemsRef = useRef(items)
itemsRef.current = items
useEffect(() => {
  loadData(itemsRef.current)
}, [items.length]) // 길이만 추적
```

#### Rule 4: IPC 리스너는 ref 패턴으로
```typescript
// ✅ Best Practice
const handlersRef = useRef({ handler1, handler2, ... })
handlersRef.current = { handler1, handler2, ... }

useEffect(() => {
  const wrapped = (...args) => handlersRef.current.handler1(...args)
  ipcRenderer.on('event', wrapped)
  return () => ipcRenderer.removeListener('event', wrapped)
}, []) // 빈 배열 - 한 번만 등록
```

### 3. Virtual Scroller 사용 시

#### 필수 메모이제이션
```typescript
// ✅ 항상 이렇게
const getScrollElement = useCallback(() => scrollRef.current, [])

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement, // 안정적인 참조
  estimateSize: useCallback(() => 200, []),
})
```

### 4. Key Prop 규칙

#### 리스트 렌더링 시
```typescript
// ✅ 안정적인 ID 사용
{items.map(item => (
  <Component key={item.id} data={item} />
))}
```

#### 컴포넌트 재마운트 필요 시
```typescript
// ✅ key로 컴포넌트 교체 강제
<WorkspaceChatEditor
  key={workspace.id}
  workspace={workspace}
/>
```

### 5. 에러 처리 Best Practices

#### IPC 호출 실패 시
```typescript
// ✅ 조용히 실패 (선택적 기능일 경우)
try {
  const result = await ipcRenderer.invoke('optional-feature')
  if (result.success) {
    setData(result.data)
  }
} catch (err) {
  console.warn('[Component] Optional feature not available:', err)
  // setError 호출 안 함 - setState 방지
}

// ✅ 에러 표시 (필수 기능일 경우)
try {
  const result = await ipcRenderer.invoke('critical-feature')
  if (result.success) {
    setData(result.data)
  } else {
    setError(result.error)
  }
} catch (err) {
  console.error('[Component] Critical error:', err)
  setError(err.message)
}
```

---

## React 무한 루프 패턴 사전

### Pattern 1: setState in useEffect with state dependency
```typescript
// 🔥 위험
useEffect(() => {
  setState(value)
}, [state])
```

### Pattern 2: Array/Object in dependency
```typescript
// 🔥 위험
const items = [1, 2, 3] // 매 렌더마다 새 배열
useEffect(() => {
  doSomething(items)
}, [items])
```

### Pattern 3: Non-memoized function in dependency
```typescript
// 🔥 위험
const handler = () => { ... } // 매 렌더마다 새 함수
useEffect(() => {
  doSomething(handler)
}, [handler])
```

### Pattern 4: Conditional Hook Call
```typescript
// 🔥 위험
const data = condition ? useHook() : null // React Hooks Rules 위반
```

### Pattern 5: Virtual Scroller with unstable callback
```typescript
// 🔥 위험
useVirtualizer({
  getScrollElement: () => ref.current // 매 렌더마다 새 함수
})
```

---

## 디버깅 체크리스트

무한 루프 발생 시 순서대로 체크:

- [ ] **1단계**: 로그 타임라인 분석 - 어느 컴포넌트에서 시작?
- [ ] **2단계**: 에러 스택에서 컴포넌트 추출
- [ ] **3단계**: 해당 컴포넌트의 모든 useEffect 검토
  - [ ] 의존성 배열에 setState로 업데이트하는 상태가 있나?
  - [ ] 의존성 배열에 메모이제이션 안 된 함수가 있나?
  - [ ] 의존성 배열에 배열/객체가 직접 들어가 있나?
- [ ] **4단계**: useState와 setState 호출 체크
  - [ ] setState를 여러 번 호출하고 있나?
  - [ ] setState 결과가 다른 setState를 트리거하나?
- [ ] **5단계**: ref callback과 virtual scroller 체크
  - [ ] ref callback에서 setState 호출?
  - [ ] getScrollElement가 메모이제이션 되었나?
- [ ] **6단계**: IPC 리스너 체크
  - [ ] 중복 등록되고 있나?
  - [ ] 핸들러가 의존성 배열에 있나?

---

## 결론

### 핵심 교훈

1. **에러 메시지만 믿지 말고 로그 타임라인을 분석하라**
2. **useEffect 의존성 배열은 신중하게 관리하라**
3. **setState를 하는 상태를 의존성에 넣지 마라**
4. **모든 함수는 useCallback으로 메모이제이션하라**
5. **Virtual Scroller의 모든 콜백은 메모이제이션하라**

### 이 문서가 도움이 되는 경우

- React 무한 루프 에러 발생 시
- "Maximum update depth exceeded" 에러 발생 시
- useEffect가 예상보다 많이 실행될 때
- 컴포넌트가 계속 리렌더링될 때
- Virtual Scroller 사용 시 성능 문제

### 참고 자료

- [React Hooks Rules](https://react.dev/reference/rules/rules-of-hooks)
- [useEffect Dependency Array](https://react.dev/reference/react/useEffect#specifying-reactive-dependencies)
- [React Virtual Documentation](https://tanstack.com/virtual/latest)

---

**마지막 업데이트**: 2025-01-05
**버전**: 1.0
**작성자**: Claude Code + Human Developer
