const api = window.newtabAPI;
const input = document.getElementById('q');
let engines = {};

function apply(s) {
  applyTheme(s.theme, s.accentOverride);
  input.placeholder = 'Search with ' + (engines[s.searchEngine] || 'your search engine');
}

document.getElementById('f').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) api.search(q);
});

api.onSettings(apply);
api.get().then((data) => {
  if (!data) return;
  engines = data.engines;
  apply(data.settings);
});
