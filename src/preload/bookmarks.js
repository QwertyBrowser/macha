const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bookmarksAPI', {
  get: () => ipcRenderer.invoke('bookmarks:get'),
  rename: (id, title) => ipcRenderer.invoke('bookmarks:rename', id, title),
  remove: (id) => ipcRenderer.invoke('bookmarks:remove', id),
  open: (id, inNewTab) => ipcRenderer.send('bookmarks:open', id, inNewTab),
  onChanged: (cb) => ipcRenderer.on('bookmarks', (_, list) => cb(list)),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
