import { useState } from 'react'
import Dashboard from './components/Dashboard'
import BackupPanel from './components/BackupPanel'
import SFTPServer from './components/SFTPServer'
import Settings from './components/Settings'

type View = 'dashboard' | 'backup' | 'sftp' | 'settings'

const NAV: { id: View; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'backup',    label: 'Backup' },
  { id: 'sftp',      label: 'Acesso à Rede' },
  { id: 'settings',  label: 'Configurações' }
]

export default function App() {
  const [view, setView] = useState<View>('dashboard')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <nav className="w-56 flex-shrink-0 bg-[#1e2a3a] flex flex-col select-none">
        <div className="px-6 py-5 border-b border-[#263547]">
          <h1 className="text-white font-bold text-lg tracking-tight">NodeNAS</h1>
          <p className="text-gray-500 text-xs mt-0.5">SFTP Storage Manager</p>
        </div>

        <div className="flex-1 px-3 py-3 space-y-0.5">
          {NAV.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors ${
                view === id
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-gray-400 hover:bg-[#263547] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#263547]">
          <p className="text-gray-600 text-xs">v1.0.0</p>
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-6">
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'backup'    && <BackupPanel />}
        {view === 'sftp'      && <SFTPServer />}
        {view === 'settings'  && <Settings />}
      </main>
    </div>
  )
}
