import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc-handlers'
import { destroyAllPtySessions } from './claude-bridge'
import { scheduler } from './scheduler'
import { startRunsWatcher, stopRunsWatcher } from './scheduler/runs-watcher'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#F8F9FA',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.on('ready-to-show', () => {
    window.show()
  })

  return window
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.as-ide.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  try {
    await scheduler.init()
  } catch (err) {
    console.error('Scheduler init failed', err)
  }

  registerIpcHandlers()
  mainWindow = createWindow()
  startRunsWatcher(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('before-quit', () => {
  destroyAllPtySessions()
})

app.on('will-quit', stopRunsWatcher)

app.on('window-all-closed', () => {
  app.quit()
})
