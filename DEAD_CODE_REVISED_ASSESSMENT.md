# Dead Code - Revised Assessment (Agent 개발 중 고려)

**Date**: 2025-11-05
**Context**: Agent 기능이 MVP 단계, 많은 기능이 구현 예정

---

## 재평가 결과

### ❌ 삭제하면 안 되는 것 (Future Implementation)

#### 1. agentHandlers.ts:132-137 - **보류**
```typescript
// TODO: Re-enable when storage.getConversation is implemented
//   const conversation = storage.getConversation(todo.conversationId)
//   if (conversation && conversation.workspaceId) {
//     workspacePath = getWorkspacePath(conversation.workspaceId)
//   }
```

**재평가**:
- ❌ **삭제하면 안 됨** - 이건 "죽은 코드"가 아니라 "미구현 기능"
- 🔮 **미래 구현 계획**: ConversationStorage에 `getConversation` 메소드 추가 예정
- 📋 **의도**: Workspace path를 conversation metadata에서 가져오기

**올바른 조치**:
- ✅ **TODO 유지** - 구현 예정임을 명시
- 🔄 **주석 개선** - 더 명확하게 작성
  ```typescript
  // TODO(Phase 2): Re-enable when ConversationStorage.getConversation is implemented
  // This will allow Agent to use workspace path from conversation metadata
  // instead of falling back to cwd
  //
  // Planned implementation:
  //   const conversation = storage.getConversation(todo.conversationId)
  //   if (conversation?.workspaceId) {
  //     workspacePath = getWorkspacePath(conversation.workspaceId)
  //   }
  ```

---

#### 2. agentHandlers.ts:75 TODO - **유지**
```typescript
/**
 * TODO: This is a placeholder. Need to get actual workspace info from main.cjs
 */
function getWorkspacePath(workspaceId: string): string | undefined {
  console.warn('[AgentHandlers] Using cwd as workspace path (temporary)')
  return process.cwd()
}
```

**재평가**:
- ❌ **TODO 제거하면 안 됨** - 실제로 구현이 필요함
- 📋 **의도**: Workspace 관리 시스템과 통합 예정

**올바른 조치**:
- ✅ **TODO 유지**
- 🔄 **주석 개선** - Phase 명시
  ```typescript
  /**
   * Get workspace path from workspaceId
   *
   * TODO(Phase 3): Integrate with workspace management system
   * Currently returns cwd as temporary fallback
   *
   * @param workspaceId - The workspace identifier
   * @returns Workspace path, or cwd as fallback
   */
  function getWorkspacePath(workspaceId: string): string | undefined {
    // Temporary fallback until workspace management is integrated
    return process.cwd()
  }
  ```

---

#### 3. agentWorker.ts:142-143 - **유지** (이미 계획에 있음)
```typescript
filesModified: [],  // TODO: Parse from output
filesCreated: [],   // TODO: Parse from output
```

**재평가**:
- ✅ **이미 올바르게 판단됨** - Phase 1 구현 계획에 포함
- 📋 **COMPREHENSIVE_ANALYSIS_AND_ACTION_PLAN.md** 참고

**조치**:
- ✅ **TODO 유지** - Phase 1에서 구현 예정

---

### ✅ 안전하게 이동 가능한 것 (Development Tools)

#### Benchmark 파일들
```
benchmark-memory.ts (272 lines)
benchmark-memory-standalone.ts (293 lines)
benchmark-simple.ts (234 lines)
```

**재평가**:
- ✅ **이동 OK** - Agent 기능과 무관한 개발 도구
- ✅ **사용처**: SharedMemoryPool 성능 측정용
- ✅ **영향**: 없음 (production 코드에서 import 안 됨)

**조치**:
- ✅ **MOVE to `/scripts/benchmarks/`**
- 이유: 개발/테스트 도구는 별도 위치가 적절

---

### 🔄 개선 가능한 것 (Documentation)

#### mcp-manager.ts:839
```typescript
// TODO: Compress with gzip
```

**재평가**:
- ✅ **TODO 유지 OK** - 로그 압축은 future enhancement
- 🔄 **주석 개선 가능** - 우선순위 명시
  ```typescript
  // TODO(Low Priority): Compress rotated logs with gzip to save disk space
  ```

---

## 수정된 실행 계획

### ✅ 진행 (Low Risk)

#### Step 1: Benchmark 파일 이동 (5 min)
```bash
mkdir -p scripts/benchmarks
git mv circuit/electron/benchmark-memory.ts scripts/benchmarks/
git mv circuit/electron/benchmark-memory-standalone.ts scripts/benchmarks/
git mv circuit/electron/benchmark-simple.ts scripts/benchmarks/
```

#### Step 2: README 작성 (5 min)
`scripts/benchmarks/README.md`:
```markdown
# Memory Benchmarks

Performance testing tools for SharedMemoryPool optimization.

## Files
- `benchmark-memory.ts` - Full benchmark with SharedMemoryPool
- `benchmark-memory-standalone.ts` - Standalone benchmark
- `benchmark-simple.ts` - Simple memory pool test

## Usage
```bash
# Run full benchmark
npx tsx scripts/benchmarks/benchmark-memory.ts

# Run standalone
npx tsx scripts/benchmarks/benchmark-memory-standalone.ts
```

## Expected Output
- Memory usage before/after
- Memory reduction percentage
- Cache statistics
```

---

### 🔄 개선 (Medium Priority)

#### Step 3: TODO 주석 개선 (10 min)

**File 1: agentHandlers.ts:132-137**
```typescript
// TODO(Phase 2): Re-enable when ConversationStorage.getConversation is implemented
// This will allow Agent to use workspace path from conversation metadata
// instead of falling back to cwd
//
// Planned implementation:
//   const conversation = storage.getConversation(todo.conversationId)
//   if (conversation?.workspaceId) {
//     workspacePath = getWorkspacePath(conversation.workspaceId)
//   }
```

**File 2: agentHandlers.ts:75**
```typescript
/**
 * Get workspace path from workspaceId
 *
 * TODO(Phase 3): Integrate with workspace management system
 * Currently returns cwd as temporary fallback
 *
 * @param workspaceId - The workspace identifier
 * @returns Workspace path, or cwd as fallback
 */
function getWorkspacePath(workspaceId: string): string | undefined {
  // Temporary fallback until workspace management is integrated
  return process.cwd()
}
```

**File 3: mcp-manager.ts:839**
```typescript
// TODO(Low Priority): Compress rotated logs with gzip to save disk space
```

---

### ❌ 보류 (Not Dead Code)

- ❌ **삭제하지 않음**: agentHandlers.ts 주석처리된 코드
- ❌ **삭제하지 않음**: agentWorker.ts TODO
- ❌ **삭제하지 않음**: getWorkspacePath TODO

**이유**: Agent 기능 개발 중, 구현 예정 기능임

---

## 최종 권장사항

### Option A: Conservative (추천) ⭐
**"안전한 것만 정리"**

```bash
# 1. Benchmark 파일만 이동
git mv circuit/electron/benchmark-*.ts scripts/benchmarks/

# 2. README 작성
cat > scripts/benchmarks/README.md << 'EOF'
...
EOF

# 3. Commit
git add -A
git commit -m "chore: move benchmark files to scripts

- Move 3 benchmark files to scripts/benchmarks/ (799 lines)
- Add README for benchmark usage
- No functionality changes"
```

**영향**:
- ✅ 안전: 개발 도구만 이동
- ✅ 명확: production 코드 건드리지 않음
- ✅ 가역: 언제든 되돌릴 수 있음

---

### Option B: Moderate
**"안전한 것 + TODO 주석 개선"**

Option A + TODO 주석 개선 (Phase 명시)

**영향**:
- ✅ 더 명확한 TODO
- ⚠️ 약간의 코드 변경 (주석만)

---

### Option C: Aggressive (비추천)
**"죽은 코드 삭제 포함"**

Option B + 주석처리된 코드 삭제

**영향**:
- ❌ 위험: 미래 구현 계획 손실
- ❌ 혼란: 다른 개발자가 왜 삭제했는지 모름

---

## 사용자 결정 필요

어떤 옵션을 선택할까?

### Option A (추천): Benchmark만 이동 ⭐
- 가장 안전
- Agent 개발에 영향 없음
- 즉시 실행 가능

### Option B: Benchmark 이동 + TODO 개선
- 조금 더 정리
- Phase 명시로 명확성 증가
- 약간의 코드 리뷰 필요

### Option C: 공격적 정리
- ❌ 비추천 (Agent 개발 중)

**어떤 옵션으로 진행할까?**

---

**End of Revised Assessment**
