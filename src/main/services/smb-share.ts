import { exec } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs'
import { tmpdir, hostname } from 'os'
import { join } from 'path'
import { randomBytes } from 'crypto'
import type { ConfigDB } from './config-db'

const execAsync = promisify(exec)
const SHARE_NAME = 'NodeNAS'

export interface SMBShareStatus {
  active: boolean
  shareName: string
  path: string | null
  uncPath: string | null
}

export class SMBShareService {
  constructor(private db: ConfigDB) {}

  async getStatus(): Promise<SMBShareStatus> {
    try {
      const { stdout } = await execAsync(
        `powershell -NonInteractive -Command "Get-SmbShare -Name '${SHARE_NAME}' -ErrorAction SilentlyContinue | Select-Object Path | ConvertTo-Json"`
      )
      const trimmed = stdout.trim()
      if (trimmed && trimmed !== 'null') {
        const data = JSON.parse(trimmed)
        return {
          active: true,
          shareName: SHARE_NAME,
          path: data.Path ?? null,
          uncPath: `\\\\${hostname()}\\${SHARE_NAME}`
        }
      }
    } catch {}
    return { active: false, shareName: SHARE_NAME, path: null, uncPath: null }
  }

  async enable(path: string): Promise<SMBShareStatus> {
    if (!existsSync(path)) {
      throw new Error(`O diretório não existe: "${path}". Crie-o antes de compartilhar.`)
    }

    const safePath = path.replace(/'/g, "''")
    // Remove existing share and create new one in a single elevated context so that
    // Remove-SmbShare and New-SmbShare always run with the same privilege level.
    await this.runPS(
      `Remove-SmbShare -Name '${SHARE_NAME}' -Force -ErrorAction SilentlyContinue\n` +
      `$everyone = ([System.Security.Principal.SecurityIdentifier]'S-1-1-0').Translate([System.Security.Principal.NTAccount]).Value\n` +
      `New-SmbShare -Name '${SHARE_NAME}' -Path '${safePath}' -FullAccess $everyone -ErrorAction Stop`
    )

    const status = await this.getStatus()
    if (!status.active) {
      throw new Error('Compartilhamento não encontrado após criação. Tente verificar com "net share" no terminal.')
    }
    return status
  }

  async disable(): Promise<SMBShareStatus> {
    await this.runPS(
      `if (Get-SmbShare -Name '${SHARE_NAME}' -ErrorAction SilentlyContinue) {\n` +
      `  Remove-SmbShare -Name '${SHARE_NAME}' -Force -ErrorAction Stop\n` +
      `}`
    )
    return { active: false, shareName: SHARE_NAME, path: null, uncPath: null }
  }

  // Runs a PowerShell command, escalating via UAC when access is denied.
  //
  // Two-phase strategy:
  //   1. Direct run (raw script, no try/catch) — exits with code 1 on error so Node catches it.
  //   2. Elevated run (wrapped script + result file) — Start-Process -Verb RunAs doesn't pipe
  //      stdout back, so the script writes OK/ERR to a temp file that we read afterward.
  private async runPS(psCommand: string): Promise<void> {
    const id = randomBytes(6).toString('hex')
    const scriptFile = join(tmpdir(), `nodenas-${id}.ps1`)
    const resultFile = join(tmpdir(), `nodenas-res-${id}.txt`)
    const safeResult = resultFile.replace(/'/g, "''")

    const rawScript = [`$ErrorActionPreference = 'Stop'`, psCommand].join('\r\n')

    const wrappedScript = [
      `$ErrorActionPreference = 'Stop'`,
      `try {`,
      `  ${psCommand}`,
      `  'OK' | Out-File -FilePath '${safeResult}' -Encoding UTF8`,
      `} catch {`,
      `  "ERR:$($_.Exception.Message)" | Out-File -FilePath '${safeResult}' -Encoding UTF8`,
      `}`
    ].join('\r\n')

    try {
      // Phase 1: try without elevation
      writeFileSync(scriptFile, rawScript, 'utf-8')
      try {
        await execAsync(`powershell -NonInteractive -ExecutionPolicy Bypass -File "${scriptFile}"`)
        return // succeeded without elevation
      } catch {
        // Non-zero exit → need elevation
      }

      // Phase 2: run elevated with result capture
      writeFileSync(scriptFile, wrappedScript, 'utf-8')
      const escaped = scriptFile.replace(/\\/g, '\\\\')
      await execAsync(
        `powershell -Command "Start-Process powershell -ArgumentList '-NonInteractive -ExecutionPolicy Bypass -File \\"${escaped}\\"' -Verb RunAs -Wait"`
      )

      let result: string
      try {
        result = readFileSync(resultFile, 'utf-8').trim()
      } catch {
        throw new Error('O prompt de administrador foi negado ou o UAC foi cancelado.')
      }

      if (result.startsWith('ERR:')) {
        throw new Error(result.substring(4).trim())
      }
    } finally {
      try { unlinkSync(scriptFile) } catch {}
      try { unlinkSync(resultFile) } catch {}
    }
  }
}
