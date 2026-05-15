import { describe, it, expect } from 'vitest'
import { filterItems, type PaletteItem } from './filter'

const items: PaletteItem[] = [
  { id: 'action:new', kind: 'action', label: 'New Claude chat', hint: '⌘T' },
  { id: 'folder:/x/bm', kind: 'folder', label: 'finance/benefits-model' },
  { id: 'chat:1', kind: 'chat', label: 'Refresh BI dashboard', hint: '2h' },
  { id: 'file:/x/bm/dashboard.html', kind: 'file', label: 'bi-dashboard.html', hint: 'benefits-model' },
  { id: 'skill:refresh-bi', kind: 'skill', label: 'refresh-fbos-bi-dash', hint: 'skill' },
]

describe('filterItems', () => {
  it('returns all on empty query', () => {
    const result = filterItems(items, '')
    expect(result.length).toBe(5)
  })

  it('matches substring case-insensitively', () => {
    expect(filterItems(items, 'bi').map(i => i.id)).toContain('chat:1')
    expect(filterItems(items, 'BI').map(i => i.id)).toContain('chat:1')
  })

  it('ranks chats above files when both match', () => {
    const r = filterItems(items, 'bi dash')
    const chatIdx = r.findIndex(i => i.id === 'chat:1')
    const fileIdx = r.findIndex(i => i.id === 'file:/x/bm/dashboard.html')
    expect(chatIdx).toBeLessThan(fileIdx)
  })

  it('limits results to 8 per kind', () => {
    const many = Array.from({ length: 12 }, (_, i): PaletteItem => ({
      id: `f:${i}`, kind: 'file', label: `bi-${i}.sql`
    }))
    const r = filterItems(many, 'bi')
    expect(r.filter(i => i.kind === 'file').length).toBeLessThanOrEqual(8)
  })
})
