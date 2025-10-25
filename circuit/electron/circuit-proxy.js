#!/usr/bin/env node

/**
 * Circuit Proxy - MCP Server
 *
 * This is a standalone MCP server that acts as a unified interface
 * for all MCP servers managed by Circuit. It proxies requests to
 * Circuit's HTTP API (localhost:3737).
 *
 * Installation:
 *   Circuit automatically installs this to ~/.circuit/bin/circuit-proxy
 *
 * Usage in Claude Code:
 *   claude mcp add circuit -s stdio ~/.circuit/bin/circuit-proxy
 */

const CIRCUIT_API = 'http://localhost:3737';

// Simple JSON-RPC stdio transport
class StdioTransport {
  constructor() {
    this.buffer = '';
    this.messageHandlers = [];

    process.stdin.on('data', (chunk) => {
      this.handleData(chunk);
    });
  }

  handleData(chunk) {
    this.buffer += chunk.toString();

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        // Silently ignore parse errors from malformed input
      }
    }
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  send(message) {
    process.stdout.write(JSON.stringify(message) + '\n');
  }
}

// Main server
async function main() {
  const transport = new StdioTransport();

  transport.onMessage(async (request) => {
    try {
      // Handle initialize
      if (request.method === 'initialize') {
        transport.send({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: 'circuit-proxy',
              version: '1.0.0',
            },
          },
        });
        return;
      }

      // Handle initialized notification
      if (request.method === 'notifications/initialized') {
        // No response needed for notifications
        return;
      }

      // Handle tools/list
      if (request.method === 'tools/list') {
        try {
          const response = await fetch(`${CIRCUIT_API}/mcp/tools`);
          if (!response.ok) {
            throw new Error(`Circuit API returned ${response.status}`);
          }
          const data = await response.json();

          transport.send({
            jsonrpc: '2.0',
            id: request.id,
            result: {
              tools: data.tools || [],
            },
          });
        } catch (error) {
          // SECURITY: Don't expose internal error details
          transport.send({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: 'Failed to fetch tools from Circuit',
            },
          });
        }
        return;
      }

      // Handle tools/call
      if (request.method === 'tools/call') {
        try {
          const { name, arguments: args } = request.params;

          // SECURITY: Validate input
          if (!name || typeof name !== 'string') {
            throw new Error('Invalid tool name');
          }

          const response = await fetch(`${CIRCUIT_API}/mcp/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolName: name, arguments: args }),
          });

          if (!response.ok) {
            throw new Error('Tool execution failed');
          }

          const result = await response.json();

          transport.send({
            jsonrpc: '2.0',
            id: request.id,
            result,
          });
        } catch (error) {
          transport.send({
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32603,
              message: 'Tool execution failed',
            },
          });
        }
        return;
      }

      // Handle prompts/list
      if (request.method === 'prompts/list') {
        transport.send({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            prompts: [],
          },
        });
        return;
      }

      // Handle resources/list
      if (request.method === 'resources/list') {
        transport.send({
          jsonrpc: '2.0',
          id: request.id,
          result: {
            resources: [],
          },
        });
        return;
      }

      // Unknown method
      transport.send({
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`,
        },
      });
    } catch (error) {
      if (request.id !== undefined) {
        transport.send({
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: 'Internal error',
          },
        });
      }
    }
  });

  console.error('[circuit-proxy] Connected to Circuit MCP Runtime');
}

main().catch((error) => {
  console.error('[circuit-proxy] Fatal error:', error);
  process.exit(1);
});
