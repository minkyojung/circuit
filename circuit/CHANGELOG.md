# Changelog

All notable changes to Circuit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
