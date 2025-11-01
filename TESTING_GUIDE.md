# Testing Guide: SharedMemoryPool Integration

This guide explains how to test the SharedMemoryPool integration in the Circuit Electron app.

## What Was Implemented

The SharedMemoryPool has been fully integrated into the Electron app with the following features:

### 1. **Database Migration v2** ✅
- Added `scope` (global/conversation/temporary) to memories
- Added `conversationId` for conversation-specific memories
- Created indexes for optimal query performance

### 2. **SharedMemoryPool Class** ✅
Located: `circuit/electron/sharedMemoryPool.ts`

Features:
- LRU cache with 5-minute TTL
- Global memory deduplication (shared across all conversations)
- Conversation-specific memory isolation
- Agent context building for todo execution
- Cache invalidation on memory updates

### 3. **IPC Handlers** ✅
Located: `circuit/electron/memoryHandlers.ts`

New handlers:
- `circuit:memory-get-global` - Get global memories (cached)
- `circuit:memory-get-conversation` - Get conversation memories (cached)
- `circuit:memory-build-agent-context` - Build minimal agent context
- `circuit:memory-pool-stats` - Get cache statistics
- `circuit:memory-pool-clear` - Clear cache (debugging)

### 4. **Memory Pool Monitor Component** ✅
Located: `circuit/src/components/debug/MemoryPoolMonitor.tsx`

A React component that shows:
- Cache size and status
- Cached entries with age
- Global and conversation memory counts
- Real-time statistics

## How to Test

### Option 1: Using the Memory Pool Monitor Component

1. **Add the component to your app:**

```tsx
// In any component or page:
import { MemoryPoolMonitor } from '@/components/debug/MemoryPoolMonitor'

export function YourComponent() {
  return (
    <div>
      {/* Your existing UI */}
      <MemoryPoolMonitor />
    </div>
  )
}
```

2. **Run the app:**

```bash
npm run dev
```

3. **Create test data:**
   - Create multiple conversations in the same workspace
   - Store some global memories (using the memory MCP server or UI)
   - Store conversation-specific memories
   - Switch between conversations

4. **Monitor the cache:**
   - Watch the Memory Pool Monitor update in real-time
   - See global memories being shared
   - Verify cache invalidation when memories are updated

### Option 2: Using Browser DevTools Console

1. **Run the app:**

```bash
npm run dev
```

2. **Open DevTools** (Cmd+Option+I on Mac)

3. **Test in the console:**

```javascript
// Get the IPC renderer
const { ipcRenderer } = window.require('electron')

// Test 1: Store global memories
await ipcRenderer.invoke('circuit:memory-store', {
  projectPath: '/Users/you/your-project',
  type: 'convention',
  key: 'test-global-1',
  value: 'This is a global memory',
  priority: 'high',
  scope: 'global'
})

// Test 2: Get global memories (should be cached)
const result1 = await ipcRenderer.invoke('circuit:memory-get-global', '/Users/you/your-project')
console.log('Global memories:', result1.memories)

// Test 3: Get cache stats
const stats = await ipcRenderer.invoke('circuit:memory-pool-stats')
console.log('Cache stats:', stats)

// Test 4: Store conversation-specific memory
await ipcRenderer.invoke('circuit:memory-store', {
  projectPath: '/Users/you/your-project',
  type: 'note',
  key: 'test-conv-1',
  value: 'Conversation-specific note',
  priority: 'medium',
  scope: 'conversation',
  conversationId: 'conv-abc-123'
})

// Test 5: Get conversation memories
const result2 = await ipcRenderer.invoke(
  'circuit:memory-get-conversation',
  '/Users/you/your-project',
  'conv-abc-123'
)
console.log('Conversation memories:', result2.memories)

// Test 6: Clear cache
await ipcRenderer.invoke('circuit:memory-pool-clear')
console.log('Cache cleared')
```

### Option 3: Automated Testing with Benchmark Script

1. **Run the benchmark (requires rebuilt better-sqlite3):**

```bash
cd circuit
npm rebuild better-sqlite3
npx tsx electron/benchmark-simple.ts
```

2. **Expected output:**

```
======================================================================
SharedMemoryPool Benchmark - Object Deduplication Test
======================================================================

📦 Setting up test data...
✅ Test data ready: 100 global + 100 conversation-specific memories

🔴 WITHOUT Pool - Loading memories independently
Loaded: 5 conversations × 100 global = 500 objects (DUPLICATED)
Total: 600 memory objects

🟢 WITH Pool - Sharing global memories
Loaded: 100 global memories (SHARED across all 5)
Total: 200 memory objects

📊 RESULTS
Objects WITHOUT pool: 600
Objects WITH pool:    200
🎯 Object reduction: 67% (600 → 200)
```

## Expected Performance Improvements

### Memory Object Reduction

| Conversations | Without Pool | With Pool | Reduction |
|---------------|-------------|-----------|-----------|
| 5             | 600 objects | 200 objects | 67%       |
| 10            | 1000 objects| 200 objects | 80%       |
| 20            | 2000 objects| 200 objects | 90%       |

### How It Works

**WITHOUT SharedMemoryPool:**
```
Conv 1: [100 global] + [20 conv-specific] = 120 objects
Conv 2: [100 global] + [20 conv-specific] = 120 objects ← Duplicated!
Conv 3: [100 global] + [20 conv-specific] = 120 objects ← Duplicated!
Total: 360 objects (with only 3 conversations!)
```

**WITH SharedMemoryPool:**
```
Global Cache: [100 global] ← Shared by all conversations!
Conv 1: [20 conv-specific]
Conv 2: [20 conv-specific]
Conv 3: [20 conv-specific]
Total: 160 objects
Reduction: 55%
```

## Architecture: Workspace Isolation

### Backend vs Frontend Separation

**CRITICAL DESIGN DECISION:**

- **Backend (SharedMemoryPool)**: Caches memories for ALL projects globally
  - This is intentional and correct for performance
  - Reduces database queries across multiple workspaces
  - Single shared cache instance for the entire Electron app

- **Frontend (MemoryPoolMonitor)**: Displays cache ONLY for current workspace
  - Receives `workspace` prop from TodoPanel
  - Filters `stats.entries` to match `workspace.path`
  - Users only see cache for their active project

### Why This Design?

**Problem**: User switched to workspace "my-bttrfly" but saw cache for "/Users/williamjung/conductor/circuit-1"

**Root Cause**: MemoryPoolMonitor showed ALL cached projects (no filtering)

**Solution**:
```tsx
// MemoryPoolMonitor.tsx
const filteredEntries = stats?.entries.filter(entry => {
  if (!workspace) return false
  return entry.projectPath === workspace.path  // Only show current workspace
}) ?? []
```

**Benefits**:
- Backend caches all projects (performance)
- Frontend shows only relevant cache (UX)
- Clear separation of concerns

### Testing Workspace Isolation

1. **Open workspace A** (e.g., "my-bttrfly")
2. **Store a memory** in workspace A
3. **Switch to workspace B** (e.g., "circuit-1")
4. **Verify**: MemoryPoolMonitor should show "No cache for this workspace"
5. **Store a memory** in workspace B
6. **Verify**: Now shows cache for workspace B only
7. **Switch back to workspace A**
8. **Verify**: Shows cache for workspace A (not workspace B)

**Expected Console Logs**:
```
[MemoryPoolMonitor] Filtering: {
  entryPath: "/Users/you/my-bttrfly",
  workspacePath: "/Users/you/my-bttrfly",
  match: true
}
[MemoryPoolMonitor] Filter result: {
  workspace: "/Users/you/my-bttrfly",
  totalEntries: 2,
  filteredCount: 1,
  hasCache: true
}
```

## Troubleshooting

### Issue: Cache not working

**Check:**
1. Is the migration v2 applied? Check database with:
   ```bash
   sqlite3 ~/Library/Application\ Support/circuit/circuit-data/memory.db
   .schema project_memories
   ```
   Should see `scope` and `conversation_id` columns.

2. Are memories being stored with scope?
   ```javascript
   // BAD - missing scope
   { projectPath: '...', type: 'note', key: '...', value: '...' }

   // GOOD - includes scope
   { projectPath: '...', type: 'note', key: '...', value: '...', scope: 'global' }
   ```

### Issue: Showing cache for wrong workspace

**This should not happen after the fix. If it does:**

1. **Check workspace prop is passed**:
   ```tsx
   // TodoPanel.tsx (line 304)
   <MemoryPoolMonitor workspace={workspace} />
   ```

2. **Check filtering logic**:
   - Open browser DevTools console
   - Look for `[MemoryPoolMonitor] Filtering:` logs
   - Verify `workspacePath` matches current workspace
   - Verify `match: true` only for current workspace

3. **Verify workspace.path format**:
   - Should be absolute path: `/Users/you/project-name`
   - Should match `projectPath` used when storing memories

### Issue: TypeScript compilation errors

**Solution:**
```bash
npm run build:electron
```

If errors persist, check that:
- `sharedMemoryPool.ts` exists
- `memoryStorage.ts` has the migration v2
- All imports are correct

### Issue: Cache not invalidating

**Check:**
The cache should automatically invalidate when:
- `circuit:memory-store` is called
- `circuit:memory-delete` is called
- `circuit:memory-clear-project` is called

Verify in `memoryHandlers.ts` that `pool.invalidate()` is called.

## Next Steps

After testing the SharedMemoryPool:

1. **Phase 2: Message Pagination** (2 weeks)
   - Implement message pagination in conversationStorage
   - Add virtual scrolling to message list
   - Lazy-load old messages on demand

2. **Phase 3: Worker Threads** (4 weeks)
   - Move heavy processing to worker threads
   - Implement agent execution in background
   - Add progress reporting via IPC

3. **Phase 4: Advanced Optimization** (6 weeks)
   - Result summarization
   - Context truncation strategies
   - Multi-level caching

## Resources

- Design Document: `MULTI_CONVERSATION_DESIGN.md`
- SharedMemoryPool: `circuit/electron/sharedMemoryPool.ts`
- Memory Handlers: `circuit/electron/memoryHandlers.ts`
- Memory Storage: `circuit/electron/memoryStorage.ts`
- Monitor Component: `circuit/src/components/debug/MemoryPoolMonitor.tsx`
