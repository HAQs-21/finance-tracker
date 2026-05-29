import { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { AddTransactionModal } from './components/AddTransactionModal';
import { Plus } from 'lucide-react';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-100 font-sans selection:bg-primary/30 sm:pb-0 pb-[env(safe-area-inset-bottom)] overflow-x-hidden">
      <main className="max-w-md mx-auto px-4 py-6 relative min-h-screen">
        <Dashboard />
        
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 bg-primary text-[#121212] p-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all z-40 group border border-white/10"
          aria-label="Add transaction"
        >
          <Plus size={24} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>

        <AddTransactionModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
        />
      </main>
    </div>
  );
}

export default App;
