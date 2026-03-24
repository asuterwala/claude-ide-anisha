# Anisha IDE - Custom Claude IDE Design Spec

**Date:** 2026-03-24
**Author:** Anisha Suterwala
**Status:** Draft

## Overview

A custom Claude IDE tailored for a non-technical user building Python forecast models with Streamlit. Forks the base Claude IDE and adds targeted features for productivity, Notion integration, and Streamlit development workflow.

## User Context

- Strategic Finance team member
- Building forecast models in Python (learning to code)
- Uses Notion for task/meeting management
- Prefers light mode with soothing colors
- Comfortable with terminal but appreciates guidance

## Features

### 1. Light Mode Theme

**Goal:** Replace dark mode with a calming, professional light theme.

**Color Palette:**
- Background: `#F8F9FA` (soft off-white)
- Panels: `#FFFFFF` (clean white)
- Borders: `#E2E8F0` (light gray)
- Primary accent: `#5B8DEF` (calm blue)
- Success: `#68D391` (soft green)
- Warning: `#F6AD55` (warm amber)
- Text primary: `#2D3748` (dark gray, not pure black)
- Text secondary: `#718096` (medium gray)
- Code background: `#EDF2F7` (very light gray)

**Implementation:**
- CSS variables at root level for easy theming
- Monaco editor theme: "vs" (light) instead of "vs-dark"
- Terminal theme: light variant with dark text

### 2. Notion Integration

**Goal:** Surface upcoming meetings and pending tasks from user's Notion dashboard.

**Data Source:** User's Notion Dashboard (`311ad673c6c280c5b685cfa647ea3b69`)
- Task Tracker database for tasks
- 1x1s, Recurring Meetings, Other Meetings sections

**Dashboard Panel:**
```
Notion
  Meetings Today
    9:00 AM  Metrics Sync (weekly)
    11:30 AM Anisha / Juan
    2:00 PM  Anisha / Brandon - 1x1

  Tasks (3 pending)
    [ ] Review forecast model
    [ ] Update Q2 assumptions
    [ ] Prep for Monday sync
```

**Behavior:**
- Fetches via Notion MCP on app launch
- Auto-refresh every 30 minutes
- Manual refresh button available
- Graceful empty state when no items

**Error Handling:**
- If Notion MCP unavailable: Show "Notion disconnected" with retry button
- If authentication fails: Show "Notion auth expired - reconnect in settings"
- If dashboard ID invalid: Show "Dashboard not found - check config"
- Retry logic: 3 attempts with exponential backoff (1s, 2s, 4s), then show error state
- Cache last successful fetch to display stale data with "Last updated X ago" indicator

**Expected Database Schema:**
Tasks database properties:
- `Name` (title): Task name
- `Status` (select): "Not started", "In progress", "Done"
- `Due` (date): Optional due date

Meetings are read from linked databases or inline mentions with:
- `Name` (title): Meeting title
- `Date` (date): Meeting date/time

If properties are missing, the panel gracefully omits that field rather than failing.

**MCP Tools Used:**
- `mcp__notiongusto__notion-search` - find databases
- `mcp__notiongusto__notion-fetch` - get tasks/meetings

### 3. Streamlit Model Status Panel

**Goal:** Track Python/Streamlit app status without terminal commands.

**Panel Display:**
```
Models
  app.py              [Run]
  forecast_v2.py      Running on localhost:8501  [Open] [Stop]
  utils.py            Modified 2 min ago
```

**Detection Logic:**
- Scans project directory for `.py` files
- Identifies Streamlit apps by:
  - Filename patterns: `app.py`, `*_app.py`, `streamlit_*.py`
  - Import detection: files containing `import streamlit` or `from streamlit`
- Shows running status by checking process list for `streamlit run`

**Actions:**
- **Run:** Spawns `streamlit run <file>` in background, shows localhost URL
- **Open:** Opens browser to localhost:8501 (or detected port)
- **Stop:** Kills the streamlit process

**Port Allocation:**
- First app uses `defaultPort` (8501)
- Subsequent apps auto-increment: 8502, 8503, etc.
- Panel tracks port-to-app mapping in memory
- If port is already in use (external process), try next available port

**Process Management Edge Cases:**
- **Crash detection:** Poll process every 5 seconds; if exit code non-zero, update status to "Crashed" with [Restart] button
- **External processes:** On launch, scan `ps aux | grep streamlit` to detect apps started outside IDE; show as "Running (external)" with [Open] only (no Stop)
- **IDE close behavior:** Prompt user "Stop running Streamlit apps?" with options: "Stop all", "Keep running", "Always keep running" (saved to config)
- **Orphan cleanup:** On IDE launch, check for zombie processes from previous sessions and offer to kill them

**Empty State:** "No Streamlit apps detected. Create app.py to get started."

**File List:** Shows all `.py` files with last modified timestamp for quick reference.

### 4. Desktop Notifications

**Goal:** Alert user when Claude needs input, especially when IDE is in background.

**Trigger Conditions:**
- Claude stops generating and awaits response
- IDE window is not currently focused

**Detection Logic:**
Claude is considered "waiting" when ALL of these are true:
1. Terminal output has stopped (no new characters for 2+ seconds)
2. The last line does NOT end with a command prompt (`$`, `>`, `%`)
3. The last line ends with `?` OR contains permission prompts like `[Y/n]`, `(yes/no)`, `Allow?`
4. OR the terminal shows the Claude input prompt (waiting for user message)

This avoids false positives from long-running commands or output pauses.

**Notification Content:**
- Title: "Claude Code"
- Body: "Waiting for your response"
- Subtitle: First ~50 characters of Claude's question (if applicable)

**Behavior:**
- Clicking notification brings IDE to foreground
- No notification if IDE is already active window (prevents spam)
- Uses native macOS notification system via Electron

**Settings:**
- Toggle: Enable/disable notifications
- Quiet hours: Optional time range to suppress (e.g., after 6pm)

### 5. Skills Launcher

**Goal:** Quick access to Claude Code skills without memorizing commands.

**Source:** Ported from Mission Control, adapted for light theme.

**Panel Display:**
```
Skills
  Productivity
    /morning      Morning brief + meeting prep
    /eod          End of day wrap + summary
    /email-sweep  Inbox triage

  Analysis
    /monthly-flash  Monthly flash report
```

**Behavior:**
- Click skill to execute in active terminal
- Categories and skills defined in config file
- Easy to add/remove skills

**Execution Context:**
Skills starting with `/` (like `/morning`) are Claude Code slash commands. Clicking them:
1. Focuses the active terminal tab (or creates one if none exists)
2. Types the command text into the Claude Code input area
3. Sends the command (simulates Enter key)

This works because Claude Code is running in the terminal - the IDE just sends keystrokes.

**Config Location:** `~/.config/claude-ide-mc/config.json` (reuses existing format)

### 6. Quick Slack

**Goal:** Send Slack messages with Claude's help drafting.

**Source:** Ported from Mission Control.

**Workflow:**
1. Select recipient from dropdown (pre-configured channels/people)
2. Type message intent in text field
3. Click "Draft" - Claude generates message in configured voice
4. Review draft in preview area, edit inline if needed
5. Click "Send" to deliver, or "Redraft" to regenerate

**Draft Preview UI:**
```
┌─ Quick Slack ─────────────────────────────┐
│ To: [#engineering        ▼]               │
│                                           │
│ Intent: [Sharing Q2 forecast update    ]  │
│                                     [Draft]│
│ ─────────────────────────────────────────│
│ Preview:                                  │
│ ┌───────────────────────────────────────┐│
│ │ Hey team, wanted to share a quick     ││
│ │ update on the Q2 forecast...          ││
│ │                                       ││
│ │ _Sent by Claude Code_ :claude:        ││
│ └───────────────────────────────────────┘│
│                        [Redraft] [Send]   │
└───────────────────────────────────────────┘
```

**Features:**
- Auto-appends signature: "_Sent by Claude Code_ :claude:"
- Voice/tone from config: "direct, concise, collaborative"
- Recipients configured in config file
- Preview is editable - user can modify before sending

**Recipient Configuration Note:**
For DMs, use the DM channel ID (starts with `D`), NOT the user ID (starts with `U`).
To find a DM channel ID: use `mcp__slackgustoofficialmcp__slack_search_channels` with the person's name.
Example: `{ "id": "D04STCSDSJF", "name": "DM with Juan", "type": "dm" }`

**MCP Tools Used:**
- `mcp__slackgustoofficialmcp__slack_send_message`
- `mcp__slackgustoofficialmcp__slack_search_channels` (for recipient lookup)

### 7. Time Saved Tracking

**Goal:** Show estimated time saved using Claude Code.

**Source:** Ported from Mission Control.

**Display:** "~2h 15m saved today"

**Calculation:**
- Each skill/action has a weight in minutes (configurable)
- Example weights:
  - `/morning`: 20 min
  - `/eod`: 15 min
  - `/email-sweep`: 20 min
  - `slack-send`: 5 min
  - `meeting-prep`: 10 min

**Optional:** Dollar value based on configured hourly rate.

**Persistence:**
- Data stored in `~/.memory/mission-control/time-saved.json`
- Format: `{ "2026-03-24": { "minutes": 135, "actions": ["morning", "slack-send", ...] } }`
- Resets daily at midnight (local time)
- Historical data retained for 30 days (for potential weekly/monthly summaries)
- On app launch, reads today's accumulated time from file

**Config:** Weights defined in `skills.timeSavedWeights` in config file.

### 8. Enhanced Tips System

**Goal:** Help terminal-uncomfortable users with contextual guidance.

**Tip Categories:**
1. **Session commands:** /compact, /clear, /cost, /model, /help
2. **Keyboard shortcuts:** Cmd+P (file search), Cmd+Shift+F (project search), Cmd+K (inline edit)
3. **Natural language patterns:** "fix the bug", "explain this code", "add a test"
4. **Streamlit-specific:** "run my app", "add a chart", "deploy to Snowflake"

**Display:**
```
Tips
  Use /compact to free up context in long sessions

  Cmd+P opens any file by name - no clicking through folders

  Type "fix the bug in line 42" - Claude understands natural language
```

**Behavior:**
- Shows 2-3 tips at a time
- Rotates tips every few minutes
- Contextual: shows Streamlit tips when `.py` files present
- "Show more" expands to full cheat sheet
- Tips can be dismissed

## Features NOT Included

Explicitly removed to keep the IDE focused:

- Dark mode (light only)
- Calendar integration (using Notion instead)
- Market data widgets
- Mission Control todo system (using Notion tasks)
- "Waiting on" tracker
- "What's New" feed
- Complex analytics dashboards

## Architecture

### File Structure

```
claude-ide/
├── src/
│   ├── main/           # Electron main process
│   │   └── index.ts    # Add notification handlers
│   ├── preload/        # Bridge to renderer
│   │   └── index.ts    # Expose new APIs
│   ├── renderer/       # React UI
│   │   ├── components/
│   │   │   ├── Dashboard.tsx      # Main dashboard (rewrite)
│   │   │   ├── NotionPanel.tsx    # New: Notion integration
│   │   │   ├── ModelStatus.tsx    # New: Streamlit panel
│   │   │   ├── SkillsLauncher.tsx # New: Skills panel
│   │   │   ├── QuickSlack.tsx     # New: Slack panel
│   │   │   └── TipsPanel.tsx      # New: Enhanced tips
│   │   ├── styles/
│   │   │   └── theme.css          # Light mode variables
│   │   └── store.ts    # State management (React Context + useReducer)
│   └── shared/
│       └── types.ts    # TypeScript interfaces
├── docs/
│   └── superpowers/specs/
│       └── 2026-03-24-anisha-ide-design.md  # This file
└── package.json
```

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Notion MCP    │────▶│  Main Process   │────▶│    Renderer     │
│  (tasks/meets)  │     │  (IPC handlers) │     │   (React UI)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
┌─────────────────┐            │
│   Slack MCP     │────────────┤
│  (messaging)    │            │
└─────────────────┘            │
                               │
┌─────────────────┐            │
│  File System    │────────────┤
│  (py detection) │            │
└─────────────────┘            │
                               │
┌─────────────────┐            │
│   Electron      │────────────┘
│ (notifications) │
└─────────────────┘
```

### IPC Channels (New)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `notion:fetch` | renderer → main | Get tasks and meetings |
| `notion:refresh` | renderer → main | Force refresh |
| `streamlit:list` | renderer → main | List Python files |
| `streamlit:run` | renderer → main | Start Streamlit app |
| `streamlit:stop` | renderer → main | Stop Streamlit app |
| `streamlit:status` | main → renderer | Running app updates (push) |
| `notify:request` | renderer → main | Request desktop notification |
| `notify:show` | main → OS | Trigger macOS notification (Electron API) |
| `slack:send` | renderer → main | Send Slack message |

Note: Desktop notifications flow from renderer (detects Claude waiting) → main (calls Electron Notification API) → OS.

### State Management

Uses React Context API with `useReducer` for predictable state updates (same pattern as base Claude IDE).

**Global State Shape:**
```typescript
interface AppState {
  // Existing from base IDE
  tabs: Tab[]
  activeTabId: string
  claudeStatus: { cost: string; model: string }

  // New for Anisha IDE
  notion: {
    meetings: Meeting[]
    tasks: Task[]
    loading: boolean
    error: string | null
    lastFetched: number | null
  }
  streamlit: {
    apps: StreamlitApp[]  // { file, port, status, pid }
    pythonFiles: PythonFile[]
  }
  timeSaved: {
    todayMinutes: number
    actions: string[]
  }
  notifications: {
    enabled: boolean
    lastNotified: number | null
  }
}
```

**Why Context + useReducer:** Simple, built-in, sufficient for this scale. No external dependencies (Redux, Zustand). Actions dispatched via `dispatch({ type: 'NOTION_LOADED', payload })`.

## Configuration

Reuses and extends `~/.config/claude-ide-mc/config.json`:

```json
{
  "user": {
    "name": "Anisha Suterwala",
    "slackSignature": "_Sent by Claude Code_ :claude:"
  },
  "notion": {
    "enabled": true,
    "dashboardId": "311ad673c6c280c5b685cfa647ea3b69",
    "refreshIntervalMinutes": 30
  },
  "streamlit": {
    "enabled": true,
    "defaultPort": 8501
  },
  "notifications": {
    "enabled": true,
    "quietHoursStart": null,
    "quietHoursEnd": null
  },
  "slack": {
    "enabled": true,
    "draftVoice": "direct, concise, collaborative",
    "quickRecipients": [
      { "id": "C0250HMTF", "name": "#engineering", "type": "channel" }
    ]
  },
  "skills": {
    "categories": [
      {
        "label": "Productivity",
        "skills": [
          { "cmd": "/morning", "desc": "Morning brief + meeting prep" },
          { "cmd": "/eod", "desc": "End of day wrap + summary" }
        ]
      }
    ],
    "timeSavedWeights": {
      "/morning": 20,
      "/eod": 15,
      "slack-send": 5
    }
  },
  "theme": "light"
}
```

**Defaults and Migration:**

On first launch (config file doesn't exist):
1. Create `~/.config/claude-ide-mc/config.json` with sensible defaults
2. Prompt user to configure Notion dashboard ID (required for Notion panel)
3. All other features work with defaults

Default values for missing keys:
- `notion.enabled`: `true`
- `notion.refreshIntervalMinutes`: `30`
- `streamlit.enabled`: `true`
- `streamlit.defaultPort`: `8501`
- `streamlit.keepRunningOnClose`: `false`
- `notifications.enabled`: `true`
- `notifications.quietHoursStart`: `null`
- `notifications.quietHoursEnd`: `null`
- `slack.enabled`: `true`
- `slack.draftVoice`: `"direct, concise, collaborative"`
- `skills.categories`: `[]` (empty, user adds their own)
- `skills.timeSavedWeights`: `{}` (empty, uses hardcoded fallbacks)

Config is read once on launch and cached. Changes require app restart (or manual refresh).

## Success Criteria

1. **Light mode works:** All UI elements readable, no dark remnants
2. **Notion shows data:** Meetings and tasks appear within 5 seconds of launch
3. **Streamlit detection works:** Python files with streamlit imports identified correctly
4. **Notifications fire:** Desktop notification appears when Claude waits (IDE backgrounded)
5. **Skills execute:** Clicking a skill runs it in the terminal
6. **Slack sends:** Messages deliver with signature appended
7. **Tips rotate:** Different tips shown over time, contextual tips appear appropriately

## Open Questions

None - design approved by user.

## Next Steps

1. Create implementation plan (writing-plans skill)
2. Set up development environment
3. Implement features in order of dependency
4. Test each feature independently
5. Integration testing
6. User acceptance testing
