import { useEffect } from 'react'
import { useAppState } from '../store'

const COST_RE = /\$[\d.]+/
const TOKENS_RE = /([\d.]+[MKB]?\s*tokens)/i
const CONTEXT_RE = /(\d+)%/
const MODEL_RE = /(opus|sonnet|haiku)[\s-]*([\d.]+)/i

function parseStatusLine(data: string): Record<string, string | null> {
  const result: Record<string, string | null> = {}

  const costMatch = data.match(COST_RE)
  if (costMatch) result.cost = costMatch[0]

  const tokensMatch = data.match(TOKENS_RE)
  if (tokensMatch) result.tokens = tokensMatch[1]

  const contextMatch = data.match(CONTEXT_RE)
  if (contextMatch) result.context = `${contextMatch[1]}%`

  const modelMatch = data.match(MODEL_RE)
  if (modelMatch) result.model = `${modelMatch[1]} ${modelMatch[2]}`

  return result
}

export function useClaudeStatus() {
  const { state, dispatch } = useAppState()

  useEffect(() => {
    const activeTab = state.tabs.find(t => t.id === state.activeTabId)
    if (!activeTab?.ptyId) return

    const unsubscribe = window.api.onPtyData((id, data) => {
      if (id !== activeTab.ptyId) return
      const parsed = parseStatusLine(data)
      if (Object.keys(parsed).length > 0) {
        dispatch({ type: 'UPDATE_CLAUDE_STATUS', status: parsed })
      }
    })

    return unsubscribe
  }, [state.activeTabId, state.tabs, dispatch])
}
