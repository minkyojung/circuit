#!/usr/bin/env node

/**
 * Weather MCP Server
 *
 * Simple weather information server for testing Circuit
 *
 * Tools:
 * - get_weather: Get current weather for a city
 * - get_forecast: Get 5-day forecast
 */

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Mock weather data
const WEATHER_DATA = {
  'seoul': { temp: 15, condition: 'Cloudy', humidity: 65 },
  'tokyo': { temp: 18, condition: 'Sunny', humidity: 55 },
  'new york': { temp: 12, condition: 'Rainy', humidity: 75 },
  'london': { temp: 10, condition: 'Foggy', humidity: 80 },
  'paris': { temp: 14, condition: 'Partly Cloudy', humidity: 60 },
  'san francisco': { temp: 16, condition: 'Sunny', humidity: 50 }
};

const SERVER_INFO = {
  name: 'weather-server',
  version: '1.0.0'
};

const TOOLS = [
  {
    name: 'get_weather',
    description: 'Get current weather information for a city',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name (e.g., Seoul, Tokyo, New York)'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'get_forecast',
    description: 'Get 5-day weather forecast for a city',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name'
        },
        days: {
          type: 'number',
          description: 'Number of days (1-5)',
          minimum: 1,
          maximum: 5
        }
      },
      required: ['city']
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
      return handleToolCall(id, params);

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

function handleToolCall(id, params) {
  const { name, arguments: args } = params;

  switch (name) {
    case 'get_weather':
      return getWeather(id, args);

    case 'get_forecast':
      return getForecast(id, args);

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown tool: ${name}`
        }
      };
  }
}

function getWeather(id, args) {
  const city = args.city.toLowerCase();
  const weather = WEATHER_DATA[city];

  if (!weather) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: `Weather data not available for city: ${args.city}`,
        data: {
          availableCities: Object.keys(WEATHER_DATA)
        }
      }
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            city: args.city,
            temperature: `${weather.temp}°C`,
            condition: weather.condition,
            humidity: `${weather.humidity}%`,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    }
  };
}

function getForecast(id, args) {
  const city = args.city.toLowerCase();
  const days = args.days || 5;
  const weather = WEATHER_DATA[city];

  if (!weather) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: `Forecast not available for city: ${args.city}`
      }
    };
  }

  // Generate mock forecast
  const forecast = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);

    forecast.push({
      date: date.toISOString().split('T')[0],
      temperature: `${weather.temp + (Math.random() * 6 - 3).toFixed(1)}°C`,
      condition: weather.condition,
      humidity: `${weather.humidity + (Math.random() * 10 - 5).toFixed(0)}%`
    });
  }

  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            city: args.city,
            forecast: forecast
          }, null, 2)
        }
      ]
    }
  };
}

// Log startup to stderr
console.error('Weather MCP Server started');
console.error('Available cities:', Object.keys(WEATHER_DATA).join(', '));
console.error('Listening for JSON-RPC messages on stdin...');
