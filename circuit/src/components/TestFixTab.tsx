/**
 * Phase 6: Test-Fix Loop Tab with AI Fix Application
 */

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Rocket, CheckCircle, AlertCircle, Sparkles, Eye, EyeOff, Play, Loader2, Wand2, Check } from 'lucide-react'
import { detectProjectType, getProjectTypeName, getConfidenceMessage, type DetectionResult } from '@/core/detector'
import { formatEvent, type FileChangeEvent } from '@/core/watcher'
import { type TestResult } from '@/core/test-runner'
import { parseAiFix, type ParsedFix } from '@/core/claude-cli'

// Electron IPC
declare global {
  interface Window {
    require: any
  }
}

const { ipcRenderer } = window.require('electron')

export function TestFixTab() {
  const [projectPath, setProjectPath] = useState('')
  const [isDetecting, setIsDetecting] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initResult, setInitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Phase 3: File watching
  const [isWatching, setIsWatching] = useState(false)
  const [fileChanges, setFileChanges] = useState<FileChangeEvent[]>([])

  // Phase 4: Test execution
  const [isRunningTest, setIsRunningTest] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [autoTest, setAutoTest] = useState(false)

  // Phase 5-6: AI fix
  const [isGettingFix, setIsGettingFix] = useState(false)
  const [aiFix, setAiFix] = useState<string | null>(null)
  const [parsedFix, setParsedFix] = useState<ParsedFix | null>(null)
  const [isApplyingFix, setIsApplyingFix] = useState(false)

  // Phase 2: Auto-detect on mount
  useEffect(() => {
    handleDetect()
  }, [])

  // Phase 3: Set up file change listener
  useEffect(() => {
    const handleFileChange = (_event: any, changeEvent: FileChangeEvent) => {
      setFileChanges(prev => [changeEvent, ...prev].slice(0, 10)) // Keep last 10

      // Phase 4: Auto-run tests on file change
      if (autoTest && !isRunningTest) {
        handleRunTest()
      }
    }

    ipcRenderer.on('circuit:file-changed', handleFileChange)

    return () => {
      ipcRenderer.removeListener('circuit:file-changed', handleFileChange)
    }
  }, [autoTest, isRunningTest])

  // Listen for peek panel data (from "View Details" button)
  useEffect(() => {
    const handlePeekData = (_event: any, payload: any) => {
      console.log('[TestFixTab] peek:data-opened received:', payload)
      if (payload.type === 'test-result' && payload.data) {
        const testData = payload.data
        console.log('[TestFixTab] Converting test data:', testData)
        // Convert PeekData format to TestResult format
        const result: TestResult = {
          success: testData.status === 'success',
          passed: testData.passed || 0,
          failed: testData.failed || 0,
          total: testData.total || 0,
          duration: testData.duration || 0,
          output: '',
          errors: testData.errors || []
        }
        console.log('[TestFixTab] Setting test result:', result)
        setTestResult(result)
      }
    }

    ipcRenderer.on('peek:data-opened', handlePeekData)
    console.log('[TestFixTab] Registered peek:data-opened listener')

    return () => {
      ipcRenderer.removeListener('peek:data-opened', handlePeekData)
    }
  }, [])

  const handleDetect = async () => {
    setIsDetecting(true)
    setDetection(null)

    try {
      const result = await ipcRenderer.invoke('circuit:detect-project', projectPath)

      if (result.success) {
        const detected = detectProjectType(result.packageJson)
        setDetection(detected)
      } else {
        setDetection({
          type: 'unknown',
          confidence: 0,
          reasons: [`❌ ${result.error}`]
        })
      }
    } catch (error) {
      setDetection({
        type: 'unknown',
        confidence: 0,
        reasons: ['❌ 감지 실패']
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleInitialize = async () => {
    setIsInitializing(true)
    setInitResult(null)

    try {
      // Use detected strategy (or default to 'react')
      const strategy = detection?.type && detection.type !== 'unknown' ? detection.type : 'react'

      const result = await ipcRenderer.invoke('circuit:init', projectPath, strategy)

      setInitResult(result)
    } catch (error) {
      setInitResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      setIsInitializing(false)
    }
  }

  // Phase 3: Toggle file watching
  const handleToggleWatch = async () => {
    if (isWatching) {
      // Stop watching
      await ipcRenderer.invoke('circuit:watch-stop', projectPath)
      setIsWatching(false)
      setFileChanges([])
    } else {
      // Start watching
      await ipcRenderer.invoke('circuit:watch-start', projectPath)
      setIsWatching(true)
    }
  }

  // Phase 4: Run tests
  const handleRunTest = async () => {
    setIsRunningTest(true)
    setTestResult(null)

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

  // Phase 5-6: Get AI fix suggestion
  const handleGetAiFix = async () => {
    if (!testResult || testResult.success) return

    setIsGettingFix(true)
    setAiFix(null)
    setParsedFix(null)

    try {
      // Read test file content
      const testFilePath = `${projectPath}/test.js`
      const fs = window.require('fs')
      let testCode = ''

      try {
        testCode = fs.readFileSync(testFilePath, 'utf-8')
      } catch (readError) {
        // Could not read test file
      }

      const fixRequest = {
        testError: testResult.errors.join('\n') || testResult.output,
        testCode,
        projectType: detection?.type || 'unknown',
        testFilePath
      }

      const result = await ipcRenderer.invoke('circuit:get-ai-fix', fixRequest)

      if (result.success) {
        setAiFix(result.fix)

        // Phase 6: Parse the fix to extract code
        const parsed = parseAiFix(result.fix)
        if (parsed) {
          setParsedFix(parsed)
        }
      } else {
        setAiFix(`❌ Error: ${result.error}`)
      }
    } catch (error) {
      setAiFix(`❌ Error: ${String(error)}`)
    } finally {
      setIsGettingFix(false)
    }
  }

  // Phase 6: Apply AI fix to file
  const handleApplyFix = async () => {
    if (!parsedFix) return

    setIsApplyingFix(true)

    try {
      const testFilePath = `${projectPath}/test.js`

      const result = await ipcRenderer.invoke('circuit:apply-fix', {
        filePath: testFilePath,
        fixedCode: parsedFix.fixedCode
      })

      if (result.success) {
        // Auto-rerun tests after applying fix
        await handleRunTest()
      } else {
        alert(`Failed to apply fix: ${result.error}`)
      }
    } catch (error) {
      alert(`Error applying fix: ${String(error)}`)
    } finally {
      setIsApplyingFix(false)
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test-Fix Loop</h1>
        <p className="text-muted-foreground">
          AI 기반 자동 테스트 & 수정 제안 시스템
        </p>
      </div>

      {/* Project Path Input */}
      <Card className="p-4 border-border">
        <div className="space-y-2">
          <label className="text-sm font-medium">프로젝트 경로</label>
          <Input
            type="text"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            placeholder="/path/to/your/project"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            테스트할 프로젝트의 절대 경로를 입력하세요
          </p>
        </div>
      </Card>

      {/* Phase 2: Detection Result */}
      {detection && (
        <Card className="p-6 border-border bg-muted/30">
          <div className="flex items-start gap-4">
            <Sparkles className="h-6 w-6 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">프로젝트 타입 감지</h3>

              {detection.type !== 'unknown' ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">{getProjectTypeName(detection.type)}</span>
                    <span className="text-muted-foreground ml-2">
                      ({getConfidenceMessage(detection.confidence)} - {Math.round(detection.confidence * 100)}%)
                    </span>
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {detection.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    프로젝트 타입을 감지할 수 없습니다. 기본 React 전략을 사용합니다.
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {detection.reasons.map((reason, i) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleDetect}
                disabled={isDetecting}
                className="mt-3"
              >
                {isDetecting ? '감지 중...' : '다시 감지'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Initialize Card */}
      <Card className="p-6 border-border">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Rocket className="h-6 w-6 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">프로젝트 초기화</h3>
              <p className="text-sm text-muted-foreground mb-4">
                이 프로젝트에서 Test-Fix Loop을 활성화합니다.
                <br />
                <code className="text-xs bg-muted px-1 py-0.5 rounded">.circuit/</code> 폴더와 설정 파일이 생성됩니다.
                {detection && detection.type !== 'unknown' && (
                  <>
                    <br />
                    <span className="text-xs text-primary font-medium">
                      → {getProjectTypeName(detection.type)} 전략 사용
                    </span>
                  </>
                )}
              </p>

              <Button
                onClick={handleInitialize}
                disabled={isInitializing || isDetecting}
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                {isInitializing ? 'Initializing...' : 'Initialize'}
              </Button>

              {/* Result Display */}
              {initResult && (
                <div className={`mt-4 p-3 rounded-md flex items-start gap-2 ${
                  initResult.success ? 'bg-green-50 dark:bg-green-950' : 'bg-red-50 dark:bg-red-950'
                }`}>
                  {initResult.success ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-green-900 dark:text-green-100">
                          {initResult.message}
                        </p>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                          Check <code className="bg-green-100 dark:bg-green-900 px-1 rounded">{projectPath}/.circuit/</code>
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                          Initialization failed
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                          {initResult.error}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground">
              💡 Phase 2: 프로젝트 타입 자동 감지
              <br />
              package.json을 분석해서 React/Next.js/Node API를 자동으로 감지합니다.
            </p>
          </div>
        </div>
      </Card>

      {/* Phase 3: File Change Detection */}
      <Card className="p-6 border-border">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {isWatching ? (
              <Eye className="h-6 w-6 text-primary mt-1" />
            ) : (
              <EyeOff className="h-6 w-6 text-muted-foreground mt-1" />
            )}
            <div className="flex-1">
              <h3 className="font-semibold mb-2">파일 변경 감지</h3>
              <p className="text-sm text-muted-foreground mb-4">
                프로젝트의 파일 변경을 실시간으로 감지합니다.
                <br />
                <span className="text-xs">
                  (.ts, .tsx, .js, .jsx 파일만 감지, node_modules 제외)
                </span>
              </p>

              <Button
                onClick={handleToggleWatch}
                variant={isWatching ? "destructive" : "default"}
                className="gap-2"
              >
                {isWatching ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Stop Watching
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Start Watching
                  </>
                )}
              </Button>

              {/* File Changes Log */}
              {isWatching && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">변경 이력 (최근 10개)</h4>
                  {fileChanges.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      파일을 수정하면 여기에 표시됩니다...
                    </p>
                  ) : (
                    <div className="space-y-1 font-mono text-xs bg-muted p-3 rounded max-h-60 overflow-y-auto">
                      {fileChanges.map((change, i) => (
                        <div key={i} className="text-muted-foreground">
                          {formatEvent(change)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground">
              💡 Phase 3: 파일 변경 감지
              <br />
              chokidar로 실시간 파일 변경을 감지합니다.
            </p>
          </div>
        </div>
      </Card>

      {/* Phase 4: Test Execution */}
      <Card className="p-6 border-border">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <Play className="h-6 w-6 text-primary mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold mb-2">테스트 실행</h3>
              <p className="text-sm text-muted-foreground mb-4">
                프로젝트의 테스트를 실행하고 결과를 확인합니다.
                <br />
                <span className="text-xs">
                  (npm test 실행)
                </span>
              </p>

              <div className="flex gap-2 items-center mb-4">
                <Button
                  onClick={handleRunTest}
                  disabled={isRunningTest}
                  className="gap-2"
                >
                  {isRunningTest ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Tests
                    </>
                  )}
                </Button>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoTest}
                    onChange={(e) => setAutoTest(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-muted-foreground">Auto-run on file change</span>
                </label>
              </div>

              {/* Test Result Display */}
              {testResult && (
                <div className={`mt-4 p-4 rounded-md border ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-start gap-3">
                    {testResult.success ? (
                      <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        testResult.success
                          ? 'text-green-900 dark:text-green-100'
                          : 'text-red-900 dark:text-red-100'
                      }`}>
                        {testResult.success ? '✅ All Tests Passed' : '❌ Tests Failed'}
                      </p>
                      <p className={`text-xs mt-1 ${
                        testResult.success
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}>
                        {testResult.passed}/{testResult.total} tests passed
                        {testResult.duration > 0 && ` • ${(testResult.duration / 1000).toFixed(2)}s`}
                      </p>

                      {/* Error Messages */}
                      {testResult.errors && testResult.errors.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs font-medium text-red-900 dark:text-red-100">Errors:</p>
                          <div className="font-mono text-xs bg-red-100 dark:bg-red-900/50 p-2 rounded max-h-40 overflow-y-auto">
                            {testResult.errors.map((error, i) => (
                              <div key={i} className="text-red-800 dark:text-red-200">
                                {error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Phase 5: Get AI Fix Button */}
                      {!testResult.success && (
                        <div className="mt-3">
                          <Button
                            onClick={handleGetAiFix}
                            disabled={isGettingFix}
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            {isGettingFix ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Getting AI Fix...
                              </>
                            ) : (
                              <>
                                <Wand2 className="h-4 w-4" />
                                Get AI Fix
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phase 5-6: AI Fix Display */}
                  {aiFix && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                      <div className="flex items-start gap-2">
                        <Wand2 className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">
                            AI Fix Suggestion:
                          </p>
                          <div className="text-xs text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                            {aiFix}
                          </div>

                          {/* Phase 6: Apply Fix Button */}
                          {parsedFix && (
                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                              <Button
                                onClick={handleApplyFix}
                                disabled={isApplyingFix}
                                size="sm"
                                className="gap-2 bg-blue-600 hover:bg-blue-700"
                              >
                                {isApplyingFix ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Applying Fix...
                                  </>
                                ) : (
                                  <>
                                    <Check className="h-4 w-4" />
                                    Apply Fix & Re-test
                                  </>
                                )}
                              </Button>
                              <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                                This will update test.js and automatically re-run tests
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground">
              💡 Phase 6: Fully Automated Test-Fix Loop (Conductor-style)
              <br />
              테스트 실행 → 실패 시 "Get AI Fix" → AI 제안 확인 → "Apply Fix & Re-test" → 자동 수정 & 재테스트 → 완성! 🎉
              <br />
              <span className="text-primary font-medium">
                Requires: Claude Code installed at ~/.claude/local/claude
              </span>
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
