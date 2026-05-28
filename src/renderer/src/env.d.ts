/// <reference types="vite/client" />

export interface BackupJob {
  id: number
  timestamp: string
  status: 'success' | 'failed' | 'running'
  filesCount: number
  sizeBytes: number
  encrypted: boolean
  durationMs: number
  errorMessage?: string
}

export interface BackupProgress {
  phase: 'compressing' | 'encrypting' | 'done' | 'error'
  filesTotal: number
  filesCopied: number
  bytesTotal: number
  bytesCopied: number
  currentFile?: string
  error?: string
}

export interface StorageInfo {
  sftpPath: string | null
  backupPath: string | null
  sftpFreeBytes: number | null
  sftpTotalBytes: number | null
  sftpUsedBytes: number | null
  backupFreeBytes: number | null
  backupTotalBytes: number | null
}

export interface SMBShareStatus {
  active: boolean
  shareName: string
  path: string | null
  uncPath: string | null
}

export interface SFTPServerStatus {
  running: boolean
  port: number
  username: string
  activeConnections: number
  addresses: string[]
}

declare global {
  interface Window {
    api: {
      config: {
        getAll(): Promise<Record<string, string | null>>
        set(key: string, value: string): Promise<void>
      }
      storage: {
        getInfo(): Promise<StorageInfo>
        selectDirectory(): Promise<string | null>
        validatePath(path: string): Promise<{ valid: boolean; error?: string }>
      }
      backup: {
        run(): Promise<BackupJob>
        getHistory(): Promise<BackupJob[]>
        onProgress(callback: (progress: BackupProgress) => void): () => void
      }
      sftpServer: {
        start(): Promise<SFTPServerStatus>
        stop(): Promise<SFTPServerStatus>
        getStatus(): Promise<SFTPServerStatus>
        onStatusUpdate(callback: (status: SFTPServerStatus) => void): () => void
      }
      smbShare: {
        getStatus(): Promise<SMBShareStatus>
        enable(path: string): Promise<SMBShareStatus>
        disable(): Promise<SMBShareStatus>
      }
    }
  }
}
