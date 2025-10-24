#!/usr/bin/env node
/**
 * Circuit Memory MCP Server
 *
 * Provides memory/context tools for Claude Code to remember project-specific
 * conventions, patterns, and decisions.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  Tool,
  Resource,
} from '@modelcontextprotocol/sdk/types.js'
import { getMemoryStorage } from './memoryStorage.js'
import type { ProjectMemory } from './memoryStorage.js'

// Get project path from environment or args
const PROJECT_PATH = process.env.PROJECT_PATH || process.cwd()

console.error(`[Memory Server] Starting for project: ${PROJECT_PATH}`)

// Create server instance
const server = new Server(
  {
    name: 'circuit-memory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
)

// Define tools
const TOOLS: Tool[] = [
  {
    name: 'memory_store',
    description: 'Store a memory/knowledge for this project (convention, decision, pattern, rule, or note)',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Unique identifier for this memory (e.g., "styling-approach", "api-pattern")',
        },
        value: {
          type: 'string',
          description: 'The actual knowledge/memory to store',
        },
        type: {
          type: 'string',
          enum: ['convention', 'decision', 'snippet', 'rule', 'note'],
          description: 'Type of memory',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Priority of this memory (default: medium)',
        },
        metadata: {
          type: 'string',
          description: 'Optional JSON metadata (reason, date, author, etc.)',
        },
      },
      required: ['key', 'value', 'type'],
    },
  },
  {
    name: 'memory_retrieve',
    description: 'Retrieve memories for this project with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['convention', 'decision', 'snippet', 'rule', 'note'],
          description: 'Filter by memory type',
        },
        key: {
          type: 'string',
          description: 'Search by specific key',
        },
        searchQuery: {
          type: 'string',
          description: 'Search in key and value',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 20)',
        },
      },
    },
  },
  {
    name: 'memory_list',
    description: 'List all memories for this project, grouped by type',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'memory_forget',
    description: 'Delete a specific memory by key',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'Key of the memory to delete',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'memory_stats',
    description: 'Get statistics about stored memories',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'memory_get_all',
    description: 'Get all memories as structured JSON data (for UI)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['convention', 'decision', 'snippet', 'rule', 'note'],
          description: 'Filter by memory type',
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Filter by priority',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 1000)',
        },
      },
    },
  },
  {
    name: 'memory_get_stats',
    description: 'Get memory statistics as structured JSON data (for UI)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
]

// Define resources
const RESOURCES: Resource[] = [
  {
    uri: 'memory://active-memories',
    name: 'Active Project Memories',
    description: 'High-priority memories that should always be applied (conventions, rules, decisions)',
    mimeType: 'text/plain',
  },
  {
    uri: 'memory://all-memories',
    name: 'All Project Memories',
    description: 'Complete list of all project memories',
    mimeType: 'text/plain',
  },
]

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

// List resources handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return { resources: RESOURCES }
})

// Read resource handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params

  try {
    const storage = await getMemoryStorage()

    if (uri === 'memory://active-memories') {
      // Get high-priority memories
      const memories = await storage.getMemories({
        projectPath: PROJECT_PATH,
        priority: 'high',
        limit: 50,
      })

      if (memories.length === 0) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: 'No active memories configured for this project.',
            },
          ],
        }
      }

      let output = '# Project Memories (High Priority)\n\n'
      output += 'These are the active conventions, rules, and decisions for this project.\n'
      output += 'Apply these automatically when relevant.\n\n'

      for (const memory of memories) {
        output += `## ${memory.key} (${memory.type})\n\n`
        output += `${memory.value}\n\n`
        if (memory.metadata) {
          output += `*Metadata: ${memory.metadata}*\n\n`
        }
        output += '---\n\n'
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: output,
          },
        ],
      }
    } else if (uri === 'memory://all-memories') {
      // Get all memories
      const memories = await storage.getMemories({
        projectPath: PROJECT_PATH,
        limit: 100,
      })

      if (memories.length === 0) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: 'No memories stored for this project.',
            },
          ],
        }
      }

      // Group by type and priority
      const byType: Record<string, ProjectMemory[]> = {}
      for (const memory of memories) {
        if (!byType[memory.type]) {
          byType[memory.type] = []
        }
        byType[memory.type].push(memory)
      }

      let output = '# All Project Memories\n\n'

      for (const [type, items] of Object.entries(byType)) {
        output += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s\n\n`
        for (const item of items) {
          output += `### ${item.key} (${item.priority} priority)\n\n`
          output += `${item.value}\n\n`
          if (item.metadata) {
            output += `*Metadata: ${item.metadata}*\n\n`
          }
          output += `*Used ${item.usageCount} times*\n\n`
          output += '---\n\n'
        }
      }

      return {
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: output,
          },
        ],
      }
    } else {
      throw new Error(`Unknown resource URI: ${uri}`)
    }
  } catch (error: any) {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/plain',
          text: `Error reading resource: ${error.message}`,
        },
      ],
    }
  }
})

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    const storage = await getMemoryStorage()

    switch (name) {
      case 'memory_store': {
        const { key, value, type, priority = 'medium', metadata } = args as any

        const id = await storage.storeMemory({
          projectPath: PROJECT_PATH,
          type,
          key,
          value,
          priority,
          metadata,
        })

        return {
          content: [
            {
              type: 'text',
              text: `✓ Memory stored: "${key}"\n\nType: ${type}\nPriority: ${priority}\nValue: ${value}`,
            },
          ],
        }
      }

      case 'memory_retrieve': {
        const { type, key, searchQuery, limit = 20 } = args as any

        const memories = await storage.getMemories({
          projectPath: PROJECT_PATH,
          type,
          key,
          searchQuery,
          limit,
        })

        if (memories.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No memories found matching the criteria.',
              },
            ],
          }
        }

        const formattedMemories = memories
          .map(
            (m) =>
              `**${m.key}** (${m.type}, ${m.priority} priority)\n${m.value}\n${
                m.metadata ? `Metadata: ${m.metadata}\n` : ''
              }Used ${m.usageCount} times`
          )
          .join('\n\n---\n\n')

        return {
          content: [
            {
              type: 'text',
              text: `Found ${memories.length} ${memories.length === 1 ? 'memory' : 'memories'}:\n\n${formattedMemories}`,
            },
          ],
        }
      }

      case 'memory_list': {
        const memories = await storage.getMemories({
          projectPath: PROJECT_PATH,
          limit: 100,
        })

        if (memories.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No memories stored for this project yet.',
              },
            ],
          }
        }

        // Group by type
        const byType: Record<string, ProjectMemory[]> = {}
        for (const memory of memories) {
          if (!byType[memory.type]) {
            byType[memory.type] = []
          }
          byType[memory.type].push(memory)
        }

        let output = `📝 **Project Memories** (${memories.length} total)\n\n`

        for (const [type, items] of Object.entries(byType)) {
          output += `## ${type.charAt(0).toUpperCase() + type.slice(1)}s (${items.length})\n\n`
          for (const item of items) {
            output += `- **${item.key}**: ${item.value.substring(0, 100)}${item.value.length > 100 ? '...' : ''}\n`
          }
          output += '\n'
        }

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        }
      }

      case 'memory_forget': {
        const { key } = args as any

        const deleted = await storage.deleteMemory(PROJECT_PATH, key)

        return {
          content: [
            {
              type: 'text',
              text: deleted
                ? `✓ Forgotten: "${key}"`
                : `Memory "${key}" not found.`,
            },
          ],
        }
      }

      case 'memory_stats': {
        const stats = await storage.getStats(PROJECT_PATH)

        let output = `📊 **Memory Statistics**\n\n`
        output += `Total Memories: ${stats.totalMemories}\n\n`

        if (Object.keys(stats.byType).length > 0) {
          output += `**By Type:**\n`
          for (const [type, count] of Object.entries(stats.byType)) {
            output += `- ${type}: ${count}\n`
          }
          output += '\n'
        }

        if (Object.keys(stats.byPriority).length > 0) {
          output += `**By Priority:**\n`
          for (const [priority, count] of Object.entries(stats.byPriority)) {
            output += `- ${priority}: ${count}\n`
          }
          output += '\n'
        }

        if (stats.mostUsed.length > 0) {
          output += `**Most Used:**\n`
          for (const item of stats.mostUsed.slice(0, 5)) {
            output += `- ${item.key}: ${item.usageCount} uses\n`
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        }
      }

      case 'memory_get_all': {
        const { type, priority, limit = 1000 } = args as any

        const memories = await storage.getMemories({
          projectPath: PROJECT_PATH,
          type,
          priority,
          limit,
        })

        // Return as JSON string for parsing by API
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(memories),
            },
          ],
        }
      }

      case 'memory_get_stats': {
        const stats = await storage.getStats(PROJECT_PATH)

        // Return as JSON string for parsing by API
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats),
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
  console.error('[Memory Server] Connected via stdio')
}

main().catch((error) => {
  console.error('[Memory Server] Fatal error:', error)
  process.exit(1)
})
