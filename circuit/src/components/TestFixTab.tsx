/**
 * Phase 1: Test-Fix Loop Tab
 *
 * Step 2: 실제 .circuit/ 폴더 생성
 */

import { useState } from 'react'
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Rocket, CheckCircle, AlertCircle } from 'lucide-react'

// Electron IPC
const { ipcRenderer } = window.require('electron')

export function TestFixTab() {
  const [isInitializing, setIsInitializing] = useState(false)
  const [initResult, setInitResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null)

  const handleInitialize = async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 Initialize clicked!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    setIsInitializing(true)
    setInitResult(null)

    try {
      // TODO: Get actual project path (for now, use a test path)
      const projectPath = '/Users/williamjung/test-project'

      console.log('[Circuit] Calling circuit:init with path:', projectPath)

      const result = await ipcRenderer.invoke('circuit:init', projectPath)

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

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test-Fix Loop</h1>
        <p className="text-muted-foreground">
          AI 기반 자동 테스트 & 수정 제안 시스템
        </p>
      </div>

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
              </p>

              <Button
                onClick={handleInitialize}
                disabled={isInitializing}
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
              💡 Phase 1 - Step 2: 폴더 생성 테스트
              <br />
              버튼 클릭 시 /Users/williamjung/test-project/.circuit/ 폴더가 생성됩니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
