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

  async function readAndSend(path: string): Promise<boolean> {
    const raw = await fs.readFile(path, 'utf8')
    const run: Run = JSON.parse(raw)
    if (!win.isDestroyed()) win.webContents.send('automations:run-update', run)
    return true
  }

  async function sendRun(path: string) {
    try {
      await readAndSend(path)
    } catch (firstErr) {
      // Mid-write race: chokidar awaitWriteFinish should debounce, but a
      // partial flush still occasionally produces unparseable JSON. Retry
      // once after a short delay; if it still fails, log so the UI freeze
      // is debuggable (otherwise the run badge stays on "running" forever).
      await new Promise(r => setTimeout(r, 150))
      try {
        await readAndSend(path)
      } catch (secondErr) {
        console.error('runs-watcher: gave up on', path, secondErr)
      }
    }
  }
}

export function stopRunsWatcher(): void {
  watcher?.close()
  watcher = null
}
