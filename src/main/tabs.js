const path = require('path');
const { WebContentsView } = require('electron');
const {
  PRELOAD_DIR,
  UI_DIR,
  TOOLBAR_HEIGHT,
  BOOKMARKS_BAR_HEIGHT,
  FIND_BAR_HEIGHT,
  ENGINES,
  INTERNAL,
  PAGES
} = require('./constants');
const state = require('./state');
const { recordVisit, setTitle } = require('./history');
const { hideSuggestions } = require('./overlay');
const { saveSettings, sendSettings } = require('./settings-store');
const bookmarks = require('./bookmarks');

function activeTab() {
  return state.tabs.find((t) => t.id === state.activeId);
}

// which tab sent this IPC message?
const tabOf = (e) =>
  state.tabs.find((t) => t.view && !t.view.webContents.isDestroyed() && t.view.webContents === e.sender);

// the toolbar grows by one row while the bookmarks bar is showing
function toolbarHeight() {
  return (
    TOOLBAR_HEIGHT +
    (state.settings.bookmarksBar ? BOOKMARKS_BAR_HEIGHT : 0) +
    (state.findOpen ? FIND_BAR_HEIGHT : 0)
  );
}

function layout() {
  const tab = activeTab();
  const win = state.win;
  if (!win || win.isDestroyed() || !tab) return;
  const [width, height] = win.getContentSize();
  const top = toolbarHeight();
  tab.view.setBounds({ x: 0, y: top, width, height: height - top });
}

// if the page is a results page from one of our search engines, return just the query
function searchQueryFromURL(raw) {
  try {
    const u = new URL(raw);
    for (const e of Object.values(ENGINES)) {
      const base = new URL(e.url);
      if (u.hostname === base.hostname && u.pathname === base.pathname) {
        const q = u.searchParams.get('q');
        if (q && q.trim()) return q;
      }
    }
  } catch {}
  return null;
}

function pageURL(tab) {
  if (tab.kind === 'newtab') return '';
  if (tab.kind !== 'web') return 'qwerty://' + tab.kind;
  const url = tab.view.webContents.getURL();
  return searchQueryFromURL(url) ?? url;
}

function tabTitle(tab) {
  const t = tab.view.webContents.getTitle();
  if (t) return t;
  return tab.kind === 'web' ? 'Loading…' : 'New Tab';
}

function sendState() {
  const win = state.win;
  if (!win || win.isDestroyed()) return;
  const active = activeTab();
  const nav = active ? active.view.webContents.navigationHistory : null;
  const realURL = active && active.kind === 'web' ? active.view.webContents.getURL() : '';
  const canBookmark = /^https?:/i.test(realURL);
  win.webContents.send('state', {
    tabs: state.tabs.map((t) => ({
      id: t.id,
      title: tabTitle(t),
      favicon: t.kind === 'web' ? t.favicon : null,
      active: t.id === state.activeId
    })),
    url: active ? pageURL(active) : '',
    canGoBack: nav ? nav.canGoBack() : false,
    canGoForward: nav ? nav.canGoForward() : false,
    canBookmark,
    bookmarked: canBookmark && !!bookmarks.findByURL(realURL)
  });
}

function focusAddress(opts = {}) {
  const win = state.win;
  if (!win || win.isDestroyed()) return;
  win.webContents.focus();
  win.webContents.send('focus-address', opts);
}

function switchTab(id) {
  const next = state.tabs.find((t) => t.id === id);
  if (!next) return;
  if (state.findOpen && state.activeId !== id) {
    const cur = activeTab();
    if (cur && !cur.view.webContents.isDestroyed()) cur.view.webContents.stopFindInPage('clearSelection');
    state.findOpen = false;
    state.win.webContents.send('find:close');
  }
  hideSuggestions();
  const current = activeTab();
  if (current && current !== next) state.win.contentView.removeChildView(current.view);
  state.activeId = id;
  state.win.contentView.addChildView(next.view);
  layout();
  sendState();
}

function nextTab(delta) {
  const tabs = state.tabs;
  if (tabs.length < 2) return;
  const i = tabs.findIndex((t) => t.id === state.activeId);
  switchTab(tabs[(i + delta + tabs.length) % tabs.length].id);
}

function buildView(tab, kind, url) {
  const page = PAGES[kind]; // undefined for ordinary web pages
  const view = new WebContentsView({
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      ...(page ? { preload: path.join(PRELOAD_DIR, page.preload) } : {})
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
    wc.loadURL(url || state.settings.homepage).catch(() => {});
  } else {
    // internal pages have special powers, so they must never navigate to the web
    wc.on('will-navigate', (e) => e.preventDefault());
    wc.loadFile(path.join(UI_DIR, page.html));
  }
}

function swapView(tab, kind, url) {
  const win = state.win;
  const old = tab.view;
  const isActive = tab.id === state.activeId;
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
    else if (state.settings.newTabMode === 'homepage') {
      kind = 'web';
      url = state.settings.homepage;
    } else kind = 'newtab';
  }
  const tab = { id: state.nextId++, view: null, kind, favicon: null, faviconOrigin: null };
  state.tabs.push(tab);
  buildView(tab, kind, url);
  switchTab(tab.id);
  if (kind === 'newtab') {
    focusAddress({ clear: true });
    tab.view.webContents.once('did-finish-load', () => {
      if (tab.id === state.activeId && tab.kind === 'newtab') focusAddress({ select: false });
    });
  }
  return tab;
}

// open (or jump to) an internal page: settings, bookmarks or history
function openPage(kind) {
  if (!state.win || !Object.hasOwn(PAGES, kind) || kind === 'newtab') return;
  const existing = state.tabs.find((t) => t.kind === kind);
  if (existing) switchTab(existing.id);
  else createTab({ kind });
}

const openSettings = () => openPage('settings');

// bookmark (or un-bookmark) the page in the active tab
function toggleBookmark() {
  const tab = activeTab();
  if (!tab || tab.kind !== 'web') return;
  const wc = tab.view.webContents;
  const url = wc.getURL();
  if (!/^https?:/i.test(url)) return;
  if (bookmarks.findByURL(url)) bookmarks.removeByURL(url);
  else bookmarks.add({ url, title: wc.getTitle(), favicon: tab.favicon });
  sendState();
}

function toggleBookmarksBar() {
  state.settings = { ...state.settings, bookmarksBar: !state.settings.bookmarksBar };
  saveSettings();
  sendSettings();
  layout();
}

function rememberClosed(tab) {
  if (tab.view.webContents.isDestroyed()) return;
  if (tab.kind === 'web') {
    const url = tab.view.webContents.getURL();
    if (/^https?:/i.test(url)) state.closedTabs.push({ kind: 'web', url });
  } else if (tab.kind !== 'newtab') {
    state.closedTabs.push({ kind: tab.kind });
  }
  if (state.closedTabs.length > 25) state.closedTabs.shift();
}

function reopenClosedTab() {
  if (!state.win) return;
  let entry;
  while ((entry = state.closedTabs.pop())) {
    // skip a stale internal-page entry if that page is already open
    if (entry.kind !== 'web' && state.tabs.some((t) => t.kind === entry.kind)) continue;
    break;
  }
  if (!entry) return;
  if (entry.kind !== 'web') return openPage(entry.kind);
  const only = state.tabs.length === 1 ? state.tabs[0] : null;
  if (only && only.kind === 'newtab') navigateTab(only, entry.url); // reuse the blank tab
  else createTab({ url: entry.url });
}

function closeTab(id) {
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i === -1) return;
  const [tab] = state.tabs.splice(i, 1);
  rememberClosed(tab);
  if (id === state.activeId) state.win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  if (state.tabs.length === 0) {
    if (state.settings.lastTabClose === 'closeWindow') state.win.close();
    else createTab();
  } else if (state.activeId === id) {
    switchTab(state.tabs[Math.max(0, i - 1)].id);
  } else {
    sendState();
  }
}

module.exports = {
  activeTab,
  tabOf,
  layout,
  sendState,
  focusAddress,
  switchTab,
  nextTab,
  navigateTab,
  createTab,
  openPage,
  openSettings,
  toggleBookmark,
  toggleBookmarksBar,
  closeTab,
  reopenClosedTab
};
