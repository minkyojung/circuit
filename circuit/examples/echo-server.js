#!/usr/bin/env node

/**
 * Simple Echo MCP Server
 * This is a minimal MCP server for testing Circuit
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// MCP Server capabilities
const SERVER_INFO = {
  name: 'echo-server',
  version: '1.0.0'
};

const TOOLS = [
  {
    name: 'echo',
    description: 'Echoes back the input text',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to echo back'
        }
      },
      required: ['text']
    }
  }
];

// Handle incoming messages
rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    const response = handleRequest(request);

    if (response) {
      console.log(JSON.stringify(response));
    }
  } catch (error) {
    const errorResponse = {
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
        data: error.message
      },
      id: null
    };
    console.log(JSON.stringify(errorResponse));
  }
});

function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: SERVER_INFO,
          capabilities: {
            tools: {}
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS
        }
      };

    case 'tools/call':
      const { name, arguments: args } = params;

      if (name === 'echo') {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Echo: ${args.text}`
              }
            ]
          }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`
        }
      };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
  }
}

// Log startup to stderr (so it doesn't interfere with JSON-RPC)
console.error('Echo MCP Server started');
console.error('Listening for JSON-RPC messages on stdin...');
