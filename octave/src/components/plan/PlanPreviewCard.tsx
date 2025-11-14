/**
 * PlanPreviewCard - Display plan summary with approval actions
 *
 * Extracted from PlanModeModal.tsx for reuse in chat interface
 */

import { Button } from '@/components/ui/button'
import { CheckCircle2, Edit2, XCircle, Loader2 } from 'lucide-react'
import type { SimpleBranchPlan } from '@/types/plan'

export interface PlanPreviewCardProps {
  plan: SimpleBranchPlan
  onApprove?: () => void
  onEdit?: () => void
  onCancel?: () => void
  isExecuting?: boolean
  showActions?: boolean
}

export function PlanPreviewCard({
  plan,
  onApprove,
  onEdit,
  onCancel,
  isExecuting = false,
  showActions = true,
}: PlanPreviewCardProps) {
  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      {/* Plan Summary */}
      <div className="bg-muted/50 rounded-md p-4 space-y-2">
        <h3 className="font-semibold text-base">{plan.goal}</h3>
        {plan.description && (
          <p className="text-sm text-muted-foreground">{plan.description}</p>
        )}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{plan.totalTodos} todos</span>
          <span>~{Math.round(plan.totalEstimatedDuration / 60)} minutes</span>
        </div>
      </div>

      {/* Todo Queue Preview */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Todo Queue:</p>
        <div className="space-y-1 max-h-[300px] overflow-y-auto">
          {plan.todos.map((todo: any, idx: number) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-sm"
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{todo.content}</p>
                {todo.estimatedDuration && (
                  <p className="text-xs text-muted-foreground">
                    ~{Math.round(todo.estimatedDuration / 60)} min
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isExecuting}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit} disabled={isExecuting}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
          {onApprove && (
            <Button size="sm" onClick={onApprove} disabled={isExecuting}>
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Create Plan
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
