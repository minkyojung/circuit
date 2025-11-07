import * as React from "react"
import { cn } from "@/lib/utils"
import { Inline } from "./inline"

/**
 * PanelHeader - Standardized header for panels and sections
 *
 * Provides consistent spacing, alignment, and structure for panel headers.
 * Eliminates the need for manual spacing adjustments.
 *
 * @example
 * <PanelHeader
 *   icon={<ListTodo className="w-5 h-5" />}
 *   title="Tasks"
 *   badge="5"
 *   actions={<Button size="sm">Add</Button>}
 * />
 */

export interface PanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon to display before the title */
  icon?: React.ReactNode
  /** Main title text */
  title: string
  /** Optional badge count or label */
  badge?: string | number
  /** Optional subtitle or description */
  subtitle?: string
  /** Action buttons or controls to display on the right */
  actions?: React.ReactNode
  /** Show bottom border (default: true) */
  bordered?: boolean
  /** Size variant */
  size?: "sm" | "md" | "lg"
}

const sizeStyles = {
  sm: {
    container: "px-3 py-2",
    title: "text-xs",
    icon: "text-muted-foreground",
  },
  md: {
    container: "px-4 py-3",
    title: "text-sm",
    icon: "text-muted-foreground",
  },
  lg: {
    container: "px-6 py-4",
    title: "text-base",
    icon: "text-muted-foreground",
  },
}

const PanelHeader = React.forwardRef<HTMLDivElement, PanelHeaderProps>(
  (
    {
      icon,
      title,
      badge,
      subtitle,
      actions,
      bordered = true,
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    const styles = sizeStyles[size]

    return (
      <div
        ref={ref}
        className={cn(
          "flex-shrink-0",
          styles.container,
          bordered && "border-b border-border",
          className
        )}
        {...props}
      >
        <Inline align="center" justify="between" space="2">
          {/* Left side: Icon + Title + Badge */}
          <Inline align="center" space="2">
            {icon && (
              <div className={cn("flex-shrink-0", styles.icon)}>{icon}</div>
            )}
            <div className="flex items-center gap-2">
              <h2 className={cn(styles.title, "font-semibold")}>{title}</h2>
              {badge !== undefined && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground">
                  {badge}
                </span>
              )}
            </div>
          </Inline>

          {/* Right side: Actions */}
          {actions && <div className="flex-shrink-0">{actions}</div>}
        </Inline>

        {/* Subtitle (optional) */}
        {subtitle && (
          <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    )
  }
)
PanelHeader.displayName = "PanelHeader"

export { PanelHeader }
