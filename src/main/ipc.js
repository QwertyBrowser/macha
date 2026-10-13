const { ipcMain } = require('electron');
const { ENGINE_NAMES, THEMES, FONTS } = require('./constants');
const state = require('./state');
const { sanitize, saveSettings, sendSettings, resetSettings } = require('./settings-store');
const { clearStore, recordSearch } = require('./history');
const { searchURL, looksLikeURL, resolveInput } = require('./input');
const { localSuggestions, onlineSuggestions, withOnline } = require('./predictions');
const { hideSuggestions, publishSuggestions } = require('./overlay');
const { activeTab, tabOf, navigateTab, createTab, closeTab, switchTab, openSettings } = require('./tabs');

function chooseSuggestion(index) {
  const item = state.currentItems[index];
  hideSuggestions();
  if (state.win && !state.win.isDestroyed()) state.win.webContents.send('blur-address');
  const tab = activeTab();
  if (!item || !tab) return;
  if (item.kind === 'search') {
    recordSearch(item.value);
    navigateTab(tab, searchURL(item.value));
  } else {
    navigateTab(tab, item.value);
  }
}

function registerIpc() {
  /* ----- internal pages ----- */

  ipcMain.handle('settings:get', (e) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'settings') return null;
    return { settings: state.settings, engines: ENGINE_NAMES, themes: THEMES, fonts: FONTS };
  });

  ipcMain.handle('settings:set', (e, patch) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'settings' || !patch || typeof patch !== 'object') return null;
    state.settings = sanitize(patch, state.settings);
    saveSettings();
    sendSettings();
    return state.settings;
  });

  ipcMain.handle('settings:reset', (e) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'settings') return null;
    resetSettings();
    clearStore();
    state.closedTabs = [];
    return state.settings;
  });

  ipcMain.handle('history:clear', (e) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'settings') return false;
    clearStore();
    return true;
  });

  ipcMain.handle('newtab:get', (e) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'newtab') return null;
    return { settings: state.settings, engines: ENGINE_NAMES };
  });

  ipcMain.on('newtab:search', (e, q) => {
    const t = tabOf(e);
    if (!t || t.kind !== 'newtab' || typeof q !== 'string' || !q.trim()) return;
    recordSearch(q);
    navigateTab(t, searchURL(q.trim()));
  });

  /* ----- address bar predictions ----- */

  ipcMain.on('suggest', async (e, text, rect, seq) => {
    const { win } = state;
    if (!win || e.sender !== win.webContents) return;
    if (typeof text !== 'string' || typeof seq !== 'number') return;
    if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width)) return;
    state.suggestSeq = Math.max(state.suggestSeq, seq);
    const local = localSuggestions(text);
    publishSuggestions(seq, text, rect, local);
    const q = text.trim();
    if (!state.settings.onlineSuggestions || q.length < 2 || q.length > 100 || looksLikeURL(q)) return;
    const online = await onlineSuggestions(q);
    if (seq !== state.suggestSeq || !online.length) return;
    publishSuggestions(seq, text, rect, withOnline(local, online));
  });

  ipcMain.on('suggest:hide', (e, seq) => {
    const { win } = state;
    if (!win || e.sender !== win.webContents) return;
    if (typeof seq === 'number') state.suggestSeq = Math.max(state.suggestSeq, seq);
    hideSuggestions();
  });

  ipcMain.on('suggest:highlight', (e, i) => {
    const { win, suggestView } = state;
    if (!win || e.sender !== win.webContents || !state.suggestVisible || !Number.isInteger(i)) return;
    suggestView.webContents.send('highlight', i);
  });

  ipcMain.on('suggest:choose', (e, i) => {
    const { win, suggestView } = state;
    if (!win || !suggestView) return;
    if (e.sender !== win.webContents && e.sender !== suggestView.webContents) return;
    if (Number.isInteger(i)) chooseSuggestion(i);
  });

  /* ----- toolbar ----- */

  ipcMain.on('open-settings', openSettings);
  ipcMain.on('new-tab', () => createTab());
  ipcMain.on('close-tab', (_, id) => closeTab(id));
  ipcMain.on('switch-tab', (_, id) => switchTab(id));
  ipcMain.on('navigate', (e, input) => {
    const { win } = state;
    if (!win || e.sender !== win.webContents || typeof input !== 'string' || !input.trim()) return;
    const tab = activeTab();
    if (!tab) return;
    const r = resolveInput(input);
    if (r.search) recordSearch(r.search);
    navigateTab(tab, r.url);
  });
  ipcMain.on('back', () => activeTab()?.view.webContents.navigationHistory.goBack());
  ipcMain.on('forward', () => activeTab()?.view.webContents.navigationHistory.goForward());
  ipcMain.on('reload', () => activeTab()?.view.webContents.reload());
}

module.exports = { registerIpc };
