#!/usr/bin/env node
/**
 * Vercel Deployment MCP Server
 *
 * Provides tools to monitor Vercel deployments and fetch error logs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

// Vercel API token from environment
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || ''
const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID || ''

if (!VERCEL_TOKEN) {
  console.error('[Vercel MCP] Warning: VERCEL_TOKEN not set')
}

console.error(`[Vercel MCP] Starting...`)

// Create server instance
const server = new Server(
  {
    name: 'vercel-deployments',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Vercel API helper
async function vercelAPI(endpoint: string): Promise<any> {
  const baseUrl = 'https://api.vercel.com'
  const url = VERCEL_TEAM_ID
    ? `${baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}teamId=${VERCEL_TEAM_ID}`
    : `${baseUrl}${endpoint}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Vercel API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

// Define tools
const TOOLS: Tool[] = [
  {
    name: 'list_deployments',
    description: 'List recent Vercel deployments for a project',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: {
          type: 'string',
          description: 'Name of the Vercel project (optional, lists all if not provided)',
        },
        limit: {
          type: 'number',
          description: 'Number of deployments to return (default: 10, max: 100)',
        },
      },
    },
  },
  {
    name: 'get_deployment_status',
    description: 'Get detailed status of a specific deployment',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: {
          type: 'string',
          description: 'Deployment ID or URL',
        },
      },
      required: ['deploymentId'],
    },
  },
  {
    name: 'get_deployment_logs',
    description: 'Get build logs for a deployment (especially useful for failed deployments)',
    inputSchema: {
      type: 'object',
      properties: {
        deploymentId: {
          type: 'string',
          description: 'Deployment ID',
        },
      },
      required: ['deploymentId'],
    },
  },
]

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'list_deployments': {
        const limit = (args?.limit as number) || 10
        const projectName = args?.projectName as string | undefined

        const data = await vercelAPI(`/v6/deployments?limit=${limit}`)

        let deployments = data.deployments || []

        // Filter by project name if provided
        if (projectName) {
          deployments = deployments.filter((d: any) =>
            d.name?.toLowerCase().includes(projectName.toLowerCase())
          )
        }

        // Format response
        const formatted = deployments.map((d: any) => ({
          id: d.uid,
          name: d.name,
          url: d.url,
          state: d.state,
          readyState: d.readyState,
          createdAt: new Date(d.createdAt).toLocaleString(),
          creator: d.creator?.username,
          target: d.target,
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(formatted, null, 2),
            },
          ],
        }
      }

      case 'get_deployment_status': {
        const deploymentId = args?.deploymentId as string

        if (!deploymentId) {
          throw new Error('deploymentId is required')
        }

        const data = await vercelAPI(`/v13/deployments/${deploymentId}`)

        const status = {
          id: data.uid,
          name: data.name,
          url: data.url,
          state: data.state,
          readyState: data.readyState,
          createdAt: new Date(data.createdAt).toLocaleString(),
          buildingAt: data.buildingAt ? new Date(data.buildingAt).toLocaleString() : null,
          ready: data.ready ? new Date(data.ready).toLocaleString() : null,
          error: data.errorMessage || null,
          target: data.target,
          creator: data.creator?.username,
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(status, null, 2),
            },
          ],
        }
      }

      case 'get_deployment_logs': {
        const deploymentId = args?.deploymentId as string

        if (!deploymentId) {
          throw new Error('deploymentId is required')
        }

        // Get deployment details first to check for errors
        const deployment = await vercelAPI(`/v13/deployments/${deploymentId}`)

        // Get build logs
        const logsData = await vercelAPI(`/v2/deployments/${deploymentId}/events`)

        // Format logs
        let logs = '=== Vercel Deployment Logs ===\n\n'
        logs += `Deployment: ${deployment.name}\n`
        logs += `URL: ${deployment.url}\n`
        logs += `State: ${deployment.state}\n`
        logs += `Ready State: ${deployment.readyState}\n\n`

        if (deployment.errorMessage) {
          logs += `❌ ERROR: ${deployment.errorMessage}\n\n`
        }

        logs += '=== Build Events ===\n\n'

        // Parse and format events
        if (logsData && Array.isArray(logsData)) {
          logsData.forEach((event: any) => {
            const timestamp = new Date(event.created).toLocaleTimeString()
            const text = event.text || event.payload?.text || ''

            if (text) {
              logs += `[${timestamp}] ${text}\n`
            }
          })
        } else {
          logs += 'No events found\n'
        }

        return {
          content: [
            {
              type: 'text',
              text: logs,
            },
          ],
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    }
  }
})

// Start server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[Vercel MCP] Connected via stdio')
}

main().catch((error) => {
  console.error('[Vercel MCP] Fatal error:', error)
  process.exit(1)
})
