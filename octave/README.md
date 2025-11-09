# Octave - AI-Powered Development Workspace

> **Branch-based workspace isolation with AI-powered coding assistance**

Octave is a macOS developer tool that provides Git worktree-based workspace management with integrated Claude Code support - streamlining your development workflow.

## 🎯 Vision

Stop context-switching between branches and terminals. Octave brings **ambient, frictionless workspace management** directly into your macOS workflow.

## ✅ Current Features (Phase 0-6)

### Phase 0-1: Foundation
- ✅ Electron + React + TypeScript app
- ✅ `.octave/` folder initialization
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

### Phase 5: AI Integration
- ✅ **No API key needed** - uses Claude Code CLI
- ✅ Subprocess integration with Claude Code
- ✅ Reuses user's Claude Code authentication
- ✅ Streaming response support
- ✅ Cost tracking per request

### Phase 6: Fully Automated Fix Application
- ✅ Read test file and send to AI
- ✅ Parse structured AI response (Root Cause → Fixed Code → Explanation)
- ✅ Apply fix to file with automatic backup (`.backup`)
- ✅ Auto-rerun tests after fix
- ✅ **Complete loop**: Fail → Get AI Fix → Apply → Re-test → Pass 🎉

## 🚀 Core Features

**Goal**: Seamless workspace management with AI assistance.

### Git Worktree-Based Workspaces
- Branch isolation using Git worktrees
- Multiple branches open simultaneously
- Independent working directories
- Workspace metadata tracking

### Claude Code Integration
- Integrated AI coding assistant
- Context-aware suggestions
- File and conversation management
- MCP server support

### Terminal Integration
- Built-in terminal for each workspace
- Shell hook support
- Command history
- Split view support

### Monaco Editor Integration
- Full-featured code editor
- Syntax highlighting for 200+ languages
- LSP support (TypeScript, Go, etc.)
- Multi-file editing

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
octave/
├── electron/
│   ├── main.cjs              # Main process
│   ├── mcp-manager.ts        # MCP server management
│   ├── terminalManager.ts    # Terminal integration
│   └── octave-proxy.js       # MCP proxy
├── src/
│   ├── components/
│   │   ├── workspace/        # Workspace management
│   │   ├── editor/           # Monaco editor
│   │   └── ui/               # Shadcn components
│   ├── services/
│   │   ├── projectConfig.ts  # Project configuration
│   │   └── IPCEventBridge.ts # IPC communication
│   └── contexts/
└── package.json
```

## 🚦 Getting Started

### Prerequisites
- macOS 12+
- Node.js 18+
- **Claude Code installed** (`~/.claude/local/claude`)

### Installation

#### Main Application (uses npm)
```bash
npm install
```

#### Documentation Site (uses pnpm)
```bash
cd docs
pnpm install
```

⚠️ **Important**: The main app uses **npm**, but the documentation site uses **pnpm**. Don't mix them up!

### Development

#### Run Octave App
```bash
npm run dev
```

Opens Octave app with hot-reload enabled.

#### Run Documentation Site
```bash
npm run dev:docs
# or: cd docs && pnpm run dev
```

Opens documentation site at http://localhost:3001

### Build
```bash
# Build Octave app
npm run build
npm run package  # macOS .app bundle

# Build docs
npm run build:docs
```

> **📚 For detailed development workflow, testing, and deployment instructions, see [DEVELOPMENT.md](./DEVELOPMENT.md)**
> **📖 For documentation authoring guide, see [docs/README.md](./docs/README.md)**

## 📖 How It Works

1. **Repository Selection**: Choose a Git repository to work with
2. **Workspace Creation**: Create Git worktree-based workspaces for each branch
3. **AI Assistance**: Integrated Claude Code for coding assistance
4. **File Management**: Edit files across multiple workspaces simultaneously
5. **Terminal Access**: Built-in terminal for each workspace
6. **MCP Integration**: Connect external tools via MCP servers

## 🎨 Design Philosophy

Octave follows **workflow-first** principles:
- **Branch isolation without switching**
- **AI-native development experience**
- **Keyboard-first navigation**
- **Context preservation across workspaces**

Inspired by: Cursor IDE, Linear, Raycast, Conductor

## 🤝 Contributing

Octave is in active development. Current focus:
- [ ] Enhanced workspace management
- [ ] Additional MCP server support
- [ ] Advanced editor features
- [ ] Performance optimizations

## 📄 License

MIT

---

**Built with Claude Code** 🤖
