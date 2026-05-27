import type { Tab } from '../../shared/types'

// Assign colors per folder deterministically.
function folderColor(folderPath: string): { stripe: string; chip: string; dot: string } {
  const palette = [
    { stripe: '#C99FC9', chip: '#6B3F6B', dot: '#B07BB0' }, // lavender
    { stripe: '#E89F70', chip: '#8C4A20', dot: '#D9904B' }, // peach
    { stripe: '#7BC4A9', chip: '#2D6650', dot: '#4A9D7F' }, // mint
    { stripe: '#A9C4E5', chip: '#3B5A8C', dot: '#5B8DEF' }, // blue
    { stripe: '#E5A9C4', chip: '#8C3D5A', dot: '#D96B8A' }, // pink
  ]
  let hash = 0
  for (let i = 0; i < folderPath.length; i++) hash = (hash * 31 + folderPath.charCodeAt(i)) >>> 0
  return palette[hash % palette.length]
}

function folderBasename(folderPath: string): string {
  const parts = folderPath.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? folderPath
}

interface Props {
  folderPath: string
  tabs: Tab[]
  activeTabId: string
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
}

export default function FolderGroup({ folderPath, tabs, activeTabId, onTabClick, onTabClose }: Props) {
  const color = folderColor(folderPath)
  return (
    <div className="tab-group" style={{ borderBottomColor: color.stripe }}>
      <div className="folder-chip" title={folderPath} style={{ color: color.chip }}>
        <span className="dot" style={{ background: color.dot }}></span>
        📂 {folderBasename(folderPath)}
      </div>
      {tabs.map(tab => {
        const isActiveChat = tab.id === activeTabId &&
          (tab.kind === 'folder-chat' || tab.kind === 'standalone-chat')
        return (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => onTabClick(tab.id)}
          >
            <span>{tab.kind === 'file' ? '📄' : '💬'}</span>
            {tab.label}
            {tab.isDirty && <span className="dirty">●</span>}
            {isActiveChat && (
              <button
                type="button"
                className="x"
                title="Reload at current size (⌘⇧R)"
                aria-label="Reload chat at current window size"
                onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent('reload-chat-tab')) }}
              >↻</button>
            )}
            {tab.closeable && (
              <button
                type="button"
                className="x"
                aria-label={`Close ${tab.label}`}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
              >×</button>
            )}
          </div>
        )
      })}
    </div>
  )
}
