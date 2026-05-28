import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  config: {
    getAll: (): Promise<Record<string, string | null>> =>
      ipcRenderer.invoke('config:get-all'),
    set: (key: string, value: string): Promise<void> =>
      ipcRenderer.invoke('config:set', key, value)
  },
  storage: {
    getInfo: () => ipcRenderer.invoke('storage:get-info'),
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('storage:select-directory'),
    validatePath: (path: string): Promise<{ valid: boolean; error?: string }> =>
      ipcRenderer.invoke('storage:validate-path', path)
  },
  backup: {
    run: () => ipcRenderer.invoke('backup:run'),
    getHistory: () => ipcRenderer.invoke('backup:get-history'),
    onProgress: (callback: (progress: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, p: unknown) => callback(p)
      ipcRenderer.on('backup:progress', handler)
      return () => ipcRenderer.removeListener('backup:progress', handler)
    }
  },
  sftpServer: {
    start: () => ipcRenderer.invoke('sftp-server:start'),
    stop: () => ipcRenderer.invoke('sftp-server:stop'),
    getStatus: () => ipcRenderer.invoke('sftp-server:status'),
    onStatusUpdate: (callback: (status: unknown) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, s: unknown) => callback(s)
      ipcRenderer.on('sftp-server:status-update', handler)
      return () => ipcRenderer.removeListener('sftp-server:status-update', handler)
    }
  },
  smbShare: {
    getStatus: () => ipcRenderer.invoke('smb-share:status'),
    enable: (path: string) => ipcRenderer.invoke('smb-share:enable', path),
    disable: () => ipcRenderer.invoke('smb-share:disable')
  }
})
