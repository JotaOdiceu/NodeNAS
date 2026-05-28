import { statSync, accessSync, constants, statfsSync } from 'fs'
import type { ConfigDB } from './config-db'

export interface StorageInfo {
  sftpPath: string | null
  backupPath: string | null
  sftpFreeBytes: number | null
  sftpTotalBytes: number | null
  sftpUsedBytes: number | null
  backupFreeBytes: number | null
  backupTotalBytes: number | null
}

function getDiskStats(dirPath: string): { free: number; total: number; used: number } | null {
  try {
    const s = statfsSync(dirPath)
    return {
      free: s.bfree * s.bsize,
      total: s.blocks * s.bsize,
      used: (s.blocks - s.bfree) * s.bsize
    }
  } catch {
    return null
  }
}

export class StorageService {
  constructor(private db: ConfigDB) {}

  getInfo(): StorageInfo {
    const sftpPath = this.db.get('sftp_path')
    const backupPath = this.db.get('backup_path')

    const sftpStats = sftpPath ? getDiskStats(sftpPath) : null
    const backupStats = backupPath ? getDiskStats(backupPath) : null

    return {
      sftpPath,
      backupPath,
      sftpFreeBytes: sftpStats?.free ?? null,
      sftpTotalBytes: sftpStats?.total ?? null,
      sftpUsedBytes: sftpStats?.used ?? null,
      backupFreeBytes: backupStats?.free ?? null,
      backupTotalBytes: backupStats?.total ?? null
    }
  }

  validatePath(dirPath: string): { valid: boolean; error?: string } {
    try {
      const s = statSync(dirPath)
      if (!s.isDirectory()) return { valid: false, error: 'Caminho não é um diretório' }
      accessSync(dirPath, constants.R_OK | constants.W_OK)
      return { valid: true }
    } catch (err: any) {
      return { valid: false, error: err.message }
    }
  }
}
