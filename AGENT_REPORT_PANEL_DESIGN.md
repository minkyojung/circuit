# Agent Report Panel Design

## Overview

Design specification for a right-side panel featuring AI agents that provide insights, recommendations, and analysis of the codebase - inspired by the coaching staff reports in Football Manager.

**Core Concept**: Instead of passive tools waiting for commands, these agents act as proactive team members who actively observe, analyze, and report on the codebase state, offering strategic recommendations.

---

## Agent Roles

### 🛡️ The Guardian (Defense)

**Philosophy**: "What's going wrong?"

**Responsibilities**:
- Bug detection and error monitoring
- Type errors and build issues
- Security vulnerabilities
- Performance degradation and memory leaks
- Test failures

**Reporting Style**: "⚠️ Alert: X is a problem"

**FM Analogy**: Defensive coach + Physiotherapist - prevents goals against, monitors player health

---

### 🏗️ The Architect (Structure)

**Philosophy**: "Is the codebase healthy?"

**Responsibilities**:
- Duplicate pattern detection
- Architecture inconsistencies
- Bloated components/functions
- Dependency entanglements
- Refactoring opportunities

**Reporting Style**: "💡 Suggestion: Refactor Y into Z..."

**FM Analogy**: Tactical coach - oversees team structure and playing style

---

### 🔍 The Scout (Opportunities)

**Philosophy**: "Is there a better way?"

**Responsibilities**:
- Optimization opportunities
- New technology/pattern recommendations
- Legacy code removal opportunities
- Quick wins identification
- Innovation suggestions

**Reporting Style**: "✨ Discovery: Switching from A to B improves by 30%"

**FM Analogy**: Scout + Assistant Manager - finds new possibilities

---

## Why These Three?

**Clear Separation of Concerns**:
- Guardian = **Current problems**
- Architect = **Structural improvements**
- Scout = **Future opportunities**

**Complementary Perspectives**:
- Guardian: "This is broken"
- Architect: "It broke because of structural issues"
- Scout: "Here's how to prevent it from breaking again"

**User Context Mapping**:
- Urgent → Check Guardian only
- Have refactoring time → Review Architect reports
- Long-term planning → Consult Scout

---

## UX Exploration Journey

### Initial Concept: Team Chat

Agents communicate in a shared chat channel like Slack:

```
🛡️ Guardian
Build failed. UserProfile.tsx:42 type error

🏗️ Architect
@Guardian That file has User interface defined
differently in 3 places

🔍 Scout
What about adding Zod for runtime validation?
```

**Strengths**:
- Familiar pattern (Slack/Discord)
- Natural conversation flow
- Contextual history preserved

**Weaknesses**:
- Information overload (noise)
- Important messages scroll away
- Unclear actionability
- Timing control difficult

---

### Alternative UX Patterns Explored

#### 1. Mission Control Dashboard
Each agent has dedicated panel showing summary metrics

#### 2. Code Review Style
Agents leave comments directly in code

#### 3. Progress Quest (Gamification)
Agents present missions/quests with rewards

#### 4. Strategy Map
Issues visualized as relationship graph

#### 5. Shoulder Tap
Context-aware popups only when relevant

#### 6. Inbox (Triage)
Messages managed like email with statuses

#### 7. Timeline
Project evolution as narrative story

---

## Final Design: Mission Control + Speech Bubbles

### Core Concept

Combines **spatial organization** (Mission Control) with **conversational warmth** (Speech Bubbles):

```
┌─────────────────────────────────────┐
│                                     │
│  🛡️ Guardian                        │
│     ╭─────────────────────╮        │
│     │ Build failed        │        │
│     │ UserProfile:42      │        │
│     ╰─────────────────────╯        │
│        2 min ago                    │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  🏗️ Architect                       │
│     ╭─────────────────────╮        │
│     │ Checked that file,  │        │
│     │ User interface      │        │
│     │ defined differently │        │
│     │ in 3 places         │        │
│     ╰─────────────────────╯        │
│     ╭─────────────────────╮        │
│     │ Consider unifying   │        │
│     │ in types/user.ts    │        │
│     ╰─────────────────────╯        │
│        Just now                     │
│                                     │
├─────────────────────────────────────┤
│                                     │
│  🔍 Scout                            │
│     💤 Quiet                        │
│     (Searching for opportunities...) │
│                                     │
└─────────────────────────────────────┘
```

---

## Why This Design Works

### 1. Spatial Separation = Clear Mental Model
- Guardian area = problems
- Architect area = structural suggestions
- Scout area = new ideas
- No scrolling needed to understand "who said what"

### 2. Speech Bubbles = Friendliness + Life
- Less formal than "ERROR: ..."
- Comic/game UI accessibility
- Feels like talking to people, not reading logs

### 3. Temporal Context Preserved
- Bubbles stack within each area
- Can trace back: "Guardian warned 5 min ago"
- Not infinite scroll like chat (only recent N messages)

### 4. Activity State Expression
- Quiet agent = "💤" or "✓ All clear"
- Active agent = multiple bubbles
- Frequency intuitively signals urgency

---

## Design Details

### Priority Through Styling

```
🛡️ Guardian
   ╭━━━━━━━━━━━━━━━━╮  ← Red border (urgent)
   ┃ 🚨 Build failed ┃
   ╰━━━━━━━━━━━━━━━━╯

   ╭─────────────────╮  ← Yellow border (warning)
   │ ⚠️ 3 tests      │
   │    failing      │
   ╰─────────────────╯

   ╭ ─ ─ ─ ─ ─ ─ ─ ─╮  ← Dashed (info)
   │ ℹ️ Coverage 95% │
   ╰ ─ ─ ─ ─ ─ ─ ─ ─╯
```

### Actionable Bubbles

```
🏗️ Architect
   ╭─────────────────────╮
   │ Same pattern found  │
   │ in 3 files          │
   │                     │
   │ [Details] [Fix]     │
   ╰─────────────────────╯
```

### Cross-Agent Connections

```
🛡️ Guardian
   ╭──────────────╮
   │ Type error ❌│
   ╰──────┬───────╯
         │
         └─ Related ─┐
                     ↓
🏗️ Architect
   ╭──────────────────╮
   │ Structural issue │
   │ is the root cause│
   ╰──────────────────╯
```

---

## Layout Options

### Option A: Vertical Split (3 Sections)
**Pros**: All agents always visible
**Cons**: Cramped on small screens

### Option B: Tabs
```
[🛡️ Guardian (2)] [🏗️ Architect (1)] [🔍 Scout]
─────────────────────────────────────────────
   ╭─────────────────╮
   │ Build failed    │
   ╰─────────────────╯
```
**Pros**: More space, focused view
**Cons**: May miss messages from other agents

### Option C: Collapsible Sections
```
┌─ 🛡️ Guardian (2) ─ [▼] ───────┐
│  ╭─────────────────╮         │
│  │ Build failed    │         │
│  ╰─────────────────╯         │
└─────────────────────────────┘

┌─ 🏗️ Architect (1) ─ [▶] ───────┐
│  (collapsed)                   │
└─────────────────────────────┘
```
**Pros**: User controls space
**Cons**: Requires extra click

**Recommendation**: Start with Option A, add collapse functionality in Phase 2

---

## Report Content Framework

### "Impact-Driven Reporting"

Each report structured with:

1. **What**: The finding
2. **Why It Matters**: Business/technical impact
3. **What To Do**: Concrete recommended actions (1-3 options)

**Example**:
```
🔴 Authentication Flow Inconsistency
└─ 5 components manage tokens differently
└─ Impact: Security risk, maintenance cost ↑
└─ Recommendations:
   • [Quick Win] Unify with useAuth hook (~2h)
   • [Later] Refactor Auth context (~1d)
```

---

## Noise Management Strategies

### A) Filter System
Toggle buttons: `[🔴 Urgent] [🟡 Suggestions] [🔵 Info]`

### B) "Focus Mode"
- Default: Guardian only (problems only)
- Full: All 3 agents visible

### C) Smart Aggregation
```
❌ "UserA.tsx type error"
   "UserB.tsx type error" (×10)

✅ "🛡️ Guardian: 10 type errors found
    [Show Details]"
```

### D) Batch Processing
Not real-time, but triggered by:
- Commits
- PR creation
- Build events
- Manual "Analyze Now" request

---

## Interaction Patterns

### Message Lifespan
- Keep recent N messages (e.g., 5 per agent)
- Older messages archived, accessible via "History"

### Pinning Important Messages
```
📌 Pinned
   🏗️ Architect: Auth refactoring recommended (3d ago)
```

### Converting to Tasks
Button on each bubble: `→ Add to Todo`
Transforms agent insight into actionable task

### Search & Tags
Messages tagged: `#refactoring` `#security` `#performance`
Filterable and searchable

---

## Visual Design References

Drawing inspiration from:
- **Discord servers**: Channel-based conversation organization
- **Animal Crossing dialogues**: Speech bubbles + persona charm
- **Notion AI**: Contextual inline suggestions
- **GitHub Copilot Chat**: Maintaining context while conversing
- **Football Manager**: Staff report cards with recommendations

---

## Implementation Phases

### Phase 1: MVP
**Goal**: Prove the concept works

- [ ] 3 agent areas with basic layout
- [ ] Simple speech bubble rendering (text only)
- [ ] Show 2-3 most recent messages per agent
- [ ] Color coding for urgency (🔴🟡🔵)
- [ ] Basic filter (Guardian only / All agents)

**Success Criteria**: Users understand agent roles and can act on recommendations

---

### Phase 2: Usability
**Goal**: Make it delightful to use

- [ ] Pinned messages
- [ ] "Add to Todo" action buttons
- [ ] Batch processing (not real-time spam)
- [ ] Collapsible sections
- [ ] Timestamp hover for context
- [ ] Empty state handling ("All clear ✓")

**Success Criteria**: Users actively rely on agent reports for workflow

---

### Phase 3: Advanced
**Goal**: Multi-agent intelligence

- [ ] Cross-agent connection visualization
- [ ] Pattern recognition & aggregation
- [ ] Context-aware triggering (code editing, committing, etc.)
- [ ] Agent-to-agent conversation (optional)
- [ ] Animation (new bubble appearance)
- [ ] Historical view and search

**Success Criteria**: Agents feel like true collaborators

---

## Open Questions

### Timing & Triggers
**When do agents report?**
- Option A: Continuous background analysis
- Option B: Event-driven (file save, commit, build)
- Option C: Manual "Analyze" button
- **Recommendation**: Start with B (event-driven)

### Agent-to-Agent Interaction
**Should agents talk to each other?**
- Pro: More dynamic, synthesizes multiple perspectives
- Con: Could be noisy and confusing
- **Recommendation**: Phase 3 experiment, start without

### User Responses
**Can user reply to agents?**
- Option A: Read-only (agents broadcast)
- Option B: User can ask clarifying questions
- **Recommendation**: Start read-only, evaluate demand

### Persistence
**Do messages persist across sessions?**
- Pro: Historical context valuable
- Con: May become cluttered
- **Recommendation**: Recent session only, with "History" access

---

## Success Metrics

### Qualitative
- Users refer to agents by name ("Guardian caught that")
- Reports influence actual development decisions
- Feels collaborative, not intrusive

### Quantitative
- % of agent recommendations acted upon
- Time from report to action
- User engagement rate (clicks, pin, add to todo)
- Reduction in bugs/issues caught early

---

## Future Enhancements

### Dynamic Agent Roster
Add context-specific agents:
- **UX Advocate**: User experience issues
- **Performance Coach**: Runtime optimization
- **API Specialist**: Endpoint design
- **Test Champion**: Coverage and quality

### Project Phase Awareness
Agents activate based on phase:
- **Development**: Architect + Scout active
- **Pre-deployment**: Guardian + Performance active
- **Maintenance**: Scout + Architect active

### Sentiment & Tone
Agents develop personality:
- Guardian: Serious, protective
- Architect: Thoughtful, strategic
- Scout: Curious, optimistic

### Learning from User
Track which recommendations get ignored/accepted, improve relevance over time

---

## Technical Considerations

### Performance
- Limit active analysis scope (changed files only)
- Background workers for heavy lifting
- Debounce rapid file changes

### Agent Logic
Each agent needs:
- Analysis engine (static analysis, AST parsing, etc.)
- Reporting thresholds (when to speak up)
- Priority scoring (urgent vs. nice-to-have)
- Message templating

### Data Flow
```
File Change Event
    ↓
Agent Workers (parallel analysis)
    ↓
Report Generator
    ↓
Priority Sorter
    ↓
UI Panel (speech bubbles)
```

---

## Appendix: Rejected Alternatives

### Why Not Pure Chat?
- Too noisy and overwhelming
- Important messages get lost in scroll
- Unclear spatial organization

### Why Not Static Dashboard?
- Feels lifeless and boring
- Doesn't convey urgency well
- Misses conversational warmth

### Why Not Code Inline Comments?
- Too invasive to actual code
- Clutters the editor
- Hard to manage at scale

---

## References

- Original inspiration: Football Manager coaching staff reports
- Similar patterns: IDE inline suggestions, Discord bots, game NPC dialogues
- Related docs: `AGENT_UX_DESIGN.md`, `FEATURE_ROADMAP.md`

---

## Document History

- **2025-11-07**: Initial design specification based on brainstorming session
- Status: **Design phase - awaiting prototype**
