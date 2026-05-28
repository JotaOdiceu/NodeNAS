import { useState, useEffect } from 'react'
import type { StorageInfo, BackupJob, SFTPServerStatus, SMBShareStatus } from '../env'

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

interface Props {
  onNavigate: (view: 'dashboard' | 'backup' | 'sftp' | 'settings') => void
}

export default function Dashboard({ onNavigate }: Props) {
  const [info, setInfo] = useState<StorageInfo | null>(null)
  const [history, setHistory] = useState<BackupJob[]>([])
  const [serverStatus, setServerStatus] = useState<SFTPServerStatus | null>(null)
  const [smbStatus, setSmbStatus] = useState<SMBShareStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      window.api.storage.getInfo(),
      window.api.backup.getHistory(),
      window.api.sftpServer.getStatus(),
      window.api.smbShare.getStatus()
    ]).then(([i, h, s, smb]) => {
      setInfo(i)
      setHistory(h)
      setServerStatus(s)
      setSmbStatus(smb)
      setLoading(false)
    })

    const unsub = window.api.sftpServer.onStatusUpdate(setServerStatus)
    return unsub
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Carregando...
      </div>
    )
  }

  const lastBackup = history[0]
  const usagePct =
    info?.sftpTotalBytes && info?.sftpUsedBytes
      ? (info.sftpUsedBytes / info.sftpTotalBytes) * 100
      : null

  const notConfigured = !info?.sftpPath || !info?.backupPath

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">Dashboard</h2>

      {notConfigured && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <p className="text-sm text-amber-700">
            Configure o diretório SFTP e o destino de backup para começar.
          </p>
          <button
            onClick={() => onNavigate('settings')}
            className="ml-4 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            Configurar agora
          </button>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Armazenamento SFTP
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                info?.sftpPath
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {info?.sftpPath ? 'Ativo' : 'Não configurado'}
            </span>
          </div>
          {info?.sftpPath ? (
            <>
              <p className="text-xs text-gray-400 truncate mb-3">{info.sftpPath}</p>
              {usagePct !== null && (
                <>
                  <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        usagePct > 90
                          ? 'bg-red-500'
                          : usagePct > 75
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${usagePct}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{formatBytes(info.sftpUsedBytes!)} usado</span>
                    <span>{formatBytes(info.sftpFreeBytes!)} livre</span>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Último Backup
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                lastBackup?.status === 'success'
                  ? 'bg-green-100 text-green-700'
                  : lastBackup?.status === 'failed'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {lastBackup?.status === 'success'
                ? 'Sucesso'
                : lastBackup?.status === 'failed'
                ? 'Falhou'
                : 'Nunca'}
            </span>
          </div>
          {lastBackup ? (
            <>
              <p className="text-sm font-semibold text-gray-800">{formatDate(lastBackup.timestamp)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {lastBackup.filesCount} arquivos · {formatBytes(lastBackup.sizeBytes)}
                {lastBackup.encrypted && ' · Criptografado'}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Nenhum backup realizado</p>
          )}
        </div>

        {/* Network access status */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Acesso à Rede
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                serverStatus?.running || smbStatus?.active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {serverStatus?.running || smbStatus?.active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
          {serverStatus?.running || smbStatus?.active ? (
            <div className="space-y-1">
              {serverStatus?.running && (
                <p className="text-xs text-gray-600">
                  SFTP :{serverStatus.port}
                  {' · '}{serverStatus.activeConnections} {serverStatus.activeConnections === 1 ? 'conexão' : 'conexões'}
                </p>
              )}
              {smbStatus?.active && (
                <p className="text-xs text-gray-600 font-mono truncate">
                  SMB {smbStatus.uncPath}
                </p>
              )}
              <button onClick={() => onNavigate('sftp')} className="text-xs text-blue-500 hover:underline">
                gerenciar
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigate('sftp')}
              className="text-xs text-blue-500 hover:underline"
            >
              Configurar e ligar
            </button>
          )}
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Destino do Backup
            </p>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                info?.backupPath
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {info?.backupPath ? 'Configurado' : 'Não configurado'}
            </span>
          </div>
          {info?.backupPath ? (
            <>
              <p className="text-xs text-gray-400 truncate mb-2">{info.backupPath}</p>
              {info.backupFreeBytes !== null && (
                <p className="text-sm text-gray-600">{formatBytes(info.backupFreeBytes)} livre</p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400">—</p>
          )}
        </div>
      </div>

      {/* Recent backups */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">Backups Recentes</h3>
          {history.length > 0 && (
            <button
              onClick={() => onNavigate('backup')}
              className="text-xs text-blue-600 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Nenhum backup encontrado. Execute o primeiro backup na aba Backup.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3 text-left font-medium">Data</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Arquivos</th>
                <th className="px-5 py-3 text-left font-medium">Tamanho</th>
                <th className="px-5 py-3 text-left font-medium">Criptografia</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 5).map((job) => (
                <tr key={job.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-600">{formatDate(job.timestamp)}</td>
                  <td className="px-5 py-3">
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
                  <td className="px-5 py-3 text-gray-600">{job.filesCount}</td>
                  <td className="px-5 py-3 text-gray-600">{formatBytes(job.sizeBytes)}</td>
                  <td className="px-5 py-3 text-gray-500">
                    {job.encrypted ? (
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        Sim
                      </span>
                    ) : (
                      'Não'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
