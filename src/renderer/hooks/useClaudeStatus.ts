import { useEffect } from 'react'
import { useAppState } from '../store'
import type { ClaudeStatus } from '../../shared/types'

const COST_RE = /\$([\d.]+)/
const TOKENS_RE = /([\d.]+)\s*([MK]?)\s*tokens/i
const CONTEXT_RE = /(\d+)%/
const MODEL_RE = /(opus|sonnet|haiku)[\s-]*([\d.]+)/i

function parseTokens(num: string, suffix: string): number {
  const n = parseFloat(num)
  if (suffix.toUpperCase() === 'M') return Math.round(n * 1_000_000)
  if (suffix.toUpperCase() === 'K') return Math.round(n * 1_000)
  return Math.round(n)
}

function parseStatusLine(data: string): Partial<ClaudeStatus> {
  const result: Partial<ClaudeStatus> = {}

  const costMatch = data.match(COST_RE)
  if (costMatch) result.cost = parseFloat(costMatch[1])

  const tokensMatch = data.match(TOKENS_RE)
  if (tokensMatch) result.tokens = parseTokens(tokensMatch[1], tokensMatch[2])

  // follow-up: parse context % from Claude CLI status line
  const contextMatch = data.match(CONTEXT_RE)
  if (contextMatch) {
    const pct = parseInt(contextMatch[1], 10)
    result.context = { used: 0, pct }
  }

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
