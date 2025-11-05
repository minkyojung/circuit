/**
 * useIPCEvents Hook
 *
 * Manages IPC event handling for ChatPanel using IPCEventBridge service
 * Provides clean separation between IPC logic and component state
 */

import { useEffect, useRef, useMemo } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import {
  IPCEventBridge,
  type IPCEventCallbacks,
  type IPCEventDependencies,
} from '@/services/IPCEventBridge';

export interface UseIPCEventsParams {
  // Session and workspace
  sessionId: string | null;
  conversationId: string | null;
  workspacePath: string;
  workspaceId: string;

  // State values (for dependencies)
  pendingAssistantMessageId: string | null;
  thinkingSteps: import('@/types/thinking').ThinkingStep[];

  // Refs (passed from component)
  isMountedRef: React.MutableRefObject<boolean>;
  sessionIdRef: React.MutableRefObject<string | null>;
  conversationIdRef: React.MutableRefObject<string | null>;
  workspacePathRef: React.MutableRefObject<string>;
  pendingUserMessageRef: React.MutableRefObject<import('@/types/conversation').Message | null>;
  pendingAssistantMessageIdRef: React.MutableRefObject<string | null>;
  thinkingStartTimeRef: React.MutableRefObject<number>;
  currentStepMessageRef: React.MutableRefObject<string>;
  thinkingStepsRef: React.MutableRefObject<import('@/types/thinking').ThinkingStep[]>;
  thinkingTimerRef: React.MutableRefObject<NodeJS.Timeout | null>;
  currentThinkingModeRef: React.MutableRefObject<import('@/components/workspace/ChatInput').ThinkingMode>;
  messageThinkingStepsRef: React.MutableRefObject<
    Record<string, { steps: import('@/types/thinking').ThinkingStep[]; duration: number }>
  >;

  // Callbacks (state setters)
  callbacks: IPCEventCallbacks;
}

/**
 * Hook to manage IPC event listeners using IPCEventBridge service
 *
 * Usage:
 * ```typescript
 * useIPCEvents({
 *   sessionId,
 *   conversationId,
 *   workspacePath: workspace.path,
 *   workspaceId: workspace.id,
 *   pendingAssistantMessageId,
 *   thinkingSteps,
 *   isMountedRef,
 *   sessionIdRef,
 *   // ... other refs
 *   callbacks: {
 *     onMessageAdd: (msg) => setMessages(prev => [...prev, msg]),
 *     onMessageUpdate: (id, updates) => setMessages(prev =>
 *       prev.map(m => m.id === id ? {...m, ...updates} : m)
 *     ),
 *     // ... other callbacks
 *   }
 * });
 * ```
 */
export function useIPCEvents(params: UseIPCEventsParams): void {
  const {
    sessionId,
    conversationId,
    workspacePath,
    workspaceId,
    pendingAssistantMessageId,
    thinkingSteps,
    isMountedRef,
    sessionIdRef,
    conversationIdRef,
    workspacePathRef,
    pendingUserMessageRef,
    pendingAssistantMessageIdRef,
    thinkingStartTimeRef,
    currentStepMessageRef,
    thinkingStepsRef,
    thinkingTimerRef,
    currentThinkingModeRef,
    messageThinkingStepsRef,
    callbacks,
  } = params;

  // Create debounced milestone callback (300ms, same as original)
  const debouncedMilestoneCallback = useDebouncedCallback(
    callbacks.onThinkingStepAdd,
    300,
    { leading: true, trailing: true }
  );

  // Wrap callbacks with debounced milestone handler
  const wrappedCallbacks: IPCEventCallbacks = useMemo(
    () => ({
      ...callbacks,
      onThinkingStepAdd: debouncedMilestoneCallback,
    }),
    [callbacks, debouncedMilestoneCallback]
  );

  // Create dependencies object
  const dependencies: IPCEventDependencies = useMemo(
    () => ({
      sessionId,
      conversationId,
      workspacePath,
      workspaceId,
      isMountedRef,
      sessionIdRef,
      conversationIdRef,
      workspacePathRef,
      pendingUserMessageRef,
      pendingAssistantMessageIdRef,
      thinkingStartTimeRef,
      currentStepMessageRef,
      thinkingStepsRef,
      thinkingTimerRef,
      currentThinkingModeRef,
      messageThinkingStepsRef,
      pendingAssistantMessageId,
      thinkingSteps,
    }),
    [
      sessionId,
      conversationId,
      workspacePath,
      workspaceId,
      pendingAssistantMessageId,
      thinkingSteps,
      isMountedRef,
      sessionIdRef,
      conversationIdRef,
      workspacePathRef,
      pendingUserMessageRef,
      pendingAssistantMessageIdRef,
      thinkingStartTimeRef,
      currentStepMessageRef,
      thinkingStepsRef,
      thinkingTimerRef,
      currentThinkingModeRef,
      messageThinkingStepsRef,
    ]
  );

  // Store bridge instance in ref to persist across renders
  const bridgeRef = useRef<IPCEventBridge | null>(null);

  // Create bridge instance (only once)
  if (!bridgeRef.current) {
    bridgeRef.current = new IPCEventBridge(wrappedCallbacks, dependencies);
    console.log('[useIPCEvents] ✅ IPCEventBridge created');
  }

  // Update dependencies when they change
  useEffect(() => {
    if (bridgeRef.current) {
      bridgeRef.current.updateDependencies(dependencies);
    }
  }, [dependencies]);

  // Register/unregister listeners when sessionId changes
  useEffect(() => {
    if (!sessionId || !bridgeRef.current) {
      console.log('[useIPCEvents] Skipping listener registration (no sessionId or bridge)');
      return;
    }

    console.log('[useIPCEvents] Registering IPC listeners for session:', sessionId);
    bridgeRef.current.registerListeners();

    return () => {
      if (bridgeRef.current) {
        console.log('[useIPCEvents] Unregistering IPC listeners for session:', sessionId);
        bridgeRef.current.unregisterListeners();
      }
    };
  }, [sessionId]); // Re-register when sessionId changes
}
