export type TabType = 'dashboard' | 'terminal' | 'editor'

export interface Tab {
  id: string
  type: TabType
  label: string
  closeable: boolean
  ptyId?: string
  projectPath?: string
  filePath?: string
  isDirty?: boolean
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
  size?: number
  gitStatus?: GitFileStatus
}

export type GitFileStatus = 'modified' | 'untracked' | 'deleted' | 'added' | 'renamed' | null

export interface ClaudeStatus {
  model: string | null
  cost: string | null
  tokens: string | null
  context: string | null
}

export interface RecentSession {
  projectPath: string
  branch: string | null
  lastOpened: number
}
