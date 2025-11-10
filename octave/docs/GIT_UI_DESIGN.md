# Context-Aware Git Action Panel Design

## Problem Statement

**Target User:** "Vibe Coders" - developers who may not fully understand Git's complexity and need intelligent guidance on what actions are safe and appropriate in their current state.

**Core Issue:** Traditional Git UIs present all actions (commit, push, pull, merge) equally without context, leaving users confused about:
- What they *can* do right now
- What they *should* do next
- Why certain actions might fail or be dangerous

---

## Design Philosophy

### Guiding Principles

1. **Use Git Terminology** - Don't hide Git vocabulary; help users learn it
2. **State-Driven UI** - Only show what's possible in the current state
3. **Explain Why Not** - When actions are disabled, clearly state the reason
4. **AI-Guided Decisions** - Recommend the best next action based on current state
5. **Progressive Disclosure** - Show simple choices, hide complexity until needed

---

## Git State Model

### State Variables

```typescript
interface GitWorkspaceState {
  // Working directory
  uncommitted: number;        // Number of uncommitted changes
  staged: number;             // Number of staged files
  unstaged: number;           // Number of unstaged files

  // Local vs Remote divergence
  ahead: number;              // Commits local has (↑)
  behind: number;             // Commits remote has (↓)

  // Branch information
  currentBranch: string;
  upstreamBranch: string | null;
  defaultBranch: string;      // Usually 'main' or 'master'

  // Special states
  isMerging: boolean;         // Merge in progress
  isRebasing: boolean;        // Rebase in progress
  hasConflicts: boolean;      // Unresolved conflicts exist

  // Capability flags
  canPush: boolean;           // Safe to push
  canPull: boolean;           // Safe to pull
  canMerge: boolean;          // Safe to merge
}
```

---

## Action State Matrix

This matrix defines which actions are available based on the current Git state:

| State | Commit | Push | Pull | Merge | Sync |
|-------|--------|------|------|-------|------|
| **Clean & synced** | ❌ No changes | ❌ Nothing to push | ✅ Safe | ✅ Safe | ❌ Already synced |
| **Uncommitted changes** | ✅ **Primary** | ❌ Commit first | ⚠️ Warning | ❌ Commit first | ❌ Commit first |
| **Staged files** | ✅ **Primary** | ❌ Commit first | ❌ Commit first | ❌ Commit first | ❌ Commit first |
| **Committed, not pushed** | ⚠️ Amend option | ✅ **Primary** | ✅ Safe | ⚠️ Caution | ✅ **Primary** |
| **Behind remote** | ✅ Safe | ⚠️ Will reject | ✅ **Primary** | ❌ Pull first | ✅ Pull first |
| **Ahead of remote** | ✅ Safe | ✅ **Primary** | ✅ Safe | ✅ Safe | ✅ **Primary** |
| **Diverged** | ✅ Safe | ❌ Pull first | ✅ **Primary** | ❌ Pull first | ✅ **Primary** |
| **Merge in progress** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ Continue | ❌ Blocked |
| **Has conflicts** | ❌ Blocked | ❌ Blocked | ❌ Blocked | ✅ **Resolve** | ❌ Blocked |

**Legend:**
- ✅ **Primary** = Recommended action
- ✅ Safe = Available and safe
- ⚠️ Warning = Available but needs caution
- ❌ Blocked = Not available; reason provided

---

## UI Design

### Panel Structure

```
┌─────────────────────────────────────────────────────────┐
│  Git Actions                                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  📊 Current State                                        │
│  • Branch: feature-ui                                    │
│  • 3 files changed (2 staged, 1 unstaged)                │
│  • 2 commits ahead of origin, 5 commits behind           │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  💡 AI Recommendation                               │ │
│  │  "Pull first to sync with remote, then push"       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Available Actions:                                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │                                                     │ │
│  │  [Commit]   [Pull]    [Push]    [Merge]           │ │
│  │     ✓         ✓        ⚠️         ❌               │ │
│  │  Primary   Primary   Warning   Disabled            │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Hover on ⚠️ Push:                                       │
│  "Remote has 5 new commits. Push will likely be          │
│   rejected. Pull first or use force-with-lease."        │
│                                                          │
│  Hover on ❌ Merge:                                      │
│  "Cannot merge with uncommitted changes.                 │
│   Commit or stash them first."                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Button States

Each button has 4 possible states:

1. **Primary (✅)** - Recommended action
   - Green accent
   - Bold text
   - Prominent placement

2. **Available (✓)** - Safe to use
   - Normal appearance
   - Standard hover effect

3. **Warning (⚠️)** - Available but risky
   - Yellow accent
   - Shows confirmation dialog
   - Explains risks

4. **Disabled (❌)** - Cannot be used
   - Grayed out
   - Tooltip explains why
   - May suggest alternative

---

## Button Logic

### Commit Button

```typescript
function getCommitButtonState(state: GitWorkspaceState): ButtonState {
  if (state.uncommitted === 0) {
    return {
      enabled: false,
      variant: 'disabled',
      label: 'Commit',
      tooltip: 'No changes to commit'
    };
  }

  if (state.staged > 0) {
    return {
      enabled: true,
      variant: 'primary',
      label: `Commit (${state.staged} files)`,
      tooltip: 'Commit staged files',
      onClick: () => showCommitDialog()
    };
  }

  // Unstaged only
  return {
    enabled: true,
    variant: 'secondary',
    label: 'Commit',
    tooltip: 'Stage and commit all changes',
    onClick: () => showCommitDialog({ stageAll: true })
  };
}
```

### Push Button

```typescript
function getPushButtonState(state: GitWorkspaceState): ButtonState {
  if (state.ahead === 0) {
    return {
      enabled: false,
      variant: 'disabled',
      label: 'Push',
      tooltip: 'Nothing to push'
    };
  }

  if (state.uncommitted > 0) {
    return {
      enabled: false,
      variant: 'disabled',
      label: 'Push',
      tooltip: 'Commit your changes first',
      onClick: () => showDialog({
        title: 'Uncommitted changes',
        message: 'You have uncommitted changes.',
        actions: [
          { label: 'Commit first', onClick: () => showCommitDialog() },
          { label: 'Stash and push', onClick: () => stashAndPush() },
          { label: 'Cancel' }
        ]
      })
    };
  }

  if (state.behind > 0) {
    return {
      enabled: true,
      variant: 'warning',
      label: 'Push',
      tooltip: `Remote has ${state.behind} new commits. Will likely be rejected.`,
      onClick: () => showDialog({
        title: 'Push Warning',
        message: `Remote has ${state.behind} commits you don't have.`,
        actions: [
          { label: 'Pull first (recommended)', primary: true },
          { label: 'Force push with lease', warning: true },
          { label: 'Cancel' }
        ]
      })
    };
  }

  // Clean push
  return {
    enabled: true,
    variant: 'primary',
    label: `Push (${state.ahead} commits)`,
    tooltip: 'Push to origin',
    onClick: () => push()
  };
}
```

### Pull Button

```typescript
function getPullButtonState(state: GitWorkspaceState): ButtonState {
  if (state.behind === 0) {
    return {
      enabled: true,
      variant: 'secondary',
      label: 'Pull',
      tooltip: 'Already up to date',
      onClick: () => pull() // Still allow refresh
    };
  }

  if (state.uncommitted > 0) {
    return {
      enabled: true,
      variant: 'warning',
      label: `Pull (${state.behind} commits)`,
      tooltip: 'Warning: Uncommitted changes may conflict',
      onClick: () => showDialog({
        title: 'Pull with uncommitted changes',
        message: `You have ${state.uncommitted} uncommitted changes.`,
        actions: [
          { label: 'Commit first (safe)', primary: true },
          { label: 'Stash and pull' },
          { label: 'Pull anyway (risky)' },
          { label: 'Cancel' }
        ]
      })
    };
  }

  // Clean pull
  return {
    enabled: true,
    variant: 'primary',
    label: `Pull (${state.behind} commits)`,
    tooltip: 'Pull from origin',
    onClick: () => pull()
  };
}
```

### Merge Button

```typescript
function getMergeButtonState(state: GitWorkspaceState): ButtonState {
  if (state.isMerging) {
    if (state.hasConflicts) {
      return {
        enabled: true,
        variant: 'danger',
        label: 'Resolve Conflicts',
        tooltip: 'Conflicts detected',
        onClick: () => showConflictResolver()
      };
    }

    return {
      enabled: true,
      variant: 'primary',
      label: 'Continue Merge',
      tooltip: 'Complete the merge',
      onClick: () => continueMerge()
    };
  }

  if (state.uncommitted > 0) {
    return {
      enabled: false,
      variant: 'disabled',
      label: 'Merge',
      tooltip: 'Cannot merge with uncommitted changes'
    };
  }

  return {
    enabled: true,
    variant: 'secondary',
    label: 'Merge',
    tooltip: 'Merge another branch',
    onClick: () => showMergeBranchSelector()
  };
}
```

---

## AI Recommendation System

### Fast Rule-Based Recommendations

```typescript
function getQuickRecommendation(state: GitWorkspaceState): string | null {
  // Priority order: most urgent first

  if (state.hasConflicts) {
    return "Resolve merge conflicts first";
  }

  if (state.isMerging) {
    return "Complete the merge in progress";
  }

  // Diverged state (most complex)
  if (state.ahead > 0 && state.behind > 0) {
    if (state.uncommitted > 0) {
      return "Commit first, then pull to sync";
    }
    return "Pull to sync with remote, then push";
  }

  // Behind remote
  if (state.behind > 0) {
    return `Pull ${state.behind} new commits from team`;
  }

  // Ahead of remote (ready to share)
  if (state.ahead > 0 && state.uncommitted === 0) {
    return `Push ${state.ahead} commits to share with team`;
  }

  // Uncommitted work
  if (state.uncommitted > 0) {
    return "Commit your changes";
  }

  // All synced
  if (state.ahead === 0 && state.behind === 0 && state.uncommitted === 0) {
    return "All synced! Ready to code";
  }

  return null;
}
```

### AI-Powered Recommendations (for complex cases)

Only call AI for truly complex scenarios to minimize cost:

```typescript
async function getAIRecommendation(state: GitWorkspaceState): Promise<string> {
  const prompt = `
    Git workspace state:
    - ${state.uncommitted} uncommitted changes
    - ${state.ahead} commits ahead of origin
    - ${state.behind} commits behind origin
    - Current branch: ${state.currentBranch}
    - Upstream: ${state.upstreamBranch || 'not set'}

    Provide ONE clear next action in 10 words or less.
  `;

  return await askAI(prompt);
}
```

---

## Implementation Architecture

### 1. State Management

```typescript
class GitStateManager {
  private state: GitWorkspaceState;
  private listeners: Set<(state: GitWorkspaceState) => void>;

  async refresh() {
    // Execute git commands to fetch state
    const [status, ahead, behind, branch] = await Promise.all([
      executeGitCommand(['status', '--porcelain']),
      executeGitCommand(['rev-list', '--count', '@{upstream}..HEAD']),
      executeGitCommand(['rev-list', '--count', 'HEAD..@{upstream}']),
      executeGitCommand(['branch', '--show-current'])
    ]);

    this.state = this.parseGitState(status, ahead, behind, branch);
    this.notifyListeners();
  }

  subscribe(listener: (state: GitWorkspaceState) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Auto-refresh on file changes
  onFileChange() {
    this.refresh();
  }
}
```

### 2. Button Factory

```typescript
function createActionButtons(state: GitWorkspaceState): ActionButton[] {
  return [
    getCommitButtonState(state),
    getPullButtonState(state),
    getPushButtonState(state),
    getMergeButtonState(state)
  ].filter(button => button.enabled || button.showWhenDisabled);
}
```

### 3. React Component

```typescript
export function GitActionPanel({ workspace }: { workspace: Workspace }) {
  const [state, setState] = useState<GitWorkspaceState | null>(null);
  const [recommendation, setRecommendation] = useState<string>('');

  useEffect(() => {
    const manager = new GitStateManager(workspace.path);
    const unsubscribe = manager.subscribe(setState);
    manager.refresh();

    return unsubscribe;
  }, [workspace.path]);

  useEffect(() => {
    if (state) {
      getQuickRecommendation(state).then(setRecommendation);
    }
  }, [state]);

  if (!state) return <LoadingSpinner />;

  const buttons = createActionButtons(state);

  return (
    <div className="git-action-panel">
      <GitStateDisplay state={state} />

      {recommendation && (
        <RecommendationBanner message={recommendation} />
      )}

      <div className="action-buttons">
        {buttons.map(button => (
          <ActionButton key={button.label} {...button} />
        ))}
      </div>
    </div>
  );
}
```

---

## User Scenarios

### Scenario 1: Morning Start - Pull Updates

**Initial State:**
- uncommitted: 0
- ahead: 0
- behind: 5

**UI:**
```
Current State:
• Branch: feature-ui
• 5 commits behind origin

💡 AI: "Pull 5 new commits from team"

[❌ Commit]  [✅ Pull (5)]  [❌ Push]  [✅ Merge]
```

**User clicks:** `[Pull]` → Success → State refreshes

---

### Scenario 2: After Coding - Commit and Share

**Initial State:**
- uncommitted: 3
- staged: 0
- ahead: 0
- behind: 0

**UI:**
```
Current State:
• Branch: feature-ui
• 3 files changed

💡 AI: "Commit your changes"

[✅ Commit (3)]  [❌ Push]  [✅ Pull]  [❌ Merge]
```

**User clicks:** `[Commit]`

**Dialog:**
```
┌─────────────────────────────────┐
│  Commit Changes                  │
│                                  │
│  Files (3):                      │
│  ☑ src/App.tsx                   │
│  ☑ src/Button.tsx                │
│  ☑ README.md                     │
│                                  │
│  Message:                        │
│  ┌───────────────────────────┐  │
│  │ feat: Add button component│  │
│  └───────────────────────────┘  │
│                                  │
│  [Commit]  [Commit & Push]       │
└─────────────────────────────────┘
```

**After commit:**
```
Current State:
• Branch: feature-ui
• 1 commit ahead of origin

💡 AI: "Push 1 commit to share with team"

[❌ Commit]  [✅ Push (1)]  [✅ Pull]  [✅ Merge]
```

---

### Scenario 3: Push Rejected - Diverged State

**Initial State:**
- uncommitted: 0
- ahead: 2
- behind: 5

**UI:**
```
Current State:
• Branch: feature-ui
• 2 commits ahead, 5 commits behind

💡 AI: "Pull to sync with remote, then push"

[❌ Commit]  [✅ Pull (5)]  [⚠️ Push]  [❌ Merge]
```

**User clicks:** `[Push]` (warning state)

**Dialog:**
```
┌─────────────────────────────────┐
│  ⚠️ Push Warning                 │
│                                  │
│  Remote has 5 commits you don't  │
│  have. Push will be rejected.    │
│                                  │
│  Your commits (2):               │
│  • feat: Add button (you)        │
│  • fix: Update styles (you)      │
│                                  │
│  Remote commits (5):             │
│  • refactor: Clean (Alice)       │
│  • docs: README (Bob)            │
│  • ... 3 more                    │
│                                  │
│  [Pull First]  [Force Push]      │
│   Recommended    Dangerous       │
└─────────────────────────────────┘
```

---

## Benefits

### For Vibe Coders

1. **Guided Learning** - Learn Git through contextual recommendations
2. **Reduced Errors** - Dangerous actions are prevented or warned
3. **Confidence** - Always know what to do next
4. **Transparency** - See *why* something can't be done

### For Power Users

1. **Efficiency** - Common workflows are 1-click
2. **Visibility** - State is always clear
3. **Flexibility** - Can still use terminal for complex operations
4. **Safety** - Warnings prevent accidental data loss

---

## Next Steps

1. **Implement GitStateManager** - Core state tracking
2. **Build Button Logic** - State-driven button factory
3. **Create UI Components** - React components with Shadcn
4. **Add AI Integration** - Recommendation system
5. **Test Scenarios** - Validate all state transitions
6. **Iterate Based on Feedback** - Refine UX based on real usage

---

## References

- Git State Machine: https://git-scm.com/book/en/v2/Git-Internals-Git-References
- VS Code Source Control UX: Best-in-class reference
- GitHub Desktop: Simplified Git UI patterns
