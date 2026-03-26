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

export function TodayPanel() {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const { meetings, tasks, loading, error } = state.notion
  const cacheRef = useRef<{ meetings: typeof meetings; tasks: typeof tasks; hadMeetingsToday?: boolean } | null>(null)
  const [hadMeetingsToday, setHadMeetingsToday] = useState(false)
  const [cacheStale, setCacheStale] = useState(false)
  const [calendarRefreshing, setCalendarRefreshing] = useState(false)
  const [tasksRefreshing, setTasksRefreshing] = useState(false)
  const [calendarUpdated, setCalendarUpdated] = useState<Date | null>(null)
  const [tasksUpdated, setTasksUpdated] = useState<Date | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [calendarSyncStatus, setCalendarSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')
  const [tasksSyncStatus, setTasksSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'failed'>('idle')

  const readCache = useCallback(async () => {
    if (!config?.notion.enabled || !config.notion.dashboardId) return
    dispatch({ type: 'NOTION_LOADING' })
    try {
      const data = await fetchWithRetry(() => window.api.fetchNotion(config.notion.dashboardId))
      if (data.error) {
        dispatch({ type: 'NOTION_ERROR', payload: data.error })
      } else {
        cacheRef.current = { meetings: data.meetings, tasks: data.tasks, hadMeetingsToday: data.hadMeetingsToday }
        setHadMeetingsToday(data.hadMeetingsToday || false)
        setCacheStale(data.cacheStale || false)
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
    setRefreshError(null)
    setCalendarSyncStatus('syncing')
    try {
      // Phase 1: Re-read cache immediately for instant UI feedback
      const cachedData = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!cachedData.error) {
        cacheRef.current = { ...cacheRef.current, meetings: cachedData.meetings, hadMeetingsToday: cachedData.hadMeetingsToday }
        setHadMeetingsToday(cachedData.hadMeetingsToday || false)
        setCacheStale(cachedData.cacheStale || false)
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, meetings: cachedData.meetings } })
        setCalendarUpdated(new Date())
      }

      // Phase 2: Run refresh script to pull fresh data from GCal
      const result = await window.api.refreshCalendar()
      if (result && !result.success) {
        setRefreshError(result.error || 'Calendar refresh failed')
        setCalendarSyncStatus('failed')
        return
      }

      // Phase 3: Re-read cache with fresh data
      const freshData = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!freshData.error) {
        cacheRef.current = { ...cacheRef.current, meetings: freshData.meetings, hadMeetingsToday: freshData.hadMeetingsToday }
        setHadMeetingsToday(freshData.hadMeetingsToday || false)
        setCacheStale(freshData.cacheStale || false)
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, meetings: freshData.meetings } })
        setCalendarUpdated(new Date())
      }
      setCalendarSyncStatus('success')
      setTimeout(() => setCalendarSyncStatus('idle'), 5000)
    } catch {
      setCalendarSyncStatus('failed')
      setRefreshError('Calendar refresh failed unexpectedly')
    } finally {
      setCalendarRefreshing(false)
    }
  }, [config, dispatch, state.notion])

  const handleTasksRefresh = useCallback(async () => {
    setTasksRefreshing(true)
    setRefreshError(null)
    setTasksSyncStatus('syncing')
    try {
      // Phase 1: Re-read cache immediately
      const cachedData = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!cachedData.error) {
        cacheRef.current = { ...cacheRef.current, tasks: cachedData.tasks }
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, tasks: cachedData.tasks } })
        setTasksUpdated(new Date())
      }

      // Phase 2: Run refresh script to pull fresh data from Notion
      const result = await window.api.refreshTasks()
      if (result && !result.success) {
        setRefreshError(result.error || 'Tasks refresh failed')
        setTasksSyncStatus('failed')
        return
      }

      // Phase 3: Re-read cache with fresh data
      const freshData = await window.api.fetchNotion(config?.notion.dashboardId || '')
      if (!freshData.error) {
        cacheRef.current = { ...cacheRef.current, tasks: freshData.tasks }
        dispatch({ type: 'NOTION_LOADED', payload: { ...state.notion, tasks: freshData.tasks } })
        setTasksUpdated(new Date())
      }
      setTasksSyncStatus('success')
      setTimeout(() => setTasksSyncStatus('idle'), 5000)
    } catch {
      setTasksSyncStatus('failed')
      setRefreshError('Tasks refresh failed unexpectedly')
    } finally {
      setTasksRefreshing(false)
    }
  }, [config, dispatch, state.notion])

  const readCacheRef = useRef(readCache)
  readCacheRef.current = readCache

  // Initial fetch when config becomes available
  useEffect(() => {
    if (config?.notion.enabled && config.notion.dashboardId) {
      readCache()
    }
  }, [config?.notion.enabled, config?.notion.dashboardId])

  // Auto-refresh every 30 minutes — triggers actual data refresh, not just cache re-read
  useEffect(() => {
    if (!config?.notion.enabled) return
    const THIRTY_MINUTES = 30 * 60 * 1000
    const interval = setInterval(async () => {
      // Trigger the refresh script, then re-read cache
      try {
        await window.api.refreshCalendar()
      } catch {}
      readCacheRef.current()
    }, THIRTY_MINUTES)
    return () => clearInterval(interval)
  }, [config?.notion.enabled])

  const displayMeetings = error && cacheRef.current ? cacheRef.current.meetings : meetings
  const displayTasks = error && cacheRef.current ? cacheRef.current.tasks : tasks

  if (!config?.notion.enabled) return null

  const SyncIndicator = ({ status }: { status: 'idle' | 'syncing' | 'success' | 'failed' }) => {
    if (status === 'idle') return null
    const style: React.CSSProperties = { fontSize: 11, marginLeft: 6 }
    if (status === 'syncing') return <span style={{ ...style, color: 'var(--text-muted)' }}>syncing...</span>
    if (status === 'success') return <span style={{ ...style, color: '#22c55e' }}>synced</span>
    if (status === 'failed') return <span style={{ ...style, color: 'var(--accent-error)' }}>sync failed</span>
    return null
  }

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

      {refreshError && (
        <div style={{ color: 'var(--accent-error)', fontSize: 12, marginBottom: 8 }}>
          {refreshError}
        </div>
      )}

      {cacheStale && !refreshError && (
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 8, fontStyle: 'italic' }}>
          Calendar cache is stale — click refresh to update
        </div>
      )}

      {/* Calendar Section (from Google Calendar) */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            Calendar
          </span>
          <RefreshButton onClick={handleCalendarRefresh} refreshing={calendarRefreshing} title="Refresh calendar from Google Calendar" />
          <SyncIndicator status={calendarSyncStatus} />
        </div>
        {displayMeetings.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            {cacheStale ? 'Calendar data outdated — refresh to see today\'s meetings' :
             hadMeetingsToday ? 'No more meetings today' : 'No meetings today'}
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

      {/* Tasks Section (from Notion) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600 }}>
            Tasks
          </span>
          <RefreshButton onClick={handleTasksRefresh} refreshing={tasksRefreshing} title="Refresh tasks from Notion" />
          <SyncIndicator status={tasksSyncStatus} />
        </div>
        {displayTasks.filter(t => t.status !== 'Done').length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No pending tasks</div>
        ) : (
          displayTasks
            .filter(t => t.status !== 'Done')
            .sort((a, b) => {
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
