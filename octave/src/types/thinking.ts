// Thinking step types for AI reasoning visualization

export interface ThinkingStep {
  type: 'thinking' | 'tool-use';
  message: string;
  timestamp: number;
  tool?: string;
  filePath?: string;
  command?: string;
  pattern?: string;
  // Edit tool args (for diff calculation)
  oldString?: string;
  newString?: string;
  // Write tool args (for diff calculation)
  content?: string;
}

export type StepGroupType = 'thinking' | 'tools' | 'final-thinking';

export interface StepGroup {
  type: StepGroupType;
  label: string;
  startTime: number;
  endTime: number;
  duration: number; // in seconds
  steps: ThinkingStep[];
}

export interface GroupedThinkingSteps {
  groups: StepGroup[];
  totalDuration: number;
}
