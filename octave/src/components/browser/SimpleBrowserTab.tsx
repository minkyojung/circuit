import { useEffect, useRef, useState } from 'react'
import { RefreshCw, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SimpleBrowserTabProps {
  browserId: string  // Unique ID for this browser instance
  url: string
  isActive?: boolean  // Whether this tab is currently active
  onUrlChange?: (url: string) => void
}

/**
 * SimpleBrowserTab - WebContentsView-based Browser Tab
 *
 * Uses Electron's WebContentsView for full browser functionality without iframe limitations.
 * - No X-Frame-Options restrictions
 * - Full website compatibility (Google, GitHub, etc.)
 * - Native browser performance
 */
export function SimpleBrowserTab({ browserId, url, isActive = true, onUrlChange }: SimpleBrowserTabProps) {
  const [inputUrl, setInputUrl] = useState(url)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const isInitialMount = useRef(true)

  // Effect 1: Browser lifecycle management (only depends on browserId)
  // Creates browser on mount, destroys on unmount or browserId change
  useEffect(() => {
    const ipcRenderer = (window as any).electron?.ipcRenderer

    if (!ipcRenderer) {
      console.error('[SimpleBrowserTab] IPC Renderer not available')
      setHasError(true)
      return
    }

    // Create browser view with initial URL
    const createBrowser = async () => {
      try {
        console.log(`[SimpleBrowserTab] Creating browser: ${browserId}`)
        const result = await ipcRenderer.invoke('browser:create', browserId, url)

        if (!result.success) {
          console.error('[SimpleBrowserTab] Failed to create browser:', result.error)
          setHasError(true)
          return
        }

        setIsLoading(false)
        console.log(`[SimpleBrowserTab] Browser created: ${browserId}`)

        // Update bounds after creation (with delay to ensure toolbar is rendered)
        setTimeout(() => updateBrowserBounds(), 100)
      } catch (error) {
        console.error('[SimpleBrowserTab] Error creating browser:', error)
        setHasError(true)
        setIsLoading(false)
      }
    }

    createBrowser()

    // Cleanup: destroy browser view when component unmounts or browserId changes
    return () => {
      console.log(`[SimpleBrowserTab] Destroying browser: ${browserId}`)
      ipcRenderer.invoke('browser:destroy', browserId).catch((err: any) => {
        console.error('[SimpleBrowserTab] Error destroying browser:', err)
      })
    }
  }, [browserId])  // ✅ Only recreate when browserId changes, not URL

  // Effect 2: URL navigation (when URL prop changes externally)
  // Skips initial mount since browser:create already loads the URL
  useEffect(() => {
    // Skip on initial mount - browser:create already loaded the initial URL
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer || !browserId) return

    // Navigate to new URL without recreating the browser
    const navigateToUrl = async () => {
      try {
        console.log(`[SimpleBrowserTab] Navigating browser ${browserId} to: ${url}`)
        setIsLoading(true)
        setHasError(false)

        const result = await ipcRenderer.invoke('browser:navigate', browserId, url)

        if (!result.success) {
          console.error('[SimpleBrowserTab] Navigation failed:', result.error)
          setHasError(true)
        } else {
          // Update input URL to match the navigated URL
          setInputUrl(url)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('[SimpleBrowserTab] Error navigating:', error)
        setHasError(true)
        setIsLoading(false)
      }
    }

    navigateToUrl()
  }, [url, browserId])  // ✅ Navigate when URL prop changes (without recreation)

  // Update browser bounds when container size changes
  const updateBrowserBounds = () => {
    if (!containerRef.current || !toolbarRef.current) return

    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer) return

    // Get container's bounds (SimpleBrowserTab div itself, NOT parent)
    const containerRect = containerRef.current.getBoundingClientRect()
    const toolbarRect = toolbarRef.current.getBoundingClientRect()

    // Calculate bounds: WebContentsView should fill the container BELOW the toolbar
    const bounds = {
      x: Math.round(containerRect.left),
      y: Math.round(toolbarRect.bottom), // Start after toolbar
      width: Math.round(containerRect.width),
      height: Math.round(containerRect.bottom - toolbarRect.bottom), // From toolbar bottom to container bottom
    }

    console.log(`[SimpleBrowserTab] Updating bounds for ${browserId}:`, {
      containerRect: {
        left: containerRect.left,
        top: containerRect.top,
        width: containerRect.width,
        height: containerRect.height,
        bottom: containerRect.bottom
      },
      toolbarRect: {
        top: toolbarRect.top,
        bottom: toolbarRect.bottom,
        height: toolbarRect.height
      },
      calculatedBounds: bounds
    })

    ipcRenderer.invoke('browser:set-bounds', browserId, bounds).catch((err: any) => {
      console.error('[SimpleBrowserTab] Error setting bounds:', err)
    })
  }

  // Set up ResizeObserver to track size changes
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      updateBrowserBounds()
    })

    resizeObserver.observe(containerRef.current)

    // Also update on window resize
    window.addEventListener('resize', updateBrowserBounds)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateBrowserBounds)
    }
  }, [browserId])

  // Handle show/hide based on isActive state
  useEffect(() => {
    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer) return

    if (isActive) {
      // Show browser and update bounds when activated
      ipcRenderer.invoke('browser:show', browserId).then((result: any) => {
        if (result.success) {
          console.log(`[SimpleBrowserTab] Browser ${browserId} shown`)
          // Update bounds when showing to ensure correct position
          setTimeout(() => updateBrowserBounds(), 100)
        }
      })
    } else {
      // Hide browser when deactivated
      ipcRenderer.invoke('browser:hide', browserId).then((result: any) => {
        if (result.success) {
          console.log(`[SimpleBrowserTab] Browser ${browserId} hidden`)
        }
      })
    }
  }, [isActive, browserId])

  // Handle navigation
  const handleNavigate = async () => {
    const ipcRenderer = (window as any).electron?.ipcRenderer
    if (!ipcRenderer) return

    try {
      setIsLoading(true)
      setHasError(false)

      const result = await ipcRenderer.invoke('browser:navigate', browserId, inputUrl)

      if (!result.success) {
        console.error('[SimpleBrowserTab] Navigation failed:', result.error)
        setHasError(true)
        setIsLoading(false)
        return
      }

      onUrlChange?.(inputUrl)
      setIsLoading(false)
    } catch (error) {
      console.error('[SimpleBrowserTab] Error navigating:', error)
      setHasError(true)
      setIsLoading(false)
    }
  }

  const handleRefresh = () => {
    handleNavigate()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate()
    }
  }

  const handleExternalOpen = () => {
    // Open in default browser
    if (typeof window !== 'undefined' && (window as any).require) {
      const { shell } = (window as any).require('electron')
      shell.openExternal(inputUrl)
    } else {
      window.open(inputUrl, '_blank')
    }
  }

  // Check if URL is HTTPS
  const isSecure = inputUrl.startsWith('https://')

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-white dark:bg-white">
      {/* Browser Toolbar - Minimalist Design */}
      <div
        ref={toolbarRef}
        className="flex items-center gap-3 px-4 py-2.5 relative"
        style={{ backgroundColor: '#f5f5f5', zIndex: 1000 }}
      >
        {/* URL Input Container - Full width with lock icon and refresh */}
        <div
          className="flex items-center gap-2 flex-1 px-3 py-1.5 rounded-lg transition-colors"
          style={{ backgroundColor: '#ffffff' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fafafa'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
        >
          {/* Lock Icon (for HTTPS) */}
          {isSecure && (
            <Lock
              size={14}
              className="flex-shrink-0"
              style={{ color: '#9ca3af' }}
            />
          )}

          {/* URL Input - SF Pro Regular */}
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm border-none focus:outline-none transition-colors bg-transparent"
            placeholder="Search or enter website name"
            style={{
              fontFamily: '-apple-system, "SF Pro", system-ui, sans-serif',
              fontWeight: 400,
              color: '#6b7280'
            }}
            onFocus={(e) => e.currentTarget.style.color = '#111827'}
            onBlur={(e) => e.currentTarget.style.color = '#6b7280'}
          />

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1 rounded-md disabled:opacity-50 transition-colors flex-shrink-0"
            title="Refresh"
            style={{ color: '#9ca3af' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <RefreshCw
              size={16}
              className={cn(isLoading && 'animate-spin')}
            />
          </button>
        </div>
      </div>

      {/* Browser Content Area (WebContentsView will be positioned here) */}
      <div className="flex-1 relative bg-white" style={{ minHeight: '200px' }}>
        {/* Error State - Minimal */}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">Failed to load {inputUrl}</p>
              <button
                onClick={handleNavigate}
                className="px-4 py-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
