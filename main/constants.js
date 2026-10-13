const path = require('path');

// Project folder (one level up from main/): index.html, preload files, etc. live there
const ROOT = path.join(__dirname, '..');

const TOOLBAR_HEIGHT = 80;
const ROW_HEIGHT = 36;
const OVERLAY_PAD = 6;

const ENGINES = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' }
};
const ENGINE_NAMES = Object.fromEntries(Object.entries(ENGINES).map(([id, v]) => [id, v.name]));

const SUGGEST_URLS = {
  duckduckgo: (q) => `https://duckduckgo.com/ac/?type=list&q=${q}`,
  google: (q) => `https://suggestqueries.google.com/complete/search?client=firefox&q=${q}`,
  bing: (q) => `https://api.bing.com/osjson.aspx?query=${q}`,
  brave: (q) => `https://search.brave.com/api/suggest?q=${q}`,
  ecosia: (q) => `https://ac.ecosia.org/autocomplete?type=list&q=${q}`
};

const THEMES = ['dark', 'light', 'midnight', 'forest'];

const DEFAULTS = {
  searchEngine: 'duckduckgo',
  homepage: 'https://duckduckgo.com/',
  theme: 'dark',
  accent: '#4f8cff',
  tabOverflow: 'shrink',
  newTabMode: 'newtab',
  onlineSuggestions: true,
  lastTabClose: 'replace'
};

const INTERNAL = { 'qwerty://newtab': 'newtab', 'qwerty://settings': 'settings' };

module.exports = {
  ROOT,
  TOOLBAR_HEIGHT,
  ROW_HEIGHT,
  OVERLAY_PAD,
  ENGINES,
  ENGINE_NAMES,
  SUGGEST_URLS,
  THEMES,
  DEFAULTS,
  INTERNAL
};
