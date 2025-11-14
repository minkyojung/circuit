/**
 * usePlanProgress Hook (v2)
 *
 * Tracks and calculates progress for a SimpleBranchPlan.
 * Monitors todos in the single plan conversation and provides real-time statistics.
 *
 * Key Features:
 * - Real-time todo progress tracking
 * - Time estimates and actuals
 * - Efficiency metrics
 *
 * @example
 * const { progress, loading } = usePlanProgress(plan);
 */

import { useState, useEffect, useCallback } from 'react';
import type { SimpleBranchPlan, PlanProgress } from '@/types/plan';
import type { Todo } from '@/types/todo';

const ipcRenderer = window.electron?.ipcRenderer;

interface UsePlanProgressResult {
  progress: PlanProgress | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Calculate plan progress from todos
 * v2: Simplified for single-conversation structure
 */
function calculateProgress(
  plan: SimpleBranchPlan,
  todos: Todo[]
): PlanProgress {
  // Calculate todo statistics
  const totalTodos = todos.length;
  const completedTodos = todos.filter((t) => t.status === 'completed').length;
  const inProgressTodos = todos.filter((t) => t.status === 'in_progress').length;
  const pendingTodos = todos.filter((t) => t.status === 'pending').length;

  // Calculate percentage
  const percentComplete = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;

  // Calculate time estimates
  const estimatedTotalTime = plan.totalEstimatedDuration || 0;

  // Estimated time remaining based on incomplete todos
  const incompleteTodos = todos.filter(
    (t) => t.status !== 'completed' && t.status !== 'skipped'
  );
  const estimatedTimeRemaining = incompleteTodos.reduce(
    (sum, todo) => sum + (todo.estimatedDuration || 0),
    0
  );

  // Actual time spent on completed todos
  const actualTimeSpent = todos
    .filter((t) => t.status === 'completed' && t.actualDuration)
    .reduce((sum, todo) => sum + (todo.actualDuration || 0), 0);

  // Efficiency ratio (if we have actual time data)
  const completedTodosWithEstimate = todos.filter(
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
   * v2: Get todos from plan's single conversation
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

      // Get the conversation for this plan
      const conversationsResult = await ipcRenderer.invoke(
        'plan:get-conversations',
        plan.id
      );

      if (!conversationsResult.success) {
        throw new Error(conversationsResult.error || 'Failed to load conversation');
      }

      const conversations = conversationsResult.conversations || [];

      // v2: Should only have one conversation per plan
      if (conversations.length === 0) {
        // Plan not yet executed (no conversation created)
        setProgress({
          totalTodos: plan.totalTodos,
          completedTodos: 0,
          inProgressTodos: 0,
          pendingTodos: plan.totalTodos,
          percentComplete: 0,
          estimatedTotalTime: plan.totalEstimatedDuration,
          estimatedTimeRemaining: plan.totalEstimatedDuration,
          actualTimeSpent: 0,
        });
        return;
      }

      const conversationId = conversations[0].id;

      // Get all todos for the plan conversation
      const todosResult = await ipcRenderer.invoke(
        'conversation:get-todos',
        conversationId
      );

      if (!todosResult.success) {
        throw new Error(todosResult.error || 'Failed to load todos');
      }

      const todos: Todo[] = todosResult.todos || [];

      // Calculate progress
      const calculatedProgress = calculateProgress(plan, todos);
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
      ipcRenderer.removeListener('todo:updated', handleTodoUpdate);
      ipcRenderer.removeListener('todo:created', handleTodoUpdate);
      ipcRenderer.removeListener('todo:deleted', handleTodoUpdate);
      ipcRenderer.removeListener('conversation:updated', handleConversationUpdate);
      ipcRenderer.removeListener('conversation:created', handleConversationUpdate);
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
