# Changelog

All notable changes to Circuit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Native macOS glassmorphism with Electron vibrancy for main window
- Rounded corners/border design for inset sidebar
- Transparent body element for native vibrancy effects
- Direct Tailwind color utilities for better text visibility on glassmorphism

### Changed
- Improved sidebar text/icon contrast for glassmorphism backgrounds
  - Light mode: Darker text (gray-900) and icons (gray-600) for better visibility
  - Dark mode: Brighter text (white/95) and icons (gray-300) for better contrast
- Enhanced sidebar hover/selected states with increased brightness differences
  - Light mode: accent (0.97) and hover (0.95) vs previous (0.93)
  - Dark mode: accent (0.35) and hover (0.38) vs previous (0.28/0.32)
- Applied opaque backgrounds to main content area and chat panel
- Moved glassmorphism from sidebar to entire window for unified effect

### Removed
- Unused imports (Trash2, GitBranch, ArrowUp, ArrowDown, Loader2, Plus, cn utilities)
- Opaque background blocking glassmorphism effect
- CSS backdrop-blur in favor of native Electron vibrancy

### Fixed
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
