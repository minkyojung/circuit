#!/usr/bin/env node

/**
 * Filesystem MCP Server (Mock)
 * A test MCP server that simulates filesystem operations
 */

const readline = require('readline');

class FilesystemMCPServer {
  constructor() {
    this.capabilities = {
      tools: { listChanged: false },
      resources: { listChanged: false }
    };

    this.serverInfo = {
      name: 'filesystem-server',
      version: '1.0.0'
    };

    this.tools = [
      {
        name: 'read',
        description: 'Read file contents (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Path to the file'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write',
        description: 'Write file contents (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list',
        description: 'List directory contents (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
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

        case 'resources/list':
          result = {
            resources: [
              {
                uri: 'file:///mock/data.json',
                name: 'Mock Data',
                mimeType: 'application/json'
              }
            ]
          };
          break;

        case 'prompts/list':
          result = {
            prompts: []
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
      case 'read':
        return {
          content: [
            {
              type: 'text',
              text: `[Mock] Contents of ${args.path}:\n{\n  "data": "sample"\n}`
            }
          ]
        };

      case 'write':
        return {
          content: [
            {
              type: 'text',
              text: `[Mock] Written ${args.content.length} bytes to ${args.path}`
            }
          ]
        };

      case 'list':
        return {
          content: [
            {
              type: 'text',
              text: `[Mock] Contents of ${args.path}:\n- file1.txt\n- file2.json\n- subdirectory/`
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

    console.error('[Filesystem Server] Starting...');
    console.error('[Filesystem Server] Ready to receive requests');

    rl.on('line', (line) => {
      try {
        const request = JSON.parse(line);
        this.handleRequest(request);
      } catch (error) {
        console.error('[Filesystem Server] Error parsing request:', error);
      }
    });

    rl.on('close', () => {
      console.error('[Filesystem Server] Shutting down');
      process.exit(0);
    });
  }
}

const server = new FilesystemMCPServer();
server.start();
