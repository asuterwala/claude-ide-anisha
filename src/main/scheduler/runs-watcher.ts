import chokidar from 'chokidar'
import { RUNS_DIR } from './paths'
import { promises as fs } from 'fs'
import { BrowserWindow } from 'electron'
import type { Run } from '../../shared/automation-types'

let watcher: chokidar.FSWatcher | null = null

export function startRunsWatcher(win: BrowserWindow): void {
  // Chokidar 4 removed glob support, so we watch the runs directory
  // directly and filter for status.json files inline. The previous
  // `${RUNS_DIR}/**/status.json` glob was being treated as a literal
  // (nonexistent) path, which meant the watcher silently no-op'd for
  // every new run dir created after IDE startup — only the initial disk
  // read at app load picked anything up.
  watcher = chokidar.watch(RUNS_DIR, {
    ignoreInitial: false,
    depth: 2,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  })
  const onEvent = (path: string) => {
    if (path.endsWith('/status.json')) sendRun(path)
  }
  watcher.on('add', onEvent)
  watcher.on('change', onEvent)

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
