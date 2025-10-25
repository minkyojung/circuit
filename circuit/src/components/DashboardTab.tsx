/**
 * Dashboard: Unified view of all workflows (System + MCP)
 */

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Sparkles, Play, Loader2, Wand2, Check, CheckCircle, AlertCircle,
  FileEdit, Rocket, GitBranch, Activity, Server, Lightbulb, Plus,
  ExternalLink, Square
} from 'lucide-react'
import { WorkflowCard } from '@/components/workflow/WorkflowCard'
import { QuickStatusBar, type QuickStatus } from '@/components/workflow/QuickStatusBar'
import { ActionBar, ContentTimeline, DetailPanel, type TimelineEvent, type DetailSection } from '@/components/workflow'
import { detectProjectType, type DetectionResult } from '@/core/detector'
import { type FileChangeEvent } from '@/core/watcher'
import { type TestResult } from '@/core/test-runner'
import { parseAiFix, type ParsedFix } from '@/core/claude-cli'
import { mcpClient, BUILTIN_SERVERS } from '@/lib/mcp-client'
import type { MCPServerConfig, Tool } from '@/types/mcp'
import { useProjectPath } from '@/App'

// Electron IPC
declare global {
  interface Window {
    require: any
  }
}

const { ipcRenderer } = window.require('electron')

// MCP Server State
interface MCPServerState {
  id: string
  name: string
  status: 'stopped' | 'starting' | 'running' | 'error'
  tools: Tool[]
  prompts: any[]
  resources: any[]
  error?: string
}

// Detected local app
interface DetectedApp {
  name: string
  configPath: string
  servers: MCPServerConfig[]
}

// Recommended workflow
interface RecommendedWorkflow {
  id: string
  title: string
  description: string
  mcpServers: string[]
  icon: React.ReactNode
}

export function DashboardTab() {
  // Get project path from context
  const { projectPath, isLoading: isLoadingPath } = useProjectPath()

  // Project detection
  const [detection, setDetection] = useState<DetectionResult | null>(null)

  // Test-Fix states
  const [isInitializing, setIsInitializing] = useState(false)
  const [isWatching, setIsWatching] = useState(false)
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [isGettingFix, setIsGettingFix] = useState(false)
  const [isApplyingFix, setIsApplyingFix] = useState(false)
  const [fileChanges, setFileChanges] = useState<FileChangeEvent[]>([])
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [aiFix, setAiFix] = useState<string | null>(null)
  const [parsedFix, setParsedFix] = useState<ParsedFix | null>(null)

  // MCP Server states
  const [mcpServers, setMcpServers] = useState<Map<string, MCPServerState>>(new Map())

  // Detected local apps & recommendations
  const [detectedApps, setDetectedApps] = useState<DetectedApp[]>([])
  const [recommendations, setRecommendations] = useState<RecommendedWorkflow[]>([])

  // Auto-detect on mount (when project path is loaded)
  useEffect(() => {
    if (projectPath && !isLoadingPath) {
      handleDetect()
      detectLocalApps()
    }
    initializeMCPServers()
  }, [projectPath, isLoadingPath])

  // Initialize MCP servers tracking
  const initializeMCPServers = () => {
    const initialServers = new Map<string, MCPServerState>()
    BUILTIN_SERVERS.forEach(config => {
      initialServers.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'stopped',
        tools: [],
        prompts: [],
        resources: []
      })
    })
    setMcpServers(initialServers)
  }

  // Listen to MCP events
  useEffect(() => {
    const removeListener = mcpClient.addEventListener((event) => {
      const serverId = event.serverId
      if (!serverId) return

      setMcpServers(prev => {
        const newServers = new Map(prev)
        const server = newServers.get(serverId)
        if (!server) return prev

        switch (event.type) {
          case 'initialized':
            server.status = 'running'
            // Auto-fetch capabilities
            fetchServerCapabilities(serverId)
            break

          case 'status':
            server.status = event.status
            if (event.status === 'stopped') {
              server.tools = []
              server.prompts = []
              server.resources = []
              server.error = undefined
            }
            break

          case 'error':
            server.status = 'error'
            server.error = event.error
            break
        }

        newServers.set(serverId, { ...server })
        return newServers
      })
    })

    return removeListener
  }, [])

  // Fetch server capabilities (tools, prompts, resources)
  const fetchServerCapabilities = async (serverId: string) => {
    try {
      const [tools, prompts, resources] = await Promise.all([
        mcpClient.listTools(serverId),
        mcpClient.listPrompts(serverId),
        mcpClient.listResources(serverId)
      ])

      setMcpServers(prev => {
        const newServers = new Map(prev)
        const server = newServers.get(serverId)
        if (server) {
          server.tools = tools || []
          server.prompts = prompts || []
          server.resources = resources || []
          newServers.set(serverId, { ...server })
        }
        return newServers
      })
    } catch (error) {
      console.error(`Failed to fetch capabilities for ${serverId}:`, error)
    }
  }

  // Detect local apps with MCP configs
  const detectLocalApps = async () => {
    try {
      // Known config paths
      const configPaths = [
        {
          name: 'Claude Desktop',
          path: '~/Library/Application Support/Claude/claude_desktop_config.json'
        },
        {
          name: 'Cursor',
          path: '~/.cursor/mcp_config.json'
        },
        {
          name: 'Windsurf',
          path: '~/.codeium/windsurf/mcp_config.json'
        }
      ]

      const detected: DetectedApp[] = []

      // Check each path (would need IPC handler in electron/main.cjs)
      for (const { name, path } of configPaths) {
        try {
          const result = await ipcRenderer.invoke('circuit:read-mcp-config', path)
          if (result.success && result.servers) {
            detected.push({
              name,
              configPath: path,
              servers: result.servers
            })
          }
        } catch (error) {
          // App not installed or config not found
          console.log(`${name} not detected`)
        }
      }

      setDetectedApps(detected)
      generateRecommendations(detected)
    } catch (error) {
      console.error('Failed to detect local apps:', error)
    }
  }

  // Generate workflow recommendations based on detected apps
  const generateRecommendations = (apps: DetectedApp[]) => {
    const recs: RecommendedWorkflow[] = []

    // Collect all detected MCP servers
    const allMCPs = new Set<string>()
    apps.forEach(app => {
      app.servers.forEach(server => allMCPs.add(server.id))
    })

    // GitHub-based recommendations
    if (allMCPs.has('github') || allMCPs.has('@modelcontextprotocol/server-github')) {
      recs.push({
        id: 'pr-monitor',
        title: 'PR Monitor',
        description: 'Track pull requests and get notifications',
        mcpServers: ['github'],
        icon: <GitBranch className="h-4 w-4" />
      })
    }

    // Slack-based recommendations
    if (allMCPs.has('slack') || allMCPs.has('@modelcontextprotocol/server-slack')) {
      recs.push({
        id: 'deploy-notify',
        title: 'Deploy & Notify',
        description: 'Auto-notify Slack after successful deployment',
        mcpServers: ['deployments', 'slack'],
        icon: <Rocket className="h-4 w-4" />
      })
    }

    // Notion-based recommendations
    if (allMCPs.has('notion') || allMCPs.has('@modelcontextprotocol/server-notion')) {
      recs.push({
        id: 'issue-tracker',
        title: 'Issue Tracker Sync',
        description: 'Sync GitHub issues to Notion database',
        mcpServers: ['github', 'notion'],
        icon: <Activity className="h-4 w-4" />
      })
    }

    // Always show "CI/CD Pipeline" if Test-Fix is available
    recs.push({
      id: 'ci-cd-pipeline',
      title: 'CI/CD Pipeline',
      description: 'Test → Build → Deploy → Notify workflow',
      mcpServers: ['test-fix', 'deployments', 'slack'],
      icon: <Sparkles className="h-4 w-4" />
    })

    setRecommendations(recs)
  }

  // File change listener
  useEffect(() => {
    const handleFileChange = (_event: any, changeEvent: FileChangeEvent) => {
      setFileChanges(prev => [changeEvent, ...prev].slice(0, 20))
    }

    ipcRenderer.on('circuit:file-changed', handleFileChange)
    return () => {
      ipcRenderer.removeListener('circuit:file-changed', handleFileChange)
    }
  }, [])

  // Peek panel listener
  useEffect(() => {
    const handlePeekData = (_event: any, payload: any) => {
      if (payload.type === 'test-result' && payload.data) {
        const testData = payload.data
        const result: TestResult = {
          success: testData.status === 'success',
          passed: testData.passed || 0,
          failed: testData.failed || 0,
          total: testData.total || 0,
          duration: testData.duration || 0,
          output: '',
          errors: testData.errors || []
        }
        setTestResult(result)
      }
    }

    ipcRenderer.on('peek:data-opened', handlePeekData)
    return () => {
      ipcRenderer.removeListener('peek:data-opened', handlePeekData)
    }
  }, [])

  const handleDetect = async () => {
    try {
      const result = await ipcRenderer.invoke('circuit:detect-project', projectPath)
      if (result.success) {
        setDetection(detectProjectType(result.packageJson))
      } else {
        setDetection({ type: 'unknown', confidence: 0, reasons: [`Error: ${result.error}`] })
      }
    } catch (error) {
      setDetection({ type: 'unknown', confidence: 0, reasons: ['Detection failed'] })
    }
  }

  const handleInitialize = async () => {
    setIsInitializing(true)
    try {
      const strategy = detection?.type && detection.type !== 'unknown' ? detection.type : 'react'
      await ipcRenderer.invoke('circuit:init', projectPath, strategy)
      await handleToggleWatch()
    } finally {
      setIsInitializing(false)
    }
  }

  const handleToggleWatch = async () => {
    if (isWatching) {
      await ipcRenderer.invoke('circuit:watch-stop', projectPath)
      setIsWatching(false)
      setFileChanges([])
    } else {
      await ipcRenderer.invoke('circuit:watch-start', projectPath)
      setIsWatching(true)
    }
  }

  const handleRunTest = async () => {
    setIsRunningTest(true)
    setTestResult(null)
    setAiFix(null)
    setParsedFix(null)

    try {
      const result = await ipcRenderer.invoke('circuit:run-test', projectPath)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0,
        output: '',
        errors: [String(error)]
      })
    } finally {
      setIsRunningTest(false)
    }
  }

  const handleGetAiFix = async () => {
    if (!testResult || testResult.success) return

    setIsGettingFix(true)
    setAiFix(null)
    setParsedFix(null)

    try {
      const fs = window.require('fs')
      const testFilePath = `${projectPath}/test.js`
      let testCode = ''

      try {
        testCode = fs.readFileSync(testFilePath, 'utf-8')
      } catch {}

      const result = await ipcRenderer.invoke('circuit:get-ai-fix', {
        testError: testResult.errors.join('\n') || testResult.output,
        testCode,
        projectType: detection?.type || 'unknown',
        testFilePath
      })

      if (result.success) {
        setAiFix(result.fix)
        const parsed = parseAiFix(result.fix)
        if (parsed) setParsedFix(parsed)
      } else {
        setAiFix(`Error: ${result.error}`)
      }
    } catch (error) {
      setAiFix(`Error: ${String(error)}`)
    } finally {
      setIsGettingFix(false)
    }
  }

  const handleApplyFix = async () => {
    if (!parsedFix) return

    setIsApplyingFix(true)
    try {
      const result = await ipcRenderer.invoke('circuit:apply-fix', {
        filePath: `${projectPath}/test.js`,
        fixedCode: parsedFix.fixedCode
      })

      if (result.success) {
        await handleRunTest()
      }
    } finally {
      setIsApplyingFix(false)
    }
  }

  // Start/Stop MCP server
  const handleToggleMCPServer = async (serverId: string) => {
    const server = mcpServers.get(serverId)
    if (!server) return

    const config = BUILTIN_SERVERS.find(s => s.id === serverId)
    if (!config) return

    if (server.status === 'running') {
      await mcpClient.stopServer(serverId)
    } else {
      await mcpClient.startServer(config)
    }
  }

  // Quick status bar
  const activeServersCount = Array.from(mcpServers.values()).filter(s => s.status === 'running').length
  const totalServersCount = mcpServers.size

  const quickStatuses: QuickStatus[] = [
    {
      label: testResult
        ? testResult.success
          ? 'Tests Passing'
          : 'Tests Failing'
        : 'No Tests',
      icon: testResult?.success ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />,
      color: testResult?.success ? 'success' : testResult ? 'error' : 'default'
    },
    {
      label: 'Deploy Ready',
      icon: <Rocket className="h-3.5 w-3.5" />,
      color: 'success'
    },
    {
      label: `${activeServersCount}/${totalServersCount} MCP Active`,
      icon: <Server className="h-3.5 w-3.5" />,
      color: activeServersCount > 0 ? 'success' : 'default'
    }
  ]

  // Test-Fix timeline
  const testFixTimeline: TimelineEvent[] = fileChanges.map(change => ({
    title: change.path.split('/').pop() || change.path,
    description: change.type,
    timestamp: new Date(change.timestamp).toLocaleTimeString(),
    icon: <FileEdit className="h-3.5 w-3.5 text-[var(--text-secondary)]" />,
    color: 'default' as const
  }))

  // Test-Fix detail sections
  const testFixDetails: DetailSection[] = []

  if (testResult && !testResult.success && testResult.errors.length > 0) {
    testFixDetails.push({
      title: 'Test Errors',
      color: 'error',
      defaultExpanded: true,
      content: (
        <div className="font-mono text-xs bg-[var(--glass-bg)] p-3 rounded max-h-60 overflow-y-auto">
          {testResult.errors.map((error, i) => (
            <div key={i} className="text-[var(--circuit-error)] mb-2">{error}</div>
          ))}
        </div>
      )
    })
  }

  if (aiFix) {
    testFixDetails.push({
      title: 'AI Fix Suggestion',
      color: 'warning',
      defaultExpanded: true,
      content: (
        <div className="space-y-3">
          <div className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap max-h-60 overflow-y-auto">
            {aiFix}
          </div>
          {parsedFix && (
            <Button
              onClick={handleApplyFix}
              disabled={isApplyingFix}
              size="sm"
              className="gap-2"
            >
              {isApplyingFix ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Apply Fix & Re-test
                </>
              )}
            </Button>
          )}
        </div>
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          All your workflows at a glance
        </p>
      </div>

      {/* Quick Status Bar */}
      <QuickStatusBar statuses={quickStatuses} />

      {/* Recommended Workflows */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-[var(--circuit-orange)]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">
              Recommended Workflows
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              Based on your installed apps
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {recommendations.map(rec => (
              <button
                key={rec.id}
                className="glass-card p-3 rounded-lg border border-[var(--glass-border)] hover:border-[var(--circuit-orange)] hover:bg-[var(--glass-hover)] transition-all text-left group"
              >
                <div className="flex items-start gap-2 mb-2">
                  <div className="p-1.5 rounded bg-[var(--glass-bg)] text-[var(--circuit-orange)] group-hover:bg-[var(--circuit-orange)]/20 transition-colors">
                    {rec.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">
                      {rec.title}
                    </h3>
                    <p className="text-[10px] text-[var(--text-muted)] line-clamp-2">
                      {rec.description}
                    </p>
                  </div>
                  <Plus className="h-3 w-3 text-[var(--text-muted)] group-hover:text-[var(--circuit-orange)] transition-colors" />
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {rec.mcpServers.map(serverId => (
                    <span
                      key={serverId}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--glass-bg)] text-[var(--text-muted)]"
                    >
                      {serverId}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* System Workflows */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] px-1">
          System Workflows
        </h2>

        {/* Test-Fix */}
        <WorkflowCard
          title="Test-Fix"
          status={{
            label: testResult
              ? `${testResult.passed}/${testResult.total} passed`
              : isWatching
                ? 'Watching...'
                : 'Not initialized',
            icon: testResult?.success ? <CheckCircle className="h-3.5 w-3.5" /> : testResult ? <AlertCircle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />,
            color: testResult?.success ? 'success' : testResult ? 'error' : 'default'
          }}
          quickActions={
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {isWatching && (
                <Button
                  onClick={handleRunTest}
                  disabled={isRunningTest}
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs"
                >
                  {isRunningTest ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  Run
                </Button>
              )}
            </div>
          }
          autoExpand={testResult !== null && !testResult.success}
        >
          <ActionBar
            primary={
              <Button
                onClick={handleRunTest}
                disabled={isRunningTest || !isWatching}
                size="sm"
                className="gap-2"
              >
                {isRunningTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run Tests
                  </>
                )}
              </Button>
            }
            secondary={[
              <Button
                key="init"
                onClick={handleInitialize}
                disabled={isInitializing || isWatching}
                variant="outline"
                size="sm"
              >
                {isInitializing ? 'Initializing...' : 'Initialize'}
              </Button>,
              ...(testResult && !testResult.success ? [
                <Button
                  key="fix"
                  onClick={handleGetAiFix}
                  disabled={isGettingFix}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isGettingFix ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting Fix...
                    </>
                  ) : (
                    <>
                      <Wand2 className="h-4 w-4" />
                      Get AI Fix
                    </>
                  )}
                </Button>
              ] : [])
            ]}
          />

          {isWatching && testFixTimeline.length > 0 && (
            <ContentTimeline
              events={testFixTimeline}
              emptyMessage="Waiting for file changes..."
              maxHeight="max-h-48"
            />
          )}

          {testFixDetails.length > 0 && (
            <DetailPanel sections={testFixDetails} />
          )}
        </WorkflowCard>

        {/* Deployments */}
        <WorkflowCard
          title="Deployments"
          status={{
            label: 'Ready to deploy',
            icon: <Rocket className="h-3.5 w-3.5" />,
            color: 'success'
          }}
          quickActions={
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                console.log('Deploy')
              }}
            >
              <Rocket className="h-3 w-3" />
              Deploy
            </Button>
          }
        >
          <div className="text-xs text-[var(--text-muted)]">
            No recent deployments
          </div>
        </WorkflowCard>

        {/* GitHub */}
        <WorkflowCard
          title="GitHub"
          status={{
            label: '0 open PRs',
            icon: <GitBranch className="h-3.5 w-3.5" />,
            color: 'default'
          }}
        >
          <div className="text-xs text-[var(--text-muted)]">
            No pull requests
          </div>
        </WorkflowCard>
      </div>

      {/* MCP Workflows */}
      {mcpServers.size > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] px-1">
            MCP Workflows
          </h2>

          {Array.from(mcpServers.values()).map(server => (
            <WorkflowCard
              key={server.id}
              title={server.name}
              status={{
                label: server.status === 'running'
                  ? `${server.tools.length} tools available`
                  : server.status === 'error'
                    ? 'Error'
                    : 'Stopped',
                icon: <Server className="h-3.5 w-3.5" />,
                color: server.status === 'running' ? 'success' : server.status === 'error' ? 'error' : 'default'
              }}
              quickActions={
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleMCPServer(server.id)
                  }}
                >
                  {server.status === 'running' ? (
                    <>
                      <Square className="h-3 w-3" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Play className="h-3 w-3" />
                      Start
                    </>
                  )}
                </Button>
              }
            >
              {server.status === 'running' && (
                <div className="space-y-2">
                  {server.tools.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                        Tools ({server.tools.length})
                      </div>
                      <div className="space-y-1">
                        {server.tools.slice(0, 3).map(tool => (
                          <div
                            key={tool.name}
                            className="text-xs bg-[var(--glass-bg)] px-2 py-1.5 rounded flex items-start gap-2"
                          >
                            <code className="text-[var(--circuit-orange)] font-mono flex-shrink-0">
                              {tool.name}
                            </code>
                            {tool.description && (
                              <span className="text-[var(--text-muted)] text-[10px] line-clamp-1">
                                {tool.description}
                              </span>
                            )}
                          </div>
                        ))}
                        {server.tools.length > 3 && (
                          <div className="text-[10px] text-[var(--text-muted)] px-2">
                            +{server.tools.length - 3} more tools
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {server.error && (
                    <div className="text-xs text-[var(--circuit-error)] bg-[var(--glass-bg)] p-2 rounded">
                      {server.error}
                    </div>
                  )}
                </div>
              )}

              {server.status === 'stopped' && (
                <div className="text-xs text-[var(--text-muted)]">
                  Click Start to activate this MCP server
                </div>
              )}

              {server.status === 'error' && server.error && (
                <div className="text-xs text-[var(--circuit-error)] bg-[var(--glass-bg)] p-2 rounded">
                  {server.error}
                </div>
              )}
            </WorkflowCard>
          ))}
        </div>
      )}

      {/* Detected Apps Info */}
      {detectedApps.length > 0 && (
        <div className="glass-card p-3 rounded-lg border border-[var(--glass-border)]">
          <div className="flex items-center gap-2 mb-2">
            <ExternalLink className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              Detected Apps
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {detectedApps.map(app => (
              <div
                key={app.name}
                className="text-[10px] px-2 py-1 rounded bg-[var(--glass-bg)] text-[var(--text-muted)]"
              >
                {app.name} ({app.servers.length} MCPs)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
