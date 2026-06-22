import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen bg-[#0C0C0E] text-zinc-100 font-sans selection:bg-primary/30 sm:pb-0 pb-[env(safe-area-inset-bottom)]">
      <main className="max-w-md mx-auto px-4 py-6 relative min-h-screen">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;

