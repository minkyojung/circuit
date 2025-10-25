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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const CIRCUIT_API = 'http://localhost:3737';

async function main() {
  const server = new Server(
    {
      name: 'circuit-proxy',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List all tools from Circuit
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    try {
      const res = await fetch(`${CIRCUIT_API}/mcp/tools`);
      if (!res.ok) {
        throw new Error(`Circuit API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return { tools: data.tools || [] };
    } catch (error: any) {
      console.error('[circuit-proxy] Error listing tools:', error);
      // Return empty list if Circuit is not running
      return { tools: [] };
    }
  });

  // Proxy tool calls to Circuit
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const { name, arguments: args } = request.params;

      const res = await fetch(`${CIRCUIT_API}/mcp/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: name, arguments: args }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      return result;
    } catch (error: any) {
      console.error('[circuit-proxy] Error calling tool:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Prompts are not implemented yet
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return { prompts: [] };
  });

  // Resources are not implemented yet
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return { resources: [] };
  });

  // Start the server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[circuit-proxy] Connected to Circuit MCP Runtime');
}

main().catch((error) => {
  console.error('[circuit-proxy] Fatal error:', error);
  process.exit(1);
});
