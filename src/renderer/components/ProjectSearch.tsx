import { useState, useRef, useCallback } from 'react'
import { useAppState } from '../store'
import type { Tab } from '../../shared/types'

interface SearchResult {
  file: string
  line: number
  text: string
}

interface Props {
  visible: boolean
  onClose: () => void
}

export default function ProjectSearch({ visible, onClose }: Props) {
  const { state, dispatch } = useAppState()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback((q: string) => {
    if (!state.projectPath || q.length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    window.api.searchContent(state.projectPath, q).then(r => {
      setResults(r)
      setSearching(false)
    })
  }, [state.projectPath])

  const handleChange = (value: string) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 300)
  }

  const openResult = (result: SearchResult) => {
    if (!state.projectPath) return
    const fullPath = `${state.projectPath}/${result.file}`
    const fileName = result.file.split('/').pop() || result.file

    const existing = state.tabs.find(t => t.filePath === fullPath)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id })
    } else {
      const tab: Tab = {
        id: `editor-${Date.now()}`,
        type: 'editor',
        label: fileName,
        closeable: true,
        filePath: fullPath
      }
      dispatch({ type: 'ADD_TAB', tab })
    }
  }

  // Group results by file
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    if (!acc[r.file]) acc[r.file] = []
    acc[r.file].push(r)
    return acc
  }, {})

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 80,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 600,
          maxHeight: 500,
          background: '#252526',
          borderRadius: 8,
          border: '1px solid #3e3e3e',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
          placeholder="Search in files..."
          style={{
            width: '100%',
            padding: '12px 16px',
            background: '#3c3c3c',
            border: 'none',
            borderBottom: '1px solid #3e3e3e',
            color: '#fff',
            fontSize: 14,
            outline: 'none',
            fontFamily: "'SF Mono', Menlo, Consolas, monospace",
            boxSizing: 'border-box',
          }}
        />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {searching && (
            <div style={{ padding: '12px 16px', color: '#888', fontSize: 13 }}>Searching...</div>
          )}
          {!searching && query.length >= 2 && results.length === 0 && (
            <div style={{ padding: '12px 16px', color: '#666', fontSize: 13 }}>No results found</div>
          )}
          {Object.entries(grouped).map(([file, matches]) => (
            <div key={file}>
              <div style={{
                padding: '6px 16px',
                color: '#4fc1ff',
                fontSize: 12,
                background: '#2d2d2d',
                position: 'sticky',
                top: 0,
              }}>
                {file} <span style={{ color: '#666' }}>({matches.length})</span>
              </div>
              {matches.map((match, i) => (
                <div
                  key={`${file}:${match.line}:${i}`}
                  onClick={() => openResult(match)}
                  style={{
                    padding: '4px 16px 4px 32px',
                    cursor: 'pointer',
                    display: 'flex',
                    gap: 12,
                    alignItems: 'baseline',
                    fontSize: 12,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#094771')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ color: '#888', flexShrink: 0, minWidth: 30, textAlign: 'right' }}>
                    {match.line}
                  </span>
                  <span style={{
                    color: '#ccc',
                    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {highlightMatch(match.text, query)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {results.length > 0 && (
          <div style={{
            padding: '6px 16px',
            borderTop: '1px solid #3e3e3e',
            color: '#888',
            fontSize: 11,
          }}>
            {results.length} results in {Object.keys(grouped).length} files
          </div>
        )}
      </div>
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const lower = text.toLowerCase()
  const qLower = query.toLowerCase()
  const idx = lower.indexOf(qLower)
  if (idx === -1) return text
  return (
    <>
      {text.substring(0, idx)}
      <span style={{ background: '#613214', color: '#fff' }}>{text.substring(idx, idx + query.length)}</span>
      {text.substring(idx + query.length)}
    </>
  )
}
