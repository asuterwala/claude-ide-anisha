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

### Key files
- **Launchd plist**: `~/Library/LaunchAgents/com.anisha.dashboard-refresh.plist`
- **Refresh script**: `~/.local/bin/refresh-dashboard.sh`
- **Cache files**: `~/.memory/mission-control/calendar-cache.json`, `tasks-cache.json`
- **IDE consumer**: `src/main/ipc-handlers.ts` (reads cache), `src/renderer/components/TodayPanel.tsx` (displays)
- **Logs**: `~/.memory/mission-control/refresh.log`

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
