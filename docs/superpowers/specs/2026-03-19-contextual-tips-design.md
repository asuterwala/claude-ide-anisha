# Contextual Tips System — Design Spec

**Goal:** Help PMs discover Claude Code features they don't know about, via behavior-triggered tips that appear as toasts and collect on the Dashboard.

**Audience:** PMs at Gusto who know the basics of Claude Code but aren't aware of all its capabilities.

**Voice:** Coach — casual, opinionated, like a colleague sharing shortcuts.

## Behavior Tracking

Track in-memory only (resets each app launch, no persistence, no data leaves the app):

- `sessionCount` — number of terminal tabs opened this launch
- `sessionDuration` — seconds since the first terminal tab was opened
- `featuresUsed` — Set of feature keys triggered this session (e.g. `quickOpen`, `split`, `projectSearch`, `findReplace`, `fileEdit`)
- `editorTabCount` — number of files opened in editor tabs
- `isFirstLaunch` — true if no recent sessions existed when app opened

Tracking is updated via dispatched actions to the existing React Context store.

## Tip Rules

Each tip is an object in a single array:

```ts
{
  id: string,              // unique, prevents re-firing
  message: string,         // coach-voice text
  condition: (ctx) => bool // fires when true
}
```

A tip fires once per app launch. ~10-15 initial rules covering: /compact, /cost, /model, Cmd+P, Cmd+Shift+F, Cmd+F, split editor, first session welcome, long session advice.

## Toast

- Bottom-right corner, dark card, slides in
- Dismiss × button, auto-fades after 10 seconds
- One toast at a time, queued if multiple trigger
- Tip check runs on a 30-second interval

## Dashboard "Tips for You"

- Sits between stat cards and recent sessions
- Shows all triggered tips from this session, newest first
- If none triggered yet: "Keep going — tips will appear as you work."

## Extensibility

Adding a tip = adding one object to the tips array. No other changes needed.
