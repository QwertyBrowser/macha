const { app, BrowserWindow } = require('electron');
const { loadSettings } = require('./settings-store');
const { loadStore, flushStore } = require('./history');
const { load: loadBookmarks } = require('./bookmarks');
const { buildMenu } = require('./menu');
const { createWindow } = require('./window');
const { registerIpc } = require('./ipc');
const { registerLibraryIpc } = require('./ipc-library');

registerIpc();
registerLibraryIpc();

app.whenReady().then(() => {
  loadSettings();
  loadStore();
  loadBookmarks();
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
