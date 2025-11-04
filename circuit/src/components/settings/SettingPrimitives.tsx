/**
 * Setting Primitive Components
 *
 * Reusable building blocks for creating consistent settings UI
 */

import React, { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

// ============================================================================
// SettingSection - Section header with icon and description
// ============================================================================

interface SettingSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}

export const SettingSection: React.FC<SettingSectionProps> = ({
  title,
  description,
  children,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
};

// ============================================================================
// SettingRow - Label + Control layout
// ============================================================================

interface SettingRowProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  className,
}) => {
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="flex-1 min-w-0">
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
};

// ============================================================================
// ToggleSetting - Switch toggle
// ============================================================================

interface ToggleSettingProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export const ToggleSetting: React.FC<ToggleSettingProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}) => {
  return (
    <SettingRow label={label} description={description}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          checked ? 'bg-primary' : 'bg-input',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white dark:bg-white shadow-sm transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </SettingRow>
  );
};

// ============================================================================
// SelectSetting - Dropdown select
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectSettingProps {
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SelectSetting: React.FC<SelectSettingProps> = ({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <SettingRow label={label} description={description}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={cn(
          'px-3 py-1.5 text-sm rounded-md border border-input bg-background',
          'focus:outline-none focus:ring-2 focus:ring-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </SettingRow>
  );
};

// ============================================================================
// SliderSetting - Range slider
// ============================================================================

interface SliderSettingProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}

export const SliderSetting: React.FC<SliderSettingProps> = ({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled = false,
  formatValue = (v) => v.toString(),
}) => {
  return (
    <SettingRow label={label} description={description} className="flex-col items-start gap-2">
      <div className="w-full flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'flex-1 h-2 rounded-lg appearance-none cursor-pointer',
            'bg-input',
            '[&::-webkit-slider-thumb]:appearance-none',
            '[&::-webkit-slider-thumb]:h-4',
            '[&::-webkit-slider-thumb]:w-4',
            '[&::-webkit-slider-thumb]:rounded-full',
            '[&::-webkit-slider-thumb]:bg-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        <span className="text-sm font-mono text-muted-foreground min-w-[3ch] text-right">
          {formatValue(value)}
        </span>
      </div>
    </SettingRow>
  );
};

// ============================================================================
// SegmentedControl - Compact button group (Apple-style)
// ============================================================================

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  value: string;
  options: SegmentOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="inline-flex rounded-md border border-input bg-background p-1">
      {options.map((option, idx) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.value
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            disabled && 'opacity-50 cursor-not-allowed',
            idx > 0 && 'ml-1'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// RadioGroupSetting - Compact radio buttons (no giant boxes)
// ============================================================================

interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioGroupSettingProps {
  label: string;
  description?: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const RadioGroupSetting: React.FC<RadioGroupSettingProps> = ({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div>
        <label className="text-sm font-medium text-foreground">{label}</label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="space-y-1.5">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex items-center gap-2 cursor-pointer group',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={(e) => onChange(e.target.value)}
              disabled={disabled}
              className="h-3.5 w-3.5 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-0"
            />
            <div className="flex-1">
              <span className="text-sm text-foreground">{option.label}</span>
              {option.description && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  — {option.description}
                </span>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// NumberInputSetting - Number input with unit
// ============================================================================

interface NumberInputSettingProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
}

export const NumberInputSetting: React.FC<NumberInputSettingProps> = ({
  label,
  description,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  disabled = false,
}) => {
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            'w-20 px-3 py-1.5 text-sm rounded-md border border-input bg-background text-right',
            'focus:outline-none focus:ring-2 focus:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        />
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </SettingRow>
  );
};
