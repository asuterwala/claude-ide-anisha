#!/bin/bash
set -e

# ============================================================
#  Claude IDE — One-Click Setup for PMs
#
#  Run this script and you'll have Claude IDE in your Dock
#  in about 2 minutes.
#
#  Usage:
#    curl -fsSL <YOUR_RAW_GITHUB_URL>/setup.sh | bash
#    — or —
#    bash setup.sh
# ============================================================

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║         Claude IDE Setup             ║${NC}"
echo -e "${CYAN}${BOLD}  ║   Your AI-powered code editor        ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""

# -----------------------------------------------------------
# Step 1: Check prerequisites
# -----------------------------------------------------------
echo -e "${BOLD}Checking prerequisites...${NC}"

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}This script is for macOS only.${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} macOS detected"

# Check Node.js
if ! command -v node &>/dev/null; then
  echo -e "${YELLOW}  Node.js not found. Installing via Homebrew...${NC}"
  if ! command -v brew &>/dev/null; then
    echo -e "${RED}  Homebrew not found. Install it first: https://brew.sh${NC}"
    exit 1
  fi
  brew install node
fi
NODE_VERSION=$(node -v)
echo -e "  ${GREEN}✓${NC} Node.js ${NODE_VERSION}"

# Check npm
if ! command -v npm &>/dev/null; then
  echo -e "${RED}  npm not found. Please reinstall Node.js.${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓${NC} npm $(npm -v)"

# Check Claude Code CLI
CLAUDE_PATH=""
if command -v claude &>/dev/null; then
  CLAUDE_PATH=$(which claude)
elif [ -x "$HOME/.local/bin/claude" ]; then
  CLAUDE_PATH="$HOME/.local/bin/claude"
fi

if [ -z "$CLAUDE_PATH" ]; then
  echo ""
  echo -e "${YELLOW}  Claude Code CLI not found.${NC}"
  echo -e "  Install it by running:"
  echo -e "  ${BOLD}  npm install -g @anthropic-ai/claude-code${NC}"
  echo ""
  read -p "  Install it now? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    npm install -g @anthropic-ai/claude-code
    echo -e "  ${GREEN}✓${NC} Claude Code installed"
  else
    echo -e "${RED}  Claude Code is required. Install it and re-run this script.${NC}"
    exit 1
  fi
else
  CLAUDE_VERSION=$($CLAUDE_PATH --version 2>/dev/null | head -1 || echo "unknown")
  echo -e "  ${GREEN}✓${NC} Claude Code CLI ($CLAUDE_VERSION) at $CLAUDE_PATH"
fi

echo ""

# -----------------------------------------------------------
# Step 2: Set up the project
# -----------------------------------------------------------
INSTALL_DIR="$HOME/claude-ide"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "${YELLOW}  $INSTALL_DIR already exists.${NC}"
  read -p "  Overwrite and reinstall? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "  Skipping install. Run from existing directory."
    cd "$INSTALL_DIR"
  else
    rm -rf "$INSTALL_DIR"
  fi
fi

if [ ! -d "$INSTALL_DIR" ]; then
  echo -e "${BOLD}Setting up Claude IDE...${NC}"

  # Check if we're running from inside the repo
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/package.json" ] && grep -q "claude-ide" "$SCRIPT_DIR/package.json" 2>/dev/null; then
    echo -e "  Copying from source..."
    cp -R "$SCRIPT_DIR" "$INSTALL_DIR"
    # Clean build artifacts from copy
    rm -rf "$INSTALL_DIR/node_modules" "$INSTALL_DIR/out" "$INSTALL_DIR/dist"
  elif command -v git &>/dev/null && [ -n "${CLAUDE_IDE_REPO:-}" ]; then
    echo -e "  Cloning from ${CLAUDE_IDE_REPO}..."
    git clone "$CLAUDE_IDE_REPO" "$INSTALL_DIR"
  else
    echo -e "${RED}  Could not find Claude IDE source.${NC}"
    echo -e "  Either run this script from inside the claude-ide folder,"
    echo -e "  or set CLAUDE_IDE_REPO to the git URL:"
    echo -e "  ${BOLD}  CLAUDE_IDE_REPO=https://github.com/you/claude-ide.git bash setup.sh${NC}"
    exit 1
  fi
fi

cd "$INSTALL_DIR"

# -----------------------------------------------------------
# Step 3: Install dependencies
# -----------------------------------------------------------
echo ""
echo -e "${BOLD}Installing dependencies...${NC}"
echo -e "  (this takes about 1 minute)"
npm install --no-audit --no-fund 2>&1 | tail -1
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# Fix node-pty spawn helper permissions
chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper 2>/dev/null || true
chmod +x node_modules/node-pty/prebuilds/darwin-x64/spawn-helper 2>/dev/null || true
echo -e "  ${GREEN}✓${NC} Native modules configured"

# -----------------------------------------------------------
# Step 4: Build the app
# -----------------------------------------------------------
echo ""
echo -e "${BOLD}Building Claude IDE.app...${NC}"
echo -e "  (this takes about 1-2 minutes)"
npm run package 2>&1 | grep -E "packaging|building|✓ built" || true
echo -e "  ${GREEN}✓${NC} App built successfully"

# -----------------------------------------------------------
# Step 5: Install to Applications
# -----------------------------------------------------------
echo ""
APP_PATH=""
if [ -d "dist/mac-arm64/Claude IDE.app" ]; then
  APP_PATH="dist/mac-arm64/Claude IDE.app"
elif [ -d "dist/mac/Claude IDE.app" ]; then
  APP_PATH="dist/mac/Claude IDE.app"
fi

if [ -z "$APP_PATH" ]; then
  echo -e "${RED}  Build failed — .app not found in dist/.${NC}"
  exit 1
fi

echo -e "${BOLD}Installing to Applications...${NC}"
if [ -d "/Applications/Claude IDE.app" ]; then
  rm -rf "/Applications/Claude IDE.app"
fi
cp -R "$APP_PATH" "/Applications/Claude IDE.app"
echo -e "  ${GREEN}✓${NC} Installed to /Applications/Claude IDE.app"

# -----------------------------------------------------------
# Done!
# -----------------------------------------------------------
echo ""
echo -e "${GREEN}${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}  ║       Setup Complete!                ║${NC}"
echo -e "${GREEN}${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}To launch:${NC}"
echo -e "    Open ${CYAN}Claude IDE${NC} from your Applications folder"
echo -e "    — or run: ${BOLD}open '/Applications/Claude IDE.app'${NC}"
echo ""
echo -e "  ${BOLD}First time tips:${NC}"
echo -e "    1. Pick a project folder when prompted"
echo -e "    2. Click ${CYAN}+${NC} to open a terminal with Claude Code"
echo -e "    3. Check the ${CYAN}Dashboard${NC} tab for a command cheat sheet"
echo ""
echo -e "  ${BOLD}To add to your Dock:${NC}"
echo -e "    Right-click the app icon → Options → Keep in Dock"
echo ""

# Offer to launch
read -p "  Launch Claude IDE now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  open "/Applications/Claude IDE.app"
  echo -e "  ${GREEN}Launching!${NC}"
fi

echo ""
