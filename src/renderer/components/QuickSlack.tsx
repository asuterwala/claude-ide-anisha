import { useState } from 'react'
import { useConfig } from '../hooks/useConfig'
import { useAppState } from '../store'

export function QuickSlack() {
  const config = useConfig()
  const { dispatch } = useAppState()
  const [recipient, setRecipient] = useState('')
  const [intent, setIntent] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const handleDraft = () => {
    const generatedDraft = `${intent}\n\n${config?.user.slackSignature || '_Sent by Claude Code_ :claude:'}`
    setDraft(generatedDraft)
  }

  const handleSend = async () => {
    if (!recipient || !draft) return
    setSending(true)
    const result = await window.api.sendSlack(recipient, draft)
    setSending(false)
    if (result.success) {
      setIntent('')
      setDraft('')
      dispatch({ type: 'TIME_SAVED_ADD', payload: { action: 'slack-send', minutes: 5 } })
    }
  }

  if (!config?.slack.enabled) return null
  const recipients = config.slack.quickRecipients || []

  return (
    <div style={panelStyle}>
      <h3 style={headerStyle}>Quick Slack</h3>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>To:</label>
        <select value={recipient} onChange={e => setRecipient(e.target.value)} style={selectStyle}>
          <option value="">Select recipient...</option>
          {recipients.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Intent:</label>
        <input type="text" value={intent} onChange={e => setIntent(e.target.value)} placeholder="What do you want to say?" style={inputStyle} />
        <button onClick={handleDraft} style={{ ...buttonStyle, marginTop: 8 }}>Draft</button>
      </div>
      {draft && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Preview:</label>
          <textarea value={draft} onChange={e => setDraft(e.target.value)} style={{ ...inputStyle, minHeight: 80 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={handleDraft} style={buttonStyle}>Redraft</button>
            <button onClick={handleSend} disabled={sending} style={{ ...buttonStyle, background: 'var(--accent-primary)', color: 'white' }}>
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const panelStyle = { background: 'var(--panel-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)' }
const headerStyle = { margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 as const }
const labelStyle = { display: 'block', color: 'var(--text-secondary)', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' as const }
const inputStyle = { width: '100%', padding: 8, border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 13, background: 'var(--bg-primary)', boxSizing: 'border-box' as const }
const selectStyle = { ...inputStyle, cursor: 'pointer' }
const buttonStyle = { padding: '6px 12px', border: '1px solid var(--border-color)', borderRadius: 4, fontSize: 12, cursor: 'pointer', background: 'var(--bg-secondary)' }
