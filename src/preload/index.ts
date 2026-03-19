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
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
