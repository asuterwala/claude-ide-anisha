import { contextBridge, ipcRenderer } from 'electron'

const api = {
  readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  getGitStatus: (projectPath: string) => ipcRenderer.invoke('git:status', projectPath),
  getGitBranch: (projectPath: string) => ipcRenderer.invoke('git:branch', projectPath),
  createPty: (projectPath: string) => ipcRenderer.invoke('pty:create', projectPath),
  writePty: (id: string, data: string) => ipcRenderer.send('pty:write', id, data),
  resizePty: (id: string, cols: number, rows: number) => ipcRenderer.send('pty:resize', id, cols, rows),
  destroyPty: (id: string) => ipcRenderer.send('pty:destroy', id),
  onPtyData: (callback: (id: string, data: string) => void) => {
    const listener = (_: unknown, id: string, data: string) => callback(id, data)
    ipcRenderer.on('pty:data', listener)
    return () => ipcRenderer.removeListener('pty:data', listener)
  },
  onPtyExit: (callback: (id: string) => void) => {
    const listener = (_: unknown, id: string) => callback(id)
    ipcRenderer.on('pty:exit', listener)
    return () => ipcRenderer.removeListener('pty:exit', listener)
  },
  watchProject: (projectPath: string) => ipcRenderer.invoke('watcher:start', projectPath),
  unwatchProject: () => ipcRenderer.invoke('watcher:stop'),
  onFileChange: (callback: (filePath: string) => void) => {
    const listener = (_: unknown, filePath: string) => callback(filePath)
    ipcRenderer.on('watcher:change', listener)
    return () => ipcRenderer.removeListener('watcher:change', listener)
  },
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  getRecentSessions: () => ipcRenderer.invoke('sessions:getRecent'),
  addRecentSession: (projectPath: string) => ipcRenderer.invoke('sessions:addRecent', projectPath),
  listAllFiles: (projectPath: string): Promise<string[]> => ipcRenderer.invoke('fs:listAllFiles', projectPath),
  searchContent: (projectPath: string, query: string): Promise<Array<{ file: string; line: number; text: string }>> => ipcRenderer.invoke('fs:searchContent', projectPath, query),
  inlineEdit: (code: string, prompt: string, filePath: string): Promise<string> => ipcRenderer.invoke('claude:inlineEdit', code, prompt, filePath),
  getStatsEndpoint: (): Promise<string | null> => ipcRenderer.invoke('stats:getEndpoint'),
  setStatsEndpoint: (endpoint: string): Promise<void> => ipcRenderer.invoke('stats:setEndpoint', endpoint),
  postStats: (data: { sessions: number; features: number; cost: string }): Promise<boolean | null> => ipcRenderer.invoke('stats:post', data),
  getTeamStats: (): Promise<{ teamSize: number; avgSessions: number; avgFeatures: number; avgCost: number } | null> => ipcRenderer.invoke('stats:getTeam'),
  googleLogin: (): Promise<boolean> => ipcRenderer.invoke('stats:googleLogin'),
  loadConfig: () => ipcRenderer.invoke('config:load'),
  fetchNotion: (dashboardId: string) => ipcRenderer.invoke('notion:fetch', dashboardId),
  listPythonFiles: (path: string) => ipcRenderer.invoke('streamlit:list', path),
  runStreamlit: (file: string, port: number) => ipcRenderer.invoke('streamlit:run', file, port),
  stopStreamlit: (file: string) => ipcRenderer.invoke('streamlit:stop', file),
  getStreamlitStatus: () => ipcRenderer.invoke('streamlit:status'),
  sendToTerminal: (ptyId: string, data: string) => ipcRenderer.invoke('terminal:send', ptyId, data),
  sendSlack: (channelId: string, message: string) => ipcRenderer.invoke('slack:send', channelId, message),
  loadTimeSaved: () => ipcRenderer.invoke('timeSaved:load'),
  saveTimeSaved: (data: unknown) => ipcRenderer.invoke('timeSaved:save', data),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('notification:show', title, body),
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
