/**
 * UpdateNotification Component
 *
 * Displays a banner when an app update is available.
 * Handles the update download and installation flow with progress feedback.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Download, RefreshCw, X, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UpdateState {
  checking: boolean
  available: boolean
  downloaded: boolean
  error: string | null
  progress: {
    percent: number
    transferred: number
    total: number
  } | null
  version: string | null
}

export function UpdateNotification() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    // Check if we're in Electron environment
    if (!window.electron?.updater) {
      return
    }

    // Get initial state
    window.electron.updater.getUpdateState().then((state) => {
      setUpdateState(state)
    })

    // Listen for update status changes
    const cleanup = window.electron.updater.onUpdateStatus((status: any) => {
      console.log('[UpdateNotification] Status:', status)

      setUpdateState(status.state)

      // Stop showing download spinner when download completes
      if (status.event === 'update-downloaded') {
        setIsDownloading(false)
      }

      // Stop showing download spinner on error
      if (status.event === 'update-error') {
        setIsDownloading(false)
      }
    })

    return cleanup
  }, [])

  const handleDownload = async () => {
    if (!window.electron?.updater) return

    setIsDownloading(true)
    const result = await window.electron.updater.downloadUpdate()

    if (result.error) {
      console.error('[UpdateNotification] Download failed:', result.error)
      setIsDownloading(false)
    }
  }

  const handleInstall = async () => {
    if (!window.electron?.updater) return

    await window.electron.updater.installUpdate()
    // App will restart automatically
  }

  const handleDismiss = () => {
    setIsDismissed(true)
  }

  // Don't show if dismissed or no update available
  if (isDismissed || !updateState?.available) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50',
        'bg-blue-600 text-white shadow-lg',
        'border-b border-blue-700'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Update message */}
          <div className="flex items-center gap-3 flex-1">
            {updateState.downloaded ? (
              <>
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    Update ready to install ({updateState.version})
                  </p>
                  <p className="text-xs text-blue-100">
                    Restart Octave to complete the update
                  </p>
                </div>
              </>
            ) : (
              <>
                <Download className="h-5 w-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    New version available ({updateState.version})
                  </p>
                  {isDownloading && updateState.progress ? (
                    <div className="mt-1 space-y-1">
                      <Progress
                        value={updateState.progress.percent}
                        className="h-1.5 bg-blue-700"
                      />
                      <p className="text-xs text-blue-100">
                        Downloading... {updateState.progress.percent}%
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-blue-100">
                      Download the latest version of Octave
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            {updateState.downloaded ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleInstall}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Restart to Update
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDownload}
                disabled={isDownloading}
                className="bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50"
              >
                {isDownloading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Download Update
                  </>
                )}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="text-white hover:bg-blue-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Error message */}
        {updateState.error && (
          <div className="mt-2 p-2 bg-red-600 rounded text-xs">
            Update error: {updateState.error}
          </div>
        )}
      </div>
    </div>
  )
}
