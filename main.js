const { app, BrowserWindow, WebContentsView, ipcMain } = require('electron');
const path = require('path');

const TOOLBAR_HEIGHT = 80;
const HOME = 'https://duckduckgo.com';
const SEARCH = 'https://duckduckgo.com/?q=';

let win = null;
let tabs = [];
let activeId = null;
let nextId = 1;

function toURL(input) {
  const text = input.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  if (/^localhost(:\d+)?(\/|$)/i.test(text) || /^[^\s]+\.[^\s]{2,}$/.test(text)) {
    return 'https://' + text;
  }
  return SEARCH + encodeURIComponent(text);
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
    url: active ? active.view.webContents.getURL() : '',
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

function createTab(url = HOME) {
  const view = new WebContentsView({
    webPreferences: { sandbox: true, contextIsolation: true }
  });
  const id = nextId++;
  const wc = view.webContents;
  tabs.push({ id, view });

  ['page-title-updated', 'did-navigate', 'did-navigate-in-page', 'did-stop-loading']
    .forEach((evt) => wc.on(evt, sendState));

  wc.setWindowOpenHandler(({ url }) => {
    createTab(url);
    return { action: 'deny' };
  });

  wc.loadURL(url).catch(() => {});
  switchTab(id);
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

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 850,
    title: 'QwertyBrowser',
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  win.loadFile('index.html');
  win.webContents.on('did-finish-load', () => {
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

ipcMain.on('new-tab', () => createTab());
ipcMain.on('close-tab', (_, id) => closeTab(id));
ipcMain.on('switch-tab', (_, id) => switchTab(id));
ipcMain.on('navigate', (_, input) => {
  const tab = activeTab();
  if (tab) tab.view.webContents.loadURL(toURL(input)).catch(() => {});
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
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
