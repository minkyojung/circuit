/**
 * Type definitions for SimpleBranchPlan (v1)
 * Multi-conversation orchestration system
 */

import type { TodoComplexity } from './todo'

/**
 * Plan status representing lifecycle states
 */
export type PlanStatus =
  | 'pending'      // Plan created, not yet executed
  | 'active'       // User is working on plan conversations
  | 'completed'    // All plan conversations/todos completed
  | 'cancelled'    // User cancelled the plan
  | 'archived'     // Plan archived for history

/**
 * Stage in the plan creation modal flow
 */
export type PlanCreationStage =
  | 'user-input'       // Stage 1: User enters goal
  | 'ai-analysis'      // Stage 2: AI analyzes and generates questions
  | 'ai-questions'     // Stage 3: AI asks clarifying questions
  | 'plan-preview'     // Stage 4: Preview and edit generated plan
  | 'executing'        // Executing plan (creating conversations)

/**
 * AI question types for clarification during plan creation
 */
export type AIQuestionType =
  | 'single-select'    // Radio buttons - choose one option
  | 'multi-select'     // Checkboxes - choose multiple options
  | 'text'             // Free text input
  | 'number'           // Numeric input
  | 'confirmation'     // Yes/No question

/**
 * AI question interface for Stage 3
 */
export interface AIQuestion {
  id: string
  type: AIQuestionType
  text: string                    // Question text
  options?: string[]              // Options for select types
  defaultValue?: string | string[] | number | boolean
  required?: boolean
  placeholder?: string            // For text/number inputs
  helpText?: string              // Additional guidance
}

/**
 * User's answers to AI questions
 */
export interface AIQuestionAnswers {
  [questionId: string]: string | string[] | number | boolean
}

/**
 * Conversation draft within a plan (before execution)
 */
export interface PlanConversationDraft {
  id: string                      // Temporary ID for editing
  title: string                   // E.g., "OAuth Database Schema"
  goal: string                    // Detailed description of conversation goal
  expectedOutputs?: string[]      // Expected deliverables (v1: hints only)
  todos: Array<{
    content: string               // Todo description
    activeForm?: string           // Present continuous form
    complexity?: TodoComplexity
    estimatedDuration?: number    // Seconds
  }>
  estimatedDuration: number       // Total seconds for this conversation
  order: number                   // Execution order within plan
}

/**
 * SimpleBranchPlan (v1) - Grouping metadata for AI-generated conversations
 *
 * Key characteristics:
 * - Workspace-scoped (one active plan per workspace)
 * - Conversations remain independent (no orchestration in v1)
 * - expectedOutputs are hints only (not verified)
 * - User executes conversations manually
 */
export interface SimpleBranchPlan {
  id: string
  workspaceId: string

  // Content
  goal: string                              // User's original goal
  description?: string                      // Detailed description

  // Conversations
  conversations: PlanConversationDraft[]    // Conversation drafts
  totalConversations: number

  // Todos aggregation
  totalTodos: number
  totalEstimatedDuration: number            // Total seconds across all conversations

  // Status & Progress
  status: PlanStatus

  // AI context
  aiAnalysis?: {
    reasoning?: string                      // AI's reasoning for plan structure
    questions?: AIQuestion[]                // Questions asked during creation
    answers?: AIQuestionAnswers            // User's answers
    confidence?: number                     // 0-1 confidence score
  }

  // Timestamps
  createdAt: number
  updatedAt: number
  startedAt?: number                        // When first conversation was created
  completedAt?: number                      // When all conversations completed
  cancelledAt?: number
  archivedAt?: number

  // Metadata
  metadata?: {
    tags?: string[]
    createdBy?: 'user' | 'ai'              // How plan was initiated
    source?: 'plan-mode' | 'chat'          // Where plan was created from
  }
}

/**
 * Progress calculation for a plan
 */
export interface PlanProgress {
  // Conversations
  totalConversations: number
  createdConversations: number              // Actually created in workspace
  completedConversations: number            // All todos in conversation completed

  // Todos
  totalTodos: number                        // Sum of all todos in plan
  completedTodos: number                    // Completed across all conversations
  inProgressTodos: number
  pendingTodos: number

  // Percentage
  percentComplete: number                   // 0-100

  // Time tracking
  estimatedTotalTime: number                // Original estimate (seconds)
  estimatedTimeRemaining: number            // Based on incomplete todos (seconds)
  actualTimeSpent: number                   // Actual time tracked (seconds)

  // Efficiency
  efficiencyRatio?: number                  // actualTime / estimatedTime (if available)
}

/**
 * Plan creation request (from UI to backend)
 */
export interface PlanCreationRequest {
  workspaceId: string
  goal: string
  answers?: AIQuestionAnswers               // Answers to AI questions
  customConversations?: PlanConversationDraft[]  // User-edited conversations
}

/**
 * Plan analysis result (AI's initial analysis)
 */
export interface PlanAnalysisResult {
  reasoning: string                         // AI's reasoning
  questions: AIQuestion[]                   // Clarifying questions
  suggestedConversations?: PlanConversationDraft[]  // Initial suggestions
  estimatedComplexity: TodoComplexity
  estimatedTotalTime: number
  confidence: number
}

/**
 * Plan generation result (final plan after questions answered)
 */
export interface PlanGenerationResult {
  plan: SimpleBranchPlan
  success: boolean
  error?: string
}

/**
 * Plan execution result (after creating conversations)
 */
export interface PlanExecutionResult {
  planId: string
  conversationIds: string[]                 // IDs of created conversations
  success: boolean
  error?: string
  failedConversations?: Array<{
    title: string
    error: string
  }>
}

/**
 * Plan update request
 */
export interface PlanUpdateRequest {
  planId: string
  updates: {
    status?: PlanStatus
    conversations?: PlanConversationDraft[]
    description?: string
    metadata?: SimpleBranchPlan['metadata']
  }
}

/**
 * Plan summary for display in lists
 */
export interface PlanSummary {
  id: string
  workspaceId: string
  goal: string
  status: PlanStatus
  progress: PlanProgress
  totalConversations: number
  totalTodos: number
  createdAt: number
  updatedAt: number
}

/**
 * Plan filter options
 */
export interface PlanFilter {
  workspaceId?: string
  status?: PlanStatus[]
  createdAfter?: number                     // Timestamp
  createdBefore?: number                    // Timestamp
}

/**
 * Plan sort options
 */
export type PlanSortBy = 'createdAt' | 'updatedAt' | 'progress' | 'totalTodos'
export type PlanSortOrder = 'asc' | 'desc'

export interface PlanSortOptions {
  by: PlanSortBy
  order: PlanSortOrder
}
