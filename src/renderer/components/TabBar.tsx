import React from 'react'
import { useAppState } from '../store'
import { groupTabs } from './TabBar/groupTabs'
import FolderGroup from './FolderGroup'
import type { Tab } from '../../shared/types'

export default function TabBar() {
  const { state, dispatch } = useAppState()
  const grouped = groupTabs(state.tabs)

  const onClick = (id: string) => dispatch({ type: 'SET_ACTIVE_TAB', tabId: id })
  const onClose = (id: string) => {
    const tab = state.tabs.find(t => t.id === id)
    if (tab?.ptyId) window.api.destroyPty(tab.ptyId)
    dispatch({ type: 'CLOSE_TAB', tabId: id })
  }

  const onReload = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.dispatchEvent(new CustomEvent('reload-chat-tab'))
  }

  const isActiveChat = (t: Tab) =>
    t.id === state.activeTabId &&
    (t.kind === 'folder-chat' || t.kind === 'standalone-chat')

  const renderStandalone = (t: Tab) => (
    <div
      key={t.id}
      className={`tab ${t.id === state.activeTabId ? 'active' : ''}`}
      onClick={() => onClick(t.id)}
    >
      {iconFor(t)} {t.label}
      {isActiveChat(t) && (
        <button
          type="button"
          className="x"
          title="Reload at current size (⌘⇧R)"
          aria-label="Reload chat at current window size"
          onClick={onReload}
        >↻</button>
      )}
      {t.closeable && (
        <button
          type="button"
          className="x"
          aria-label={`Close ${t.label}`}
          onClick={(e) => { e.stopPropagation(); onClose(t.id) }}
        >×</button>
      )}
    </div>
  )

  return (
    <div className="tabs">
      {grouped.standalone.map(renderStandalone)}
      {grouped.groups.length > 0 && <div className="tab-divider"></div>}
      {grouped.groups.map((g, i) => (
        <React.Fragment key={g.folderPath}>
          <FolderGroup
            folderPath={g.folderPath}
            tabs={g.tabs}
            activeTabId={state.activeTabId}
            onTabClick={onClick}
            onTabClose={onClose}
          />
          {i < grouped.groups.length - 1 && <div className="tab-divider"></div>}
        </React.Fragment>
      ))}
    </div>
  )
}

function iconFor(t: Tab) {
  switch (t.kind) {
    case 'dashboard': return <span>🏠</span>
    case 'automations': return <span>⚡</span>
    case 'standalone-chat': return <span>💬</span>
    case 'folder-chat': return <span>💬</span>
    case 'file': return <span>📄</span>
  }
}
