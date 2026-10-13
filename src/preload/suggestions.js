const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('suggestAPI', {
  onItems: (cb) => ipcRenderer.on('items', (_, d) => cb(d)),
  onHighlight: (cb) => ipcRenderer.on('highlight', (_, i) => cb(i)),
  choose: (i) => ipcRenderer.send('suggest:choose', i)
});
