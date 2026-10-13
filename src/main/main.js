const { app, BrowserWindow } = require('electron');
const { loadSettings } = require('./settings-store');
const { loadStore, flushStore } = require('./history');
const { load: loadBookmarks } = require('./bookmarks');
const { buildMenu } = require('./menu');
const { createWindow } = require('./window');
const { registerIpc } = require('./ipc');
const { registerLibraryIpc } = require('./ipc-library');
const { registerContextMenus } = require('./context-menu');
const { registerFind } = require('./find');
const { initDownloads, registerDownloadsIpc } = require('./downloads');
const { registerPermissions } = require('./permissions');

registerIpc();
registerLibraryIpc();
registerContextMenus();
registerFind();
registerDownloadsIpc();

app.whenReady().then(() => {
  loadSettings();
  loadStore();
  loadBookmarks();
  initDownloads();
  registerPermissions();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', flushStore);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
