import { useState } from 'react'
import { useAppState } from '../store'
import { useFileTree } from '../hooks/useFileTree'
import type { FileNode, GitFileStatus } from '../../shared/types'

function gitBadgeClass(status: GitFileStatus): string | null {
  if (status === 'modified') return 'modified'
  if (status === 'added') return 'added'
  if (status === 'untracked') return 'untracked'
  return null
}

function gitBadgeLetter(status: GitFileStatus): string {
  if (status === 'modified') return 'M'
  if (status === 'added') return '+'
  if (status === 'untracked') return '?'
  if (status === 'deleted') return 'D'
  if (status === 'renamed') return 'R'
  return ''
}

function FileTreeNode({ node, depth, gitStatuses, onFileClick, onFolderClick }: {
  node: FileNode
  depth: number
  gitStatuses: Record<string, GitFileStatus>
  onFileClick: (path: string, name: string) => void
  onFolderClick: (path: string, name: string) => void
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
      onFolderClick(node.path, node.name)
    } else {
      onFileClick(node.path, node.name)
    }
  }

  const relativePath = node.path.split('/').slice(-Math.max(depth + 1, 1)).join('/')
  const status = gitStatuses[relativePath] || null
  const badgeClass = gitBadgeClass(status)
  const badgeLetter = gitBadgeLetter(status)

  // Map depth to indent class (depth 0 = no extra indent, depth 1 = indent-1, depth 2+ = indent-2)
  const indentClass = depth === 1 ? 'indent-1' : depth >= 2 ? 'indent-2' : ''

  return (
    <>
      <div
        className={`tree-item${indentClass ? ' ' + indentClass : ''}`}
        onClick={handleClick}
      >
        <span className="chev">
          {node.isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="ico">
          {node.isDirectory ? (expanded ? '📂' : '📁') : '📄'}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {node.name}
        </span>
        {badgeClass && (
          <span className={`git ${badgeClass}`}>{badgeLetter}</span>
        )}
      </div>
      {expanded && children.map(child => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={depth + 1}
          gitStatuses={gitStatuses}
          onFileClick={onFileClick}
          onFolderClick={onFolderClick}
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

    dispatch({
      type: 'ADD_TAB',
      tab: {
        id: `file-${Date.now()}`,
        kind: 'file',
        label: fileName,
        closeable: true,
        folderPath: state.projectPath ?? undefined,
        filePath
      }
    })
  }

  const handleFolderClick = async (folderPath: string, folderName: string) => {
    const existing = state.tabs.find(t => t.kind === 'folder-chat' && t.folderPath === folderPath)
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id })
      return
    }

    const ptyId = await window.api.createPty(folderPath)
    dispatch({
      type: 'ADD_TAB',
      tab: {
        id: `folder-chat-${Date.now()}`,
        kind: 'folder-chat',
        label: folderName,
        closeable: true,
        folderPath,
        ptyId
      }
    })
  }

  if (!state.projectPath) return null

  return (
    <section className="sidebar-section">
      <div className="sidebar-header">
        <span>Folders</span>
        <span className="add" title="Add folder">+</span>
      </div>
      <div className="tree">
        {tree.map(node => (
          <FileTreeNode
            key={node.path}
            node={node}
            depth={0}
            gitStatuses={gitStatuses}
            onFileClick={handleFileClick}
            onFolderClick={handleFolderClick}
          />
        ))}
      </div>
    </section>
  )
}
