import { useState, useEffect } from 'react'
import type { SFTPServerStatus, SMBShareStatus } from '../env'

// ─── SMB Share Section ────────────────────────────────────────────────────────

function SMBSection({ sftpPath }: { sftpPath: string | null }) {
  const [status, setStatus] = useState<SMBShareStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    window.api.smbShare.getStatus().then(setStatus)
  }, [])

  const toggle = async () => {
    setLoading(true)
    try {
      const next = status?.active
        ? await window.api.smbShare.disable()
        : await window.api.smbShare.enable(sftpPath!)
      setStatus(next)
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canEnable = !!sftpPath

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Unidade de Rede Windows (SMB)</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Mapeia o diretório SFTP como pasta de rede nativa no Windows.
            {' '}Requer confirmação de administrador.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status?.active ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{status?.active ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      {status?.active && status.uncPath && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-1">Caminho UNC</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm font-mono text-gray-800 bg-white border border-gray-200 rounded px-2 py-1 truncate">
              {status.uncPath}
            </code>
            <button
              onClick={() => copy(status.uncPath!)}
              className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600 whitespace-nowrap"
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            No Windows Explorer: cole o caminho na barra de endereço ou use
            {' '}<span className="font-mono">Mapear unidade de rede</span>.
          </p>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <button
          onClick={toggle}
          disabled={loading || (!status?.active && !canEnable)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            status?.active
              ? 'bg-red-500 text-white hover:bg-red-600'
              : canEnable
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {loading ? 'Aguardando...' : status?.active ? 'Remover compartilhamento' : 'Criar compartilhamento'}
        </button>
        {!canEnable && !status?.active && (
          <span className="text-xs text-amber-600">Configure o diretório SFTP primeiro.</span>
        )}
      </div>

      {!status?.active && (
        <p className="text-xs text-gray-400 mt-3">
          Um prompt de permissão de administrador (UAC) será exibido para criar o compartilhamento.
        </p>
      )}
    </div>
  )
}

// ─── SFTP Server Section ──────────────────────────────────────────────────────

function SFTPSection() {
  const [status, setStatus] = useState<SFTPServerStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [config, setConfig] = useState<Record<string, string | null>>({})
  const [editPass, setEditPass] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)

  useEffect(() => {
    window.api.sftpServer.getStatus().then(setStatus)
    window.api.config.getAll().then(setConfig)

    const unsub = window.api.sftpServer.onStatusUpdate(setStatus)
    return unsub
  }, [])

  const save = async (key: string, value: string) => {
    await window.api.config.set(key, value)
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSavedField(key)
    setTimeout(() => setSavedField(null), 2000)
  }

  const toggle = async () => {
    setLoading(true)
    try {
      const next = status?.running
        ? await window.api.sftpServer.stop()
        : await window.api.sftpServer.start()
      setStatus(next)
    } catch (err: any) {
      alert(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const canStart = !!config.sftp_path && !!config.sftp_password

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 text-sm">Servidor SFTP</h3>
          <p className="text-xs text-gray-400 mt-0.5">Para clientes como FileZilla, WinSCP, rsync.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${status?.running ? 'bg-green-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">
              {status?.running
                ? `Online · ${status.activeConnections} ${status.activeConnections === 1 ? 'conexão' : 'conexões'}`
                : 'Offline'}
            </span>
          </div>
          <button
            onClick={toggle}
            disabled={loading || (!status?.running && !canStart)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status?.running
                ? 'bg-red-500 text-white hover:bg-red-600'
                : canStart
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? '...' : status?.running ? 'Desligar' : 'Ligar'}
          </button>
        </div>
      </div>

      {status?.running && status.addresses.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs font-medium text-gray-500 mb-2">Endereços</p>
          {status.addresses.map((addr) => (
            <code key={addr} className="block text-sm font-mono text-gray-700">
              {addr}:{status.port}
            </code>
          ))}
          <p className="text-xs text-gray-400 mt-1">Usuário: <span className="font-medium">{status.username}</span></p>
        </div>
      )}

      {/* Config fields */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Porta</label>
          <input
            type="number" min={1024} max={65535}
            value={config.sftp_port ?? '2222'}
            onChange={(e) => save('sftp_port', e.target.value)}
            disabled={status?.running}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Usuário</label>
          <input
            type="text"
            value={config.sftp_username ?? 'admin'}
            onChange={(e) => save('sftp_username', e.target.value)}
            disabled={status?.running}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Senha</label>
          <div className="flex gap-1.5">
            <input
              type="password"
              value={editPass}
              onChange={(e) => setEditPass(e.target.value)}
              placeholder={config.sftp_password ? '••••••' : 'Definir'}
              disabled={status?.running}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={async () => { if (!editPass.trim()) return; await save('sftp_password', editPass); setEditPass('') }}
              disabled={!editPass.trim() || status?.running}
              className="px-2 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              OK
            </button>
          </div>
        </div>
      </div>

      {savedField && (
        <p className="text-xs text-green-600 mt-2">Salvo</p>
      )}
      {!canStart && !status?.running && (
        <p className="text-xs text-amber-600 mt-2">Configure o diretório SFTP e defina uma senha para ligar.</p>
      )}
      {status?.running && (
        <p className="text-xs text-gray-400 mt-2">Desligue o servidor para alterar configurações.</p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NetworkAccess() {
  const [sftpPath, setSftpPath] = useState<string | null>(null)

  useEffect(() => {
    window.api.config.getAll().then((c) => setSftpPath(c.sftp_path ?? null))
  }, [])

  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-xl font-bold text-gray-800 mb-5">Acesso à Rede</h2>
      <SMBSection sftpPath={sftpPath} />
      <SFTPSection />
    </div>
  )
}
