// Mission Control — Main Process IPC Handlers
// This file is spliced into the Claude IDE main process (out/main/index.js)
// It reads config from ~/.config/claude-ide-mc/config.json
//
// Requires these variables in scope from the host app:
//   electron, sysPath, promises$1, child_process, util

const execFileAsync = util.promisify(child_process.execFile);

// --- Config loader ---
const MC_CONFIG_FILE = sysPath.join(process.env.HOME || "", ".config", "claude-ide-mc", "config.json");
let _mcConfig = null;
function getMcConfig() {
  if (_mcConfig) return _mcConfig;
  try {
    _mcConfig = JSON.parse(require("fs").readFileSync(MC_CONFIG_FILE, "utf-8"));
  } catch {
    _mcConfig = {};
  }
  return _mcConfig;
}

// --- Claude runner ---
function buildMcClaudeEnv() {
  const config = getMcConfig();
  const claudeEnv = config.claude?.env || {};
  return {
    ...process.env,
    PATH: "/opt/homebrew/bin:" + (process.env.HOME || "") + "/.local/bin:" + (process.env.PATH || ""),
    ...claudeEnv
  };
}

function getClaudePath() {
  const config = getMcConfig();
  return config.claude?.path || "/opt/homebrew/bin/claude";
}

function mcClaudeRun(args, timeout) {
  return new Promise((resolve, reject) => {
    const proc = child_process.spawn(getClaudePath(), args, { env: buildMcClaudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    proc.stdin.end();
    let stdout = "", stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    const timer = setTimeout(() => { proc.kill(); reject(new Error("timeout")); }, timeout || 90000);
    proc.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve({ stdout, stderr }); else reject(Object.assign(new Error("exit " + code), { stdout, stderr, code })); });
    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

// --- File paths ---
const mcDir = sysPath.join(process.env.HOME || "", ".memory", "mission-control");
const mcTodosFile = sysPath.join(mcDir, "todos.md");
const mcCalendarFile = sysPath.join(mcDir, "calendar-cache.json");
const mcNewsFile = sysPath.join(mcDir, "news-cache.json");
const mcTimeSavedFile = sysPath.join(mcDir, "time-saved.json");
const mcWaitingFile = sysPath.join(mcDir, "waiting-on.md");
const mcMarketFile = sysPath.join(mcDir, "market-cache.json");
const mcSlackPulseFile = sysPath.join(mcDir, "slack-pulse.json");

// --- Config IPC (provides config to renderer via preload) ---
electron.ipcMain.handle("mc:getConfig", async () => {
  return getMcConfig();
});

// --- Todos ---
electron.ipcMain.handle("mc:loadTodos", async () => {
  try { return await promises$1.readFile(mcTodosFile, "utf-8"); } catch { return ""; }
});
electron.ipcMain.handle("mc:saveTodos", async (_, content) => {
  await promises$1.mkdir(sysPath.dirname(mcTodosFile), { recursive: true });
  await promises$1.writeFile(mcTodosFile, content, "utf-8");
});
electron.ipcMain.handle("mc:watchTodos", async () => {
  try { return await promises$1.readFile(mcTodosFile, "utf-8"); } catch { return ""; }
});

// --- Calendar ---
electron.ipcMain.handle("mc:loadCalendar", async () => {
  try { return JSON.parse(await promises$1.readFile(mcCalendarFile, "utf-8")); } catch { return { today: [], tomorrow: [] }; }
});
electron.ipcMain.handle("mc:refreshCalendar", async (_, forceRefresh) => {
  try {
    const config = getMcConfig();
    const calTool = config.calendar?.mcpTool || "gcal";
    if (!config.calendar?.enabled) return null;
    const todayStr = new Date().toISOString().slice(0, 10);
    if (!forceRefresh) {
      try {
        const cached = JSON.parse(await promises$1.readFile(mcCalendarFile, "utf-8"));
        if (cached.fetchedAt) {
          const cachedDate = cached.fetchedAt.slice(0, 10);
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          if (cachedDate === todayStr && age < 30 * 60 * 1000 && ((cached.today && cached.today.length > 0) || (cached.tomorrow && cached.tomorrow.length > 0))) return cached;
        }
      } catch {}
    }
    const tomorrowStr2 = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const dayAfterStr = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
    const prompt = "Use " + calTool + " list_events to get events for " + todayStr + " AND " + tomorrowStr2 + " (time_min=" + todayStr + "T00:00:00, time_max=" + dayAfterStr + "T00:00:00, max_results=30). Return ONLY raw JSON, no markdown. Format: {\"today\":[...],\"tomorrow\":[...]}. Each event: {\"title\":\"...\",\"time\":\"h:mm AM/PM\",\"attendees\":N,\"location\":\"...\"}. Skip all-day events. Only include actual meetings/calls. Today=" + todayStr + ", Tomorrow=" + tomorrowStr2 + ". Separate into today vs tomorrow arrays.";
    const { stdout } = await mcClaudeRun(["-p", prompt], 90000);
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      if (data.today || data.tomorrow) {
        data.fetchedAt = new Date().toISOString();
        await promises$1.mkdir(sysPath.dirname(mcCalendarFile), { recursive: true });
        await promises$1.writeFile(mcCalendarFile, JSON.stringify(data, null, 2), "utf-8");
        return data;
      }
    }
    return null;
  } catch { return null; }
});

// --- Slack draft & send ---
electron.ipcMain.handle("mc:draftSlack", async (_, rawText, recipientName) => {
  try {
    const config = getMcConfig();
    const userName = config.user?.name || "the user";
    const voice = config.slack?.draftVoice || "direct, concise, collaborative";
    const draftPrompt = "Draft a Slack message from " + userName + " to " + recipientName + ". The raw intent is: " + rawText + ". Write it in this voice: " + voice + ". Return ONLY the message text, no quotes, no explanation. Keep it short.";
    const { stdout } = await mcClaudeRun(["-p", draftPrompt], 30000);
    return stdout.trim();
  } catch { return rawText; }
});
electron.ipcMain.handle("mc:sendSlack", async (_, channelId, message) => {
  try {
    const config = getMcConfig();
    const sig = config.user?.slackSignature || "_Sent by Claude Code_ :claude:";
    const fullMsg = message + "\n\n" + sig;
    const sendPrompt = "Use the slack_send_message tool to send this message to channel " + channelId + ". Message: " + JSON.stringify(fullMsg) + ". Return only sent or error.";
    const { stdout } = await mcClaudeRun(["-p", sendPrompt], 30000);
    return { ok: true, result: stdout.trim() };
  } catch (err) { return { ok: false, error: err.message }; }
});

// --- Recent sessions (from Claude history) ---
electron.ipcMain.handle("mc:recentProjects", async () => {
  try {
    const home = process.env.HOME || "";
    const histFile = sysPath.join(home, ".claude", "history.jsonl");
    const raw = await promises$1.readFile(histFile, "utf-8");
    const lines = raw.trim().split("\n");
    const sessions = {};
    for (const line of lines) {
      try {
        const d = JSON.parse(line);
        const sid = d.sessionId; if (!sid) continue;
        const msg = (d.display || "").trim();
        const ts = d.timestamp || 0;
        const proj = d.project || "";
        if (!sessions[sid]) {
          sessions[sid] = { id: sid, title: msg, project: proj, start: ts, last: ts, msgs: 1 };
        } else {
          sessions[sid].last = Math.max(sessions[sid].last, ts);
          sessions[sid].msgs++;
          if (msg.length > sessions[sid].title.length && !msg.startsWith("/") && sessions[sid].title.length < 30) {
            sessions[sid].title = msg;
          }
        }
      } catch {}
    }
    const sorted = Object.values(sessions).sort((a, b) => b.last - a.last).slice(0, 50);
    const deduped = [];
    for (const s of sorted) {
      const dup = deduped.find(d => d.project === s.project && Math.abs(d.last - s.last) < 30 * 60 * 1000);
      if (dup) { if (s.msgs > dup.msgs) { Object.assign(dup, s); } continue; }
      deduped.push(s);
    }
    return deduped.slice(0, 30).map(s => ({
      projectPath: s.project,
      name: (s.title || "").slice(0, 60) || s.project.split("/").pop() || "Session",
      lastOpened: s.last,
      sessionId: s.id,
      msgCount: s.msgs
    }));
  } catch { return []; }
});

// --- News (Claude Code releases) ---
electron.ipcMain.handle("mc:loadNews", async () => {
  try { return JSON.parse(await promises$1.readFile(mcNewsFile, "utf-8")); } catch { return null; }
});
electron.ipcMain.handle("mc:refreshNews", async (_, forceRefresh) => {
  try {
    if (!forceRefresh) {
      try {
        const cached = JSON.parse(await promises$1.readFile(mcNewsFile, "utf-8"));
        if (cached.fetchedAt) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          if (age < 24 * 60 * 60 * 1000 && cached.items && cached.items.length > 0) return cached;
        }
      } catch {}
    }
    const ghPath = "/opt/homebrew/bin/gh";
    const { stdout } = await execFileAsync(ghPath, ["api", "repos/anthropics/claude-code/releases", "--jq", ".[0:10] | .[] | {tag_name, published_at, body}"], { timeout: 15000, maxBuffer: 1024 * 1024, env: { ...process.env, PATH: "/opt/homebrew/bin:" + process.env.PATH } });
    const releases = stdout.trim().split("\n").filter(l => l.startsWith("{")).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const nowMs = Date.now();
    const skipWords = ["fixed", "removed deprecated", "bumped", "updated dependency", "internal cleanup", "improved error", "minor"];
    const boostWords = ["/loop", "/config", "background task", "mcp", "hook", "model", "token", "memory", "parallel", "agent", "skill", "worktree", "elicitation"];
    const allBullets = [];
    for (const r of releases) {
      const daysAgo = Math.round((nowMs - new Date(r.published_at).getTime()) / 86400000);
      const body = (r.body || "").replace(/^## What's changed\s*/i, "").trim();
      const bullets = body.split("\n").filter(l => l.startsWith("- ")).map(l => l.replace(/^- /, "").replace(/`/g, "").trim());
      let countFromRelease = 0;
      for (const b of bullets) {
        if (countFromRelease >= 2) break;
        const lower = b.toLowerCase();
        if (skipWords.some(sw => lower.startsWith(sw))) continue;
        if (lower.length < 20) continue;
        const boost = boostWords.some(bw => lower.includes(bw)) ? 1 : 0;
        allBullets.push({ text: b.replace(/^Added\s+/i, ""), daysAgo, url: "https://github.com/anthropics/claude-code/releases/tag/" + r.tag_name, boost });
        countFromRelease++;
      }
    }
    allBullets.sort((a, b) => (b.boost - a.boost) || (a.daysAgo - b.daysAgo));
    const items = allBullets.slice(0, 5).map(b => ({ title: b.text, url: b.url, daysAgo: b.daysAgo }));
    if (items.length === 0) return null;
    const result = { items, fetchedAt: new Date().toISOString() };
    await promises$1.writeFile(mcNewsFile, JSON.stringify(result, null, 2));
    return result;
  } catch { return null; }
});

// --- Time saved tracking ---
electron.ipcMain.handle("mc:logTimeSaved", async (_, action, minutesSaved) => {
  try {
    let data = {};
    try { data = JSON.parse(await promises$1.readFile(mcTimeSavedFile, "utf-8")); } catch {}
    const today = new Date().toISOString().slice(0, 10);
    if (!data[today]) data[today] = { total: 0, actions: [] };
    data[today].total += minutesSaved;
    data[today].actions.push({ action, minutes: minutesSaved, at: new Date().toISOString() });
    const keys = Object.keys(data).sort().reverse();
    if (keys.length > 30) { for (const k of keys.slice(30)) delete data[k]; }
    await promises$1.writeFile(mcTimeSavedFile, JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
});
electron.ipcMain.handle("mc:getTimeSaved", async () => {
  try {
    const data = JSON.parse(await promises$1.readFile(mcTimeSavedFile, "utf-8"));
    const today = new Date().toISOString().slice(0, 10);
    const todayData = data[today] || { total: 0, actions: [] };
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    let weekTotal = 0;
    for (const [dateKey, dayData] of Object.entries(data)) {
      if (dateKey >= weekStartStr) weekTotal += (dayData.total || 0);
    }
    return { today: todayData.total, week: weekTotal, actions: todayData.actions || [] };
  } catch { return { today: 0, week: 0, actions: [] }; }
});

// --- Waiting on ---
electron.ipcMain.handle("mc:loadWaiting", async () => {
  try { return await promises$1.readFile(mcWaitingFile, "utf-8"); } catch { return ""; }
});
electron.ipcMain.handle("mc:saveWaiting", async (_, content) => {
  try { await promises$1.writeFile(mcWaitingFile, content); return true; } catch { return false; }
});

// --- Meeting context (Notion) ---
electron.ipcMain.handle("mc:meetingContext", async (_, meetingTitle) => {
  try {
    const prompt = "Use notion-query-meeting-notes to find the most recent meeting notes for a meeting titled or related to: " + JSON.stringify(meetingTitle) + ". Return ONLY valid JSON with keys: summary (2-3 sentences of what was discussed), actionItems (array of strings - open action items), attendees (array of name strings). If no notes found, return {\"summary\":\"No prior notes found\",\"actionItems\":[],\"attendees\":[]}.";
    const { stdout } = await mcClaudeRun(["-p", prompt], 60000);
    try {
      const jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return { summary: stdout.trim().substring(0, 300), actionItems: [], attendees: [] };
  } catch { return { summary: "Could not fetch context", actionItems: [], attendees: [] }; }
});

// --- Market data (Yahoo Finance v8 chart API) ---
electron.ipcMain.handle("mc:marketData", async (_, forceRefresh) => {
  try {
    const config = getMcConfig();
    if (config.markets?.enabled === false) return { quotes: [], fetchedAt: null };
    if (!forceRefresh) {
      try {
        const cached = JSON.parse(await promises$1.readFile(mcMarketFile, "utf-8"));
        if (cached.fetchedAt) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          if (age < 5 * 60 * 1000 && cached.quotes && cached.quotes.length > 0) return cached;
        }
      } catch {}
    }
    const https = require("https");
    const tickers = config.markets?.tickers || [
      { symbol: "^DJI", name: "Dow Jones" },
      { symbol: "^GSPC", name: "S&P 500" },
      { symbol: "^IXIC", name: "Nasdaq" },
      { symbol: "IGV", name: "Software (IGV)" }
    ];
    function fetchChart(sym) {
      return new Promise((resolve) => {
        const url = "https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(sym) + "?interval=1d&range=2d";
        const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
          let body = "";
          res.on("data", (c) => { body += c; });
          res.on("end", () => {
            try {
              const d = JSON.parse(body);
              const meta = d.chart.result[0].meta;
              const price = meta.regularMarketPrice;
              const prev = meta.chartPreviousClose || meta.previousClose || price;
              const change = price - prev;
              const changePct = prev > 0 ? (change / prev) * 100 : 0;
              resolve({ price, change, changePct });
            } catch { resolve(null); }
          });
        });
        req.on("error", () => resolve(null));
        setTimeout(() => { req.destroy(); resolve(null); }, 10000);
      });
    }
    const results = await Promise.all(tickers.map(t => fetchChart(t.symbol)));
    const quotes = tickers.map((t, i) => results[i] ? { symbol: t.symbol, name: t.name, price: results[i].price, change: results[i].change, changePct: results[i].changePct } : null).filter(Boolean);
    const result = { quotes, fetchedAt: new Date().toISOString() };
    if (quotes.length > 0) await promises$1.writeFile(mcMarketFile, JSON.stringify(result, null, 2));
    return result;
  } catch { return { quotes: [], fetchedAt: null }; }
});

// --- Slack pulse ---
electron.ipcMain.handle("mc:slackPulse", async (_, forceRefresh) => {
  try {
    const config = getMcConfig();
    const channels = config.slack?.pulseChannels || [];
    if (channels.length === 0) return { channels: [], fetchedAt: null };
    if (!forceRefresh) {
      try {
        const cached = JSON.parse(await promises$1.readFile(mcSlackPulseFile, "utf-8"));
        if (cached.fetchedAt) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          if (age < 10 * 60 * 1000 && cached.channels) return cached;
        }
      } catch {}
    }
    const channelList = channels.map(c => c.id + " (" + c.name + ")").join(", ");
    const prompt = "Use slack_read_channel to read the 3 most recent messages from each of these channels: " + channelList + ". Count how many were posted today. Return ONLY valid JSON array: [{\"channel\":\"#channel-name\",\"todayCount\":0,\"hasMention\":false,\"latestMessage\":\"first 60 chars of newest msg\"}]";
    const { stdout } = await mcClaudeRun(["-p", prompt], 90000);
    let result_channels = [];
    try {
      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (jsonMatch) result_channels = JSON.parse(jsonMatch[0]);
    } catch {}
    const result = { channels: result_channels, fetchedAt: new Date().toISOString() };
    if (result_channels.length > 0) await promises$1.writeFile(mcSlackPulseFile, JSON.stringify(result, null, 2));
    return result;
  } catch { return { channels: [], fetchedAt: null }; }
});
