const { FALLBACK } = require('./constants');

// One shared, mutable object. Always read fields at call time (state.tabs, state.settings...)
// instead of copying them into variables, because they get replaced while the app runs.
module.exports = {
  settings: { ...FALLBACK },
  store: { sites: {}, searches: {} },
  win: null,
  suggestView: null,
  suggestVisible: false,
  suggestSeq: 0,
  currentItems: [],
  tabs: [],
  activeId: null,
  nextId: 1,
  closedTabs: [] // most recently closed last
};
