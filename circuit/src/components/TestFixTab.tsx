/**
 * Test-Fix Loop: Redesigned with workflow components
 */

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Sparkles, Play, Loader2, Wand2, Check, CheckCircle, AlertCircle, FileEdit } from 'lucide-react'
import { StatusBar, ActionBar, ContentTimeline, DetailPanel, type StatusItem, type TimelineEvent, type DetailSection } from '@/components/workflow'
import { detectProjectType, getProjectTypeName, type DetectionResult } from '@/core/detector'
import { type FileChangeEvent } from '@/core/watcher'
import { type TestResult } from '@/core/test-runner'
import { parseAiFix, type ParsedFix } from '@/core/claude-cli'
import { useProjectPath } from '@/App'

// Electron IPC
declare global {
  interface Window {
    require: any
  }
}

const { ipcRenderer } = window.require('electron')

export function TestFixTab() {
  // Get project path from context
  const { projectPath, isLoading: isLoadingPath } = useProjectPath()

  // Project detection
  const [detection, setDetection] = useState<DetectionResult | null>(null)

  // Workflow states
  const [isInitializing, setIsInitializing] = useState(false)
  const [isWatching, setIsWatching] = useState(false)
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [isGettingFix, setIsGettingFix] = useState(false)
  const [isApplyingFix, setIsApplyingFix] = useState(false)

  // Data
  const [fileChanges, setFileChanges] = useState<FileChangeEvent[]>([])
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [aiFix, setAiFix] = useState<string | null>(null)
  const [parsedFix, setParsedFix] = useState<ParsedFix | null>(null)

  // Auto-detect on mount (when project path is loaded)
  useEffect(() => {
    if (projectPath && !isLoadingPath) {
      handleDetect()
    }
  }, [projectPath, isLoadingPath])

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
      await handleToggleWatch() // Auto-start watching
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

  // Build status bar items
  const statusItems: StatusItem[] = [
    {
      label: 'Project',
      value: detection ? getProjectTypeName(detection.type) : 'Detecting...',
      icon: <Sparkles className="h-4 w-4" />,
      color: detection?.type !== 'unknown' ? 'success' : 'default'
    },
    ...(testResult ? [{
      label: 'Tests',
      value: `${testResult.passed}/${testResult.total}`,
      icon: testResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />,
      color: testResult.success ? 'success' as const : 'error' as const
    }] : []),
    {
      label: 'Watching',
      value: isWatching ? 'Active' : 'Inactive',
      color: isWatching ? 'success' : 'default'
    }
  ]

  // Build timeline events
  const timelineEvents: TimelineEvent[] = fileChanges.map(change => ({
    title: change.path.split('/').pop() || change.path,
    description: change.type,
    timestamp: new Date(change.timestamp).toLocaleTimeString(),
    icon: <FileEdit className="h-3.5 w-3.5 text-[var(--text-secondary)]" />,
    color: 'default' as const
  }))

  // Build detail sections
  const detailSections: DetailSection[] = []

  if (testResult && !testResult.success && testResult.errors.length > 0) {
    detailSections.push({
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
    detailSections.push({
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
        <h1 className="text-2xl font-bold mb-1 text-[var(--text-primary)]">Test-Fix Loop</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          AI-powered automated testing and fix suggestions
        </p>
        {isLoadingPath && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Loading project path...
          </p>
        )}
        {!isLoadingPath && projectPath && (
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Project: {projectPath}
          </p>
        )}
      </div>

      {/* Status */}
      <StatusBar items={statusItems} />

      {/* Actions */}
      <ActionBar
        primary={
          <Button
            onClick={handleRunTest}
            disabled={isRunningTest || !isWatching}
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
            className="gap-2"
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

      {/* File Changes Timeline */}
      {isWatching && (
        <ContentTimeline
          events={timelineEvents}
          emptyMessage="Waiting for file changes..."
        />
      )}

      {/* Details (Errors, AI Fix) */}
      {detailSections.length > 0 && (
        <DetailPanel sections={detailSections} />
      )}
    </div>
  )
}
