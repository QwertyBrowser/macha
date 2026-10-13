const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('historyAPI', {
  get: (query) => ipcRenderer.invoke('history:get', query),
  remove: (url) => ipcRenderer.invoke('history:remove', url),
  open: (url, inNewTab) => ipcRenderer.send('history:open', url, inNewTab),
  clear: () => ipcRenderer.invoke('history:clear'),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
