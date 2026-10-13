const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { ENGINES, THEMES, LEGACY_THEMES, DEFAULTS } = require('./constants');
const state = require('./state');

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function normalizeHomepage(text) {
  const t = text.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : 'https://' + t);
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

function sanitize(input, base) {
  const out = { ...base };
  if (ENGINES[input.searchEngine]) out.searchEngine = input.searchEngine;
  const theme = LEGACY_THEMES[input.theme] || input.theme;
  if (THEMES.includes(theme)) out.theme = theme;
  if (input.accentOverride === null) out.accentOverride = null;
  else if (typeof input.accentOverride === 'string' && /^#[0-9a-f]{6}$/i.test(input.accentOverride)) {
    out.accentOverride = input.accentOverride;
  }
  if (['shrink', 'scroll'].includes(input.tabOverflow)) out.tabOverflow = input.tabOverflow;
  if (['newtab', 'homepage'].includes(input.newTabMode)) out.newTabMode = input.newTabMode;
  if (['replace', 'closeWindow'].includes(input.lastTabClose)) out.lastTabClose = input.lastTabClose;
  if (typeof input.onlineSuggestions === 'boolean') out.onlineSuggestions = input.onlineSuggestions;
  if (typeof input.homepage === 'string') {
    const home = normalizeHomepage(input.homepage);
    if (home) out.homepage = home;
  }
  return out;
}

function loadSettings() {
  try {
    state.settings = sanitize(JSON.parse(fs.readFileSync(settingsPath(), 'utf8')), DEFAULTS);
  } catch {
    state.settings = { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(state.settings, null, 2));
  } catch {}
}

// push current settings to the toolbar and to every internal page
function sendSettings() {
  const { win, tabs, settings } = state;
  if (win && !win.isDestroyed()) win.webContents.send('settings', settings);
  tabs.forEach((t) => {
    if (t.kind !== 'web' && !t.view.webContents.isDestroyed()) t.view.webContents.send('settings', settings);
  });
}

module.exports = { sanitize, loadSettings, saveSettings, sendSettings };
