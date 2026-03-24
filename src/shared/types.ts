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

// Notion types
export interface NotionMeeting {
  id: string
  title: string
  time: Date
  attendees?: number
}

export interface NotionTask {
  id: string
  title: string
  status: 'Not started' | 'In progress' | 'Done'
  due?: Date
}

// Streamlit types
export interface StreamlitApp {
  file: string
  port: number | null
  status: 'stopped' | 'running' | 'crashed' | 'external'
  pid: number | null
}

export interface PythonFile {
  path: string
  name: string
  isStreamlit: boolean
  lastModified: number
}

// Config types
export interface AppConfig {
  user: {
    name: string
    slackSignature: string
  }
  notion: {
    enabled: boolean
    dashboardId: string
    refreshIntervalMinutes: number
  }
  streamlit: {
    enabled: boolean
    defaultPort: number
    keepRunningOnClose: boolean
  }
  notifications: {
    enabled: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
  }
  slack: {
    enabled: boolean
    draftVoice: string
    quickRecipients: Array<{ id: string; name: string; type: string }>
  }
  skills: {
    categories: Array<{
      label: string
      skills: Array<{ cmd: string; desc: string }>
    }>
    timeSavedWeights: Record<string, number>
  }
  theme: 'light'
}

// Time saved types
export interface TimeSavedData {
  [date: string]: {
    minutes: number
    actions: string[]
  }
}
