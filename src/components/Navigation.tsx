import React from 'react';
import { Wallet, Target, PiggyBank, Wrench } from 'lucide-react';
import { triggerHaptic } from '../hooks/useHaptic';

export type TabType = 'wallet' | 'budgets' | 'vault' | 'tools';

interface NavigationProps {
  activeTab: TabType;
  onChange: (tab: TabType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onChange }) => {
  const tabs = [
    { id: 'wallet' as TabType, label: 'Wallet', icon: Wallet },
    { id: 'budgets' as TabType, label: 'Budgets', icon: Target },
    { id: 'vault' as TabType, label: 'Vault', icon: PiggyBank },
    { id: 'tools' as TabType, label: 'Tools', icon: Wrench }
  ];

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-[#0c0c10]/90 backdrop-blur-xl border-t border-white/8 px-6 pt-3 safe-bottom-nav flex justify-between items-center z-40 select-none shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => {
              if (!isActive) {
                triggerHaptic('light');
                onChange(tab.id);
              }
            }}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all duration-200 cursor-pointer pressable ${
              isActive
                ? 'text-primary scale-105 font-bold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className={`p-1 rounded-xl transition-colors ${isActive ? 'bg-primary/15' : ''}`}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
            </div>
            <span className="text-[10px] font-bold tracking-wider uppercase">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
