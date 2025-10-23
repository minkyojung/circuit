/**
 * Dashboard: Unified view of all workflows
 */

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import {
  Sparkles, Play, Loader2, Wand2, Check, CheckCircle, AlertCircle,
  FileEdit, Rocket, GitBranch, Activity
} from 'lucide-react'
import { WorkflowCard } from '@/components/workflow/WorkflowCard'
import { QuickStatusBar, type QuickStatus } from '@/components/workflow/QuickStatusBar'
import { ActionBar, ContentTimeline, DetailPanel, type TimelineEvent, type DetailSection } from '@/components/workflow'
import { detectProjectType, getProjectTypeName, type DetectionResult } from '@/core/detector'
import { type FileChangeEvent } from '@/core/watcher'
import { type TestResult } from '@/core/test-runner'
import { parseAiFix, type ParsedFix } from '@/core/claude-cli'

// Electron IPC
declare global {
  interface Window {
    require: any
  }
}

const { ipcRenderer } = window.require('electron')

export function DashboardTab() {
  // Project detection
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

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

  const projectPath = '' // TODO: Get from context

  // Auto-detect on mount
  useEffect(() => {
    handleDetect()
  }, [])

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
    setIsDetecting(true)
    try {
      const result = await ipcRenderer.invoke('circuit:detect-project', projectPath)
      if (result.success) {
        setDetection(detectProjectType(result.packageJson))
      } else {
        setDetection({ type: 'unknown', confidence: 0, reasons: [`Error: ${result.error}`] })
      }
    } catch (error) {
      setDetection({ type: 'unknown', confidence: 0, reasons: ['Detection failed'] })
    } finally {
      setIsDetecting(false)
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

  // Quick status bar
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
      label: '0 PRs',
      icon: <GitBranch className="h-3.5 w-3.5" />,
      color: 'default'
    }
  ]

  // Test-Fix timeline
  const testFixTimeline: TimelineEvent[] = fileChanges.map(change => ({
    title: change.path.split('/').pop() || change.path,
    description: change.eventType,
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
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          All your workflows at a glance
        </p>
      </div>

      {/* Quick Status Bar */}
      <QuickStatusBar statuses={quickStatuses} />

      {/* Workflow Cards */}
      <div className="space-y-3">
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

        {/* Activity Feed */}
        <WorkflowCard
          title="Activity"
          status={{
            label: `${fileChanges.length} recent events`,
            icon: <Activity className="h-3.5 w-3.5" />,
            color: fileChanges.length > 0 ? 'warning' : 'default'
          }}
          defaultExpanded={fileChanges.length > 0}
        >
          {fileChanges.length > 0 ? (
            <ContentTimeline
              events={testFixTimeline}
              emptyMessage="No recent activity"
              maxHeight="max-h-60"
            />
          ) : (
            <div className="text-xs text-[var(--text-muted)]">
              No recent activity
            </div>
          )}
        </WorkflowCard>
      </div>
    </div>
  )
}
