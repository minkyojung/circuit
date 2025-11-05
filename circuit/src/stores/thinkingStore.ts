/**
 * Thinking Store - Zustand store for thinking steps and duration tracking
 *
 * Manages real-time thinking step updates and duration calculations
 */

import { create } from 'zustand';
import type { ThinkingStep } from '@/types/thinking';

interface ThinkingData {
  steps: ThinkingStep[];
  duration: number;
}

interface ThinkingStore {
  // Current thinking state (for in-progress messages)
  thinkingSteps: ThinkingStep[];
  currentDuration: number;
  thinkingStartTime: number;
  currentStepMessage: string;
  thinkingTimerId: NodeJS.Timeout | null;

  // Completed thinking data (indexed by message ID)
  messageThinkingSteps: Record<string, ThinkingData>;

  // Actions - Current thinking
  startThinking: () => void;
  addThinkingStep: (step: ThinkingStep) => void;
  updateCurrentStepMessage: (message: string) => void;
  completeThinking: (messageId: string, finalDuration: number) => void;
  clearThinking: () => void;

  // Actions - Message thinking data
  setMessageThinkingSteps: (messageId: string, data: ThinkingData) => void;
  clearMessageThinkingSteps: () => void;

  // Internal - Timer management
  startDurationTimer: () => void;
  stopDurationTimer: () => void;
}

export const useThinkingStore = create<ThinkingStore>((set, get) => ({
  // Initial state
  thinkingSteps: [],
  currentDuration: 0,
  thinkingStartTime: 0,
  currentStepMessage: 'Starting analysis',
  thinkingTimerId: null,
  messageThinkingSteps: {},

  // Start thinking
  startThinking: () => {
    const startTime = Date.now();
    set({
      thinkingSteps: [],
      currentDuration: 0,
      thinkingStartTime: startTime,
      currentStepMessage: 'Starting analysis'
    });

    // Start duration timer
    get().startDurationTimer();
  },

  // Add thinking step
  addThinkingStep: (step) => set((state) => ({
    thinkingSteps: [...state.thinkingSteps, step],
    currentStepMessage: step.message || step.type
  })),

  // Update current step message
  updateCurrentStepMessage: (message) => set({ currentStepMessage: message }),

  // Complete thinking and associate with message
  completeThinking: (messageId, finalDuration) => {
    const state = get();

    // Stop timer
    state.stopDurationTimer();

    // Save thinking data for this message
    set((state) => ({
      messageThinkingSteps: {
        ...state.messageThinkingSteps,
        [messageId]: {
          steps: state.thinkingSteps,
          duration: finalDuration
        }
      },
      // Clear current thinking state
      thinkingSteps: [],
      currentDuration: 0,
      thinkingStartTime: 0,
      currentStepMessage: ''
    }));
  },

  // Clear current thinking state
  clearThinking: () => {
    const state = get();
    state.stopDurationTimer();

    set({
      thinkingSteps: [],
      currentDuration: 0,
      thinkingStartTime: 0,
      currentStepMessage: '',
      thinkingTimerId: null
    });
  },

  // Set message thinking steps
  setMessageThinkingSteps: (messageId, data) => set((state) => ({
    messageThinkingSteps: {
      ...state.messageThinkingSteps,
      [messageId]: data
    }
  })),

  // Clear all message thinking steps
  clearMessageThinkingSteps: () => set({ messageThinkingSteps: {} }),

  // Start duration timer (updates every 100ms)
  startDurationTimer: () => {
    const state = get();

    // Clear existing timer if any
    if (state.thinkingTimerId) {
      clearInterval(state.thinkingTimerId);
    }

    const timerId = setInterval(() => {
      const state = get();
      if (state.thinkingStartTime > 0) {
        const duration = Date.now() - state.thinkingStartTime;
        set({ currentDuration: duration });
      }
    }, 100);

    set({ thinkingTimerId: timerId });
  },

  // Stop duration timer
  stopDurationTimer: () => {
    const state = get();
    if (state.thinkingTimerId) {
      clearInterval(state.thinkingTimerId);
      set({ thinkingTimerId: null });
    }
  },
}));
