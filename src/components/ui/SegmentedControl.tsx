import React from 'react';
import { triggerHaptic } from '../../hooks/useHaptic';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  activeColor?: string; // Optional custom active background class (e.g. 'bg-emerald-500 text-white')
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md'
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`flex items-center bg-[#16161c] p-1 rounded-2xl border border-white/5 select-none ${className}`}
    >
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              if (!isActive) {
                triggerHaptic('light');
                onChange(option.id);
              }
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl font-bold transition-all duration-200 cursor-pointer pressable ${
              size === 'sm' ? 'py-1.5 px-2 text-[11px]' : 'py-2.5 px-3 text-xs'
            } ${
              isActive
                ? option.activeColor || 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.01]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {option.icon}
            <span className="truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
