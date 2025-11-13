# React 무한 루프 디버깅 가이드

> **문제 발생일**: 2025-01-05
> **해결 소요 시간**: 약 4시간 (2개 세션)
> **핵심 교훈**: 로그를 믿고, 실제 에러 스택을 분석하라. 추측하지 말라.

## 📋 목차

1. [문제 증상](#문제-증상)
2. [디버깅 타임라인](#디버깅-타임라인)
3. [실제 근본 원인](#실제-근본-원인)
4. [왜 이렇게 찾기 어려웠나](#왜-이렇게-찾기-어려웠나)
5. [해결 방법](#해결-방법)
6. [재발 방지 가이드](#재발-방지-가이드)
7. [React 무한 루프 패턴 사전](#react-무한-루프-패턴-사전)

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
- **중요**: `setRef`가 무한 재귀적으로 호출됨

---

## 디버깅 타임라인

### 세션 1: 잘못된 가설들

#### 시도 1: AppSidebar.tsx 최적화
**가설**: loadStatuses가 메모이제이션되지 않아서 무한 호출
**결과**: ❌ 실패

```typescript
// 고친 것
const loadStatuses = useCallback(async (workspaceList: Workspace[]) => {
  // ...
}, []);
```

#### 시도 2: useAutoCompact 조건부 Hook
**가설**: 조건부 useWorkspaceContext 호출이 문제
**결과**: ❌ 실패

```typescript
// 고친 것: context를 prop으로 받도록 변경
export function useAutoCompact(options: { context: ContextMetrics | null }) {
  // useWorkspaceContext() 제거
}
```

#### 시도 3: ClassicTerminal workspace.path
**가설**: workspace.path가 의존성 배열에 있어서 무한 재초기화
**결과**: ❌ 실패

```typescript
// 고친 것
}, [workspace.id, getOrCreateTerminal, createPtySession])
// workspace.path 제거
```

#### 시도 4: useClaudeMetrics 에러 처리
**가설**: IPC 에러가 setState를 호출해서 리렌더 유발
**결과**: ❌ 실패

```typescript
// 고친 것
catch (err) {
  console.warn('[useClaudeMetrics] Metrics not available (this is OK):', err);
  // setError() 제거
}
```

#### 시도 5: BlockList getScrollElement
**가설**: BlockList의 unmemoized callback이 문제
**결과**: ❌ 실패 (그리고 BlockList는 사용되지 않는 죽은 코드였음!)

#### 시도 6: ChatInput.tsx useEffect ⭐ 잘못된 "해결"
**가설**: attachedFiles가 의존성 배열에 있어서 무한 루프
**결과**: ❌ 고쳤다고 생각했지만... 실제로는 아니었음

```typescript
// 고친 것
useEffect(() => {
  // ...
  setAttachedFiles(prev => {
    const exists = prev.some(f => f.id === codeAttachmentId)
    if (exists) return prev
    return [...prev, codeFile]
  })
}, [codeAttachment]) // attachedFiles 제거
```

**문제**: 사용자가 "됐다"고 했지만, 실제로는 여전히 같은 에러가 발생하고 있었음!

---

### 세션 2: 진실의 순간 ⭐

#### 🔍 결정적 발견

사용자가 다시 로그를 보냈고, 여전히 **같은 에러 스택**이 찍히고 있었습니다:

```
at setRef (chunk-XWW6MF7Y.js:18:12)
at Array.map (<anonymous>)
at setRef (chunk-XWW6MF7Y.js:18:12)
```

**핵심 깨달음**:
1. ChatInput 수정은 **효과가 없었음**
2. 에러 스택을 보면 `setRef` → `Array.map` → `setRef` 패턴
3. 이것은 **virtualizer의 measureElement**를 의미함!
4. **virtualizer가 무한 재구성되고 있다!**

#### 🎯 실제 근본 원인 발견

**파일**: `circuit/src/components/workspace/WorkspaceChatEditor.tsx:1923-1931`

**문제 코드**:
```typescript
const virtualizer = useVirtualizer({
  count: filteredMessages.length,
  getScrollElement,
  estimateSize: useCallback(() => {  // ❌❌❌ 이게 문제!
    return 200;
  }, []),
  overscan: 5,
});
```

---

## 실제 근본 원인

### 🔥 Inline useCallback의 함정

**왜 이게 문제인가?**

많은 개발자들이 착각하는 것:
- ❌ "useCallback을 썼으니까 메모이제이션 되어있을 것이다"
- ❌ "inline으로 써도 첫 렌더에서 안정화될 것이다"

**실제로 일어나는 일**:

```typescript
// 렌더 사이클 1
const virtualizer = useVirtualizer({
  estimateSize: useCallback(() => 200, [])  // 새 참조 A 생성
})
// useVirtualizer가 새 참조 A를 받음
// → virtualizer 재구성
// → measureElement(setRef) 호출
// → 리렌더 트리거

// 렌더 사이클 2
const virtualizer = useVirtualizer({
  estimateSize: useCallback(() => 200, [])  // 이제 참조 A (안정화됨)
})
// 하지만 이미 리렌더가 트리거되어서...

// 렌더 사이클 3
const virtualizer = useVirtualizer({
  estimateSize: useCallback(() => 200, [])  // 참조 A
})
// 또 리렌더...

// 💥 무한 루프!
```

### 무한 루프 메커니즘

```
1. 컴포넌트 렌더
   ↓
2. useVirtualizer 실행, inline useCallback 생성
   ↓
3. useCallback의 첫 참조는 아직 불안정 (React가 안정화 중)
   ↓
4. useVirtualizer가 불안정한 참조를 받음
   ↓
5. virtualizer 내부 재구성
   ↓
6. measureElement(setRef) 호출
   ↓
7. setRef가 상태 변경 유발
   ↓
8. 컴포넌트 리렌더 → 1번으로 돌아감 💥
```

### 왜 이렇게 찾기 어려웠나?

1. **번들된 코드**: 에러 스택이 `chunk-XWW6MF7Y.js`를 가리킴
   - 소스맵이 제대로 작동 안 함
   - 어떤 컴포넌트인지 바로 알 수 없음

2. **잘못된 확신**: ChatInput을 "고쳤다"고 착각
   - 사용자가 "됐다"고 해서 넘어감
   - 실제로는 여전히 문제가 있었음

3. **useCallback의 미묘한 동작**:
   - "useCallback = 메모이제이션"이라는 단순한 생각
   - **inline useCallback은 첫 렌더에서 불안정함**을 몰랐음

4. **virtualizer의 복잡한 내부 동작**:
   - virtualizer가 언제 재구성되는지 명확하지 않음
   - measureElement(setRef)가 상태 변경을 유발하는지 몰랐음

---

## 해결 방법

### ✅ 올바른 패턴

**핵심 규칙**: useVirtualizer에 전달하는 **모든 콜백**은 **useVirtualizer 호출 전**에 정의해야 함!

```typescript
// ✅ 올바른 방법
const getScrollElement = useCallback(() => scrollContainerRef.current, []);

const estimateSize = useCallback(() => {
  return 200;
}, []);

const virtualizer = useVirtualizer({
  count: filteredMessages.length,
  getScrollElement,     // 이미 안정화된 참조
  estimateSize,         // 이미 안정화된 참조
  overscan: 5,
});
```

### ❌ 피해야 할 패턴들

```typescript
// ❌ 패턴 1: 인라인 화살표 함수
const virtualizer = useVirtualizer({
  estimateSize: () => 200  // 매 렌더마다 새 함수!
});

// ❌ 패턴 2: 인라인 useCallback
const virtualizer = useVirtualizer({
  estimateSize: useCallback(() => 200, [])  // 첫 렌더에서 불안정!
});

// ❌ 패턴 3: 인라인 익명 함수
const virtualizer = useVirtualizer({
  estimateSize: function() { return 200 }  // 매 렌더마다 새 함수!
});
```

### 🔧 실제 수정 내역

#### WorkspaceChatEditor.tsx
```diff
- const virtualizer = useVirtualizer({
-   count: filteredMessages.length,
-   getScrollElement,
-   estimateSize: useCallback(() => {
-     return 200;
-   }, []),
-   overscan: 5,
- });

+ const getScrollElement = useCallback(() => scrollContainerRef.current, []);
+
+ const estimateSize = useCallback(() => {
+   return 200;
+ }, []);
+
+ const virtualizer = useVirtualizer({
+   count: filteredMessages.length,
+   getScrollElement,
+   estimateSize,
+   overscan: 5,
+ });
```

#### BlockList.tsx
```diff
- const virtualizer = useVirtualizer({
-   count: blocks.length,
-   getScrollElement,
-   estimateSize: () => 150,
-   overscan: 5,
- });

+ const getScrollElement = useCallback(() => parentRef.current, []);
+
+ const estimateSize = useCallback(() => 150, []);
+
+ const virtualizer = useVirtualizer({
+   count: blocks.length,
+   getScrollElement,
+   estimateSize,
+   overscan: 5,
+ });
```

---

## 재발 방지 가이드

### 1. 무한 루프 디버깅 체크리스트

무한 루프가 발생하면 이 순서대로 체크하세요:

- [ ] **에러 스택 확인**: 어떤 함수가 반복 호출되는가?
  - `setRef` → virtualizer 문제
  - `setState` → state 관리 문제
  - `useEffect` → 의존성 배열 문제

- [ ] **로그 타임라인 분석**:
  - 무엇이 먼저 실행되는가?
  - 어떤 순서로 호출되는가?
  - 언제 멈추지 않고 반복되기 시작하는가?

- [ ] **의존성 배열 점검**:
  - useEffect, useMemo, useCallback의 deps 확인
  - setState 대상이 deps에 있는가?
  - 객체/배열 참조가 매번 바뀌는가?

- [ ] **inline 함수 제거**:
  - useVirtualizer, useCallback, useMemo 등에 전달하는 함수
  - 모두 미리 정의되어 있는가?

- [ ] **React DevTools Profiler**:
  - 어떤 컴포넌트가 반복 렌더되는가?
  - 왜 렌더되는가? (props? state? context?)

### 2. Virtual Scroller 사용 시 필수 규칙

```typescript
// ✅ 올바른 패턴 - 모든 콜백을 미리 정의
const getScrollElement = useCallback(() => ref.current, []);
const estimateSize = useCallback(() => height, []);
const measureElement = useCallback((el) => {
  // 측정 로직
}, []);

const virtualizer = useVirtualizer({
  count,
  getScrollElement,
  estimateSize,
  // measureElement (필요 시)
});

// ❌ 절대 하지 말 것
const virtualizer = useVirtualizer({
  getScrollElement: () => ref.current,              // ❌
  estimateSize: useCallback(() => height, []),      // ❌
  measureElement: (el) => { /* ... */ },            // ❌
});
```

### 3. useEffect 안전 패턴

```typescript
// ❌ 위험한 패턴
useEffect(() => {
  if (someArray.length > 0) {
    setSomeArray([...someArray, newItem])  // someArray 읽고 쓰기!
  }
}, [someArray])  // 💥

// ✅ 안전한 패턴
useEffect(() => {
  setSomeArray(prev => {
    if (prev.length > 0) {
      return [...prev, newItem]  // prev로만 읽기
    }
    return prev
  })
}, [])  // 또는 다른 의존성
```

### 4. 디버깅 전략

#### A. 로그 먼저, 추측은 나중에
```typescript
// 무한 루프 의심 지점에 로그 추가
console.log('[ComponentName] Rendering:', {
  timestamp: Date.now(),
  props,
  state
});

useEffect(() => {
  console.log('[ComponentName] Effect triggered:', {
    dependency1,
    dependency2
  });
}, [dependency1, dependency2]);
```

#### B. 바이너리 서치로 원인 격리
```typescript
// 1. 컴포넌트를 반으로 나눠서 주석 처리
// 2. 에러가 사라지면 → 주석 처리한 부분에 문제
// 3. 에러가 여전하면 → 나머지 부분에 문제
// 4. 반복해서 범위를 좁혀감
```

#### C. React DevTools Profiler
1. Profiler 탭 열기
2. 녹화 시작
3. 문제 재현
4. 녹화 중단
5. 어떤 컴포넌트가 수천 번 렌더되는지 확인

#### D. 에러 스택 패턴 인식
```javascript
// 패턴 1: setRef 무한 루프 → virtualizer 문제
at setRef (chunk-XXX.js:18:12)
at Array.map (<anonymous>)
at setRef (chunk-XXX.js:18:12)

// 패턴 2: setState 무한 루프 → useEffect deps 문제
at setState (react-dom.js:XXX)
at Component.render (Component.tsx:XXX)
at setState (react-dom.js:XXX)

// 패턴 3: IPC 무한 등록 → useEffect deps 문제
at ipcRenderer.on (electron.js:XXX)
at useEffect (react-dom.js:XXX)
at ipcRenderer.removeListener (electron.js:XXX)
```

---

## React 무한 루프 패턴 사전

### 패턴 1: setState 타겟을 의존성에 포함 ⭐ 가장 흔함

```typescript
// ❌ 무한 루프
const [items, setItems] = useState([])
useEffect(() => {
  if (items.length === 0) {
    setItems([1, 2, 3])  // items를 변경
  }
}, [items])  // 💥 items가 변경되면 다시 실행

// ✅ 해결책 1: 의존성 제거
useEffect(() => {
  setItems([1, 2, 3])
}, [])  // 한 번만 실행

// ✅ 해결책 2: functional update
useEffect(() => {
  setItems(prev => prev.length === 0 ? [1, 2, 3] : prev)
}, [])
```

### 패턴 2: 객체/배열 참조가 매번 바뀜

```typescript
// ❌ 무한 루프
const [data, setData] = useState({ count: 0 })
useEffect(() => {
  // 매번 새 객체 생성!
  const newData = { count: data.count }
  loadData(newData)
}, [data])  // 💥 data 참조가 계속 바뀜

// ✅ 해결책: 원시값으로 비교
useEffect(() => {
  const newData = { count: data.count }
  loadData(newData)
}, [data.count])  // count 값으로 비교
```

### 패턴 3: useMemo 없이 복잡한 계산

```typescript
// ❌ 무한 루프
function Component({ items }) {
  // 매 렌더마다 새 배열!
  const filtered = items.filter(x => x.active)

  useEffect(() => {
    processItems(filtered)
  }, [filtered])  // 💥 filtered는 항상 새 참조
}

// ✅ 해결책: useMemo
function Component({ items }) {
  const filtered = useMemo(
    () => items.filter(x => x.active),
    [items]
  )

  useEffect(() => {
    processItems(filtered)
  }, [filtered])  // ✅ items 변경시만 재계산
}
```

### 패턴 4: Virtual Scroller inline 콜백 ⭐⭐ 이번 케이스!

```typescript
// ❌ 무한 루프 - inline 화살표 함수
const virtualizer = useVirtualizer({
  estimateSize: () => 200  // 매번 새 함수!
})

// ❌ 무한 루프 - inline useCallback
const virtualizer = useVirtualizer({
  estimateSize: useCallback(() => 200, [])  // 첫 렌더에서 불안정!
})

// ✅ 해결책
const estimateSize = useCallback(() => 200, [])
const virtualizer = useVirtualizer({
  estimateSize
})
```

### 패턴 5: IPC 핸들러를 useEffect에서 등록

```typescript
// ❌ 무한 등록/해제
function Component() {
  const handleData = (event, data) => {
    setData(data)
  }

  useEffect(() => {
    ipcRenderer.on('data', handleData)
    return () => ipcRenderer.removeListener('data', handleData)
  }, [handleData])  // 💥 handleData는 매번 새 함수
}

// ✅ 해결책: ref 패턴
function Component() {
  const handlersRef = useRef({})

  handlersRef.current.handleData = (event, data) => {
    setData(data)
  }

  useEffect(() => {
    const wrapped = (e, d) => handlersRef.current.handleData(e, d)
    ipcRenderer.on('data', wrapped)
    return () => ipcRenderer.removeListener('data', wrapped)
  }, [])  // ✅ 한 번만 등록
}
```

### 패턴 6: 조건부 Hook 호출 (React Hooks Rules 위반)

```typescript
// ❌ 무한 루프 + Rules 위반
function Component({ needsContext }) {
  if (needsContext) {
    const context = useContext(SomeContext)  // 💥 조건부 Hook!
    // ...
  }
}

// ✅ 해결책: 항상 호출, 조건부로 사용
function Component({ needsContext }) {
  const context = useContext(SomeContext)

  if (needsContext) {
    // context 사용
  }
}
```

### 패턴 7: workspace.path 같은 객체 속성을 의존성에

```typescript
// ❌ 무한 재초기화
useEffect(() => {
  initializeWorkspace(workspace.path)
}, [workspace.path])  // 💥 workspace 객체가 바뀌면 path도 "다른" 값

// ✅ 해결책 1: workspace.id 사용
useEffect(() => {
  initializeWorkspace(workspace.path)
}, [workspace.id])  // workspace가 바뀔 때만

// ✅ 해결책 2: closure에서 사용 (주석 필수!)
useEffect(() => {
  initializeWorkspace(workspace.path)
}, [workspace.id])  // workspace.path는 closure에서 사용
```

---

## 교훈 및 베스트 프랙티스

### 🎓 이 버그에서 배운 것

1. **"됐다"를 믿지 마라**
   - 항상 로그로 검증
   - 에러가 정말 사라졌는지 확인
   - 테스트를 여러 번 반복

2. **에러 스택을 읽는 법을 배워라**
   - `setRef` → virtualizer
   - `setState` → state 관리
   - 패턴을 인식하면 원인을 빨리 찾을 수 있음

3. **inline callback의 위험성**
   - useCallback을 썼다고 안전한 게 아님
   - 반드시 호출 전에 정의해야 함
   - 특히 third-party 라이브러리 (virtualizer 등)

4. **React의 렌더 사이클을 이해하라**
   - useCallback/useMemo는 첫 렌더에서도 시간이 걸림
   - 안정화되기 전에 사용하면 위험
   - 순서가 중요함!

5. **추측보다 측정**
   - 로그를 추가하라
   - React DevTools를 사용하라
   - 타임라인을 분석하라

### ✅ Virtual Scroller 체크리스트

useVirtualizer를 사용할 때마다 이것을 확인하세요:

```typescript
// [ ] 1. getScrollElement이 useVirtualizer 전에 정의되었는가?
const getScrollElement = useCallback(() => ref.current, []);

// [ ] 2. estimateSize가 useVirtualizer 전에 정의되었는가?
const estimateSize = useCallback(() => height, []);

// [ ] 3. measureElement (있다면)가 useVirtualizer 전에 정의되었는가?
const measureElement = useCallback((el) => {
  // ...
}, []);

// [ ] 4. 모든 콜백이 안정적인 의존성을 가지는가?
// [ ] 5. useVirtualizer 내부에 inline 함수가 없는가?

const virtualizer = useVirtualizer({
  count,
  getScrollElement,     // ✅
  estimateSize,         // ✅
  // measureElement,    // ✅
});
```

### 🔍 디버깅 황금률

1. **에러 메시지를 읽어라** (하지만 맹신하지 마라)
2. **로그를 추가하라** (추측하지 마라)
3. **패턴을 인식하라** (경험을 쌓아라)
4. **바이너리 서치로 격리하라** (범위를 좁혀라)
5. **React DevTools를 사용하라** (도구를 활용하라)
6. **커밋 히스토리를 확인하라** (언제부터 문제였나?)
7. **다른 사람의 코드를 읽어라** (비슷한 사례를 찾아라)

---

## 참고 자료

- [React Docs: Rules of Hooks](https://react.dev/warnings/invalid-hook-call-warning)
- [React Docs: useCallback](https://react.dev/reference/react/useCallback)
- [React Docs: useMemo](https://react.dev/reference/react/useMemo)
- [TanStack Virtual Docs](https://tanstack.com/virtual/latest)
- [React DevTools Profiler Guide](https://react.dev/learn/react-developer-tools)

---

## 관련 커밋

- `ef97e3d` - fix: extract estimateSize callback to prevent virtualizer infinite loop
- `b8a8320` - docs: update infinite loop guide with actual root cause
- `ccffcf4` - fix: FOUND IT! ChatInput useEffect infinite loop (실제로는 해결 안 됨)
- `cd78c55` - docs: comprehensive React infinite loop debugging guide (부정확한 버전)

---

**마지막 업데이트**: 2025-01-05
**작성자**: Claude Code Assistant
**프로젝트**: Octave - Conductor AI Workspace
