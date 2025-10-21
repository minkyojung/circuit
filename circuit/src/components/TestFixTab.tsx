/**
 * Phase 3: Test-Fix Loop Tab with File Change Detection
 */

import { useState, useEffect } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Rocket, CheckCircle, AlertCircle, Sparkles, Eye, EyeOff } from 'lucide-react'
import { detectProjectType, getProjectTypeName, getConfidenceMessage, type DetectionResult, type ProjectType } from '@/core/detector'
import { formatEvent, type FileChangeEvent } from '@/core/watcher'

// Electron IPC
const { ipcRenderer } = window.require('electron')

export function TestFixTab() {
  const [isDetecting, setIsDetecting] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initResult, setInitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  // Phase 3: File watching
  const [isWatching, setIsWatching] = useState(false)
  const [fileChanges, setFileChanges] = useState<FileChangeEvent[]>([])

  // Phase 2: Auto-detect on mount
  useEffect(() => {
    handleDetect()
  }, [])

  // Phase 3: Set up file change listener
  useEffect(() => {
    const handleFileChange = (_event: any, changeEvent: FileChangeEvent) => {
      console.log('[Circuit] File change received:', changeEvent)
      setFileChanges(prev => [changeEvent, ...prev].slice(0, 10)) // Keep last 10
    }

    ipcRenderer.on('circuit:file-changed', handleFileChange)

    return () => {
      ipcRenderer.removeListener('circuit:file-changed', handleFileChange)
    }
  }, [])

  const handleDetect = async () => {
    setIsDetecting(true)
    setDetection(null)

    try {
      // TODO: Get actual project path (for now, use a test path)
      const projectPath = '/Users/williamjung/test-project'

      console.log('[Circuit] Detecting project at:', projectPath)

      const result = await ipcRenderer.invoke('circuit:detect-project', projectPath)

      if (result.success) {
        const detected = detectProjectType(result.packageJson)
        console.log('[Circuit] Detection result:', detected)
        setDetection(detected)
      } else {
        setDetection({
          type: 'unknown',
          confidence: 0,
          reasons: [`❌ ${result.error}`]
        })
      }
    } catch (error) {
      console.error('[Circuit] Detection error:', error)
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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 Initialize clicked!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    setIsInitializing(true)
    setInitResult(null)

    try {
      // TODO: Get actual project path (for now, use a test path)
      const projectPath = '/Users/williamjung/test-project'

      // Use detected strategy (or default to 'react')
      const strategy = detection?.type !== 'unknown' ? detection.type : 'react'

      console.log('[Circuit] Calling circuit:init with strategy:', strategy)

      const result = await ipcRenderer.invoke('circuit:init', projectPath, strategy)

      console.log('[Circuit] Init result:', result)

      setInitResult(result)
    } catch (error) {
      console.error('[Circuit] Init error:', error)
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
    const projectPath = '/Users/williamjung/test-project'

    if (isWatching) {
      // Stop watching
      const result = await ipcRenderer.invoke('circuit:watch-stop', projectPath)
      console.log('[Circuit] Watch stopped:', result)
      setIsWatching(false)
      setFileChanges([])
    } else {
      // Start watching
      const result = await ipcRenderer.invoke('circuit:watch-start', projectPath)
      console.log('[Circuit] Watch started:', result)
      setIsWatching(true)
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
                          Check <code className="bg-green-100 dark:bg-green-900 px-1 rounded">/Users/williamjung/test-project/.circuit/</code>
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
              💡 Phase 3: 파일 변경 감지 (로그만 출력)
              <br />
              chokidar로 실시간 파일 변경을 감지합니다. 아직 테스트는 실행하지 않습니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
