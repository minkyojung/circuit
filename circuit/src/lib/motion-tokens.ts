/**
 * Motion Design Tokens
 * Apple HIG-inspired animation system for Circuit
 *
 * Principles:
 * - Purposeful: Every animation serves a function
 * - Subtle & Quick: 100-300ms, never block user
 * - Spring Physics: Natural, iOS-like motion
 * - Layered: Depth through staggered timing
 */

import type { Transition, Variants } from 'framer-motion'

// ===== DURATIONS =====
// Apple recommendation: Most animations should be 200-300ms
export const duration = {
  instant: 0.1,    // 100ms - Immediate feedback (hover states)
  fast: 0.15,      // 150ms - Quick transitions (color changes)
  base: 0.2,       // 200ms - Default (most UI transitions)
  slow: 0.3,       // 300ms - Complex animations (modal entry)
  slower: 0.4,     // 400ms - Special cases only
} as const

// ===== EASING CURVES =====
// Matches iOS/macOS native animation curves
export const easing = {
  // Standard ease-out (most common)
  default: [0.4, 0.0, 0.2, 1] as const,

  // Emphasized start (elements entering screen)
  emphasized: [0.0, 0.0, 0.2, 1] as const,

  // Decelerated (smooth stop)
  decelerated: [0.0, 0.0, 0.0, 1] as const,

  // Spring (iOS-style bounce)
  spring: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
  },

  // Gentle spring (subtle bounce)
  springGentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 25,
  },
} as const

// ===== STAGGER =====
// Sequential animation delays
export const stagger = {
  children: 0.05,      // 50ms between list items
  childrenFast: 0.03,  // 30ms for dense lists
  childrenSlow: 0.08,  // 80ms for emphasis
} as const

// ===== COMMON TRANSITIONS =====
export const transition = {
  // Default smooth transition
  smooth: {
    duration: duration.base,
    ease: easing.default,
  } satisfies Transition,

  // Fast color/opacity changes
  fast: {
    duration: duration.fast,
    ease: easing.default,
  } satisfies Transition,

  // Spring-based (buttons, interactive elements)
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  } satisfies Transition,

  // Layout changes (resize, reorder)
  layout: {
    type: 'spring',
    stiffness: 400,
    damping: 35,
  } satisfies Transition,
} as const

// ===== VARIANTS =====
// Reusable animation patterns

// Fade in/out
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

// Slide up from bottom (modals, toasts)
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.base,
      ease: easing.emphasized,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: duration.fast,
      ease: easing.default,
    },
  },
}

// Scale in/out (status badges, icons)
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: duration.fast,
      ease: easing.default,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: duration.fast,
      ease: easing.default,
    },
  },
}

// Staggered list items (workspace list)
export const listItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.base,
      ease: easing.default,
      delay: i * stagger.children,
    },
  }),
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: duration.fast,
      ease: easing.default,
    },
  },
}

// Rotate + scale (icon changes)
export const iconChangeVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.6,
    rotate: -45,
  },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      duration: duration.base,
      ease: easing.default,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.6,
    rotate: 45,
    transition: {
      duration: duration.fast,
      ease: easing.default,
    },
  },
}

// Shimmer effect (loading skeleton)
export const shimmerVariants: Variants = {
  initial: { backgroundPosition: '200% 0' },
  animate: {
    backgroundPosition: '-200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
}

// Pulse effect (alternative loading)
export const pulseVariants: Variants = {
  initial: { opacity: 0.5 },
  animate: {
    opacity: 1,
    transition: {
      duration: 1.2,
      repeat: Infinity,
      repeatType: 'reverse',
      ease: 'easeInOut',
    },
  },
}

// ===== INTERACTION VARIANTS =====
// Hover/tap effects for interactive elements

export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
  transition: transition.spring,
}

export const hoverGlow = {
  whileHover: {
    boxShadow: '0 0 20px rgba(255, 255, 255, 0.1)',
    transition: { duration: duration.fast },
  },
}

export const hoverBrightness = {
  whileHover: {
    filter: 'brightness(1.05)',
    transition: { duration: duration.fast },
  },
}

// ===== UTILITIES =====

/**
 * Create staggered container animation
 * Usage: Use with AnimatePresence and motion.div
 */
export const staggerContainer = (delayChildren = stagger.children) => ({
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: delayChildren,
    },
  },
})

/**
 * Layout animation config
 * Usage: Add to motion components that change size/position
 */
export const layoutTransition = {
  layout: true,
  transition: transition.layout,
}
