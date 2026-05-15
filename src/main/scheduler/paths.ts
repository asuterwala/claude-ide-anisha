import { join } from 'path'
import { homedir } from 'os'

export const CLAUDE_IDE_DIR = join(homedir(), '.claude-ide')
export const AUTOMATIONS_FILE = join(CLAUDE_IDE_DIR, 'automations.json')
export const PLISTS_DIR = join(CLAUDE_IDE_DIR, 'plists')
export const RUNS_DIR = join(CLAUDE_IDE_DIR, 'runs')
export const BIN_DIR = join(CLAUDE_IDE_DIR, 'bin')
export const RUN_AUTOMATION_SCRIPT = join(BIN_DIR, 'run-automation')
export const ENV_CONFIG_FILE = join(CLAUDE_IDE_DIR, 'env.json')
