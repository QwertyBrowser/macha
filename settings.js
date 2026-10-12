const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const engineSel = $('engine');
const online = $('online');
const newTab = $('newtab');
const home = $('homepage');
const tabsSel = $('taboverflow');
const accent = $('accent');
const themesEl = $('themes');
const status = $('status');
let statusTimer = null;

function flash(msg) {
  status.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ''), 1500);
}

function apply(s) {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty('--accent', s.accent);
  engineSel.value = s.searchEngine;
  online.checked = s.onlineSuggestions;
  newTab.value = s.newTabMode;
  home.value = s.homepage;
  tabsSel.value = s.tabOverflow;
  accent.value = s.accent;
  [...themesEl.children].forEach((b) => b.classList.toggle('active', b.dataset.theme === s.theme));
}

async function save(patch) {
  const s = await api.set(patch);
  if (!s) return;
  apply(s);
  flash('Saved ✓');
}

engineSel.onchange = () => save({ searchEngine: engineSel.value });
online.onchange = () => save({ onlineSuggestions: online.checked });
newTab.onchange = () => save({ newTabMode: newTab.value });
home.onchange = () => save({ homepage: home.value });
tabsSel.onchange = () => save({ tabOverflow: tabsSel.value });
accent.onchange = () => save({ accent: accent.value });
$('clear').onclick = async () => {
  if (await api.clearHistory()) flash('History cleared ✓');
};

(async () => {
  const data = await api.get();
  if (!data) return;
  Object.entries(data.engines).forEach(([id, name]) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = name;
    engineSel.appendChild(o);
  });
  data.themes.forEach((t) => {
    const b = document.createElement('button');
    b.dataset.theme = t;
    b.textContent = t[0].toUpperCase() + t.slice(1);
    b.onclick = () => save({ theme: t });
    themesEl.appendChild(b);
  });
  apply(data.settings);
})();
