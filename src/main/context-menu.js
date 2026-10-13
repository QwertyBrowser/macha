const { app, Menu, clipboard, ipcMain } = require('electron');
const state = require('./state');
const bookmarks = require('./bookmarks');
const { ENGINES } = require('./constants');
const { searchURL } = require('./input');
const { openFind } = require('./find');
const { activeTab, createTab, closeTab, navigateTab, sendState, toggleBookmark } = require('./tabs');

const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const fromToolbar = (e) => !!state.win && e.sender === state.win.webContents;
const tabFor = (wc) => state.tabs.find((t) => t.view && !t.view.webContents.isDestroyed() && t.view.webContents === wc);
const sep = () => ({ type: 'separator' });
const popup = (items) => Menu.buildFromTemplate(items).popup({ window: state.win });

// groups of items -> one flat list with a separator between non-empty groups
const withSeparators = (groups) => groups.filter((g) => g.length).flatMap((g, i) => (i ? [sep(), ...g] : g));

// Undo / Cut / Copy / Paste (+ spelling suggestions) for any text field
function editItems(wc, params) {
  const f = params.editFlags;
  const items = [];
  if (params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(0, 5);
    if (suggestions.length) {
      suggestions.forEach((s) => items.push({ label: s, click: () => wc.replaceMisspelling(s) }));
    } else {
      items.push({ label: 'No suggestions', enabled: false });
    }
    items.push({
      label: 'Add to Dictionary',
      click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord)
    });
    items.push(sep());
  }
  items.push(
    { role: 'undo', enabled: f.canUndo },
    { role: 'redo', enabled: f.canRedo },
    sep(),
    { role: 'cut', enabled: f.canCut },
    { role: 'copy', enabled: f.canCopy },
    { role: 'paste', enabled: f.canPaste },
    { role: 'selectAll', enabled: f.canSelectAll }
  );
  return items;
}

function pageItems(tab, params) {
  const wc = tab.view.webContents;
  const nav = wc.navigationHistory;
  const text = params.selectionText.trim();
  const media = { image: 'Image', video: 'Video', audio: 'Audio' }[params.mediaType];
  const groups = [];

  if (params.linkURL) {
    const g = [];
    if (isHttp(params.linkURL)) g.push({ label: 'Open Link in New Tab', click: () => createTab({ url: params.linkURL }) });
    g.push({ label: 'Copy Link Address', click: () => clipboard.writeText(params.linkURL) });
    if (isHttp(params.linkURL)) g.push({ label: 'Save Link As…', click: () => wc.downloadURL(params.linkURL) });
    groups.push(g);
  }

  if (media && params.srcURL) {
    const g = [];
    if (isHttp(params.srcURL)) g.push({ label: `Open ${media} in New Tab`, click: () => createTab({ url: params.srcURL }) });
    if (params.mediaType === 'image') g.push({ label: 'Copy Image', click: () => wc.copyImageAt(params.x, params.y) });
    g.push({ label: `Copy ${media} Address`, click: () => clipboard.writeText(params.srcURL) });
    if (isHttp(params.srcURL)) g.push({ label: `Save ${media} As…`, click: () => wc.downloadURL(params.srcURL) });
    groups.push(g);
  }

  if (text) {
    const short = (text.length > 30 ? text.slice(0, 30) + '…' : text).replace(/&/g, '&&');
    groups.push([
      { role: 'copy' },
      {
        label: `Search ${ENGINES[state.settings.searchEngine].name} for “${short}”`,
        click: () => createTab({ url: searchURL(text) })
      }
    ]);
  }

  // plain right-click on the page itself
  if (!params.linkURL && !media && !text) {
    groups.push([
      { label: 'Back', enabled: nav.canGoBack(), click: () => nav.goBack() },
      { label: 'Forward', enabled: nav.canGoForward(), click: () => nav.goForward() },
      { label: 'Reload', click: () => wc.reload() }
    ]);
    const url = wc.getURL();
    const g = [];
    if (isHttp(url)) {
      g.push({ label: bookmarks.findByURL(url) ? 'Remove Bookmark' : 'Bookmark This Page', click: toggleBookmark });
    }
    g.push({ label: 'Find in Page…', click: openFind }, { label: 'Print…', click: () => wc.print() });
    groups.push(g);
  }

  groups.push([{ label: 'Inspect', click: () => wc.inspectElement(params.x, params.y) }]);
  return withSeparators(groups);
}

function registerContextMenus() {
  // one listener for every webContents; it only reacts to the toolbar and to our tabs
  app.on('web-contents-created', (_, wc) => {
    wc.on('context-menu', (_e, params) => {
      const { win } = state;
      if (!win || win.isDestroyed()) return;
      const tab = tabFor(wc);
      if (wc !== win.webContents && !tab) return;
      if (params.isEditable) return popup(editItems(wc, params));
      if (tab && tab.kind === 'web') popup(pageItems(tab, params));
    });
  });

  // right-click on a tab in the tab strip
  ipcMain.on('tab:menu', (e, id) => {
    if (!fromToolbar(e)) return;
    const i = state.tabs.findIndex((t) => t.id === id);
    if (i === -1) return;
    const tab = state.tabs[i];
    const wc = tab.view.webContents;
    popup([
      { label: 'New Tab', click: () => createTab() },
      sep(),
      { label: 'Reload', click: () => wc.reload() },
      { label: 'Duplicate', enabled: tab.kind === 'web', click: () => createTab({ url: wc.getURL() }) },
      sep(),
      { label: 'Close Tab', click: () => closeTab(id) },
      {
        label: 'Close Other Tabs',
        enabled: state.tabs.length > 1,
        click: () => state.tabs.filter((t) => t.id !== id).forEach((t) => closeTab(t.id))
      },
      {
        label: 'Close Tabs to the Right',
        enabled: i < state.tabs.length - 1,
        click: () => state.tabs.slice(i + 1).forEach((t) => closeTab(t.id))
      }
    ]);
  });

  // right-click on a bookmark in the bookmarks bar
  ipcMain.on('bookmark:menu', (e, id) => {
    if (!fromToolbar(e)) return;
    const b = bookmarks.findById(id);
    if (!b) return;
    popup([
      {
        label: 'Open',
        click: () => {
          const tab = activeTab();
          if (tab) navigateTab(tab, b.url);
          else createTab({ url: b.url });
        }
      },
      { label: 'Open in New Tab', click: () => createTab({ url: b.url }) },
      sep(),
      { label: 'Copy Link Address', click: () => clipboard.writeText(b.url) },
      {
        label: 'Remove Bookmark',
        click: () => {
          bookmarks.removeById(b.id);
          sendState(); // un-fill the star if it's the current page
        }
      }
    ]);
  });
}

module.exports = { registerContextMenus };
