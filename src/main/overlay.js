const { ROW_HEIGHT, OVERLAY_PAD } = require('./constants');
const state = require('./state');

function showSuggestions(items, rect) {
  const { win, suggestView } = state;
  if (!win || win.isDestroyed() || !suggestView) return;
  const height = items.length * ROW_HEIGHT + OVERLAY_PAD * 2 + 2;
  suggestView.setBounds({ x: rect.x, y: rect.y + 4, width: rect.width, height });
  win.contentView.addChildView(suggestView); // re-adding moves it to the top
  suggestView.webContents.send('items', {
    items,
    selected: 0,
    theme: state.settings.theme,
    accent: state.settings.accent
  });
  state.suggestVisible = true;
}

function hideSuggestions() {
  const { win, suggestView } = state;
  if (!win || win.isDestroyed() || !suggestView || !state.suggestVisible) return;
  win.contentView.removeChildView(suggestView);
  state.suggestVisible = false;
}

function publishSuggestions(seq, text, rect, items) {
  const { win } = state;
  if (!win || win.isDestroyed()) return;
  state.currentItems = items;
  win.webContents.send('suggest-items', { seq, text, items });
  showSuggestions(items, rect);
}

module.exports = { showSuggestions, hideSuggestions, publishSuggestions };
