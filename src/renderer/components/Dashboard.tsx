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

interface TeamStats {
  teamSize: number
  avgSessions: number
  avgFeatures: number
  avgCost: number
}

function estimateTimeSaved(sessions: number, features: number): string {
  // Conservative estimate: each session saves ~15 min of manual work
  // Each power feature discovered saves ~5 min per day via efficiency
  const sessionMinutes = sessions * 15
  const featureMinutes = features * 5
  const total = sessionMinutes + featureMinutes
  if (total < 60) return `${total} min`
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function ComparisonBar({ label, you, teamAvg, unit, encouragement }: {
  label: string
  you: number
  teamAvg: number
  unit?: string
  encouragement: { ahead: string; behind: string; equal: string }
}) {
  const ratio = teamAvg > 0 ? you / teamAvg : 1
  const isAhead = ratio >= 1.1
  const isBehind = ratio < 0.9
  const message = isAhead ? encouragement.ahead : isBehind ? encouragement.behind : encouragement.equal
  const color = isAhead ? '#89d185' : isBehind ? '#dcdcaa' : '#4fc1ff'

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ color: '#ccc', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#888', fontSize: 11 }}>
          You: <span style={{ color }}>{unit === '$' ? `$${you.toFixed(2)}` : you}</span>
          {' · '}
          Team avg: {unit === '$' ? `$${teamAvg.toFixed(2)}` : teamAvg.toFixed(1)}
        </span>
      </div>
      <div style={{ height: 4, background: '#3e3e3e', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{
          height: '100%',
          width: `${Math.min(ratio * 100, 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ color: '#888', fontSize: 11, fontStyle: 'italic' }}>{message}</div>
    </div>
  )
}

export default function Dashboard({ visible }: { visible: boolean }) {
  const { state, dispatch } = useAppState()
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([])
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [statsConfigured, setStatsConfigured] = useState<boolean | null>(null)
  const [configInput, setConfigInput] = useState('')

  useEffect(() => {
    if (visible) {
      window.api.getRecentSessions().then(setRecentSessions)
      window.api.getStatsEndpoint().then(endpoint => {
        setStatsConfigured(!!endpoint)
        if (endpoint) {
          window.api.getTeamStats().then(setTeamStats)
        }
      })
    }
  }, [visible])

  // Post stats every 5 minutes
  useEffect(() => {
    const post = () => {
      const sessions = state.tabs.filter(t => t.type === 'terminal').length
      const features = state.behavior.featuresUsed.size
      const cost = state.claudeStatus.cost || '0'
      window.api.postStats({ sessions, features, cost })
    }
    post()
    const interval = setInterval(post, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [state.tabs, state.behavior.featuresUsed, state.claudeStatus.cost])

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
      {/* Quick Start */}
      <div style={{
        background: 'linear-gradient(135deg, #1a2a3a 0%, #2d2d2d 100%)',
        borderRadius: 8,
        padding: '20px 24px',
        border: '1px solid #3e3e3e',
        marginBottom: 20,
      }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
          Welcome to Claude IDE
        </div>
        <div style={{ color: '#bbb', fontSize: 13, lineHeight: '22px', marginBottom: 16 }}>
          Your AI pair programmer — ask it to build features, fix bugs, or explain code. Here's how to start:
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { step: '1', icon: '＋', text: 'Click + above to open a terminal', detail: 'Claude Code starts automatically' },
            { step: '2', icon: '💬', text: 'Type what you want in plain English', detail: '"Fix the login bug" or "Add a search bar"' },
            { step: '3', icon: '📂', text: 'Click any file in the sidebar to view it', detail: 'Edit with Cmd+K, search with Cmd+P' },
          ].map(({ step, icon, text, detail }) => (
            <div key={step} style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#4fc1ff',
                color: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 'bold',
                flexShrink: 0,
              }}>
                {step}
              </div>
              <div>
                <div style={{ color: '#e8e8e8', fontSize: 13, fontWeight: 'bold', marginBottom: 2 }}>
                  {text}
                </div>
                <div style={{ color: '#888', fontSize: 11 }}>{detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
        <StatCard label="Today's Cost" value={state.claudeStatus.cost || '—'} color="#4fc1ff" />
        <StatCard label="Active Sessions" value={String(activeSessions)} color="#89d185" />
        <StatCard label="Model" value={state.claudeStatus.model || '—'} color="#dcdcaa" />
        <StatCard
          label="Time Saved Today"
          value={estimateTimeSaved(activeSessions, state.behavior.featuresUsed.size)}
          color="#c586c0"
        />
      </div>

      {/* Team Comparison */}
      {statsConfigured === true && teamStats && teamStats.teamSize > 1 && (
        <div style={{
          background: '#2d2d2d',
          borderRadius: 6,
          padding: 16,
          border: '1px solid #3e3e3e',
          marginBottom: 16,
        }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
            <span>How You're Doing</span>
            <span style={{ color: '#555', textTransform: 'none' }}>{teamStats.teamSize} Gusties using Claude today</span>
          </div>
          <div style={{ color: '#555', fontSize: 11, marginBottom: 16 }}>
            You're building momentum! Here's how your usage compares to the team.
          </div>

          <ComparisonBar
            label="Sessions Today"
            you={activeSessions}
            teamAvg={teamStats.avgSessions}
            encouragement={{
              ahead: "You're making great use of Claude — keep it up!",
              behind: "Try opening another session — each one saves you ~15 minutes of manual work.",
              equal: "Right on track with the team!",
            }}
          />
          <ComparisonBar
            label="Features Discovered"
            you={state.behavior.featuresUsed.size}
            teamAvg={teamStats.avgFeatures}
            encouragement={{
              ahead: "You're a power user! You've found more features than most.",
              behind: "There's more to discover — try Cmd+P or Cmd+K to unlock new superpowers.",
              equal: "Keeping pace with the team — nice!",
            }}
          />
          <ComparisonBar
            label="Cost"
            you={parseFloat(state.claudeStatus.cost || '0')}
            teamAvg={teamStats.avgCost}
            unit="$"
            encouragement={{
              ahead: "Investing in productivity — every dollar spent saves you time.",
              behind: "Efficient spending! You're getting a lot done for less.",
              equal: "Right in line with the team.",
            }}
          />
        </div>
      )}

      {/* Sign in prompt — endpoint configured but stats not loading */}
      {statsConfigured === true && !teamStats && (
        <div style={{
          background: '#2d2d2d',
          borderRadius: 6,
          padding: 16,
          border: '1px solid #3e3e3e',
          marginBottom: 16,
        }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
            Team Stats
          </div>
          <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
            Sign in with your Gusto Google account to see how your usage compares to other Gusties.
          </div>
          <button
            onClick={async () => {
              const success = await window.api.googleLogin()
              if (success) {
                const stats = await window.api.getTeamStats()
                setTeamStats(stats)
              }
            }}
            style={{
              padding: '10px 20px',
              background: '#4fc1ff',
              color: '#000',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 'bold',
            }}
          >
            Sign in with Google
          </button>
        </div>
      )}

      {/* Team Stats Setup (only shown if not configured yet) */}
      {statsConfigured === false && (
        <div style={{
          background: '#2d2d2d',
          borderRadius: 6,
          padding: 16,
          border: '1px solid #3e3e3e',
          marginBottom: 16,
        }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
            Team Stats (Optional)
          </div>
          <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
            See how your Claude usage compares to other Gusties. Two quick steps:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#4fc1ff', fontWeight: 'bold', fontSize: 13, flexShrink: 0 }}>Step 1</span>
              <button
                onClick={async () => {
                  await window.api.googleLogin()
                }}
                style={{
                  padding: '8px 16px',
                  background: '#3c3c3c',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Sign in with your Gusto Google account
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ color: '#4fc1ff', fontWeight: 'bold', fontSize: 13, flexShrink: 0 }}>Step 2</span>
              <input
                value={configInput}
                onChange={e => setConfigInput(e.target.value)}
                placeholder="Paste the Apps Script URL here"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#3c3c3c',
                  border: '1px solid #3e3e3e',
                  borderRadius: 4,
                  color: '#fff',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <button
                onClick={async () => {
                  if (configInput.trim()) {
                    await window.api.setStatsEndpoint(configInput.trim())
                    setStatsConfigured(true)
                    window.api.getTeamStats().then(setTeamStats)
                  }
                }}
                style={{
                  padding: '8px 16px',
                  background: '#4fc1ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 'bold',
                }}
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      )}

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
