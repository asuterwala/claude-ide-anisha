import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { Tab, ClaudeStatus } from '../shared/types'

export interface BehaviorState {
  featuresUsed: Set<string>
  firstTerminalAt: number | null // timestamp
  isFirstLaunch: boolean
  firedTipIds: Set<string>
  triggeredTips: Array<{ id: string; message: string; timestamp: number }>
}

interface AppState {
  tabs: Tab[]
  activeTabId: string
  projectPath: string | null
  sidebarOpen: boolean
  claudeStatus: ClaudeStatus
  gitBranch: string | null
  splitTabId: string | null
  behavior: BehaviorState
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
  | { type: 'UPDATE_TAB_LABEL'; tabId: string; label: string }
  | { type: 'SET_SPLIT_TAB'; tabId: string | null }
  | { type: 'OPEN_IN_SPLIT'; tab: Tab }
  | { type: 'TRACK_FEATURE'; feature: string }
  | { type: 'FIRE_TIP'; tipId: string; message: string }
  | { type: 'SET_FIRST_LAUNCH'; isFirst: boolean }

const dashboardTab: Tab = {
  id: 'dashboard',
  type: 'dashboard',
  label: 'Dashboard',
  closeable: false
}

const initialState: AppState = {
  tabs: [dashboardTab],
  activeTabId: 'dashboard',
  projectPath: null,
  sidebarOpen: true,
  claudeStatus: { model: null, cost: null, tokens: null, context: null },
  gitBranch: null,
  splitTabId: null,
  behavior: {
    featuresUsed: new Set<string>(),
    firstTerminalAt: null,
    isFirstLaunch: false,
    firedTipIds: new Set<string>(),
    triggeredTips: [],
  }
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'ADD_TAB': {
      const newState = { ...state, tabs: [...state.tabs, action.tab], activeTabId: action.tab.id }
      if (action.tab.type === 'terminal' && !state.behavior.firstTerminalAt) {
        newState.behavior = { ...state.behavior, firstTerminalAt: Date.now() }
      }
      return newState
    }
    case 'CLOSE_TAB': {
      const tabs = state.tabs.filter(t => t.id !== action.tabId)
      const activeTabId = state.activeTabId === action.tabId
        ? tabs[tabs.length - 1]?.id ?? 'dashboard'
        : state.activeTabId
      const splitTabId = state.splitTabId === action.tabId ? null : state.splitTabId
      return { ...state, tabs, activeTabId, splitTabId }
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
      return { ...state, tabs: state.tabs.map(t => t.id === action.tabId ? { ...t, label: action.label } : t) }
    case 'SET_SPLIT_TAB':
      return { ...state, splitTabId: action.tabId }
    case 'OPEN_IN_SPLIT':
      return { ...state, tabs: [...state.tabs, action.tab], splitTabId: action.tab.id }
    case 'TRACK_FEATURE': {
      const featuresUsed = new Set(state.behavior.featuresUsed)
      featuresUsed.add(action.feature)
      return { ...state, behavior: { ...state.behavior, featuresUsed } }
    }
    case 'FIRE_TIP': {
      const firedTipIds = new Set(state.behavior.firedTipIds)
      firedTipIds.add(action.tipId)
      return {
        ...state,
        behavior: {
          ...state.behavior,
          firedTipIds,
          triggeredTips: [
            { id: action.tipId, message: action.message, timestamp: Date.now() },
            ...state.behavior.triggeredTips,
          ],
        },
      }
    }
    case 'SET_FIRST_LAUNCH':
      return { ...state, behavior: { ...state.behavior, isFirstLaunch: action.isFirst } }
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
