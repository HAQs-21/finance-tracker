import React, { useState, useMemo } from 'react';
import { Lock, Unlock, ArrowUpRight, ArrowDownLeft, Trash2, ChevronDown, ShieldCheck, Sparkles } from 'lucide-react';
import { SegmentedControl } from './ui/SegmentedControl';
import { Button } from './ui/Button';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { formatCurrency } from '../db/financeUtils';
import { triggerHaptic } from '../hooks/useHaptic';
import { useToast } from '../context/ToastContext';
import type { SavingsRecord } from '../types';

interface VaultViewProps {
  savingsRecords: SavingsRecord[];
  walletBalance: number;
  onAddSavings: (data: Omit<SavingsRecord, 'id'>) => Promise<any>;
  onDeleteSavings: (id: number) => Promise<any>;
}

export const VaultView: React.FC<VaultViewProps> = ({
  savingsRecords,
  walletBalance,
  onAddSavings,
  onDeleteSavings
}) => {
  const { showToast } = useToast();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(true);
  const [loading, setLoading] = useState(false);

  // Total Savings Balance
  const vaultBalance = useMemo(() => {
    return savingsRecords.reduce((sum, r) => {
      return r.type === 'DEPOSIT' ? sum + r.amount : sum - r.amount;
    }, 0);
  }, [savingsRecords]);

  const handleUnlock = () => {
    triggerHaptic('medium');
    setIsUnlocked(true);
    showToast('Vault unlocked', 'info');
  };

  const handleLock = () => {
    triggerHaptic('light');
    setIsUnlocked(false);
    showToast('Vault secured & locked', 'info');
  };

  const handleQuickAmount = (val: number) => {
    triggerHaptic('light');
    setAmount(val.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter an amount greater than 0', 'error');
      return;
    }

    if (type === 'WITHDRAW' && numAmount > vaultBalance) {
      showToast('Cannot withdraw more than available savings', 'error');
      return;
    }

    setLoading(true);
    try {
      const desc = description.trim() || (type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal');
      await onAddSavings({
        amount: Math.abs(numAmount),
        type,
        date,
        description: desc
      });
      showToast(type === 'DEPOSIT' ? 'Added to Savings' : 'Withdrawn to Balance', 'success');
      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().slice(0, 10));
    } catch {
      showToast('Transaction failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this savings entry?')) {
      try {
        await onDeleteSavings(id);
        showToast('Entry removed', 'success');
      } catch {
        showToast('Failed to delete', 'error');
      }
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-4">
      {/* --- LOCKED STATE --- */}
      {!isUnlocked ? (
        <div className="pt-2">
          <button
            type="button"
            onClick={handleUnlock}
            className="w-full bg-gradient-to-b from-[#181126] via-[#120d1e] to-[#0a0812] hover:from-[#201633] hover:to-[#100b1a] border border-violet-500/25 rounded-3xl p-8 flex flex-col items-center justify-center gap-5 group cursor-pointer pressable shadow-2xl shadow-violet-950/40 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-violet-400">
              <ShieldCheck size={120} />
            </div>

            {/* Lock Icon Disc */}
            <div className="w-18 h-18 bg-violet-950/80 rounded-3xl border border-violet-500/40 flex items-center justify-center text-violet-400 group-hover:scale-105 group-hover:text-violet-300 transition-all duration-300 shadow-xl shadow-violet-900/30">
              <Lock size={32} />
            </div>

            <div className="text-center space-y-1.5 z-10">
              <h2 className="text-base font-black text-white tracking-wider uppercase">Savings Locked</h2>
              <p className="text-xs font-mono font-bold text-zinc-500">
                Balance: ••••••••••••
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                  <Sparkles size={11} /> Tap to Unlock
                </span>
              </div>
            </div>
          </button>
        </div>
      ) : (
        /* --- UNLOCKED STATE --- */
        <div className="space-y-4 animate-fade-in">
          {/* Top Status & Lock Action */}
          <div className="p-3.5 rounded-2xl bg-[#101014] border border-violet-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-violet-400">
              <Unlock size={16} />
              <span className="text-xs font-black uppercase tracking-wider text-white">Savings Unlocked</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLock} className="text-[10px] text-violet-400">
              Lock
            </Button>
          </div>

          {/* Savings Balance & Available Cash Reference Card */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-[#1b122c] to-[#100a1c] border border-violet-500/30 flex flex-col justify-between">
              <div className="text-violet-400 text-[10px] font-bold uppercase tracking-wider">
                Total Saved
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                <AnimatedNumber value={vaultBalance} />
              </div>
            </div>

            <div className="p-4 rounded-3xl bg-[#101014] border border-white/5 flex flex-col justify-between">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                In Hand
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-300 mt-1 tabular-nums">
                {formatCurrency(walletBalance)}
              </div>
            </div>
          </div>

          {/* Deposit / Withdraw Action Card */}
          <div className="p-5 rounded-3xl bg-[#101014] border border-white/5 space-y-4">
            <SegmentedControl<'DEPOSIT' | 'WITHDRAW'>
              options={[
                {
                  id: 'DEPOSIT',
                  label: 'Deposit',
                  icon: <ArrowUpRight size={13} />,
                  activeColor: 'bg-violet-600 text-white shadow-violet-600/20'
                },
                {
                  id: 'WITHDRAW',
                  label: 'Withdraw',
                  icon: <ArrowDownLeft size={13} />,
                  activeColor: 'bg-zinc-700 text-white'
                }
              ]}
              value={type}
              onChange={setType}
            />

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase">
                    Amount
                  </label>
                  {type === 'WITHDRAW' && (
                    <span className="text-[10px] font-bold text-violet-400">
                      Max: {formatCurrency(vaultBalance)}
                    </span>
                  )}
                </div>

                <div className="flex items-center bg-[#16161c] rounded-2xl border border-white/10 p-3.5">
                  <span className="text-sm font-black text-zinc-500 mr-2.5 select-none">PKR</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-xl font-black text-white tabular-nums outline-none"
                  />
                </div>

                {/* Quick Amount Chips */}
                <div className="flex gap-1.5 pt-1 overflow-x-auto no-scrollbar">
                  {[1000, 5000, 10000, 50000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAmount(val)}
                      className="px-2.5 py-1 rounded-xl bg-[#16161c] text-zinc-400 hover:text-white border border-white/5 text-[10px] font-bold cursor-pointer pressable"
                    >
                      +{val >= 1000 ? `${val / 1000}k` : val}
                    </button>
                  ))}
                  {type === 'WITHDRAW' && vaultBalance > 0 && (
                    <button
                      type="button"
                      onClick={() => handleQuickAmount(vaultBalance)}
                      className="px-2.5 py-1 rounded-xl bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[10px] font-bold cursor-pointer pressable"
                    >
                      All
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none [color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Note</label>
                  <input
                    type="text"
                    placeholder="Purpose..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#16161c] border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="vault"
                size="md"
                loading={loading}
                className="w-full mt-1"
              >
                {type === 'DEPOSIT' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </Button>
            </form>
          </div>

          {/* History Collapsible */}
          {savingsRecords.length > 0 && (
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 cursor-pointer select-none"
              >
                <span>History ({savingsRecords.length})</span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`}
                />
              </button>

              {showHistory && (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
                  {savingsRecords.map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-2xl bg-[#101014] border border-white/5 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            r.type === 'DEPOSIT'
                              ? 'bg-violet-500/10 text-violet-400'
                              : 'bg-zinc-500/10 text-zinc-400'
                          }`}
                        >
                          {r.type === 'DEPOSIT' ? (
                            <ArrowUpRight size={13} />
                          ) : (
                            <ArrowDownLeft size={13} />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-bold text-zinc-200 truncate">
                            {r.description || (r.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal')}
                          </div>
                          <div className="text-[9px] text-zinc-500 font-mono mt-0.5">{r.date}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-3">
                        <span
                          className={`text-xs font-black tabular-nums ${
                            r.type === 'DEPOSIT' ? 'text-violet-300' : 'text-zinc-400'
                          }`}
                        >
                          {r.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(r.amount)}
                        </span>
                        <button
                          onClick={() => r.id && handleDelete(r.id)}
                          className="text-zinc-600 hover:text-rose-400 p-1 cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
