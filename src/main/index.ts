import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join } from 'path'
import { ConfigDB } from './services/config-db'
import { StorageService } from './services/storage'
import { BackupService } from './services/backup'
import { SFTPServerService } from './services/sftp-server'
import { SMBShareService } from './services/smb-share'

// Suppress DevTools Autofill CDP warnings (Autofill domain not implemented in Electron)
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')

const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
const configDB = new ConfigDB()
const storageService = new StorageService(configDB)
const backupService = new BackupService(configDB, storageService)
const sftpServer = new SFTPServerService(configDB)
const smbShare = new SMBShareService(configDB)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f0f2f5',
    icon: join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow!.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // F12 toggles DevTools in dev mode without auto-opening (avoids Autofill CDP warnings)
  if (isDev) {
    mainWindow.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') {
        mainWindow!.webContents.toggleDevTools()
      }
    })
  }
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('com.nodenas.app')

  sftpServer.onConnectionChange = () => {
    mainWindow?.webContents.send('sftp-server:status-update', sftpServer.getStatus())
  }

  syncLoginItem()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    sftpServer.stop()
    configDB.close()
    app.quit()
  }
})

function syncLoginItem(): void {
  app.setLoginItemSettings({ openAtLogin: configDB.get('start_with_windows') === 'true' })
}

function registerIpcHandlers(): void {
  // Config
  ipcMain.handle('config:get-all', () => configDB.getAll())
  ipcMain.handle('config:set', (_e, key: string, value: string) => {
    configDB.set(key, value)
    if (key === 'start_with_windows') syncLoginItem()
  })

  // Storage
  ipcMain.handle('storage:get-info', () => storageService.getInfo())
  ipcMain.handle('storage:select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
      title: 'Selecionar Diretório'
    })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle('storage:validate-path', (_e, path: string) =>
    storageService.validatePath(path)
  )

  // Backup
  ipcMain.handle('backup:run', async () => {
    return backupService.runBackup((progress) => {
      mainWindow?.webContents.send('backup:progress', progress)
    })
  })
  ipcMain.handle('backup:get-history', () => backupService.getHistory())

  // SFTP Server
  ipcMain.handle('sftp-server:start', () => {
    sftpServer.start()
    return sftpServer.getStatus()
  })
  ipcMain.handle('sftp-server:stop', () => {
    sftpServer.stop()
    return sftpServer.getStatus()
  })
  ipcMain.handle('sftp-server:status', () => sftpServer.getStatus())

  // SMB Share
  ipcMain.handle('smb-share:status', () => smbShare.getStatus())
  ipcMain.handle('smb-share:enable', (_e, path: string) => smbShare.enable(path))
  ipcMain.handle('smb-share:disable', () => smbShare.disable())
}
