import type { ApiType } from '../preload/index'
import type { AppConfig } from '../shared/types'

declare global {
  interface Window {
    api: ApiType & {
      loadConfig: () => Promise<AppConfig>
      showNotification: (title: string, body: string) => Promise<{ shown: boolean; reason?: string }>
    }
  }
}
