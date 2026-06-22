import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { formatCurrency } from '../db/financeUtils';
import { Lock, Unlock, ArrowUpRight, ArrowDownLeft, Calendar, ChevronDown } from 'lucide-react';


export const SavingsVault: React.FC = () => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [showHistory, setShowHistory] = useState(false);

  const savingsRecords = useLiveQuery(() => db.savings.orderBy('date').reverse().toArray()) ?? [];

  const balance = useMemo(() => {
    return savingsRecords.reduce((sum, record) => {
      return record.type === 'DEPOSIT' ? sum + record.amount : sum - record.amount;
    }, 0);
  }, [savingsRecords]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !date) return;

    const numAmount = Number(amount);
    if (type === 'WITHDRAW' && numAmount > balance) {
      alert("Insufficient savings balance!");
      return;
    }

    const desc = description.trim() || (type === 'DEPOSIT' ? 'Deposit to Savings' : 'Withdrawal from Savings');

    const savingsRecordId = await db.savings.add({
      amount: numAmount,
      type,
      date,
      description: desc
    });

    // Add matching transaction to Wallet to deduct/add money
    await db.transactions.add({
      amount: numAmount,
      type: type === 'DEPOSIT' ? 'EXPENSE' : 'INCOME', // Deposit = expense from wallet, Withdraw = income to wallet
      category: 'Savings',
      description: desc,
      date,
      savingsRecordId: savingsRecordId as number
    });

    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Delete this savings log? This will also revert the wallet balance transfer transaction.')) {
      await db.transaction('rw', [db.savings, db.transactions], async () => {
        await db.savings.delete(id);
        // Find and delete matching transactions
        const matchingTx = await db.transactions.filter(tx => tx.savingsRecordId === id).toArray();
        for (const tx of matchingTx) {
          if (tx.id) {
            await db.transactions.delete(tx.id);
          }
        }
      });
    }
  };

  return (
    <div className="w-full relative overflow-hidden">
      {/* Locked Vault Door wrapper */}
      <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        !isUnlocked 
          ? 'grid-rows-[1fr] opacity-100 scale-100' 
          : 'grid-rows-[0fr] opacity-0 scale-95 pointer-events-none'
      }`}>
        <div className="overflow-hidden">
          <button
            type="button"
            onClick={() => setIsUnlocked(true)}
            className="w-full bg-gradient-to-br from-[#1b102f] to-[#12071d] hover:from-[#261543] hover:to-[#170928] border border-violet-500/20 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 group cursor-pointer overflow-hidden relative btn-pop shadow-md shadow-violet-950/20"
          >
            {/* Subtle background glow effect */}
            <div className="absolute inset-0 bg-violet-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none" />
            
            <div className="w-14 h-14 bg-violet-950/40 rounded-full border border-violet-500/30 flex items-center justify-center text-violet-400 group-hover:text-violet-300 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300 relative">
              <Lock size={24} className="stroke-[2.5]" />
            </div>
            
            <div className="text-center">
              <h3 className="text-sm font-bold text-violet-200 tracking-wider uppercase">Savings Vault</h3>
              <p className="text-[10px] text-violet-400/70 font-semibold tracking-widest mt-1">TAP TO UNLOCK & MANAGE</p>
            </div>
          </button>
        </div>
      </div>

      {/* Unlocked Vault Screen wrapper */}
      <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isUnlocked 
          ? 'grid-rows-[1fr] opacity-100 scale-100' 
          : 'grid-rows-[0fr] opacity-0 scale-95 pointer-events-none'
      }`}>
        <div className="overflow-hidden">
          <div className="w-full bg-[#1E1E1E] border border-white/10 rounded-2xl p-5 space-y-5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Unlock size={18} className="text-violet-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Savings Vault</h3>
              </div>
              <button 
                onClick={() => setIsUnlocked(false)} 
                className="text-[10px] font-bold text-violet-400/80 hover:text-violet-300 uppercase tracking-widest border border-violet-500/20 hover:border-violet-500/40 px-2.5 py-1 rounded-lg transition-colors cursor-pointer btn-pop"
              >
                Lock Vault
              </button>
            </div>

            {/* Savings Balance Display */}
            <div className="bg-[#121212] p-5 rounded-xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center">
              <div className="absolute -top-10 -right-10 w-28 h-28 bg-violet-600/10 rounded-full blur-2xl pointer-events-none" />
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">Savings Balance</p>
              <div className="text-3xl font-black text-violet-400 tracking-tight">
                {formatCurrency(balance)}
              </div>
            </div>

            {/* Form to Deposit / Withdraw */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex bg-[#121212] p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setType('DEPOSIT')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${
                    type === 'DEPOSIT' ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/10' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <ArrowUpRight size={14} /> Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setType('WITHDRAW')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs cursor-pointer btn-pop ${
                    type === 'WITHDRAW' ? 'bg-zinc-700 text-white shadow-sm shadow-zinc-700/10' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <ArrowDownLeft size={14} /> Withdraw
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full premium-input focus:border-violet-500/40 text-sm font-bold text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full premium-input focus:border-violet-500/40 text-xs [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase px-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly savings, emergency fund..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full premium-input focus:border-violet-500/40 text-xs"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 rounded-xl hover:brightness-110 text-xs cursor-pointer btn-pop shadow-lg shadow-violet-600/10"
              >
                Add Record
              </button>
            </form>

            {/* History Collapsible */}
            {savingsRecords.length > 0 && (
              <div className="border-t border-white/5 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className="w-full flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider py-1 cursor-pointer btn-pop"
                >
                  <span>Savings History ({savingsRecords.length})</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showHistory ? 'rotate-180' : ''}`} />
                </button>

                <div className={`grid transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  showHistory 
                    ? 'grid-rows-[1fr] opacity-100 mt-3' 
                    : 'grid-rows-[0fr] opacity-0 pointer-events-none'
                }`}>
                  <div className="overflow-hidden">
                    <div className="max-h-52 overflow-y-auto custom-scrollbar p-1 space-y-2">
                      {savingsRecords.map((record) => (
                        <div 
                          key={record.id} 
                          className="bg-[#121212] p-3 rounded-xl border border-white/5 flex items-center justify-between text-xs group"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className={`p-1.5 rounded-lg shrink-0 ${
                              record.type === 'DEPOSIT' ? 'bg-violet-500/10 text-violet-400' : 'bg-zinc-500/10 text-zinc-400'
                            }`}>
                              {record.type === 'DEPOSIT' ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                            </div>
                            <div className="truncate">
                              <div className="font-semibold text-zinc-200 truncate">{record.description}</div>
                              <div className="text-[9px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1">
                                <Calendar size={10} /> {record.date}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-4">
                            <span className={`font-bold ${record.type === 'DEPOSIT' ? 'text-violet-400' : 'text-zinc-400'}`}>
                              {record.type === 'DEPOSIT' ? '+' : '-'}{formatCurrency(record.amount)}
                            </span>
                            <button 
                              onClick={() => record.id && handleDelete(record.id)}
                              className="opacity-0 group-hover:opacity-100 hover:text-rose-450 text-zinc-500 p-1 cursor-pointer btn-pop w-6 h-6 flex items-center justify-center rounded-full hover:bg-rose-500/10 text-sm font-bold"
                              title="Delete"
                            >
                              &times;
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
