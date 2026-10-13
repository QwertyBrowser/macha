// ─────────────────────────────────────────────────────────────────────
//  Macha default settings. Edit the values, then restart the app.
//  A brand-new profile starts with these, and "Reset Macha to factory
//  settings" in Settings returns to them. Settings you've already saved
//  win over these, so use the reset button to see a change.
//  Invalid values are ignored and a warning prints in the terminal.
// ─────────────────────────────────────────────────────────────────────
module.exports = {
  // <color>-dark or <color>-light, where color is one of:
  // red, blue, green, mint, yellow, violet, orange, pink, indigo
  // or just: black, white
  theme: 'mint-light',

  // '#rrggbb' to force one accent color on every theme, or null to use each theme's own
  accentOverride: '#8585ff',

  // 'nunito' | 'inter' | 'dm-sans' | 'system'
  font: 'dm-sans',

  // 'duckduckgo' | 'google' | 'bing' | 'brave' | 'ecosia'
  searchEngine: 'google',

  homepage: 'https://google.com/',

  // 'newtab' (Macha's own page) | 'homepage'
  newTabMode: 'newtab',

  // 'shrink' (tabs get smaller, then scroll) | 'scroll' (tabs keep full size)
  tabOverflow: 'scroll',

  // 'replace' (a fresh tab appears) | 'closeWindow'
  lastTabClose: 'closeWindow',

  // address bar predictions from your search engine (true / false)
  onlineSuggestions: true,

  // show the bookmarks bar under the address bar (true / false); toggle anytime with Cmd+Shift+B
  bookmarksBar: true
};
