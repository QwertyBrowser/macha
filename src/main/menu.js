const { app, Menu } = require('electron');
const state = require('./state');
const {
  activeTab,
  focusAddress,
  switchTab,
  nextTab,
  createTab,
  openPage,
  openSettings,
  toggleBookmark,
  toggleBookmarksBar,
  closeTab,
  reopenClosedTab
} = require('./tabs');

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
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => state.win && createTab() },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => state.win && state.activeId && closeTab(state.activeId)
        },
        { label: 'Reopen Closed Tab', accelerator: 'CmdOrCtrl+Shift+T', click: reopenClosedTab },
        { type: 'separator' },
        { label: 'Open Location', accelerator: 'CmdOrCtrl+L', click: () => focusAddress() }
      ]
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Reload Page', accelerator: 'CmdOrCtrl+R', click: () => activeTab()?.view.webContents.reload() },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => activeTab()?.view.webContents.reloadIgnoringCache()
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'History',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+[',
          click: () => activeTab()?.view.webContents.navigationHistory.goBack()
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+]',
          click: () => activeTab()?.view.webContents.navigationHistory.goForward()
        },
        { type: 'separator' },
        { label: 'Show All History', accelerator: 'CmdOrCtrl+Y', click: () => openPage('history') }
      ]
    },
    {
      label: 'Bookmarks',
      submenu: [
        { label: 'Bookmark This Page', accelerator: 'CmdOrCtrl+D', click: toggleBookmark },
        { label: 'Show/Hide Bookmarks Bar', accelerator: 'CmdOrCtrl+Shift+B', click: toggleBookmarksBar },
        { type: 'separator' },
        { label: 'Show All Bookmarks', accelerator: 'CmdOrCtrl+Alt+B', click: () => openPage('bookmarks') }
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
          click: () => state.tabs[n] && switchTab(state.tabs[n].id)
        })),
        {
          label: 'Last Tab',
          accelerator: 'CmdOrCtrl+9',
          click: () => state.tabs.length && switchTab(state.tabs[state.tabs.length - 1].id)
        }
      ]
    },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = { buildMenu };
