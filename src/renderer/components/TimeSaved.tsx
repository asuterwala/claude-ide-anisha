import { useEffect } from 'react'
import { useAppState } from '../store'

export function TimeSaved() {
  const { state, dispatch } = useAppState()
  const { todayMinutes, actions } = state.timeSaved

  useEffect(() => {
    const loadData = async () => {
      const data = await window.api.loadTimeSaved()
      const today = new Date().toISOString().split('T')[0]
      if (data[today]) {
        dispatch({ type: 'TIME_SAVED_INIT', payload: data[today] })
      }
    }
    loadData()
  }, [dispatch])

  useEffect(() => {
    if (todayMinutes > 0) {
      const today = new Date().toISOString().split('T')[0]
      window.api.saveTimeSaved({ [today]: { minutes: todayMinutes, actions } })
    }
  }, [todayMinutes, actions])

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return (
    <div style={{
      background: 'var(--panel-bg)',
      borderRadius: 8,
      padding: 12,
      border: '1px solid var(--panel-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }}>
      <span style={{ fontSize: 16 }}>⏱️</span>
      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 10, textTransform: 'uppercase' }}>Time Saved Today</div>
        <div style={{ color: 'var(--accent-success)', fontSize: 18, fontWeight: 600 }}>~{formatTime(todayMinutes)}</div>
      </div>
    </div>
  )
}
