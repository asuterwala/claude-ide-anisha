import { promises as fs } from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { join } from 'path'
import { userInfo } from 'os'
import {
  AUTOMATIONS_FILE, PLISTS_DIR, RUNS_DIR, BIN_DIR,
  CLAUDE_IDE_DIR, ENV_CONFIG_FILE, RUN_AUTOMATION_SCRIPT,
} from './scheduler/paths'
import { generatePlist } from './scheduler/plist-template'
import { detectClaudeBin, buildPlistEnv } from './claude-env'
import type { Automation, AutomationInput, Run } from '../shared/automation-types'
import { app } from 'electron'

const execFileP = promisify(execFile)

function scriptSrc(): string {
  // In production (packaged), the script is at process.resourcesPath/run-automation.
  // In dev, it's at <repo>/scripts/run-automation.
  if (app.isPackaged) {
    return join(process.resourcesPath, 'run-automation')
  }
  return join(app.getAppPath(), 'scripts/run-automation')
}

async function ensureScaffolding(): Promise<void> {
  await fs.mkdir(CLAUDE_IDE_DIR, { recursive: true })
  await fs.mkdir(PLISTS_DIR, { recursive: true })
  await fs.mkdir(RUNS_DIR, { recursive: true })
  await fs.mkdir(BIN_DIR, { recursive: true })

  const claudeBin = detectClaudeBin()
  const env = buildPlistEnv({ claudeBin, home: process.env.HOME ?? '' })
  await fs.writeFile(ENV_CONFIG_FILE, JSON.stringify(env, null, 2))

  try {
    const src = scriptSrc()
    const srcStat = await fs.stat(src)
    let needsCopy = true
    try {
      const dstStat = await fs.stat(RUN_AUTOMATION_SCRIPT)
      if (dstStat.mtimeMs >= srcStat.mtimeMs) needsCopy = false
    } catch {}
    if (needsCopy) {
      await fs.copyFile(src, RUN_AUTOMATION_SCRIPT)
      await fs.chmod(RUN_AUTOMATION_SCRIPT, 0o755)
    }
  } catch (err) {
    console.error('Failed to install run-automation script', err)
  }

  try { await fs.access(AUTOMATIONS_FILE) }
  catch { await fs.writeFile(AUTOMATIONS_FILE, '[]') }
}

async function readAutomations(): Promise<Automation[]> {
  const raw = await fs.readFile(AUTOMATIONS_FILE, 'utf8')
  return JSON.parse(raw)
}

async function writeAutomations(list: Automation[]): Promise<void> {
  await fs.writeFile(AUTOMATIONS_FILE, JSON.stringify(list, null, 2))
}

function plistPath(id: string): string {
  return join(PLISTS_DIR, `com.claudeide.${id}.plist`)
}

function plistLabel(id: string): string {
  return `com.claudeide.${id}`
}

async function writePlist(a: Automation): Promise<void> {
  if (!a.schedule || !a.enabled) return
  const env = JSON.parse(await fs.readFile(ENV_CONFIG_FILE, 'utf8'))
  const xml = generatePlist({
    label: plistLabel(a.id),
    programArgs: [RUN_AUTOMATION_SCRIPT, a.id, 'schedule'],
    cron: a.schedule,
    env,
    stdoutPath: join(RUNS_DIR, `${a.id}.stdout`),
    stderrPath: join(RUNS_DIR, `${a.id}.stderr`),
  })
  await fs.writeFile(plistPath(a.id), xml)
}

async function launchctl(args: string[]): Promise<void> {
  try {
    await execFileP('launchctl', args)
  } catch (err: any) {
    console.error('launchctl', args, 'failed:', err.message)
    throw err
  }
}

// `load -w` / `unload -w` is the legacy form (Apple has been deprecating it
// for years). `bootstrap gui/<uid>` / `bootout gui/<uid>/<label>` is the
// modern equivalent and works on macOS 10.10+.
function userDomain(): string {
  return `gui/${userInfo().uid}`
}

async function loadPlist(id: string): Promise<void> {
  await launchctl(['bootstrap', userDomain(), plistPath(id)])
}

async function unloadPlist(id: string): Promise<void> {
  try { await launchctl(['bootout', `${userDomain()}/${plistLabel(id)}`]) } catch {}
}

function newId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 6)
}

export const scheduler = {
  async init(): Promise<void> { await ensureScaffolding() },

  async list(): Promise<Automation[]> { return readAutomations() },

  async create(input: AutomationInput): Promise<Automation> {
    const list = await readAutomations()
    const id = input.id ?? newId(input.name)
    if (list.some(a => a.id === id)) throw new Error(`automation already exists: ${id}`)
    const a: Automation = { ...input, id }
    list.push(a)
    await writeAutomations(list)
    if (a.enabled && a.schedule) {
      try {
        await writePlist(a)
        await loadPlist(id)
      } catch (err) {
        // Roll back: a row in automations.json without a registered plist
        // looks scheduled but never fires. Remove and rethrow so the
        // renderer's create() promise rejects and the UI surfaces an error.
        const revertList = await readAutomations()
        const revertIdx = revertList.findIndex(x => x.id === id)
        if (revertIdx !== -1) {
          revertList.splice(revertIdx, 1)
          await writeAutomations(revertList)
        }
        try { await fs.unlink(plistPath(id)) } catch {}
        throw err
      }
    }
    return a
  },

  async update(id: string, patch: Partial<AutomationInput>): Promise<Automation> {
    const list = await readAutomations()
    const idx = list.findIndex(a => a.id === id)
    if (idx === -1) throw new Error(`not found: ${id}`)
    const updated = { ...list[idx], ...patch }
    list[idx] = updated
    await writeAutomations(list)
    await unloadPlist(id)
    if (updated.enabled && updated.schedule) {
      await writePlist(updated)
      await loadPlist(id)
    } else {
      try { await fs.unlink(plistPath(id)) } catch {}
    }
    return updated
  },

  async remove(id: string): Promise<void> {
    const list = await readAutomations()
    const idx = list.findIndex(a => a.id === id)
    if (idx === -1) return
    list.splice(idx, 1)
    await writeAutomations(list)
    await unloadPlist(id)
    try { await fs.unlink(plistPath(id)) } catch {}
  },

  async runNow(id: string): Promise<string> {
    // Match the shell script's `date -u +%Y%m%dT%H%M%SZ` so this runId
    // actually corresponds to a real status.json the watcher will emit.
    // Previously diverged by missing the `T` separator, making the return
    // value useless for any caller that wanted to track the run.
    const ts = new Date().toISOString()
      .replace(/-/g, '')
      .replace(/:/g, '')
      .replace(/\.\d{3}Z$/, 'Z')
    const runId = `${id}__${ts}`
    const child = (await import('child_process')).spawn(RUN_AUTOMATION_SCRIPT, [id, 'manual'], {
      detached: true, stdio: 'ignore',
    })
    child.unref()
    return runId
  },

  async listRuns(opts?: { sinceDate?: Date; automationId?: string }): Promise<Run[]> {
    const dirents = await fs.readdir(RUNS_DIR, { withFileTypes: true })
    const out: Run[] = []
    for (const d of dirents) {
      if (!d.isDirectory()) continue
      if (opts?.automationId && !d.name.startsWith(`${opts.automationId}__`)) continue
      try {
        const raw = await fs.readFile(join(RUNS_DIR, d.name, 'status.json'), 'utf8')
        const run: Run = JSON.parse(raw)
        if (opts?.sinceDate && new Date(run.startedAt) < opts.sinceDate) continue
        out.push(run)
      } catch {}
    }
    return out
  },
}
