import type { ApiType } from '../preload/index'
import type { AppConfig, NotionMeeting, NotionTask, PythonFile, StreamlitApp, TimeSavedData } from '../shared/types'

declare global {
  interface Window {
    api: ApiType & {
      loadConfig: () => Promise<AppConfig>
      fetchNotion: (dashboardId: string) => Promise<{ meetings: NotionMeeting[]; tasks: NotionTask[]; error: string | null }>
      listPythonFiles: (path: string) => Promise<PythonFile[]>
      runStreamlit: (file: string, port: number) => Promise<{ success: boolean; pid?: number; port?: number }>
      stopStreamlit: (file: string) => Promise<{ success: boolean; error?: string }>
      getStreamlitStatus: () => Promise<StreamlitApp[]>
      sendToTerminal: (ptyId: string, data: string) => Promise<void>
      sendSlack: (channelId: string, message: string) => Promise<{ success: boolean; error?: string }>
      loadTimeSaved: () => Promise<TimeSavedData>
      saveTimeSaved: (data: TimeSavedData) => Promise<{ success: boolean }>
      showNotification: (title: string, body: string) => Promise<{ shown: boolean; reason?: string }>
    }
  }
}
