import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { triggerHaptic } from '../../hooks/useHaptic';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxHeight = 'max-h-[90vh]'
}) => {
  useEffect(() => {
    if (isOpen) {
      triggerHaptic('light');
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Dimmed Backdrop with Blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in transition-opacity"
      />

      {/* Sheet Container */}
      <div
        className={`relative w-full max-w-lg bg-[#101014] border-t border-x border-white/10 rounded-t-[28px] p-5 sm:p-6 shadow-2xl z-10 animate-sheet-up ${maxHeight} flex flex-col`}
      >
        {/* Mobile Drag Indicator Handle */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4 shrink-0" />

        {/* Header */}
        {(title || subtitle) && (
          <div className="flex items-start justify-between mb-5 shrink-0">
            <div>
              {title && <h3 className="text-lg font-black tracking-tight text-white">{title}</h3>}
              {subtitle && <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 pressable cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto no-scrollbar flex-1 -mx-1 px-1">
          {children}
        </div>
      </div>
    </div>
  );
};
