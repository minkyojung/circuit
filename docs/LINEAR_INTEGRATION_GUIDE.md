# Linear Integration Guide

## Overview

This document outlines the architecture and implementation strategy for integrating Linear (project management tool) with Octave's Plan Mode.

### Design Philosophy

**Octave remains the primary system. Linear is an optional data source and sync target.**

This approach ensures:
- ✅ Plan Mode works independently without Linear
- ✅ Easy extension to other tools (Jira, GitHub Issues, Asana)
- ✅ Minimal changes to existing codebase
- ✅ Gradual implementation with incremental value

---

## Table of Contents

1. [Architecture Decision](#architecture-decision)
2. [Data Flow](#data-flow)
3. [Linear Data Model](#linear-data-model)
4. [Type Definitions](#type-definitions)
5. [Core Services](#core-services)
6. [Implementation Roadmap](#implementation-roadmap)
7. [API Reference](#api-reference)
8. [Testing Strategy](#testing-strategy)

---

## Architecture Decision

### Option A: Linear-First (NOT CHOSEN)
Linear becomes the source of truth. Octave adapts to Linear's data model.

**Rejected because:**
- ❌ Plan Mode cannot work without Linear
- ❌ Tight coupling to Linear's API
- ❌ Difficult to support other tools
- ❌ Major refactoring required

### Option B: Octave-First (CHOSEN)
Octave maintains its own data model. Linear integration is optional metadata.

**Benefits:**
- ✅ Plan Mode is fully independent
- ✅ Linear is just another integration point
- ✅ Existing code mostly unchanged
- ✅ Can support multiple tools simultaneously

---

## Data Flow

### High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│              User Interface                      │
│                                                  │
│  ┌──────────────┐      ┌──────────────┐         │
│  │ Linear       │      │ Plan Mode    │         │
│  │ Issue Picker │─────▶│ Chat         │         │
│  └──────────────┘      └──────────────┘         │
│         │                      │                 │
│         │                      │                 │
│         ▼                      ▼                 │
│  ┌──────────────┐      ┌──────────────┐         │
│  │ Linear       │◀────▶│ Octave Plan  │         │
│  │ Adapter      │      │ (Primary)    │         │
│  └──────────────┘      └──────────────┘         │
│         │                      │                 │
├─────────┼──────────────────────┼─────────────────┤
│         │      IPC Layer       │                 │
├─────────┼──────────────────────┼─────────────────┤
│         ▼                      ▼                 │
│  ┌──────────────┐      ┌──────────────┐         │
│  │ Linear       │      │   SQLite     │         │
│  │ Sync Service │─────▶│   Database   │         │
│  └──────────────┘      └──────────────┘         │
│         │                                        │
│         ▼                                        │
│  ┌──────────────┐                                │
│  │ Linear API   │                                │
│  │ (GraphQL)    │                                │
│  └──────────────┘                                │
└─────────────────────────────────────────────────┘
```

### Workflow: Creating Plan from Linear Issue

```
1. User clicks "Import from Linear"
   ↓
2. LinearIssuePicker displays search UI
   ↓
3. User searches/selects issue (e.g., "PROJ-123")
   ↓
4. LinearService.getIssueWithChildren(issueId)
   ↓
5. LinearAdapter.issueToplan(linearIssue)
   - Converts Linear structure to SimpleBranchPlan
   - Maps state: "In Progress" → "active"
   - Maps estimate: 5 points → "medium" complexity
   - Creates todos from children
   ↓
6. Display plan preview for approval
   ↓
7. User approves
   ↓
8. Save plan to SQLite with linearSync metadata
   ↓
9. LinearSyncService.startAutoSync(plan)
   - Polls Linear every 30s for changes
   ↓
10. Plan execution begins
    - Todo status changes trigger Linear updates
    - Linear changes trigger Todo updates
```

### Workflow: Two-Way Sync

```
Octave → Linear:
─────────────────
Todo status updated
   ↓
LinearSyncService.syncTodosToLinear()
   ↓
Map Octave status → Linear state
   ↓
LinearService.updateIssueState()
   ↓
Add comment to Linear issue


Linear → Octave:
─────────────────
Background polling (every 30s)
   ↓
LinearSyncService.syncLinearToPlan()
   ↓
Fetch current Linear issue state
   ↓
Compare with Octave plan state
   ↓
If different, update Octave plan
   ↓
Broadcast update event to UI
```

---

## Linear Data Model

### What We Fetch from Linear

#### Priority 1: Essential (Phase 1)

```graphql
query GetLinearIssue($issueId: String!) {
  issue(id: $issueId) {
    # Identity
    id                          # UUID
    identifier                  # "PROJ-123"
    url                         # Web URL

    # Content
    title                       # Issue title
    description                 # Markdown description

    # State
    state {
      id
      name                      # "Todo", "In Progress", "Done"
      type                      # "backlog", "started", "completed"
    }

    # Hierarchy
    parent {
      id
      identifier
    }
    children {
      nodes {
        id
        identifier
        title
        description
        state { name type }
      }
    }
  }
}
```

**Data Mapping:**
- `title` → `SimpleBranchPlan.goal` or `Todo.content`
- `description` → `SimpleBranchPlan.description` or `Todo.description`
- `state.type` → `PlanStatus` or `TodoStatus`
- `children.nodes` → `SimpleBranchPlan.todos[]`
- `identifier`, `url` → `metadata.linearSync`

#### Priority 2: Useful (Phase 2)

```graphql
query GetLinearIssueEnriched($issueId: String!) {
  issue(id: $issueId) {
    # Phase 1 fields...

    # Estimation
    priority                    # 0-4 (0=None, 4=Urgent)
    estimate                    # Story points

    # Assignment
    assignee {
      id
      name
      email
      avatarUrl
    }

    # Categorization
    labels {
      nodes {
        id
        name                    # "bug", "feature"
        color                   # "#FF6B6B"
      }
    }

    # Project
    project {
      id
      name                      # "Q4 Roadmap"
      icon
    }

    # Apply same fields to children
    children {
      nodes {
        # ... all above fields
      }
    }
  }
}
```

**Data Mapping:**
- `estimate` → `Todo.complexity` (1-2: simple, 3-5: medium, 8+: complex)
- `estimate` → `Todo.estimatedDuration` (1 point = 2 hours)
- `priority` → `Todo.priority`
- `labels` → `Todo.metadata.tags`
- `assignee` → Display in UI only

#### Priority 3: Advanced (Phase 3+)

```graphql
query GetLinearIssueFull($issueId: String!) {
  issue(id: $issueId) {
    # Phase 1 & 2 fields...

    # Timing
    createdAt
    updatedAt
    startedAt
    completedAt

    # Relations
    relations {
      nodes {
        type                    # "blocks", "blocked_by"
        relatedIssue {
          id
          identifier
          title
        }
      }
    }

    # Attachments
    attachments {
      nodes {
        id
        title
        url
      }
    }

    # Recent comments (limit 3)
    comments(first: 3) {
      nodes {
        id
        body                    # Markdown
        user { name }
        createdAt
      }
    }
  }
}
```

**Use Cases:**
- `relations` → Todo dependencies
- `attachments` → Reference materials
- `comments` → Team discussion context

### State Mapping

#### Linear State → Octave Status

```typescript
const LINEAR_TO_OCTAVE_STATE: Record<string, PlanStatus | TodoStatus> = {
  // Backlog states
  'Backlog': 'pending',
  'Todo': 'pending',
  'Triage': 'pending',

  // Active states
  'In Progress': 'active',
  'In Review': 'active',
  'In Development': 'active',

  // Completed states
  'Done': 'completed',
  'Merged': 'completed',
  'Shipped': 'completed',

  // Cancelled states
  'Cancelled': 'cancelled',
  'Won\'t Do': 'cancelled',
  'Duplicate': 'cancelled'
}
```

#### Octave Status → Linear State

```typescript
const OCTAVE_TO_LINEAR_STATE: Record<PlanStatus | TodoStatus, string> = {
  'pending': 'Todo',
  'active': 'In Progress',
  'in_progress': 'In Progress',
  'completed': 'Done',
  'cancelled': 'Cancelled',
  'archived': 'Cancelled',
  'failed': 'Cancelled',
  'skipped': 'Cancelled'
}
```

**Note:** Linear teams can customize their workflow states. The sync service should allow users to configure custom mappings.

---

## Type Definitions

### Extended Plan Types

```typescript
// octave/src/types/linear.ts

/**
 * Linear issue data from API
 */
export interface LinearIssue {
  // Identity
  id: string
  identifier: string          // "PROJ-123"
  url: string

  // Content
  title: string
  description?: string

  // State
  state: {
    id: string
    name: string
    type: 'backlog' | 'started' | 'completed' | 'canceled'
  }

  // Hierarchy
  parent?: {
    id: string
    identifier: string
  }
  children: {
    nodes: LinearIssue[]
  }

  // Optional fields
  priority?: number           // 0-4
  estimate?: number           // Story points
  assignee?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  labels?: {
    nodes: Array<{
      id: string
      name: string
      color: string
    }>
  }
  project?: {
    id: string
    name: string
    icon?: string
  }

  // Timestamps
  createdAt?: string
  updatedAt?: string
  startedAt?: string
  completedAt?: string
}

/**
 * Linear sync configuration
 */
export interface LinearSyncMetadata {
  enabled: boolean
  issueId: string
  identifier: string          // "PROJ-123"
  url: string
  projectId?: string

  // Sync settings
  syncDirection: 'one-way' | 'two-way'
  syncFields: Array<'status' | 'description' | 'estimate' | 'priority'>

  // State
  lastSyncedAt: number
  syncErrors?: Array<{
    timestamp: number
    error: string
  }>
}

/**
 * Extended SimpleBranchPlan with Linear support
 */
export interface SimpleBranchPlan {
  // ... existing fields

  metadata?: {
    // ... existing metadata

    // Linear integration (optional)
    linearSync?: LinearSyncMetadata
  }
}

/**
 * Extended Todo with Linear support
 */
export interface Todo {
  // ... existing fields

  metadata?: {
    // ... existing metadata

    // Linear issue mapping
    linearIssueId?: string
    linearIdentifier?: string  // "PROJ-124"
  }
}
```

---

## Core Services

### 1. LinearService

Location: `octave/src/services/LinearService.ts`

Responsible for all Linear API communication.

```typescript
import { GraphQLClient } from 'graphql-request'

export class LinearService {
  private client: GraphQLClient

  constructor(apiKey: string) {
    this.client = new GraphQLClient('https://api.linear.app/graphql', {
      headers: {
        authorization: apiKey
      }
    })
  }

  /**
   * Search issues by query
   */
  async searchIssues(options: {
    projectId?: string
    assigneeId?: string
    stateType?: 'backlog' | 'started' | 'completed'
    labels?: string[]
    limit?: number
  }): Promise<LinearIssue[]> {
    const query = `
      query SearchIssues($filter: IssueFilter, $limit: Int) {
        issues(filter: $filter, first: $limit) {
          nodes {
            id
            identifier
            title
            url
            state { name type }
            project { name }
            assignee { name }
          }
        }
      }
    `

    const result = await this.client.request(query, {
      filter: this.buildFilter(options),
      limit: options.limit || 20
    })

    return result.issues.nodes
  }

  /**
   * Get issue with all children (recursive)
   */
  async getIssueWithChildren(issueId: string): Promise<LinearIssue> {
    const query = `
      query GetIssue($issueId: String!) {
        issue(id: $issueId) {
          id
          identifier
          url
          title
          description
          state { id name type }
          priority
          estimate
          assignee {
            id
            name
            email
            avatarUrl
          }
          labels {
            nodes {
              id
              name
              color
            }
          }
          project {
            id
            name
            icon
          }
          children {
            nodes {
              id
              identifier
              title
              description
              state { id name type }
              priority
              estimate
              assignee { name }
              labels { nodes { name } }
            }
          }
        }
      }
    `

    const result = await this.client.request(query, { issueId })
    return result.issue
  }

  /**
   * Update issue state
   */
  async updateIssueState(issueId: string, stateId: string): Promise<void> {
    const mutation = `
      mutation UpdateIssue($issueId: String!, $stateId: String!) {
        issueUpdate(
          id: $issueId,
          input: { stateId: $stateId }
        ) {
          success
        }
      }
    `

    await this.client.request(mutation, { issueId, stateId })
  }

  /**
   * Add comment to issue
   */
  async addComment(issueId: string, body: string): Promise<void> {
    const mutation = `
      mutation AddComment($issueId: String!, $body: String!) {
        commentCreate(
          input: {
            issueId: $issueId,
            body: $body
          }
        ) {
          success
        }
      }
    `

    await this.client.request(mutation, { issueId, body })
  }

  /**
   * Get workflow states for mapping
   */
  async getWorkflowStates(teamId: string): Promise<Array<{
    id: string
    name: string
    type: string
  }>> {
    const query = `
      query GetStates($teamId: String!) {
        team(id: $teamId) {
          states {
            nodes {
              id
              name
              type
            }
          }
        }
      }
    `

    const result = await this.client.request(query, { teamId })
    return result.team.states.nodes
  }

  private buildFilter(options: any): any {
    // Build Linear API filter object
    return {
      project: options.projectId ? { id: { eq: options.projectId } } : undefined,
      assignee: options.assigneeId ? { id: { eq: options.assigneeId } } : undefined,
      state: options.stateType ? { type: { eq: options.stateType } } : undefined,
      labels: options.labels ? { some: { name: { in: options.labels } } } : undefined
    }
  }
}
```

### 2. LinearAdapter

Location: `octave/src/services/LinearAdapter.ts`

Converts between Linear and Octave data models.

```typescript
import { LinearIssue, LinearSyncMetadata } from '../types/linear'
import { SimpleBranchPlan, TodoDraft, PlanStatus, TodoStatus, TodoComplexity } from '../types/plan'

export class LinearAdapter {
  /**
   * Convert Linear Issue to Octave Plan
   */
  issueToPlan(
    issue: LinearIssue,
    workspaceId: string
  ): SimpleBranchPlan {
    const todos = this.issuesToTodos(issue.children.nodes)

    return {
      id: this.generateId(),
      workspaceId,

      // Map Linear content to Octave
      goal: issue.title,
      description: issue.description || undefined,

      // Convert children to todos
      todos,
      totalTodos: todos.length,
      totalEstimatedDuration: this.calculateTotalDuration(todos),

      // Map state
      status: this.linearStateToOctaveStatus(issue.state),

      // Linear sync metadata
      metadata: {
        source: 'linear',
        createdBy: 'user',
        executionMode: 'manual',
        tags: issue.labels?.nodes.map(l => l.name) || [],

        linearSync: {
          enabled: true,
          issueId: issue.id,
          identifier: issue.identifier,
          url: issue.url,
          projectId: issue.project?.id,
          syncDirection: 'two-way',
          syncFields: ['status', 'description'],
          lastSyncedAt: Date.now()
        }
      },

      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  }

  /**
   * Convert Linear issues to Octave todos
   */
  private issuesToTodos(issues: LinearIssue[]): TodoDraft[] {
    return issues.map((issue, index) => ({
      content: issue.title,
      activeForm: `${issue.title} 작업 중`,
      description: issue.description,
      complexity: this.estimateToComplexity(issue.estimate),
      estimatedDuration: this.estimateToSeconds(issue.estimate),
      priority: this.linearPriorityToOctave(issue.priority),
      order: index,
      metadata: {
        linearIssueId: issue.id,
        linearIdentifier: issue.identifier,
        tags: issue.labels?.nodes.map(l => l.name) || []
      }
    }))
  }

  /**
   * Map Linear state to Octave status
   */
  linearStateToOctaveStatus(state: LinearIssue['state']): PlanStatus {
    const mapping: Record<string, PlanStatus> = {
      'backlog': 'pending',
      'started': 'active',
      'completed': 'completed',
      'canceled': 'cancelled'
    }

    return mapping[state.type] || 'pending'
  }

  /**
   * Map Octave status to Linear state name
   */
  octaveStatusToLinearState(status: PlanStatus | TodoStatus): string {
    const mapping: Record<string, string> = {
      'pending': 'Todo',
      'active': 'In Progress',
      'in_progress': 'In Progress',
      'completed': 'Done',
      'cancelled': 'Cancelled',
      'failed': 'Cancelled',
      'skipped': 'Cancelled'
    }

    return mapping[status] || 'Todo'
  }

  /**
   * Convert Linear estimate (story points) to complexity
   */
  private estimateToComplexity(estimate?: number): TodoComplexity {
    if (!estimate) return 'medium'
    if (estimate <= 1) return 'trivial'
    if (estimate <= 2) return 'simple'
    if (estimate <= 5) return 'medium'
    if (estimate <= 8) return 'complex'
    return 'very_complex'
  }

  /**
   * Convert story points to estimated duration in seconds
   * Default: 1 point = 2 hours
   */
  private estimateToSeconds(estimate?: number): number {
    const hoursPerPoint = 2
    const points = estimate || 2
    return points * hoursPerPoint * 3600
  }

  /**
   * Map Linear priority (0-4) to Octave priority
   */
  private linearPriorityToOctave(priority?: number): 'low' | 'medium' | 'high' | 'critical' {
    if (!priority || priority === 0) return 'medium'
    if (priority === 1) return 'low'
    if (priority === 2) return 'medium'
    if (priority === 3) return 'high'
    return 'critical'
  }

  private calculateTotalDuration(todos: TodoDraft[]): number {
    return todos.reduce((sum, todo) => sum + (todo.estimatedDuration || 0), 0)
  }

  private generateId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
```

### 3. LinearSyncService

Location: `octave/src/services/LinearSyncService.ts`

Handles bidirectional synchronization.

```typescript
import { LinearService } from './LinearService'
import { LinearAdapter } from './LinearAdapter'
import { SimpleBranchPlan, Todo, PlanStatus, TodoStatus } from '../types/plan'

export class LinearSyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private linearService: LinearService,
    private adapter: LinearAdapter
  ) {}

  /**
   * Sync Octave plan changes to Linear
   */
  async syncPlanToLinear(plan: SimpleBranchPlan): Promise<void> {
    if (!this.shouldSync(plan, 'plan-to-linear')) return

    const { issueId } = plan.metadata!.linearSync!

    try {
      // Update parent issue state if plan status changed
      const linearState = this.adapter.octaveStatusToLinearState(plan.status)
      const states = await this.linearService.getWorkflowStates(/* teamId */)
      const stateId = states.find(s => s.name === linearState)?.id

      if (stateId) {
        await this.linearService.updateIssueState(issueId, stateId)
      }

      // Update sync timestamp
      this.updateSyncTimestamp(plan)
    } catch (error) {
      this.recordSyncError(plan, error as Error)
    }
  }

  /**
   * Sync individual todo change to Linear
   */
  async syncTodoToLinear(
    todo: Todo,
    plan: SimpleBranchPlan
  ): Promise<void> {
    if (!this.shouldSync(plan, 'todo-to-linear')) return
    if (!todo.metadata?.linearIssueId) return

    try {
      // Update Linear issue state
      const linearState = this.adapter.octaveStatusToLinearState(todo.status)
      const states = await this.linearService.getWorkflowStates(/* teamId */)
      const stateId = states.find(s => s.name === linearState)?.id

      if (stateId) {
        await this.linearService.updateIssueState(
          todo.metadata.linearIssueId,
          stateId
        )
      }

      // Add completion comment
      if (todo.status === 'completed') {
        await this.linearService.addComment(
          todo.metadata.linearIssueId,
          `✅ Completed via Octave at ${new Date().toISOString()}`
        )
      }

      this.updateSyncTimestamp(plan)
    } catch (error) {
      this.recordSyncError(plan, error as Error)
    }
  }

  /**
   * Sync Linear issue changes to Octave plan
   */
  async syncLinearToPlan(
    plan: SimpleBranchPlan,
    onUpdate: (updates: Partial<SimpleBranchPlan>) => Promise<void>
  ): Promise<void> {
    if (!this.shouldSync(plan, 'linear-to-plan')) return

    const { issueId } = plan.metadata!.linearSync!

    try {
      // Fetch current Linear state
      const linearIssue = await this.linearService.getIssueWithChildren(issueId)

      // Compare and update if different
      const linearStatus = this.adapter.linearStateToOctaveStatus(linearIssue.state)

      if (linearStatus !== plan.status) {
        await onUpdate({
          status: linearStatus,
          updatedAt: Date.now()
        })
      }

      // TODO: Sync child issues to todos

      this.updateSyncTimestamp(plan)
    } catch (error) {
      this.recordSyncError(plan, error as Error)
    }
  }

  /**
   * Start automatic background sync
   */
  startAutoSync(
    planId: string,
    plan: SimpleBranchPlan,
    onUpdate: (updates: Partial<SimpleBranchPlan>) => Promise<void>,
    intervalMs: number = 30000
  ): void {
    // Stop existing sync if any
    this.stopAutoSync(planId)

    // Start new sync interval
    const interval = setInterval(async () => {
      try {
        await this.syncLinearToPlan(plan, onUpdate)
      } catch (error) {
        console.error('Auto-sync error:', error)
      }
    }, intervalMs)

    this.syncIntervals.set(planId, interval)
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync(planId: string): void {
    const interval = this.syncIntervals.get(planId)
    if (interval) {
      clearInterval(interval)
      this.syncIntervals.delete(planId)
    }
  }

  /**
   * Check if sync should proceed
   */
  private shouldSync(plan: SimpleBranchPlan, direction: string): boolean {
    const sync = plan.metadata?.linearSync
    if (!sync || !sync.enabled) return false

    if (direction === 'plan-to-linear' || direction === 'todo-to-linear') {
      return sync.syncDirection === 'two-way' || sync.syncDirection === 'one-way'
    }

    if (direction === 'linear-to-plan') {
      return sync.syncDirection === 'two-way'
    }

    return false
  }

  private updateSyncTimestamp(plan: SimpleBranchPlan): void {
    if (plan.metadata?.linearSync) {
      plan.metadata.linearSync.lastSyncedAt = Date.now()
    }
  }

  private recordSyncError(plan: SimpleBranchPlan, error: Error): void {
    if (!plan.metadata?.linearSync) return

    if (!plan.metadata.linearSync.syncErrors) {
      plan.metadata.linearSync.syncErrors = []
    }

    plan.metadata.linearSync.syncErrors.push({
      timestamp: Date.now(),
      error: error.message
    })

    // Keep only last 10 errors
    if (plan.metadata.linearSync.syncErrors.length > 10) {
      plan.metadata.linearSync.syncErrors =
        plan.metadata.linearSync.syncErrors.slice(-10)
    }
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1)
**Goal:** Basic Linear issue import

**Tasks:**
1. ✅ Install dependencies (`@linear/sdk`, `graphql-request`)
2. ✅ Create type definitions (`types/linear.ts`)
3. ✅ Implement `LinearService` (search, getIssue)
4. ✅ Implement `LinearAdapter` (issueToPlan)
5. ✅ Add `linearSync` metadata to `SimpleBranchPlan`
6. ✅ Create `LinearIssuePicker` UI component
7. ✅ Implement import workflow (UI → Service → Adapter → Plan)
8. ✅ Test with real Linear API

**Deliverable:** User can search and import Linear issues as plans.

### Phase 2: One-Way Sync (Week 2)
**Goal:** Octave updates reflect in Linear

**Tasks:**
1. ✅ Implement `LinearSyncService.syncTodoToLinear()`
2. ✅ Hook into `TodoContext.updateTodoStatus()`
3. ✅ Add state mapping configuration
4. ✅ Implement error handling and retry logic
5. ✅ Add sync status indicator in UI
6. ✅ Add Linear link badge to `TodoItem`
7. ✅ Test sync reliability

**Deliverable:** Completing a todo in Octave updates Linear issue to "Done".

### Phase 3: Two-Way Sync (Week 3)
**Goal:** Linear changes reflect in Octave

**Tasks:**
1. ✅ Implement `LinearSyncService.syncLinearToPlan()`
2. ✅ Implement background polling (every 30s)
3. ✅ Add conflict detection and resolution
4. ✅ Implement webhook support (optional)
5. ✅ Add "Last synced" timestamp in UI
6. ✅ Add manual "Sync Now" button
7. ✅ Test bidirectional sync scenarios

**Deliverable:** Changes in Linear automatically update Octave plan.

### Phase 4: Polish (Week 4)
**Goal:** Production-ready experience

**Tasks:**
1. ✅ Add Linear API key management (secure storage)
2. ✅ Implement rate limiting and caching
3. ✅ Add bulk import (multiple issues)
4. ✅ Improve error messages and recovery
5. ✅ Add sync history/audit log
6. ✅ Write comprehensive tests
7. ✅ Update documentation
8. ✅ Beta testing with real users

**Deliverable:** Stable, reliable Linear integration ready for production.

### Future Enhancements
- Sync comments between Linear and Octave
- Support for Linear attachments
- Track time estimates vs actuals
- Custom field mapping
- Multi-project support
- Jira/GitHub Issues adapters (same pattern)

---

## API Reference

### IPC Handlers

Add to `octave/electron/linearHandlers.ts`:

```typescript
ipcMain.handle('linear:search-issues', async (event, query) => {
  const linearService = new LinearService(getApiKey())
  return await linearService.searchIssues(query)
})

ipcMain.handle('linear:get-issue', async (event, issueId) => {
  const linearService = new LinearService(getApiKey())
  return await linearService.getIssueWithChildren(issueId)
})

ipcMain.handle('linear:create-plan-from-issue', async (event, issueId, workspaceId) => {
  const linearService = new LinearService(getApiKey())
  const adapter = new LinearAdapter()

  const issue = await linearService.getIssueWithChildren(issueId)
  const plan = adapter.issueToPlan(issue, workspaceId)

  // Save plan to database
  await savePlan(plan)

  // Start auto-sync
  const syncService = new LinearSyncService(linearService, adapter)
  syncService.startAutoSync(plan.id, plan, async (updates) => {
    await updatePlan(plan.id, updates)
  })

  return plan
})

ipcMain.handle('linear:sync-plan', async (event, planId) => {
  const plan = await getPlan(planId)
  if (!plan || plan.metadata?.source !== 'linear') {
    throw new Error('Not a Linear plan')
  }

  const linearService = new LinearService(getApiKey())
  const adapter = new LinearAdapter()
  const syncService = new LinearSyncService(linearService, adapter)

  await syncService.syncLinearToPlan(plan, async (updates) => {
    await updatePlan(planId, updates)
  })
})

ipcMain.handle('linear:set-api-key', async (event, apiKey) => {
  await storeEncryptedApiKey(apiKey)
})
```

### React Hooks

```typescript
// hooks/useLinearIntegration.ts

export function useLinearIntegration(workspaceId: string) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchIssues = async (query: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const issues = await window.ipc.invoke('linear:search-issues', {
        projectId: query.projectId,
        // ... other filters
      })
      return issues
    } catch (err) {
      setError(err.message)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const createPlanFromIssue = async (issueId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const plan = await window.ipc.invoke(
        'linear:create-plan-from-issue',
        issueId,
        workspaceId
      )
      return plan
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  const syncPlan = async (planId: string) => {
    try {
      await window.ipc.invoke('linear:sync-plan', planId)
    } catch (err) {
      setError(err.message)
    }
  }

  return {
    searchIssues,
    createPlanFromIssue,
    syncPlan,
    isLoading,
    error
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// LinearAdapter.test.ts

describe('LinearAdapter', () => {
  it('converts Linear issue to plan', () => {
    const issue: LinearIssue = {
      id: 'abc-123',
      identifier: 'PROJ-42',
      title: 'Build feature',
      state: { type: 'started', name: 'In Progress' },
      children: { nodes: [] }
    }

    const adapter = new LinearAdapter()
    const plan = adapter.issueToPlan(issue, 'ws-1')

    expect(plan.goal).toBe('Build feature')
    expect(plan.status).toBe('active')
    expect(plan.metadata?.linearSync?.identifier).toBe('PROJ-42')
  })

  it('maps Linear estimate to complexity', () => {
    // Test estimate → complexity mapping
  })

  it('handles missing optional fields', () => {
    // Test with minimal Linear data
  })
})
```

### Integration Tests

```typescript
// LinearSync.integration.test.ts

describe('Linear Sync Integration', () => {
  it('syncs todo completion to Linear', async () => {
    // Create plan from Linear issue
    // Complete a todo
    // Verify Linear issue state updated
  })

  it('syncs Linear changes to plan', async () => {
    // Create plan from Linear issue
    // Change Linear issue state via API
    // Verify plan status updated
  })

  it('handles sync conflicts', async () => {
    // Change both sides simultaneously
    // Verify conflict resolution
  })
})
```

### Manual Testing Checklist

- [ ] Search Linear issues
- [ ] Import issue with sub-issues
- [ ] Create plan and verify todos
- [ ] Complete todo, verify Linear updated
- [ ] Change Linear state, verify plan updated
- [ ] Test with Linear API rate limits
- [ ] Test error recovery (network failure)
- [ ] Test with invalid API key
- [ ] Test sync disable/enable
- [ ] Test multiple concurrent syncs

---

## Configuration

### Environment Variables

```bash
# .env
LINEAR_API_KEY=lin_api_xxxxxxxxxxxx
LINEAR_SYNC_INTERVAL_MS=30000
LINEAR_RETRY_ATTEMPTS=3
LINEAR_CACHE_TTL_MS=60000
```

### User Settings

```typescript
// Settings UI
interface LinearSettings {
  apiKey: string
  defaultProject?: string
  syncInterval: number        // milliseconds
  syncDirection: 'one-way' | 'two-way'
  syncFields: string[]
  stateMapping: Record<string, string>
  autoSync: boolean
}
```

---

## Security Considerations

1. **API Key Storage:**
   - Store encrypted in system keychain (macOS Keychain, Windows Credential Manager)
   - Never log or expose API keys
   - Rotate keys periodically

2. **Rate Limiting:**
   - Respect Linear API rate limits (default: 1500 requests/hour)
   - Implement exponential backoff
   - Cache frequently accessed data

3. **Data Privacy:**
   - Only sync necessary fields
   - Allow users to opt-out of sync
   - Clear sync data on logout

4. **Error Handling:**
   - Never expose sensitive errors to UI
   - Log errors securely
   - Implement graceful degradation

---

## Performance Optimization

1. **Caching:**
   - Cache Linear issue data (60s TTL)
   - Cache workflow state mappings
   - Use ETag/If-None-Match for unchanged data

2. **Batch Operations:**
   - Batch multiple state updates
   - Debounce frequent sync triggers
   - Use GraphQL query batching

3. **Background Processing:**
   - Run sync in separate thread/worker
   - Use incremental updates
   - Implement smart polling (backoff when idle)

---

## Troubleshooting

### Common Issues

**Issue: Sync not working**
- Check API key validity
- Verify network connectivity
- Check Linear API status
- Review sync error log

**Issue: State mismatch**
- Review state mapping configuration
- Check for custom workflow states
- Verify sync direction setting

**Issue: Performance degradation**
- Check sync interval (increase if too frequent)
- Review cache TTL settings
- Monitor API rate limit usage

---

## References

- [Linear API Documentation](https://developers.linear.app/docs)
- [Linear GraphQL Schema](https://studio.apollographql.com/public/Linear-API/home)
- [Octave Plan Mode Architecture](./BRANCH_PLAN_UI_PROPOSAL.md)
- [Multi-Conversation Design](./MULTI_CONVERSATION_ORCHESTRATION.md)

---

## Changelog

### 2025-11-15
- Initial documentation
- Architecture decision: Octave-first approach
- Phase 1-4 implementation roadmap
- Core service specifications
