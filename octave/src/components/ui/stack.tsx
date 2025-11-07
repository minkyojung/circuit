import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Stack - Vertical layout primitive with automatic spacing
 *
 * Automatically adds consistent vertical spacing between children.
 * Uses design tokens for spacing to ensure consistency.
 *
 * @example
 * <Stack space="4">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </Stack>
 */

const stackVariants = cva("flex flex-col", {
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
      "5": "gap-5",      // 20px (not in design-tokens, but Tailwind default)
      "6": "gap-6",      // 24px
      "8": "gap-8",      // 32px
    },
    align: {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
    },
    justify: {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
    },
  },
  defaultVariants: {
    space: "4",
    align: "stretch",
    justify: "start",
  },
})

export interface StackProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof stackVariants> {
  as?: React.ElementType
}

const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  ({ className, space, align, justify, as: Component = "div", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(stackVariants({ space, align, justify, className }))}
        {...props}
      />
    )
  }
)
Stack.displayName = "Stack"

export { Stack, stackVariants }
