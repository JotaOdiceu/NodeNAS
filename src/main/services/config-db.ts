import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'

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

interface StoreData {
  config: Record<string, string>
  backupJobs: BackupJob[]
  nextJobId: number
}

const CONFIG_DEFAULTS: Record<string, string> = {
  backup_schedule: 'manual',
  backup_time: '03:00',
  encryption_enabled: 'false',
  retention_days: '30',
  start_with_windows: 'false',
  sftp_port: '2222',
  sftp_username: 'admin',
  sftp_password: '',
  sftp_server_running: 'false'
}

const SENSITIVE_KEYS = new Set(['sftp_password', 'encryption_key'])
const ENC_PREFIX = 'enc:'

export class ConfigDB {
  private filePath: string
  private data: StoreData

  constructor() {
    const dir = app.getPath('userData')
    mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, 'nodenas.json')
    this.data = this.load()
  }

  private load(): StoreData {
    if (existsSync(this.filePath)) {
      try {
        return JSON.parse(readFileSync(this.filePath, 'utf-8'))
      } catch {}
    }
    return { config: { ...CONFIG_DEFAULTS }, backupJobs: [], nextJobId: 1 }
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8')
  }

  private encrypt(value: string): string {
    if (!safeStorage.isEncryptionAvailable()) return value
    return ENC_PREFIX + safeStorage.encryptString(value).toString('base64')
  }

  private decrypt(value: string): string {
    if (!value.startsWith(ENC_PREFIX)) return value
    if (!safeStorage.isEncryptionAvailable()) return ''
    try {
      return safeStorage.decryptString(Buffer.from(value.slice(ENC_PREFIX.length), 'base64'))
    } catch {
      return ''
    }
  }

  get(key: string): string | null {
    const raw = this.data.config[key] ?? null
    if (raw === null) return null
    return SENSITIVE_KEYS.has(key) ? this.decrypt(raw) : raw
  }

  set(key: string, value: string): void {
    this.data.config[key] = SENSITIVE_KEYS.has(key) ? this.encrypt(value) : value
    this.save()
  }

  getAll(): Record<string, string | null> {
    const merged = { ...CONFIG_DEFAULTS, ...this.data.config }
    const result: Record<string, string | null> = {}
    for (const [k, v] of Object.entries(merged)) {
      result[k] = SENSITIVE_KEYS.has(k) ? this.decrypt(v) : v
    }
    return result
  }

  insertBackupJob(job: Omit<BackupJob, 'id'>): number {
    const id = this.data.nextJobId++
    this.data.backupJobs.unshift({ ...job, id })
    if (this.data.backupJobs.length > 100) {
      this.data.backupJobs = this.data.backupJobs.slice(0, 100)
    }
    this.save()
    return id
  }

  getBackupHistory(limit = 20): BackupJob[] {
    return this.data.backupJobs.slice(0, limit)
  }

  close(): void {
    // no-op — JSON is written synchronously on every mutation
  }
}
