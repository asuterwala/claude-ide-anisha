// Mission Control — Preload API additions
// These lines are added to the `api` object in out/preload/index.js
// before the `electron.contextBridge.exposeInMainWorld("api", api);` line

  mcGetConfig: () => electron.ipcRenderer.invoke("mc:getConfig"),
  mcLoadTodos: () => electron.ipcRenderer.invoke("mc:loadTodos"),
  mcSaveTodos: (content) => electron.ipcRenderer.invoke("mc:saveTodos", content),
  mcLoadCalendar: () => electron.ipcRenderer.invoke("mc:loadCalendar"),
  mcRefreshCalendar: (force) => electron.ipcRenderer.invoke("mc:refreshCalendar", force),
  mcWatchTodos: () => electron.ipcRenderer.invoke("mc:watchTodos"),
  mcDraftSlack: (rawText, recipientName) => electron.ipcRenderer.invoke("mc:draftSlack", rawText, recipientName),
  mcSendSlack: (channelId, message) => electron.ipcRenderer.invoke("mc:sendSlack", channelId, message),
  mcRecentProjects: () => electron.ipcRenderer.invoke("mc:recentProjects"),
  mcLoadNews: () => electron.ipcRenderer.invoke("mc:loadNews"),
  mcRefreshNews: (force) => electron.ipcRenderer.invoke("mc:refreshNews", force),
  mcLogTimeSaved: (action, minutes) => electron.ipcRenderer.invoke("mc:logTimeSaved", action, minutes),
  mcGetTimeSaved: () => electron.ipcRenderer.invoke("mc:getTimeSaved"),
  mcLoadWaiting: () => electron.ipcRenderer.invoke("mc:loadWaiting"),
  mcSaveWaiting: (content) => electron.ipcRenderer.invoke("mc:saveWaiting", content),
  mcMeetingContext: (title) => electron.ipcRenderer.invoke("mc:meetingContext", title),
  mcSlackPulse: (force) => electron.ipcRenderer.invoke("mc:slackPulse", force),
  mcMarketData: (force) => electron.ipcRenderer.invoke("mc:marketData", force),
