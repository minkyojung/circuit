/**
 * TodoWrite Processor Service
 *
 * Handles TodoWrite extraction, conversion, and synchronization
 * Extracted from WorkspaceChatEditor.tsx handleResponseComplete
 */

import { FEATURES } from '@/config/features';
import {
  extractTodoWriteFromBlocks,
  extractPlanFromText,
  convertClaudeTodosToDrafts,
  calculateOverallComplexity,
  calculateTotalTime,
} from '@/lib/planModeUtils';
import type { Message } from '@/types/conversation';
import type { TodoGenerationResult } from '@/types/todo';

// @ts-ignore
const { ipcRenderer } = window.require('electron');

export interface TodoWriteProcessOptions {
  // Message data
  assistantMessage: Message;
  assistantMessageId: string;
  blocks: any[] | undefined;
  responseMessage: string;

  // Thinking mode
  currentThinkingMode: import('@/components/workspace/ChatInput').ThinkingMode;

  // Workspace
  workspacePath: string;

  // Callbacks
  onMessageUpdate: (id: string, updates: Partial<Message>) => void;
}

export interface TodoWriteProcessResult {
  hasTodoWrite: boolean;
  todoResult: TodoGenerationResult | null;
  displayMode: 'plan' | 'inline' | null;
}

export class TodoWriteProcessor {
  /**
   * Process TodoWrite data from Claude's response
   * Handles both Plan Mode (sidebar) and Normal Mode (inline) display
   */
  static async processTodoWrite(
    options: TodoWriteProcessOptions
  ): Promise<TodoWriteProcessResult> {
    const {
      assistantMessage,
      assistantMessageId,
      blocks,
      responseMessage,
      currentThinkingMode,
      workspacePath,
      onMessageUpdate,
    } = options;

    // Only execute if PLAN_MODE feature is enabled
    if (!FEATURES.PLAN_MODE) {
      return { hasTodoWrite: false, todoResult: null, displayMode: null };
    }

    console.log('[TodoWriteProcessor] 📋 Checking for TodoWrite');
    console.log('[TodoWriteProcessor] 📋 Current thinking mode:', currentThinkingMode);

    // Extract TodoWrite from blocks
    let todoWriteData = extractTodoWriteFromBlocks(blocks || []);
    console.log(
      '[TodoWriteProcessor] 📋 TodoWrite from blocks:',
      todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found'
    );

    // Fallback: Try parsing from message content
    if (!todoWriteData && responseMessage) {
      console.log('[TodoWriteProcessor] 📋 Trying to extract from message content');
      todoWriteData = extractPlanFromText(responseMessage);
      console.log(
        '[TodoWriteProcessor] 📋 TodoWrite from text:',
        todoWriteData ? `Found ${todoWriteData.todos.length} todos` : 'Not found'
      );
    }

    // No TodoWrite found
    if (!todoWriteData || todoWriteData.todos.length === 0) {
      return { hasTodoWrite: false, todoResult: null, displayMode: null };
    }

    // ========================================================================
    // TodoWrite found - Process it
    // ========================================================================

    // Convert Claude's todos to Circuit format
    const todoDrafts = convertClaudeTodosToDrafts(todoWriteData.todos);

    // Create TodoGenerationResult
    const todoResult: TodoGenerationResult = {
      todos: todoDrafts,
      complexity: calculateOverallComplexity(todoDrafts),
      estimatedTotalTime: calculateTotalTime(todoDrafts),
      confidence: 0.95,
      reasoning:
        currentThinkingMode === 'plan'
          ? 'Claude analyzed codebase and created detailed plan in Plan Mode'
          : 'Claude automatically created task breakdown while working',
    };

    // Determine where to display based on thinking mode
    const isPlanMode = currentThinkingMode === 'plan';

    // ========================================================================
    // Path 1: Plan Mode - Display in right sidebar (persistent)
    // ========================================================================

    if (isPlanMode) {
      console.log('[TodoWriteProcessor] 📋 Plan Mode: Adding to sidebar');

      // Update message with planResult
      onMessageUpdate(assistantMessageId, {
        metadata: {
          ...assistantMessage.metadata,
          planResult: todoResult,
          hasPendingPlan: true,
        },
      });

      const updatedMessage = {
        ...assistantMessage,
        metadata: {
          ...assistantMessage.metadata,
          planResult: todoResult,
          hasPendingPlan: true,
        },
      };

      console.log('[TodoWriteProcessor] 💾 Saving plan to sidebar');
      await ipcRenderer.invoke('message:save', updatedMessage);

      // Sync TodoWrite status updates to database
      await this.syncTodoStatus(workspacePath, todoWriteData);

      return { hasTodoWrite: true, todoResult, displayMode: 'plan' };
    }

    // ========================================================================
    // Path 2: Normal/Think Mode - Display inline in chat (temporary)
    // ========================================================================

    console.log('[TodoWriteProcessor] 📋 TodoWrite Mode: Adding inline to chat');

    // Update message with todoWriteResult
    onMessageUpdate(assistantMessageId, {
      metadata: {
        ...assistantMessage.metadata,
        todoWriteResult: todoResult,
      },
    });

    const updatedMessage = {
      ...assistantMessage,
      metadata: {
        ...assistantMessage.metadata,
        todoWriteResult: todoResult,
      },
    };

    console.log('[TodoWriteProcessor] 💾 Saving TodoWrite inline');
    await ipcRenderer.invoke('message:save', updatedMessage);

    return { hasTodoWrite: true, todoResult, displayMode: 'inline' };
  }

  /**
   * Sync TodoWrite status updates to database and .circuit/todos.json file
   * Called for both Plan Mode and TodoWrite status updates
   */
  private static async syncTodoStatus(
    workspacePath: string,
    todoWriteData: any
  ): Promise<void> {
    console.log('[TodoWriteProcessor] 🔄 Syncing TodoWrite status to database');

    try {
      // Read current todos.json file to compare status
      const todosFileResult = await ipcRenderer.invoke(
        'workspace:read-file',
        workspacePath,
        '.circuit/todos.json'
      );

      if (!todosFileResult.success || !todosFileResult.content) {
        console.log('[TodoWriteProcessor] ℹ️  No todos.json file found, skipping sync');
        return;
      }

      const todosData = JSON.parse(todosFileResult.content);

      // Update each todo in database based on TodoWrite data
      for (
        let i = 0;
        i < todoWriteData.todos.length && i < todosData.todos.length;
        i++
      ) {
        const claudeTodo = todoWriteData.todos[i];
        const dbTodo = todosData.todos[i];

        // Update status if different
        if (claudeTodo.status && claudeTodo.status !== dbTodo.status) {
          console.log(
            `[TodoWriteProcessor] 🔄 Updating todo ${dbTodo.id}: ${dbTodo.status} → ${claudeTodo.status}`
          );

          const updateData: any = {
            todoId: dbTodo.id,
            status: claudeTodo.status,
          };

          // Add timing data
          if (claudeTodo.status === 'completed') {
            updateData.completedAt = Date.now();
          } else if (claudeTodo.status === 'in_progress' && !dbTodo.startedAt) {
            updateData.startedAt = Date.now();
          }

          await ipcRenderer.invoke('todos:update-status', updateData);

          // Update local todos.json file
          todosData.todos[i].status = claudeTodo.status;
          if (claudeTodo.status === 'completed' && !todosData.todos[i].completedAt) {
            todosData.todos[i].completedAt = Date.now();
          } else if (
            claudeTodo.status === 'in_progress' &&
            !todosData.todos[i].startedAt
          ) {
            todosData.todos[i].startedAt = Date.now();
          }
        }
      }

      // Write updated todos back to file
      await ipcRenderer.invoke(
        'workspace:write-file',
        workspacePath,
        '.circuit/todos.json',
        JSON.stringify(todosData, null, 2)
      );

      console.log('[TodoWriteProcessor] ✅ Todo status sync complete');
    } catch (error) {
      console.error('[TodoWriteProcessor] ❌ Failed to sync todo status:', error);
    }
  }
}
