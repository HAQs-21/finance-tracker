import React from 'react';
import { useAnimatedCounter } from '../../hooks/useAnimatedCounter';
import { formatCurrency } from '../../db/financeUtils';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  prefix?: string;
  duration?: number;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className = '',
  prefix = '',
  duration = 300
}) => {
  const animatedValue = useAnimatedCounter(value, duration);

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}{formatCurrency(Math.round(animatedValue))}
    </span>
  );
};
