# Dead Code Audit - Circuit

**Date**: 2025-11-05
**Branch**: agent-feature-improvements

---

## 목차
1. [Benchmark Files](#benchmark-files)
2. [TODO Comments](#todo-comments)
3. [Unused Functions](#unused-functions)
4. [Summary & Actions](#summary--actions)

---

## Benchmark Files

### 1. benchmark-memory.ts
**Location**: `circuit/electron/benchmark-memory.ts`
**Lines**: 272
**Purpose**: Memory optimization benchmarking

**Imports**:
- `getMemoryStorage` from `./memoryStorage`
- `getSharedMemoryPool` from `./sharedMemoryPool`

**Verification**:
```bash
# Check if imported anywhere
grep -r "benchmark-memory" circuit/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.cjs"
# Result: No matches
```

**Usage**:
- ❌ NOT imported in any source file
- ✅ Can be run standalone: `npx tsx benchmark-memory.ts`
- 🎯 Purpose: Development/testing only

**Decision**:
- ✅ **MOVE to `/scripts/` directory**
- Reason: Useful for development, but not production code

---

### 2. benchmark-memory-standalone.ts
**Location**: `circuit/electron/benchmark-memory-standalone.ts`
**Lines**: 293
**Purpose**: Standalone memory benchmarking (without Electron dependencies)

**Verification**:
```bash
grep -r "benchmark-memory-standalone" circuit/
# Result: No matches
```

**Decision**:
- ✅ **MOVE to `/scripts/` directory**
- Reason: Development tool, not production code

---

### 3. benchmark-simple.ts
**Location**: `circuit/electron/benchmark-simple.ts`
**Lines**: 234
**Purpose**: Simple memory pool benchmarking

**Contains**: SimpleMemoryPool class (duplicate implementation)

**Verification**:
```bash
grep -r "benchmark-simple" circuit/
# Result: No matches
```

**Decision**:
- ✅ **MOVE to `/scripts/` directory**
- Reason: Development tool, not production code

---

## TODO Comments

### 1. agentHandlers.ts:75
```typescript
/**
 * Helper to get workspace path from workspaceId
 * TODO: This is a placeholder. Need to get actual workspace info from main.cjs
 */
function getWorkspacePath(workspaceId: string): string | undefined {
  // For now, just return current working directory
  // This will be improved when we integrate with workspace management
  console.warn('[AgentHandlers] Using cwd as workspace path (temporary)')
  return process.cwd()
}
```

**Verification**:
- ✅ Function IS used (called in `agent:start` handler)
- ⚠️ TODO is valid: workspace management not yet integrated

**Decision**:
- ⚠️ **KEEP TODO** - Implementation pending
- 🔄 **Rephrase comment** to be clearer:
  ```typescript
  /**
   * Get workspace path from workspaceId
   * Currently returns cwd as fallback until workspace management is integrated
   */
  function getWorkspacePath(workspaceId: string): string | undefined {
    // Fallback: Using current working directory
    // Will be replaced when workspace management system is implemented
    return process.cwd()
  }
  ```

---

### 2. agentHandlers.ts:132
```typescript
// TODO: Re-enable when storage.getConversation is implemented
//   const conversation = storage.getConversation(todo.conversationId)
//   if (conversation && conversation.workspaceId) {
//     workspacePath = getWorkspacePath(conversation.workspaceId)
//   }
```

**Verification**:
- Check if `storage.getConversation` exists:
  ```bash
  grep -n "getConversation" circuit/electron/conversationStorage.ts
  # Need to verify
  ```

**Decision**: ⏸️ **VERIFY FIRST** - Check conversationStorage.ts

---

### 3. agentWorker.ts:142-143
```typescript
filesModified: [],  // TODO: Parse from output
filesCreated: [],   // TODO: Parse from output
```

**Verification**:
- These TODOs are in the action plan (Phase 1)
- Part of Stream-JSON parsing implementation

**Decision**:
- ✅ **KEEP TODO** - Valid, implementation planned

---

### 4. mcp-manager.ts:839
```typescript
// TODO: Compress with gzip
```

**Context**: Log file compression

**Decision**: ⏸️ **VERIFY FIRST** - Check if this is important

---

## Unused Functions

### Strategy
Use TypeScript compiler to find unused exports:

```bash
npx tsc --noUnusedLocals --noUnusedParameters
```

**Status**: ⏸️ **TO BE RUN**

---

## Summary & Actions

### Category 1: Benchmark Files (799 lines total)

| File | Lines | Action | Destination |
|------|-------|--------|-------------|
| benchmark-memory.ts | 272 | ✅ MOVE | `/scripts/benchmarks/` |
| benchmark-memory-standalone.ts | 293 | ✅ MOVE | `/scripts/benchmarks/` |
| benchmark-simple.ts | 234 | ✅ MOVE | `/scripts/benchmarks/` |

**Expected Impact**:
- Remove ~800 lines from production codebase
- Keep files accessible for future benchmarking
- Add README.md in `/scripts/benchmarks/`

---

### Category 2: TODO Comments

| Location | Action | Priority |
|----------|--------|----------|
| agentHandlers.ts:75 | 🔄 REPHRASE | Low |
| agentHandlers.ts:132 | ⏸️ VERIFY | Medium |
| agentWorker.ts:142-143 | ✅ KEEP | High (planned) |
| mcp-manager.ts:839 | ⏸️ VERIFY | Low |

**Expected Impact**:
- Clarify 1-2 comments
- Possibly remove 1-2 obsolete TODOs

---

### Category 3: Unused Imports/Functions

**Status**: ⏸️ **Pending TypeScript check**

**Command to run**:
```bash
npx tsc --noUnusedLocals --noUnusedParameters --noEmit
```

---

## Next Steps

### Step 1: Verify Pending Items (15 min)
- [ ] Check if `storage.getConversation` exists
- [ ] Check mcp-manager.ts:839 context
- [ ] Run TypeScript unused check

### Step 2: Execute Moves (30 min)
- [ ] Create `/scripts/benchmarks/` directory
- [ ] Move 3 benchmark files
- [ ] Create `/scripts/benchmarks/README.md`
- [ ] Update package.json scripts (optional)

### Step 3: Clean Comments (15 min)
- [ ] Rephrase agentHandlers.ts:75 comment
- [ ] Remove/update agentHandlers.ts:132 (if verified)
- [ ] Remove mcp-manager.ts:839 (if verified)

### Step 4: Commit Changes
- [ ] Git diff review
- [ ] Commit with clear message
- [ ] Run tests to ensure nothing broke

---

**End of Audit**
