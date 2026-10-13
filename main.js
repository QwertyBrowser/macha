const { app, BrowserWindow } = require('electron');
const { loadSettings } = require('./main/settings-store');
const { loadStore, flushStore } = require('./main/history');
const { buildMenu } = require('./main/menu');
const { createWindow } = require('./main/window');
const { registerIpc } = require('./main/ipc');

registerIpc();

app.whenReady().then(() => {
  loadSettings();
  loadStore();
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
