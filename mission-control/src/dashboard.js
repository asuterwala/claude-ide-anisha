function parseTodos(content) {
  if (!content) return [];
  var todoLines = content.split("\n");
  var todos = [];
  for (var idx = 0; idx < todoLines.length; idx++) {
    var todoLine = todoLines[idx];
    var match = todoLine.match(/^[-*]\s+\[([x ])\]\s+(?:\*\*(!!|!)\*\*\s+)?(.+)/i);
    if (match) {
      var done = match[1].toLowerCase() === "x";
      var prio = match[2] === "!!" ? "high" : match[2] === "!" ? "medium" : "low";
      var desc = match[3].trim();
      var due = null;
      var dueM = desc.match(/\[due:\s*([^\]]+)\]/i);
      if (dueM) { due = dueM[1]; desc = desc.replace(dueM[0], "").trim(); }
      var srcM = desc.match(/\[from:\s*([^\]]+)\]/i);
      var src = null;
      if (srcM) { src = srcM[1]; desc = desc.replace(srcM[0], "").trim(); }
      todos.push({ done: done, priority: prio, description: desc, due: due, source: src, lineIndex: idx });
    }
  }
  return todos;
}
function todosToMarkdown(todos) {
  return todos.map(function(t) {
    var check = t.done ? "x" : " ";
    var prioMark = t.priority === "high" ? "**!!** " : t.priority === "medium" ? "**!** " : "";
    var dueMark = t.due ? " [due: " + t.due + "]" : "";
    var srcMark = t.source ? " [from: " + t.source + "]" : "";
    return "- [" + check + "] " + prioMark + t.description + dueMark + srcMark;
  }).join("\n") + "\n";
}
function parseWaiting(content) {
  if (!content) return [];
  return content.split("\n").map(function(line, idx) {
    var m = line.match(/^[-*]\s+\[([x ])\]\s+(.+)/i);
    if (!m) return null;
    var done = m[1].toLowerCase() === "x";
    var desc = m[2].trim();
    var ownerM = desc.match(/\[owner:\s*([^\]]+)\]/i);
    var owner = ownerM ? ownerM[1].trim() : "";
    if (ownerM) desc = desc.replace(ownerM[0], "").trim();
    var sinceM = desc.match(/\[since:\s*([^\]]+)\]/i);
    var since = sinceM ? sinceM[1].trim() : null;
    if (sinceM) desc = desc.replace(sinceM[0], "").trim();
    return { done: done, description: desc, owner: owner, since: since, lineIndex: idx };
  }).filter(Boolean);
}
function waitingToMarkdown(items) {
  return items.map(function(w) {
    var check = w.done ? "x" : " ";
    var ownerTag = w.owner ? " [owner: " + w.owner + "]" : "";
    var sinceTag = w.since ? " [since: " + w.since + "]" : "";
    return "- [" + check + "] " + w.description + ownerTag + sinceTag;
  }).join("\n") + "\n";
}
function parseEventTime(timeStr, dateOffset) {
  if (!timeStr) return null;
  var m = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  var ampm = m[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  var now = new Date();
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (dateOffset || 0), h, min, 0);
  return d;
}
function formatCountdown(ms) {
  if (ms <= 0) return "now";
  var totalSec = Math.floor(ms / 1000);
  var hours = Math.floor(totalSec / 3600);
  var mins = Math.floor((totalSec % 3600) / 60);
  var secs = totalSec % 60;
  if (hours > 0) return hours + "h " + mins + "m";
  if (mins > 0) return mins + "m " + secs + "s";
  return secs + "s";
}
function formatRelativeTime(isoStr) {
  if (!isoStr) return "";
  var age = Date.now() - new Date(isoStr).getTime();
  var mins = Math.floor(age / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}
function Dashboard({ visible }) {
  const { state, dispatch } = useAppState();
  var mcConfig = window.__MC_CONFIG__ || {};
  var userConfig = mcConfig.user || {};
  var slackConfig = mcConfig.slack || {};
  var skillsConfig = mcConfig.skills || {};
  var marketsConfig = mcConfig.markets || {};
  var timeSavedConfig = mcConfig.timeSaved || {};
  const [recentSessions, setRecentSessions] = reactExports.useState([]);
  const [todos, setTodos] = reactExports.useState([]);
  const [calData, setCalData] = reactExports.useState({ today: [], tomorrow: [] });
  const [calRefreshing, setCalRefreshing] = reactExports.useState(false);
  const [calFetchedAt, setCalFetchedAt] = reactExports.useState(null);
  const [newTodoText, setNewTodoText] = reactExports.useState("");
  const [newTodoPrio, setNewTodoPrio] = reactExports.useState("medium");
  var tomorrowStr = (function() { var d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const [newTodoDue, setNewTodoDue] = reactExports.useState(tomorrowStr);
  const [editingIdx, setEditingIdx] = reactExports.useState(null);
  const [editText, setEditText] = reactExports.useState("");
  const [editDue, setEditDue] = reactExports.useState("");
  const [editPrio, setEditPrio] = reactExports.useState("medium");
  const [nowTime, setNowTime] = reactExports.useState(Date.now());
  const [expandedEvent, setExpandedEvent] = reactExports.useState(null);
  const [skillFilter, setSkillFilter] = reactExports.useState("");
  const [slackRecipient, setSlackRecipient] = reactExports.useState("");
  const [slackRawText, setSlackRawText] = reactExports.useState("");
  const [slackDraft, setSlackDraft] = reactExports.useState("");
  const [slackDrafting, setSlackDrafting] = reactExports.useState(false);
  const [slackSending, setSlackSending] = reactExports.useState(false);
  const [slackStatus, setSlackStatus] = reactExports.useState(null);
  const [marketData, setMarketData] = reactExports.useState([]);
  const [newsItems, setNewsItems] = reactExports.useState([]);
  const [newsRefreshing, setNewsRefreshing] = reactExports.useState(false);
  const [waitingOn, setWaitingOn] = reactExports.useState([]);
  const [newWaitingText, setNewWaitingText] = reactExports.useState("");
  const [newWaitingOwner, setNewWaitingOwner] = reactExports.useState("");
  const [meetingContexts, setMeetingContexts] = reactExports.useState({});
  const [meetingContextLoading, setMeetingContextLoading] = reactExports.useState(null);
  const [slackPulse, setSlackPulse] = reactExports.useState([]);
  const [timeSaved, setTimeSaved] = reactExports.useState({ today: 0, week: 0, actions: [] });
  var timeSavedWeights = skillsConfig.timeSavedWeights || {
    "/morning": 20, "/eod": 15, "/email-sweep": 20, "/explain-code": 8,
    "slack-send": 5, "meeting-prep": 10, "meeting-context": 3, "todo-manage": 1,
    "session-open": 5, "calendar-refresh": 2, "default-skill": 10
  };
  var logTimeSaved = function(action) {
    var minutes = timeSavedWeights[action] || timeSavedWeights["default-skill"] || 5;
    window.api.mcLogTimeSaved(action, minutes).then(function() {
      window.api.mcGetTimeSaved().then(function(d) { if (d) setTimeSaved(d); });
    });
  };
  var slackContacts = slackConfig.quickRecipients || [];
  const loadTodos = reactExports.useCallback(async function() {
    var content = await window.api.mcLoadTodos();
    setTodos(parseTodos(content));
  }, []);
  const saveTodos = reactExports.useCallback(async function(updated) {
    setTodos(updated);
    await window.api.mcSaveTodos(todosToMarkdown(updated));
  }, []);
  const loadWaiting = reactExports.useCallback(async function() {
    var content = await window.api.mcLoadWaiting();
    setWaitingOn(parseWaiting(content));
  }, []);
  const saveWaiting = reactExports.useCallback(async function(updated) {
    setWaitingOn(updated);
    await window.api.mcSaveWaiting(waitingToMarkdown(updated));
  }, []);
  var runCommand = reactExports.useCallback(async function(cmd, projectPath) {
    var path = projectPath || recentSessions[0]?.projectPath || process.env.HOME || process.env.HOME || "/tmp";
    var id2 = "terminal-" + Date.now();
    var label = cmd.length > 40 ? cmd.substring(0, 37) + "..." : cmd;
    var ptyId = await window.api.createPtyWithPrompt(path, cmd);
    var tab = { id: id2, type: "terminal", label: label, closeable: true, ptyId: ptyId, projectPath: path };
    dispatch({ type: "ADD_TAB", tab: tab });
    window.api.addRecentSession(path);
    var skillMatch = cmd.match(/^\/\S+/);
    logTimeSaved(skillMatch ? skillMatch[0] : "default-skill");
  }, [dispatch, recentSessions]);
  reactExports.useEffect(function() {
    var timer = setInterval(function() { setNowTime(Date.now()); }, 1000);
    return function() { clearInterval(timer); };
  }, []);
  reactExports.useEffect(function() {
    if (!visible) return;
    var todoTimer = setInterval(function() {
      window.api.mcWatchTodos().then(function(content) {
        if (content) setTodos(parseTodos(content));
      });
    }, 5000);
    return function() { clearInterval(todoTimer); };
  }, [visible]);
  reactExports.useEffect(function() {
    if (!visible) return;
    /* Load config from main process into window global for all components */
    if (window.api.mcGetConfig && !window.__MC_CONFIG__) {
      window.api.mcGetConfig().then(function(cfg) { window.__MC_CONFIG__ = cfg || {}; }).catch(function() {});
    }
    window.api.mcRecentProjects().then(function(projects) {
      if (projects && projects.length > 0) setRecentSessions(projects);
      else window.api.getRecentSessions().then(function(s) { setRecentSessions(s || []); });
    }).catch(function() {
      window.api.getRecentSessions().then(function(s) { setRecentSessions((s || []).slice(0, 8)); });
    });
    window.api.mcLoadCalendar().then(function(d) {
      if (d && (d.today || d.tomorrow)) { setCalData(d); setCalFetchedAt(d.fetchedAt || null); }
      else if (Array.isArray(d)) { setCalData({ today: d, tomorrow: [] }); }
    });
    loadTodos();
    setCalRefreshing(true);
    window.api.mcRefreshCalendar(false).then(function(d) {
      if (d && ((d.today && d.today.length > 0) || (d.tomorrow && d.tomorrow.length > 0))) {
        setCalData(d); setCalFetchedAt(d.fetchedAt || null);
      }
      setCalRefreshing(false);
    }).catch(function() { setCalRefreshing(false); });
    loadWaiting();
    window.api.mcGetTimeSaved().then(function(d) { if (d) setTimeSaved(d); });
    window.api.mcSlackPulse(false).then(function(d) {
      if (d && d.channels) setSlackPulse(d.channels);
    }).catch(function() {});
    window.api.mcMarketData(false).then(function(d) {
      if (d && d.quotes) setMarketData(d.quotes);
    }).catch(function() {});
    window.api.mcLoadNews().then(function(cached) {
      if (cached && cached.items && cached.items.length > 0) setNewsItems(cached.items);
    });
    setNewsRefreshing(true);
    window.api.mcRefreshNews(false).then(function(d) {
      if (d && d.items && d.items.length > 0) setNewsItems(d.items);
      setNewsRefreshing(false);
    }).catch(function() { setNewsRefreshing(false); });
  }, [visible, loadTodos, loadWaiting]);
  reactExports.useEffect(function() {
    if (!visible) return;
    var handler = function(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        var el = document.querySelector("[data-mc-new-todo]");
        if (el) el.focus();
      }
      if (e.key === "t" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        var path = recentSessions[0]?.projectPath || process.env.HOME || "/tmp";
        var id2 = "terminal-" + Date.now();
        window.api.createPty(path).then(function(ptyId) {
          dispatch({ type: "ADD_TAB", tab: { id: id2, type: "terminal", label: path.split("/").pop() || "Terminal", closeable: true, ptyId: ptyId, projectPath: path } });
        });
      }
      if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setCalRefreshing(true);
        window.api.mcRefreshCalendar(true).then(function(d) {
          if (d && ((d.today && d.today.length > 0) || (d.tomorrow && d.tomorrow.length > 0))) {
            setCalData(d); setCalFetchedAt(d.fetchedAt || null);
          }
          setCalRefreshing(false);
        }).catch(function() { setCalRefreshing(false); });
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        var el2 = document.querySelector("[data-mc-skill-filter]");
        if (el2) el2.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return function() { window.removeEventListener("keydown", handler); };
  }, [visible, dispatch, recentSessions]);
  reactExports.useEffect(function() {
    var post = function() {
      var sessions = state.tabs.filter(function(t2) { return t2.type === "terminal"; }).length;
      var features = state.behavior.featuresUsed.size;
      var cost = state.claudeStatus.cost || "0";
      window.api.postStats({ sessions: sessions, features: features, cost: cost });
    };
    post();
    var interval = setInterval(post, 5 * 60 * 1e3);
    return function() { clearInterval(interval); };
  }, [state.tabs, state.behavior.featuresUsed, state.claudeStatus.cost]);
  var activeSessions = state.tabs.filter(function(t2) { return t2.type === "terminal"; }).length;
  var handleSessionClick = async function(session) {
    var id2 = "terminal-" + Date.now();
    var ptyId = await window.api.createPty(session.projectPath);
    var tab = { id: id2, type: "terminal", label: session.projectPath.split("/").pop() || "Terminal", closeable: true, ptyId: ptyId, projectPath: session.projectPath };
    dispatch({ type: "ADD_TAB", tab: tab });
    window.api.addRecentSession(session.projectPath);
    logTimeSaved("session-open");
  };
  var addTodo = async function() {
    if (!newTodoText.trim()) return;
    var t = { done: false, priority: newTodoPrio, description: newTodoText.trim(), due: newTodoDue || null, source: null };
    await saveTodos([t].concat(todos));
    setNewTodoText(""); setNewTodoDue(tomorrowStr); setNewTodoPrio("medium");
  };
  var toggleTodo = async function(idx) {
    await saveTodos(todos.map(function(t, i) { return i === idx ? Object.assign({}, t, { done: !t.done }) : t; }));
  };
  var deleteTodo = async function(idx) {
    await saveTodos(todos.filter(function(_, i) { return i !== idx; }));
  };
  var startEdit = function(idx) { setEditingIdx(idx); setEditText(todos[idx].description); setEditDue(todos[idx].due || ""); setEditPrio(todos[idx].priority); };
  var saveEdit = async function() {
    if (editingIdx === null) return;
    await saveTodos(todos.map(function(t, i) { return i === editingIdx ? Object.assign({}, t, { description: editText.trim(), due: editDue || null, priority: editPrio }) : t; }));
    setEditingIdx(null);
  };
  var cancelEdit = function() { setEditingIdx(null); };
  var cleanupDone = async function() {
    await saveTodos(todos.filter(function(t) { return !t.done; }));
  };
  var openTodoIndices = []; var doneTodoIndices = [];
  todos.forEach(function(t, i) { if (!t.done) openTodoIndices.push(i); else doneTodoIndices.push(i); });
  var now = new Date(nowTime);
  var todayEvents = calData.today || [];
  var tomorrowEvents = calData.tomorrow || [];
  var futureToday = todayEvents.filter(function(evt) {
    var evtTime = parseEventTime(evt.time, 0);
    if (!evtTime) return true;
    return evtTime.getTime() > now.getTime() - 5 * 60 * 1000;
  });
  var showingTomorrow = futureToday.length === 0 && tomorrowEvents.length > 0;
  var displayEvents = showingTomorrow ? tomorrowEvents : futureToday;
  var nextEvent = null;
  var nextCountdown = null;
  if (!showingTomorrow) {
    for (var ei = 0; ei < futureToday.length; ei++) {
      var evtT = parseEventTime(futureToday[ei].time, 0);
      if (evtT && evtT.getTime() > now.getTime()) { nextEvent = futureToday[ei]; nextCountdown = evtT.getTime() - now.getTime(); break; }
    }
  } else {
    for (var ei2 = 0; ei2 < tomorrowEvents.length; ei2++) {
      var evtT2 = parseEventTime(tomorrowEvents[ei2].time, 1);
      if (evtT2) { nextEvent = tomorrowEvents[ei2]; nextCountdown = evtT2.getTime() - now.getTime(); break; }
    }
  }
  var overdueTodos = todos.filter(function(t) {
    if (t.done || !t.due) return false;
    return new Date(t.due + "T23:59:59") < now;
  });
  var hour = now.getHours();
  var dayOfWeek = now.getDay();
  if (!visible) return null;
  var inputStyle = { padding: "6px 8px", background: "#3c3c3c", border: "1px solid #555", borderRadius: 4, color: "#fff", fontSize: 12, outline: "none" };
  var btnStyle = { padding: "6px 12px", background: "#4fc1ff", color: "#000", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: "bold" };
  var btnSmall = { padding: "3px 8px", background: "#3c3c3c", color: "#bbb", border: "1px solid #555", borderRadius: 3, cursor: "pointer", fontSize: 10 };
  var prioColor = function(p) { return p === "high" ? "#f44747" : p === "medium" ? "#dcdcaa" : "#888"; };
  var chipStyle = function(active) { return { padding: "3px 7px", fontSize: 10, borderRadius: 3, cursor: "pointer", border: active ? "1px solid #4fc1ff" : "1px solid #555", background: active ? "#1a2a3a" : "#3c3c3c", color: active ? "#4fc1ff" : "#bbb", whiteSpace: "nowrap" }; };
  var skillCategories = skillsConfig.categories || [
    { label: "Productivity", skills: [
      { cmd: "/morning", desc: "Morning brief + meeting prep" },
      { cmd: "/eod", desc: "End of day wrap + summary" },
      { cmd: "/email-sweep", desc: "Inbox triage" }
    ]},
    { label: "Analysis", skills: [
      { cmd: "/explain-code", desc: "Code explainer" }
    ]}
  ];
  var filteredCategories = skillCategories.map(function(cat) {
    if (!skillFilter) return cat;
    var q = skillFilter.toLowerCase();
    var matched = cat.skills.filter(function(s) { return s.cmd.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q); });
    return matched.length > 0 ? { label: cat.label, skills: matched } : null;
  }).filter(Boolean);
  var suggestions = [];
  if (overdueTodos.length > 0) suggestions.push({ icon: "\u26A0\uFE0F", text: overdueTodos.length + " overdue to-do" + (overdueTodos.length > 1 ? "s" : "") + " \u2014 review now", action: null });
  if (hour < 10) suggestions.push({ icon: "\u2615", text: "Start the day \u2014 run /morning for briefing + meeting prep", action: "/morning" });
  if (hour >= 16 && hour < 20) suggestions.push({ icon: "\uD83C\uDF05", text: "Wrap up \u2014 run /eod for end-of-day review", action: "/eod" });
  if (dayOfWeek === 5 && hour >= 8) suggestions.push({ icon: "\uD83D\uDCCB", text: "Friday \u2014 run /cfo-recap for weekly summary", action: "/cfo-recap" });
  if (openTodoIndices.length > 0) suggestions.push({ icon: "\u2705", text: openTodoIndices.length + " open to-do" + (openTodoIndices.length > 1 ? "s" : ""), action: null });
  if (nextEvent) suggestions.push({ icon: "\uD83D\uDCC5", text: "Prep for " + nextEvent.title, action: null });
  if (suggestions.length < 4) suggestions.push({ icon: "\uD83D\uDCDD", text: "Scan meeting transcripts for action items", action: "/transcript-scan" });
  if (suggestions.length < 4) suggestions.push({ icon: "\uD83D\uDCE8", text: "Triage inbox", action: "/email-sweep" });
  if (suggestions.length < 4) suggestions.push({ icon: "\uD83D\uDCCA", text: "Check FY26 actuals vs plan", action: "/monthly-flash" });
  suggestions = suggestions.slice(0, 4);
  var hasStats = !!(state.claudeStatus.cost || activeSessions > 0 || state.claudeStatus.model);
  var renderEventRow = function(evt, i, total, isNextEvt) {
    var evtTime = parseEventTime(evt.time, 0);
    var isPast = !showingTomorrow && evtTime && evtTime.getTime() <= now.getTime();
    var isExpanded = expandedEvent === i;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", {
      style: { borderBottom: i < total - 1 ? "1px solid #3e3e3e" : "none", borderLeft: isNextEvt ? "2px solid #4fc1ff" : "2px solid transparent", paddingLeft: 8, opacity: isPast ? 0.5 : 1 },
      children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", {
          onClick: function() { setExpandedEvent(isExpanded ? null : i); },
          style: { padding: "6px 0", display: "flex", justifyContent: "space-between", alignItems: "baseline", cursor: "pointer" },
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: isNextEvt ? "#fff" : "#e8e8e8", fontSize: 12, fontWeight: isNextEvt ? "bold" : "normal" }, children: evt.title }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 11 }, children: evt.attendees ? evt.attendees + " attendees" : "" })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: isNextEvt ? "#4fc1ff" : "#888", fontSize: 11, flexShrink: 0, marginLeft: 8, fontWeight: isNextEvt ? "bold" : "normal" }, children: evt.time })
          ]
        }),
        isExpanded && (function() {
          var ctx = meetingContexts[evt.title];
          var isLoading = meetingContextLoading === evt.title;
          if (!ctx && !isLoading) {
            setMeetingContextLoading(evt.title);
            window.api.mcMeetingContext(evt.title).then(function(result) {
              setMeetingContexts(function(prev) { var n = Object.assign({}, prev); n[evt.title] = result; return n; });
              setMeetingContextLoading(null);
              logTimeSaved("meeting-context");
            }).catch(function() { setMeetingContextLoading(null); });
          }
          return jsxRuntimeExports.jsxs("div", { style: { padding: "4px 0 8px 0", borderTop: "1px solid #333", display: "flex", flexDirection: "column", gap: 4 }, children: [
            evt.location && jsxRuntimeExports.jsxs("div", { style: { color: "#888", fontSize: 11 }, children: ["\uD83D\uDCCD ", evt.location] }),
            evt.attendees && jsxRuntimeExports.jsxs("div", { style: { color: "#888", fontSize: 11 }, children: ["\uD83D\uDC65 ", evt.attendees, " attendees"] }),
            isLoading && jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 11, fontStyle: "italic", padding: "4px 0" }, children: "Loading meeting context..." }),
            ctx && ctx.summary && jsxRuntimeExports.jsxs("div", { style: { background: "#1a2a3a", borderRadius: 4, padding: "6px 8px", marginTop: 2, border: "1px solid #333" }, children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#4fc1ff", fontSize: 9, textTransform: "uppercase", marginBottom: 3, letterSpacing: 0.5 }, children: "Last Time" }),
              jsxRuntimeExports.jsx("div", { style: { color: "#ccc", fontSize: 11, lineHeight: "16px", marginBottom: 4 }, children: ctx.summary }),
              ctx.actionItems && ctx.actionItems.length > 0 && jsxRuntimeExports.jsxs("div", { children: [
                jsxRuntimeExports.jsx("div", { style: { color: "#dcdcaa", fontSize: 9, textTransform: "uppercase", marginTop: 4, marginBottom: 2 }, children: "Open Items" }),
                ctx.actionItems.slice(0, 3).map(function(ai, j) {
                  return jsxRuntimeExports.jsxs("div", { style: { color: "#888", fontSize: 10, paddingLeft: 8 }, children: ["\u2022 ", ai] }, "ai-" + j);
                })
              ] })
            ] }),
            jsxRuntimeExports.jsx("button", {
              onClick: function(e) { e.stopPropagation(); runCommand("Prepare me for my meeting: " + evt.title.replace(/'/g, "") + ". Who is attending, what was discussed last time, what should I know?"); },
              style: Object.assign({}, btnSmall, { marginTop: 4, background: "#1a2a3a", border: "1px solid #4fc1ff", color: "#4fc1ff", fontSize: 11, padding: "4px 10px" }),
              children: "Full prep in terminal"
            })
          ] });
        })()
      ]
    }, i);
  };
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, padding: 20, background: "#1e1e1e", overflowY: "auto" }, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "linear-gradient(135deg, #1a2a3a 0%, #2d2d2d 100%)", borderRadius: 8, padding: "20px 24px", border: "1px solid #3e3e3e", marginBottom: 20 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#fff", fontSize: 18, fontWeight: "bold" }, children: "Mission Control" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 10 }, children: "t=terminal  n=new todo  r=refresh cal  /=search skills" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#bbb", fontSize: 13, lineHeight: "22px", marginBottom: 12 }, children: userConfig.tagline || "Your executive orchestrator. Open a terminal to run workflows, or check your status below." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 16 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 2, minWidth: 0 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#89d185", fontSize: 10, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5 }, children: "Suggested Actions" }),
          suggestions.map(function(s, i) {
            return jsxRuntimeExports.jsxs("div", {
              onClick: s.action ? function() { runCommand(s.action); } : undefined,
              style: { display: "flex", gap: 8, alignItems: "center", padding: "4px 0", cursor: s.action ? "pointer" : "default", borderRadius: 3 },
              onMouseEnter: s.action ? function(e) { e.currentTarget.style.background = "#353535"; } : undefined,
              onMouseLeave: s.action ? function(e) { e.currentTarget.style.background = "transparent"; } : undefined,
              children: [
                jsxRuntimeExports.jsx("span", { style: { fontSize: 12, flexShrink: 0, width: 18 }, children: s.icon }),
                jsxRuntimeExports.jsx("span", { style: { color: "#ccc", fontSize: 12 }, children: s.text }),
                s.action && jsxRuntimeExports.jsx("span", { style: { color: "#4fc1ff", fontSize: 10, marginLeft: "auto", opacity: 0.7 }, children: s.action })
              ]
            }, "sug-" + i);
          })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0, borderLeft: "1px solid #3e3e3e", paddingLeft: 16 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#dcdcaa", fontSize: 10, textTransform: "uppercase", marginBottom: 6, letterSpacing: 0.5, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "What's New in Claude" }),
            newsRefreshing && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#888", fontSize: 9, fontStyle: "italic", textTransform: "none" }, children: "updating..." })
          ] }),
          newsItems.length > 0 ? newsItems.slice(0, 3).map(function(item, i) {
            var isRecent = item.daysAgo != null && item.daysAgo <= 7;
            return jsxRuntimeExports.jsxs("div", {
              onClick: item.url ? function() { window.open(item.url, "_blank"); } : undefined,
              style: { display: "flex", gap: 6, alignItems: "flex-start", padding: "3px 0", cursor: item.url ? "pointer" : "default", borderRadius: 3 },
              onMouseEnter: item.url ? function(e) { e.currentTarget.style.background = "#353535"; } : undefined,
              onMouseLeave: item.url ? function(e) { e.currentTarget.style.background = "transparent"; } : undefined,
              children: [
                isRecent ? jsxRuntimeExports.jsx("span", { style: { background: "#4fc1ff", color: "#000", fontSize: 8, fontWeight: "bold", padding: "1px 4px", borderRadius: 3, flexShrink: 0, marginTop: 2 }, children: "NEW" }) : jsxRuntimeExports.jsx("span", { style: { width: 24, flexShrink: 0 } }),
                jsxRuntimeExports.jsx("span", { style: { color: "#ccc", fontSize: 11, lineHeight: "15px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }, children: item.title })
              ]
            }, "wn-" + i);
          }) : jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 11, fontStyle: "italic", padding: "3px 0" }, children: newsRefreshing ? "Loading..." : "No updates" })
        ] })
      ] })
    ] }),
    (function() {
      var costStr = (state.claudeStatus && state.claudeStatus.cost) || "$0.00";
      var costNum = parseFloat(costStr.replace(/[^0-9.]/g, "")) || 0;
      var ratePerMin = timeSavedConfig.minuteRate || 1.00;
      var costBonus = Math.round(costNum * 10);
      var todayMin = timeSaved.today + costBonus;
      var weekMin = timeSaved.week + costBonus;
      var todayValue = (todayMin * ratePerMin).toFixed(0);
      var weekValue = (weekMin * ratePerMin).toFixed(0);
      var fmtMin = function(m) { if (m < 60) return m + " min"; var h = Math.floor(m / 60); var mm = m % 60; return mm > 0 ? h + "h " + mm + "m" : h + "h"; };
      var actionCount = timeSaved.actions ? timeSaved.actions.length : 0;
      var roi = costNum > 0 ? Math.round(todayMin * ratePerMin / costNum) : 0;
      var annualized = costNum > 0 ? "~$" + Math.round(costNum * 365).toLocaleString() + "/yr ($" + Math.round(costNum * 30).toLocaleString() + "/mo)" : "";
      return jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }, children: [
        jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
          jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 11, marginBottom: 8, textTransform: "uppercase" }, children: "Session Stats" }),
          jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }, children: [
            jsxRuntimeExports.jsxs("div", { children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }, children: "Today's Cost" }),
              jsxRuntimeExports.jsx("div", { style: { color: "#4fc1ff", fontSize: 18, fontWeight: "bold" }, children: costStr }),
              jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 9, fontStyle: "italic", marginTop: 1 }, children: annualized || "No spend yet today" })
            ] }),
            jsxRuntimeExports.jsxs("div", { children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }, children: "Sessions" }),
              jsxRuntimeExports.jsx("div", { style: { color: "#89d185", fontSize: 18, fontWeight: "bold" }, children: String(activeSessions) })
            ] }),
            jsxRuntimeExports.jsxs("div", { children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 9, textTransform: "uppercase", marginBottom: 2 }, children: "Time Saved" }),
              jsxRuntimeExports.jsxs("div", { style: { display: "flex", alignItems: "baseline", gap: 4 }, children: [
                jsxRuntimeExports.jsx("div", { style: { color: "#c586c0", fontSize: 18, fontWeight: "bold" }, children: fmtMin(todayMin) }),
                todayMin > 0 && jsxRuntimeExports.jsx("span", { style: { color: "#89d185", fontSize: 11, fontWeight: "bold" }, children: "$" + todayValue })
              ] }),
              jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 9, marginTop: 1 }, children: actionCount + " actions" + (roi > 1 ? " \u00B7 " + roi + "x ROI" : "") })
            ] })
          ] })
        ] }),
        jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
          jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 11, marginBottom: 4, textTransform: "uppercase" }, children: "Markets" }),
          marketData.length === 0
            ? jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 12 }, children: "Loading..." })
            : jsxRuntimeExports.jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }, children:
                marketData.map(function(q) {
                  var up = q.change >= 0;
                  var color = up ? "#89d185" : "#f14c4c";
                  var arrow = up ? "\u25B2" : "\u25BC";
                  var pct = (q.changePct || 0).toFixed(2);
                  var price = q.price ? q.price.toLocaleString(undefined, { maximumFractionDigits: q.price > 1000 ? 0 : 2 }) : "--";
                  return jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0" }, children: [
                    jsxRuntimeExports.jsxs("div", { children: [
                      jsxRuntimeExports.jsx("div", { style: { color: "#ccc", fontSize: 11, fontWeight: 500 }, children: q.name }),
                      jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 10 }, children: price })
                    ] }),
                    jsxRuntimeExports.jsx("div", { style: { color: color, fontSize: 12, fontWeight: "bold", textAlign: "right" }, children: arrow + " " + pct + "%" })
                  ] }, q.symbol);
                })
              })
        ] })
      ] });
    })(),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#4fc1ff", fontSize: 11, marginBottom: 8, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [showingTomorrow ? "Tomorrow" : "Upcoming", calFetchedAt ? " \u00B7 updated " + formatRelativeTime(calFetchedAt) : ""] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
            calRefreshing && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#888", fontSize: 10, fontStyle: "italic" }, children: "refreshing..." }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", {
              onClick: function() {
                setCalRefreshing(true);
                window.api.mcRefreshCalendar(true).then(function(d) {
                  if (d && ((d.today && d.today.length > 0) || (d.tomorrow && d.tomorrow.length > 0))) {
                    setCalData(d); setCalFetchedAt(d.fetchedAt || null);
                  }
                  setCalRefreshing(false);
                }).catch(function() { setCalRefreshing(false); });
              },
              style: Object.assign({}, btnSmall, { fontSize: 9, padding: "2px 6px" }),
              children: "\u21BB"
            })
          ] })
        ] }),
        nextEvent && nextCountdown != null ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "linear-gradient(135deg, #1a2a3a 0%, #1a3a2a 100%)", borderRadius: 6, padding: "10px 12px", border: "1px solid #3e3e3e", marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#89d185", fontSize: 10, textTransform: "uppercase", marginBottom: 2 }, children: showingTomorrow ? "First up tomorrow" : "Next up" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#fff", fontSize: 13, fontWeight: "bold" }, children: nextEvent.title }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 11 }, children: nextEvent.time })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { textAlign: "right" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#4fc1ff", fontSize: 22, fontWeight: "bold", fontFamily: "'SF Mono', Menlo, monospace" }, children: formatCountdown(nextCountdown) }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 10 }, children: showingTomorrow ? "until tomorrow" : "until start" })
          ] })
        ] }) : todayEvents.length > 0 && !showingTomorrow ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { background: "#1a2a1a", borderRadius: 6, padding: "10px 12px", border: "1px solid #2d4a2d", marginBottom: 10, color: "#89d185", fontSize: 12, textAlign: "center" }, children: "All done for today!" }) : null,
        displayEvents.length === 0 && todayEvents.length === 0 && tomorrowEvents.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 12, padding: "4px 0" }, children: calRefreshing ? "Loading calendar..." : "No events." }) : displayEvents.map(function(evt, i) {
          var isNext = nextEvent && evt.title === nextEvent.title && evt.time === nextEvent.time;
          return renderEventRow(evt, i, displayEvents.length, isNext);
        })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#89d185", fontSize: 11, marginBottom: 12, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: ["To-Do (", openTodoIndices.length, " open)"] }),
          overdueTodos.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: "#f44747", fontSize: 10 }, children: [overdueTodos.length, " overdue"] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { "data-mc-new-todo": true, value: newTodoText, onChange: function(e) { setNewTodoText(e.target.value); }, onKeyDown: function(e) { if (e.key === "Enter") addTodo(); }, placeholder: "Add a to-do...", style: Object.assign({}, inputStyle, { flex: 1, minWidth: 120 }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 3, alignItems: "center" }, children: (function() {
            var todayD = new Date(); var todayStr = todayD.toISOString().slice(0, 10);
            var tmrwD = new Date(); tmrwD.setDate(tmrwD.getDate() + 1); var tmrwStr = tmrwD.toISOString().slice(0, 10);
            var weekD = new Date(); weekD.setDate(weekD.getDate() + 7); var weekStr = weekD.toISOString().slice(0, 10);
            return [
              jsxRuntimeExports.jsx("button", { onClick: function() { setNewTodoDue(todayStr); }, style: chipStyle(newTodoDue === todayStr), children: "Today" }, "dt"),
              jsxRuntimeExports.jsx("button", { onClick: function() { setNewTodoDue(tmrwStr); }, style: chipStyle(newTodoDue === tmrwStr), children: "Tmrw" }, "dtm"),
              jsxRuntimeExports.jsx("button", { onClick: function() { setNewTodoDue(weekStr); }, style: chipStyle(newTodoDue === weekStr), children: "+1w" }, "dw"),
              jsxRuntimeExports.jsx("input", { type: "date", value: newTodoDue, onChange: function(e) { setNewTodoDue(e.target.value); }, style: Object.assign({}, inputStyle, { width: 22, fontSize: 10, padding: "3px 2px", cursor: "pointer" }), title: newTodoDue }, "di")
            ];
          })() }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: newTodoPrio, onChange: function(e) { setNewTodoPrio(e.target.value); }, style: Object.assign({}, inputStyle, { width: 55, fontSize: 11 }), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "high", children: "!!" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "medium", children: "!" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "low", children: "-" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: addTodo, style: btnStyle, children: "Add" })
        ] }),
        openTodoIndices.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 12, padding: "4px 0" }, children: "No action items." }),
        openTodoIndices.map(function(todoIdx) {
          var todo = todos[todoIdx];
          var isOverdue = todo.due && new Date(todo.due + "T23:59:59") < now;
          if (editingIdx === todoIdx) {
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "6px 0", borderBottom: "1px solid #3e3e3e", display: "flex", flexDirection: "column", gap: 6 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: editText, onChange: function(e) { setEditText(e.target.value); }, onKeyDown: function(e) { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") cancelEdit(); }, style: Object.assign({}, inputStyle, { width: "100%" }), autoFocus: true }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", value: editDue, onChange: function(e) { setEditDue(e.target.value); }, style: Object.assign({}, inputStyle, { width: 120, fontSize: 11 }) }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: editPrio, onChange: function(e) { setEditPrio(e.target.value); }, style: Object.assign({}, inputStyle, { width: 55, fontSize: 11 }), children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "high", children: "!!" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "medium", children: "!" }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "low", children: "-" })
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: saveEdit, style: Object.assign({}, btnSmall, { background: "#4fc1ff", color: "#000", border: "none" }), children: "Save" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: cancelEdit, style: btnSmall, children: "Cancel" })
              ] })
            ] }, "edit-" + todoIdx);
          }
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "5px 0", borderBottom: "1px solid #3e3e3e", display: "flex", gap: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: false, onChange: function() { toggleTodo(todoIdx); }, style: { cursor: "pointer", accentColor: "#89d185" } }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: prioColor(todo.priority), fontSize: 11, flexShrink: 0, width: 14 }, children: todo.priority === "high" ? "!!" : todo.priority === "medium" ? "!" : "" }),
            /* @__PURE__  */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#ccc", fontSize: 12 }, children: todo.description }),
              todo.due && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { style: { color: isOverdue ? "#f44747" : "#888", fontSize: 10, marginLeft: 6, fontWeight: isOverdue ? "bold" : "normal" }, children: [isOverdue ? "OVERDUE " : "due: ", todo.due] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: function() { startEdit(todoIdx); }, style: Object.assign({}, btnSmall, { fontSize: 9 }), children: "edit" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: function() { deleteTodo(todoIdx); }, style: Object.assign({}, btnSmall, { color: "#f44747", fontSize: 9 }), children: "x" })
          ] }, "todo-" + todoIdx);
        }),
        doneTodoIndices.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { marginTop: 8, borderTop: "1px solid #3e3e3e", paddingTop: 8 }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#555", fontSize: 10, marginBottom: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: ["COMPLETED (", doneTodoIndices.length, ")"] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: cleanupDone, style: Object.assign({}, btnSmall, { fontSize: 9, color: "#888" }), children: "Clear all" })
          ] }),
          doneTodoIndices.slice(0, 3).map(function(todoIdx) {
            var todo = todos[todoIdx];
            return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { padding: "3px 0", display: "flex", gap: 8, alignItems: "center" }, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: true, onChange: function() { toggleTodo(todoIdx); }, style: { cursor: "pointer", accentColor: "#89d185" } }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#555", fontSize: 12, textDecoration: "line-through", flex: 1 }, children: todo.description }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: function() { deleteTodo(todoIdx); }, style: Object.assign({}, btnSmall, { color: "#f44747", fontSize: 9 }), children: "x" })
            ] }, "done-" + todoIdx);
          })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e", marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#e06c75", fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }, children: "Quick Slack" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("select", { value: slackRecipient, onChange: function(e) { setSlackRecipient(e.target.value); setSlackDraft(""); setSlackStatus(null); }, style: Object.assign({}, inputStyle, { flex: "0 0 200px", fontSize: 11 }), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "", children: "Pick a recipient..." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { disabled: true, children: "\u2500\u2500 Channels \u2500\u2500" }),
          slackContacts.filter(function(c) { return c.type === "channel"; }).map(function(c) { return jsxRuntimeExports.jsx("option", { value: c.id, children: c.name }, c.id); }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("option", { disabled: true, children: "\u2500\u2500 VIPs \u2500\u2500" }),
          slackContacts.filter(function(c) { return c.type === "dm"; }).map(function(c) { return jsxRuntimeExports.jsx("option", { value: c.id, children: c.name }, c.id); })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("input", { value: slackRawText, onChange: function(e) { setSlackRawText(e.target.value); setSlackStatus(null); }, onKeyDown: function(e) { if (e.key === "Enter" && slackRecipient && slackRawText.trim()) { setSlackDrafting(true); window.api.mcDraftSlack(slackRawText, slackContacts.find(function(c) { return c.id === slackRecipient; })?.name || "").then(function(d) { setSlackDraft(d); setSlackDrafting(false); }); } }, placeholder: "What do you want to say?", style: Object.assign({}, inputStyle, { flex: 1 }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", {
          onClick: function() {
            if (!slackRecipient || !slackRawText.trim()) return;
            setSlackDrafting(true); setSlackDraft(""); setSlackStatus(null);
            window.api.mcDraftSlack(slackRawText, slackContacts.find(function(c) { return c.id === slackRecipient; })?.name || "").then(function(d) { setSlackDraft(d); setSlackDrafting(false); });
          },
          disabled: !slackRecipient || !slackRawText.trim() || slackDrafting,
          style: Object.assign({}, btnStyle, { opacity: !slackRecipient || !slackRawText.trim() ? 0.4 : 1, background: "#e06c75", fontSize: 11, padding: "6px 14px" }),
          children: slackDrafting ? "Drafting..." : "Draft"
        })
      ] }),
      slackDraft && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#1e1e1e", borderRadius: 4, padding: "10px 12px", border: "1px solid #555", marginBottom: 8 }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#888", fontSize: 10, marginBottom: 4 }, children: "DRAFT PREVIEW" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("textarea", { value: slackDraft, onChange: function(e) { setSlackDraft(e.target.value); }, style: { width: "100%", background: "transparent", border: "none", color: "#e8e8e8", fontSize: 12, lineHeight: "18px", resize: "vertical", minHeight: 40, outline: "none", fontFamily: "inherit" } }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, marginTop: 8, alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", {
            onClick: function() {
              setSlackSending(true); setSlackStatus(null);
              window.api.mcSendSlack(slackRecipient, slackDraft).then(function(res) {
                setSlackSending(false);
                if (res.ok) { setSlackStatus("sent"); setSlackDraft(""); setSlackRawText(""); logTimeSaved("slack-send"); }
                else { setSlackStatus("error: " + (res.error || "unknown")); }
              }).catch(function() { setSlackSending(false); setSlackStatus("error"); });
            },
            disabled: slackSending,
            style: Object.assign({}, btnStyle, { background: "#89d185", fontSize: 11, padding: "5px 16px" }),
            children: slackSending ? "Sending..." : "Send"
          }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: function() { setSlackDraft(""); }, style: Object.assign({}, btnSmall, { fontSize: 10 }), children: "Discard" }),
          slackStatus && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: slackStatus === "sent" ? "#89d185" : "#f44747", fontSize: 11, marginLeft: "auto" }, children: slackStatus === "sent" ? "Sent!" : slackStatus })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 9, marginTop: 4, fontStyle: "italic" }, children: "Will append: " + (slackConfig.signature || userConfig.slackSignature || "_Sent by Claude Code_ :claude:") })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#e5c07b", fontSize: 11, marginBottom: 10, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: ["Waiting On (", waitingOn.filter(function(w) { return !w.done; }).length, ")"] }),
          waitingOn.filter(function(w) { return !w.done && w.since; }).some(function(w) { return (Date.now() - new Date(w.since).getTime()) > 7 * 86400000; }) && jsxRuntimeExports.jsx("span", { style: { color: "#f44747", fontSize: 9 }, children: "stale items" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 6, marginBottom: 8 }, children: [
          jsxRuntimeExports.jsx("input", { value: newWaitingText, onChange: function(e) { setNewWaitingText(e.target.value); }, onKeyDown: function(e) { if (e.key === "Enter" && newWaitingText.trim()) { var todayStr2 = new Date().toISOString().slice(0, 10); saveWaiting([{ done: false, description: newWaitingText.trim(), owner: newWaitingOwner.trim(), since: todayStr2 }].concat(waitingOn)); setNewWaitingText(""); setNewWaitingOwner(""); } }, placeholder: "What are you waiting on?", style: Object.assign({}, inputStyle, { flex: 1, minWidth: 100 }) }),
          jsxRuntimeExports.jsx("input", { value: newWaitingOwner, onChange: function(e) { setNewWaitingOwner(e.target.value); }, placeholder: "Who?", style: Object.assign({}, inputStyle, { width: 80 }) }),
          jsxRuntimeExports.jsx("button", { onClick: function() { if (!newWaitingText.trim()) return; var todayStr2 = new Date().toISOString().slice(0, 10); saveWaiting([{ done: false, description: newWaitingText.trim(), owner: newWaitingOwner.trim(), since: todayStr2 }].concat(waitingOn)); setNewWaitingText(""); setNewWaitingOwner(""); }, style: btnStyle, children: "Add" })
        ] }),
        waitingOn.filter(function(w) { return !w.done; }).length === 0 && jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 12, padding: "4px 0" }, children: "Nothing pending." }),
        waitingOn.filter(function(w) { return !w.done; }).map(function(w, i) {
          var daysSince = w.since ? Math.round((Date.now() - new Date(w.since).getTime()) / 86400000) : null;
          var isStale = daysSince !== null && daysSince > 7;
          var ownerContact = slackContacts.find(function(c) { return c.type === "dm" && w.owner && c.name.toLowerCase().includes(w.owner.split(" ")[0].toLowerCase()); });
          return jsxRuntimeExports.jsxs("div", { style: { padding: "5px 0", borderBottom: "1px solid #3e3e3e", display: "flex", gap: 8, alignItems: "center" }, children: [
            jsxRuntimeExports.jsx("input", { type: "checkbox", checked: false, onChange: function() { saveWaiting(waitingOn.map(function(ww, j) { return ww === w ? Object.assign({}, ww, { done: true }) : ww; })); }, style: { cursor: "pointer", accentColor: "#e5c07b" } }),
            jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#ccc", fontSize: 12 }, children: w.description }),
              jsxRuntimeExports.jsxs("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 1 }, children: [
                w.owner && jsxRuntimeExports.jsxs("span", { style: { color: "#e5c07b", fontSize: 10 }, children: ["@", w.owner] }),
                daysSince !== null && jsxRuntimeExports.jsx("span", { style: { color: isStale ? "#f44747" : "#666", fontSize: 10, fontWeight: isStale ? "bold" : "normal" }, children: daysSince === 0 ? "today" : daysSince + "d ago" })
              ] })
            ] }),
            ownerContact && jsxRuntimeExports.jsx("button", {
              onClick: function() { setSlackRecipient(ownerContact.id); setSlackRawText("Following up on: " + w.description); logTimeSaved("waiting-nudge"); },
              style: Object.assign({}, btnSmall, { fontSize: 9, color: "#e5c07b", border: "1px solid #e5c07b" }),
              children: "Nudge"
            }),
            jsxRuntimeExports.jsx("button", { onClick: function() { saveWaiting(waitingOn.filter(function(ww) { return ww !== w; })); }, style: Object.assign({}, btnSmall, { color: "#f44747", fontSize: 9 }), children: "x" })
          ] }, "wait-" + i);
        })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#61afef", fontSize: 11, marginBottom: 10, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Slack Pulse" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", {
            onClick: function() { window.api.mcSlackPulse(true).then(function(d) { if (d && d.channels) setSlackPulse(d.channels); }); },
            style: Object.assign({}, btnSmall, { fontSize: 9, padding: "2px 6px" }),
            children: "\u21BB"
          })
        ] }),
        slackPulse.length === 0 && jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 12, padding: "4px 0", fontStyle: "italic" }, children: "Loading channel activity..." }),
        slackPulse.map(function(ch, i) {
          return jsxRuntimeExports.jsxs("div", { style: { padding: "6px 0", borderBottom: i < slackPulse.length - 1 ? "1px solid #3e3e3e" : "none" }, children: [
            jsxRuntimeExports.jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
              jsxRuntimeExports.jsxs("span", { style: { color: "#61afef", fontSize: 12 }, children: [ch.channel || ch.channelId] }),
              jsxRuntimeExports.jsxs("span", { style: { display: "flex", gap: 6, alignItems: "center" }, children: [
                ch.hasMention && jsxRuntimeExports.jsx("span", { style: { background: "#f44747", color: "#fff", fontSize: 8, fontWeight: "bold", padding: "1px 4px", borderRadius: 3 }, children: "@" }),
                jsxRuntimeExports.jsx("span", { style: { color: ch.todayCount > 0 ? "#e5c07b" : "#666", fontSize: 11 }, children: ch.todayCount > 0 ? ch.todayCount + " today" : "quiet" })
              ] })
            ] }),
            ch.latestMessage && jsxRuntimeExports.jsx("div", { style: { color: "#666", fontSize: 10, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: ch.latestMessage })
          ] }, "sp-" + i);
        })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e", display: "flex", flexDirection: "column" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#888", fontSize: 11, marginBottom: 12, textTransform: "uppercase", display: "flex", justifyContent: "space-between" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Recent Sessions" }),
          recentSessions.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#555", fontSize: 10, textTransform: "none" }, children: recentSessions.length + " sessions" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { maxHeight: 340, overflowY: "auto", flex: 1 }, children: [
        recentSessions.length === 0 && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#666", padding: "8px 0" }, children: "No recent sessions" }),
        recentSessions.map(function(session, i) {
          var title = session.name || session.projectPath.split("/").pop() || "Session";
          var projLabel = session.projectPath.replace(/^\/Users\/[^/]+\//, "~/");
          var msgBadge = session.msgCount ? session.msgCount + " msgs" : "";
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", {
            onClick: function() { handleSessionClick(session); },
            style: { padding: "6px 0", borderBottom: i < recentSessions.length - 1 ? "1px solid #3e3e3e" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderRadius: 3 },
            onMouseEnter: function(e) { e.currentTarget.style.background = "#353535"; },
            onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; },
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { color: "#4fc1ff", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: title }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#555", fontSize: 10 }, children: [projLabel, msgBadge ? " \u00B7 " + msgBadge : ""] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { style: { color: "#888", fontSize: 10, flexShrink: 0, marginLeft: 8 }, children: formatTimeAgo(session.lastOpened) })
            ]
          }, session.sessionId || session.projectPath);
        })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { background: "#2d2d2d", borderRadius: 6, padding: 16, border: "1px solid #3e3e3e" }, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { style: { color: "#c586c0", fontSize: 11, marginBottom: 8, textTransform: "uppercase", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Skills" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { "data-mc-skill-filter": true, value: skillFilter, onChange: function(e) { setSkillFilter(e.target.value); }, placeholder: "Filter...", style: Object.assign({}, inputStyle, { width: 100, fontSize: 10, padding: "3px 6px" }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { style: { maxHeight: 340, overflowY: "auto" }, children:
          filteredCategories.map(function(cat) {
            return jsxRuntimeExports.jsxs("div", { children: [
              jsxRuntimeExports.jsx("div", { style: { color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.5px", padding: "6px 4px 2px", borderBottom: "1px solid #333" }, children: cat.label }),
              cat.skills.map(function(skill) { return jsxRuntimeExports.jsxs("div", {
                onClick: function() { runCommand(skill.cmd); },
                style: { display: "flex", padding: "4px 4px", gap: 6, alignItems: "baseline", cursor: "pointer", borderRadius: 3 },
                onMouseEnter: function(e) { e.currentTarget.style.background = "#353535"; },
                onMouseLeave: function(e) { e.currentTarget.style.background = "transparent"; },
                children: [
                  jsxRuntimeExports.jsx("code", { style: { color: "#c586c0", fontSize: 11, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "'SF Mono', Menlo, Consolas, monospace" }, children: skill.cmd }),
                  jsxRuntimeExports.jsx("span", { style: { color: "#666", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: skill.desc })
                ]
              }, skill.cmd); })
            ] }, cat.label);
          })
        })
      ] })
    ] })
  ] });
}