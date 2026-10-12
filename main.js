const { app, BrowserWindow, WebContentsView, ipcMain, Menu, net } = require('electron');
const path = require('path');
const fs = require('fs');

const TOOLBAR_HEIGHT = 80;
const ROW_HEIGHT = 36;
const OVERLAY_PAD = 6;

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' }
};
const ENGINE_NAMES = Object.fromEntries(Object.entries(ENGINES).map(([id, v]) => [id, v.name]));
const SUGGEST_URLS = {
  duckduckgo: (q) => `https://duckduckgo.com/ac/?type=list&q=${q}`,
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${q}`,
  bing: (q) => `https://api.bing.com/osjson.aspx?query=${q}`,
  brave: (q) => `https://search.brave.com/api/suggest?q=${q}`,
  ecosia: (q) => `https://ac.ecosia.org/autocomplete?type=list&q=${q}`
};
const THEMES = ['dark', 'light', 'midnight', 'forest'];
const DEFAULTS = {
  searchEngine: 'duckduckgo',
  homepage: 'https://duckduckgo.com/',
  theme: 'dark',
  accent: '#4f8cff',
  tabOverflow: 'shrink',
  newTabMode: 'newtab',
  onlineSuggestions: true
};
const INTERNAL = { 'qwerty://newtab': 'newtab', 'qwerty://settings': 'settings' };

let settings = { ...DEFAULTS };
let store = { sites: {}, searches: {} };
let win = null;
let suggestView = null;
let suggestVisible = false;
let tabs = [];
let activeId = null;
let nextId = 1;
let suggestSeq = 0;
let currentItems = [];
let saveTimer = null;

/* ---------- settings ---------- */

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
  if (THEMES.includes(input.theme)) out.theme = input.theme;
  if (typeof input.accent === 'string' && /^#[0-9a-f]{6}$/i.test(input.accent)) out.accent = input.accent;
  if (['shrink', 'scroll'].includes(input.tabOverflow)) out.tabOverflow = input.tabOverflow;
  if (['newtab', 'homepage'].includes(input.newTabMode)) out.newTabMode = input.newTabMode;
  if (typeof input.onlineSuggestions === 'boolean') out.onlineSuggestions = input.onlineSuggestions;
  if (typeof input.homepage === 'string') {
    const home = normalizeHomepage(input.homepage);
    if (home) out.homepage = home;
  }
  return out;
}

function loadSettings() {
  try {
    settings = sanitize(JSON.parse(fs.readFileSync(settingsPath(), 'utf8')), DEFAULTS);
  } catch {
    settings = { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch {}
}

function sendSettings() {
  if (win && !win.isDestroyed()) win.webContents.send('settings', settings);
  tabs.forEach((t) => {
    if (t.kind !== 'web' && !t.view.webContents.isDestroyed()) t.view.webContents.send('settings', settings);
  });
}

/* ---------- history store (sites + searches) ---------- */

const storePath = () => path.join(app.getPath('userData'), 'history.json');

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    store = {
      sites: data && data.sites && typeof data.sites === 'object' ? data.sites : {},
      searches: data && data.searches && typeof data.searches === 'object' ? data.searches : {}
    };
  } catch {
    store = { sites: {}, searches: {} };
  }
}

function writeStore() {
  saveTimer = null;
  const sites = Object.values(store.sites);
  if (sites.length > 3000) {
    sites.sort((a, b) => b.last - a.last);
    store.sites = Object.fromEntries(sites.slice(0, 2500).map((s) => [s.url, s]));
  }
  const searches = Object.values(store.searches);
  if (searches.length > 1000) {
    searches.sort((a, b) => b.last - a.last);
    store.searches = Object.fromEntries(searches.slice(0, 800).map((s) => ['q:' + s.q.toLowerCase(), s]));
  }
  try {
    fs.writeFileSync(storePath(), JSON.stringify(store));
  } catch {}
}

function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(writeStore, 2000);
}

const isSearchResultURL = (url) => Object.values(ENGINES).some((e) => url.startsWith(e.url));

function recordVisit(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return;
  }
  if (!/^https?:$/.test(u.protocol) || isSearchResultURL(raw)) return;
  u.hash = '';
  const key = u.href;
  const e = store.sites[key] || (store.sites[key] = { url: key, title: '', visits: 0, last: 0 });
  e.visits++;
  e.last = Date.now();
  scheduleSave();
}

function setTitle(raw, title) {
  try {
    const u = new URL(raw);
    u.hash = '';
    const e = store.sites[u.href];
    if (e && title) {
      e.title = title;
      scheduleSave();
    }
  } catch {}
}

function recordSearch(text) {
  const q = text.trim().slice(0, 200);
  if (!q) return;
  const key = 'q:' + q.toLowerCase();
  const e = store.searches[key] || (store.searches[key] = { q, count: 0, last: 0 });
  e.q = q;
  e.count++;
  e.last = Date.now();
  scheduleSave();
}

/* ---------- input + suggestions ---------- */

const searchURL = (text) => ENGINES[settings.searchEngine].url + encodeURIComponent(text);

function looksLikeURL(text) {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ||
    /^localhost(:\d+)?(\/|$)/i.test(text) ||
    /^[^\s]+\.[^\s]{2,}$/.test(text)
  );
}

function resolveInput(input) {
  const text = input.trim();
  if (/^qwerty:\/\//i.test(text)) return { url: text.toLowerCase().replace(/\/+$/, ''), search: null };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return { url: text, search: null };
  if (looksLikeURL(text)) return { url: 'https://' + text, search: null };
  return { url: searchURL(text), search: text };
}

function defaultAction(text) {
  const r = resolveInput(text);
  if (r.search) {
    return { kind: 'search', icon: 'search', label: text, sub: 'Search ' + ENGINES[settings.searchEngine].name, value: text };
  }
  return { kind: 'url', icon: 'go', label: text, sub: 'Go to site', value: r.url };
}

const bare = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

// more visits + more recent = higher score (recency halves every 14 days)
function frecency(count, last) {
  const days = (Date.now() - last) / 86400000;
  return (1 + Math.log2(1 + count)) * (0.4 + 0.6 * Math.pow(0.5, days / 14));
}

function localSuggestions(text) {
  const raw = text.trim();
  const q = raw.toLowerCase();
  const items = [defaultAction(raw)];
  const defaultTarget = items[0].value.replace(/\/$/, '');

  const sites = [];
  for (const s of Object.values(store.sites)) {
    if (s.url.replace(/\/$/, '') === defaultTarget) continue;
    const u = bare(s.url).toLowerCase();
    const title = (s.title || '').toLowerCase();
    let match = 0;
    if (u.split('/')[0].startsWith(q)) match = 100;
    else if (u.startsWith(q)) match = 90;
    else if (title.split(/\s+/).some((w) => w.startsWith(q))) match = 60;
    else if (u.includes(q) || title.includes(q)) match = 40;
    if (match) sites.push({ s, score: match * frecency(s.visits, s.last) });
  }
  sites.sort((a, b) => b.score - a.score);
  for (const { s } of sites.slice(0, 3)) {
    const label = s.title || bare(s.url);
    items.push({ kind: 'url', icon: 'site', label, sub: label === bare(s.url) ? '' : bare(s.url), value: s.url });
  }

  const recents = [];
  for (const s of Object.values(store.searches)) {
    const t = s.q.toLowerCase();
    if (t === q) continue;
    const match = t.startsWith(q) ? 80 : t.includes(q) ? 35 : 0;
    if (match) recents.push({ s, score: match * frecency(s.count, s.last) });
  }
  recents.sort((a, b) => b.score - a.score);
  for (const { s } of recents.slice(0, 2)) {
    items.push({ kind: 'search', icon: 'recent', label: s.q, sub: '', value: s.q });
  }
  return items;
}

async function onlineSuggestions(text) {
  try {
    const url = SUGGEST_URLS[settings.searchEngine](encodeURIComponent(text));
    const res = await net.fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].filter((s) => typeof s === 'string').slice(0, 6);
    }
  } catch {}
  return [];
}

function withOnline(local, online) {
  const seen = new Set(local.filter((i) => i.kind === 'search').map((i) => i.value.toLowerCase()));
  const out = [...local];
  for (const s of online) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: 'search', icon: 'search', label: s, sub: '', value: s });
    if (out.length >= 10) break;
  }
  return out;
}

function showSuggestions(items, rect) {
  if (!win || win.isDestroyed() || !suggestView) return;
  const height = items.length * ROW_HEIGHT + OVERLAY_PAD * 2 + 2;
  suggestView.setBounds({ x: rect.x, y: rect.y + 4, width: rect.width, height });
  win.contentView.addChildView(suggestView); // re-adding moves it to the top
  suggestView.webContents.send('items', { items, selected: 0, theme: settings.theme, accent: settings.accent });
  suggestVisible = true;
}

function hideSuggestions() {
  if (!win || win.isDestroyed() || !suggestView || !suggestVisible) return;
  win.contentView.removeChildView(suggestView);
  suggestVisible = false;
}

function publishSuggestions(seq, text, rect, items) {
  if (!win || win.isDestroyed()) return;
  currentItems = items;
  win.webContents.send('suggest-items', { seq, text, items });
  showSuggestions(items, rect);
}

function chooseSuggestion(index) {
  const item = currentItems[index];
  hideSuggestions();
  if (win && !win.isDestroyed()) win.webContents.send('blur-address');
  const tab = activeTab();
  if (!item || !tab) return;
  if (item.kind === 'search') {
    recordSearch(item.value);
    navigateTab(tab, searchURL(item.value));
  } else {
    navigateTab(tab, item.value);
  }
}

/* ---------- tabs ---------- */

function activeTab() {
  return tabs.find((t) => t.id === activeId);
}

const tabOf = (e) => tabs.find((t) => t.view && !t.view.webContents.isDestroyed() && t.view.webContents === e.sender);

function layout() {
  const tab = activeTab();
  if (!win || win.isDestroyed() || !tab) return;
  const [width, height] = win.getContentSize();
  tab.view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: height - TOOLBAR_HEIGHT });
}

function pageURL(tab) {
  if (tab.kind === 'newtab') return '';
  if (tab.kind === 'settings') return 'qwerty://settings';
  return tab.view.webContents.getURL();
}

function tabTitle(tab) {
  const t = tab.view.webContents.getTitle();
  if (t) return t;
  return tab.kind === 'web' ? 'Loading…' : 'New Tab';
}

function sendState() {
  if (!win || win.isDestroyed()) return;
  const active = activeTab();
  const nav = active ? active.view.webContents.navigationHistory : null;
  win.webContents.send('state', {
    tabs: tabs.map((t) => ({
      id: t.id,
      title: tabTitle(t),
      favicon: t.kind === 'web' ? t.favicon : null,
      active: t.id === activeId
    })),
    url: active ? pageURL(active) : '',
    canGoBack: nav ? nav.canGoBack() : false,
    canGoForward: nav ? nav.canGoForward() : false
  });
}

function focusAddress(opts = {}) {
  if (!win || win.isDestroyed()) return;
  win.webContents.focus();
  win.webContents.send('focus-address', opts);
}

function switchTab(id) {
  const next = tabs.find((t) => t.id === id);
  if (!next) return;
  hideSuggestions();
  const current = activeTab();
  if (current && current !== next) win.contentView.removeChildView(current.view);
  activeId = id;
  win.contentView.addChildView(next.view);
  layout();
  sendState();
}

function nextTab(delta) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex((t) => t.id === activeId);
  switchTab(tabs[(i + delta + tabs.length) % tabs.length].id);
}

function buildView(tab, kind, url) {
  const preload = { settings: 'settings-preload.js', newtab: 'newtab-preload.js' }[kind];
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      ...(preload ? { preload: path.join(__dirname, preload) } : {})
    }
  });
  const wc = view.webContents;
  tab.view = view;
  tab.kind = kind;
  tab.favicon = null;
  tab.faviconOrigin = null;
  const current = () => tab.view === view;

  wc.on('page-title-updated', (_, title) => {
    if (current()) setTitle(wc.getURL(), title);
  });
  wc.on('did-navigate', (_, navURL) => {
    if (!current()) return;
    recordVisit(navURL);
    try {
      if (tab.faviconOrigin && new URL(navURL).origin !== tab.faviconOrigin) tab.favicon = null;
    } catch {
      tab.favicon = null;
    }
  });
  wc.on('page-favicon-updated', (_, icons) => {
    if (!current() || kind !== 'web') return;
    tab.favicon = icons.find((i) => /^(https:|data:)/i.test(i)) || null;
    try {
      tab.faviconOrigin = new URL(wc.getURL()).origin;
    } catch {
      tab.faviconOrigin = null;
    }
    sendState();
  });
  ['page-title-updated', 'did-navigate', 'did-navigate-in-page', 'did-stop-loading'].forEach((evt) =>
    wc.on(evt, () => current() && sendState())
  );

  wc.setWindowOpenHandler(({ url: target }) => {
    createTab({ url: target });
    return { action: 'deny' };
  });

  if (kind === 'web') {
    wc.loadURL(url || settings.homepage).catch(() => {});
  } else {
    // internal pages have special powers, so they must never navigate to the web
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.loadFile(path.join(__dirname, kind === 'settings' ? 'settings.html' : 'newtab.html'));
  }
}

function swapView(tab, kind, url) {
  const old = tab.view;
  const isActive = tab.id === activeId;
  if (isActive && win) win.contentView.removeChildView(old);
  buildView(tab, kind, url);
  if (isActive && win) {
    win.contentView.addChildView(tab.view);
    layout();
  }
  setTimeout(() => {
    if (!old.webContents.isDestroyed()) old.webContents.close();
  }, 0);
  sendState();
}

function navigateTab(tab, url) {
  if (/^qwerty:\/\//i.test(url)) {
    const kind = INTERNAL[url.toLowerCase().replace(/\/+$/, '')];
    if (!kind) return;
    if (tab.kind === kind) tab.view.webContents.reload();
    else swapView(tab, kind);
    return;
  }
  if (tab.kind !== 'web') swapView(tab, 'web', url);
  else tab.view.webContents.loadURL(url).catch(() => {});
}

function createTab(opts = {}) {
  let { url, kind } = opts;
  if (!kind) {
    if (url) kind = 'web';
    else if (settings.newTabMode === 'homepage') {
      kind = 'web';
      url = settings.homepage;
    } else kind = 'newtab';
  }
  const tab = { id: nextId++, view: null, kind, favicon: null, faviconOrigin: null };
  tabs.push(tab);
  buildView(tab, kind, url);
  switchTab(tab.id);
  if (kind === 'newtab') {
    focusAddress({ clear: true });
    tab.view.webContents.once('did-finish-load', () => {
      if (tab.id === activeId && tab.kind === 'newtab') focusAddress({ select: false });
    });
  }
  return tab;
}

function openSettings() {
  if (!win) return;
  const existing = tabs.find((t) => t.kind === 'settings');
  if (existing) switchTab(existing.id);
  else createTab({ kind: 'settings' });
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i === -1) return;
  const [tab] = tabs.splice(i, 1);
  if (id === activeId) win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (tabs.length === 0) {
    createTab();
  } else if (activeId === id) {
    switchTab(tabs[Math.max(0, i - 1)].id);
  } else {
    sendState();
  }
}

/* ---------- menu ---------- */

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: openSettings },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => win && createTab() },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', click: () => win && activeId && closeTab(activeId) },
        { type: 'separator' },
        { label: 'Open Location', accelerator: 'CmdOrCtrl+L', click: () => focusAddress() }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: () => activeTab()?.view.webContents.reload() },
        { label: 'Hard Reload', accelerator: 'CmdOrCtrl+Shift+R', click: () => activeTab()?.view.webContents.reloadIgnoringCache() },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'History',
      submenu: [
        { label: 'Back', accelerator: 'CmdOrCtrl+[', click: () => activeTab()?.view.webContents.navigationHistory.goBack() },
        { label: 'Forward', accelerator: 'CmdOrCtrl+]', click: () => activeTab()?.view.webContents.navigationHistory.goForward() }
      ]
    },
    {
      label: 'Tabs',
      submenu: [
        { label: 'Next Tab', accelerator: 'Ctrl+Tab', click: () => nextTab(1) },
        { label: 'Previous Tab', accelerator: 'Ctrl+Shift+Tab', click: () => nextTab(-1) },
        { type: 'separator' },
        ...Array.from({ length: 8 }, (_, n) => ({
          label: `Tab ${n + 1}`,
          accelerator: `CmdOrCtrl+${n + 1}`,
          click: () => tabs[n] && switchTab(tabs[n].id)
        })),
        {
          label: 'Last Tab',
          accelerator: 'CmdOrCtrl+9',
          click: () => tabs.length && switchTab(tabs[tabs.length - 1].id)
        }
      ]
    },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- window ---------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'QwertyBrowser',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });

  suggestView = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true, preload: path.join(__dirname, 'suggest-preload.js') }
  });
  suggestView.setBackgroundColor('#00000000');
  suggestView.webContents.loadFile(path.join(__dirname, 'suggestions.html'));
  suggestView.webContents.on('will-navigate', (e) => e.preventDefault());
  suggestView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('did-finish-load', () => {
    sendSettings();
    if (tabs.length === 0) createTab();
    else sendState();
  });
  win.on('resize', () => {
    layout();
    hideSuggestions();
  });
  win.on('closed', () => {
    win = null;
    suggestView = null;
    suggestVisible = false;
    tabs = [];
    activeId = null;
  });
}

/* ---------- IPC ---------- */

ipcMain.handle('settings:get', (e) => {
  const t = tabOf(e);
  if (!t || t.kind !== 'settings') return null;
  return { settings, engines: ENGINE_NAMES, themes: THEMES };
});

ipcMain.handle('settings:set', (e, patch) => {
  const t = tabOf(e);
  if (!t || t.kind !== 'settings' || !patch || typeof patch !== 'object') return null;
  settings = sanitize(patch, settings);
  saveSettings();
  sendSettings();
  return settings;
});

ipcMain.handle('history:clear', (e) => {
  const t = tabOf(e);
  if (!t || t.kind !== 'settings') return false;
  store = { sites: {}, searches: {} };
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeStore();
  return true;
});

ipcMain.handle('newtab:get', (e) => {
  const t = tabOf(e);
  if (!t || t.kind !== 'newtab') return null;
  return { settings, engines: ENGINE_NAMES };
});

ipcMain.on('newtab:search', (e, q) => {
  const t = tabOf(e);
  if (!t || t.kind !== 'newtab' || typeof q !== 'string' || !q.trim()) return;
  recordSearch(q);
  navigateTab(t, searchURL(q.trim()));
});

ipcMain.on('suggest', async (e, text, rect, seq) => {
  if (!win || e.sender !== win.webContents) return;
  if (typeof text !== 'string' || typeof seq !== 'number') return;
  if (!rect || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) || !Number.isFinite(rect.width)) return;
  suggestSeq = Math.max(suggestSeq, seq);
  const local = localSuggestions(text);
  publishSuggestions(seq, text, rect, local);
  const q = text.trim();
  if (!settings.onlineSuggestions || q.length < 2 || q.length > 100 || looksLikeURL(q)) return;
  const online = await onlineSuggestions(q);
  if (seq !== suggestSeq || !online.length) return;
  publishSuggestions(seq, text, rect, withOnline(local, online));
});

ipcMain.on('suggest:hide', (e, seq) => {
  if (!win || e.sender !== win.webContents) return;
  if (typeof seq === 'number') suggestSeq = Math.max(suggestSeq, seq);
  hideSuggestions();
});

ipcMain.on('suggest:highlight', (e, i) => {
  if (!win || e.sender !== win.webContents || !suggestVisible || !Number.isInteger(i)) return;
  suggestView.webContents.send('highlight', i);
});

ipcMain.on('suggest:choose', (e, i) => {
  if (!win || !suggestView) return;
  if (e.sender !== win.webContents && e.sender !== suggestView.webContents) return;
  if (Number.isInteger(i)) chooseSuggestion(i);
});

ipcMain.on('open-settings', openSettings);
ipcMain.on('new-tab', () => createTab());
ipcMain.on('close-tab', (_, id) => closeTab(id));
ipcMain.on('switch-tab', (_, id) => switchTab(id));
ipcMain.on('navigate', (e, input) => {
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

app.whenReady().then(() => {
  loadSettings();
  loadStore();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    writeStore();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
