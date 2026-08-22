import React, { useRef, useEffect } from 'react';

interface MonthSelectorProps {
  currentMonth: string;
  availableMonths: string[];
  onChange: (month: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ currentMonth, availableMonths, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentMonth, availableMonths]);

  const formatMonth = (iso: string) => {
    if (iso === 'ALL') return 'All Time';
    const d = new Date(`${iso}-01T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const options = ['ALL', ...availableMonths];

  return (
    <div className="relative w-full py-1">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar gap-1.5 px-0.5 snap-x snap-mandatory"
      >
        {options.map(m => {
          const isActive = m === currentMonth;
          return (
            <button
              key={m}
              data-active={isActive}
              onClick={() => onChange(m)}
              className={`snap-center shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer pressable ${
                isActive 
                  ? 'bg-primary text-white shadow-md shadow-primary/25 scale-[1.02]' 
                  : 'bg-[#141418] text-zinc-400 border border-white/5 hover:bg-[#1a1a20] hover:text-zinc-200'
              }`}
            >
              {formatMonth(m)}
            </button>
          );
        })}
      </div>
    </div>
  );
};
