/**
 * PlanPreviewCard - Display plan summary with approval actions
 *
 * Extracted from PlanModeModal.tsx for reuse in chat interface
 */

import { Button } from '@/components/ui/button'
import { CheckCircle2, Edit2, XCircle, Loader2 } from 'lucide-react'
import type { SimpleBranchPlan, PlanConversationDraft } from '@/types/plan'
import { PlanConversationItem } from './PlanConversationItem'

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
          <span>{plan.totalConversations} conversations</span>
          <span>{plan.totalTodos} todos</span>
          <span>~{Math.round(plan.totalEstimatedDuration / 60)} minutes</span>
        </div>
      </div>

      {/* Conversations List */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Conversations:</p>
        <div className="space-y-2">
          {plan.conversations.map((conv: PlanConversationDraft, idx: number) => (
            <PlanConversationItem
              key={conv.id}
              conversation={conv}
              index={idx}
            />
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
