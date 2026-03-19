import chokidar from 'chokidar'
import { BrowserWindow } from 'electron'

let watcher: chokidar.FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const pendingChanges = new Set<string>()

export function startWatching(projectPath: string, window: BrowserWindow): void {
  stopWatching()

  watcher = chokidar.watch(projectPath, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/tmp/**',
      '**/.DS_Store'
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  })

  const flushChanges = () => {
    for (const filePath of pendingChanges) {
      if (!window.isDestroyed()) {
        window.webContents.send('watcher:change', filePath)
      }
    }
    pendingChanges.clear()
  }

  const onFileChange = (filePath: string) => {
    pendingChanges.add(filePath)
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(flushChanges, 100)
  }

  watcher.on('change', onFileChange)
  watcher.on('add', onFileChange)
  watcher.on('unlink', onFileChange)
}

export function stopWatching(): void {
  if (watcher) {
    watcher.close()
    watcher = null
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  pendingChanges.clear()
}
