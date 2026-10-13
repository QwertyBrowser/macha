const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  get: () => ipcRenderer.invoke('settings:get'),
  set: (patch) => ipcRenderer.invoke('settings:set', patch),
  reset: () => ipcRenderer.invoke('settings:reset'),
  clearHistory: () => ipcRenderer.invoke('history:clear')
});
