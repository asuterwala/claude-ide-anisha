import { useEffect, useState, useCallback } from 'react'
import { useAppState } from '../store'
import { useConfig } from '../hooks/useConfig'

export function ModelStatus({ projectPath }: { projectPath?: string }) {
  const { state, dispatch } = useAppState()
  const config = useConfig()
  const [nextPort, setNextPort] = useState(config?.streamlit.defaultPort || 8501)
  const activePath = projectPath || state.tabs.find(t => t.type === 'terminal')?.projectPath || ''

  const refresh = useCallback(async () => {
    if (!activePath) return
    const [files, apps] = await Promise.all([
      window.api.listPythonFiles(activePath),
      window.api.getStreamlitStatus()
    ])
    dispatch({ type: 'STREAMLIT_UPDATE', payload: { pythonFiles: files, apps } })
  }, [activePath, dispatch])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleRun = async (file: string) => {
    await window.api.runStreamlit(file, nextPort)
    setNextPort(prev => prev + 1)
    refresh()
  }

  const handleStop = async (file: string) => {
    await window.api.stopStreamlit(file)
    refresh()
  }

  if (!config?.streamlit.enabled) return null

  const { pythonFiles, apps } = state.streamlit
  const streamlitFiles = pythonFiles.filter(f => f.isStreamlit)

  return (
    <div style={{ background: 'var(--panel-bg)', borderRadius: 8, padding: 16, border: '1px solid var(--panel-border)', boxShadow: 'var(--panel-shadow)' }}>
      <h3 style={{ margin: '0 0 12px', color: 'var(--text-primary)', fontSize: 14, fontWeight: 600 }}>Models</h3>
      {streamlitFiles.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No Streamlit apps detected. Create app.py to get started.</div>
      ) : (
        streamlitFiles.map(file => {
          const app = apps.find(a => a.file === file.path)
          const isRunning = app?.status === 'running'
          return (
            <div key={file.path} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
              <div>
                <div style={{ color: 'var(--text-primary)', fontSize: 13 }}>{file.name}</div>
                {isRunning && <div style={{ color: 'var(--accent-success)', fontSize: 11 }}>Running on localhost:{app.port}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {isRunning ? (
                  <>
                    <button onClick={() => window.open(`http://localhost:${app.port}`, '_blank')} style={btnStyle}>Open</button>
                    <button onClick={() => handleStop(file.path)} style={{ ...btnStyle, color: 'var(--accent-error)' }}>Stop</button>
                  </>
                ) : (
                  <button onClick={() => handleRun(file.path)} style={btnStyle}>Run</button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

const btnStyle = { background: 'none', border: '1px solid var(--border-color)', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: 'var(--accent-primary)', cursor: 'pointer' }
