import * as pty from 'node-pty'
import { BrowserWindow } from 'electron'

interface PtySession {
  process: pty.IPty
  projectPath: string
}

const sessions = new Map<string, PtySession>()
let nextId = 1

export function createPtySession(projectPath: string, window: BrowserWindow): string {
  const id = `pty-${nextId++}`
  const shell = process.env.SHELL || '/bin/zsh'

  const claudePath = process.env.HOME + '/.local/bin/claude'
  const ptyProcess = pty.spawn(shell, ['-l'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: projectPath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      PATH: `${process.env.HOME}/.local/bin:${process.env.PATH}`
    }
  })

  // Auto-launch claude after shell starts
  setTimeout(() => {
    ptyProcess.write('claude\r')
  }, 500)

  ptyProcess.onData((data) => {
    if (!window.isDestroyed()) {
      window.webContents.send('pty:data', id, data)
    }
  })

  ptyProcess.onExit(() => {
    sessions.delete(id)
    if (!window.isDestroyed()) {
      window.webContents.send('pty:exit', id)
    }
  })

  sessions.set(id, { process: ptyProcess, projectPath })
  return id
}

export function writePty(id: string, data: string): void {
  sessions.get(id)?.process.write(data)
}

export function resizePty(id: string, cols: number, rows: number): void {
  sessions.get(id)?.process.resize(cols, rows)
}

export function destroyPty(id: string): void {
  const session = sessions.get(id)
  if (session) {
    session.process.kill()
    sessions.delete(id)
  }
}

export function destroyAllPtySessions(): void {
  for (const [id, session] of sessions) {
    session.process.kill()
    sessions.delete(id)
  }
}
