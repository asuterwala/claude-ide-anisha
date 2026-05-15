import type { Tab } from '../../../shared/types'

export interface TabGroup {
  folderPath: string
  tabs: Tab[]
}

export interface GroupedTabs {
  standalone: Tab[]
  groups: TabGroup[]
}

export function groupTabs(tabs: Tab[]): GroupedTabs {
  const standalone: Tab[] = []
  const byFolder = new Map<string, Tab[]>()
  const folderOrder: string[] = []

  for (const tab of tabs) {
    if (tab.folderPath) {
      if (!byFolder.has(tab.folderPath)) {
        byFolder.set(tab.folderPath, [])
        folderOrder.push(tab.folderPath)
      }
      byFolder.get(tab.folderPath)!.push(tab)
    } else {
      standalone.push(tab)
    }
  }

  return {
    standalone,
    groups: folderOrder.map(folderPath => ({ folderPath, tabs: byFolder.get(folderPath)! })),
  }
}
