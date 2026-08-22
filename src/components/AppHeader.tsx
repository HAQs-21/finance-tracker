import React from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { getStoredConfig } from '../services/githubSync';
import type { TabType } from './Navigation';
import { MonthSelector } from './MonthSelector';

interface AppHeaderProps {
  activeTab: TabType;
  currentMonth: string;
  availableMonths: string[];
  onMonthChange: (m: string) => void;
  onOpenSync?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeTab,
  currentMonth,
  availableMonths,
  onMonthChange,
  onOpenSync
}) => {
  const ghConfig = getStoredConfig();
  const isConfigured = !!ghConfig?.token;

  const titles: Record<TabType, { title: string; subtitle: string }> = {
    wallet: { title: 'Wallet', subtitle: 'Cashflow & History' },
    budgets: { title: 'Budgets', subtitle: 'Spending Limits' },
    vault: { title: 'Vault', subtitle: 'Savings & Reserves' },
    tools: { title: 'Tools', subtitle: 'Sync & Data Management' }
  };

  const { title, subtitle } = titles[activeTab];

  return (
    <header className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">{title}</h1>
          <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-wider mt-0.5">{subtitle}</p>
        </div>

        {/* Top Right Cloud Indicator Pill */}
        <button
          onClick={onOpenSync}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer pressable ${
            isConfigured
              ? 'bg-primary/10 border-primary/25 text-primary hover:bg-primary/20'
              : 'bg-white/[0.03] border-white/10 text-zinc-500 hover:text-zinc-300'
          }`}
          title={isConfigured ? 'GitHub Cloud Synced' : 'GitHub Cloud Not Configured'}
        >
          {isConfigured ? <Cloud size={13} /> : <CloudOff size={13} />}
          <span className="text-[10px] uppercase tracking-wider">{isConfigured ? 'Cloud' : 'Local'}</span>
        </button>
      </div>

      {/* Month Selector for Wallet & Budgets */}
      {(activeTab === 'wallet' || activeTab === 'budgets') && (
        <MonthSelector
          currentMonth={currentMonth}
          availableMonths={availableMonths}
          onChange={onMonthChange}
        />
      )}
    </header>
  );
};
