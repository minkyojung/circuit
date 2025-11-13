/**
 * usePlanProgress Hook
 *
 * Tracks and calculates progress for a SimpleBranchPlan.
 * Monitors todos across all plan conversations and provides real-time statistics.
 *
 * Key Features:
 * - Real-time todo progress tracking
 * - Conversation completion status
 * - Time estimates and actuals
 * - Efficiency metrics
 *
 * @example
 * const { progress, loading } = usePlanProgress(plan);
 */

import { useState, useEffect, useCallback } from 'react';
import type { SimpleBranchPlan, PlanProgress } from '@/types/plan';
import type { Todo, Conversation } from '@/types/conversation';

const ipcRenderer = window.electron?.ipcRenderer;

interface UsePlanProgressResult {
  progress: PlanProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Calculate plan progress from conversations and todos
 */
function calculateProgress(
  plan: SimpleBranchPlan,
  conversations: Conversation[],
  todos: Todo[]
): PlanProgress {
  // Filter conversations that belong to this plan
  const planConversations = conversations.filter((c) => c.planId === plan.id);
  const planConversationIds = planConversations.map((c) => c.id);

  // Filter todos that belong to plan conversations
  const planTodos = todos.filter((t) => planConversationIds.includes(t.conversationId));

  // Calculate todo statistics
  const totalTodos = planTodos.length;
  const completedTodos = planTodos.filter((t) => t.status === 'completed').length;
  const inProgressTodos = planTodos.filter((t) => t.status === 'in_progress').length;
  const pendingTodos = planTodos.filter((t) => t.status === 'pending').length;

  // Calculate conversation completion
  // A conversation is "completed" if all its todos are completed
  const conversationStats = planConversationIds.map((convId) => {
    const convTodos = planTodos.filter((t) => t.conversationId === convId);
    const convCompletedTodos = convTodos.filter((t) => t.status === 'completed').length;
    return {
      conversationId: convId,
      totalTodos: convTodos.length,
      completedTodos: convCompletedTodos,
      isCompleted: convTodos.length > 0 && convCompletedTodos === convTodos.length,
    };
  });

  const completedConversations = conversationStats.filter((s) => s.isCompleted).length;

  // Calculate percentage
  const percentComplete = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

  // Calculate time estimates
  const estimatedTotalTime = plan.totalEstimatedDuration || 0;

  // Estimated time remaining based on incomplete todos
  const incompleteTodos = planTodos.filter(
    (t) => t.status !== 'completed' && t.status !== 'skipped'
  );
  const estimatedTimeRemaining = incompleteTodos.reduce(
    (sum, todo) => sum + (todo.estimatedDuration || 0),
    0
  );

  // Actual time spent on completed todos
  const actualTimeSpent = planTodos
    .filter((t) => t.status === 'completed' && t.actualDuration)
    .reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);

  // Efficiency ratio (if we have actual time data)
  const completedTodosWithEstimate = planTodos.filter(
    (t) => t.status === 'completed' && t.estimatedDuration && t.actualDuration
  );

  let efficiencyRatio: number | undefined;
  if (completedTodosWithEstimate.length > 0) {
    const totalEstimated = completedTodosWithEstimate.reduce(
      (sum, t) => sum + (t.estimatedDuration || 0),
      0
    );
    const totalActual = completedTodosWithEstimate.reduce(
      (sum, t) => sum + (t.actualDuration || 0),
      0
    );
    efficiencyRatio = totalEstimated > 0 ? totalActual / totalEstimated : undefined;
  }

  return {
    totalConversations: plan.conversations.length,
    createdConversations: planConversations.length,
    completedConversations,
    totalTodos,
    completedTodos,
    inProgressTodos,
    pendingTodos,
    percentComplete,
    estimatedTotalTime,
    estimatedTimeRemaining,
    actualTimeSpent,
    efficiencyRatio,
  };
}

/**
 * Hook for tracking plan progress
 */
export function usePlanProgress(
  plan: SimpleBranchPlan | null | undefined
): UsePlanProgressResult {
  const [progress, setProgress] = useState<PlanProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load and calculate progress
   */
  const calculateAndSetProgress = useCallback(async () => {
    if (!ipcRenderer || !plan) {
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all conversations for this plan
      const conversationsResult = await ipcRenderer.invoke(
        'plan:get-conversations',
        plan.id
      );

      if (!conversationsResult.success) {
        throw new Error(conversationsResult.error || 'Failed to load conversations');
      }

      const conversations: Conversation[] = conversationsResult.conversations || [];

      // Get all todos for plan conversations
      const conversationIds = conversations.map((c) => c.id);
      const todosResult = await ipcRenderer.invoke(
        'plan:get-todos',
        conversationIds
      );

      if (!todosResult.success) {
        throw new Error(todosResult.error || 'Failed to load todos');
      }

      const todos: Todo[] = todosResult.todos || [];

      // Calculate progress
      const calculatedProgress = calculateProgress(plan, conversations, todos);
      setProgress(calculatedProgress);
    } catch (err) {
      console.error('[usePlanProgress] Calculate error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [plan]);

  /**
   * Refresh progress
   */
  const refresh = useCallback(async () => {
    await calculateAndSetProgress();
  }, [calculateAndSetProgress]);

  /**
   * Calculate progress on mount and when plan changes
   */
  useEffect(() => {
    calculateAndSetProgress();
  }, [calculateAndSetProgress]);

  /**
   * Listen for todo and conversation updates
   */
  useEffect(() => {
    if (!ipcRenderer || !plan) return;

    const handleTodoUpdate = () => {
      // Recalculate progress when any todo changes
      calculateAndSetProgress();
    };

    const handleConversationUpdate = () => {
      // Recalculate progress when conversations change
      calculateAndSetProgress();
    };

    // Listen for updates
    ipcRenderer.on('todo:updated', handleTodoUpdate);
    ipcRenderer.on('todo:created', handleTodoUpdate);
    ipcRenderer.on('todo:deleted', handleTodoUpdate);
    ipcRenderer.on('conversation:updated', handleConversationUpdate);
    ipcRenderer.on('conversation:created', handleConversationUpdate);

    return () => {
      ipcRenderer.off('todo:updated', handleTodoUpdate);
      ipcRenderer.off('todo:created', handleTodoUpdate);
      ipcRenderer.off('todo:deleted', handleTodoUpdate);
      ipcRenderer.off('conversation:updated', handleConversationUpdate);
      ipcRenderer.off('conversation:created', handleConversationUpdate);
    };
  }, [plan, calculateAndSetProgress]);

  /**
   * Auto-refresh every 30 seconds for time-sensitive metrics
   */
  useEffect(() => {
    if (!plan) return;

    const interval = setInterval(() => {
      calculateAndSetProgress();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [plan, calculateAndSetProgress]);

  return {
    progress,
    loading,
    error,
    refresh,
  };
}
