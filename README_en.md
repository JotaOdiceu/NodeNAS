# NodeNAS

A Windows desktop app that turns any directory into a storage server accessible over SFTP and the local network (SMB), with automated encrypted backups to an external drive.

## Features

- **SFTP Server** — start/stop the SFTP server, configure port, username, and password. Compatible with FileZilla, WinSCP, rsync, and any SFTP client.
- **SMB Share** — create a native Windows network drive (SMB protocol) pointing to the same SFTP directory, mappable directly from Explorer.
- **Encrypted Backup** — produces a single `.zip` or `.zip.enc` (AES-256-GCM) archive of the SFTP directory to an external backup destination.
- **Dashboard** — overview of storage usage, network access status (SFTP + SMB), and backup history.
- **Settings** — configure directories, SFTP credentials, encryption key, and Windows startup.

## Stack

| Layer       | Technology                                    |
|-------------|-----------------------------------------------|
| Shell       | Electron 31                                   |
| Build       | electron-vite + electron-builder              |
| UI          | React 18 + TypeScript + Tailwind CSS          |
| Backend     | Node.js (Electron main process)               |
| Persistence | JSON (AppData)                                |
| Encryption  | AES-256-GCM + scrypt (Node.js `crypto`)       |
| SFTP        | ssh2                                          |
| Backup/ZIP  | archiver                                      |
| SMB         | PowerShell `New-SmbShare` / `Remove-SmbShare` |

## Requirements

- Windows 10/11 (x64)
- Node.js 20+

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build:win
```

The `.exe` installer will be generated in `release/`.

> **Note:** Creating an SMB share requires administrator confirmation (UAC). The app handles this automatically via `Start-Process -Verb RunAs`.

## Project Structure

```md
src/
  main/
    index.ts                  # main process + IPC handlers
    services/
      config-db.ts            # JSON store (AppData)
      storage.ts              # disk info
      backup.ts               # ZIP + encryption
      sftp-server.ts          # SFTP server (ssh2)
      smb-share.ts            # SMB share via PowerShell
      encryption.ts           # AES-256-GCM
  preload/
    index.ts                  # contextBridge
  renderer/
    src/
      components/
        Dashboard.tsx
        BackupPanel.tsx
        SFTPServer.tsx        # "Network Access" page (SFTP + SMB)
        Settings.tsx
```

## License

[AGPL-3.0-only](LICENSE) — Copyright © 2026 Jota Odiceu

Powered by [jotaodiceu.dev](https://jotaodiceu.dev)
