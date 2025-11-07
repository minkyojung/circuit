import React from 'react';
import { cn } from '@/lib/utils';

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
  animate: _animate = false,
  className,
}) => {
  const upperLetter = letter.toUpperCase();

  // Size configurations
  const sizes = {
    sm: { container: 'w-7 h-7', text: 'text-xs' },
    md: { container: 'w-9 h-9', text: 'text-sm' },
    lg: { container: 'w-11 h-11', text: 'text-base' },
  };

  const sizeConfig = sizes[size];

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-md font-semibold flex-shrink-0',
        sizeConfig.container,
        sizeConfig.text,
        className
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
        color: color,
      }}
    >
      {upperLetter}
    </div>
  );
};
