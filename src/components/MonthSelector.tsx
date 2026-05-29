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
    <div className="relative border-y border-white/10 bg-[#121212] py-2 w-full">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar gap-2 px-6 snap-x snap-mandatory"
      >
        {options.map(m => {
          const isActive = m === currentMonth;
          return (
            <button
              key={m}
              data-active={isActive}
              onClick={() => onChange(m)}
              className={`snap-center shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                isActive 
                  ? 'bg-primary text-[#121212] border-primary' 
                  : 'bg-transparent text-zinc-400 border-white/10 hover:bg-[#1E1E1E]'
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
