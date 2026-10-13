const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { ENGINES } = require('./constants');
const state = require('./state');

let saveTimer = null;

const storePath = () => path.join(app.getPath('userData'), 'history.json');

function loadStore() {
  try {
    const data = JSON.parse(fs.readFileSync(storePath(), 'utf8'));
    state.store = {
      sites: data && data.sites && typeof data.sites === 'object' ? data.sites : {},
      searches: data && data.searches && typeof data.searches === 'object' ? data.searches : {}
    };
  } catch {
    state.store = { sites: {}, searches: {} };
  }
}

function writeStore() {
  saveTimer = null;
  const store = state.store;
  const sites = Object.values(store.sites);
  if (sites.length > 3000) {
    sites.sort((a, b) => b.last - a.last);
    store.sites = Object.fromEntries(sites.slice(0, 2500).map((s) => [s.url, s]));
  }
  const searches = Object.values(store.searches);
  if (searches.length > 1000) {
    searches.sort((a, b) => b.last - a.last);
    store.searches = Object.fromEntries(searches.slice(0, 800).map((s) => ['q:' + s.q.toLowerCase(), s]));
  }
  try {
    fs.writeFileSync(storePath(), JSON.stringify(store));
  } catch {}
}

function scheduleSave() {
  if (!saveTimer) saveTimer = setTimeout(writeStore, 2000);
}

// called on quit so a pending save isn't lost
function flushStore() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    writeStore();
  }
}

function clearStore() {
  state.store = { sites: {}, searches: {} };
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  writeStore();
}

const isSearchResultURL = (url) => Object.values(ENGINES).some((e) => url.startsWith(e.url));

function recordVisit(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return;
  }
  if (!/^https?:$/.test(u.protocol) || isSearchResultURL(raw)) return;
  u.hash = '';
  const key = u.href;
  const sites = state.store.sites;
  const e = sites[key] || (sites[key] = { url: key, title: '', visits: 0, last: 0 });
  e.visits++;
  e.last = Date.now();
  scheduleSave();
}

function setTitle(raw, title) {
  try {
    const u = new URL(raw);
    u.hash = '';
    const e = state.store.sites[u.href];
    if (e && title) {
      e.title = title;
      scheduleSave();
    }
  } catch {}
}

function recordSearch(text) {
  const q = text.trim().slice(0, 200);
  if (!q) return;
  const key = 'q:' + q.toLowerCase();
  const searches = state.store.searches;
  const e = searches[key] || (searches[key] = { q, count: 0, last: 0 });
  e.q = q;
  e.count++;
  e.last = Date.now();
  scheduleSave();
}

// for the History page: each site once, newest first, optionally filtered
function listSites(query, limit = 500) {
  const q = typeof query === 'string' ? query.trim().toLowerCase() : '';
  let sites = Object.values(state.store.sites);
  if (q) sites = sites.filter((s) => s.url.toLowerCase().includes(q) || (s.title || '').toLowerCase().includes(q));
  sites.sort((a, b) => b.last - a.last);
  return sites.slice(0, limit).map(({ url, title, last, visits }) => ({ url, title, last, visits }));
}

function removeSite(url) {
  if (typeof url !== 'string' || !Object.hasOwn(state.store.sites, url)) return false;
  delete state.store.sites[url];
  scheduleSave();
  return true;
}

module.exports = {
  loadStore,
  flushStore,
  clearStore,
  recordVisit,
  setTitle,
  recordSearch,
  listSites,
  removeSite
};
