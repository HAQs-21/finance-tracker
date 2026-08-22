import React, { useState, useMemo } from 'react';
import { Lock, Unlock, ArrowUpRight, ArrowDownLeft, Trash2, ChevronDown } from 'lucide-react';
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

  // Vault Balance
  const vaultBalance = useMemo(() => {
    return savingsRecords.reduce((sum, r) => {
      return r.type === 'DEPOSIT' ? sum + r.amount : sum - r.amount;
    }, 0);
  }, [savingsRecords]);

  const handleUnlock = () => {
    triggerHaptic('medium');
    setIsUnlocked(true);
  };

  const handleLock = () => {
    triggerHaptic('light');
    setIsUnlocked(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter an amount greater than 0', 'error');
      return;
    }

    if (type === 'WITHDRAW' && numAmount > vaultBalance) {
      showToast('Cannot withdraw more than available vault balance', 'error');
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
      showToast(type === 'DEPOSIT' ? 'Deposited to Vault' : 'Withdrawn to Wallet', 'success');
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
    if (window.confirm('Delete this vault record?')) {
      try {
        await onDeleteSavings(id);
        showToast('Record deleted', 'success');
      } catch {
        showToast('Failed to delete', 'error');
      }
    }
  };

  return (
    <div className="space-y-5 animate-fade-in pb-2">
      {/* Locked State */}
      {!isUnlocked ? (
        <div className="pt-4">
          <button
            type="button"
            onClick={handleUnlock}
            className="w-full bg-gradient-to-b from-[#1c122e] to-[#100b1a] hover:from-[#24173b] hover:to-[#140e21] border border-violet-500/25 rounded-3xl p-8 flex flex-col items-center justify-center gap-5 group cursor-pointer pressable shadow-2xl shadow-violet-950/30 relative overflow-hidden"
          >
            <div className="w-16 h-16 bg-violet-950/60 rounded-2xl border border-violet-500/40 flex items-center justify-center text-violet-400 group-hover:scale-105 group-hover:text-violet-300 transition-all duration-300 shadow-lg shadow-violet-900/20">
              <Lock size={28} />
            </div>

            <div className="text-center space-y-1">
              <h2 className="text-base font-black text-white tracking-wider uppercase">Savings Vault</h2>
              <p className="text-[10px] text-violet-400/80 font-bold tracking-widest uppercase">
                Tap to Unlock & Manage Reserves
              </p>
            </div>
          </button>
        </div>
      ) : (
        /* Unlocked Vault Screen */
        <div className="space-y-5 animate-fade-in">
          {/* Header & Lock Action */}
          <div className="p-4 rounded-2xl bg-[#101014] border border-violet-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-violet-400">
              <Unlock size={17} />
              <span className="text-xs font-black uppercase tracking-wider text-white">Vault Unlocked</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLock} className="text-[10px] text-violet-400">
              Lock Vault
            </Button>
          </div>

          {/* Holdings & Context Display */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1b122c] to-[#120c1e] border border-violet-500/30 flex flex-col justify-between">
              <div className="text-violet-400 text-[10px] font-bold uppercase tracking-wider">
                Vault Reserves
              </div>
              <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
                <AnimatedNumber value={vaultBalance} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#101014] border border-white/5 flex flex-col justify-between">
              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">
                Wallet Cash
              </div>
              <div className="text-xl sm:text-2xl font-black text-zinc-300 mt-1 tabular-nums">
                {formatCurrency(walletBalance)}
              </div>
            </div>
          </div>

          {/* Transfer Form */}
          <div className="p-5 rounded-2xl bg-[#101014] border border-white/5 space-y-4">
            <SegmentedControl<'DEPOSIT' | 'WITHDRAW'>
              options={[
                {
                  id: 'DEPOSIT',
                  label: 'Deposit to Vault',
                  icon: <ArrowUpRight size={13} />,
                  activeColor: 'bg-violet-600 text-white'
                },
                {
                  id: 'WITHDRAW',
                  label: 'Withdraw to Wallet',
                  icon: <ArrowDownLeft size={13} />,
                  activeColor: 'bg-zinc-700 text-white'
                }
              ]}
              value={type}
              onChange={setType}
            />

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">
                  Amount
                </label>
                <div className="flex items-center bg-[#16161c] rounded-xl border border-white/10 p-3">
                  <span className="text-sm font-bold text-zinc-500 mr-2 select-none">PKR</span>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-xl font-black text-white tabular-nums outline-none"
                  />
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
                className="w-full mt-2"
              >
                {type === 'DEPOSIT' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </Button>
            </form>
          </div>

          {/* History Collapsible */}
          {savingsRecords.length > 0 && (
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1 cursor-pointer select-none"
              >
                <span>Vault History ({savingsRecords.length})</span>
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
                      className="p-3 rounded-xl bg-[#101014] border border-white/5 flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
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
                            {r.description}
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
