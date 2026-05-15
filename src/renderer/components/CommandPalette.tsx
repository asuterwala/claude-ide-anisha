import { useEffect, useMemo, useRef, useState } from 'react'
import { filterItems, type PaletteItem } from './CommandPalette/filter'
import './CommandPalette.css'

interface Props {
  visible: boolean
  onClose: () => void
  items: PaletteItem[]
  onSelect: (item: PaletteItem) => void
}

export default function CommandPalette({ visible, onClose, items, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => filterItems(items, query), [items, query])

  useEffect(() => {
    if (visible) {
      setQuery('')
      setSelectedIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [visible])

  useEffect(() => {
    setSelectedIdx(0)
  }, [query])

  if (!visible) return null

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIdx]) {
        onSelect(results[selectedIdx])
        onClose()
      }
    }
  }

  return (
    <div className="palette-backdrop" onClick={onClose} role="dialog" aria-modal>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search folders, chats, files, tools…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKey}
        />
        <div className="palette-results">
          {results.map((item, i) => (
            <div
              key={item.id}
              className={`palette-item ${i === selectedIdx ? 'sel' : ''}`}
              onMouseEnter={() => setSelectedIdx(i)}
              onClick={() => { onSelect(item); onClose() }}
            >
              <span className="kind">{iconFor(item.kind)}</span>
              <span className="name">{item.label}</span>
              {item.hint && <span className="kbd">{item.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function iconFor(k: string) {
  return ({ action: '✨', chat: '💬', folder: '📂', file: '📄', skill: '⚡' } as const)[k as 'action'] ?? '·'
}
