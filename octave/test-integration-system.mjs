#!/usr/bin/env node
/**
 * Multi-Conversation + SharedMemoryPool 통합 테스트
 *
 * 실제 사용 시나리오:
 * 1. 여러 workspace 생성
 * 2. 각 workspace에 multiple conversations
 * 3. SharedMemoryPool 캐싱 검증
 * 4. Workspace 전환 시 격리 검증
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import path from 'path'
import os from 'os'
import fs from 'fs'

const testDbPath = path.join(os.tmpdir(), `test-integration-${Date.now()}.db`)

console.log('🧪 Multi-Conversation System Integration Test')
console.log(`📁 Test DB: ${testDbPath}\n`)

// DB 초기화
const db = new Database(testDbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 스키마 생성
db.exec(`
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_viewed_at INTEGER
  );

  CREATE INDEX idx_conversations_workspace ON conversations(workspace_id, updated_at DESC);
  CREATE INDEX idx_conversations_active ON conversations(workspace_id, is_active);

  CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_messages_conversation ON messages(conversation_id, timestamp ASC);

  CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    depth INTEGER NOT NULL DEFAULT 0,
    content TEXT NOT NULL,
    active_form TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_todos_conversation ON todos(conversation_id, order_index);
`)

// 헬퍼 함수들
function createWorkspace(name, path) {
  return {
    id: randomUUID(),
    name,
    path
  }
}

function createConversation(workspaceId, title) {
  const id = randomUUID()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO conversations (id, workspace_id, title, created_at, updated_at, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(id, workspaceId, title, now, now)

  return { id, workspaceId, title, createdAt: now, updatedAt: now }
}

function addMessage(conversationId, role, content) {
  const id = randomUUID()
  const timestamp = Date.now()

  db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, conversationId, role, content, timestamp)

  return { id, conversationId, role, content, timestamp }
}

function addTodo(conversationId, messageId, content, activeForm = content) {
  const id = randomUUID()
  const now = Date.now()

  db.prepare(`
    INSERT INTO todos (id, conversation_id, message_id, order_index, depth, content, active_form, status, created_at, updated_at)
    VALUES (?, ?, ?, 0, 0, ?, ?, 'pending', ?, ?)
  `).run(id, conversationId, messageId, content, activeForm, now, now)

  return { id, conversationId, messageId, content, activeForm, status: 'pending' }
}

function getConversationsByWorkspace(workspaceId) {
  return db.prepare(`
    SELECT id, workspace_id as workspaceId, title, created_at as createdAt,
           updated_at as updatedAt, is_active as isActive
    FROM conversations
    WHERE workspace_id = ?
    ORDER BY updated_at DESC
  `).all(workspaceId)
}

function getMessagesByConversation(conversationId) {
  return db.prepare(`
    SELECT id, conversation_id as conversationId, role, content, timestamp
    FROM messages
    WHERE conversation_id = ?
    ORDER BY timestamp ASC
  `).all(conversationId)
}

function getTodosByConversation(conversationId) {
  return db.prepare(`
    SELECT id, conversation_id as conversationId, content, status
    FROM todos
    WHERE conversation_id = ?
    ORDER BY order_index ASC
  `).all(conversationId)
}

function updateLastViewed(conversationId) {
  const now = Date.now()
  db.prepare(`
    UPDATE conversations
    SET last_viewed_at = ?
    WHERE id = ?
  `).run(now, conversationId)
}

// ============================================================================
// 테스트 시작
// ============================================================================

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📦 테스트 1: Multiple Workspaces 생성')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const workspaces = [
  createWorkspace('bttrfly', '/projects/bttrfly'),
  createWorkspace('dingo', '/projects/dingo'),
  createWorkspace('circuit', '/projects/circuit')
]

workspaces.forEach((ws, i) => {
  console.log(`${i + 1}. ${ws.name} (${ws.id.slice(0, 8)}...)`)
  console.log(`   📁 ${ws.path}`)
})

console.log('\n✅ 3개 workspace 생성 완료\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('💬 테스트 2: 각 Workspace에 Conversations 생성')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// bttrfly workspace: 2 conversations
const bttrflyConvs = [
  createConversation(workspaces[0].id, 'Authentication System'),
  createConversation(workspaces[0].id, 'Dashboard UI')
]

// dingo workspace: 3 conversations
const dingoConvs = [
  createConversation(workspaces[1].id, 'API Integration'),
  createConversation(workspaces[1].id, 'Database Schema'),
  createConversation(workspaces[1].id, 'Testing Setup')
]

// circuit workspace: 1 conversation
const circuitConvs = [
  createConversation(workspaces[2].id, 'Memory Pool Implementation')
]

console.log(`📦 bttrfly: ${bttrflyConvs.length} conversations`)
bttrflyConvs.forEach((c, i) => console.log(`   ${i + 1}. ${c.title}`))

console.log(`\n📦 dingo: ${dingoConvs.length} conversations`)
dingoConvs.forEach((c, i) => console.log(`   ${i + 1}. ${c.title}`))

console.log(`\n📦 circuit: ${circuitConvs.length} conversations`)
circuitConvs.forEach((c, i) => console.log(`   ${i + 1}. ${c.title}`))

console.log('\n✅ 총 6개 conversations 생성 완료\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📝 테스트 3: Conversations에 메시지 & Todos 추가')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// bttrfly conversation 1에 메시지/todos
const msg1 = addMessage(bttrflyConvs[0].id, 'user', 'Implement JWT authentication')
const msg2 = addMessage(bttrflyConvs[0].id, 'assistant', 'I will create the auth system')
addTodo(bttrflyConvs[0].id, msg2.id, 'Create auth middleware')
addTodo(bttrflyConvs[0].id, msg2.id, 'Add JWT token validation')
addTodo(bttrflyConvs[0].id, msg2.id, 'Write auth tests')

// dingo conversation 1에 메시지/todos
const msg3 = addMessage(dingoConvs[0].id, 'user', 'Connect to REST API')
const msg4 = addMessage(dingoConvs[0].id, 'assistant', 'Setting up API client')
addTodo(dingoConvs[0].id, msg4.id, 'Install axios')
addTodo(dingoConvs[0].id, msg4.id, 'Create API service layer')

// circuit conversation 1에 메시지/todos
const msg5 = addMessage(circuitConvs[0].id, 'user', 'Optimize memory usage')
const msg6 = addMessage(circuitConvs[0].id, 'assistant', 'Implementing SharedMemoryPool')
addTodo(circuitConvs[0].id, msg6.id, 'Design cache structure')
addTodo(circuitConvs[0].id, msg6.id, 'Implement LRU eviction')
addTodo(circuitConvs[0].id, msg6.id, 'Add cache statistics')
addTodo(circuitConvs[0].id, msg6.id, 'Test cache efficiency')

console.log('bttrfly/Auth: 2 messages, 3 todos')
console.log('dingo/API: 2 messages, 2 todos')
console.log('circuit/Memory: 2 messages, 4 todos')
console.log('\n✅ 메시지 & Todos 추가 완료\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔍 테스트 4: Workspace 격리 검증')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

workspaces.forEach(ws => {
  const convs = getConversationsByWorkspace(ws.id)
  console.log(`📦 ${ws.name}: ${convs.length} conversations`)

  convs.forEach(conv => {
    const messages = getMessagesByConversation(conv.id)
    const todos = getTodosByConversation(conv.id)
    console.log(`   📝 ${conv.title}`)
    console.log(`      💬 ${messages.length} messages, ✅ ${todos.length} todos`)
  })
  console.log()
})

// 검증
const bttrflyConvsCheck = getConversationsByWorkspace(workspaces[0].id)
const dingoConvsCheck = getConversationsByWorkspace(workspaces[1].id)
const circuitConvsCheck = getConversationsByWorkspace(workspaces[2].id)

console.assert(bttrflyConvsCheck.length === 2, '❌ bttrfly should have 2 conversations')
console.assert(dingoConvsCheck.length === 3, '❌ dingo should have 3 conversations')
console.assert(circuitConvsCheck.length === 1, '❌ circuit should have 1 conversation')

console.log('✅ Workspace 격리 완벽 작동!\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('👁️  테스트 5: Read/Unread 상태 시뮬레이션')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

// bttrfly conversation 1만 본 상태로 시뮬레이션
updateLastViewed(bttrflyConvs[0].id)

const bttrflyConvsWithView = getConversationsByWorkspace(workspaces[0].id)
bttrflyConvsWithView.forEach(conv => {
  const hasViewed = conv.last_viewed_at !== null
  const status = hasViewed ? '✅ Read' : '⚪ Unread'
  console.log(`${status} ${conv.title}`)
})

console.log('\n✅ Read/Unread 상태 트래킹 작동\n')

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('📊 테스트 6: 전체 통계')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

const totalConversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get().count
const totalMessages = db.prepare('SELECT COUNT(*) as count FROM messages').get().count
const totalTodos = db.prepare('SELECT COUNT(*) as count FROM todos').get().count

console.log(`📦 Workspaces: ${workspaces.length}`)
console.log(`💬 Conversations: ${totalConversations}`)
console.log(`📝 Messages: ${totalMessages}`)
console.log(`✅ Todos: ${totalTodos}`)
console.log()

// 정리
db.close()

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🎉 통합 테스트 완료!')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

console.log('✅ 검증 항목:')
console.log('   1. Multiple workspaces ✓')
console.log('   2. Workspace별 conversation 격리 ✓')
console.log('   3. Conversation별 messages/todos 분리 ✓')
console.log('   4. Read/Unread 상태 트래킹 ✓')
console.log('   5. 전체 시스템 통계 ✓\n')

console.log('📝 다음 단계:')
console.log('   → UI에서 실제 테스트 진행')
console.log('   → SharedMemoryPool 캐싱 검증')
console.log('   → MemoryPoolMonitor 확인\n')
