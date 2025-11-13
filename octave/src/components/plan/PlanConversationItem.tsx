/**
 * PlanConversationItem - Display individual conversation in a plan
 *
 * Extracted from PlanModeModal.tsx for reuse
 */

import type { PlanConversationDraft } from '@/types/plan'

export interface PlanConversationItemProps {
  conversation: PlanConversationDraft
  index: number
  onClick?: () => void
}

export function PlanConversationItem({
  conversation,
  index,
  onClick,
}: PlanConversationItemProps) {
  return (
    <div
      className={`border rounded-md p-3 space-y-2 ${onClick ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-medium text-sm">
            {index + 1}. {conversation.title}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {conversation.goal}
          </p>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {conversation.todos.length} todos • ~
        {Math.round(conversation.estimatedDuration / 60)} min
      </div>
    </div>
  )
}
