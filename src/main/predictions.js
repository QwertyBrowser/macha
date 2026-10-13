const { net } = require('electron');
const { SUGGEST_URLS } = require('./constants');
const state = require('./state');
const { defaultAction } = require('./input');

const bare = (url) => url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

// more visits + more recent = higher score (recency halves every 14 days)
function frecency(count, last) {
  const days = (Date.now() - last) / 86400000;
  return (1 + Math.log2(1 + count)) * (0.4 + 0.6 * Math.pow(0.5, days / 14));
}

function localSuggestions(text) {
  const store = state.store;
  const raw = text.trim();
  const q = raw.toLowerCase();
  const items = [defaultAction(raw)];
  const defaultTarget = items[0].value.replace(/\/$/, '');

  const sites = [];
  for (const s of Object.values(store.sites)) {
    if (s.url.replace(/\/$/, '') === defaultTarget) continue;
    const u = bare(s.url).toLowerCase();
    const title = (s.title || '').toLowerCase();
    let match = 0;
    if (u.split('/')[0].startsWith(q)) match = 100;
    else if (u.startsWith(q)) match = 90;
    else if (title.split(/\s+/).some((w) => w.startsWith(q))) match = 60;
    else if (u.includes(q) || title.includes(q)) match = 40;
    if (match) sites.push({ s, score: match * frecency(s.visits, s.last) });
  }
  sites.sort((a, b) => b.score - a.score);
  for (const { s } of sites.slice(0, 3)) {
    const label = s.title || bare(s.url);
    items.push({ kind: 'url', icon: 'site', label, sub: label === bare(s.url) ? '' : bare(s.url), value: s.url });
  }

  const recents = [];
  for (const s of Object.values(store.searches)) {
    const t = s.q.toLowerCase();
    if (t === q) continue;
    const match = t.startsWith(q) ? 80 : t.includes(q) ? 35 : 0;
    if (match) recents.push({ s, score: match * frecency(s.count, s.last) });
  }
  recents.sort((a, b) => b.score - a.score);
  for (const { s } of recents.slice(0, 2)) {
    items.push({ kind: 'search', icon: 'recent', label: s.q, sub: '', value: s.q });
  }
  return items;
}

async function onlineSuggestions(text) {
  try {
    const url = SUGGEST_URLS[state.settings.searchEngine](encodeURIComponent(text));
    const res = await net.fetch(url, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      return data[1].filter((s) => typeof s === 'string').slice(0, 6);
    }
  } catch {}
  return [];
}

function withOnline(local, online) {
  const seen = new Set(local.filter((i) => i.kind === 'search').map((i) => i.value.toLowerCase()));
  const out = [...local];
  for (const s of online) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ kind: 'search', icon: 'search', label: s, sub: '', value: s });
    if (out.length >= 10) break;
  }
  return out;
}

module.exports = { localSuggestions, onlineSuggestions, withOnline };
