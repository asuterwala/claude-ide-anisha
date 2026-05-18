import { ipcMain, dialog, app, BrowserWindow, net, Notification } from 'electron'
import { scheduler } from './scheduler'
import { readdir, readFile, writeFile, stat } from 'fs/promises'
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'
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
  user: { name: '' },
  notifications: { enabled: true, quietHoursStart: null, quietHoursEnd: null },
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

  ipcMain.handle('pty:create', async (event, projectPath: string, opts?: { resumeSessionId?: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) throw new Error('No window found')
    try {
      const id = createPtySession(projectPath, window, opts ?? {})
      console.log('[pty:create] Success, id:', id, opts?.resumeSessionId ? `(resuming ${opts.resumeSessionId})` : '')
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

  // Claude Code sessions
  const CLAUDE_PROJECTS_PATH = join(homedir(), '.claude', 'projects')
  const SESSION_SUMMARIES_CACHE = join(homedir(), '.cache', 'claude-ide', 'session-summaries.json')

  // Load cached summaries
  function loadSummaryCache(): Record<string, string> {
    try {
      if (existsSync(SESSION_SUMMARIES_CACHE)) {
        return JSON.parse(readFileSync(SESSION_SUMMARIES_CACHE, 'utf-8'))
      }
    } catch {}
    return {}
  }

  // Save summaries cache
  function saveSummaryCache(cache: Record<string, string>) {
    try {
      const dir = join(homedir(), '.cache', 'claude-ide')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(SESSION_SUMMARIES_CACHE, JSON.stringify(cache, null, 2))
    } catch (err) {
      console.error('Failed to save summary cache:', err)
    }
  }

  // Generate summary for a session using Claude CLI
  async function generateSessionSummary(sessionPath: string): Promise<string> {
    try {
      const content = readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').slice(0, 100) // Read more lines for better context
      const messages: string[] = []

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          // User messages - handle both string and {role, content} formats
          if (entry.type === 'user' && entry.message) {
            const msgText = typeof entry.message === 'string'
              ? entry.message
              : entry.message.content
            if (msgText) messages.push(`User: ${msgText.slice(0, 200)}`)
          } else if (entry.type === 'assistant' && Array.isArray(entry.message)) {
            // Assistant messages are arrays with text blocks
            const text = entry.message
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text || '')
              .join('')
            if (text) messages.push(`Assistant: ${text.slice(0, 200)}`)
          }
        } catch {}
      }

      if (messages.length === 0) return ''

      const claudePath = '/opt/homebrew/bin/claude'
      const prompt = `In 5-8 words, what was this session about? Just the topic, no prefix:\n${messages.slice(0, 5).join('\n').slice(0, 500)}`

      const { stdout } = await execFileAsync(claudePath, ['-p', prompt], {
        timeout: 15000,
        maxBuffer: 512 * 1024,
        env: {
          ...process.env,
          CLAUDE_CODE_USE_BEDROCK: 'true',
          AWS_PROFILE: 'bedrock-users',
          AWS_REGION: 'us-west-2'
        }
      })
      return stdout.trim().slice(0, 60)
    } catch (err) {
      console.error('Failed to generate summary:', err)
      return ''
    }
  }

  ipcMain.handle('claudeSessions:list', async (_event, limit: number = 10) => {
    try {
      const sessions: any[] = []
      const summaryCache = loadSummaryCache()
      const projectDirs = readdirSync(CLAUDE_PROJECTS_PATH).filter(d => d.startsWith('-'))

      for (const projectDir of projectDirs) {
        const projectPath = join(CLAUDE_PROJECTS_PATH, projectDir)
        const files = readdirSync(projectPath)
          .filter(f => f.endsWith('.jsonl'))
          .map(f => ({
            name: f,
            path: join(projectPath, f),
            mtime: statSync(join(projectPath, f)).mtimeMs
          }))
          .sort((a, b) => b.mtime - a.mtime)
          .slice(0, 30)

        for (const file of files) {
          try {
            const sessionId = file.name.replace('.jsonl', '')
            const content = readFileSync(file.path, 'utf-8')
            // Scan the whole file so we can pick up custom-title / ai-title entries
            // wherever they appear, with custom-title taking precedence.
            const lines = content.split('\n')

            let customTitle = ''
            let aiTitle = ''
            let firstUserMessage = ''
            let cwd = ''

            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const entry = JSON.parse(line)
                if (entry.cwd && !cwd) cwd = entry.cwd
                // /rename slash command writes this; latest one wins
                if (entry.type === 'custom-title' && entry.customTitle) {
                  customTitle = String(entry.customTitle).slice(0, 80)
                }
                // Claude's auto-generated summary
                if (entry.type === 'ai-title' && entry.aiTitle) {
                  aiTitle = String(entry.aiTitle).slice(0, 80)
                }
                // First user message (fallback)
                if (!firstUserMessage && entry.type === 'user' && entry.message) {
                  if (typeof entry.message === 'string') {
                    firstUserMessage = entry.message.slice(0, 60)
                  } else if (entry.message.content) {
                    const msgContent = typeof entry.message.content === 'string'
                      ? entry.message.content
                      : Array.isArray(entry.message.content) && entry.message.content[0]?.text
                        ? entry.message.content[0].text
                        : ''
                    firstUserMessage = msgContent.slice(0, 60)
                  }
                }
              } catch {}
            }

            // Priority: explicit rename > AI summary > cached > first user message
            const title = customTitle || aiTitle || summaryCache[sessionId] || firstUserMessage

            // Skip automated/programmatic sessions — but if the user explicitly
            // renamed the session (customTitle), always keep it.
            const isAutomatedSession = !customTitle && title && (
              title.startsWith('Summarize this') ||
              title.startsWith('Say hello') ||
              title.startsWith('In 5-8 words') ||
              title.includes('MCP tool') ||
              title.includes('mcp__') ||
              title.startsWith('Use the ') ||
              title.startsWith('You are editing code') ||
              title.startsWith('[Request interrupted') ||
              title.startsWith('```') ||
              /^(Get|Fetch|List|Update|Create|Delete|Write|Read|Refresh)\s/i.test(title)
            )
            if (title && cwd && !isAutomatedSession) {
              sessions.push({
                id: sessionId,
                title,
                projectPath: cwd,
                projectDir,
                timestamp: file.mtime
              })
            }
          } catch {}
        }
      }

      return sessions.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit)
    } catch (error) {
      console.error('Failed to list Claude sessions:', error)
      return []
    }
  })

  // Generate summaries for specific sessions
  ipcMain.handle('claudeSessions:generateSummaries', async (_event, sessions: Array<{ id: string; projectDir: string }>) => {
    try {
      const summaryCache = loadSummaryCache()
      const newSummaries: Record<string, string> = {}

      for (const session of sessions) {
        const filePath = join(CLAUDE_PROJECTS_PATH, session.projectDir, `${session.id}.jsonl`)
        if (existsSync(filePath)) {
          const summary = await generateSessionSummary(filePath)
          if (summary) {
            newSummaries[session.id] = summary
          }
        }
      }

      if (Object.keys(newSummaries).length > 0) {
        saveSummaryCache({ ...summaryCache, ...newSummaries })
      }
      return newSummaries
    } catch (error) {
      console.error('Failed to generate summaries:', error)
      return {}
    }
  })

  ipcMain.handle('claudeSessions:resume', async (event, sessionId: string, projectPath: string) => {
    // This would open a new terminal tab with `claude --resume sessionId`
    // For now, just log - the actual implementation would need terminal integration
    console.log('Resume session:', sessionId, 'in', projectPath)
    return { success: true }
  })

  // Find the title (custom-title or ai-title) of an active session for a given folder.
  // Used by the renderer's title-poll to update tab labels when claude assigns a name.
  ipcMain.handle('claudeSessions:findTitle', async (
    _event,
    folderPath: string,
    sinceMs: number = 0,
    excludeIds: string[] = [],
    pinnedSessionId?: string
  ) => {
    try {
      // Empty folderPath means "home directory".
      const resolvedFolder = folderPath && folderPath.length > 0 ? folderPath : homedir()
      const projectDir = resolvedFolder.replace(/^\//, '').replace(/\//g, '-')
      const projectDirWithDash = projectDir.startsWith('-') ? projectDir : `-${projectDir}`
      const candidates = [
        join(CLAUDE_PROJECTS_PATH, projectDirWithDash),
        join(CLAUDE_PROJECTS_PATH, projectDir),
      ]
      let dir: string | null = null
      for (const c of candidates) {
        if (existsSync(c)) { dir = c; break }
      }
      if (!dir) return null

      const exclude = new Set(excludeIds)
      const files = readdirSync(dir)
        .filter(f => f.endsWith('.jsonl'))
        .map(f => ({
          sessionId: f.replace('.jsonl', ''),
          path: join(dir!, f),
          mtime: statSync(join(dir!, f)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime)

      const scanForTitle = (filePath: string): string | null => {
        try {
          const content = readFileSync(filePath, 'utf-8')
          const lines = content.split('\n')
          let custom = ''
          let ai = ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const entry = JSON.parse(line)
              if (entry.type === 'custom-title' && entry.customTitle) custom = String(entry.customTitle).slice(0, 80)
              else if (entry.type === 'ai-title' && entry.aiTitle) ai = String(entry.aiTitle).slice(0, 80)
            } catch {}
          }
          return custom || ai || null
        } catch { return null }
      }

      // If the renderer pinned a specific session for this tab, re-scan it first.
      if (pinnedSessionId) {
        const pinned = files.find(f => f.sessionId === pinnedSessionId)
        if (pinned) {
          const title = scanForTitle(pinned.path)
          if (title) return { sessionId: pinned.sessionId, title }
        }
      }

      // Otherwise find the most recent JSONL modified since this tab was opened,
      // not already claimed by another tab, that has a title.
      for (const f of files) {
        if (f.mtime < sinceMs - 60 * 1000) break  // 60s grace before tab creation
        if (exclude.has(f.sessionId)) continue
        const title = scanForTitle(f.path)
        if (title) return { sessionId: f.sessionId, title }
      }
      return null
    } catch (err) {
      console.error('findTitle error:', err)
      return null
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

  // Skills auto-detect from ~/.claude/skills/
  ipcMain.handle('skills:list', async () => {
    const skillsDir = join(homedir(), '.claude', 'skills')
    const skills: Array<{ name: string; description: string }> = []

    if (!existsSync(skillsDir)) return skills

    const entries = readdirSync(skillsDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const skillPath = join(skillsDir, entry.name, 'SKILL.md')
      if (!existsSync(skillPath)) continue

      const content = readFileSync(skillPath, 'utf-8')
      // Parse frontmatter
      const match = content.match(/^---\n([\s\S]*?)\n---/)
      if (!match) continue

      const frontmatter = match[1]
      const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
      const descMatch = frontmatter.match(/^description:\s*(.+)$/m)

      if (nameMatch) {
        skills.push({
          name: nameMatch[1].trim(),
          description: descMatch ? descMatch[1].trim() : ''
        })
      }
    }

    // Sort alphabetically
    return skills.sort((a, b) => a.name.localeCompare(b.name))
  })

  // Automations / scheduler
  ipcMain.handle('automations:list', () => scheduler.list())
  ipcMain.handle('automations:create', (_e, input) => scheduler.create(input))
  ipcMain.handle('automations:update', (_e, id, patch) => scheduler.update(id, patch))
  ipcMain.handle('automations:remove', (_e, id) => scheduler.remove(id))
  ipcMain.handle('automations:runNow', (_e, id) => scheduler.runNow(id))
  ipcMain.handle('automations:listRuns', (_e, opts) => scheduler.listRuns(opts))

  ipcMain.handle('notify:show', async (_event, title: string, body: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win && win.isFocused()) {
      // Don't notify if window is focused
      return { shown: false, reason: 'window-focused' }
    }

    const notification = new Notification({
      title,
      body,
      silent: false
    })

    notification.on('click', () => {
      const windows = BrowserWindow.getAllWindows()
      if (windows.length > 0) {
        windows[0].focus()
      }
    })

    notification.show()
    return { shown: true }
  })
}
