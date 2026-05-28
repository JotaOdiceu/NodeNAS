import { Server } from 'ssh2'
import type { Connection } from 'ssh2'
import {
  openSync, closeSync, readSync, writeSync, fstatSync,
  statSync, readdirSync, mkdirSync, unlinkSync, renameSync,
  existsSync, writeFileSync, readFileSync, rmdirSync
} from 'fs'
import { join, resolve as resolvePath, normalize, sep } from 'path'
import { generateKeyPairSync, randomUUID } from 'crypto'
import { networkInterfaces } from 'os'
import { app } from 'electron'
import type { ConfigDB } from './config-db'

const STATUS = {
  OK: 0, EOF: 1, NO_SUCH_FILE: 2, PERMISSION_DENIED: 3, FAILURE: 4, OP_UNSUPPORTED: 8
} as const

// SFTP open flag bitmask (SSH filexfer protocol)
const F_READ = 0x01, F_WRITE = 0x02, F_APPEND = 0x04, F_CREAT = 0x08, F_TRUNC = 0x10

interface FileHandle { type: 'file'; fd: number }
interface DirHandle  { type: 'dir'; entries: any[]; pos: number }
type Handle = FileHandle | DirHandle

export interface SFTPServerStatus {
  running: boolean
  port: number
  username: string
  activeConnections: number
  addresses: string[]
}

export class SFTPServerService {
  private server: InstanceType<typeof Server> | null = null
  private activeConnections = 0
  onConnectionChange?: () => void

  constructor(private db: ConfigDB) {}

  start(): void {
    if (this.server) return

    const port     = parseInt(this.db.get('sftp_port')     ?? '2222')
    const username = this.db.get('sftp_username')          ?? 'admin'
    const password = this.db.get('sftp_password')          ?? ''
    const rootDir  = this.db.get('sftp_path')              ?? ''

    if (!rootDir)  throw new Error('Diretório SFTP não configurado')
    if (!password) throw new Error('Senha do servidor SFTP não configurada')

    const hostKey = this.getOrCreateHostKey()

    this.server = new Server({ hostKeys: [hostKey] }, (client: Connection) => {
      this.activeConnections++
      this.onConnectionChange?.()

      client.on('authentication', (ctx) => {
        if (ctx.method === 'password' && ctx.username === username && (ctx as any).password === password) {
          ctx.accept()
        } else {
          ctx.reject(['password'])
        }
      })

      client.on('ready', () => {
        client.on('session', (accept) => {
          const session = accept()
          session.on('sftp', (accept) => {
            const sftp = accept()
            this.handleSFTP(sftp, rootDir)
          })
        })
      })

      const dec = () => { this.activeConnections = Math.max(0, this.activeConnections - 1); this.onConnectionChange?.() }
      client.on('end',   dec)
      client.on('error', dec)
    })

    this.server.listen(port, '0.0.0.0', () => {
      this.db.set('sftp_server_running', 'true')
    })

    this.server.on('error', (err) => console.error('[SFTPServer]', err))
  }

  stop(): void {
    if (this.server) {
      this.server.close()
      this.server = null
      this.activeConnections = 0
    }
    this.db.set('sftp_server_running', 'false')
  }

  isRunning(): boolean {
    return this.server !== null
  }

  getStatus(): SFTPServerStatus {
    const nets = networkInterfaces()
    const addresses: string[] = []
    for (const iface of Object.values(nets)) {
      for (const net of iface ?? []) {
        if (net.family === 'IPv4' && !net.internal) addresses.push(net.address)
      }
    }

    return {
      running: this.isRunning(),
      port: parseInt(this.db.get('sftp_port') ?? '2222'),
      username: this.db.get('sftp_username') ?? 'admin',
      activeConnections: this.activeConnections,
      addresses
    }
  }

  private getOrCreateHostKey(): Buffer {
    const keyPath = join(app.getPath('userData'), 'sftp_host_key.pem')
    if (existsSync(keyPath)) return readFileSync(keyPath)

    const { privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    })
    writeFileSync(keyPath, privateKey, { mode: 0o600 })
    return Buffer.from(privateKey)
  }

  private safePath(rootDir: string, reqPath: string): string | null {
    const full = resolvePath(join(rootDir, normalize(reqPath)))
    return full === rootDir || full.startsWith(rootDir + sep) ? full : null
  }

  private handleSFTP(sftp: any, rootDir: string): void {
    const handles = new Map<string, Handle>()
    let seq = 0
    const newHandle = () => { const h = Buffer.alloc(4); h.writeUInt32BE(seq++); return h }
    const hk = (h: Buffer) => h.toString('hex')

    sftp.on('REALPATH', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      const rel = '/' + full.slice(rootDir.length).replace(/\\/g, '/').replace(/^\//, '')
      sftp.name(reqid, [{ filename: rel || '/', longname: rel || '/', attrs: {} }])
    })

    const statAttrs = (p: string) => {
      const s = statSync(p)
      return { mode: s.mode, uid: 0, gid: 0, size: s.size, atime: Math.floor(s.atimeMs / 1000), mtime: Math.floor(s.mtimeMs / 1000) }
    }

    sftp.on('STAT',  (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { sftp.attrs(reqid, statAttrs(full)) } catch { sftp.status(reqid, STATUS.NO_SUCH_FILE) }
    })

    sftp.on('LSTAT', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { sftp.attrs(reqid, statAttrs(full)) } catch { sftp.status(reqid, STATUS.NO_SUCH_FILE) }
    })

    sftp.on('OPENDIR', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try {
        const raw = readdirSync(full, { withFileTypes: true })
        const entries = raw.map((e) => {
          let attrs: any = {}
          try { attrs = statAttrs(join(full, e.name)) } catch {}
          const prefix = e.isDirectory() ? 'd' : '-'
          return {
            filename: e.name,
            longname: `${prefix}rwxr-xr-x 1 user group ${attrs.size ?? 0} Jan  1 00:00 ${e.name}`,
            attrs
          }
        })
        const h = newHandle()
        handles.set(hk(h), { type: 'dir', entries, pos: 0 })
        sftp.handle(reqid, h)
      } catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('READDIR', (reqid: number, handle: Buffer) => {
      const h = handles.get(hk(handle)) as DirHandle | undefined
      if (!h || h.type !== 'dir') return sftp.status(reqid, STATUS.FAILURE)
      if (h.pos >= h.entries.length) return sftp.status(reqid, STATUS.EOF)
      const batch = h.entries.slice(h.pos, h.pos + 50)
      h.pos += batch.length
      sftp.name(reqid, batch)
    })

    sftp.on('OPEN', (reqid: number, path: string, flags: number, _attrs: any) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)

      let nodeFlags = 'r'
      if (flags & F_WRITE) {
        if ((flags & F_CREAT) && (flags & F_TRUNC)) nodeFlags = 'w'
        else if (flags & F_CREAT) nodeFlags = 'a+'
        else if (flags & F_APPEND) nodeFlags = 'a'
        else nodeFlags = 'r+'
      }

      try {
        const fd = openSync(full, nodeFlags)
        const h = newHandle()
        handles.set(hk(h), { type: 'file', fd })
        sftp.handle(reqid, h)
      } catch (err: any) {
        sftp.status(reqid, err.code === 'ENOENT' ? STATUS.NO_SUCH_FILE : STATUS.FAILURE)
      }
    })

    sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
      const h = handles.get(hk(handle)) as FileHandle | undefined
      if (!h || h.type !== 'file') return sftp.status(reqid, STATUS.FAILURE)
      const buf = Buffer.alloc(length)
      try {
        const n = readSync(h.fd, buf, 0, length, offset)
        if (n === 0) return sftp.status(reqid, STATUS.EOF)
        sftp.data(reqid, buf.subarray(0, n))
      } catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('WRITE', (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
      const h = handles.get(hk(handle)) as FileHandle | undefined
      if (!h || h.type !== 'file') return sftp.status(reqid, STATUS.FAILURE)
      try { writeSync(h.fd, data, 0, data.length, offset); sftp.status(reqid, STATUS.OK) }
      catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('FSTAT', (reqid: number, handle: Buffer) => {
      const h = handles.get(hk(handle)) as FileHandle | undefined
      if (!h || h.type !== 'file') return sftp.status(reqid, STATUS.FAILURE)
      try {
        const s = fstatSync(h.fd)
        sftp.attrs(reqid, { mode: s.mode, uid: 0, gid: 0, size: s.size, atime: Math.floor(s.atimeMs / 1000), mtime: Math.floor(s.mtimeMs / 1000) })
      } catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('CLOSE', (reqid: number, handle: Buffer) => {
      const h = handles.get(hk(handle))
      if (!h) return sftp.status(reqid, STATUS.FAILURE)
      if (h.type === 'file') try { closeSync(h.fd) } catch {}
      handles.delete(hk(handle))
      sftp.status(reqid, STATUS.OK)
    })

    sftp.on('MKDIR', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { mkdirSync(full); sftp.status(reqid, STATUS.OK) }
      catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('REMOVE', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { unlinkSync(full); sftp.status(reqid, STATUS.OK) }
      catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('RMDIR', (reqid: number, path: string) => {
      const full = this.safePath(rootDir, path)
      if (!full) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { rmdirSync(full); sftp.status(reqid, STATUS.OK) }
      catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('RENAME', (reqid: number, oldPath: string, newPath: string) => {
      const fullOld = this.safePath(rootDir, oldPath)
      const fullNew = this.safePath(rootDir, newPath)
      if (!fullOld || !fullNew) return sftp.status(reqid, STATUS.PERMISSION_DENIED)
      try { renameSync(fullOld, fullNew); sftp.status(reqid, STATUS.OK) }
      catch { sftp.status(reqid, STATUS.FAILURE) }
    })

    sftp.on('SETSTAT',  (reqid: number) => sftp.status(reqid, STATUS.OK))
    sftp.on('FSETSTAT', (reqid: number) => sftp.status(reqid, STATUS.OK))
  }
}
