import { useEffect, useCallback, useRef, useState } from 'react'
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
  const { meetings, tasks, loading, error } = state.notion
  const cacheRef = useRef<{ meetings: typeof meetings; tasks: typeof tasks; hadMeetingsToday?: boolean } | null>(null)
  const [hadMeetingsToday, setHadMeetingsToday] = useState(false)
  const [calendarRefreshing, setCalendarRefreshing] = useState(false)
  const [tasksRefreshing, setTasksRefreshing] = useState(false)
  const [calendarUpdated, setCalendarUpdated] = useState<Date | null>(null)
  const [tasksUpdated, setTasksUpdated] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    if (!config?.notion.enabled || !config.notion.dashboardId) return
    dispatch({ type: 'NOTION_LOADING' })
    try {
      const data = await fetchWithRetry(() => window.api.fetchNotion(config.notion.dashboardId))
      if (data.error) {
        dispatch({ type: 'NOTION_ERROR', payload: data.error })
      } else {
        cacheRef.current = { meetings: data.meetings, tasks: data.tasks, hadMeetingsToday: data.hadMeetingsToday }
        setHadMeetingsToday(data.hadMeetingsToday || false)
        dispatch({ type: 'NOTION_LOADED', payload: data })
        const now = new Date()
        setCalendarUpdated(now)
        setTasksUpdated(now)
      }
    } catch (err) {
      dispatch({ type: 'NOTION_ERROR', payload: 'Failed to connect after 3 attempts' })
    }
  }, [config, dispatch])

  const handleCalendarRefresh = useCallback(async () => {
    setCalendarRefreshing(true)
    try {
      await window.api.refreshCalendar()
      // Re-fetch just to update the UI with new cache data
      const data = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!data.error) {
        cacheRef.current = { ...cacheRef.current, meetings: data.meetings, hadMeetingsToday: data.hadMeetingsToday }
        setHadMeetingsToday(data.hadMeetingsToday || false)
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, meetings: data.meetings } })
        setCalendarUpdated(new Date())
      }
    } finally {
      setCalendarRefreshing(false)
    }
  }, [config, dispatch, state.notion])

  const handleTasksRefresh = useCallback(async () => {
    setTasksRefreshing(true)
    try {
      await window.api.refreshTasks()
      // Re-fetch just to update the UI with new cache data
      const data = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!data.error) {
        cacheRef.current = { ...cacheRef.current, tasks: data.tasks }
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, tasks: data.tasks } })
        setTasksUpdated(new Date())
      }
    } finally {
      setTasksRefreshing(false)
    }
  }, [config, dispatch, state.notion])

  const fetchDataRef = useRef(fetchData)
  fetchDataRef.current = fetchData

  // Initial fetch when config becomes available
  useEffect(() => {
    if (config?.notion.enabled && config.notion.dashboardId) {
      fetchData()
    }
  }, [config?.notion.enabled, config?.notion.dashboardId])

  // Separate interval effect - stable, doesn't recreate on fetchData changes
  useEffect(() => {
    if (!config?.notion.enabled) return
    const intervalMs = (config?.notion.refreshIntervalMinutes || 30) * 60 * 1000
    const interval = setInterval(() => {
      fetchDataRef.current()
    }, intervalMs)
    return () => clearInterval(interval)
  }, [config?.notion.enabled, config?.notion.refreshIntervalMinutes])

  const displayMeetings = error && cacheRef.current ? cacheRef.current.meetings : meetings
  const displayTasks = error && cacheRef.current ? cacheRef.current.tasks : tasks

  if (!config?.notion.enabled) return null

  const RefreshButton = ({ onClick, refreshing, title }: { onClick: () => void; refreshing: boolean; title: string }) => (
    <button
      onClick={onClick}
      disabled={loading || refreshing}
      title={title}
      style={{
        background: 'none',
        border: 'none',
        padding: 2,
        fontSize: 13,
        cursor: (loading || refreshing) ? 'default' : 'pointer',
        opacity: (loading || refreshing) ? 0.4 : 0.6,
        transition: 'opacity 0.2s',
        marginLeft: 6,
      }}
      onMouseEnter={e => { if (!loading && !refreshing) e.currentTarget.style.opacity = '1' }}
      onMouseLeave={e => { if (!loading && !refreshing) e.currentTarget.style.opacity = '0.6' }}
    >
      {refreshing ? '...' : '↻'}
    </button>
  )

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 16,
      border: '1px solid var(--panel-border)',
      boxShadow: 'var(--panel-shadow)'
    }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Today</h3>

      {error && (
        <div style={{ color: 'var(--accent-error)', fontSize: 12, marginBottom: 8 }}>
          {error}{cacheRef.current && ' (showing cached data)'}
        </div>
      )}

      {/* Calendar Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            Calendar
          </span>
          <RefreshButton onClick={handleCalendarRefresh} refreshing={calendarRefreshing} title="Refresh calendar from Google" />
        </div>
        {displayMeetings.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {hadMeetingsToday ? 'No more meetings today' : 'No meetings today'}
          </div>
        ) : (
          displayMeetings.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)', minWidth: 70 }}>
                {m.time}
              </span>
              <span style={{ color: 'var(--text-primary)' }}>{m.title}</span>
            </div>
          ))
        )}
        {calendarUpdated && (
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
            Updated {calendarUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Tasks Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            Tasks
          </span>
          <RefreshButton onClick={handleTasksRefresh} refreshing={tasksRefreshing} title="Refresh tasks from Notion" />
        </div>
        {displayTasks.filter(t => t.status !== 'Done').length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pending tasks</div>
        ) : (
          displayTasks
            .filter(t => t.status !== 'Done')
            .sort((a, b) => {
              // Sort by due date ascending (closest due date first)
              if (!a.dueDate && !b.dueDate) return 0
              if (!a.dueDate) return 1
              if (!b.dueDate) return -1
              return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            })
            .map(t => (
              <div key={t.id} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '4px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>☐</span>
                <span style={{ color: 'var(--text-primary)' }}>{t.title}</span>
              </div>
            ))
        )}
        {tasksUpdated && (
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
            Updated {tasksUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}
