# Calendar & Tasks Refresh Architecture

## Current Data Flow

```
Launchd (every 30 min)
  → ~/.local/bin/refresh-dashboard.sh
    → Claude CLI (Bedrock via AWS SSO)
      → mcp__gcalgusto__list_events → calendar-cache.json
      → mcp__notiongusto__notion-query-data-sources → tasks-cache.json
        → Claude IDE reads cache files for "Today" panel
```

### Key files (outside the repo)
- **Launchd plist**: `~/Library/LaunchAgents/com.anisha.dashboard-refresh.plist`
- **Refresh script**: `~/.local/bin/refresh-dashboard.sh`
- **Cache files**: `~/.memory/mission-control/calendar-cache.json`, `tasks-cache.json`
- **Logs**: `~/.memory/mission-control/refresh.log`

### Key files (in repo)
- **IPC handlers**: `src/main/ipc-handlers.ts` (reads cache, triggers refresh script)
- **UI component**: `src/renderer/components/TodayPanel.tsx` (displays data)

### Refresh script configuration

The refresh script at `~/.local/bin/refresh-dashboard.sh` must include `--allowedTools` to prevent Claude CLI from prompting for MCP permissions. Current working version:

```bash
#!/bin/bash
export CLAUDE_CODE_USE_BEDROCK=true
export AWS_PROFILE=bedrock-users
export AWS_REGION=us-west-2

LOG_FILE="$HOME/.memory/mission-control/refresh.log"
mkdir -p "$HOME/.memory/mission-control"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting dashboard refresh" >> "$LOG_FILE"

/opt/homebrew/bin/claude --model us.anthropic.claude-sonnet-4-20250514-v1:0 \
  --allowedTools "mcp__gcalgusto__list_events,mcp__notiongusto__notion-query-data-sources,Write" \
  -p "Refresh my dashboard caches:
1. Use mcp__gcalgusto__list_events (today only) and write to ~/.memory/mission-control/calendar-cache.json
2. Use mcp__notiongusto__notion-query-data-sources to get tasks from collection://7e6ad673-c6c2-83fc-a0fe-87fd5c82889c and write to ~/.memory/mission-control/tasks-cache.json
Output only the JSON files, no explanation." >> "$LOG_FILE" 2>&1

RESULT=$?
echo "$(date '+%Y-%m-%d %H:%M:%S') - Refresh completed with exit code $RESULT" >> "$LOG_FILE"
exit $RESULT
```

**Note (2026-03-26):** Added `--allowedTools` flag to fix silent failures where Claude CLI was prompting for MCP tool permissions instead of executing them.

---

## Option A: Handle Staleness Gracefully (Implemented)

Keep the existing launchd + Claude CLI + Bedrock architecture. Add resilience in the IDE:

1. **Date validation** — if `fetchedAt` in the cache isn't today, treat calendar as empty instead of showing yesterday's meetings
2. **Refresh buttons actually work** — trigger the refresh script on click, then re-read cache
3. **Error surfacing** — if refresh fails (e.g. expired AWS SSO token), show a clear message in the UI
4. **30-min auto-refresh** — component interval triggers real refreshes, not just cache re-reads

### Known limitation
AWS SSO tokens expire every 8 hours. When expired, the refresh script fails and the cache goes stale. User must manually run `aws sso login --profile bedrock-users` to re-authenticate.

---

## Option B: Bypass Claude CLI + Bedrock (Future)

The GCal and Notion MCP servers use their own OAuth tokens, completely separate from AWS SSO. The only reason AWS is in the picture is because the refresh script uses Claude CLI (which needs Bedrock) as the orchestrator.

### Approach
Call the MCP servers directly, removing Claude CLI from the refresh path:

```
Launchd or Electron app
  → MCP server (gcalgusto) directly → calendar-cache.json
  → MCP server (notiongusto) directly → tasks-cache.json
```

### What this would involve
1. Figure out how the GCal/Notion MCP servers are started and how to invoke their tools programmatically (likely via stdio JSON-RPC)
2. Write a lightweight script or Electron IPC handler that speaks the MCP protocol directly
3. Remove the Claude CLI + Bedrock dependency from the refresh path entirely

### Benefits
- No more 8-hour auth expiry — GCal/Notion OAuth tokens refresh automatically
- Faster refreshes (no LLM round-trip)
- More reliable automation

### Risks
- Need to understand MCP server invocation details
- More code to maintain vs. the one-liner Claude CLI call
