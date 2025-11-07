#!/usr/bin/env node

/**
 * Simple Echo MCP Server
 * A minimal MCP server for testing that implements the Model Context Protocol
 */

const readline = require('readline');

class EchoMCPServer {
  constructor() {
    this.capabilities = {
      tools: { listChanged: false },
      prompts: { listChanged: false }
    };

    this.serverInfo = {
      name: 'echo-server',
      version: '1.0.0'
    };

    this.tools = [
      {
        name: 'echo',
        description: 'Echoes back the input message',
        inputSchema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back'
            }
          },
          required: ['message']
        }
      },
      {
        name: 'reverse',
        description: 'Reverses the input string',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to reverse'
            }
          },
          required: ['text']
        }
      },
      {
        name: 'uppercase',
        description: 'Converts text to uppercase',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The text to convert'
            }
          },
          required: ['text']
        }
      }
    ];
  }

  handleRequest(request) {
    const { id, method, params } = request;

    try {
      let result;

      switch (method) {
        case 'initialize':
          result = {
            protocolVersion: '2024-11-05',
            capabilities: this.capabilities,
            serverInfo: this.serverInfo
          };
          break;

        case 'tools/list':
          result = {
            tools: this.tools
          };
          break;

        case 'tools/call':
          result = this.handleToolCall(params);
          break;

        case 'prompts/list':
          result = {
            prompts: []
          };
          break;

        case 'resources/list':
          result = {
            resources: []
          };
          break;

        default:
          throw {
            code: -32601,
            message: `Method not found: ${method}`
          };
      }

      this.sendResponse(id, result);
    } catch (error) {
      this.sendError(id, error);
    }
  }

  handleToolCall(params) {
    const { name, arguments: args } = params;

    switch (name) {
      case 'echo':
        return {
          content: [
            {
              type: 'text',
              text: args.message || 'No message provided'
            }
          ]
        };

      case 'reverse':
        return {
          content: [
            {
              type: 'text',
              text: (args.text || '').split('').reverse().join('')
            }
          ]
        };

      case 'uppercase':
        return {
          content: [
            {
              type: 'text',
              text: (args.text || '').toUpperCase()
            }
          ]
        };

      default:
        throw {
          code: -32602,
          message: `Unknown tool: ${name}`
        };
    }
  }

  sendResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id,
      result
    };
    this.send(response);
  }

  sendError(id, error) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code || -32603,
        message: error.message || 'Internal error'
      }
    };
    this.send(response);
  }

  send(message) {
    console.log(JSON.stringify(message));
  }

  start() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    // Log to stderr (won't interfere with JSON-RPC communication)
    console.error('[Echo Server] Starting...');
    console.error('[Echo Server] Ready to receive requests');

    rl.on('line', (line) => {
      try {
        const request = JSON.parse(line);
        this.handleRequest(request);
      } catch (error) {
        console.error('[Echo Server] Error parsing request:', error);
      }
    });

    rl.on('close', () => {
      console.error('[Echo Server] Shutting down');
      process.exit(0);
    });
  }
}

// Start the server
const server = new EchoMCPServer();
server.start();
