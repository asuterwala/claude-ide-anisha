import { useState } from 'react'
import { useAppState } from '../store'
import { useFileTree } from '../hooks/useFileTree'
import type { FileNode, GitFileStatus, Tab } from '../../shared/types'

const gitBadgeColors: Record<string, string> = {
  modified: '#e8a838',
  untracked: '#89d185',
  deleted: '#f44747',
  added: '#89d185',
  renamed: '#4fc1ff'
}

const gitBadgeLetters: Record<string, string> = {
  modified: 'M',
  untracked: 'U',
  deleted: 'D',
  added: 'A',
  renamed: 'R'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function FileTreeNode({ node, depth, gitStatuses, onFileClick }: {
  node: FileNode
  depth: number
  gitStatuses: Record<string, GitFileStatus>
  onFileClick: (path: string, name: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileNode[]>([])

  const handleClick = async () => {
    if (node.isDirectory) {
      if (!expanded) {
        const nodes = await window.api.readDir(node.path)
        setChildren(nodes)
      }
      setExpanded(!expanded)
    } else {
      onFileClick(node.path, node.name)
    }
  }

  const relativePath = node.path.split('/').slice(-Math.max(depth + 1, 1)).join('/')
  const status = gitStatuses[relativePath] || null

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          padding: '3px 8px',
          paddingLeft: 16 + depth * 16,
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: node.isDirectory ? '#ccc' : '#ce9178',
          fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#2a2d2e')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <span>
          {node.isDirectory && (expanded ? '▾ ' : '▸ ')}
          {node.name}
        </span>
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && (
            <span style={{ color: gitBadgeColors[status], fontSize: 11 }}>
              {gitBadgeLetters[status]}
            </span>
          )}
          {!node.isDirectory && node.size != null && (
            <span style={{ color: '#666', fontSize: 11 }}>{formatSize(node.size)}</span>
          )}
        </span>
      </div>
      {expanded && children.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          gitStatuses={gitStatuses}
          onFileClick={onFileClick}
        />
      ))}
    </>
  )
}

export default function FileExplorer() {
  const { state, dispatch } = useAppState()
  const { tree, gitStatuses } = useFileTree(state.projectPath)

  const handleFileClick = (filePath: string, fileName: string) => {
    const existing = state.tabs.find(t => t.filePath === filePath)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id })
      return
    }

    const tab: Tab = {
      id: `editor-${Date.now()}`,
      type: 'editor',
      label: fileName,
      closeable: true,
      filePath
    }
    dispatch({ type: 'ADD_TAB', tab })
  }

  if (!state.projectPath) return null

  return (
    <div style={{
      width: 220,
      background: '#252526',
      borderRight: '1px solid #3e3e3e',
      overflowY: 'auto',
      flexShrink: 0,
      display: state.sidebarOpen ? 'block' : 'none'
    }}>
      <div style={{
        padding: '8px 16px',
        color: '#888',
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: 1
      }}>
        Explorer
      </div>
      {tree.map(node => (
        <FileTreeNode
          key={node.path}
          node={node}
          depth={0}
          gitStatuses={gitStatuses}
          onFileClick={handleFileClick}
        />
      ))}
    </div>
  )
}
