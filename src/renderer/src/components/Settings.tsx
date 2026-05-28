import { useState, useEffect } from 'react'

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}

export default function Settings() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<string | null>(null)
  const [validating, setValidating] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    window.api.config.getAll().then((c) => setConfig((c as Record<string, string>) ?? {}))
  }, [])

  const save = async (key: string, value: string) => {
    await window.api.config.set(key, value)
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  const selectDir = async (key: string) => {
    const path = await window.api.storage.selectDirectory()
    if (!path) return
    setValidating(key)
    const result = await window.api.storage.validatePath(path)
    setValidating(null)
    if (result.valid) {
      await save(key, path)
    } else {
      alert(`Caminho inválido: ${result.error}`)
    }
  }

  const savedBadge = (key: string) =>
    saved === key ? (
      <p className="text-xs text-green-600 mt-2">Salvo</p>
    ) : null

  return (
    <div className="max-w-xl space-y-4">
      <h2 className="text-xl font-bold text-gray-800 mb-5">Configurações</h2>

      {/* SFTP Directory */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Diretório SFTP</h3>
        <p className="text-xs text-gray-400 mb-3">
          Pasta raiz onde os arquivos SFTP são armazenados localmente.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={config.sftp_path || ''}
            placeholder="Nenhum diretório selecionado"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 truncate"
          />
          <button
            onClick={() => selectDir('sftp_path')}
            disabled={validating === 'sftp_path'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {validating === 'sftp_path' ? 'Validando...' : 'Selecionar'}
          </button>
        </div>
        {savedBadge('sftp_path')}
      </section>

      {/* Backup Destination */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Destino do Backup</h3>
        <p className="text-xs text-gray-400 mb-3">
          Unidade externa ou pasta onde os backups serão gravados.
        </p>
        <div className="flex gap-2">
          <input
            readOnly
            value={config.backup_path || ''}
            placeholder="Nenhum destino selecionado"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 truncate"
          />
          <button
            onClick={() => selectDir('backup_path')}
            disabled={validating === 'backup_path'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
          >
            {validating === 'backup_path' ? 'Validando...' : 'Selecionar'}
          </button>
        </div>
        {savedBadge('backup_path')}
      </section>

      {/* Schedule */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Agendamento</h3>
        <p className="text-xs text-gray-400 mb-3">Frequência de backup automático.</p>
        <div className="flex items-center gap-3">
          <select
            value={config.backup_schedule || 'manual'}
            onChange={(e) => save('backup_schedule', e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
          >
            <option value="manual">Manual</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
          </select>
          {config.backup_schedule && config.backup_schedule !== 'manual' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">às</span>
              <input
                type="time"
                value={config.backup_time || '03:00'}
                onChange={(e) => save('backup_time', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          )}
        </div>
      </section>

      {/* Encryption */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Criptografia de Backup</h3>
        <p className="text-xs text-gray-400 mb-3">
          AES-256-GCM. Apenas o backup é criptografado — os arquivos originais permanecem intactos.
        </p>
        <label className="flex items-center gap-3 mb-3 cursor-pointer">
          <Toggle
            checked={config.encryption_enabled === 'true'}
            onChange={(v) => save('encryption_enabled', String(v))}
          />
          <span className="text-sm text-gray-700">Habilitar criptografia</span>
        </label>
        {config.encryption_enabled === 'true' && (
          <div className="flex gap-2 mt-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nova senha do backup"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
            <button
              onClick={async () => {
                if (!newPassword.trim()) return
                await save('encryption_password', newPassword)
                setNewPassword('')
              }}
              disabled={!newPassword.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Salvar senha
            </button>
          </div>
        )}
        {config.encryption_enabled === 'true' && config.encryption_password && (
          <p className="text-xs text-gray-400 mt-2">Senha definida. Redefina digitando uma nova senha acima.</p>
        )}
        {savedBadge('encryption_enabled')}
        {savedBadge('encryption_password')}
      </section>

      {/* Retention */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Retenção</h3>
        <p className="text-xs text-gray-400 mb-3">
          Backups mais antigos que este período podem ser removidos manualmente.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={365}
            value={config.retention_days || '30'}
            onChange={(e) => save('retention_days', e.target.value)}
            className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center"
          />
          <span className="text-sm text-gray-500">dias</span>
        </div>
        {savedBadge('retention_days')}
      </section>

      {/* System */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-semibold text-gray-800 text-sm mb-0.5">Sistema</h3>
        <p className="text-xs text-gray-400 mb-3">Preferências do sistema operacional.</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <Toggle
            checked={config.start_with_windows === 'true'}
            onChange={(v) => save('start_with_windows', String(v))}
          />
          <span className="text-sm text-gray-700">Iniciar com o Windows</span>
        </label>
        {savedBadge('start_with_windows')}
      </section>
    </div>
  )
}
