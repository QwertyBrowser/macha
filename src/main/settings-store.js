const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { ENGINES, THEMES, LEGACY_THEMES, FONTS, FALLBACK } = require('./constants');
const USER_DEFAULTS = require('./defaults');
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

// copies only valid values from input onto base
function sanitize(input, base) {
  const out = { ...base };
  if (Object.hasOwn(ENGINES, input.searchEngine)) out.searchEngine = input.searchEngine;
  const theme = Object.hasOwn(LEGACY_THEMES, input.theme) ? LEGACY_THEMES[input.theme] : input.theme;
  if (THEMES.includes(theme)) out.theme = theme;
  if (input.accentOverride === null) out.accentOverride = null;
  else if (typeof input.accentOverride === 'string' && /^#[0-9a-f]{6}$/i.test(input.accentOverride)) {
    out.accentOverride = input.accentOverride;
  }
  if (Object.hasOwn(FONTS, input.font)) out.font = input.font;
  if (['shrink', 'scroll'].includes(input.tabOverflow)) out.tabOverflow = input.tabOverflow;
  if (['newtab', 'homepage'].includes(input.newTabMode)) out.newTabMode = input.newTabMode;
  if (['replace', 'closeWindow'].includes(input.lastTabClose)) out.lastTabClose = input.lastTabClose;
  if (typeof input.onlineSuggestions === 'boolean') out.onlineSuggestions = input.onlineSuggestions;
  if (typeof input.setupComplete === 'boolean') out.setupComplete = input.setupComplete;
  if (typeof input.homepage === 'string') {
    const home = normalizeHomepage(input.homepage);
    if (home) out.homepage = home;
  }
  return out;
}

// defaults.js on top of the built-in fallback; bad values are ignored with a warning
function defaultSettings() {
  const out = sanitize(USER_DEFAULTS, FALLBACK);
  for (const [key, value] of Object.entries(USER_DEFAULTS)) {
    if (out[key] !== value) {
      console.warn(`[Macha] defaults.js: "${key}" was invalid or adjusted: ${JSON.stringify(value)}`);
    }
  }
  return { ...out, setupComplete: false };
}

function loadSettings() {
  try {
    state.settings = sanitize(JSON.parse(fs.readFileSync(settingsPath(), 'utf8')), defaultSettings());
  } catch {
    state.settings = defaultSettings();
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

function resetSettings() {
  state.settings = defaultSettings();
  saveSettings();
  sendSettings();
}

module.exports = { sanitize, defaultSettings, loadSettings, saveSettings, sendSettings, resetSettings };
