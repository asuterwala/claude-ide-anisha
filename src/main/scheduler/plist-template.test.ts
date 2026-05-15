import { describe, it, expect } from 'vitest'
import { generatePlist } from './plist-template'

describe('generatePlist', () => {
  it('produces a valid launchd plist for cron-style schedule', () => {
    const plist = generatePlist({
      label: 'com.claudeide.morning-brief',
      programArgs: ['/Users/x/.claude-ide/bin/run-automation', 'morning-brief', 'schedule'],
      cron: '0 7 * * 1-5', // 7am Mon-Fri
      env: { HOME: '/Users/x', PATH: '/usr/bin', CLAUDE_CODE_USE_BEDROCK: 'false' },
      stdoutPath: '/Users/x/.claude-ide/runs/morning-brief.stdout',
      stderrPath: '/Users/x/.claude-ide/runs/morning-brief.stderr',
    })
    expect(plist).toContain('<key>Label</key><string>com.claudeide.morning-brief</string>')
    expect(plist).toContain('<key>ProgramArguments</key>')
    expect(plist).toContain('<string>/Users/x/.claude-ide/bin/run-automation</string>')
    expect(plist).toContain('<key>StartCalendarInterval</key>')
    // 5 weekday entries (Mon-Fri) since launchd needs separate entries for ranges
    const matches = plist.match(/<key>Hour<\/key><integer>7<\/integer>/g)
    expect(matches?.length).toBe(5)
    expect(plist).toContain('<key>EnvironmentVariables</key>')
  })
})
