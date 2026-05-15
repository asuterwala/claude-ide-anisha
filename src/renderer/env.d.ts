import type { ApiType } from '../preload/index'
import type { AppConfig } from '../shared/types'
import type { Automation, AutomationInput, Run } from '../shared/automation-types'

declare global {
  interface Window {
    api: ApiType & {
      loadConfig: () => Promise<AppConfig>
      showNotification: (title: string, body: string) => Promise<{ shown: boolean; reason?: string }>
      listAutomations(): Promise<Automation[]>
      createAutomation(input: AutomationInput): Promise<Automation>
      updateAutomation(id: string, patch: Partial<AutomationInput>): Promise<Automation>
      removeAutomation(id: string): Promise<void>
      runAutomationNow(id: string): Promise<string>
      listRuns(opts?: { sinceDate?: Date; automationId?: string }): Promise<Run[]>
      onRunUpdate(cb: (run: Run) => void): () => void
    }
  }
}
