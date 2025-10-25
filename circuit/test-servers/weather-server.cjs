#!/usr/bin/env node

/**
 * Weather MCP Server (Mock)
 * A test MCP server that simulates weather API operations
 */

const readline = require('readline');

class WeatherMCPServer {
  constructor() {
    this.capabilities = {
      tools: { listChanged: false },
      prompts: { listChanged: true }
    };

    this.serverInfo = {
      name: 'weather-api',
      version: '1.0.0'
    };

    this.tools = [
      {
        name: 'get_weather',
        description: 'Get current weather for a location (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'City name'
            }
          },
          required: ['city']
        }
      },
      {
        name: 'get_forecast',
        description: 'Get weather forecast (simulated)',
        inputSchema: {
          type: 'object',
          properties: {
            city: { type: 'string' },
            days: { type: 'number', default: 3 }
          },
          required: ['city']
        }
      }
    ];

    this.prompts = [
      {
        name: 'weather_summary',
        description: 'Generate a weather summary',
        arguments: [
          {
            name: 'city',
            description: 'City to get weather for',
            required: true
          }
        ]
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
            prompts: this.prompts
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
      case 'get_weather':
        return {
          content: [
            {
              type: 'text',
              text: `[Mock] Weather in ${args.city}:\nTemperature: 22°C\nConditions: Sunny\nHumidity: 65%`
            }
          ]
        };

      case 'get_forecast':
        const days = args.days || 3;
        return {
          content: [
            {
              type: 'text',
              text: `[Mock] ${days}-day forecast for ${args.city}:\nDay 1: Sunny, 24°C\nDay 2: Cloudy, 20°C\nDay 3: Rainy, 18°C`
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

    console.error('[Weather Server] Starting...');
    console.error('[Weather Server] Ready to receive requests');

    rl.on('line', (line) => {
      try {
        const request = JSON.parse(line);
        this.handleRequest(request);
      } catch (error) {
        console.error('[Weather Server] Error parsing request:', error);
      }
    });

    rl.on('close', () => {
      console.error('[Weather Server] Shutting down');
      process.exit(0);
    });
  }
}

const server = new WeatherMCPServer();
server.start();
