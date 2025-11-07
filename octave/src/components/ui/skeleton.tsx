import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { shimmerVariants } from "@/lib/motion-tokens"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'shimmer' | 'pulse'
}

function Skeleton({
  className,
  variant = 'shimmer',
  ...props
}: SkeletonProps) {
  if (variant === 'shimmer') {
    return (
      // @ts-ignore - framer-motion types conflict with React.HTMLAttributes
      <motion.div
        className={cn(
          "rounded-md bg-gradient-to-r from-muted via-muted-foreground/10 to-muted",
          className
        )}
        style={{
          backgroundSize: '200% 100%',
        }}
        variants={shimmerVariants}
        initial="initial"
        animate="animate"
        {...props}
      />
    )
  }

  // Pulse variant (simpler alternative)
  return (
    // @ts-ignore - framer-motion types conflict with React.HTMLAttributes
    <motion.div
      className={cn("rounded-md bg-muted", className)}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      {...props}
    />
  )
}

// Preset skeleton components for common patterns
export function WorkspaceItemSkeleton() {
  return (
    <div className="px-3 py-2 mx-2 mb-1 rounded-md">
      <div className="flex items-start gap-3">
        <Skeleton className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32 flex-1" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function FileTreeSkeleton() {
  return (
    <div className="px-2 space-y-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-3 flex-1" style={{ width: `${60 + Math.random() * 40}%` }} />
        </div>
      ))}
    </div>
  )
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex justify-start">
      <div className="w-full max-w-3xl space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[90%]" />
        <Skeleton className="h-4 w-[75%]" />
      </div>
    </div>
  )
}

export { Skeleton }
