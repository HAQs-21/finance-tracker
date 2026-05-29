import React, { useRef, useEffect } from 'react';

interface MonthSelectorProps {
  currentMonth: string;
  onChange: (month: string) => void;
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({ currentMonth, onChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const generateMonths = () => {
    const months = [];
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    for (let i = 0; i < 24; i++) {
      months.push(date.toISOString().slice(0, 7));
      date.setMonth(date.getMonth() - 1);
    }
    return months.reverse();
  };

  const months = generateMonths();

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [currentMonth]);

  const formatMonth = (iso: string) => {
    const d = new Date(`${iso}-01T00:00:00`);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="relative border-y border-white/10 bg-[#121212] py-2 w-full">
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto no-scrollbar gap-2 px-6 snap-x snap-mandatory"
      >
        {months.map(m => {
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
