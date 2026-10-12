const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('newtabAPI', {
  get: () => ipcRenderer.invoke('newtab:get'),
  search: (q) => ipcRenderer.send('newtab:search', q),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
