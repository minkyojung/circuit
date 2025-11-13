import express, { Request, Response } from 'express';
import cors from 'cors';
import type { MCPServerManager } from './mcp-manager';

export class OctaveAPIServer {
  private app: express.Application;
  private server: any;
  private mcpManager: MCPServerManager;
  private port: number;

  constructor(mcpManager: MCPServerManager, port: number = 3737) {
    this.mcpManager = mcpManager;
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // SECURITY: Restrict CORS to localhost only for development
    // In production, this should be further restricted or use proper authentication
    this.app.use(cors({
      origin: ['http://localhost:5173', 'http://localhost:3737'],
      credentials: true
    }));
    this.app.use(express.json({ limit: '1mb' })); // Prevent large payload attacks
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: Date.now() });
    });

    // List all tools from all running servers
    this.app.get('/mcp/tools', async (req: Request, res: Response) => {
      try {
        const allTools: any[] = [];

        for (const [serverId, server] of this.mcpManager.servers) {
          if (server.status !== 'running') continue;

          try {
            const tools = server.tools || [];
            allTools.push(...tools.map((t: any) => ({
              ...t,
              _serverId: serverId,
              _serverName: server.name,
            })));
          } catch (error) {
            // Skip servers with errors, continue processing others
          }
        }

        res.json({ tools: allTools });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to list tools' });
      }
    });

    // Call a tool (proxy to actual server)
    this.app.post('/mcp/call', async (req: Request, res: Response) => {
      try {
        const { toolName, arguments: args, serverId } = req.body;

        // SECURITY: Input validation
        if (!toolName || typeof toolName !== 'string') {
          return res.status(400).json({ error: 'toolName is required and must be a string' });
        }

        if (serverId && typeof serverId !== 'string') {
          return res.status(400).json({ error: 'serverId must be a string' });
        }

        // If serverId is provided, use it directly
        let targetServerId = serverId;

        // Otherwise, find which server has this tool
        if (!targetServerId) {
          for (const [id, server] of this.mcpManager.servers) {
            if (server.status !== 'running') continue;
            const hasTool = server.tools?.some((t: any) => t.name === toolName);
            if (hasTool) {
              targetServerId = id;
              break;
            }
          }
        }

        if (!targetServerId) {
          return res.status(404).json({ error: 'Tool not found or server not running' });
        }

        const result = await this.mcpManager.callTool(targetServerId, toolName, args || {});
        res.json(result);
      } catch (error: any) {
        // SECURITY: Don't expose internal error details
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Get health status of all servers
    this.app.get('/mcp/status', async (req: Request, res: Response) => {
      try {
        const statuses: any = {};

        for (const [serverId, server] of this.mcpManager.servers) {
          statuses[serverId] = {
            id: serverId,
            name: server.name,
            status: server.status,
            uptime: server.startedAt ? Date.now() - server.startedAt : 0,
            stats: server.stats || {
              callCount: 0,
              errorCount: 0,
              lastCallDuration: 0,
              avgCallDuration: 0,
            },
            toolCount: server.tools?.length || 0,
            // SECURITY: Don't expose error details to prevent information leakage
            hasError: !!server.error,
          };
        }

        res.json(statuses);
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to get server status' });
      }
    });

    // Get logs for a specific server
    this.app.get('/mcp/logs/:serverId', async (req: Request, res: Response) => {
      try {
        const { serverId } = req.params;
        const lines = parseInt(req.query.lines as string) || 100;

        // SECURITY: Validate and limit lines parameter
        const validatedLines = Math.min(Math.max(1, lines), 10000);

        const logs = await this.mcpManager.getLogs(serverId, validatedLines);
        res.json({ logs });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to get logs' });
      }
    });

    // List all resources from all running servers
    this.app.get('/mcp/resources', async (req: Request, res: Response) => {
      try {
        const allResources: any[] = [];

        for (const [serverId, server] of this.mcpManager.servers) {
          if (server.status !== 'running') continue;

          try {
            const resources = server.resources || [];
            allResources.push(...resources.map((r: any) => ({
              ...r,
              _serverId: serverId,
              _serverName: server.name,
            })));
          } catch (error) {
            // Skip servers with errors, continue processing others
          }
        }

        res.json({ resources: allResources });
      } catch (error: any) {
        res.status(500).json({ error: 'Failed to list resources' });
      }
    });

    // Read a specific resource
    this.app.post('/mcp/resource/read', async (req: Request, res: Response) => {
      try {
        const { uri, serverId } = req.body;

        // SECURITY: Input validation
        if (!uri || typeof uri !== 'string') {
          return res.status(400).json({ error: 'uri is required and must be a string' });
        }

        // If serverId is provided, use it directly
        let targetServerId = serverId;

        // Otherwise, find which server has this resource
        if (!targetServerId) {
          for (const [id, server] of this.mcpManager.servers) {
            if (server.status !== 'running') continue;
            const hasResource = server.resources?.some((r: any) => r.uri === uri);
            if (hasResource) {
              targetServerId = id;
              break;
            }
          }
        }

        if (!targetServerId) {
          return res.status(404).json({ error: 'Resource not found or server not running' });
        }

        const server = this.mcpManager.servers.get(targetServerId);
        if (!server || !server.client) {
          return res.status(404).json({ error: 'Server not available' });
        }

        const result = await server.client.readResource({ uri });
        res.json(result);
      } catch (error: any) {
        // SECURITY: Don't expose internal error details
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // Memory API endpoints - proxy to circuit-memory MCP server

    // Helper to get circuit-memory server ID
    const getMemoryServerId = (): string | null => {
      for (const [serverId, server] of this.mcpManager.servers) {
        if (server.name === 'circuit-memory' && server.status === 'running') {
          return serverId;
        }
      }
      return null;
    };

    // List all memories
    this.app.get('/api/memory/list', async (req: Request, res: Response) => {
      try {
        console.log('[API] /api/memory/list - Starting request');
        const serverId = getMemoryServerId();
        console.log('[API] /api/memory/list - serverId:', serverId);
        if (!serverId) {
          console.log('[API] /api/memory/list - No serverId, returning 503');
          return res.status(503).json({ error: 'Memory service not available' });
        }

        const { type, priority, limit } = req.query;
        console.log('[API] /api/memory/list - About to call memory_get_all');

        const result = await this.mcpManager.callTool(serverId, 'memory_get_all', {
          type: type as string,
          priority: priority as string,
          limit: limit ? parseInt(limit as string) : 1000,
        });

        console.log('[API] /api/memory/list - Got result from memory_get_all');

        // Extract JSON from MCP response
        const jsonText = result.content?.[0]?.text || '[]';
        const memories = JSON.parse(jsonText);

        res.json({ success: true, memories });
      } catch (error: any) {
        console.error('[API] Error listing memories:', error);
        res.status(500).json({ error: 'Failed to list memories' });
      }
    });

    // Get memory statistics
    this.app.get('/api/memory/stats', async (req: Request, res: Response) => {
      try {
        console.log('[API] /api/memory/stats - Starting request');
        const serverId = getMemoryServerId();
        console.log('[API] /api/memory/stats - serverId:', serverId);
        if (!serverId) {
          console.log('[API] /api/memory/stats - No serverId, returning 503');
          return res.status(503).json({ error: 'Memory service not available' });
        }

        console.log('[API] /api/memory/stats - About to call memory_get_stats');
        const result = await this.mcpManager.callTool(serverId, 'memory_get_stats', {});

        console.log('[API] /api/memory/stats - Got result from memory_get_stats');

        // Extract JSON from MCP response
        const jsonText = result.content?.[0]?.text || '{}';
        const stats = JSON.parse(jsonText);

        res.json({ success: true, stats });
      } catch (error: any) {
        console.error('[API] Error getting memory stats:', error);
        res.status(500).json({ error: 'Failed to get memory stats' });
      }
    });

    // Store a new memory
    this.app.post('/api/memory', async (req: Request, res: Response) => {
      try {
        const serverId = getMemoryServerId();
        if (!serverId) {
          return res.status(503).json({ error: 'Memory service not available' });
        }

        const { key, value, type, priority, metadata } = req.body;

        // SECURITY: Input validation
        if (!key || typeof key !== 'string') {
          return res.status(400).json({ error: 'key is required and must be a string' });
        }
        if (!value || typeof value !== 'string') {
          return res.status(400).json({ error: 'value is required and must be a string' });
        }
        if (!type || !['convention', 'decision', 'snippet', 'rule', 'note'].includes(type)) {
          return res.status(400).json({ error: 'type must be one of: convention, decision, snippet, rule, note' });
        }

        const result = await this.mcpManager.callTool(serverId, 'memory_store', {
          key,
          value,
          type,
          priority: priority || 'medium',
          metadata: metadata || undefined,
        });

        res.json({ success: true, data: result.content?.[0]?.text, rawResult: result });
      } catch (error: any) {
        console.error('[API] Error storing memory:', error);
        res.status(500).json({ error: 'Failed to store memory' });
      }
    });

    // Search/retrieve memories
    this.app.get('/api/memory/search', async (req: Request, res: Response) => {
      try {
        const serverId = getMemoryServerId();
        if (!serverId) {
          return res.status(503).json({ error: 'Memory service not available' });
        }

        const { type, key, searchQuery, limit } = req.query;

        const result = await this.mcpManager.callTool(serverId, 'memory_retrieve', {
          type: type as string,
          key: key as string,
          searchQuery: searchQuery as string,
          limit: limit ? parseInt(limit as string) : 20,
        });

        res.json({ success: true, data: result.content?.[0]?.text, rawResult: result });
      } catch (error: any) {
        console.error('[API] Error searching memories:', error);
        res.status(500).json({ error: 'Failed to search memories' });
      }
    });

    // Delete a memory
    this.app.delete('/api/memory/:key', async (req: Request, res: Response) => {
      try {
        const serverId = getMemoryServerId();
        if (!serverId) {
          return res.status(503).json({ error: 'Memory service not available' });
        }

        const { key } = req.params;

        if (!key) {
          return res.status(400).json({ error: 'key is required' });
        }

        const result = await this.mcpManager.callTool(serverId, 'memory_forget', { key });

        res.json({ success: true, data: result.content?.[0]?.text, rawResult: result });
      } catch (error: any) {
        console.error('[API] Error deleting memory:', error);
        res.status(500).json({ error: 'Failed to delete memory' });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        console.log(`[Octave API] Server listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
