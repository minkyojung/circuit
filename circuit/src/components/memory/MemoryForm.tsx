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
import { X } from 'lucide-react'
import type { ProjectMemory } from '../../../electron/memoryStorage'

const API_BASE_URL = 'http://localhost:3737'

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
  const template = initialTemplate ? TEMPLATES[initialTemplate as keyof typeof TEMPLATES] : undefined

  const [key, setKey] = useState(memory?.key || template?.key || '')
  const [type, setType] = useState<string>(memory?.type || template?.type || 'convention')
  const [priority, setPriority] = useState<string>(memory?.priority || template?.priority || 'medium')
  const [value, setValue] = useState(memory?.value || template?.value || '')
  const [metadata, setMetadata] = useState(memory?.metadata || template?.metadata || '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)

    if (!key.trim() || !value.trim()) {
      setError('Key and value are required')
      return
    }

    setIsSaving(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          key: key.trim(),
          value: value.trim(),
          priority,
          metadata: metadata.trim() || undefined,
        }),
      })

      const result = await response.json()

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="glass-card w-full max-w-xl p-6 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {memory ? 'Edit Memory' : template ? `New: ${initialTemplate}` : 'New Memory'}
            </h2>
            {template && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Customize this template as needed
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

        {/* Form Fields - Scrollable */}
        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
          {/* Key */}
          <div>
            <Label htmlFor="key" className="text-sm font-medium mb-1.5 block">
              Key <span className="text-red-400">*</span>
            </Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
              placeholder="e.g., api-pattern"
              disabled={!!memory}
              required
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Claude searches by this keyword. Lowercase with hyphens.
            </p>
          </div>

          {/* Type & Priority Row */}
          <div className="grid grid-cols-2 gap-3">
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
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Category type
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
              <p className="text-xs text-[var(--text-muted)] mt-1">
                High = always applied
              </p>
            </div>
          </div>

          {/* Value */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="value" className="text-sm font-medium">
                Value <span className="text-red-400">*</span>
              </Label>
              {/* Quality Indicator */}
              <div className="flex items-center gap-2">
                {value.length > 0 && (
                  <>
                    <div className="w-20 h-1.5 bg-[var(--glass-border)] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          value.length < 50 ? 'bg-red-400 w-1/4' :
                          value.length < 100 ? 'bg-yellow-400 w-1/2' :
                          value.length < 200 ? 'bg-blue-400 w-3/4' :
                          'bg-green-400 w-full'
                        }`}
                      />
                    </div>
                    <span className={`text-xs ${
                      value.length < 50 ? 'text-red-400' :
                      value.length < 100 ? 'text-yellow-400' :
                      value.length < 200 ? 'text-blue-400' :
                      'text-green-400'
                    }`}>
                      {value.length < 50 ? 'Brief' :
                       value.length < 100 ? 'Okay' :
                       value.length < 200 ? 'Good' :
                       'Great'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <Textarea
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Example:
All API endpoints use REST:
- GET /api/v1/users - List
- POST /api/v1/users - Create
- PUT /api/v1/users/:id - Update

Return JSON: { success, data, error }"
              rows={10}
              required
              className="resize-none font-mono text-sm"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Given to Claude as instructions. Be specific.
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
              placeholder="author: team, date: 2025-01-15"
            />
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Additional notes for team collaboration
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
              {error}
            </div>
          )}
        </div>

        {/* Actions - Fixed at bottom */}
        <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-[var(--glass-border)] flex-shrink-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Memory'}
          </Button>
        </div>
      </div>
    </div>
  )
}
