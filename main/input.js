const { ENGINES } = require('./constants');
const state = require('./state');

const searchURL = (text) => ENGINES[state.settings.searchEngine].url + encodeURIComponent(text);

function looksLikeURL(text) {
  return (
    /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ||
    /^localhost(:\d+)?(\/|$)/i.test(text) ||
    /^[^\s]+\.[^\s]{2,}$/.test(text)
  );
}

function resolveInput(input) {
  const text = input.trim();
  if (/^qwerty:\/\//i.test(text)) return { url: text.toLowerCase().replace(/\/+$/, ''), search: null };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return { url: text, search: null };
  if (looksLikeURL(text)) return { url: 'https://' + text, search: null };
  return { url: searchURL(text), search: text };
}

// the first row of the dropdown: what Enter would do with exactly what's typed
function defaultAction(text) {
  const r = resolveInput(text);
  if (r.search) {
    return {
      kind: 'search',
      icon: 'search',
      label: text,
      sub: 'Search ' + ENGINES[state.settings.searchEngine].name,
      value: text
    };
  }
  return { kind: 'url', icon: 'go', label: text, sub: 'Go to site', value: r.url };
}

module.exports = { searchURL, looksLikeURL, resolveInput, defaultAction };
