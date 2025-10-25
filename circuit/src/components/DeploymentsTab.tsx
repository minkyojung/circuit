import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Rocket, CheckCircle2, XCircle, Loader2, Copy, ExternalLink } from 'lucide-react'

export function DeploymentsTab() {
  const [isSending, setIsSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  const webhookUrl = 'http://localhost:3456/webhook/vercel'

  const sendTestWebhook = async (status: 'building' | 'success' | 'failed') => {
    setIsSending(true)
    setLastSent(null)

    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('deployments:send-test-webhook', status)

      if (result.success) {
        setLastSent(`${status.toUpperCase()} webhook sent successfully!`)
      } else {
        setLastSent(`Error: ${result.error}`)
      }
    } catch (error: any) {
      setLastSent(`Error: ${error.message}`)
    } finally {
      setIsSending(false)
      setTimeout(() => setLastSent(null), 3000)
    }
  }

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl)
    setLastSent('Webhook URL copied to clipboard!')
    setTimeout(() => setLastSent(null), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold mb-2 flex items-center gap-2">
          <Rocket className="h-6 w-6" />
          Deployments
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor and test Vercel deployment webhooks with the Peek Panel
        </p>
      </div>

      {/* Webhook Server Status */}
      <Card className="p-6 border-border bg-card">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold mb-1">Webhook Server</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Running on port 3456</span>
            </div>
            <div className="mt-3 font-mono text-xs bg-muted px-3 py-2 rounded border border-border">
              {webhookUrl}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={copyWebhookUrl}
            className="gap-2"
          >
            <Copy className="h-3 w-3" />
            Copy URL
          </Button>
        </div>
      </Card>

      {/* Test Webhooks */}
      <Card className="p-6 border-border bg-card">
        <h3 className="text-sm font-semibold mb-4">Test Webhooks</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Send test deployment events to see them appear in the Peek Panel
        </p>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => sendTestWebhook('building')}
            disabled={isSending}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Loader2 className="h-4 w-4" />
            )}
            Building
          </Button>

          <Button
            onClick={() => sendTestWebhook('success')}
            disabled={isSending}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            Success
          </Button>

          <Button
            onClick={() => sendTestWebhook('failed')}
            disabled={isSending}
            className="gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="h-4 w-4" />
            Failed
          </Button>
        </div>

        {lastSent && (
          <div className="mt-4 p-3 bg-muted rounded text-sm border border-border">
            {lastSent}
          </div>
        )}
      </Card>

      {/* Vercel Setup Guide */}
      <Card className="p-6 border-border bg-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          Connect Vercel Project
        </h3>

        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-2">1. Open your Vercel project settings</p>
            <p className="text-xs">Navigate to your project → Settings → Git</p>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">2. Add Deployment Webhook</p>
            <p className="text-xs mb-2">In the "Deploy Hooks" or "Webhooks" section, add:</p>
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded border border-border">
              {webhookUrl}
            </div>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">3. Configure webhook events</p>
            <p className="text-xs">Select the following events:</p>
            <ul className="list-disc list-inside text-xs mt-1 space-y-1 ml-2">
              <li>Deployment Created</li>
              <li>Deployment Ready</li>
              <li>Deployment Error</li>
            </ul>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-xs">
              <strong className="text-foreground">Note:</strong> Make sure your webhook server is accessible from the internet.
              For local development, use a tool like <code className="px-1 py-0.5 bg-muted rounded">ngrok</code> to expose port 3456.
            </p>
          </div>
        </div>
      </Card>

      {/* Future: Deployment History */}
      <Card className="p-6 border-border bg-card opacity-60">
        <h3 className="text-sm font-semibold mb-2">Recent Deployments</h3>
        <p className="text-xs text-muted-foreground">
          Coming soon: View deployment history and details
        </p>
      </Card>
    </div>
  )
}
