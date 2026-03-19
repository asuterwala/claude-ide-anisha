# Claude IDE

A desktop app that gives Claude Code a visual interface — file explorer, tabbed terminals, code editor, and a command cheat sheet. Built for PMs and anyone who wants the power of Claude Code without memorizing terminal commands.

![Mac App](https://img.shields.io/badge/platform-macOS-blue) ![Electron](https://img.shields.io/badge/electron-33-green)

## What You Get

- **File Explorer** — browse your project files with git status badges
- **Tabbed Terminals** — run multiple Claude Code sessions side by side
- **Code Editor** — click any file to view/edit with syntax highlighting
- **Dashboard** — cost tracking, session history, and a command cheat sheet
- **Dock App** — launches like any Mac app, no terminal required

## One-Line Setup

```bash
bash setup.sh
```

That's it. The script checks your prerequisites, installs everything, builds the app, and puts it in your Applications folder.

### Prerequisites

The setup script will check for these and help you install them:

- **macOS** (Apple Silicon or Intel)
- **Node.js 18+** — [install via Homebrew](https://brew.sh): `brew install node`
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`

### If sharing via GitHub

```bash
git clone https://github.com/YOUR_USERNAME/claude-ide.git
cd claude-ide
bash setup.sh
```

### If sharing via zip/Slack

1. Download and unzip the `claude-ide` folder
2. Open Terminal, `cd` into the folder
3. Run `bash setup.sh`

## Usage

1. **Launch** Claude IDE from Applications or Dock
2. **Pick a project folder** when prompted
3. **Click +** to open a terminal tab — Claude Code starts automatically
4. **Click any file** in the sidebar to open it in the editor
5. **Check the Dashboard** for a cheat sheet of useful commands

## For Sharing with Your Team

The easiest way to share:

1. Push this repo to GitHub (public or private)
2. Send your team this message:

> **Want to try Claude Code with a visual interface?** Run these two commands:
> ```
> git clone https://github.com/YOUR_USERNAME/claude-ide.git
> cd claude-ide && bash setup.sh
> ```
> Takes ~2 minutes. You'll need Node.js and a Claude Code API key.

## Development

```bash
npm run dev      # Run in development mode (hot reload)
npm run package  # Build the .app bundle
```
