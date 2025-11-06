/**
 * ButtonGroup - Groups related buttons together with consistent styling
 * Based on shadcn/ui design patterns
 */

import * as React from "react"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const ButtonGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    orientation?: "horizontal" | "vertical"
  }
>(({ className, orientation = "horizontal", ...props }, ref) => (
  <div
    ref={ref}
    role="group"
    className={cn(
      "inline-flex",
      orientation === "horizontal" ? "flex-row" : "flex-col",
      "rounded-lg border border-border bg-transparent",
      className
    )}
    {...props}
  />
))
ButtonGroup.displayName = "ButtonGroup"

const ButtonGroupSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator> & {
    orientation?: "horizontal" | "vertical"
  }
>(({ className, orientation = "vertical", ...props }, ref) => (
  <Separator
    ref={ref}
    orientation={orientation}
    className={cn(
      "bg-border",
      orientation === "vertical" ? "h-auto w-px" : "h-px w-auto",
      className
    )}
    {...props}
  />
))
ButtonGroupSeparator.displayName = "ButtonGroupSeparator"

export { ButtonGroup, ButtonGroupSeparator }
