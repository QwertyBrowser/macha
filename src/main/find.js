const { app, ipcMain } = require('electron');
const state = require('./state');
const { activeTab, layout } = require('./tabs');

const fromToolbar = (e) => !!state.win && e.sender === state.win.webContents;

function openFind() {
  const { win } = state;
  if (!win || win.isDestroyed() || !activeTab()) return;
  state.findOpen = true;
  layout(); // the page makes room for the find row
  win.webContents.focus();
  win.webContents.send('find:open');
}

function closeFind() {
  if (!state.findOpen) return;
  state.findOpen = false;
  const tab = activeTab();
  if (tab && !tab.view.webContents.isDestroyed()) {
    tab.view.webContents.stopFindInPage('clearSelection');
    tab.view.webContents.focus();
  }
  layout();
  const { win } = state;
  if (win && !win.isDestroyed()) win.webContents.send('find:close');
}

function registerFind() {
  // match counts come back on the page's own webContents; forward them to the toolbar
  app.on('web-contents-created', (_, wc) => {
    wc.on('found-in-page', (_e, r) => {
      const tab = activeTab();
      const { win } = state;
      if (!tab || tab.view.webContents !== wc || !win || win.isDestroyed()) return;
      win.webContents.send('find:result', { active: r.activeMatchOrdinal, total: r.matches });
    });
  });

  ipcMain.on('find:query', (e, text, forward, next) => {
    if (!fromToolbar(e) || typeof text !== 'string') return;
    const tab = activeTab();
    if (!tab || tab.view.webContents.isDestroyed()) return;
    const wc = tab.view.webContents;
    if (!text) return wc.stopFindInPage('clearSelection');
    wc.findInPage(text, { forward: !!forward, findNext: !!next });
    state.win.webContents.focus(); // keep the cursor in the find box
  });

  ipcMain.on('find:close', (e) => fromToolbar(e) && closeFind());
}

module.exports = { openFind, closeFind, registerFind };
