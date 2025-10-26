import React from 'react';
import { cn } from '@/lib/utils';

// 4×4 Dot Matrix patterns for A-Z (1 = filled, 0 = empty)
const DOT_PATTERNS: Record<string, number[][]> = {
  A: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
  ],
  B: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 1, 1, 1],
  ],
  C: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [0, 1, 1, 1],
  ],
  D: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
  ],
  E: [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [1, 1, 1, 1],
  ],
  F: [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  G: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 0, 1, 1],
    [0, 1, 1, 1],
  ],
  H: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
  ],
  I: [
    [1, 1, 1, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [1, 1, 1, 1],
  ],
  J: [
    [0, 0, 1, 1],
    [0, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ],
  K: [
    [1, 0, 0, 1],
    [1, 0, 1, 0],
    [1, 1, 0, 0],
    [1, 0, 1, 1],
  ],
  L: [
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 0, 0, 0],
    [1, 1, 1, 1],
  ],
  M: [
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
  ],
  N: [
    [1, 0, 0, 1],
    [1, 1, 0, 1],
    [1, 0, 1, 1],
    [1, 0, 0, 1],
  ],
  O: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ],
  P: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
  ],
  Q: [
    [0, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 1, 0],
    [0, 1, 0, 1],
  ],
  R: [
    [1, 1, 1, 0],
    [1, 0, 0, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 1],
  ],
  S: [
    [0, 1, 1, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [1, 1, 1, 0],
  ],
  T: [
    [1, 1, 1, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
  ],
  U: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
  ],
  V: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
  ],
  W: [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
  ],
  X: [
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [1, 0, 0, 1],
  ],
  Y: [
    [1, 0, 0, 1],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
  ],
  Z: [
    [1, 1, 1, 1],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [1, 1, 1, 1],
  ],
};

interface DotMatrixAvatarProps {
  letter: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

export const DotMatrixAvatar: React.FC<DotMatrixAvatarProps> = ({
  letter,
  color,
  size = 'md',
  animate = true,
  className,
}) => {
  const upperLetter = letter.toUpperCase();
  const pattern = DOT_PATTERNS[upperLetter] || DOT_PATTERNS['A'];

  // Size configurations
  const sizes = {
    sm: { container: 'w-6 h-6', dot: 'w-1 h-1', gap: 'gap-[2px]' },
    md: { container: 'w-8 h-8', dot: 'w-[3px] h-[3px]', gap: 'gap-[2px]' },
    lg: { container: 'w-10 h-10', dot: 'w-1 h-1', gap: 'gap-[3px]' },
  };

  const sizeConfig = sizes[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center',
        sizeConfig.container,
        className
      )}
    >
      <div className={cn('grid grid-cols-4', sizeConfig.gap)}>
        {pattern.flat().map((filled, index) => {
          // Stagger animation delay for each dot
          const row = Math.floor(index / 4);
          const col = index % 4;
          const delay = (row * 4 + col) * 30; // 30ms stagger

          return (
            <div
              key={index}
              className={cn(
                'rounded-full transition-all duration-300',
                sizeConfig.dot,
                animate && filled && 'animate-pulse-glow'
              )}
              style={{
                backgroundColor: filled ? color : '#333',
                opacity: filled ? 1 : 0.25,
                boxShadow: filled
                  ? `0 0 3px ${color}, 0 0 6px ${color}`
                  : undefined,
                animationDelay: animate && filled ? `${delay}ms` : undefined,
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
