import chokidar from 'chokidar'
import { RUNS_DIR } from './paths'
import { promises as fs } from 'fs'
import { BrowserWindow } from 'electron'
import type { Run } from '../../shared/automation-types'

let watcher: chokidar.FSWatcher | null = null

export function startRunsWatcher(win: BrowserWindow): void {
  watcher = chokidar.watch(`${RUNS_DIR}/**/status.json`, {
    ignoreInitial: false,
    depth: 2,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  })
  watcher.on('add', sendRun)
  watcher.on('change', sendRun)

  async function sendRun(path: string) {
    try {
      const raw = await fs.readFile(path, 'utf8')
      const run: Run = JSON.parse(raw)
      if (!win.isDestroyed()) win.webContents.send('automations:run-update', run)
    } catch {}
  }
}

export function stopRunsWatcher(): void {
  watcher?.close()
  watcher = null
}
