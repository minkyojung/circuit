# Claude Code Integration Setup

This guide explains how to connect Claude Code to Octave's MCP Runtime, allowing you to use all your Octave-managed MCP servers directly in Claude Code.

## Architecture Overview

```
Claude Code → circuit-proxy (stdio MCP) → HTTP API (localhost:3737) → MCP Manager → Individual MCP servers
```

- **circuit-proxy**: A lightweight stdio-based MCP server that acts as a unified interface
- **HTTP API**: REST API running on localhost:3737 that aggregates all MCP servers
- **MCP Manager**: Octave's core runtime that manages individual MCP server processes

## Prerequisites

1. **Octave App**: Must be running with at least one MCP server installed
2. **Claude Code**: Installed and configured on your system

## Setup Instructions

### Step 1: Launch Octave

Start the Octave app. It will automatically:
- Install `circuit-proxy` to `~/.circuit/bin/circuit-proxy`
- Start the HTTP API server on `localhost:3737`
- Auto-start any MCP servers marked for auto-start

You should see in the Octave logs:
```
[Octave] Proxy installed to: /Users/you/.circuit/bin/circuit-proxy
[Octave API] Server listening on http://localhost:3737
Auto-start servers initialized
```

### Step 2: Verify circuit-proxy Installation

Check that the proxy script exists and is executable:

```bash
ls -la ~/.circuit/bin/circuit-proxy
```

You should see:
```
-rwxr-xr-x  1 you  staff  [size]  [date]  /Users/you/.circuit/bin/circuit-proxy
```

### Step 3: Add circuit-proxy to Claude Code

Run the following command to add Octave as an MCP server in Claude Code:

```bash
claude mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy
```

Expected output:
```
✓ Added MCP server 'circuit' to your config
```

### Step 4: Verify Configuration

Check your Claude Code MCP configuration:

```bash
cat ~/.claude/claude_desktop_config.json
```

You should see an entry like:
```json
{
  "mcpServers": {
    "circuit": {
      "command": "stdio",
      "args": ["/Users/you/.circuit/bin/circuit-proxy"]
    }
  }
}
```

### Step 5: Restart Claude Code

Restart Claude Code to load the new MCP server configuration.

### Step 6: Verify Integration

In Claude Code, you can now use tools from all your Octave-managed MCP servers!

Try asking Claude:
```
What MCP tools are available?
```

Claude should list all tools from all running Octave servers.

## Testing in Octave Playground

Before using tools in Claude Code, you can test them in Octave's Playground tab:

1. Open Octave
2. Click the **Playground** tab in the sidebar
3. Select a tool from the list
4. Enter test arguments
5. Click "Execute Tool"

This helps verify that tools are working correctly before using them in Claude Code.

## Troubleshooting

### Issue: "circuit-proxy not found"

**Solution**: Make sure Octave is running and has completed startup. The proxy is installed on first launch.

### Issue: "Connection refused to localhost:3737"

**Solution**:
1. Verify Octave app is running
2. Check the Octave logs for API server startup messages
3. Restart Octave if needed

### Issue: "No tools available in Claude Code"

**Solution**:
1. Open Octave → Installed tab
2. Verify at least one MCP server is running (green status)
3. If all servers are stopped, click "Start" on a server
4. Restart Claude Code

### Issue: "Tool execution fails in Claude Code"

**Solution**:
1. Test the tool in Octave Playground first
2. Check Octave logs for error messages
3. Verify the MCP server is still running in Octave → Installed tab
4. Try restarting the specific server in Octave

## Monitoring Octave Activity

While using Claude Code, you can monitor MCP activity in real-time:

1. Open Octave → **Installed** tab
2. Watch the **Call Count** and **Avg Duration** metrics update
3. Click "View Logs" on any server to see detailed execution logs
4. Monitor server health status

## Advanced: Multiple AI Tools

Octave's proxy works with any MCP-compatible AI tool, not just Claude Code:

```bash
# For Cursor
cursor mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy

# For Windsurf
windsurf mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy
```

All tools will share the same Octave-managed MCP servers!

## Benefits

✅ **Unified Management**: Manage all MCP servers in one place (Octave)
✅ **Real-time Monitoring**: See tool usage, performance metrics, and logs
✅ **Easy Testing**: Test tools in Playground before using in Claude
✅ **Auto-restart**: Octave automatically restarts failed servers
✅ **Multi-tool Support**: Use same servers across Claude, Cursor, Windsurf, etc.

## What's Next?

- **Install more MCP servers**: Octave → Discover tab
- **Monitor performance**: Octave → Installed tab → View metrics
- **Test tools safely**: Octave → Playground tab
- **View logs**: Octave → Installed tab → View Logs

---

*Built with Octave MCP Runtime - Your central hub for Model Context Protocol*
