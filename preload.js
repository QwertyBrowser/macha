const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browserAPI', {
  newTab: () => ipcRenderer.send('new-tab'),
  closeTab: (id) => ipcRenderer.send('close-tab', id),
  switchTab: (id) => ipcRenderer.send('switch-tab', id),
  navigate: (input) => ipcRenderer.send('navigate', input),
  back: () => ipcRenderer.send('back'),
  forward: () => ipcRenderer.send('forward'),
  reload: () => ipcRenderer.send('reload'),
  openSettings: () => ipcRenderer.send('open-settings'),
  onState: (cb) => ipcRenderer.on('state', (_, state) => cb(state)),
  onFocusAddress: (cb) => ipcRenderer.on('focus-address', () => cb()),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
