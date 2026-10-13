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
  suggest: (text, rect, seq) => ipcRenderer.send('suggest', text, rect, seq),
  hideSuggestions: (seq) => ipcRenderer.send('suggest:hide', seq),
  highlightSuggestion: (i) => ipcRenderer.send('suggest:highlight', i),
  chooseSuggestion: (i) => ipcRenderer.send('suggest:choose', i),
  onSuggestItems: (cb) => ipcRenderer.on('suggest-items', (_, d) => cb(d)),
  onState: (cb) => ipcRenderer.on('state', (_, state) => cb(state)),
  onFocusAddress: (cb) => ipcRenderer.on('focus-address', (_, o) => cb(o || {})),
  onBlurAddress: (cb) => ipcRenderer.on('blur-address', () => cb()),
  onSettings: (cb) => ipcRenderer.on('settings', (_, s) => cb(s))
});
