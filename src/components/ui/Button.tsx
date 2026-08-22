import React from 'react';
import { Loader2 } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'vault';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  icon,
  className = '',
  onClick,
  ...props
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;
    triggerHaptic(variant === 'danger' ? 'warning' : 'light');
    onClick?.(e);
  };

  const variants = {
    primary: 'bg-primary hover:bg-primary-hover text-white shadow-lg shadow-primary/20 border border-primary/40',
    secondary: 'bg-[#16161c] hover:bg-[#1e1e26] text-zinc-200 border border-white/10',
    danger: 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
    ghost: 'bg-transparent hover:bg-white/5 text-zinc-400 hover:text-zinc-200 border-transparent',
    vault: 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-600/20 border border-violet-500/30'
  };

  const sizes = {
    sm: 'py-2 px-3 text-xs rounded-xl font-bold gap-1.5',
    md: 'py-3 px-4 text-xs sm:text-sm rounded-2xl font-bold gap-2',
    lg: 'py-4 px-6 text-sm sm:text-base rounded-2xl font-black gap-2.5'
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-sans tracking-tight transition-all duration-200 cursor-pointer pressable select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" />
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
};
