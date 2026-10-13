const { BrowserWindow, WebContentsView } = require('electron');
const path = require('path');
const { PRELOAD_DIR, UI_DIR } = require('./constants');
const state = require('./state');
const { sendSettings } = require('./settings-store');
const { hideSuggestions } = require('./overlay');
const { createTab, sendState, layout } = require('./tabs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'Macha',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: { preload: path.join(PRELOAD_DIR, 'toolbar.js') }
  });
  state.win = win;

  // the floating dropdown for address bar predictions
  const suggestView = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, preload: path.join(PRELOAD_DIR, 'suggestions.js') }
  });
  state.suggestView = suggestView;
  suggestView.setBackgroundColor('#00000000');
  suggestView.webContents.loadFile(path.join(UI_DIR, 'suggestions', 'suggestions.html'));
  suggestView.webContents.on('will-navigate', (e) => e.preventDefault());
  suggestView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadFile(path.join(UI_DIR, 'toolbar', 'index.html'));
  win.webContents.on('did-finish-load', () => {
    sendSettings();
    if (state.tabs.length === 0) createTab();
    else sendState();
  });
  win.on('resize', () => {
    layout();
    hideSuggestions();
  });
  win.on('closed', () => {
    state.win = null;
    state.suggestView = null;
    state.suggestVisible = false;
    state.tabs = [];
    state.activeId = null;
  });
}

module.exports = { createWindow };
