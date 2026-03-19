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
  { command: 'Cmd + K', description: 'Select code, then Cmd+K to have Claude edit it inline — describe what you want changed', category: 'keyboard', added: '2026-03-19' },
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

function estimateTimeSaved(sessions: number, features: number): string {
  const sessionMinutes = sessions * 15
  const featureMinutes = features * 5
  const total = sessionMinutes + featureMinutes
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function SectionExplainer({ title, description }: { title: string; description: string }) {
  return (
    <div style={{
      color: '#888',
      fontSize: 11,
      padding: '8px 0 4px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{ color: '#4fc1ff' }}>↓</span>
      <span><strong style={{ color: '#aaa' }}>{title}</strong> — {description}</span>
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
  const hasStarted = activeSessions > 0 || recentSessions.length > 0

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

  // ============================================================
  // First-time experience — just the 3 steps, nothing else
  // ============================================================
  if (!hasStarted) {
    return (
      <div style={{ flex: 1, padding: 20, background: '#1e1e1e', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 600 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a2a3a 0%, #2d2d2d 100%)',
            borderRadius: 12,
            padding: '32px 36px',
            border: '1px solid #3e3e3e',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ color: '#fff', fontSize: 22, fontWeight: 'bold', marginBottom: 8 }}>
              Welcome! Let's make using Claude Code easy.
            </div>
            <div style={{ color: '#bbb', fontSize: 14, lineHeight: '24px', marginBottom: 28 }}>
              Let's get you cruising! Just 3 steps. If you have feedback, Slack <strong style={{ color: '#4fc1ff' }}>Izzy Rogner-Hall</strong>.
            </div>

            {[
              {
                step: '1',
                text: 'Click the + button in the top bar',
                detail: 'This opens a terminal tab. Claude Code starts automatically — no commands to memorize.',
                highlight: true,
              },
              {
                step: '2',
                text: 'Type what you want in plain English',
                detail: 'Just describe what you need: "Fix the login bug", "Add a search bar", "Explain this code". Claude does the rest.',
              },
              {
                step: '3',
                text: 'Click any file in the sidebar to view it',
                detail: 'The file opens in an editor. You can edit it, search it (Cmd+F), or ask Claude to change it (select code → Cmd+K).',
              },
            ].map(({ step, text, detail, highlight }) => (
              <div key={step} style={{
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
                marginBottom: 20,
                padding: highlight ? '16px' : '0',
                background: highlight ? 'rgba(79, 193, 255, 0.08)' : 'transparent',
                borderRadius: highlight ? 8 : 0,
                border: highlight ? '1px solid rgba(79, 193, 255, 0.2)' : 'none',
              }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: '#4fc1ff',
                  color: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}>
                  {step}
                </div>
                <div>
                  <div style={{ color: '#e8e8e8', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
                    {text}
                  </div>
                  <div style={{ color: '#999', fontSize: 13, lineHeight: '20px' }}>{detail}</div>
                </div>
              </div>
            ))}

            <div style={{
              marginTop: 8,
              padding: '12px 16px',
              background: '#1e1e1e',
              borderRadius: 6,
              color: '#888',
              fontSize: 12,
              textAlign: 'center',
              lineHeight: '20px',
            }}>
              Start with Step 1 — click the <strong style={{ color: '#4fc1ff' }}>+</strong> button above. Everything else will make sense once you try it.
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // Returning user — full dashboard with section explanations
  // ============================================================
  return (
    <div style={{ flex: 1, padding: 20, background: '#1e1e1e', overflowY: 'auto' }}>
      {/* Quick Start (compact for returning users) */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2a3a 0%, #2d2d2d 100%)',
        borderRadius: 8,
        padding: '16px 24px',
        border: '1px solid #3e3e3e',
        marginBottom: 20,
      }}>
        <div style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 6 }}>
          Welcome back! Let's keep cruising.
        </div>
        <div style={{ color: '#bbb', fontSize: 12, lineHeight: '20px' }}>
          Click <strong style={{ color: '#4fc1ff' }}>+</strong> to open a new terminal, or click a file in the sidebar to edit. Feedback? Slack <strong style={{ color: '#4fc1ff' }}>Izzy Rogner-Hall</strong>.
        </div>
      </div>

      {/* Stats */}
      <SectionExplainer title="Your Stats" description="Track your usage and how much time Claude is saving you." />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20, marginTop: 8 }}>
        <StatCard label="Today's Cost" value={state.claudeStatus.cost || '—'} color="#4fc1ff" />
        <StatCard label="Active Sessions" value={String(activeSessions)} color="#89d185" />
        <StatCard label="Model" value={state.claudeStatus.model || '—'} color="#dcdcaa" />
        <StatCard
          label="Time Saved Today"
          value={estimateTimeSaved(activeSessions, state.behavior.featuresUsed.size)}
          color="#c586c0"
        />
      </div>

      {/* Tips for You */}
      <SectionExplainer title="Tips for You" description="Personalized suggestions based on how you're using the app. These appear automatically as you work." />
      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e',
        marginBottom: 16,
        marginTop: 8,
      }}>
        {state.behavior.triggeredTips.length === 0 ? (
          <div style={{ color: '#666', fontSize: 13, padding: '4px 0' }}>
            Keep going — tips will appear here as you work. They'll help you discover features you might not know about.
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

      {/* Recent Sessions */}
      <SectionExplainer title="Recent Sessions" description="Projects you've worked on recently. Click one to jump back in." />
      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e',
        marginTop: 8,
      }}>
        {recentSessions.length === 0 && (
          <div style={{ color: '#666', padding: '8px 0' }}>No recent sessions yet — open a terminal to get started!</div>
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
      <SectionExplainer title="Claude Code Cheat Sheet" description="Everything you can do — keyboard shortcuts, terminal commands, and slash commands. Bookmark this section!" />
      <div style={{
        background: '#2d2d2d',
        borderRadius: 6,
        padding: 16,
        border: '1px solid #3e3e3e',
        marginTop: 8,
      }}>
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
              <div style={{ color: '#7a9a7a', fontSize: 11, marginBottom: 10 }}>
                As new features and commands are added, they'll show up here so you can try them.
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
