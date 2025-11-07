import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Inline - Horizontal layout primitive with automatic spacing
 *
 * Automatically adds consistent horizontal spacing between children.
 * Uses design tokens for spacing to ensure consistency.
 *
 * @example
 * <Inline space="2">
 *   <Button>Action 1</Button>
 *   <Button>Action 2</Button>
 * </Inline>
 */

const inlineVariants = cva("flex flex-row", {
  variants: {
    space: {
      "0": "gap-0",
      "0.5": "gap-0.5",  // 2px
      "1": "gap-1",      // 4px
      "1.5": "gap-1.5",  // 6px
      "2": "gap-2",      // 8px
      "2.5": "gap-2.5",  // 10px
      "3": "gap-3",      // 12px
      "4": "gap-4",      // 16px
      "5": "gap-5",      // 20px
      "6": "gap-6",      // 24px
      "8": "gap-8",      // 32px
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      baseline: "items-baseline",
      stretch: "items-stretch",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
    },
    wrap: {
      true: "flex-wrap",
      false: "flex-nowrap",
    },
  },
  defaultVariants: {
    space: "2",
    align: "center",
    justify: "start",
    wrap: false,
  },
})

export interface InlineProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof inlineVariants> {
  as?: React.ElementType
}

const Inline = React.forwardRef<HTMLDivElement, InlineProps>(
  ({ className, space, align, justify, wrap, as: Component = "div", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(inlineVariants({ space, align, justify, wrap, className }))}
        {...props}
      />
    )
  }
)
Inline.displayName = "Inline"

export { Inline, inlineVariants }
