import { mkdirSync, unlinkSync, createWriteStream } from 'fs'
import { join } from 'path'
import archiver from 'archiver'
import type { ConfigDB, BackupJob } from './config-db'
import type { StorageService } from './storage'
import { EncryptionService } from './encryption'

export interface BackupProgress {
  phase: 'compressing' | 'encrypting' | 'done' | 'error'
  filesTotal: number
  filesCopied: number
  bytesTotal: number
  bytesCopied: number
  currentFile?: string
  error?: string
}

export class BackupService {
  private encryption = new EncryptionService()

  constructor(
    private db: ConfigDB,
    private storage: StorageService
  ) {}

  async runBackup(onProgress: (p: BackupProgress) => void): Promise<BackupJob> {
    const sftpPath = this.db.get('sftp_path')
    const backupPath = this.db.get('backup_path')
    const encrypted = this.db.get('encryption_enabled') === 'true'
    const password = this.db.get('encryption_password')

    if (!sftpPath) throw new Error('Caminho SFTP não configurado')
    if (!backupPath) throw new Error('Caminho de backup não configurado')
    if (encrypted && !password) throw new Error('Senha de criptografia não configurada')

    const timestamp = new Date().toISOString()
    const safeName = timestamp.replace(/[:.]/g, '-')
    const zipPath = join(backupPath, `backup_${safeName}.zip`)
    const finalPath = encrypted ? zipPath + '.enc' : zipPath
    const startTime = Date.now()

    onProgress({ phase: 'compressing', filesTotal: 0, filesCopied: 0, bytesTotal: 0, bytesCopied: 0 })

    try {
      mkdirSync(backupPath, { recursive: true })

      const { fileCount, sizeBytes } = await this.createZip(sftpPath, zipPath, (p) =>
        onProgress({ ...p, phase: 'compressing' })
      )

      if (encrypted && password) {
        onProgress({ phase: 'encrypting', filesTotal: fileCount, filesCopied: fileCount, bytesTotal: sizeBytes, bytesCopied: sizeBytes })
        this.encryption.encryptFile(zipPath, finalPath, password)
        unlinkSync(zipPath)
      }

      onProgress({ phase: 'done', filesTotal: fileCount, filesCopied: fileCount, bytesTotal: sizeBytes, bytesCopied: sizeBytes })

      const job: Omit<BackupJob, 'id'> = {
        timestamp, status: 'success', filesCount: fileCount,
        sizeBytes, encrypted, durationMs: Date.now() - startTime
      }
      const id = this.db.insertBackupJob(job)
      return { ...job, id }
    } catch (err: any) {
      try { unlinkSync(zipPath) } catch {}
      try { unlinkSync(finalPath) } catch {}

      const job: Omit<BackupJob, 'id'> = {
        timestamp, status: 'failed', filesCount: 0, sizeBytes: 0,
        encrypted, durationMs: Date.now() - startTime, errorMessage: err.message
      }
      this.db.insertBackupJob(job)
      onProgress({ phase: 'error', filesTotal: 0, filesCopied: 0, bytesTotal: 0, bytesCopied: 0, error: err.message })
      throw err
    }
  }

  private createZip(
    sourceDir: string,
    destPath: string,
    onProgress: (p: Omit<BackupProgress, 'phase'>) => void
  ): Promise<{ fileCount: number; sizeBytes: number }> {
    return new Promise((resolve, reject) => {
      const output = createWriteStream(destPath)
      const archive = archiver('zip', { zlib: { level: 6 } })
      let lastProgress = { filesTotal: 0, filesCopied: 0, bytesTotal: 0, bytesCopied: 0 }

      archive.on('progress', (data) => {
        lastProgress = {
          filesTotal: data.entries.total,
          filesCopied: data.entries.processed,
          bytesTotal: data.fs.totalBytes,
          bytesCopied: data.fs.processedBytes
        }
        onProgress(lastProgress)
      })

      output.on('close', () => resolve({ fileCount: lastProgress.filesCopied, sizeBytes: archive.pointer() }))
      archive.on('error', reject)

      archive.pipe(output)
      archive.directory(sourceDir, false)
      archive.finalize()
    })
  }

  getHistory(limit = 20): BackupJob[] {
    return this.db.getBackupHistory(limit)
  }
}
