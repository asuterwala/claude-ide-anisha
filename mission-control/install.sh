#!/bin/bash
set -e

# Mission Control Installer for Claude IDE (Fixed version)
# Patches the Claude IDE Electron app with the Mission Control dashboard

APP_PATH="/Applications/Claude IDE.app"
ASAR_PATH="$APP_PATH/Contents/Resources/app.asar"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_DIR="$HOME/.config/claude-ide-mc"
DATA_DIR="$HOME/.memory/mission-control"
WORK_DIR="/tmp/claude-ide-mc-install"

echo "=== Mission Control Installer ==="
echo ""

# --- Preflight checks ---
if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: Claude IDE not found at $APP_PATH"
  echo "Install Claude IDE first, then run this script."
  exit 1
fi

if ! command -v npx &>/dev/null; then
  echo "ERROR: npx not found. Install Node.js first."
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "WARNING: claude CLI not found in PATH. Some features (calendar, Slack, meeting context) require it."
fi

# --- Kill the app if running ---
if pgrep -f "Claude IDE" >/dev/null 2>&1; then
  echo "Stopping Claude IDE..."
  pkill -f "Claude IDE" 2>/dev/null || true
  sleep 2
fi

# --- Setup config ---
mkdir -p "$CONFIG_DIR"
mkdir -p "$DATA_DIR"

if [ ! -f "$CONFIG_DIR/config.json" ]; then
  echo "Creating config from template..."
  cp "$SCRIPT_DIR/config.example.json" "$CONFIG_DIR/config.json"
  echo ""
  echo "IMPORTANT: Edit your config at:"
  echo "  $CONFIG_DIR/config.json"
  echo ""
  echo "You should customize:"
  echo "  - user.name (your name for Slack drafts)"
  echo "  - claude.env (your auth environment variables)"
  echo "  - slack.pulseChannels (channels to monitor)"
  echo "  - slack.quickRecipients (people/channels for quick messaging)"
  echo "  - skills.categories (your Claude Code skills)"
  echo ""
else
  echo "Config already exists at $CONFIG_DIR/config.json"
fi

# --- Extract and patch ---
echo "Extracting app.asar..."
rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR/extract"
npx asar extract "$ASAR_PATH" "$WORK_DIR/extract"

# Backup clean renderer for future patches
cp "$WORK_DIR/extract/out/renderer/assets/"*.js "$WORK_DIR/" 2>/dev/null || true

echo "Patching main process..."
MAIN_JS="$WORK_DIR/extract/out/main/index.js"

# Find the injection point: end of registerIpcHandlers function, before createWindow
INJECT_MARKER="function createWindow()"
INJECT_LINE=$(grep -n "$INJECT_MARKER" "$MAIN_JS" | head -1 | cut -d: -f1)

if [ -z "$INJECT_LINE" ]; then
  echo "ERROR: Could not find injection point in main process."
  exit 1
fi

# Insert the handlers before createWindow
{
  head -$((INJECT_LINE - 2)) "$MAIN_JS"
  echo ""
  echo "// --- Mission Control Handlers (injected) ---"
  cat "$SCRIPT_DIR/src/main-handlers.js"
  echo ""
  echo "// --- End Mission Control Handlers ---"
  echo "}"  # Close registerIpcHandlers
  tail -n "+$INJECT_LINE" "$MAIN_JS"
} > "$MAIN_JS.tmp"
mv "$MAIN_JS.tmp" "$MAIN_JS"

echo "Patching preload..."
PRELOAD_JS="$WORK_DIR/extract/out/preload/index.js"

# Insert preload APIs inside the api object, before the closing };
# The last property needs a comma added, then we insert new APIs
python3 << PYEOF
import re

with open('$PRELOAD_JS', 'r') as f:
    content = f.read()

with open('$SCRIPT_DIR/src/preload-apis.js', 'r') as f:
    new_apis = f.read()

# Find the last api property (googleLogin) and add comma, then insert new APIs before };
pattern = r'(googleLogin: \(\) => electron\.ipcRenderer\.invoke\("stats:googleLogin"\))\n(\};)'
replacement = r'\1,\n' + new_apis + r'\n\2'

new_content = re.sub(pattern, replacement, content)

with open('$PRELOAD_JS', 'w') as f:
    f.write(new_content)

print("  Preload APIs injected")
PYEOF

echo "Patching dashboard..."
RENDERER_JS=$(ls "$WORK_DIR/extract/out/renderer/assets/"index-*.js 2>/dev/null | head -1)

if [ -z "$RENDERER_JS" ]; then
  echo "ERROR: Could not find renderer JS."
  exit 1
fi

# FIXED: Use "function Dashboard" instead of "function parseTodos" as splice point
START_LINE=$(grep -n "function Dashboard(" "$RENDERER_JS" | head -1 | cut -d: -f1)
END_LINE=$(grep -n "function StatusBar()" "$RENDERER_JS" | head -1 | cut -d: -f1)

if [ -z "$START_LINE" ] || [ -z "$END_LINE" ]; then
  echo "ERROR: Could not find dashboard splice points in renderer."
  echo "Looking for 'function Dashboard(' and 'function StatusBar()'"
  echo "This may mean the Claude IDE version changed. Check the renderer JS manually."
  exit 1
fi

echo "  Splicing at lines $START_LINE to $END_LINE"

{
  head -$((START_LINE - 1)) "$RENDERER_JS"
  cat "$SCRIPT_DIR/src/dashboard.js"
  echo ""
  tail -n "+$END_LINE" "$RENDERER_JS"
} > "$RENDERER_JS.tmp"
mv "$RENDERER_JS.tmp" "$RENDERER_JS"

# --- Pack and install ---
echo "Packing app.asar..."
npx asar pack "$WORK_DIR/extract" "$ASAR_PATH"

echo "Cleaning up..."
rm -rf "$WORK_DIR"

echo ""
echo "=== Installation complete! ==="
echo ""
echo "Launch Claude IDE to see Mission Control."
echo ""
echo "To customize, edit: $CONFIG_DIR/config.json"
echo "Data stored in:     $DATA_DIR/"
echo ""
echo "To uninstall: Delete the app and reinstall Claude IDE from scratch."
echo "              Also remove $CONFIG_DIR/ and $DATA_DIR/ if desired."

# Offer to launch
read -p "Launch Claude IDE now? [Y/n] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
  open -a "Claude IDE"
fi
