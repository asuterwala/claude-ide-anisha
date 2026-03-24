import { useEffect, useCallback, useRef } from 'react'
import { useAppState } from '../store'
import { useConfig } from '../hooks/useConfig'

// Retry with exponential backoff: 1s, 2s, 4s
async function fetchWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err as Error
      if (attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000))
      }
    }
  }
  throw lastError
}

export function NotionPanel() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const { meetings, tasks, loading, error, lastFetched } = state.notion
  const cacheRef = useRef<{ meetings: typeof meetings; tasks: typeof tasks } | null>(null)

  const fetchData = useCallback(async () => {
    if (!config?.notion.enabled || !config.notion.dashboardId) return
    dispatch({ type: 'NOTION_LOADING' })
    try {
      const data = await fetchWithRetry(() => window.api.fetchNotion(config.notion.dashboardId))
      if (data.error) {
        dispatch({ type: 'NOTION_ERROR', payload: data.error })
      } else {
        cacheRef.current = { meetings: data.meetings, tasks: data.tasks }
        dispatch({ type: 'NOTION_LOADED', payload: data })
      }
    } catch (err) {
      dispatch({ type: 'NOTION_ERROR', payload: 'Failed to connect after 3 attempts' })
    }
  }, [config, dispatch])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, (config?.notion.refreshIntervalMinutes || 30) * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchData, config])

  const displayMeetings = error && cacheRef.current ? cacheRef.current.meetings : meetings
  const displayTasks = error && cacheRef.current ? cacheRef.current.tasks : tasks

  if (!config?.notion.enabled) return null

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--panel-border)',
      boxShadow: 'var(--panel-shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Notion</h3>
        <button onClick={fetchData} disabled={loading} style={{
          background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 12
        }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'var(--accent-error)', fontSize: 12, marginBottom: 8 }}>
          {error}{cacheRef.current && ' (showing cached data)'}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
          Meetings Today
        </div>
        {displayMeetings.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No meetings today</div>
        ) : (
          displayMeetings.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)', minWidth: 70 }}>
                {m.time}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{m.title}</span>
            </div>
          ))
        )}
      </div>

      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase' }}>
          Tasks ({displayTasks.filter(t => t.status !== 'Done').length} pending)
        </div>
        {displayTasks.filter(t => t.status !== 'Done').length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pending tasks</div>
        ) : (
          displayTasks.filter(t => t.status !== 'Done').map(t => (
            <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>☐</span>
              <span style={{ color: 'var(--text-primary)' }}>{t.title}</span>
            </div>
          ))
        )}
      </div>

      {lastFetched && (
        <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 12 }}>
          Updated {new Date(lastFetched).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}
