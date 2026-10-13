const path = require('path');

// src/ folder (one level up from src/main/)
const SRC = path.join(__dirname, '..');
const PRELOAD_DIR = path.join(SRC, 'preload');
const UI_DIR = path.join(SRC, 'ui');

const TOOLBAR_HEIGHT = 80;
const ROW_HEIGHT = 36;
const OVERLAY_PAD = 6;
const BOOKMARKS_BAR_HEIGHT = 32;

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

const THEME_COLORS = ['red', 'blue', 'green', 'mint', 'yellow', 'violet', 'orange', 'pink', 'indigo'];
const THEMES = [...THEME_COLORS.flatMap((c) => [`${c}-dark`, `${c}-light`]), 'black', 'white'];
// themes saved by older versions map onto the closest new one
const LEGACY_THEMES = { dark: 'blue-dark', light: 'blue-light', midnight: 'indigo-dark', forest: 'green-dark' };

// bundled interface fonts (the files live in src/ui/shared/fonts/)
const FONTS = { nunito: 'Nunito', inter: 'Inter', 'dm-sans': 'DM Sans', system: 'System default' };

// Known-good settings. Your own defaults live in defaults.js and are checked against these.
const FALLBACK = {
  searchEngine: 'duckduckgo',
  homepage: 'https://duckduckgo.com/',
  theme: 'blue-dark',
  accentOverride: null, // null = use the theme's own accent color
  font: 'system',
  tabOverflow: 'shrink',
  newTabMode: 'newtab',
  onlineSuggestions: true,
  lastTabClose: 'replace',
  bookmarksBar: false,
  setupComplete: false
};

// internal pages: kind -> page file (under src/ui) and preload script (under src/preload)
const PAGES = {
  newtab: { html: 'newtab/newtab.html', preload: 'newtab.js' },
  settings: { html: 'settings/settings.html', preload: 'settings.js' },
  bookmarks: { html: 'bookmarks/bookmarks.html', preload: 'bookmarks.js' },
  history: { html: 'history/history.html', preload: 'history.js' }
};
// typing qwerty://<kind> in the address bar opens that page
const INTERNAL = Object.fromEntries(Object.keys(PAGES).map((kind) => ['qwerty://' + kind, kind]));

module.exports = {
  PRELOAD_DIR,
  UI_DIR,
  TOOLBAR_HEIGHT,
  ROW_HEIGHT,
  OVERLAY_PAD,
  BOOKMARKS_BAR_HEIGHT,
  ENGINES,
  ENGINE_NAMES,
  SUGGEST_URLS,
  THEMES,
  LEGACY_THEMES,
  FONTS,
  FALLBACK,
  INTERNAL,
  PAGES
};
