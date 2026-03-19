import { useEffect, useState } from 'react'
import { useAppState } from '../store'
import type { RecentSession, Tab } from '../../shared/types'

interface CheatSheetEntry {
  command: string
  description: string
  category: 'start' | 'session' | 'slash' | 'config' | 'keyboard'
  added?: string // date string like '2026-03-19' — entries with this appear in What's New
}

const cheatSheet: CheatSheetEntry[] = [
  // Keyboard shortcuts (IDE features)
  { command: 'Cmd + P', description: 'Quick-open any file by name — fuzzy search across your whole project', category: 'keyboard', added: '2026-03-19' },
  { command: 'Cmd + Shift + F', description: 'Search across all files in your project — results grouped by file', category: 'keyboard', added: '2026-03-19' },
  { command: 'Cmd + F', description: 'Find text in the current file (when an editor tab is open)', category: 'keyboard', added: '2026-03-19' },
  { command: 'Cmd + H', description: 'Find and replace in the current file', category: 'keyboard', added: '2026-03-19' },
  { command: 'Cmd + S', description: 'Save the current file', category: 'keyboard' },
  { command: '⫿ (split icon)', description: 'Click on any editor tab to view two files side-by-side', category: 'keyboard', added: '2026-03-19' },

  // Starting Claude
  { command: 'claude', description: 'Start a new interactive session in the current directory', category: 'start' },
  { command: 'claude -p "fix the login bug"', description: 'One-shot prompt — get an answer without entering interactive mode', category: 'start' },
  { command: 'claude --resume', description: 'Pick up where you left off — resume your most recent conversation', category: 'start' },
  { command: 'claude --model sonnet', description: 'Start with a specific model (opus, sonnet, haiku) — sonnet is faster & cheaper', category: 'start' },

  // In-session slash commands
  { command: '/help', description: 'Show all available commands and what they do', category: 'slash' },
  { command: '/compact', description: 'Shrink your conversation to free up context — essential for long sessions', category: 'slash' },
  { command: '/clear', description: 'Wipe the conversation and start fresh without restarting', category: 'slash' },
  { command: '/cost', description: 'See how much this session has cost so far', category: 'slash' },
  { command: '/model sonnet', description: 'Switch models mid-conversation without restarting', category: 'slash' },
  { command: '/vim', description: 'Toggle vim keybindings for the input', category: 'slash' },
  { command: '/permissions', description: 'See and change what Claude is allowed to do (file edits, bash, etc.)', category: 'slash' },

  // Managing sessions
  { command: 'claude --continue', description: 'Continue the last conversation (same as --resume but non-interactive)', category: 'session' },
  { command: 'claude -p "summarize" --resume', description: 'Resume a past session and immediately send a follow-up prompt', category: 'session' },
  { command: 'claude --output-format json', description: 'Get structured JSON output — great for piping into other tools', category: 'session' },

  // Config & setup
  { command: 'claude config', description: 'Open the settings menu — set API keys, default model, permissions', category: 'config' },
  { command: 'claude update', description: 'Update Claude Code to the latest version', category: 'config' },
  { command: 'claude mcp', description: 'Manage MCP servers — connect Claude to external tools and data sources', category: 'config' },
]

const categoryLabels: Record<string, { label: string; color: string }> = {
  keyboard: { label: 'Keyboard Shortcuts & IDE Features', color: '#ff8c00' },
  start: { label: 'Getting Started', color: '#4fc1ff' },
  slash: { label: 'Slash Commands (use inside a session)', color: '#89d185' },
  session: { label: 'Session Management', color: '#dcdcaa' },
  config: { label: 'Config & Updates', color: '#c586c0' },
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hours ago`
  return `${Math.floor(hours / 24)} days ago`
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: '#2d2d2d',
      borderRadius: 6,
      padding: 16,
      border: '1px solid #3e3e3e'
    }}>
      <div style={{ color: '#888', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 'bold' }}>{value}</div>
    </div>
  )
}

export default function Dashboard({ visible }: { visible: boolean }) {
  const { state, dispatch } = useAppState()
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])

  useEffect(() => {
    if (visible) {
      window.api.getRecentSessions().then(setRecentSessions)
    }
  }, [visible])

  const activeSessions = state.tabs.filter(t => t.type === 'terminal').length

  const handleSessionClick = async (session: RecentSession) => {
    const id = `terminal-${Date.now()}`
    const ptyId = await window.api.createPty(session.projectPath)
    const tab: Tab = {
      id,
      type: 'terminal',
      label: session.projectPath.split('/').pop() || 'Terminal',
      closeable: true,
      ptyId,
      projectPath: session.projectPath
    }
    dispatch({ type: 'ADD_TAB', tab })
  }

  if (!visible) return null

  return (
    <div style={{ flex: 1, padding: 20, background: '#1e1e1e', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <StatCard label="Today's Cost" value={state.claudeStatus.cost || '—'} color="#4fc1ff" />
        <StatCard label="Active Sessions" value={String(activeSessions)} color="#89d185" />
        <StatCard label="Model" value={state.claudeStatus.model || '—'} color="#dcdcaa" />
      </div>

      {/* Tips for You */}
      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e',
        marginBottom: 16,
      }}>
        <div style={{ color: '#4fc1ff', fontSize: 11, marginBottom: 12, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>💡</span> Tips for You
        </div>
        {state.behavior.triggeredTips.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13, padding: '4px 0' }}>
            Keep going — tips will appear as you work.
          </div>
        ) : (
          state.behavior.triggeredTips.map((tip, i) => (
            <div
              key={tip.id}
              style={{
                padding: '8px 0',
                borderBottom: i < state.behavior.triggeredTips.length - 1 ? '1px solid #3e3e3e' : 'none',
                display: 'flex',
                gap: 10,
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: '#4fc1ff', fontSize: 12, flexShrink: 0 }}>💡</span>
              <span style={{ color: '#ccc', fontSize: 13 }}>{tip.message}</span>
            </div>
          ))
        )}
      </div>

      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e'
      }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 12, textTransform: 'uppercase' }}>
          Recent Sessions
        </div>
        {recentSessions.length === 0 && (
          <div style={{ color: '#666', padding: '8px 0' }}>No recent sessions</div>
        )}
        {recentSessions.map((session, i) => (
          <div
            key={session.projectPath}
            onClick={() => handleSessionClick(session)}
            style={{
              padding: '8px 0',
              borderBottom: i < recentSessions.length - 1 ? '1px solid #3e3e3e' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              cursor: 'pointer'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#353535')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ color: '#4fc1ff' }}>{session.projectPath.split('/').pop()}</span>
            <span style={{ color: '#888' }}>{formatTimeAgo(session.lastOpened)}</span>
          </div>
        ))}
      </div>

      {/* Claude Code Cheat Sheet */}
      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e',
        marginTop: 16
      }}>
        <div style={{ color: '#888', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' }}>
          Claude Code Cheat Sheet
        </div>
        <div style={{ color: '#555', fontSize: 11, marginBottom: 16 }}>
          Keyboard shortcuts, terminal commands, and tips. New features appear at the top.
        </div>

        {/* What's New section */}
        {(() => {
          const newEntries = cheatSheet
            .filter(e => e.added)
            .sort((a, b) => (b.added || '').localeCompare(a.added || ''))
          if (newEntries.length === 0) return null
          return (
            <div style={{
              marginBottom: 20,
              background: '#1a2a1a',
              borderRadius: 6,
              padding: 12,
              border: '1px solid #2d4a2d',
            }}>
              <div style={{
                color: '#89d185',
                fontSize: 12,
                fontWeight: 'bold',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>★</span> What's New
              </div>
              {newEntries.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    padding: '5px 0',
                    borderBottom: i < newEntries.length - 1 ? '1px solid #2d4a2d' : 'none',
                    gap: 12,
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: '#556', fontSize: 10, flexShrink: 0, minWidth: 62 }}>
                    {entry.added}
                  </span>
                  <code style={{
                    color: '#e8e8e8',
                    background: '#1e1e1e',
                    padding: '2px 8px',
                    borderRadius: 3,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                  }}>
                    {entry.command}
                  </code>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {entry.description}
                  </span>
                </div>
              ))}
            </div>
          )
        })()}

        {(['keyboard', 'start', 'slash', 'session', 'config'] as const).map(category => {
          const { label, color } = categoryLabels[category]
          const entries = cheatSheet.filter(e => e.category === category)
          return (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{ color, fontSize: 12, fontWeight: 'bold', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 8 }}>●</span> {label}
              </div>
              {entries.map((entry, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    padding: '6px 0',
                    borderBottom: i < entries.length - 1 ? '1px solid #333' : 'none',
                    gap: 16,
                    alignItems: 'baseline',
                  }}
                >
                  <code style={{
                    color: '#e8e8e8',
                    background: '#1e1e1e',
                    padding: '2px 8px',
                    borderRadius: 3,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                  }}>
                    {entry.command}
                  </code>
                  <span style={{ color: '#999', fontSize: 12 }}>
                    {entry.description}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
