const { app } = require('electron');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const state = require('./state');

const file = () => path.join(app.getPath('userData'), 'bookmarks.json');

const isWebURL = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

// same address minus the #fragment, so "page#top" and "page" are the same bookmark
function keyOf(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.href;
  } catch {
    return url;
  }
}

const cleanFavicon = (f) => (typeof f === 'string' && /^https:\/\//i.test(f) && f.length <= 500 ? f : null);

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(file(), 'utf8'));
    state.bookmarks = Array.isArray(data)
      ? data
          .filter((b) => b && typeof b.id === 'string' && isWebURL(b.url) && typeof b.title === 'string')
          .map((b) => ({
            id: b.id,
            url: b.url,
            title: b.title,
            favicon: cleanFavicon(b.favicon),
            added: Number(b.added) || 0
          }))
      : [];
  } catch {
    state.bookmarks = [];
  }
}

function save() {
  try {
    fs.writeFileSync(file(), JSON.stringify(state.bookmarks));
  } catch {}
}

// tell the toolbar (bookmarks bar) and any open Bookmarks page
function broadcast() {
  const { win, tabs } = state;
  if (win && !win.isDestroyed()) win.webContents.send('bookmarks', state.bookmarks);
  for (const t of tabs) {
    if (t.kind === 'bookmarks' && !t.view.webContents.isDestroyed()) {
      t.view.webContents.send('bookmarks', state.bookmarks);
    }
  }
}

const findById = (id) => state.bookmarks.find((b) => b.id === id);

function findByURL(url) {
  const key = keyOf(url);
  return state.bookmarks.find((b) => keyOf(b.url) === key);
}

function add({ url, title, favicon }) {
  if (!isWebURL(url) || findByURL(url)) return null;
  const key = keyOf(url);
  let host = key;
  try {
    host = new URL(key).hostname;
  } catch {}
  const b = {
    id: crypto.randomUUID(),
    url: key,
    title: (title || '').trim().slice(0, 200) || host,
    favicon: cleanFavicon(favicon),
    added: Date.now()
  };
  state.bookmarks.push(b);
  save();
  broadcast();
  return b;
}

function removeById(id) {
  const i = state.bookmarks.findIndex((b) => b.id === id);
  if (i === -1) return false;
  state.bookmarks.splice(i, 1);
  save();
  broadcast();
  return true;
}

function removeByURL(url) {
  const b = findByURL(url);
  return b ? removeById(b.id) : false;
}

function rename(id, title) {
  const b = findById(id);
  const t = typeof title === 'string' ? title.trim().slice(0, 200) : '';
  if (!b || !t) return false;
  b.title = t;
  save();
  broadcast();
  return true;
}

function clearAll() {
  state.bookmarks = [];
  save();
  broadcast();
}

module.exports = { load, broadcast, findById, findByURL, add, removeById, removeByURL, rename, clearAll };
