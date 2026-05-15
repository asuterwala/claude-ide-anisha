import { describe, it, expect } from 'vitest'
import { groupTabs } from './groupTabs'
import type { Tab } from '../../../shared/types'

describe('groupTabs', () => {
  it('separates standalone from folder-tied tabs', () => {
    const tabs: Tab[] = [
      { id: 'd', kind: 'dashboard', label: 'Dashboard', closeable: false },
      { id: 'a', kind: 'automations', label: 'Automations', closeable: false },
      { id: 'c1', kind: 'folder-chat', label: 'chat', closeable: true, folderPath: '/x/bm' },
      { id: 'f1', kind: 'file', label: 'dashboard.html', closeable: true, folderPath: '/x/bm', filePath: '/x/bm/dashboard.html' },
      { id: 'c2', kind: 'folder-chat', label: 'chat', closeable: true, folderPath: '/x/qr' },
      { id: 's1', kind: 'standalone-chat', label: 'Home chat', closeable: true },
    ]
    const result = groupTabs(tabs)
    expect(result.standalone.map(t => t.id)).toEqual(['d', 'a', 's1'])
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0].folderPath).toBe('/x/bm')
    expect(result.groups[0].tabs.map(t => t.id)).toEqual(['c1', 'f1'])
    expect(result.groups[1].folderPath).toBe('/x/qr')
    expect(result.groups[1].tabs.map(t => t.id)).toEqual(['c2'])
  })

  it('preserves tab order within a group', () => {
    const tabs: Tab[] = [
      { id: 'a', kind: 'file', label: 'a', closeable: true, folderPath: '/p', filePath: '/p/a' },
      { id: 'b', kind: 'file', label: 'b', closeable: true, folderPath: '/p', filePath: '/p/b' },
    ]
    const result = groupTabs(tabs)
    expect(result.groups[0].tabs.map(t => t.id)).toEqual(['a', 'b'])
  })
})
