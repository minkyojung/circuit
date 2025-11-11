/**
 * useSmartCommit Hook
 *
 * Manages state and IPC communication for Smart Commit feature
 */

import { useState, useCallback, useEffect } from 'react';
import type { CommitGroup, ExecutionProgress } from '@/types/smartCommit';

type Status = 'idle' | 'analyzing' | 'executing' | 'complete' | 'error';

interface Progress {
  current: number;
  total: number;
  currentCommit?: {
    title: string;
    files: string[];
  };
}

export function useSmartCommit(workspacePath: string) {
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<CommitGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitCount, setCommitCount] = useState(0);
  const [completedShas, setCompletedShas] = useState<string[]>([]);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReason, setReviewReason] = useState<string | null>(null);
  const [reviewPlan, setReviewPlan] = useState<any>(null);

  // Store completion promise resolver
  const [completionResolver, setCompletionResolver] = useState<((value: void) => void) | null>(null);

  // Setup progress listener
  useEffect(() => {
    const removeProgress = window.electron.ipcRenderer.on(
      'smart-commit:progress',
      (_event: any, data: ExecutionProgress) => {
        console.log('[SmartCommit] 📡 Progress event received:', data);
        console.log('[SmartCommit] 📊 Data stage:', data?.stage, 'Type:', typeof data);

        if (!data || typeof data !== 'object') {
          console.error('[SmartCommit] ❌ Invalid progress data:', data);
          return;
        }

        setStatus(data.stage);

        if (data.stage === 'executing' && data.currentGroup && data.totalGroups) {
          console.log('[SmartCommit] 🔄 Executing:', data.currentGroup, '/', data.totalGroups);
          setProgress({
            current: data.currentGroup,
            total: data.totalGroups,
            currentCommit: data.currentCommit
          });
        }

        if (data.stage === 'complete') {
          console.log('[SmartCommit] 🎉 Complete! Commits:', data.completedShas?.length);
          setCommitCount(data.completedShas?.length || 0);
          setCompletedShas(data.completedShas || []);
          // Resolve the completion promise if it exists
          if (completionResolver) {
            console.log('[SmartCommit] ✅ Resolving completion promise');
            completionResolver();
            setCompletionResolver(null);
          }
        }

        if (data.stage === 'error') {
          console.error('[SmartCommit] ❌ Progress error:', data.error);
          setError(data.error || 'Unknown error');
          // Reject completion if waiting
          if (completionResolver) {
            setCompletionResolver(null);
          }
        }
      }
    );

    return () => {
      removeProgress();
    };
  }, [completionResolver]);

  // Execute smart commit
  const execute = useCallback(async (force: boolean = false): Promise<boolean> => {
    console.log('[SmartCommit] Execute called with workspacePath:', workspacePath, 'force:', force);

    if (!workspacePath) {
      console.error('[SmartCommit] No workspace path provided');
      setError('No workspace path provided');
      return false;
    }

    console.log('[SmartCommit] Setting status to analyzing...');
    setStatus('analyzing');
    setError(null);
    setResult(null);
    setProgress(null);
    setCompletedShas([]);
    setNeedsReview(false);
    setReviewReason(null);
    setReviewPlan(null);

    try {
      const options = force ? { mode: 'auto', force: true } : { mode: 'auto' };
      console.log('[SmartCommit] Invoking IPC: git:smart-commit-auto');
      console.log('[SmartCommit] Parameters:', { workspacePath, options });

      // Add timeout to prevent infinite waiting
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('IPC call timed out after 120s')), 120000);
      });

      const responsePromise = window.electron.ipcRenderer.invoke(
        'git:smart-commit-auto',
        { workspacePath, options }
      );

      const response = await Promise.race([responsePromise, timeoutPromise]) as any;
      console.log('[SmartCommit] ✅ IPC response received:', response);

      if (!response) {
        console.error('[SmartCommit] ❌ Response is null/undefined');
        setError('백엔드에서 응답이 없습니다');
        setStatus('error');
        return false;
      }

      if (response.requiresReview) {
        console.log('[SmartCommit] ⚠️ Review required:', response.reason);
        setStatus('idle');
        setNeedsReview(true);
        setReviewReason(response.reason);
        setReviewPlan(response.plan);
        return false;
      } else if (response.success) {
        console.log('[SmartCommit] ✅ Success with', response.plan?.groups?.length, 'commits');
        setResult(response.plan.groups);

        // Create a promise that waits for 'complete' status
        console.log('[SmartCommit] ⏳ Waiting for completion event...');
        const completionPromise = new Promise<void>((resolve) => {
          setCompletionResolver(() => resolve);
        });

        // Wait for the progress listener to receive 'complete' event
        await completionPromise;
        console.log('[SmartCommit] ✅ Completion event received!');
        return true;
      } else {
        console.error('[SmartCommit] ❌ Error response:', response.error);
        setError(response.error || '알 수 없는 오류');
        setStatus('error');
        return false;
      }
    } catch (err: any) {
      console.error('[SmartCommit] ❌ Exception caught:', err);
      setError(err.message || '알 수 없는 오류');
      setStatus('error');
      return false;
    }
  }, [workspacePath]);

  // Undo commits
  const undo = useCallback(async () => {
    if (commitCount === 0) {
      setError('되돌릴 커밋이 없습니다');
      return;
    }

    try {
      const response = await window.electron.ipcRenderer.invoke(
        'git:smart-commit-undo',
        { workspacePath, commitCount }
      );

      if (response.success) {
        setStatus('idle');
        setResult(null);
        setCommitCount(0);
        setCompletedShas([]);
        setError(null);
        setProgress(null);
      } else {
        setError(response.error || '되돌리기 실패');
      }
    } catch (err: any) {
      setError(err.message || '되돌리기 실패');
    }
  }, [workspacePath, commitCount]);

  return {
    status,
    progress,
    result,
    error,
    completedShas,
    needsReview,
    reviewReason,
    reviewPlan,
    execute,
    undo
  };
}
