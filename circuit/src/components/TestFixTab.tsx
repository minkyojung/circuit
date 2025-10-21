/**
 * Phase 1: Test-Fix Loop Tab
 *
 * 초기 버전: "Initialize" 버튼만
 */

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Rocket } from 'lucide-react'

export function TestFixTab() {
  const handleInitialize = () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🚀 Initialize clicked!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // TODO: 실제 초기화 로직 (Step 2에서)
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
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                Initialize
              </Button>
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <p className="text-xs text-muted-foreground">
              💡 Phase 1 - Step 1: UI 테스트 중
              <br />
              버튼 클릭 시 콘솔에 로그가 출력됩니다.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
}
