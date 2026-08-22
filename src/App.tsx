import { Dashboard } from './components/Dashboard';
import { ToastProvider } from './context/ToastContext';

function App() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#08080a] text-zinc-100 font-sans selection:bg-primary/30 pb-[env(safe-area-inset-bottom)]">
        <main className="max-w-md mx-auto px-4 py-4 sm:py-6 relative min-h-screen">
          <Dashboard />
        </main>
      </div>
    </ToastProvider>
  );
}

export default App;


