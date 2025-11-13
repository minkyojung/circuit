/**
 * useBranchPlan Hook
 *
 * Manages SimpleBranchPlan state and operations for a workspace.
 * Provides plan creation, updating, and lifecycle management.
 *
 * Key Features:
 * - Load active plan for workspace
 * - Create new plan via Plan Mode
 * - Update plan status and metadata
 * - Execute plan (create conversations)
 * - Real-time plan state synchronization
 *
 * @example
 * const {
 *   activePlan,
 *   loading,
 *   error,
 *   createPlan,
 *   updatePlan,
 *   executePlan,
 *   cancelPlan,
 *   archivePlan,
 *   refresh,
 * } = useBranchPlan(workspaceId);
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  SimpleBranchPlan,
  PlanCreationRequest,
  PlanAnalysisResult,
  PlanGenerationResult,
  PlanExecutionResult,
  PlanStatus,
  AIQuestionAnswers,
} from '@/types/plan';

const ipcRenderer = window.electron?.ipcRenderer;

interface UseBranchPlanResult {
  // State
  activePlan: SimpleBranchPlan | null;
  allPlans: SimpleBranchPlan[];
  loading: boolean;
  error: string | null;

  // Plan creation (multi-stage)
  analyzePlan: (goal: string) => Promise<PlanAnalysisResult>;
  generatePlan: (goal: string, answers: AIQuestionAnswers) => Promise<PlanGenerationResult>;
  executePlan: (planId: string) => Promise<PlanExecutionResult>;

  // Plan management
  updatePlan: (planId: string, updates: Partial<SimpleBranchPlan>) => Promise<void>;
  updatePlanStatus: (planId: string, status: PlanStatus) => Promise<void>;
  cancelPlan: (planId: string) => Promise<void>;
  archivePlan: (planId: string) => Promise<void>;
  deletePlan: (planId: string) => Promise<void>;

  // Utility
  refresh: () => Promise<void>;
}

/**
 * Hook for managing SimpleBranchPlan operations
 */
export function useBranchPlan(workspaceId: string | undefined): UseBranchPlanResult {
  const [activePlan, setActivePlan] = useState<SimpleBranchPlan | null>(null);
  const [allPlans, setAllPlans] = useState<SimpleBranchPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load active plan for workspace
   */
  const loadActivePlan = useCallback(async () => {
    if (!ipcRenderer || !workspaceId) {
      setActivePlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await ipcRenderer.invoke('plan:get-active', workspaceId);

      if (result.success) {
        setActivePlan(result.plan || null);
      } else {
        setError(result.error || 'Failed to load active plan');
      }
    } catch (err) {
      console.error('[useBranchPlan] Load error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  /**
   * Load all plans for workspace
   */
  const loadAllPlans = useCallback(async () => {
    if (!ipcRenderer || !workspaceId) {
      setAllPlans([]);
      return;
    }

    try {
      const result = await ipcRenderer.invoke('plan:get-all', workspaceId);

      if (result.success) {
        setAllPlans(result.plans || []);
      }
    } catch (err) {
      console.error('[useBranchPlan] Load all plans error:', err);
    }
  }, [workspaceId]);

  /**
   * Refresh plan data
   */
  const refresh = useCallback(async () => {
    await Promise.all([loadActivePlan(), loadAllPlans()]);
  }, [loadActivePlan, loadAllPlans]);

  /**
   * Stage 1-2: Analyze user's goal and generate questions
   */
  const analyzePlan = useCallback(
    async (goal: string): Promise<PlanAnalysisResult> => {
      if (!ipcRenderer || !workspaceId) {
        throw new Error('IPC renderer or workspace not available');
      }

      try {
        setError(null);
        const result = await ipcRenderer.invoke('plan:analyze', {
          workspaceId,
          goal,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to analyze plan');
        }

        return result.analysis;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [workspaceId]
  );

  /**
   * Stage 3-4: Generate full plan from user's answers
   */
  const generatePlan = useCallback(
    async (goal: string, answers: AIQuestionAnswers): Promise<PlanGenerationResult> => {
      if (!ipcRenderer || !workspaceId) {
        throw new Error('IPC renderer or workspace not available');
      }

      try {
        setError(null);
        const result = await ipcRenderer.invoke('plan:generate', {
          workspaceId,
          goal,
          answers,
        });

        if (!result.success) {
          throw new Error(result.error || 'Failed to generate plan');
        }

        // Update local state with new plan
        setActivePlan(result.plan);

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [workspaceId]
  );

  /**
   * Execute plan: Create all conversations with todos
   */
  const executePlan = useCallback(
    async (planId: string): Promise<PlanExecutionResult> => {
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }

      try {
        setError(null);
        const result = await ipcRenderer.invoke('plan:execute', planId);

        if (!result.success) {
          throw new Error(result.error || 'Failed to execute plan');
        }

        // Update plan status to 'active'
        await refresh();

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [refresh]
  );

  /**
   * Update plan fields
   */
  const updatePlan = useCallback(
    async (planId: string, updates: Partial<SimpleBranchPlan>): Promise<void> => {
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }

      try {
        setError(null);
        const result = await ipcRenderer.invoke('plan:update', planId, updates);

        if (!result.success) {
          throw new Error(result.error || 'Failed to update plan');
        }

        // Update local state
        if (activePlan?.id === planId) {
          setActivePlan((prev) => (prev ? { ...prev, ...updates } : null));
        }

        await loadAllPlans();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [activePlan, loadAllPlans]
  );

  /**
   * Update plan status
   */
  const updatePlanStatus = useCallback(
    async (planId: string, status: PlanStatus): Promise<void> => {
      await updatePlan(planId, { status });
    },
    [updatePlan]
  );

  /**
   * Cancel active plan
   */
  const cancelPlan = useCallback(
    async (planId: string): Promise<void> => {
      await updatePlan(planId, {
        status: 'cancelled',
        cancelledAt: Date.now(),
      });
    },
    [updatePlan]
  );

  /**
   * Archive plan
   */
  const archivePlan = useCallback(
    async (planId: string): Promise<void> => {
      await updatePlan(planId, {
        status: 'archived',
        archivedAt: Date.now(),
      });
    },
    [updatePlan]
  );

  /**
   * Delete plan (removes from database)
   */
  const deletePlan = useCallback(
    async (planId: string): Promise<void> => {
      if (!ipcRenderer) {
        throw new Error('IPC renderer not available');
      }

      try {
        setError(null);
        const result = await ipcRenderer.invoke('plan:delete', planId);

        if (!result.success) {
          throw new Error(result.error || 'Failed to delete plan');
        }

        // Update local state
        if (activePlan?.id === planId) {
          setActivePlan(null);
        }

        setAllPlans((prev) => prev.filter((p) => p.id !== planId));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        throw err;
      }
    },
    [activePlan]
  );

  /**
   * Load plans on mount and workspace change
   */
  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Listen for plan updates from other sources
   */
  useEffect(() => {
    if (!ipcRenderer || !workspaceId) return;

    const handlePlanUpdate = (_event: any, updatedPlan: SimpleBranchPlan) => {
      if (updatedPlan.workspaceId === workspaceId) {
        if (updatedPlan.status === 'active') {
          setActivePlan(updatedPlan);
        } else if (activePlan?.id === updatedPlan.id) {
          // Active plan was updated to non-active status
          setActivePlan(null);
        }

        // Update in all plans list
        setAllPlans((prev) =>
          prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p))
        );
      }
    };

    const handlePlanCreated = (_event: any, newPlan: SimpleBranchPlan) => {
      if (newPlan.workspaceId === workspaceId) {
        setAllPlans((prev) => [newPlan, ...prev]);
        if (newPlan.status === 'active') {
          setActivePlan(newPlan);
        }
      }
    };

    const handlePlanDeleted = (_event: any, planId: string) => {
      setAllPlans((prev) => prev.filter((p) => p.id !== planId));
      if (activePlan?.id === planId) {
        setActivePlan(null);
      }
    };

    ipcRenderer.on('plan:updated', handlePlanUpdate);
    ipcRenderer.on('plan:created', handlePlanCreated);
    ipcRenderer.on('plan:deleted', handlePlanDeleted);

    return () => {
      ipcRenderer.off('plan:updated', handlePlanUpdate);
      ipcRenderer.off('plan:created', handlePlanCreated);
      ipcRenderer.off('plan:deleted', handlePlanDeleted);
    };
  }, [workspaceId, activePlan]);

  return {
    activePlan,
    allPlans,
    loading,
    error,
    analyzePlan,
    generatePlan,
    executePlan,
    updatePlan,
    updatePlanStatus,
    cancelPlan,
    archivePlan,
    deletePlan,
    refresh,
  };
}
