import { ipcMain, dialog, app, BrowserWindow, net, session } from 'electron'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { homedir } from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
import { getGitFileStatuses, getGitBranch } from './git-status'
import { createPtySession, writePty, resizePty, destroyPty } from './claude-bridge'
import { startWatching, stopWatching } from './file-watcher'
import type { FileNode, RecentSession } from '../shared/types'

const sessionsFile = () => join(app.getPath('userData'), 'recent-sessions.json')
const teamStatsConfigFile = () => join(app.getPath('userData'), 'team-stats-config.json')
const anonIdFile = () => join(app.getPath('userData'), 'anon-id.json')
const CONFIG_PATH = join(homedir(), '.config', 'claude-ide-mc', 'config.json')

const DEFAULT_CONFIG = {
  user: { name: '', slackSignature: '_Sent by Claude Code_ :claude:' },
  notion: { enabled: true, dashboardId: '', refreshIntervalMinutes: 30 },
  streamlit: { enabled: true, defaultPort: 8501, keepRunningOnClose: false },
  notifications: { enabled: true, quietHoursStart: null, quietHoursEnd: null },
  slack: { enabled: true, draftVoice: 'direct, concise, collaborative', quickRecipients: [] },
  skills: { categories: [], timeSavedWeights: {} },
  theme: 'light'
}

async function getOrCreateAnonId(): Promise<string> {
  try {
    const data = await readFile(anonIdFile(), 'utf-8')
    return JSON.parse(data).id
  } catch {
    const id = 'anon-' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
    await writeFile(anonIdFile(), JSON.stringify({ id }), 'utf-8')
    return id
  }
}

async function getTeamStatsEndpoint(): Promise<string | null> {
  try {
    const data = await readFile(teamStatsConfigFile(), 'utf-8')
    return JSON.parse(data).endpoint || null
  } catch {
    return null
  }
}

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

  // Team stats config
  ipcMain.handle('stats:getEndpoint', async () => {
    return getTeamStatsEndpoint()
  })

  ipcMain.handle('stats:setEndpoint', async (_, endpoint: string) => {
    await writeFile(teamStatsConfigFile(), JSON.stringify({ endpoint }, null, 2), 'utf-8')
  })

  // Open a window that loads the Apps Script URL directly — Google will
  // redirect to sign-in if needed, then show the JSON response
  ipcMain.handle('stats:googleLogin', async () => {
    const endpoint = await getTeamStatsEndpoint()
    if (!endpoint) return false

    return new Promise<boolean>((resolve) => {
      const authWin = new BrowserWindow({
        width: 600,
        height: 700,
        title: 'Sign in to enable Team Stats',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      })

      authWin.loadURL(endpoint)

      let resolved = false

      // Watch for successful load of the Apps Script response (JSON)
      authWin.webContents.on('did-finish-load', async () => {
        const url = authWin.webContents.getURL()
        // If we've landed on the Apps Script exec URL, auth succeeded
        if (url.includes('script.google.com') && url.includes('/exec')) {
          try {
            const text = await authWin.webContents.executeJavaScript('document.body.innerText')
            if (text.includes('teamSize') || text.includes('"ok"')) {
              resolved = true
              authWin.close()
              resolve(true)
            }
          } catch { /* ignore */ }
        }
        // Also check if the page body looks like JSON (the raw response)
        try {
          const text = await authWin.webContents.executeJavaScript('document.body.innerText')
          if (text.startsWith('{') && (text.includes('teamSize') || text.includes('avgSessions'))) {
            resolved = true
            authWin.close()
            resolve(true)
          }
        } catch { /* ignore */ }
      })

      authWin.on('closed', () => {
        if (!resolved) resolve(false)
      })
    })
  })

  // Post stats to Google Sheets (uses Electron net for Google auth)
  ipcMain.handle('stats:post', async (_, data: { sessions: number; features: number; cost: string }) => {
    const endpoint = await getTeamStatsEndpoint()
    if (!endpoint) return null
    const id = await getOrCreateAnonId()
    try {
      const response = await net.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...data }),
        bypassCustomProtocolHandlers: true,
      })
      return response.ok
    } catch {
      return false
    }
  })

  // Fetch team averages (uses Electron net for Google auth)
  ipcMain.handle('stats:getTeam', async () => {
    const endpoint = await getTeamStatsEndpoint()
    if (!endpoint) return null
    try {
      const response = await net.fetch(endpoint, {
        bypassCustomProtocolHandlers: true,
      })
      if (!response.ok) return null
      const text = await response.text()
      return JSON.parse(text)
    } catch {
      return null
    }
  })

  // Cmd+K inline edit — sends selected code + prompt to Claude CLI
  ipcMain.handle('claude:inlineEdit', async (_, code: string, prompt: string, filePath: string): Promise<string> => {
    const claudePath = join(process.env.HOME || '', '.local', 'bin', 'claude')
    const fullPrompt = `You are editing code inline. The user selected this code from ${filePath}:\n\n\`\`\`\n${code}\n\`\`\`\n\nThe user's instruction: ${prompt}\n\nRespond with ONLY the replacement code. No explanations, no markdown fences, no commentary. Just the code that should replace the selection.`

    try {
      const { stdout } = await execFileAsync(claudePath, ['-p', fullPrompt], {
        timeout: 60000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`,
        },
      })
      return stdout.trim()
    } catch (err: any) {
      throw new Error(`Claude inline edit failed: ${err.message}`)
    }
  })

  // Config loading
  ipcMain.handle('config:load', async () => {
    try {
      if (!existsSync(CONFIG_PATH)) {
        const dir = join(homedir(), '.config', 'claude-ide-mc')
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2))
        return DEFAULT_CONFIG
      }
      const content = readFileSync(CONFIG_PATH, 'utf-8')
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) }
    } catch (error) {
      console.error('Failed to load config:', error)
      return DEFAULT_CONFIG
    }
  })

  // Notion data fetching
  ipcMain.handle('notion:fetch', async (_event, dashboardId: string) => {
    // Placeholder - returns empty data structure
    // Real implementation would call Claude CLI with MCP
    return {
      meetings: [],
      tasks: [],
      error: null
    }
  })
}
