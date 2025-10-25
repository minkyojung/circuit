import express, { Request, Response } from 'express';
import cors from 'cors';
import type { MCPServerManager } from './mcp-manager';

export class CircuitAPIServer {
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
    this.app.use(cors());
    this.app.use(express.json());
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
            console.error(`Error getting tools for ${serverId}:`, error);
          }
        }

        res.json({ tools: allTools });
      } catch (error: any) {
        console.error('Error listing tools:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Call a tool (proxy to actual server)
    this.app.post('/mcp/call', async (req: Request, res: Response) => {
      try {
        const { toolName, arguments: args, serverId } = req.body;

        if (!toolName) {
          return res.status(400).json({ error: 'toolName is required' });
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
          return res.status(404).json({ error: `Tool '${toolName}' not found` });
        }

        const result = await this.mcpManager.callTool(targetServerId, toolName, args || {});
        res.json(result);
      } catch (error: any) {
        console.error('Error calling tool:', error);
        res.status(500).json({ error: error.message });
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
            error: server.error,
          };
        }

        res.json(statuses);
      } catch (error: any) {
        console.error('Error getting status:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get logs for a specific server
    this.app.get('/mcp/logs/:serverId', async (req: Request, res: Response) => {
      try {
        const { serverId } = req.params;
        const lines = parseInt(req.query.lines as string) || 100;

        const logs = await this.mcpManager.getLogs(serverId, lines);
        res.json({ logs });
      } catch (error: any) {
        console.error('Error getting logs:', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[Circuit API] Server listening on http://localhost:${this.port}`);
        resolve();
      });
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            console.log('[Circuit API] Server stopped');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}
