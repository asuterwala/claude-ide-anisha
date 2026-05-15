import { execSync } from 'child_process'
import { dirname } from 'path'

export interface ClaudeEnvConfig {
  claudeBin: string
  home: string
}

const DEFAULT_PATH_PARTS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
]

export function detectClaudeBin(): string {
  try {
    const out = execSync('command -v claude', { encoding: 'utf8' }).trim()
    if (out) return out
  } catch {}
  const candidates = [
    `${process.env.HOME}/.local/bin/claude`,
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
  for (const c of candidates) {
    try {
      execSync(`test -x ${c}`)
      return c
    } catch {}
  }
  throw new Error('claude binary not found in PATH or known locations')
}

export function buildPlistEnv(cfg: ClaudeEnvConfig): Record<string, string> {
  const claudeDir = dirname(cfg.claudeBin)
  const pathParts = Array.from(new Set([claudeDir, ...DEFAULT_PATH_PARTS]))
  return {
    HOME: cfg.home,
    PATH: pathParts.join(':'),
    CLAUDE_CODE_USE_BEDROCK: 'false',
  }
}
