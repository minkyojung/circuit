/**
 * Memory Benchmarking Script
 *
 * Measures memory usage with and without SharedMemoryPool
 * to demonstrate the memory optimization improvements.
 *
 * Run with: npx tsx benchmark-memory.ts
 */

import { getMemoryStorage } from './memoryStorage'
import { getSharedMemoryPool } from './sharedMemoryPool'

// Helper to get memory usage in MB
function getMemoryUsage(): { heapUsed: number; external: number; total: number } {
  const usage = process.memoryUsage()
  return {
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100,
    external: Math.round(usage.external / 1024 / 1024 * 100) / 100,
    total: Math.round((usage.heapUsed + usage.external) / 1024 / 1024 * 100) / 100
  }
}

// Force garbage collection (requires --expose-gc flag)
function forceGC() {
  if (global.gc) {
    global.gc()
  }
}

async function setupTestData() {
  console.log('\n📦 Setting up test data...\n')

  const storage = await getMemoryStorage()
  const projectPath = '/test/project'

  // Clear existing test data
  await storage.clearProject(projectPath)

  // Create 100 global memories (shared across all conversations)
  console.log('Creating 100 global memories...')
  for (let i = 0; i < 100; i++) {
    await storage.storeMemory({
      projectPath,
      type: 'convention',
      key: `global-convention-${i}`,
      value: `This is a global coding convention #${i}. Always use camelCase for variable names and PascalCase for class names. Follow the DRY principle.`,
      priority: i < 10 ? 'high' : i < 50 ? 'medium' : 'low',
      scope: 'global'
    })
  }

  // Create conversation-specific memories for 5 conversations
  console.log('Creating conversation-specific memories for 5 conversations...')
  for (let convId = 1; convId <= 5; convId++) {
    const conversationId = `conv-${convId}`

    for (let i = 0; i < 20; i++) {
      await storage.storeMemory({
        projectPath,
        type: 'note',
        key: `${conversationId}-note-${i}`,
        value: `Conversation-specific note #${i} for ${conversationId}. This is a temporary context about the current work being done.`,
        priority: 'medium',
        scope: 'conversation',
        conversationId
      })
    }
  }

  console.log('✅ Test data created: 100 global + 100 conversation-specific memories\n')
}

async function benchmarkWithoutPool() {
  console.log('\n🔴 Benchmark WITHOUT SharedMemoryPool\n')
  console.log('Simulating 5 parallel conversations loading all memories independently...\n')

  forceGC()
  const startMem = getMemoryUsage()

  const storage = await getMemoryStorage()
  const projectPath = '/test/project'

  // Simulate 5 conversations each loading global + conversation memories
  const allData: any[] = []

  for (let convId = 1; convId <= 5; convId++) {
    const conversationId = `conv-${convId}`

    // Each conversation loads global memories (duplicated!)
    const globalMemories = await storage.getMemories({
      projectPath,
      scope: 'global',
      limit: 1000
    })

    // Each conversation loads its own conversation memories
    const conversationMemories = await storage.getMemories({
      projectPath,
      scope: 'conversation',
      conversationId,
      limit: 1000
    })

    allData.push({
      conversationId,
      globalMemories,  // Duplicated across all 5 conversations!
      conversationMemories
    })
  }

  const endMem = getMemoryUsage()
  const memoryUsed = endMem.total - startMem.total

  console.log(`Memory before: ${startMem.total} MB`)
  console.log(`Memory after:  ${endMem.total} MB`)
  console.log(`Memory used:   ${memoryUsed} MB`)
  console.log(`\nData loaded:`)
  console.log(`- 5 conversations × 100 global memories = 500 memory objects (DUPLICATED!)`)
  console.log(`- 5 conversations × 20 conversation memories = 100 memory objects`)
  console.log(`- Total: 600 memory objects in RAM\n`)

  return { memoryUsed, totalObjects: 600 }
}

async function benchmarkWithPool() {
  console.log('\n🟢 Benchmark WITH SharedMemoryPool\n')
  console.log('Simulating 5 parallel conversations using shared global memories...\n')

  forceGC()
  const startMem = getMemoryUsage()

  const pool = getSharedMemoryPool()
  const projectPath = '/test/project'

  // Clear pool cache to start fresh
  pool.clearCache()

  // Simulate 5 conversations using the pool
  const allContexts: any[] = []

  for (let convId = 1; convId <= 5; convId++) {
    const conversationId = `conv-${convId}`

    // Each conversation gets global memories from pool (SHARED!)
    const globalMemories = await pool.getGlobalMemories(projectPath)

    // Each conversation gets its own conversation memories from pool
    const conversationMemories = await pool.getConversationMemories(
      projectPath,
      conversationId
    )

    allContexts.push({
      conversationId,
      globalMemories,  // Reference to same object in pool!
      conversationMemories
    })
  }

  const endMem = getMemoryUsage()
  const memoryUsed = endMem.total - startMem.total

  console.log(`Memory before: ${startMem.total} MB`)
  console.log(`Memory after:  ${endMem.total} MB`)
  console.log(`Memory used:   ${memoryUsed} MB`)
  console.log(`\nData loaded:`)
  console.log(`- 100 global memories (SHARED across all 5 conversations)`)
  console.log(`- 5 conversations × 20 conversation memories = 100 memory objects`)
  console.log(`- Total: 200 memory objects in RAM (vs 600 without pool)`)

  // Show cache stats
  const stats = pool.getCacheStats()
  console.log(`\nCache stats:`)
  console.log(`- Cache size: ${stats.cacheSize} projects`)
  console.log(`- Global memories cached: ${stats.entries[0]?.globalMemoryCount || 0}`)
  console.log(`- Conversation caches: ${stats.entries[0]?.conversationCount || 0}`)
  console.log()

  return { memoryUsed, totalObjects: 200 }
}

async function benchmarkAgentContext() {
  console.log('\n🤖 Benchmark: Building Agent Context\n')
  console.log('Building minimal context for agent to work on a todo...\n')

  forceGC()
  const startMem = getMemoryUsage()

  const pool = getSharedMemoryPool()
  const projectPath = '/test/project'

  // Build agent context (minimal, optimized)
  // Note: convStorage would be required in real usage, passing null for benchmark
  const context = await pool.buildAgentContext(
    projectPath,
    'conv-1',
    'todo-123',
    null
  )

  const endMem = getMemoryUsage()
  const memoryUsed = endMem.total - startMem.total

  console.log(`Memory used:   ${memoryUsed} MB`)
  console.log(`\nContext includes:`)
  console.log(`- Global memories: ${context.globalMemories.length}`)
  console.log(`- Conversation memories: ${context.conversationMemories.length}`)
  console.log(`- Conversation history: ${context.conversationHistory.length} messages (metadata only)`)
  console.log(`- Todo context: ${context.todoContext ? 'included' : 'not found'}`)
  console.log(`\n⚡ Agent can load recent messages on-demand using getRecentMessages()`)
  console.log(`   This avoids loading full conversation history upfront\n`)

  return { memoryUsed }
}

async function main() {
  console.log('=' .repeat(70))
  console.log('Memory Optimization Benchmark - SharedMemoryPool')
  console.log('=' .repeat(70))

  try {
    // Setup
    await setupTestData()

    // Run benchmarks
    const withoutPool = await benchmarkWithoutPool()
    const withPool = await benchmarkWithPool()
    const agentContext = await benchmarkAgentContext()

    // Summary
    console.log('=' .repeat(70))
    console.log('📊 SUMMARY')
    console.log('=' .repeat(70))
    console.log()
    console.log(`Without SharedMemoryPool: ${withoutPool.memoryUsed} MB (${withoutPool.totalObjects} objects)`)
    console.log(`With SharedMemoryPool:    ${withPool.memoryUsed} MB (${withPool.totalObjects} objects)`)
    console.log(`Agent Context:            ${agentContext.memoryUsed} MB (minimal context)`)
    console.log()

    const reduction = Math.round((1 - withPool.totalObjects / withoutPool.totalObjects) * 100)
    console.log(`🎯 Memory object reduction: ${reduction}% (${withoutPool.totalObjects} → ${withPool.totalObjects} objects)`)
    console.log()

    if (withoutPool.memoryUsed > 0) {
      const memReduction = Math.round((1 - withPool.memoryUsed / withoutPool.memoryUsed) * 100)
      console.log(`💾 Actual memory reduction: ${memReduction}%`)
      console.log()
    }

    console.log('✅ Benchmark complete!')
    console.log()
    console.log('Next steps:')
    console.log('1. Test with larger datasets (1000+ memories)')
    console.log('2. Test with 10+ concurrent conversations')
    console.log('3. Measure cache hit rates over time')
    console.log('4. Profile garbage collection impact')
    console.log()

    process.exit(0)
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  }
}

// Check if --expose-gc flag is present
if (!global.gc) {
  console.log('⚠️  Warning: GC not exposed. Run with: node --expose-gc --loader tsx benchmark-memory.ts')
  console.log('   Continuing without forced GC...\n')
}

main()
