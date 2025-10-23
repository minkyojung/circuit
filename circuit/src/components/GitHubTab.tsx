import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GitBranch, GitPullRequest, CheckCircle2, XCircle, Loader2, Copy, ExternalLink, GitCommit } from 'lucide-react'

export function GitHubTab() {
  const [isSending, setIsSending] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)

  const webhookUrl = 'http://localhost:3456/webhook/github'

  const sendTestWebhook = async (eventType: 'push' | 'pull_request' | 'check_run') => {
    setIsSending(true)
    setLastSent(null)

    try {
      const { ipcRenderer } = window.require('electron')
      const result = await ipcRenderer.invoke('github:send-test-webhook', eventType)

      if (result.success) {
        setLastSent(`${eventType.toUpperCase()} webhook sent successfully!`)
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
          <GitBranch className="h-6 w-6" />
          GitHub
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor GitHub events (push, PR, CI/CD) with the Peek Panel
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
          Send test GitHub events to see them appear in the Peek Panel
        </p>

        <div className="grid grid-cols-3 gap-3">
          <Button
            onClick={() => sendTestWebhook('push')}
            disabled={isSending}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitBranch className="h-4 w-4" />
            )}
            Push
          </Button>

          <Button
            onClick={() => sendTestWebhook('pull_request')}
            disabled={isSending}
            className="gap-2 bg-purple-600 hover:bg-purple-700 text-white"
          >
            <GitPullRequest className="h-4 w-4" />
            Pull Request
          </Button>

          <Button
            onClick={() => sendTestWebhook('check_run')}
            disabled={isSending}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            Check Run
          </Button>
        </div>

        {lastSent && (
          <div className="mt-4 p-3 bg-muted rounded text-sm border border-border">
            {lastSent}
          </div>
        )}
      </Card>

      {/* GitHub Setup Guide */}
      <Card className="p-6 border-border bg-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <ExternalLink className="h-4 w-4" />
          Connect GitHub Repository
        </h3>

        <div className="space-y-4 text-sm text-muted-foreground">
          <div>
            <p className="font-medium text-foreground mb-2">1. Open your GitHub repository settings</p>
            <p className="text-xs">Navigate to your repo → Settings → Webhooks</p>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">2. Add Webhook</p>
            <p className="text-xs mb-2">Click "Add webhook" and enter:</p>
            <div className="font-mono text-xs bg-muted px-3 py-2 rounded border border-border">
              {webhookUrl}
            </div>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">3. Configure webhook events</p>
            <p className="text-xs mb-2">Select individual events:</p>
            <ul className="list-disc list-inside text-xs mt-1 space-y-1 ml-2">
              <li>Pushes</li>
              <li>Pull requests</li>
              <li>Check runs</li>
              <li>Pull request reviews (optional)</li>
              <li>Commit comments (optional)</li>
            </ul>
          </div>

          <div>
            <p className="font-medium text-foreground mb-2">4. Content type</p>
            <p className="text-xs">Select: <code className="px-1 py-0.5 bg-muted rounded">application/json</code></p>
          </div>

          <div className="pt-3 border-t border-border">
            <p className="text-xs">
              <strong className="text-foreground">Note:</strong> Make sure your webhook server is accessible from the internet.
              For local development, use a tool like <code className="px-1 py-0.5 bg-muted rounded">ngrok</code> to expose port 3456.
            </p>
            <p className="text-xs mt-2">
              Example: <code className="px-1 py-0.5 bg-muted rounded">ngrok http 3456</code>
            </p>
          </div>
        </div>
      </Card>

      {/* Event Type Reference */}
      <Card className="p-6 border-border bg-card">
        <h3 className="text-sm font-semibold mb-3">Supported Event Types</h3>
        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3">
            <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Push</p>
              <p className="text-muted-foreground">Commits pushed to a branch</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <GitPullRequest className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Pull Request</p>
              <p className="text-muted-foreground">PRs opened, closed, or merged</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Check Run (CI/CD)</p>
              <p className="text-muted-foreground">GitHub Actions, CI checks, and status updates</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <GitCommit className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-foreground">Reviews & Comments</p>
              <p className="text-muted-foreground">Pull request reviews and commit comments</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Future: Event History */}
      <Card className="p-6 border-border bg-card opacity-60">
        <h3 className="text-sm font-semibold mb-2">Recent Events</h3>
        <p className="text-xs text-muted-foreground">
          Coming soon: View event history and details
        </p>
      </Card>
    </div>
  )
}
