/**
 * Memory Create/Edit Form
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { X, Lightbulb, Sparkles } from 'lucide-react'
import type { ProjectMemory } from '../../../electron/memoryStorage'

const { ipcRenderer } = window.require('electron')

interface MemoryFormProps {
  projectPath: string
  memory: ProjectMemory | null
  onSave: () => void
  onCancel: () => void
  initialTemplate?: string
}

// Template presets (Conductor style)
const TEMPLATES = {
  'naming-convention': {
    key: 'naming-convention',
    type: 'convention',
    priority: 'high',
    value: `File Naming Conventions:

Components:
- React components: PascalCase.tsx (e.g., UserProfile.tsx)
- Utility files: camelCase.ts (e.g., formatDate.ts)
- Constant files: SCREAMING_SNAKE_CASE.ts (e.g., API_ROUTES.ts)

Folders:
- Use lowercase with hyphens (e.g., user-profile/)
- Group by feature, not by type

Variables:
- Boolean: isLoading, hasError, canSubmit
- Functions: handleClick, fetchData, calculateTotal
- Constants: MAX_RETRIES, API_BASE_URL`,
    metadata: 'team-standard, updated: 2025-01-15'
  },
  'api-pattern': {
    key: 'api-pattern',
    type: 'convention',
    priority: 'high',
    value: `API Design Patterns:

All endpoints follow REST conventions with /api/v1 prefix:

GET /api/v1/users          - List all users
GET /api/v1/users/:id      - Get single user
POST /api/v1/users         - Create new user
PUT /api/v1/users/:id      - Update user
DELETE /api/v1/users/:id   - Delete user

Response Format:
{
  "success": true,
  "data": { ... },
  "error": null
}

Status Codes:
- 200: Success (GET, PUT)
- 201: Created (POST)
- 204: No Content (DELETE)
- 400: Bad Request
- 404: Not Found
- 500: Server Error`,
    metadata: 'architecture-decision, date: 2024-12'
  },
  'error-handling': {
    key: 'error-handling',
    type: 'convention',
    priority: 'high',
    value: `Error Handling Strategy:

1. Use try-catch for async operations
2. Always log errors with context
3. Show user-friendly messages to users
4. Include error boundaries in React components

Example:
\`\`\`typescript
try {
  const data = await fetchData()
  return { success: true, data }
} catch (error) {
  console.error('Failed to fetch data:', error)
  return {
    success: false,
    error: 'Unable to load data. Please try again.'
  }
}
\`\`\`

Never expose internal error details to users.`,
    metadata: 'best-practice'
  },
  'file-structure': {
    key: 'file-structure',
    type: 'decision',
    priority: 'medium',
    value: `Project Structure:

src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   └── features/       # Feature-specific components
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript types
├── api/                # API client code
└── pages/              # Page components

Rules:
- One component per file
- Co-locate tests with components (*.test.tsx)
- Keep components small (< 200 lines)
- Extract complex logic into hooks`,
    metadata: 'architecture'
  }
} as const

export function MemoryForm({
  projectPath,
  memory,
  onSave,
  onCancel,
  initialTemplate,
}: MemoryFormProps) {
  // Load template if provided
  const template = initialTemplate && TEMPLATES[initialTemplate as keyof typeof TEMPLATES]

  const [key, setKey] = useState(memory?.key || template?.key || '')
  const [type, setType] = useState<string>(memory?.type || template?.type || 'convention')
  const [priority, setPriority] = useState<string>(memory?.priority || template?.priority || 'medium')
  const [value, setValue] = useState(memory?.value || template?.value || '')
  const [metadata, setMetadata] = useState(memory?.metadata || template?.metadata || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHowItWorks, setShowHowItWorks] = useState(!memory && !template)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!key.trim() || !value.trim()) {
      setError('Key and value are required')
      return
    }

    setIsSaving(true)

    try {
      const result = await ipcRenderer.invoke('circuit:memory-store', {
        projectPath,
        type,
        key: key.trim(),
        value: value.trim(),
        priority,
        metadata: metadata.trim() || undefined,
      })

      if (result.success) {
        onSave()
      } else {
        setError(result.error || 'Failed to save memory')
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="glass-card w-full max-w-3xl max-h-[90vh] overflow-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {memory ? 'Edit Memory' : template ? `New Memory: ${initialTemplate}` : 'New Memory'}
            </h2>
            {template && (
              <p className="text-sm text-[var(--text-muted)] mt-1">
                Starting from template - customize as needed
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* How It Works (Conductor style) */}
        {showHowItWorks && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-400 mb-2">
                  How Memory Works
                </h3>
                <ul className="text-xs text-[var(--text-secondary)] space-y-1.5">
                  <li>• <strong>Key</strong> - Claude searches for this when generating code</li>
                  <li>• <strong>Type</strong> - Organizes memories by category</li>
                  <li>• <strong>Priority</strong> - High = always applied, Medium = usually applied, Low = reference only</li>
                  <li>• <strong>Value</strong> - The exact instructions given to Claude as context</li>
                </ul>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHowItWorks(false)}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-2 h-auto p-0"
                >
                  Got it, hide this
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Key */}
          <div>
            <Label htmlFor="key" className="text-sm font-medium mb-1.5 block">
              Key <span className="text-red-400">*</span>
            </Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g., api-pattern, testing-strategy"
              disabled={!!memory} // Can't change key when editing
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              Search keyword for this memory. Claude uses this to find relevant context when generating code. <strong>Must be lowercase with hyphens.</strong>
            </p>
          </div>

          {/* Type */}
          <div>
            <Label htmlFor="type" className="text-sm font-medium mb-1.5 block">
              Type <span className="text-red-400">*</span>
            </Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="convention">Convention</SelectItem>
                <SelectItem value="decision">Decision</SelectItem>
                <SelectItem value="rule">Rule</SelectItem>
                <SelectItem value="note">Note</SelectItem>
                <SelectItem value="snippet">Snippet</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              Category for organizing memories. <strong>Convention:</strong> coding standards, <strong>Decision:</strong> architectural choices, <strong>Rule:</strong> must-follow requirements, <strong>Note:</strong> project context, <strong>Snippet:</strong> reusable code patterns.
            </p>
          </div>

          {/* Priority */}
          <div>
            <Label htmlFor="priority" className="text-sm font-medium mb-1.5 block">
              Priority
            </Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              How strictly Claude should follow this. <strong>High:</strong> always applied (critical rules), <strong>Medium:</strong> usually applied (best practices), <strong>Low:</strong> reference only (optional guidance).
            </p>
          </div>

          {/* Value */}
          <div>
            <Label htmlFor="value" className="text-sm font-medium mb-1.5 block">
              Value <span className="text-red-400">*</span>
            </Label>
            <Textarea
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Be specific! The more detailed you are, the better Claude understands.

Example:
All API endpoints use REST conventions:
- GET /api/v1/users - List users
- POST /api/v1/users - Create user
- PUT /api/v1/users/:id - Update user

Always return JSON: { success, data, error }"
              rows={12}
              required
              className="resize-none font-mono text-sm"
            />
            <div className="flex items-start gap-2 mt-2">
              {value.length < 50 ? (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded px-2 py-1.5 flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>Tip: Be more specific. Include examples, code snippets, or clear rules.</span>
                </div>
              ) : value.length > 100 ? (
                <div className="text-xs text-green-400 bg-green-500/10 border border-green-500/30 rounded px-2 py-1.5">
                  ✓ Good! Detailed instructions help Claude understand exactly what you need.
                </div>
              ) : null}
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              This exact text is given to Claude as context when generating code. Be specific and include examples.
            </p>
          </div>

          {/* Metadata */}
          <div>
            <Label htmlFor="metadata" className="text-sm font-medium mb-1.5 block">
              Metadata (Optional)
            </Label>
            <Input
              id="metadata"
              value={metadata}
              onChange={(e) => setMetadata(e.target.value)}
              placeholder="e.g., author: team, reason: standardization, date: 2025-01-15"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1.5">
              Additional context like who created this, why, or when. Helps with team collaboration and memory management.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Memory'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
