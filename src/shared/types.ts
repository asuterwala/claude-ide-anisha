export type TabKind =
  | 'standalone-chat'
  | 'folder-chat'
  | 'file'
  | 'dashboard'
  | 'automations'

export interface Tab {
  id: string
  kind: TabKind
  label: string
  closeable: boolean
  folderPath?: string  // present for folder-chat, file (when folder-tied)
  filePath?: string    // present for kind === 'file'
  ptyId?: string       // present for kind === 'standalone-chat' | 'folder-chat'
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
  model: string | null      // e.g. "Opus 4.7"
  cost: number | null        // dollars
  tokens: number | null      // total tokens used
  context: { used: number; pct: number } | null
}

export interface RecentSession {
  projectPath: string
  branch: string | null
  lastOpened: number
}

// Config types
export interface AppConfig {
  user: {
    name: string
  }
  notifications: {
    enabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
  }
  theme: 'light'
}
