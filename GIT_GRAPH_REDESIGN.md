# Git Graph Redesign: Team Awareness-Focused Approach

## 📋 Executive Summary

**Current Problem**: Attempting to replicate GitKraken's complex lane algorithm without understanding the actual user need.

**User Insight**: Git Graph is not about perfect topology visualization—it's about **team coordination** and **conflict avoidance** during pull operations.

**Solution**: Redesign Git Graph as a "Team Awareness Dashboard" with AI-powered work scope analysis.

---

## 🎯 Core User Need

### Real Workflow (Discovered through conversation)

```
User opens GitKraken before Pull to answer:
1. "Who is working on what?"
2. "Will this Pull conflict with my work?"
3. "Should I wait or proceed?"
4. "Who should go first (global vs local changes)?"
```

### Current Conductor Problem

```
❌ No remote branch visibility
❌ No conflict prediction
❌ No team activity awareness
❌ No scope analysis (global vs local)
→ Forces user to open GitKraken separately
```

---

## 💡 Design Philosophy

### Traditional Git Graph (GitKraken, Sourcetree)
- **Focus**: Perfect branch topology visualization
- **User**: Developer who needs to understand git structure
- **Action**: Manual analysis → Manual decision

### Conductor Git Graph (Proposed)
- **Focus**: Team coordination & conflict avoidance
- **User**: Developer collaborating with AI and humans
- **Action**: AI analysis → Recommended decision

---

## 🏗️ Architecture Overview

### 1. Remote/Local Separation

```
┌─────────────────────────────────────┐
│ 🌐 Remote Branches                  │  ← Priority view
│    (What team is doing)             │
├─────────────────────────────────────┤
│ 💻 Local Branches                   │
│    (What I'm doing)                 │
└─────────────────────────────────────┘
```

**Rationale**:
- Remote = external context (others' work)
- Local = internal context (my work)
- Separation makes coordination clearer

### 2. AI-Powered Intelligence Layers

#### Layer 1: File Conflict Detection (Basic)
```typescript
interface FileConflict {
  file: string;
  localAuthor: string;
  remoteAuthor: string;
  conflictType: 'same-file' | 'same-line' | 'safe';
}
```

#### Layer 2: Scope Analysis (Critical!) ⭐
```typescript
interface ChangeScope {
  type: 'global' | 'modular' | 'local';
  affectedFiles: string[];
  affectedModules: string[];
  architectureChange: boolean;
  riskLevel: 'high' | 'medium' | 'low';
}

// AI analyzes commit diffs to determine:
// - Is this a refactoring? (global)
// - Is this a new feature? (modular)
// - Is this a bug fix? (local)
```

#### Layer 3: Priority Recommendation
```typescript
interface PullRecommendation {
  action: 'proceed' | 'wait' | 'coordinate';
  reason: string;
  priority: number;  // Who should go first
  suggestedMessage?: string;  // Draft message to teammate
}

// Logic:
// - Global changes > Modular changes > Local changes
// - Team member doing global refactor should go first
// - Others should wait to avoid rework
```

---

## 📐 UI Specification

### Remote Branch Card

```
┌─────────────────────────────────────────────────┐
│ 🔴 origin/feature/payment                       │
│ 👤 민수 • 3시간 전 • 3 commits ahead             │
├─────────────────────────────────────────────────┤
│ 📝 Latest: "Add payment gateway integration"   │
│                                                 │
│ 📂 Files changed: (2)                           │
│   • src/payment/gateway.ts (+150, -20)          │
│   • src/payment/types.ts (+45, -0)              │
│                                                 │
│ 🔍 Scope Analysis:                              │
│   Type: Modular (payment module only)          │
│   Risk: Low                                     │
│                                                 │
│ 💡 Impact on you:                               │
│   ✅ No file conflicts                          │
│   ✅ Safe to pull                               │
│                                                 │
│ [📄 View Changes] [💬 Message 민수] [⬇️ Pull]   │
└─────────────────────────────────────────────────┘
```

### Local Branch Card (with Remote comparison)

```
┌─────────────────────────────────────────────────┐
│ 🔵 feature/auth-refactor                        │
│ 👤 You • Working • Not pushed                   │
├─────────────────────────────────────────────────┤
│ 📝 Latest: "Refactor authentication system"    │
│                                                 │
│ 📂 Files changed: (15)                          │
│   • src/auth/*.ts (전체 모듈)                   │
│   • src/utils/validation.ts                     │
│   • src/types/user.ts                           │
│   • ... 12 more                                 │
│                                                 │
│ 🔍 Scope Analysis:                              │
│   Type: Global (auth system overhaul)          │
│   Risk: High (affects multiple modules)        │
│                                                 │
│ ⚠️  Affected teammates:                         │
│   • 수진 (analytics) - utils.ts conflict        │
│                                                 │
│ 🤖 Claude Recommendation:                       │
│   "Global refactoring should proceed first.    │
│    Suggest coordinating with 수진."            │
│                                                 │
│ 💬 Draft message to team:                       │
│   "Auth system refactoring in progress.        │
│    Completion ETA: Today 5PM.                   │
│    Please hold related changes. Thanks!"       │
│                                                 │
│ [🚀 Push & Notify Team] [📝 Continue Work]     │
└─────────────────────────────────────────────────┘
```

### Conflict Warning (when detected)

```
┌─────────────────────────────────────────────────┐
│ ⚠️  Pull Conflicts Detected                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔴 High Priority Coordination Needed:           │
│                                                 │
│ You vs 수진 (origin/feature/analytics):         │
│   • utils.ts (both modified)                    │
│   • types.ts (both modified)                    │
│                                                 │
│ Work Scope Comparison:                          │
│   You:  Global (auth refactor)                 │
│   수진:  Modular (analytics feature)            │
│                                                 │
│ 🤖 Claude Analysis:                             │
│   "Your global refactor should go first.       │
│    수진's analytics can build on new auth.     │
│    Recommend: Push your changes, ask 수진      │
│    to rebase after your PR merges."            │
│                                                 │
│ 📋 Suggested Actions:                           │
│   1. [Complete your auth refactor]             │
│   2. [Send coordination message to 수진]       │
│   3. [Create PR for review]                     │
│   4. [After merge, notify 수진 to proceed]     │
│                                                 │
│ 💬 Message 수진:                                 │
│   "Hi! I'm doing global auth refactor that     │
│    touches utils.ts and types.ts.              │
│    Mind holding your analytics work until      │
│    my PR merges (ETA: today 5PM)?              │
│    Will notify you when ready. Thanks! 🙏"     │
│                                                 │
│ [📤 Send & Continue] [🤝 Discuss First]         │
└─────────────────────────────────────────────────┘
```

---

## 🔄 User Flow

### Scenario 1: Safe Pull

```
User opens Git Graph
  ↓
Sees remote branches with no conflicts
  ↓
Claude shows: "✅ Safe to pull all changes"
  ↓
[Pull All] button (one click)
  ↓
Success notification
```

### Scenario 2: Conflict Detected

```
User opens Git Graph
  ↓
Sees conflict warning card
  ↓
Claude analyzes scope (global vs modular)
  ↓
Claude recommends priority
  ↓
User reviews suggested message
  ↓
[Send & Coordinate] → Slack/Discord message sent
  ↓
Wait for teammate response
```

### Scenario 3: Proactive Coordination

```
User starts global refactoring
  ↓
Claude detects high-impact scope
  ↓
Auto-generates team notification
  ↓
User reviews and sends
  ↓
Team awareness → avoids conflicts
```

---

## 🚀 Implementation Plan

### Phase 1: Remote/Local Separation (Day 1)

**Goal**: Split UI into two sections

**Tasks**:
1. Fetch remote branches separately
2. Create Remote Branch Card component
3. Create Local Branch Card component
4. Layout with clear separation

**Files to modify**:
- `GitGraphV3.tsx` → Split into `RemoteBranches.tsx` + `LocalBranches.tsx`
- `gitHandlers.ts` → Add `git:remote-branches` IPC handler

**Estimated time**: 2-3 hours

### Phase 2: File Conflict Detection (Day 2)

**Goal**: Show which files conflict

**Tasks**:
1. Compare local changes with remote
2. Highlight conflicting files
3. Show safe/unsafe indicators

**Algorithm**:
```typescript
function detectConflicts(
  localBranch: Branch,
  remoteBranch: Branch
): Conflict[] {
  const localFiles = getModifiedFiles(localBranch);
  const remoteFiles = getModifiedFiles(remoteBranch);

  return localFiles
    .filter(f => remoteFiles.includes(f))
    .map(file => ({
      file,
      type: 'same-file',  // Can enhance later with line-level
      risk: 'medium'
    }));
}
```

**Estimated time**: 3-4 hours

### Phase 3: AI Scope Analysis (Day 3-4) ⭐

**Goal**: Determine global vs modular vs local changes

**Tasks**:
1. Integrate Claude API for diff analysis
2. Classify change scope
3. Recommend priority
4. Generate coordination messages

**Prompt Template**:
```typescript
const prompt = `
Analyze this git diff and determine:

1. Change Scope:
   - Global: Architecture/framework changes affecting multiple modules
   - Modular: New feature or changes within one module
   - Local: Bug fixes or small tweaks

2. Risk Level:
   - High: Breaking changes, API changes, core logic
   - Medium: New features, refactoring
   - Low: Bug fixes, UI tweaks

3. Coordination Need:
   - If global, should go first (others depend on it)
   - If modular, can proceed in parallel
   - If local, can wait

Diff:
${diff}

Respond in JSON format:
{
  "scope": "global" | "modular" | "local",
  "risk": "high" | "medium" | "low",
  "reasoning": "explanation",
  "recommendation": "proceed" | "wait" | "coordinate"
}
`;
```

**Estimated time**: 6-8 hours (including testing)

### Phase 4: Team Coordination (Day 5)

**Goal**: Auto-generate messages and integrate with Slack

**Tasks**:
1. Message template system
2. Slack/Discord integration (optional)
3. ETA tracking
4. Notification system

**Estimated time**: 4-6 hours

---

## 📊 Success Metrics

### User Efficiency
- **Before**: Open GitKraken → Analyze → Think → Decide → Close → Action
- **After**: Open Conductor → See AI recommendation → One-click action

### Conflict Reduction
- **Goal**: 50% reduction in merge conflicts
- **Method**: Proactive coordination before conflicts occur

### Team Coordination
- **Goal**: Auto-generated coordination messages
- **Method**: AI drafts messages based on scope analysis

---

## 🎨 Design Principles

### 1. Remote First
- Remote branches at top (external context)
- Local branches below (internal context)

### 2. AI-Assisted Decision
- Don't just show data, recommend action
- Explain reasoning clearly

### 3. One-Click Actions
- "Safe Pull" button (no conflicts)
- "Send & Coordinate" button (with conflicts)

### 4. Proactive Awareness
- Notify before conflicts happen
- Suggest ETA and coordination

---

## 🔮 Future Enhancements

### 1. Predictive Conflict Detection
```
Claude predicts: "Based on your branch name 'auth-refactor'
and recent main changes, you'll likely conflict with
PR #123 (login redesign). Consider coordinating now."
```

### 2. Auto-Rebase Suggestions
```
"민수's payment PR just merged.
Your branch can safely rebase.
[Auto-rebase & test] button"
```

### 3. Team Timeline View
```
Visual timeline of who's working on what:

9am  |----민수 (payment)----|
10am      |----You (auth)------------|
11am           |--수진 (analytics)--|

Overlap detected at 10-11am → Suggest coordination
```

### 4. Integration with PR System
```
When creating PR:
- Auto-tag reviewers based on affected files
- Include scope analysis in PR description
- Suggest merge order for dependent PRs
```

---

## 🚫 What We're NOT Doing

### ❌ Perfect Git Topology
- No complex lane algorithms
- No GitKraken-style graph recreation
- Focus on information, not aesthetics

### ❌ Every Git Feature
- Not a full Git client replacement
- Focus on pull workflow and coordination
- GitKraken still useful for complex operations

### ❌ Manual Analysis
- User shouldn't need to think
- AI does the analysis
- User just approves/rejects

---

## 📝 Technical Decisions

### Why Abandon Row-by-Row Algorithm?

**Attempt**: Recreate GitKraken's "Straight Branches" algorithm
**Result**: Complex code (300+ lines), still doesn't match GitKraken
**Learning**: We were solving the wrong problem

**The real problem**: Not "how to draw perfect graph" but "how to avoid conflicts"

### Why Remote/Local Separation?

**User Insight**: "I pull to see what others are doing, not to admire git topology"
**Solution**: Show external context (remote) separately from internal context (local)

### Why AI Scope Analysis?

**User Insight**: "Global refactoring should go first, local bug fixes can wait"
**Solution**: AI determines scope and recommends priority automatically

---

## 🎯 Core Value Proposition

### For Individual Developer
- **Save time**: No manual conflict analysis
- **Reduce stress**: AI recommends safe actions
- **Avoid rework**: Coordinate before conflicts

### For Team
- **Better coordination**: Proactive communication
- **Fewer conflicts**: Scope-based prioritization
- **Faster shipping**: Less time resolving conflicts

### vs GitKraken
- **GitKraken**: Shows you the graph, you analyze
- **Conductor**: AI analyzes, recommends action
- **Result**: Faster decisions, better collaboration

---

## 📚 References

### User Research
- Original request: "Make it like GitKraken"
- Actual need: "Help me pull safely and avoid conflicts"
- Key insight: "Global changes should go first"

### Technical Research
- Attempted: pvigier's commit graph algorithm
- Learned: Algorithm complexity ≠ user value
- Pivoted: Focus on team awareness, not topology

### Design Inspiration
- Linear (issue tracker): Keyboard-first, AI-assisted
- Height (email): AI triage, auto-categorization
- Notion (docs): Simple UI, powerful underneath

---

## ✅ Next Steps

1. **Get approval** on this design direction
2. **Phase 1**: Implement Remote/Local separation (2-3 hours)
3. **Test** with real repository (git-graph-test)
4. **Iterate** based on actual usage
5. **Phase 2-4**: Add intelligence layers progressively

---

**Document Version**: 1.0
**Date**: 2025-01-04
**Author**: Claude (with user insights)
**Status**: Proposal for approval
