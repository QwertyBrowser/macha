const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('downloadsAPI', {
  get: () => ipcRenderer.invoke('downloads:get'),
  open: (id) => ipcRenderer.send('downloads:open', id),
  show: (id) => ipcRenderer.send('downloads:show', id),
  pause: (id) => ipcRenderer.send('downloads:pause', id),
  resume: (id) => ipcRenderer.send('downloads:resume', id),
  cancel: (id) => ipcRenderer.send('downloads:cancel', id),
  remove: (id) => ipcRenderer.invoke('downloads:remove', id),
  clear: () => ipcRenderer.invoke('downloads:clear'),
  onChanged: (cb) => ipcRenderer.on('downloads', (_, list) => cb(list)),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
