const { app, session, shell, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const state = require('./state');
const { tabOf } = require('./tabs');

const live = new Map(); // id -> Electron DownloadItem, only while it's still downloading
let nextId = 1;
let sendTimer = null;

const file = () => path.join(app.getPath('userData'), 'downloads.json');

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    state.downloads = (Array.isArray(data) ? data : [])
      .filter((d) => d && typeof d.id === 'number' && typeof d.path === 'string')
      .map((d) => ({
        id: d.id,
        name: String(d.name || path.basename(d.path)),
        url: String(d.url || ''),
        path: d.path,
        total: Number(d.total) || 0,
        received: Number(d.received) || 0,
        // anything that was mid-download when Macha quit didn't finish
        state: d.state === 'completed' || d.state === 'cancelled' ? d.state : 'interrupted',
        time: Number(d.time) || 0
      }));
  } catch {
    state.downloads = [];
  }
  nextId = state.downloads.reduce((m, d) => Math.max(m, d.id), 0) + 1;
}

function save() {
  try {
    state.downloads = state.downloads.slice(-200);
    fs.writeFileSync(file(), JSON.stringify(state.downloads));
  } catch {}
}

// tell the open Downloads page(s) and the toolbar button; progress updates are throttled
function broadcast(now = false) {
  if (!now) {
    if (!sendTimer) sendTimer = setTimeout(() => ((sendTimer = null), broadcast(true)), 250);
    return;
  }
  const { win, tabs, downloads } = state;
  for (const t of tabs) {
    if (t.kind === 'downloads' && !t.view.webContents.isDestroyed()) t.view.webContents.send('downloads', downloads);
  }
  if (win && !win.isDestroyed()) {
    const active = downloads.filter((d) => d.state === 'progressing' || d.state === 'paused').length;
    win.webContents.send('downloads-active', active);
  }
}

// "report.pdf" -> "report (1).pdf" if it already exists
function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const taken = (p) => fs.existsSync(p) || state.downloads.some((d) => d.path === p && d.state === 'progressing');
  let p = path.join(dir, name);
  for (let n = 1; taken(p); n++) p = path.join(dir, `${base} (${n})${ext}`);
  return p;
}

function onWillDownload(_event, item) {
  const name = path.basename(item.getFilename() || 'download');
  const savePath = uniquePath(app.getPath('downloads'), name);
  item.setSavePath(savePath); // setting a path skips the Save dialog

  const rec = {
    id: nextId++,
    name: path.basename(savePath),
    url: item.getURL(),
    path: savePath,
    total: item.getTotalBytes(),
    received: 0,
    state: 'progressing',
    time: Date.now()
  };
  state.downloads.push(rec);
  live.set(rec.id, item);
  broadcast(true);

  item.on('updated', (_e, st) => {
    rec.received = item.getReceivedBytes();
    rec.total = item.getTotalBytes();
    rec.state = st === 'interrupted' || item.isPaused() ? 'paused' : 'progressing';
    broadcast();
  });

  item.once('done', (_e, st) => {
    rec.received = item.getReceivedBytes();
    rec.state = st; // 'completed' | 'cancelled' | 'interrupted'
    live.delete(rec.id);
    if (st === 'completed' && process.platform === 'darwin') app.dock?.downloadFinished(rec.path);
    save();
    broadcast(true);
  });
}

function initDownloads() {
  load();
  session.defaultSession.on('will-download', onWillDownload);
}

function registerDownloadsIpc() {
  const fromPage = (e) => tabOf(e)?.kind === 'downloads';
  const find = (id) => state.downloads.find((d) => d.id === id);

  ipcMain.handle('downloads:get', (e) => (fromPage(e) ? { downloads: state.downloads, settings: state.settings } : null));

  ipcMain.on('downloads:open', (e, id) => {
    const d = fromPage(e) && find(id);
    if (d && d.state === 'completed' && fs.existsSync(d.path)) shell.openPath(d.path);
  });

  ipcMain.on('downloads:show', (e, id) => {
    const d = fromPage(e) && find(id);
    if (d && fs.existsSync(d.path)) shell.showItemInFolder(d.path);
  });

  ipcMain.on('downloads:pause', (e, id) => fromPage(e) && live.get(id)?.pause());
  ipcMain.on('downloads:resume', (e, id) => {
    const it = fromPage(e) && live.get(id);
    if (it && it.canResume()) it.resume();
  });
  ipcMain.on('downloads:cancel', (e, id) => fromPage(e) && live.get(id)?.cancel());

  // removes the entry from the list; the file itself stays on disk
  ipcMain.handle('downloads:remove', (e, id) => {
    if (!fromPage(e)) return false;
    live.get(id)?.cancel();
    state.downloads = state.downloads.filter((d) => d.id !== id);
    save();
    broadcast(true);
    return true;
  });

  ipcMain.handle('downloads:clear', (e) => {
    if (!fromPage(e)) return false;
    state.downloads = state.downloads.filter((d) => live.has(d.id));
    save();
    broadcast(true);
    return true;
  });
}

module.exports = { initDownloads, registerDownloadsIpc };
