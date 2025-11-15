# Linear Integration - Quick Reference

> 빠른 참조용 문서. 전체 가이드는 [LINEAR_INTEGRATION_GUIDE.md](./LINEAR_INTEGRATION_GUIDE.md) 참조.

---

## 🎯 핵심 개념

**Octave가 주인, Linear는 선택적 연동**

```
Linear Issue → Octave Plan (변환)
Octave Plan ←→ Linear Issue (동기화)
```

---

## 📦 가져오는 데이터

### 필수 (Phase 1)
- ✅ `title` → goal/content
- ✅ `description`
- ✅ `state` → status
- ✅ `children` → todos
- ✅ `identifier`, `url` → 메타데이터

### 권장 (Phase 2)
- ⭐ `estimate` → complexity, duration
- ⭐ `priority`
- ⭐ `labels` → tags
- ⭐ `assignee`

### 선택 (Phase 3+)
- 💡 `relations` → 의존성
- 💡 `attachments`
- 💡 `comments`

---

## 🏗️ 아키텍처

```
LinearService      → Linear API 통신
    ↓
LinearAdapter      → 데이터 변환 (Linear ↔ Octave)
    ↓
LinearSyncService  → 양방향 동기화
```

---

## 🔄 상태 매핑

### Linear → Octave
```
"Todo" / "Backlog"     → "pending"
"In Progress"          → "active"
"Done"                 → "completed"
"Cancelled"            → "cancelled"
```

### Octave → Linear
```
"pending"      → "Todo"
"active"       → "In Progress"
"completed"    → "Done"
"cancelled"    → "Cancelled"
```

---

## 📝 타입 정의

### LinearSyncMetadata
```typescript
interface LinearSyncMetadata {
  enabled: boolean
  issueId: string
  identifier: string          // "PROJ-123"
  url: string
  syncDirection: 'one-way' | 'two-way'
  syncFields: ('status' | 'description')[]
  lastSyncedAt: number
  syncErrors?: Array<{
    timestamp: number
    error: string
  }>
}
```

### Extended SimpleBranchPlan
```typescript
interface SimpleBranchPlan {
  // ... 기존 필드

  metadata?: {
    source?: 'linear'
    linearSync?: LinearSyncMetadata  // ← 여기 추가
  }
}
```

### Extended Todo
```typescript
interface Todo {
  // ... 기존 필드

  metadata?: {
    linearIssueId?: string
    linearIdentifier?: string  // "PROJ-124"
  }
}
```

---

## 🔌 GraphQL Query

### Phase 1 (최소)
```graphql
query GetLinearIssue($issueId: String!) {
  issue(id: $issueId) {
    id
    identifier
    url
    title
    description
    state { name type }
    children {
      nodes {
        id
        identifier
        title
        state { name type }
      }
    }
  }
}
```

### Phase 2 (권장)
```graphql
# Phase 1 필드 +
priority
estimate
assignee { name email }
labels { nodes { name color } }
project { name }
```

---

## 🛠️ 핵심 메서드

### LinearService
```typescript
// 이슈 검색
searchIssues(options): Promise<LinearIssue[]>

// 이슈 + 서브 이슈 가져오기
getIssueWithChildren(issueId): Promise<LinearIssue>

// 상태 업데이트
updateIssueState(issueId, stateId): Promise<void>

// 코멘트 추가
addComment(issueId, body): Promise<void>
```

### LinearAdapter
```typescript
// Linear → Octave
issueToPlan(issue, workspaceId): SimpleBranchPlan

// 상태 변환
linearStateToOctaveStatus(state): PlanStatus
octaveStatusToLinearState(status): string

// 예측 변환
estimateToComplexity(estimate): TodoComplexity
estimateToSeconds(estimate): number
```

### LinearSyncService
```typescript
// Octave → Linear 동기화
syncTodoToLinear(todo, plan): Promise<void>

// Linear → Octave 동기화
syncLinearToPlan(plan, onUpdate): Promise<void>

// 자동 동기화 시작/중지
startAutoSync(planId, plan, onUpdate, interval)
stopAutoSync(planId)
```

---

## 📡 IPC Handlers

```typescript
// Linear 이슈 검색
'linear:search-issues' → (query) → LinearIssue[]

// 이슈 정보 가져오기
'linear:get-issue' → (issueId) → LinearIssue

// Plan 생성
'linear:create-plan-from-issue' → (issueId, workspaceId) → SimpleBranchPlan

// 수동 동기화
'linear:sync-plan' → (planId) → void

// API 키 설정
'linear:set-api-key' → (apiKey) → void
```

---

## 🗺️ 구현 로드맵

### Week 1: Foundation
- [ ] LinearService (API 통신)
- [ ] LinearAdapter (데이터 변환)
- [ ] LinearIssuePicker (UI)
- [ ] 기본 import 기능

### Week 2: One-Way Sync
- [ ] Octave → Linear 동기화
- [ ] Todo 상태 변경 시 Linear 업데이트
- [ ] UI에 Linear 링크 표시

### Week 3: Two-Way Sync
- [ ] Linear → Octave 동기화
- [ ] 백그라운드 폴링 (30초)
- [ ] 충돌 감지 및 해결

### Week 4: Polish
- [ ] API 키 관리
- [ ] 에러 핸들링
- [ ] 캐싱 및 성능 최적화
- [ ] 테스트 및 문서화

---

## 🎨 UI 컴포넌트

### LinearIssuePicker
```tsx
<LinearIssuePicker
  workspaceId={workspaceId}
  onSelectIssue={(plan) => {
    // Plan 생성 완료
  }}
/>
```

### TodoItem with Linear
```tsx
<TodoItem todo={todo}>
  {todo.metadata?.linearIssueId && (
    <LinearBadge
      identifier={todo.metadata.linearIdentifier}
      url={`https://linear.app/issue/${todo.metadata.linearIdentifier}`}
    />
  )}
</TodoItem>
```

### Sync Status
```tsx
<SyncStatus
  lastSyncedAt={plan.metadata?.linearSync?.lastSyncedAt}
  errors={plan.metadata?.linearSync?.syncErrors}
  onSyncNow={() => syncPlan(plan.id)}
/>
```

---

## 🧪 테스트 체크리스트

**기본 기능:**
- [ ] Linear 이슈 검색
- [ ] 이슈 → Plan 변환
- [ ] 서브 이슈 → Todos 변환
- [ ] Plan 생성 및 저장

**동기화:**
- [ ] Todo 완료 → Linear "Done"
- [ ] Linear "Done" → Todo completed
- [ ] 상태 충돌 해결
- [ ] 에러 복구 (네트워크 끊김)

**엣지 케이스:**
- [ ] Linear API 키 없음
- [ ] 존재하지 않는 이슈
- [ ] Rate limit 초과
- [ ] 커스텀 워크플로우 상태

---

## ⚙️ 설정 예시

```typescript
// User settings
{
  linear: {
    apiKey: "lin_api_xxx",
    defaultProject: "proj-123",
    syncInterval: 30000,        // 30초
    syncDirection: "two-way",
    syncFields: ["status", "description"],
    autoSync: true,

    // 커스텀 상태 매핑
    stateMapping: {
      "Todo": "pending",
      "In Progress": "active",
      "Code Review": "active",  // 커스텀
      "Done": "completed"
    }
  }
}
```

---

## 🔒 보안 체크리스트

- [ ] API 키 암호화 저장 (Keychain)
- [ ] Rate limiting 구현
- [ ] 에러 메시지에 민감 정보 미포함
- [ ] HTTPS 통신 강제
- [ ] API 키 로그 출력 금지

---

## 📊 성능 최적화

```typescript
// 캐싱
const CACHE_TTL = 60 * 1000  // 60초

// Rate limiting
const MAX_REQUESTS_PER_HOUR = 1500

// Batching
const BATCH_SIZE = 10
const DEBOUNCE_MS = 1000

// Polling
const SYNC_INTERVAL = 30 * 1000     // 활성
const IDLE_SYNC_INTERVAL = 5 * 60 * 1000  // 유휴 시
```

---

## 🐛 트러블슈팅

| 증상 | 원인 | 해결 |
|-----|------|------|
| Sync not working | API 키 만료 | 새 API 키 발급 |
| State mismatch | 커스텀 워크플로우 | State mapping 설정 |
| Rate limit error | 요청 과다 | Interval 증가 |
| Network timeout | Linear API 다운 | Retry with backoff |

---

## 📚 참고 자료

- [전체 가이드](./LINEAR_INTEGRATION_GUIDE.md)
- [Linear API Docs](https://developers.linear.app/docs)
- [Plan Mode 구조](./BRANCH_PLAN_UI_PROPOSAL.md)

---

## 🚀 빠른 시작

```bash
# 1. 의존성 설치
npm install @linear/sdk graphql-request

# 2. 타입 정의 추가
# octave/src/types/linear.ts

# 3. 서비스 구현
# octave/src/services/LinearService.ts
# octave/src/services/LinearAdapter.ts
# octave/src/services/LinearSyncService.ts

# 4. IPC 핸들러 등록
# octave/electron/linearHandlers.ts

# 5. UI 컴포넌트
# octave/src/components/linear/LinearIssuePicker.tsx

# 6. 테스트
npm run test linear
```

---

**Last updated:** 2025-11-15
**Version:** 1.0.0
