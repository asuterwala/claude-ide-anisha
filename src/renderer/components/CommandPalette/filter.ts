export type PaletteKind = 'action' | 'folder' | 'chat' | 'file' | 'skill'

export interface PaletteItem {
  id: string
  kind: PaletteKind
  label: string
  hint?: string
  meta?: unknown
}

// Ranking: actions first, then chats, then folders, then files, then skills.
const KIND_RANK: Record<PaletteKind, number> = {
  action: 0, chat: 1, folder: 2, file: 3, skill: 4,
}
const PER_KIND_LIMIT = 8

export function filterItems(items: PaletteItem[], query: string): PaletteItem[] {
  const q = query.trim().toLowerCase()
  const terms = q.split(/\s+/).filter(Boolean)

  const matched = items.filter(i => {
    if (terms.length === 0) return true
    const hay = `${i.label} ${i.hint ?? ''}`.toLowerCase()
    return terms.every(t => hay.includes(t))
  })

  matched.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind])

  const counts: Partial<Record<PaletteKind, number>> = {}
  return matched.filter(i => {
    counts[i.kind] = (counts[i.kind] ?? 0) + 1
    return counts[i.kind]! <= PER_KIND_LIMIT
  })
}
