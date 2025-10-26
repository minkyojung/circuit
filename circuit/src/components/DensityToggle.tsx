import React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useDensity } from '@/hooks/useDensity';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Density toggle button - switches between compact and comfortable UI modes
 */
export const DensityToggleIcon: React.FC<{ className?: string }> = ({ className }) => {
  const { density, toggleDensity } = useDensity();

  const Icon = density === 'compact' ? Minimize2 : Maximize2;
  const label = density === 'compact' ? 'Compact mode' : 'Comfortable mode';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleDensity}
      className={cn('h-7 w-7', className)}
      title={`${label}. Click to toggle.`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
};
