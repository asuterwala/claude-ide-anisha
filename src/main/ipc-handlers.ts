import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { join, relative } from 'path'
import { getGitFileStatuses, getGitBranch } from './git-status'
import { createPtySession, writePty, resizePty, destroyPty } from './claude-bridge'
import { startWatching, stopWatching } from './file-watcher'
import type { FileNode, RecentSession } from '../shared/types'

const sessionsFile = () => join(app.getPath('userData'), 'recent-sessions.json')

async function loadRecentSessions(): Promise<RecentSession[]> {
  try {
    const data = await readFile(sessionsFile(), 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

async function saveRecentSessions(sessions: RecentSession[]): Promise<void> {
  await writeFile(sessionsFile(), JSON.stringify(sessions, null, 2), 'utf-8')
}

export function registerIpcHandlers(): void {
  ipcMain.handle('fs:readDir', async (_, dirPath: string): Promise<FileNode[]> => {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const nodes: FileNode[] = []
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = join(dirPath, entry.name)
      const info = await stat(fullPath).catch(() => null)
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: info?.isFile() ? info.size : undefined,
        gitStatus: null
      })
    }
    nodes.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return nodes
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string): Promise<string> => {
    return readFile(filePath, 'utf-8')
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string): Promise<void> => {
    await writeFile(filePath, content, 'utf-8')
  })

  ipcMain.handle('git:status', async (_, projectPath: string) => {
    const statuses = await getGitFileStatuses(projectPath)
    return Object.fromEntries(statuses)
  })

  ipcMain.handle('git:branch', async (_, projectPath: string) => {
    return getGitBranch(projectPath)
  })

  ipcMain.handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('sessions:getRecent', async () => {
    return loadRecentSessions()
  })

  ipcMain.handle('sessions:addRecent', async (_, projectPath: string) => {
    const sessions = await loadRecentSessions()
    const existing = sessions.findIndex(s => s.projectPath === projectPath)
    if (existing >= 0) sessions.splice(existing, 1)
    sessions.unshift({ projectPath, branch: null, lastOpened: Date.now() })
    if (sessions.length > 20) sessions.length = 20
    await saveRecentSessions(sessions)
  })

  ipcMain.handle('pty:create', async (event, projectPath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No window found')
    try {
      const id = createPtySession(projectPath, window)
      console.log('[pty:create] Success, id:', id)
      return id
    } catch (err) {
      console.error('[pty:create] Error:', err)
      throw err
    }
  })

  ipcMain.on('pty:write', (_, id: string, data: string) => {
    writePty(id, data)
  })

  ipcMain.on('pty:resize', (_, id: string, cols: number, rows: number) => {
    resizePty(id, cols, rows)
  })

  ipcMain.on('pty:destroy', (_, id: string) => {
    destroyPty(id)
  })

  ipcMain.handle('watcher:start', async (event, projectPath: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No window found')
    startWatching(projectPath, window)
  })

  ipcMain.handle('watcher:stop', async () => {
    stopWatching()
  })

  // Recursively list all files in a project (for Cmd+P quick open)
  ipcMain.handle('fs:listAllFiles', async (_, projectPath: string): Promise<string[]> => {
    const results: string[] = []
    const ignoreDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'out', 'tmp', '.cache', 'coverage', 'build'])

    async function walk(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue
        if (ignoreDirs.has(entry.name)) continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          results.push(relative(projectPath, fullPath))
        }
      }
    }

    await walk(projectPath)
    results.sort()
    return results
  })

  // Search file contents (for Cmd+Shift+F project search)
  ipcMain.handle('fs:searchContent', async (_, projectPath: string, query: string): Promise<Array<{ file: string; line: number; text: string }>> => {
    if (!query || query.length < 2) return []
    const results: Array<{ file: string; line: number; text: string }> = []
    const ignoreDirs = new Set(['.git', 'node_modules', '.next', 'dist', 'out', 'tmp', '.cache', 'coverage', 'build'])
    const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.zip', '.tar', '.gz', '.pdf'])
    const maxResults = 200
    const lowerQuery = query.toLowerCase()

    async function walk(dir: string) {
      if (results.length >= maxResults) return
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxResults) return
        if (entry.name.startsWith('.') && entry.name !== '.env') continue
        if (ignoreDirs.has(entry.name)) continue
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          const ext = entry.name.substring(entry.name.lastIndexOf('.'))
          if (binaryExts.has(ext)) continue
          try {
            const content = await readFile(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break
              if (lines[i].toLowerCase().includes(lowerQuery)) {
                results.push({
                  file: relative(projectPath, fullPath),
                  line: i + 1,
                  text: lines[i].trim().substring(0, 200)
                })
              }
            }
          } catch { /* skip unreadable files */ }
        }
      }
    }

    await walk(projectPath)
    return results
  })
}
