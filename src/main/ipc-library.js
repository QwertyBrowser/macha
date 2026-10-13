const { ipcMain } = require('electron');
const state = require('./state');
const bookmarks = require('./bookmarks');
const { listSites, removeSite } = require('./history');
const { activeTab, tabOf, navigateTab, createTab, openPage, toggleBookmark, sendState } = require('./tabs');

const isWebURL = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);
const fromToolbar = (e) => !!state.win && e.sender === state.win.webContents;
const kindOf = (e) => tabOf(e)?.kind;

function openIn(tab, url, inNewTab) {
  if (inNewTab || !tab) createTab({ url });
  else navigateTab(tab, url);
}

function registerLibraryIpc() {
  /* ----- toolbar: star, bookmarks bar, "All bookmarks" ----- */

  ipcMain.on('open-page', (e, kind) => {
    if (fromToolbar(e) && typeof kind === 'string') openPage(kind);
  });

  ipcMain.on('bookmark:toggle', (e) => {
    if (fromToolbar(e)) toggleBookmark();
  });

  ipcMain.on('bookmark:open', (e, id, inNewTab) => {
    if (!fromToolbar(e)) return;
    const b = bookmarks.findById(id);
    if (b) openIn(activeTab(), b.url, !!inNewTab);
  });

  /* ----- Bookmarks page ----- */

  ipcMain.handle('bookmarks:get', (e) => {
    if (kindOf(e) !== 'bookmarks') return null;
    return { bookmarks: state.bookmarks, settings: state.settings };
  });

  ipcMain.handle('bookmarks:rename', (e, id, title) => {
    if (kindOf(e) !== 'bookmarks') return false;
    return bookmarks.rename(id, title);
  });

  ipcMain.handle('bookmarks:remove', (e, id) => {
    if (kindOf(e) !== 'bookmarks') return false;
    const ok = bookmarks.removeById(id);
    sendState(); // the star may need to un-fill
    return ok;
  });

  ipcMain.on('bookmarks:open', (e, id, inNewTab) => {
    if (kindOf(e) !== 'bookmarks') return;
    const b = bookmarks.findById(id);
    if (b) openIn(tabOf(e), b.url, !!inNewTab);
  });

  /* ----- History page ----- */

  ipcMain.handle('history:get', (e, query) => {
    if (kindOf(e) !== 'history') return null;
    return { sites: listSites(query), settings: state.settings };
  });

  ipcMain.handle('history:remove', (e, url) => {
    if (kindOf(e) !== 'history') return false;
    return removeSite(url);
  });

  ipcMain.on('history:open', (e, url, inNewTab) => {
    if (kindOf(e) !== 'history' || !isWebURL(url)) return;
    openIn(tabOf(e), url, !!inNewTab);
  });
}

module.exports = { registerLibraryIpc };
