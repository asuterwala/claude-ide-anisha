import { execFile } from 'child_process'
import { promisify } from 'util'
import type { GitFileStatus } from '../shared/types'

const execFileAsync = promisify(execFile)

export async function getGitFileStatuses(projectPath: string): Promise<Map<string, GitFileStatus>> {
  const statuses = new Map<string, GitFileStatus>()
  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-uall'], {
      cwd: projectPath,
      timeout: 5000
    })
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      const code = line.substring(0, 2)
      const filePath = line.substring(3).trim()
      if (code.includes('M')) statuses.set(filePath, 'modified')
      else if (code.includes('?')) statuses.set(filePath, 'untracked')
      else if (code.includes('D')) statuses.set(filePath, 'deleted')
      else if (code.includes('A')) statuses.set(filePath, 'added')
      else if (code.includes('R')) statuses.set(filePath, 'renamed')
    }
  } catch {
    // Not a git repo or git not available
  }
  return statuses
}

export async function getGitBranch(projectPath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['branch', '--show-current'], {
      cwd: projectPath,
      timeout: 5000
    })
    return stdout.trim() || null
  } catch {
    return null
  }
}
