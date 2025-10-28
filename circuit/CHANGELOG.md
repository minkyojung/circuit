# Changelog

All notable changes to Circuit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Incremental file reading** - Tail-f pattern for efficient JSONL parsing using built-in readline
- **Directory watching** - Automatically detects new conversation files when session starts
- **Waiting state UI** - Graceful "Waiting for session" message with pulse animation instead of error
- Right-aligned status bar messages for better visual hierarchy
- Larger text in status bar (10px) without expanding UI height

### Fixed
- **Critical: EventEmitter memory leak** - Event listeners were accumulating on every workspace selection
- **Critical: Stream resource leak** - Readline interfaces not properly closed after use
- **Session file detection failure** - Large files (>500KB) failed to parse due to truncated JSON
- Redundant full file re-parsing on every change (now using incremental reads)
- Missing async/await on watcher.close() calls

### Changed
- **Complete refactor of workspace-context-tracker** - Simplified from complex 3-layer (file + directory + polling) to clean 2-layer architecture
- Session file detection now uses mtime (file modification time) instead of parsing file contents - 10x faster
- Event listeners now registered once globally instead of per-workspace - prevents memory leaks
- Status bar messaging: "No active Claude Code session" → "Waiting for session" (more accurate)
- Removed excessive debug logging from production code
- Built-in `readline` module instead of external streaming libraries

### Performance
- **10x faster session file detection** - Using mtime instead of reading/parsing file contents
- **Eliminated full file re-parsing** - Incremental reads only process new lines
- **Reduced memory footprint** - Single watcher per workspace instead of up to 3
- **Proper resource cleanup** - All streams and watchers explicitly closed with await

### Technical Debt Paid
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
- Restrict CORS to localhost origins only to prevent unauthorized access
- Add payload size limit (1MB) to API server to prevent DoS attacks
- Sanitize error messages in API responses to prevent information leakage
- Add input validation for API endpoints (toolName, serverId, log lines)
- Remove sensitive error details from status endpoint
- Bind API server explicitly to 127.0.0.1 (localhost only)
- Add input validation for circuit-proxy tool calls
- Sanitize all error responses in circuit-proxy

### Added
- Circuit API Server to expose MCP servers via HTTP REST API (port 3737)
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
