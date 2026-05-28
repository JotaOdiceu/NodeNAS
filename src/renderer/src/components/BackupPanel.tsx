import { useState, useEffect } from 'react'
import type { BackupJob, BackupProgress } from '../env'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR')
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

const PHASE_LABEL: Record<BackupProgress['phase'], string> = {
  compressing: 'Comprimindo arquivos (ZIP)...',
  encrypting: 'Criptografando arquivo...',
  done: 'Backup concluído com sucesso!',
  error: 'Erro durante o backup'
}

export default function BackupPanel() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<BackupProgress | null>(null)
  const [history, setHistory] = useState<BackupJob[]>([])
  const [config, setConfig] = useState<Record<string, string | null>>({})

  useEffect(() => {
    window.api.backup.getHistory().then(setHistory)
    window.api.config.getAll().then(setConfig)

    const unsub = window.api.backup.onProgress(setProgress)
    return unsub
  }, [])

  const canRun = !!config.sftp_path && !!config.backup_path && !running

  const handleRun = async () => {
    setRunning(true)
    setProgress(null)
    try {
      await window.api.backup.run()
      const updated = await window.api.backup.getHistory()
      setHistory(updated)
    } catch {
      // progress state already reflects the error via IPC
    } finally {
      setRunning(false)
    }
  }

  const pct =
    progress && progress.filesTotal > 0
      ? Math.round((progress.filesCopied / progress.filesTotal) * 100)
      : 0

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">Backup</h2>

      {/* Run card */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 mb-2">Executar Backup Manual</h3>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Origem: </span>
                {config.sftp_path ?? (
                  <span className="text-amber-600">não configurado</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Destino: </span>
                {config.backup_path ?? (
                  <span className="text-amber-600">não configurado</span>
                )}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-600">Criptografia: </span>
                {config.encryption_enabled === 'true' ? 'AES-256 ativado' : 'desativada'}
              </p>
            </div>
          </div>
          <button
            onClick={handleRun}
            disabled={!canRun}
            className={`flex-shrink-0 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              canRun
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {running ? 'Executando...' : 'Executar Agora'}
          </button>
        </div>

        {/* Progress */}
        {progress && (
          <div
            className={`mt-5 p-4 rounded-lg ${
              progress.phase === 'error'
                ? 'bg-red-50'
                : progress.phase === 'done'
                ? 'bg-green-50'
                : 'bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={`text-sm font-medium ${
                  progress.phase === 'error'
                    ? 'text-red-700'
                    : progress.phase === 'done'
                    ? 'text-green-700'
                    : 'text-gray-700'
                }`}
              >
                {PHASE_LABEL[progress.phase]}
              </span>
              {progress.filesTotal > 0 && (
                <span className="text-xs text-gray-500">
                  {progress.filesCopied}/{progress.filesTotal} arquivos
                </span>
              )}
            </div>
            {progress.filesTotal > 0 && (
              <>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      progress.phase === 'error'
                        ? 'bg-red-500'
                        : progress.phase === 'done'
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{progress.currentFile ?? ''}</span>
                  <span>{pct}%</span>
                </div>
              </>
            )}
            {progress.error && (
              <p className="text-xs text-red-600 mt-1">{progress.error}</p>
            )}
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm">Histórico de Backups</h3>
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum backup realizado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="px-6 py-3 text-left font-medium">Data</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Arquivos</th>
                  <th className="px-6 py-3 text-left font-medium">Tamanho</th>
                  <th className="px-6 py-3 text-left font-medium">Duração</th>
                  <th className="px-6 py-3 text-left font-medium">Criptografia</th>
                </tr>
              </thead>
              <tbody>
                {history.map((job) => (
                  <tr
                    key={job.id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50"
                    title={job.errorMessage}
                  >
                    <td className="px-6 py-3 text-gray-600">{formatDate(job.timestamp)}</td>
                    <td className="px-6 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.status === 'success'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {job.status === 'success' ? 'Sucesso' : 'Falhou'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{job.filesCount}</td>
                    <td className="px-6 py-3 text-gray-600">{formatBytes(job.sizeBytes)}</td>
                    <td className="px-6 py-3 text-gray-600">{formatDuration(job.durationMs)}</td>
                    <td className="px-6 py-3">
                      {job.encrypted ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          AES-256
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
