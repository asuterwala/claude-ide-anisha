import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Tab, ClaudeStatus, AppConfig } from '../shared/types'

export interface BehaviorState {
  featuresUsed: Set<string>
  firstTerminalAt: number | null // timestamp
  isFirstLaunch: boolean
}

interface AppState {
  tabs: Tab[]
  activeTabId: string
  projectPath: string | null
  sidebarOpen: boolean
  claudeStatus: ClaudeStatus
  gitBranch: string | null
  behavior: BehaviorState
  notifications: {
    enabled: boolean
    lastNotified: number | null
  }
  config: AppConfig | null
}

type Action =
  | { type: 'ADD_TAB'; tab: Tab }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'SET_PROJECT_PATH'; path: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'UPDATE_CLAUDE_STATUS'; status: Partial<ClaudeStatus> }
  | { type: 'SET_GIT_BRANCH'; branch: string | null }
  | { type: 'SET_TAB_DIRTY'; tabId: string; isDirty: boolean }
  | { type: 'UPDATE_TAB_LABEL'; tabId: string; label: string; detectedSessionId?: string }
  | { type: 'TRACK_FEATURE'; feature: string }
  | { type: 'SET_FIRST_LAUNCH'; isFirst: boolean }
  | { type: 'CONFIG_LOADED'; payload: AppConfig }
  | { type: 'NOTIFICATIONS_TOGGLE'; payload: boolean }

const dashboardTab: Tab = { id: 'dashboard', kind: 'dashboard', label: 'Dashboard', closeable: false }
const automationsTab: Tab = { id: 'automations', kind: 'automations', label: 'Automations', closeable: false }

const initialState: AppState = {
  tabs: [dashboardTab, automationsTab],
  activeTabId: 'dashboard',
  projectPath: null,
  sidebarOpen: true,
  claudeStatus: { model: null, cost: null, tokens: null, context: null },
  gitBranch: null,
  behavior: {
    featuresUsed: new Set<string>(),
    firstTerminalAt: null,
    isFirstLaunch: false,
  },
  notifications: { enabled: true, lastNotified: null },
  config: null,
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TAB': {
      const newState = { ...state, tabs: [...state.tabs, action.tab], activeTabId: action.tab.id }
      if ((action.tab.kind === 'folder-chat' || action.tab.kind === 'standalone-chat') && !state.behavior.firstTerminalAt) {
        newState.behavior = { ...state.behavior, firstTerminalAt: Date.now() }
      }
      return newState
    }
    case 'CLOSE_TAB': {
      const tabs = state.tabs.filter(t => t.id !== action.tabId)
      const activeTabId = state.activeTabId === action.tabId
        ? tabs[tabs.length - 1]?.id ?? 'dashboard'
        : state.activeTabId
      return { ...state, tabs, activeTabId }
    }
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTabId: action.tabId }
    case 'SET_PROJECT_PATH':
      return { ...state, projectPath: action.path }
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'UPDATE_CLAUDE_STATUS':
      return { ...state, claudeStatus: { ...state.claudeStatus, ...action.status } }
    case 'SET_GIT_BRANCH':
      return { ...state, gitBranch: action.branch }
    case 'SET_TAB_DIRTY':
      return { ...state, tabs: state.tabs.map(t => t.id === action.tabId ? { ...t, isDirty: action.isDirty } : t) }
    case 'UPDATE_TAB_LABEL':
      return {
        ...state,
        tabs: state.tabs.map(t =>
          t.id === action.tabId
            ? { ...t, label: action.label, ...(action.detectedSessionId ? { detectedSessionId: action.detectedSessionId } : {}) }
            : t
        )
      }
    case 'TRACK_FEATURE': {
      const featuresUsed = new Set(state.behavior.featuresUsed)
      featuresUsed.add(action.feature)
      return { ...state, behavior: { ...state.behavior, featuresUsed } }
    }
    case 'SET_FIRST_LAUNCH':
      return { ...state, behavior: { ...state.behavior, isFirstLaunch: action.isFirst } }
    case 'CONFIG_LOADED':
      return { ...state, config: action.payload }
    case 'NOTIFICATIONS_TOGGLE':
      return { ...state, notifications: { ...state.notifications, enabled: action.payload } }
    default:
      return state
  }
}

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const value = { state, dispatch }
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppState() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppState must be used within AppProvider')
  return ctx
}
