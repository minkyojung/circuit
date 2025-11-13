# Changelog

All notable changes to Octave will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Complete Circuit → Octave rebrand** - Comprehensive codebase migration (2025-11-13)
  - All TypeScript types and interfaces renamed
  - 46 IPC channels migrated (circuit:* → octave:*)
  - Automatic localStorage migration system
  - User data directory migration (Application Support/circuit/ → octave/)
  - SQLite database migration (circuit-data/ → octave-data/)
  - UI text and branding updated throughout
  - Legacy /electron/ directory cleanup
  - See root CHANGELOG.md for complete migration details

## [0.0.7] - 2025-11-11

### Fixed
- **Smart Commit**: Fixed "env: node: No such file or directory" error in Smart Commit feature
  - Added Node.js path detection utility (`electron/utils/nodePath.ts`)
  - Automatically finds Node.js installation across different methods (Homebrew, nvm, fnm, system)
  - Works across all macOS configurations (Intel/Apple Silicon, version managers)
  - Fixed both Smart Commit analysis and AI commit message generation
- **Onboarding**: Fixed issue where onboarding would show again after upgrading from v0.0.4
  - Added automatic migration from `circuit-*` to `octave-*` localStorage keys
  - Users upgrading from v0.0.4 will no longer see onboarding dialog
  - Migration runs automatically on app startup and is idempotent
- **OAuth**: Improved error handling for GitHub authentication
  - Better error messages when user cancels authentication ("Authentication cancelled by user")
  - Timeout errors now more descriptive ("GitHub authentication timed out. Please try again or check your browser.")
  - Added `cancelGitHubOAuth()` function for proper cleanup on cancellation
- **Auto-Update**: Enhanced update check logging for better debugging
  - Now logs current version, latest version, and update availability
  - Added release date and download URL to logs
  - Full error stack traces for debugging update failures
  - Easier to diagnose "no update available" issues

### Changed
- **LocalStorage Keys**: Migrated from `circuit-` to `octave-` prefix for consistency
  - `circuit-onboarding` → `octave-onboarding`
  - `circuit-github-onboarding` → `octave-github-onboarding`
  - Migration is automatic and seamless (runs in `isOnboardingComplete()`)
  - DevTools functions updated to use new keys

### Documentation
- Added `docs/ONBOARDING.md` - Complete onboarding system documentation
  - Architecture overview and storage key documentation
  - OAuth flow details with error handling table
  - LocalStorage data structures and migration guide
  - Testing instructions and troubleshooting guide
- Added `docs/VERSIONING.md` - Release process and versioning guidelines
  - Semantic versioning rules and increment guidelines
  - Step-by-step release process (4 phases)
  - Auto-update configuration and troubleshooting
  - Breaking changes handling and migration best practices

### Changed
- **Rebrand: Circuit → Octave** - Complete product rebrand across codebase
  - Application name changed from Circuit to Octave
  - Package name updated: `circuit` → `octave`
  - App bundle ID: `com.circuit.app` → `com.octave.app`
  - User global directory: `~/.circuit/` → `~/.octave/`
  - Workspace project config: `.circuit/` → `.octave/` (within each workspace)
  - Proxy renamed: `circuit-proxy` → `octave-proxy`
  - All UI text, documentation, and comments updated
  - README.md and ROADMAP.md updated to reflect Octave branding
  - Note: `.conductor/` workspace directory remains unchanged for Conductor app compatibility

---

## [Previous - Circuit Era]

### Added
- **Task Execution System with Auto/Manual Modes** - Execute task plans through Claude Code integration
  - Auto mode: Claude automatically executes all tasks in sequence
  - Manual mode: User controls execution via chat commands ("next", "run all", "execute task N")
  - Mode selection UI in TodoPanel with smart defaults (auto for simple plans, manual for complex)
  - `.octave/todos.json` file generation for Claude Code to read task plans
  - TodoWrite block detection and real-time database synchronization
  - IPC handler `todos:trigger-execution` for background task execution
  - Mode-specific prompts sent to Claude with execution instructions
- **Workspace Archive System** - Archive/unarchive workspaces with metadata persistence
  - Archive tab in Settings dialog with search and management interface
  - Context menu option to archive workspaces from sidebar
  - Metadata stored in `.conductor/workspace-metadata.json`
  - Archived workspaces filtered from main workspace list
- **Thinking Modes** - Adjustable reasoning depth for Claude responses
  - Normal mode: Standard fast responses
  - Think mode: Careful systematic reasoning
  - Megathink mode: Deep analysis with edge case consideration
  - Ultrathink mode: Comprehensive exhaustive reasoning
  - Mode selector dropdown in chat input (replaces "Auto" button)
  - Auto-reset to Normal mode after each message
- **AI SDK Type Adapter Layer** - Bidirectional conversion between AI SDK types and Block system (`aiSDKAdapter.ts`)
- **Enhanced Chat Input with File Attachments** - New `ChatInput` component supporting images, PDFs, and text files (up to 10MB)
- **File Attachment Validation** - Type and size checking with user-friendly error messages
- **Auto-resizing Textarea** - Input field automatically expands up to 200px height
- **Comprehensive Test Suite** - 16 test cases for type adapter with 100% coverage
- **Incremental file reading** - Tail-f pattern for efficient JSONL parsing using built-in readline
- **Directory watching** - Automatically detects new conversation files when session starts
- **Waiting state UI** - Graceful "Waiting for session" message with pulse animation instead of error
- Right-aligned status bar messages for better visual hierarchy
- Larger text in status bar (10px) without expanding UI height

### Fixed
- **TodoPanel UI bug** - Tasks incorrectly showing as completed before execution started (session status now properly set to 'active' instead of 'completed')
- **Task execution UI not updating** - User and assistant messages now properly appear in chat when "Start Tasks" is clicked
- **Auto/Manual mode buttons disappearing** - Buttons now visible for both 'pending' and 'active' session statuses
- **Function declaration order issue** - handleExecuteTasks now manually creates messages instead of calling handleSend to avoid closure problems
- **Excessive debug logging** - Removed verbose console.log statements from TodoPanel (8 debug logs removed)
- **React hook dependencies** - Removed refs from useCallback dependencies array (pendingUserMessageRef)
- **Critical: EventEmitter memory leak** - Event listeners were accumulating on every workspace selection
- **Critical: Stream resource leak** - Readline interfaces not properly closed after use
- **Session file detection failure** - Large files (>500KB) failed to parse due to truncated JSON
- Redundant full file re-parsing on every change (now using incremental reads)
- Missing async/await on watcher.close() calls
- Attachment pill padding when close button is absent
- Dropdown hover state now uses lighter color (50% opacity)

### Changed
- **Task execution now disabled in Normal mode** - TodoConfirmationDialog only appears in Plan mode; Normal/Think modes execute directly without todo analysis
- **ExecutionMode type added** - New type for 'auto' | 'manual' execution modes in todo system
- **TodoPanel mode selection UI** - Replaced simple "Start Tasks" button with mode selector and improved UX
- **Removed obsolete tabs** - Deleted DeploymentsTab, GitHubTab, MemoryTab, TestFixTab components
- **WorkspaceChatEditor Input Refactor** - Replaced 80-line manual textarea implementation with reusable `ChatInput` component (91% code reduction)
- **Message metadata extended** - Added `files` array to track attached file names
- **handleSend signature** - Now accepts `(inputText, attachments)` instead of using closure over state
- **Complete refactor of workspace-context-tracker** - Simplified from complex 3-layer (file + directory + polling) to clean 2-layer architecture
- Session file detection now uses mtime (file modification time) instead of parsing file contents - 10x faster
- Event listeners now registered once globally instead of per-workspace - prevents memory leaks
- Status bar messaging: "No active Claude Code session" → "Waiting for session" (more accurate)
- Removed excessive debug logging from production code
- Built-in `readline` module instead of external streaming libraries
- **Thinking mode integration** - handleSend signature updated to accept thinkingMode parameter
- **Build configuration** - Test files now excluded from production builds (tsconfig.app.json)

### Performance
- **10x faster session file detection** - Using mtime instead of reading/parsing file contents
- **Eliminated full file re-parsing** - Incremental reads only process new lines
- **Reduced memory footprint** - Single watcher per workspace instead of up to 3
- **Proper resource cleanup** - All streams and watchers explicitly closed with await

### Technical Debt Paid
- **AI SDK Integration Foundation** - Built adapter layer for future AI SDK features (Reasoning, Tool visualization, Streaming)
- **Component Reusability** - Extracted ChatInput as standalone component for use across app
- **Type Safety Improvements** - Full TypeScript coverage for AI SDK ↔ Block conversions
- **Test Infrastructure** - Added vitest test suite with 16 comprehensive test cases
- Removed 300+ lines of over-engineered complexity
- Applied battle-tested log tailing patterns from production systems
- Followed Node.js best practices for stream handling
- Improved code maintainability and readability

### Previous Changes

#### Real-time Metrics & Context Tracking
- **Real-time active session detection** - Monitors all Claude Code projects and finds currently active session (within 5h)
- Real-time time display updates for metrics (updates every minute)
- Auto-polling mechanism for metrics (every 10 seconds)
- Auto-refresh after compact command execution (3-second delay)
- Fallback: Recent `/compact` commands (within 5 minutes) are now recognized even without token data
- **Auto-retry mechanism** - Retries session detection every 5 seconds if no active session found

#### Previous Fixes
- **Critical: Massive metric inaccuracy (50% vs 9%)** - Fixed wrong session file detection (9h old data vs current)
- **Critical: "Compacted Never" display issue** caused by Date/string type mismatch
- Date objects not converting to ISO strings for IPC transmission
- Mock data using Date objects instead of strings
- Memory leaks in metrics polling and compact timeout handling
- Stale time display in ContextBar (e.g., "10m ago" not updating)
- Context tracker O(n²) performance issue with large session files
- TypeScript strict mode compilation errors (unused imports/variables)
- Compact detection false negatives due to overly strict token reduction threshold

#### Previous Changes
- **Active session detection: File mtime → Event timestamp** (finds actual active sessions across all projects)
- **Compact detection threshold: 30% → 10%** (more realistic for actual compact operations)
- **Replaced Mock data with empty metrics + warning message**
- Improved `/compact` command matching to avoid false positives (exact match only)
- Removed non-existent `compact_complete` event detection
- Optimized context tracker to single-pass O(n) algorithm
- Improved compact verification with pre/post token comparison
- Removed verbose debug logs from metrics manager
- Enhanced cleanup mechanisms for React hooks and intervals
- Added separate Frontend/Backend ContextMetrics interfaces for proper type safety

### Performance
- **90%+ I/O reduction** - Large files (>8KB) now only read last 8KB for timestamp detection
- 50%+ performance improvement for large session.jsonl files (1000+ lines)
- Reduced memory usage by eliminating duplicate JSON parsing
- Prevented UI freezing during metrics calculation

### Added (Previous)
- Apple HIG-compliant vibrancy text colors using RGBA opacity for glassmorphism
  - Light mode: rgba(0, 0, 0, 0.85) for primary text, rgba(0, 0, 0, 0.50) for muted
  - Dark mode: rgba(255, 255, 255, 0.85) for primary text, rgba(255, 255, 255, 0.55) for muted
- Apple-style glassmorphism hover and selection effects with subtle overlays
  - Light mode: 4% hover overlay, 8% selection overlay
  - Dark mode: 6% hover overlay, 12% selection overlay
- Unified hover animations across all sidebar components (200ms ease-out transitions)
- Native macOS glassmorphism with Electron vibrancy for main window
- Rounded corners/border design for inset sidebar
- Transparent body element for native vibrancy effects
- Direct Tailwind color utilities for better text visibility on glassmorphism
- Apple Human Interface Guidelines-based semantic color token system
  - Background hierarchy: primary, secondary, tertiary levels
  - Label hierarchy: primary (100%), secondary (90%), tertiary (30%), quaternary (18%) opacity
  - Fill hierarchy: primary, secondary, tertiary, quaternary for interactive elements
  - Separator tokens: opaque and translucent variants
  - Material tokens: thin, regular, thick, ultra-thick for glassmorphism effects
- Dark mode depth perception with base (dimmer) vs elevated (brighter) background variants
- Legacy token mapping for backward compatibility

### Changed
- Unified sidebar component styling to match repository switcher design
  - Workspace items now use subtle muted colors (text-sidebar-foreground-muted)
  - Consistent compact padding (px-2 py-2) across all interactive elements
  - Theme toggle and New Workspace button match repo switcher styling
- Optimized workspace status loading with parallel Promise.all instead of sequential awaits
- Improved sidebar text/icon contrast for glassmorphism backgrounds
  - Light mode: Darker text (gray-900) and icons (gray-600) for better visibility
  - Dark mode: Brighter text (white/95) and icons (gray-300) for better contrast
- Enhanced sidebar hover/selected states with increased brightness differences
  - Light mode: accent (0.97) and hover (0.95) vs previous (0.93)
  - Dark mode: accent (0.35) and hover (0.38) vs previous (0.28/0.32)
- Applied opaque backgrounds to main content area and chat panel
- Moved glassmorphism from sidebar to entire window for unified effect
- Reorganized color tokens to follow Apple's semantic naming conventions
  - Background colors now use semantic purpose-based naming
  - Text colors follow label hierarchy instead of foreground/muted
  - Interactive elements use fill hierarchy
  - Separators use dedicated opaque/translucent tokens
- Dark mode glassmorphism now uses Apple-style darker base (#1C1C1C) with higher opacity (0.85)

### Removed
- Debug console.log statements from workspace and repository operations
- Unused imports (Trash2, GitBranch, ArrowUp, ArrowDown, Loader2, Plus, cn utilities)
- Opaque background blocking glassmorphism effect
- CSS backdrop-blur in favor of native Electron vibrancy

### Fixed
- Type safety issue in AppSidebar: onSelectWorkspace now properly accepts null
- Unsafe type coercion (null as any) replaced with proper null handling
- TypeScript build errors from unused imports and variables
- Window transparency issues with native macOS vibrancy
- Text readability on transparent glassmorphism backgrounds
- Sidebar border visibility for better glass effect definition

### Security
- **Path traversal protection** - Validate workspaceId to prevent directory traversal attacks
  - Block special characters (/, \, ..) in workspace identifiers
  - Validate input type (must be string)
- **Input validation for thinking modes** - Whitelist valid thinking mode values
  - Automatically fallback to 'normal' for invalid modes
- Restrict CORS to localhost origins only to prevent unauthorized access
- Add payload size limit (1MB) to API server to prevent DoS attacks
- Sanitize error messages in API responses to prevent information leakage
- Add input validation for API endpoints (toolName, serverId, log lines)
- Remove sensitive error details from status endpoint
- Bind API server explicitly to 127.0.0.1 (localhost only)
- Add input validation for circuit-proxy tool calls
- Sanitize all error responses in circuit-proxy

### Added
- Octave API Server to expose MCP servers via HTTP REST API (port 3737)
- circuit-proxy for Claude Code integration - unified MCP interface
- API endpoints:
  - `GET /health` - Health check
  - `GET /mcp/tools` - List all available tools from running servers
  - `POST /mcp/call` - Execute tools via proxy
  - `GET /mcp/status` - Get status of all MCP servers
  - `GET /mcp/logs/:serverId` - Retrieve server logs
- TypeScript build pipeline for Electron main process using tsc
- Automatic circuit-proxy installation to `~/.circuit/bin/`

### Changed
- API server now provides sanitized error messages for better security
- circuit-proxy returns proper error responses instead of empty results
- Improved error handling throughout API server and proxy

### Removed
- Unused build.js file (we use tsc directly via npm scripts)
- Debug console.error statements from circuit-proxy
- Sensitive error details from API responses

### Fixed
- TypeScript compilation errors in Electron main process
- MCPServerManager access modifier (private -> public for API access)
- Missing api-server.ts and circuit-proxy.js in circuit/electron directory

## [0.1.0] - 2024-10-23

### Added
- MCP Call History tracking with Phase 1 implementation
- Git MCP server integration
- Filesystem MCP server integration
- MCP server management UI (Installed tab)
- Tool listing with copy-to-clipboard functionality
- Server status monitoring (running/stopped)
- Auto-start/auto-restart configuration for servers
- MCP server troubleshooting guide

### Changed
- Improved UI/UX for better visibility and clarity (Phase 5)
- Redesigned InstalledTab to display tools effectively
- Enhanced error handling for MCP server installation

### Fixed
- TypeScript build pipeline for Electron main process
- MCP server process spawning issues
- Server installation and error handling
