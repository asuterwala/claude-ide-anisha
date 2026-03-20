# Mission Control for Claude IDE

A dashboard overlay for [Claude IDE](https://claude.ai/download) that turns it into an executive command center. Adds calendar, to-dos, Slack integration, market data, session history, and skill shortcuts — all inside the Electron app.

![Mission Control](https://img.shields.io/badge/Claude_IDE-Mission_Control-blue)

## Features

- **Calendar** — Today + tomorrow view with meeting context from Notion
- **To-do list** — Markdown-backed, priority-tagged, with due dates
- **Waiting On** — Track items you're waiting on from others
- **Recent Sessions** — Browse your Claude Code session history with titles
- **Slack Integration** — Draft messages, quick-send to contacts, channel pulse monitor
- **Market Data** — Live equity indices from Yahoo Finance
- **What's New** — Auto-fetched Claude Code release highlights
- **Time Saved** — Track productivity ROI with action-weighted estimates
- **Skills** — One-click skill launcher organized by category
- **Stats** — Session cost, active sessions, and time saved at a glance

## Prerequisites

- [Claude IDE](https://claude.ai/download) installed at `/Applications/Claude IDE.app`
- [Node.js](https://nodejs.org/) (for `npx asar`)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` in PATH) — for calendar, Slack, and meeting context features
- [GitHub CLI](https://cli.github.com/) (`gh`) — for "What's New" release feed

## Install

```bash
git clone https://github.com/jeffcobourn/claude-ide-mission-control.git
cd claude-ide-mission-control
./install.sh
```

The installer will:
1. Extract the Claude IDE `app.asar`
2. Inject Mission Control handlers into the main process
3. Add the dashboard to the renderer
4. Create a config file at `~/.config/claude-ide-mc/config.json`
5. Repack and launch

## Configuration

Edit `~/.config/claude-ide-mc/config.json` to customize everything:

```json
{
  "user": {
    "name": "Your Name",
    "tagline": "Your dashboard tagline",
    "slackSignature": "_Sent by Claude Code_ :claude:"
  },
  "claude": {
    "path": "/opt/homebrew/bin/claude",
    "env": {
      "CLAUDE_CODE_USE_BEDROCK": "true",
      "AWS_PROFILE": "your-profile",
      "AWS_REGION": "us-west-2"
    }
  },
  "slack": {
    "pulseChannels": [
      { "id": "C0XXXXXXX", "name": "#your-channel" }
    ],
    "quickRecipients": [
      { "id": "U0XXXXXXX", "name": "Jane Smith", "type": "dm" }
    ]
  },
  "skills": {
    "categories": [
      {
        "label": "Productivity",
        "skills": [
          { "cmd": "/morning", "desc": "Morning brief" }
        ]
      }
    ]
  },
  "markets": {
    "enabled": true,
    "tickers": [
      { "symbol": "^GSPC", "name": "S&P 500" }
    ]
  }
}
```

See `config.example.json` for the full template.

### What goes in config vs. what's in the app

| In your config (personal) | In the app (shared) |
|---|---|
| Slack channel IDs | Dashboard layout |
| Contact names | Calendar integration |
| Skill definitions | To-do parser |
| Auth environment vars | Market data fetcher |
| Your name & voice | Session history |
| Market ticker choices | News aggregator |

## Architecture

Mission Control patches three files inside the Claude IDE Electron app:

```
out/main/index.js      ← IPC handlers (calendar, Slack, markets, etc.)
out/preload/index.js   ← API bridge between main and renderer
out/renderer/assets/   ← Dashboard UI (React component)
```

Data is stored in `~/.memory/mission-control/`:
- `todos.md` — To-do list (Markdown)
- `waiting-on.md` — Waiting-on tracker (Markdown)
- `calendar-cache.json` — Calendar cache (30 min TTL)
- `market-cache.json` — Market data cache (5 min TTL)
- `news-cache.json` — Release news cache (24 hr TTL)
- `slack-pulse.json` — Slack pulse cache (10 min TTL)
- `time-saved.json` — Daily action log (30 day retention)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `t` | Open new terminal |
| `n` | Focus new to-do input |
| `r` | Refresh calendar |
| `/` | Focus skill filter |

## Updating

When Claude IDE updates, you'll need to re-run `./install.sh` to re-apply the patch. Your config and data are preserved — they live outside the app.

## Uninstalling

1. Reinstall Claude IDE (or delete and re-download)
2. Optionally remove `~/.config/claude-ide-mc/` and `~/.memory/mission-control/`

## License

MIT
