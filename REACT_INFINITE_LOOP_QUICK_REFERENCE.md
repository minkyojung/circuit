# React 무한 루프 빠른 참조 가이드

> 3시간 디버깅 끝에 찾은 핵심 패턴들

## 🚨 가장 흔한 실수 TOP 5

### 1. useEffect에 setState로 변경하는 상태를 의존성으로 추가
```typescript
// ❌ 무한 루프
useEffect(() => {
  setState(newValue)
}, [state]) // state 변경 → useEffect → setState → state 변경 → ...

// ✅ 해결
useEffect(() => {
  setState(prev => {
    // 체크 로직
    if (needsChange(prev)) return newValue
    return prev // 변경 없으면 prev 반환
  })
}, [dependency]) // state 제거
```

### 2. 메모이제이션 안 된 함수를 의존성으로 추가
```typescript
// ❌ 무한 루프
const handler = () => { ... } // 매번 새 함수
useEffect(() => { ... }, [handler])

// ✅ 해결
const handler = useCallback(() => { ... }, [deps])
useEffect(() => { ... }, [handler])
```

### 3. 배열/객체를 직접 의존성으로 추가
```typescript
// ❌ 무한 루프
useEffect(() => {
  loadData(items)
}, [items]) // 배열 참조가 매번 바뀜

// ✅ 해결 1: ref 패턴
const itemsRef = useRef(items)
itemsRef.current = items
useEffect(() => {
  loadData(itemsRef.current)
}, [items.length])

// ✅ 해결 2: useMemo
const memoizedItems = useMemo(() => items, [items.length])
useEffect(() => {
  loadData(memoizedItems)
}, [memoizedItems])
```

### 4. Virtual Scroller의 unstable callback
```typescript
// ❌ 무한 루프
useVirtualizer({
  getScrollElement: () => ref.current // 매번 새 함수
})

// ✅ 해결
const getScrollElement = useCallback(() => ref.current, [])
useVirtualizer({
  getScrollElement
})
```

### 5. IPC 핸들러를 의존성으로 추가
```typescript
// ❌ 무한 등록/해제
useEffect(() => {
  ipcRenderer.on('event', handler)
  return () => ipcRenderer.removeListener('event', handler)
}, [handler]) // handler 변경 시마다

// ✅ 해결: ref 패턴
const handlerRef = useRef(handler)
handlerRef.current = handler
useEffect(() => {
  const wrapped = (...args) => handlerRef.current(...args)
  ipcRenderer.on('event', wrapped)
  return () => ipcRenderer.removeListener('event', wrapped)
}, [])
```

---

## 🔍 디버깅 3단계

### 1단계: 로그 타임라인 분석
```
어떤 순서로 발생하는가?
A → B → 에러 → A → B → 에러 → ...
```

### 2단계: 에러 스택에서 컴포넌트 찾기
```javascript
at ComponentName @ file.tsx:123
```

### 3단계: useEffect 의존성 배열 체크
```typescript
useEffect(() => {
  // 이 안에서 setState를 호출하는가?
}, [deps]) // deps에 setState로 변경되는 상태가 있는가?
```

---

## ✅ 작성 규칙

### useEffect
```typescript
useEffect(() => {
  // 1. setState 호출 시 functional update 사용
  setState(prev => {
    if (noChange) return prev // 중요!
    return newValue
  })

  // 2. 외부 상태 읽기는 최소화
  // 3. cleanup 함수는 반드시 작성
  return () => {
    // cleanup
  }
}, [
  // 4. primitive 값만 (string, number, boolean)
  // 5. 메모이제이션된 함수만
  // 6. setState로 변경하는 상태는 절대 넣지 않기
])
```

### useCallback
```typescript
// 모든 함수는 useCallback으로 감싸기
const handler = useCallback(() => {
  // ...
}, [deps])
```

### Virtual Scroller
```typescript
const getScrollElement = useCallback(() => ref.current, [])
const estimateSize = useCallback(() => height, [])

const virtualizer = useVirtualizer({
  count,
  getScrollElement, // 반드시 메모이제이션
  estimateSize, // 반드시 메모이제이션
})
```

### Key Prop
```typescript
// 컴포넌트 재마운트 필요 시 key 추가
<Component key={uniqueId} data={data} />
```

---

## 🎯 이 프로젝트에서 고친 것들

1. **ChatInput.tsx** - useEffect 의존성에서 attachedFiles 제거 ⭐ **근본 원인**
2. **useClaudeMetrics.ts** - 에러 처리를 warn으로 변경, setState 제거
3. **ClassicTerminal.tsx** - workspace.path 의존성 제거
4. **WorkspaceChatEditor.tsx** - getScrollElement 메모이제이션, IPC ref 패턴
5. **BlockList.tsx** - getScrollElement 메모이제이션
6. **useAutoCompact.ts** - 조건부 hook 제거
7. **AppSidebar.tsx** - loadStatuses 메모이제이션
8. **App.tsx** - WorkspaceChatEditor에 key prop 추가

---

## 📚 자세한 내용

전체 디버깅 과정과 상세 설명은 `REACT_INFINITE_LOOP_DEBUGGING_GUIDE.md` 참조
