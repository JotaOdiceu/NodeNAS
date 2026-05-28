# NodeNAS

Aplicativo desktop para Windows que transforma qualquer diretório em um servidor de armazenamento acessível via SFTP e rede local (SMB), com backup automático criptografado para disco externo.

## Funcionalidades

- **Servidor SFTP** — inicie/pare o servidor SFTP, configure porta, usuário e senha. Compatível com FileZilla, WinSCP, rsync e qualquer cliente SFTP.
- **Compartilhamento SMB** — crie uma unidade de rede nativa do Windows (protocolo SMB) apontada para o mesmo diretório SFTP, mapeável direto pelo Explorer.
- **Backup criptografado** — gera um único arquivo `.zip` ou `.zip.enc` (AES-256-GCM) do diretório SFTP para um destino de backup externo.
- **Dashboard** — visão geral do armazenamento, status da rede (SFTP + SMB) e histórico de backups.
- **Configurações** — define diretórios, credenciais SFTP, criptografia e inicialização automática com o Windows.

## Stack

| Camada       | Tecnologia                                    |
|--------------|-----------------------------------------------|
| Shell        | Electron 31                                   |
| Build        | electron-vite + electron-builder              |
| UI           | React 18 + TypeScript + Tailwind CSS          |
| Backend      | Node.js (processo main do Electron)           |
| Persistência | JSON (AppData)                                |
| Criptografia | AES-256-GCM + scrypt (Node.js `crypto`)       |
| SFTP         | ssh2                                          |
| Backup/ZIP   | archiver                                      |
| SMB          | PowerShell `New-SmbShare` / `Remove-SmbShare` |

## Pré-requisitos

- Windows 10/11 (x64)
- Node.js 20+

## Desenvolvimento

```bash
npm install
npm run dev
```

## Build

```bash
npm run build:win
```

O instalador `.exe` será gerado em `release/`.

> **Nota:** O compartilhamento SMB exige confirmação de administrador (UAC) na primeira criação. O app trata isso automaticamente via `Start-Process -Verb RunAs`.

## Estrutura

```md
src/
  main/
    index.ts                  # processo principal + handlers IPC
    services/
      config-db.ts            # store JSON (AppData)
      storage.ts              # info de disco
      backup.ts               # ZIP + criptografia
      sftp-server.ts          # servidor SFTP (ssh2)
      smb-share.ts            # compartilhamento SMB via PowerShell
      encryption.ts           # AES-256-GCM
  preload/
    index.ts                  # contextBridge
  renderer/
    src/
      components/
        Dashboard.tsx
        BackupPanel.tsx
        SFTPServer.tsx        # página "Acesso à Rede" (SFTP + SMB)
        Settings.tsx
```

## Licença

[AGPL-3.0-only](LICENSE) — Copyright © 2026 Jota Odiceu

Powered by [jotaodiceu.dev](https://jotaodiceu.dev)
