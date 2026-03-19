"use strict";
const electron = require("electron");
const api = {
  readDir: (dirPath) => electron.ipcRenderer.invoke("fs:readDir", dirPath),
  readFile: (filePath) => electron.ipcRenderer.invoke("fs:readFile", filePath),
  writeFile: (filePath, content) => electron.ipcRenderer.invoke("fs:writeFile", filePath, content),
  getGitStatus: (projectPath) => electron.ipcRenderer.invoke("git:status", projectPath),
  getGitBranch: (projectPath) => electron.ipcRenderer.invoke("git:branch", projectPath),
  createPty: (projectPath) => electron.ipcRenderer.invoke("pty:create", projectPath),
  writePty: (id, data) => electron.ipcRenderer.send("pty:write", id, data),
  resizePty: (id, cols, rows) => electron.ipcRenderer.send("pty:resize", id, cols, rows),
  destroyPty: (id) => electron.ipcRenderer.send("pty:destroy", id),
  onPtyData: (callback) => {
    const listener = (_, id, data) => callback(id, data);
    electron.ipcRenderer.on("pty:data", listener);
    return () => electron.ipcRenderer.removeListener("pty:data", listener);
  },
  onPtyExit: (callback) => {
    const listener = (_, id) => callback(id);
    electron.ipcRenderer.on("pty:exit", listener);
    return () => electron.ipcRenderer.removeListener("pty:exit", listener);
  },
  watchProject: (projectPath) => electron.ipcRenderer.invoke("watcher:start", projectPath),
  unwatchProject: () => electron.ipcRenderer.invoke("watcher:stop"),
  onFileChange: (callback) => {
    const listener = (_, filePath) => callback(filePath);
    electron.ipcRenderer.on("watcher:change", listener);
    return () => electron.ipcRenderer.removeListener("watcher:change", listener);
  },
  selectDirectory: () => electron.ipcRenderer.invoke("dialog:selectDirectory"),
  getRecentSessions: () => electron.ipcRenderer.invoke("sessions:getRecent"),
  addRecentSession: (projectPath) => electron.ipcRenderer.invoke("sessions:addRecent", projectPath)
};
electron.contextBridge.exposeInMainWorld("api", api);
