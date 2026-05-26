import { useState, useEffect, useCallback } from 'react'
import type { FileNode, GitFileStatus } from '../../shared/types'

export function useFileTree(projectPath: string | null) {
  const [tree, setTree] = useState<FileNode[]>([])
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitFileStatus>>({})
  // Ticks on every file-change event so expanded subtrees can re-fetch their
  // children. Previously only the root was refreshed; an expanded folder
  // would show stale contents after a new file was added/removed.
  const [refreshVersion, setRefreshVersion] = useState(0)

  const refresh = useCallback(async () => {
    if (!projectPath) return
    const [nodes, statuses] = await Promise.all([
      window.api.readDir(projectPath),
      window.api.getGitStatus(projectPath)
    ])
    setTree(nodes)
    setGitStatuses(statuses)
    setRefreshVersion(v => v + 1)
  }, [projectPath])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (!projectPath) return
    const unsubscribe = window.api.onFileChange(() => {
      refresh()
    })
    return unsubscribe
  }, [projectPath, refresh])

  return { tree, gitStatuses, refresh, refreshVersion }
}
