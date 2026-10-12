const { app, BrowserWindow, WebContentsView, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const TOOLBAR_HEIGHT = 80;

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' }
};
const THEMES = ['dark', 'light', 'midnight', 'forest'];
const DEFAULTS = {
  searchEngine: 'duckduckgo',
  homepage: 'https://duckduckgo.com/',
  theme: 'dark',
  accent: '#4f8cff'
};

let settings = { ...DEFAULTS };
let win = null;
let tabs = [];
let activeId = null;
let nextId = 1;

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
  if (typeof input.accent === 'string' && /^#[0-9a-f]{6}$/i.test(input.accent)) {
    out.accent = input.accent;
  }
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
}

/* ---------- helpers ---------- */

function toURL(input) {
  const text = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  if (/^localhost(:\d+)?(\/|$)/i.test(text) || /^[^\s]+\.[^\s]{2,}$/.test(text)) {
    return 'https://' + text;
  }
  return ENGINES[settings.searchEngine].url + encodeURIComponent(text);
}

function activeTab() {
  return tabs.find((t) => t.id === activeId);
}

function layout() {
  const tab = activeTab();
  if (!win || win.isDestroyed() || !tab) return;
  const [width, height] = win.getContentSize();
  tab.view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: height - TOOLBAR_HEIGHT });
}

function sendState() {
  if (!win || win.isDestroyed()) return;
  const active = activeTab();
  const nav = active ? active.view.webContents.navigationHistory : null;
  win.webContents.send('state', {
    tabs: tabs.map((t) => ({
      id: t.id,
      title: t.view.webContents.getTitle() || 'New Tab',
      active: t.id === activeId
    })),
    url: active ? (active.internal ? 'qwerty://settings' : active.view.webContents.getURL()) : '',
    canGoBack: nav ? nav.canGoBack() : false,
    canGoForward: nav ? nav.canGoForward() : false
  });
}

function switchTab(id) {
  const current = activeTab();
  if (current) win.contentView.removeChildView(current.view);
  const next = tabs.find((t) => t.id === id);
  if (!next) return;
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

function createTab(url = settings.homepage, { internal = false } = {}) {
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      ...(internal ? { preload: path.join(__dirname, 'settings-preload.js') } : {})
    }
  });
  const id = nextId++;
  const wc = view.webContents;
  tabs.push({ id, view, internal });

  ['page-title-updated', 'did-navigate', 'did-navigate-in-page', 'did-stop-loading']
    .forEach((evt) => wc.on(evt, sendState));

  wc.setWindowOpenHandler(({ url: target }) => {
    createTab(target);
    return { action: 'deny' };
  });

  if (internal) {
    // the settings page has special powers, so it must never navigate to the web
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.loadFile(path.join(__dirname, 'settings.html'));
  } else {
    wc.loadURL(url).catch(() => {});
  }
  switchTab(id);
}

function openSettings() {
  if (!win) return;
  const existing = tabs.find((t) => t.internal);
  if (existing) switchTab(existing.id);
  else createTab(undefined, { internal: true });
}

function closeTab(id) {
  const i = tabs.findIndex((t) => t.id === id);
  if (i === -1) return;
  const [tab] = tabs.splice(i, 1);
  win.contentView.removeChildView(tab.view);
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
        {
          label: 'Open Location',
          accelerator: 'CmdOrCtrl+L',
          click: () => {
            if (!win) return;
            win.webContents.focus();
            win.webContents.send('focus-address');
          }
        }
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
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => {
    sendSettings();
    if (tabs.length === 0) createTab();
    else sendState();
  });
  win.on('resize', layout);
  win.on('closed', () => {
    win = null;
    tabs = [];
    activeId = null;
  });
}

/* ---------- IPC ---------- */

const fromSettingsTab = (e) => tabs.some((t) => t.internal && t.view.webContents === e.sender);

ipcMain.handle('settings:get', (e) => {
  if (!fromSettingsTab(e)) return null;
  const engines = Object.fromEntries(Object.entries(ENGINES).map(([id, v]) => [id, v.name]));
  return { settings, engines, themes: THEMES };
});

ipcMain.handle('settings:set', (e, patch) => {
  if (!fromSettingsTab(e) || !patch || typeof patch !== 'object') return null;
  settings = sanitize(patch, settings);
  saveSettings();
  sendSettings();
  return settings;
});

ipcMain.on('open-settings', openSettings);
ipcMain.on('new-tab', () => createTab());
ipcMain.on('close-tab', (_, id) => closeTab(id));
ipcMain.on('switch-tab', (_, id) => switchTab(id));
ipcMain.on('navigate', (_, input) => {
  const tab = activeTab();
  if (!tab) return;
  if (tab.internal) createTab(toURL(input));
  else tab.view.webContents.loadURL(toURL(input)).catch(() => {});
});
ipcMain.on('back', () => {
  const tab = activeTab();
  if (tab) tab.view.webContents.navigationHistory.goBack();
});
ipcMain.on('forward', () => {
  const tab = activeTab();
  if (tab) tab.view.webContents.navigationHistory.goForward();
});
ipcMain.on('reload', () => {
  const tab = activeTab();
  if (tab) tab.view.webContents.reload();
});

app.whenReady().then(() => {
  loadSettings();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
