import type { GitWorkspaceState } from '../../electron/gitHandlers';

/**
 * Git Action Types
 */
export type GitActionType =
  | 'commit-push'
  | 'create-pr'
  | 'merge'
  | 'resolve-conflicts'
  | null;

/**
 * Git Action Metadata
 */
export interface GitAction {
  type: GitActionType;
  label: string;
  icon: string;
  variant: 'primary' | 'secondary' | 'destructive' | 'default';
  disabled: boolean;
  tooltip?: string;
}

/**
 * Determine the primary Git action based on current workspace state
 * Priority: Conflicts > Uncommitted > Ahead > Behind > None
 */
export function getPrimaryGitAction(state: GitWorkspaceState | null): GitAction {
  if (!state) {
    return {
      type: null,
      label: 'Loading...',
      icon: '⚙️',
      variant: 'default',
      disabled: true,
      tooltip: 'Loading Git state...'
    };
  }

  // Priority 1: Conflicts need immediate attention
  if (state.hasConflicts) {
    return {
      type: 'resolve-conflicts',
      label: 'Resolve Conflicts',
      icon: '⚠️',
      variant: 'destructive',
      disabled: false
    };
  }

  // Priority 2: Uncommitted changes should be committed
  if (state.canCommit) {
    return {
      type: 'commit-push',
      label: 'Commit & Push',
      icon: '📤',
      variant: 'primary',
      disabled: false
    };
  }

  // Priority 3: Ahead commits should be PR'd
  if (state.ahead > 0) {
    return {
      type: 'create-pr',
      label: 'Create PR',
      icon: '🔀',
      variant: 'secondary',
      disabled: false
    };
  }

  // Priority 4: Behind commits should be merged
  if (state.behind > 0) {
    return {
      type: 'merge',
      label: `Merge (${state.behind}↓)`,
      icon: '🔄',
      variant: 'secondary',
      disabled: false
    };
  }

  // No action needed - everything is up to date
  return {
    type: null,
    label: 'Up to date',
    icon: '✓',
    variant: 'default',
    disabled: false,
    tooltip: 'Up to date'
  };
}

/**
 * Get all available Git actions for dropdown menu
 */
export function getAllGitActions(state: GitWorkspaceState | null): GitAction[] {
  if (!state) return [];

  const actions: GitAction[] = [];

  // Commit & Push
  actions.push({
    type: 'commit-push',
    label: 'Commit & Push',
    icon: '📤',
    variant: 'primary',
    disabled: !state.canCommit || state.hasConflicts || state.isMerging || state.isRebasing,
    tooltip: !state.canCommit ? 'No uncommitted changes' : undefined
  });

  // Create PR
  actions.push({
    type: 'create-pr',
    label: 'Create PR',
    icon: '🔀',
    variant: 'secondary',
    disabled: state.ahead === 0,
    tooltip: state.ahead === 0 ? 'No commits to create PR' : undefined
  });

  // Merge from Main
  actions.push({
    type: 'merge',
    label: state.behind > 0 ? `Merge from Main (${state.behind}↓)` : 'Merge from Main',
    icon: '🔄',
    variant: 'secondary',
    disabled: state.behind === 0 && !state.hasConflicts,
    tooltip: state.behind === 0 && !state.hasConflicts ? 'Already up to date' : undefined
  });

  // Resolve Conflicts (if applicable)
  if (state.hasConflicts) {
    actions.unshift({
      type: 'resolve-conflicts',
      label: 'Resolve Conflicts',
      icon: '⚠️',
      variant: 'destructive',
      disabled: false
    });
  }

  return actions;
}

/**
 * Generate prompt for Git action
 */
export function getGitActionPrompt(
  action: GitActionType,
  workspacePath: string,
  branch: string,
  behind?: number
): string {
  switch (action) {
    case 'commit-push':
      return `Please commit and push the current changes in this workspace (${workspacePath}). ` +
             `Analyze the git diff and create an appropriate commit message.`;

    case 'create-pr':
      return `Please create a pull request for branch "${branch}". ` +
             `Analyze the commit history and generate appropriate PR title and description. ` +
             `Return the GitHub PR URL when done.`;

    case 'merge':
      return `Please merge the latest changes from main branch into my current branch (${branch}). ` +
             (behind ? `The branch is ${behind} commit(s) behind.` : '');

    case 'resolve-conflicts':
      return `There are merge conflicts in this workspace (${workspacePath}). ` +
             `Please analyze the conflicts and help me resolve them intelligently. ` +
             `Explain what caused the conflicts and suggest the best resolution strategy.`;

    default:
      return '';
  }
}
