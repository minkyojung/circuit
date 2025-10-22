# Circuit - AI-Powered Test-Fix Loop

> **Fully automated test-fix cycle**: Fail → AI Analysis → Auto Fix → Re-test → Pass ✅

Circuit is a macOS developer tool that watches your tests, detects failures, and automatically fixes them using AI - without you leaving your editor.

## 🎯 Vision

Stop context-switching between your editor, terminal, and test results. Circuit brings **ambient, frictionless test monitoring** directly into your macOS workflow.

## ✅ Current Features (Phase 0-6)

### Phase 0-1: Foundation
- ✅ Electron + React + TypeScript app
- ✅ `.circuit/` folder initialization
- ✅ Project configuration management

### Phase 2: Smart Detection
- ✅ Auto-detect project type (React/Next.js/Node.js)
- ✅ Analyze `package.json` for framework detection
- ✅ Confidence scoring (0-100%)

### Phase 3: Real-time Watching
- ✅ Chokidar-based file watching
- ✅ Monitor `.ts`, `.tsx`, `.js`, `.jsx` changes
- ✅ Smart filtering (ignore `node_modules`, `.git`)

### Phase 4: Test Execution
- ✅ Run `npm test` with output parsing
- ✅ Extract passed/failed/total counts
- ✅ Auto-run tests on file change
- ✅ Error line extraction

### Phase 5: AI Fix Suggestions (Conductor-style)
- ✅ **No API key needed** - uses Claude Code CLI
- ✅ Subprocess integration (`~/.claude/local/claude`)
- ✅ Reuses user's Claude Code authentication
- ✅ stdin/stdout JSON protocol
- ✅ Cost tracking per request

### Phase 6: Fully Automated Fix Application
- ✅ Read test file and send to AI
- ✅ Parse structured AI response (Root Cause → Fixed Code → Explanation)
- ✅ Apply fix to file with automatic backup (`.backup`)
- ✅ Auto-rerun tests after fix
- ✅ **Complete loop**: Fail → Get AI Fix → Apply → Re-test → Pass 🎉

## 🚀 UX Roadmap: Frictionless Integration

**Goal**: Zero context-switching. Circuit should be **always visible but never intrusive**.

### Phase 7: Circuit Peek - Non-Activating Panel (Next)
> Small floating panel that stays visible without stealing focus

```
[Your Editor]              [Circuit Peek]
┌────────────────┐        ┌──────────────┐
│ coding...      │        │ 🟢 15 passed │
│                │        │ ⏱  0.34s     │
│                │        │              │
│                │ <save> │ Auto-run: ☑️ │
└────────────────┘        └──────────────┘
                          ↓
                          ┌──────────────┐
                          │ 🔴 2 failed  │
                          │ [Get AI Fix] │
                          └──────────────┘
```

**Features:**
- Always-on-top NSPanel
- `acceptsFirstMouse: false` - doesn't steal focus
- Smart positioning near active editor
- Auto-expand on failure
- One-click AI Fix

**Timeline**: 3 days

---

### Phase 8: Circuit Notch - Dynamic Island Style
> Use MacBook Notch for ambient status display

```
MacBook Notch:
     ╔════════════╗
     ║ 🔴 2 failed ║  ← Auto-expands on failure
     ║ [💡 Fix]    ║
     ╚════════════╝
```

**Features:**
- DynamicNotchKit integration
- Color-coded states (green/yellow/red)
- Live progress during test runs
- Expandable for detailed info
- Click to trigger AI Fix

**Limitations**: MacBook Pro 2021+ with Notch only

**Timeline**: 1 week

---

### Phase 9: Circuit Cmd+Tab - App Switcher Enhancement
> Show Circuit status in Cmd+Tab preview

```
Cmd+Tab:
┌──────────────────────────────┐
│        [Circuit●]             │
│  ┌────────────────────────┐  │
│  │ 🔴 2 tests failed      │  │
│  │ Press Enter: Get AI Fix│  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**Features:**
- Custom app preview in Cmd+Tab
- Quick actions without opening app
- Keyboard-driven workflow
- Zero learning curve (existing muscle memory)

**Timeline**: 3 days

---

## 🏗 Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Shadcn UI + Tailwind CSS
- **Desktop**: Electron 33
- **File Watching**: Chokidar
- **AI**: Claude CLI (subprocess)
- **IPC**: 7 handlers (init, detect, watch, test, fix, apply, etc.)

### Project Structure
```
circuit/
├── electron/
│   └── main.cjs              # 7 IPC handlers
├── src/
│   ├── components/
│   │   ├── TestFixTab.tsx    # Main UI
│   │   └── ui/               # Shadcn components
│   └── core/
│       ├── detector.ts       # Project type detection
│       ├── watcher.ts        # File change monitoring
│       ├── test-runner.ts    # Test execution
│       └── claude-cli.ts     # AI integration + parsing
└── package.json
```

## 🚦 Getting Started

### Prerequisites
- macOS 12+
- Node.js 18+
- **Claude Code installed** (`~/.claude/local/claude`)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

Opens Circuit app with hot-reload enabled.

### Build
```bash
npm run build
npm run package  # macOS .app bundle
```

## 📖 How It Works

1. **Project Detection**: Analyzes your `package.json` to detect React/Next.js/Node
2. **File Watching**: Monitors your source files for changes
3. **Auto-run Tests**: Runs `npm test` when files change
4. **Parse Results**: Extracts pass/fail counts and error messages
5. **AI Analysis**: Sends test file + error to Claude CLI
6. **Apply Fix**: Parses AI response, writes fixed code, creates backup
7. **Re-test**: Automatically re-runs tests
8. **Success**: Loop completes when all tests pass ✅

## 🎨 Design Philosophy

Circuit follows **ambient computing** principles:
- **Always visible, never intrusive**
- **Context-aware notifications** (only when needed)
- **Keyboard-first** (minimize mouse usage)
- **No forced attention** (you decide when to act)

Inspired by: Raycast, Arc Browser, Things 3, DynamicLake, Cursor IDE

## 🤝 Contributing

Circuit is in active development. Current focus:
- [ ] Phase 7: Circuit Peek panel
- [ ] Multi-file test support
- [ ] Source code analysis (not just test files)
- [ ] Custom test commands beyond `npm test`

## 📄 License

MIT

---

**Built with Claude Code** 🤖
