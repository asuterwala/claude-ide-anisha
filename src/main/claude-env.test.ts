import { describe, it, expect } from 'vitest'
import { buildPlistEnv } from './claude-env'

describe('buildPlistEnv', () => {
  it('includes HOME, PATH with claude bin dir, CLAUDE_CODE_USE_BEDROCK=false', () => {
    const env = buildPlistEnv({
      claudeBin: '/Users/anisha.suterwala/.local/bin/claude',
      home: '/Users/anisha.suterwala',
    })
    expect(env.HOME).toBe('/Users/anisha.suterwala')
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('false')
    expect(env.PATH).toContain('/Users/anisha.suterwala/.local/bin')
    expect(env.PATH).toContain('/usr/bin')
    expect(env.PATH).toContain('/opt/homebrew/bin')
  })
})
