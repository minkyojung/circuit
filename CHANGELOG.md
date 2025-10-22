# Changelog

All notable changes to the Circuit project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Removed debug console.log statements throughout the codebase for cleaner production code
- Removed hardcoded paths in TestFixTab and App components
- Fixed TypeScript build errors
- Improved code quality and maintainability

### Fixed
- Fixed TypeScript type errors in DeveloperTab (latency handling, useEffect return type)
- Fixed unused import warnings in components
- Fixed window.require type declaration for Electron integration

## [0.6.0] - Phase 6: Fully Automated Fix Application

### Added
- Automated fix application to test files
- Automatic test re-run after applying AI-generated fixes
- File backup creation before applying fixes
- Complete end-to-end test-fix loop automation

### Changed
- Enhanced AI fix parsing to extract structured code from responses
- Improved error handling in fix application process

## [0.5.0] - Phase 5: AI Fix Suggestions with Claude CLI

### Added
- Integration with Claude Code CLI for AI-powered test fix suggestions
- Conductor-style AI integration (no API key management needed)
- Structured AI response parsing (Root Cause, Fixed Code, Explanation)
- Cost tracking for AI operations

### Changed
- Test error analysis now includes full test file context
- AI prompts optimized for better fix quality

## [0.4.0] - Phase 4: Test Execution

### Added
- Test execution via `npm test` command
- Test result parsing for Jest/Vitest formats
- Auto-run tests on file changes toggle
- Test duration tracking and display
- Error message extraction and display

### Changed
- Test output limited to 10KB for performance
- CI mode enabled for non-interactive test runs

## [0.3.0] - Phase 3: Real-time File Change Detection

### Added
- File watcher using chokidar for real-time change detection
- Support for .ts, .tsx, .js, .jsx, .mjs, .cjs files
- File change event logging with timestamps
- Ignored patterns for node_modules, .git, dist, build directories

### Changed
- File changes display limited to last 10 events

## [0.2.0] - Phase 2: Project Type Auto-Detection

### Added
- Automatic project type detection from package.json
- Support for React, Next.js, and Node.js API detection
- Confidence scoring for detection results
- Strategy-based template selection
- `.circuit/` folder structure with strategies, hooks, mcps, history directories

### Changed
- Initialization now uses detected project type for template selection

## [0.1.0] - Phase 1: Test-Fix Loop Foundation

### Added
- Test-Fix Loop UI with tabbed interface
- Circuit configuration file (circuit.config.md) generation
- Template system for different project types
- Basic project initialization workflow

## [0.0.3] - MCP Server Infrastructure

### Added
- MCP server connection and management
- JSON-RPC message handling
- Server lifecycle management (start/stop)
- Event streaming to renderer process

## [0.0.2] - Developer Tools

### Added
- Developer tab with MCP debugging capabilities
- Request builder for testing MCP servers
- Custom server configuration support
- Performance metrics (latency tracking, request counts)
- Server Explorer with auto-discovery
- Tool testing interface

## [0.0.1] - Initial Setup

### Added
- React + Vite + TypeScript foundation
- Shadcn UI component library
- Electron integration
- macOS-native window controls with hidden title bar
- Draggable window regions
- Dark mode support
