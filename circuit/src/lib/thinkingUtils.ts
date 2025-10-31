import type { ThinkingStep, StepGroup, GroupedThinkingSteps } from '@/types/thinking';

/**
 * Groups thinking steps into logical phases:
 * 1. Initial Thinking - First set of consecutive thinking steps
 * 2. Using Tools - Tool use steps (can be interleaved with thinking)
 * 3. Final Reasoning - Last set of consecutive thinking steps
 */
export function groupThinkingSteps(steps: ThinkingStep[], startTime: number): GroupedThinkingSteps {
  if (steps.length === 0) {
    return { groups: [], totalDuration: 0 };
  }

  const groups: StepGroup[] = [];
  let currentGroup: ThinkingStep[] = [];
  let currentType: 'thinking' | 'tool-use' | null = null;

  // Group consecutive steps of the same type
  for (const step of steps) {
    if (currentType === null || currentType === step.type) {
      currentType = step.type;
      currentGroup.push(step);
    } else {
      // Type changed, finalize current group
      if (currentGroup.length > 0) {
        groups.push(createStepGroup(currentGroup, startTime, groups.length));
        currentGroup = [step];
        currentType = step.type;
      }
    }
  }

  // Add final group
  if (currentGroup.length > 0) {
    groups.push(createStepGroup(currentGroup, startTime, groups.length));
  }

  // Label groups appropriately
  labelGroups(groups);

  const totalDuration = groups.length > 0
    ? Math.ceil((groups[groups.length - 1].endTime - groups[0].startTime) / 1000)
    : 0;

  return { groups, totalDuration };
}

function createStepGroup(steps: ThinkingStep[], _absoluteStartTime: number, _index: number): StepGroup {
  const startTime = steps[0].timestamp;
  const endTime = steps[steps.length - 1].timestamp;
  const duration = Math.ceil((endTime - startTime) / 1000);

  return {
    type: steps[0].type === 'thinking' ? 'thinking' : 'tools',
    label: steps[0].type === 'thinking' ? 'Thinking' : 'Using Tools',
    startTime,
    endTime,
    duration,
    steps,
  };
}

function labelGroups(groups: StepGroup[]): void {
  // Find first and last thinking groups
  const thinkingGroups = groups.filter(g => g.type === 'thinking');

  if (thinkingGroups.length === 0) {
    return; // No thinking groups
  }

  // Label first thinking group
  const firstThinking = thinkingGroups[0];
  firstThinking.type = 'thinking';
  firstThinking.label = 'Analyzing request';

  // Label last thinking group if different from first
  if (thinkingGroups.length > 1) {
    const lastThinking = thinkingGroups[thinkingGroups.length - 1];
    lastThinking.type = 'final-thinking';
    lastThinking.label = 'Synthesizing answer';
  }

  // Label tool groups
  groups.forEach(group => {
    if (group.type === 'tools') {
      group.label = 'Using tools';
    }
  });
}

/**
 * Formats duration in a human-readable way
 */
export function formatDuration(seconds: number): string {
  if (seconds < 1) {
    return '<1s';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Formats relative time from start
 */
export function formatRelativeTime(timestamp: number, startTime: number): string {
  const seconds = Math.floor((timestamp - startTime) / 1000);
  return `${seconds}s`;
}

/**
 * Summarizes tool usage from thinking steps
 */
export function summarizeToolUsage(steps: ThinkingStep[]): string {
  const toolCounts: Record<string, number> = {};

  steps.forEach(step => {
    if (step.type === 'tool-use' && step.tool) {
      toolCounts[step.tool] = (toolCounts[step.tool] || 0) + 1;
    }
  });

  const entries = Object.entries(toolCounts);
  if (entries.length === 0) {
    return 'Completed thinking';
  }

  // Format: "Read 3, Bash 2" or "Read 1" or "Used 5 tools"
  if (entries.length === 1) {
    const [tool, count] = entries[0];
    return count === 1 ? tool : `${tool} ${count}`;
  }

  if (entries.length <= 3) {
    return entries.map(([tool, count]) => count === 1 ? tool : `${tool} ${count}`).join(', ');
  }

  const totalTools = entries.reduce((sum, [, count]) => sum + count, 0);
  return `Used ${totalTools} tools`;
}
