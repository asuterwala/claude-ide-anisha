export interface TipContext {
  sessionCount: number
  sessionDuration: number // seconds since first terminal opened
  featuresUsed: Set<string>
  editorTabCount: number
  isFirstLaunch: boolean
}

export interface Tip {
  id: string
  message: string
  condition: (ctx: TipContext) => boolean
}

export const tips: Tip[] = [
  {
    id: 'welcome',
    message: "Welcome! Click the + button to open a terminal tab. Claude Code starts automatically — just type what you want built.",
    condition: (ctx) => ctx.isFirstLaunch && ctx.sessionCount === 0,
  },
  {
    id: 'compact-reminder',
    message: "Pro tip: your conversation is getting long. Type /compact to free up context — Claude will remember what matters and forget the noise.",
    condition: (ctx) => ctx.sessionDuration > 600 && !ctx.featuresUsed.has('compact'),
  },
  {
    id: 'cost-check',
    message: "You're juggling multiple sessions. Try /cost in each one to see which are burning through your budget.",
    condition: (ctx) => ctx.sessionCount >= 3,
  },
  {
    id: 'discover-quickopen',
    message: "Skip the file tree — hit Cmd+P to jump straight to any file by name. Way faster.",
    condition: (ctx) => ctx.sessionCount >= 2 && !ctx.featuresUsed.has('quickOpen'),
  },
  {
    id: 'discover-project-search',
    message: "Looking for something across your codebase? Hit Cmd+Shift+F to search every file in your project at once.",
    condition: (ctx) => ctx.editorTabCount >= 2 && !ctx.featuresUsed.has('projectSearch'),
  },
  {
    id: 'discover-find-replace',
    message: "Heads up — you can hit Cmd+F to search inside any open file, or Cmd+H to find and replace.",
    condition: (ctx) => ctx.editorTabCount >= 1 && !ctx.featuresUsed.has('findReplace'),
  },
  {
    id: 'discover-split',
    message: "Want to compare two files? Click the ⫿ icon on any editor tab to open a side-by-side view.",
    condition: (ctx) => ctx.editorTabCount >= 2 && !ctx.featuresUsed.has('split'),
  },
  {
    id: 'long-session-model',
    message: "Long session going well? Type /model sonnet to switch to a faster, cheaper model, or /cost to check your spend.",
    condition: (ctx) => ctx.sessionDuration > 1200 && !ctx.featuresUsed.has('modelSwitch'),
  },
  {
    id: 'resume-tip',
    message: "Did you know you can pick up where you left off? Type claude --resume to continue your last conversation.",
    condition: (ctx) => ctx.sessionCount >= 2 && !ctx.featuresUsed.has('resume'),
  },
  {
    id: 'one-shot-tip',
    message: "Need a quick answer without a full session? Try: claude -p \"your question here\" — it responds and exits.",
    condition: (ctx) => ctx.sessionCount >= 3 && ctx.sessionDuration > 300,
  },
  {
    id: 'permissions-tip',
    message: "Claude keeps asking for permission? Type /permissions to configure what it can do automatically — saves a lot of clicking.",
    condition: (ctx) => ctx.sessionDuration > 900,
  },
  {
    id: 'save-reminder',
    message: "Don't forget — hit Cmd+S to save any file you edit. Claude can see your saved changes in real time.",
    condition: (ctx) => ctx.featuresUsed.has('fileEdit') && !ctx.featuresUsed.has('fileSave'),
  },
]

export function evaluateTips(ctx: TipContext, firedIds: Set<string>): Tip | null {
  for (const tip of tips) {
    if (firedIds.has(tip.id)) continue
    if (tip.condition(ctx)) return tip
  }
  return null
}
