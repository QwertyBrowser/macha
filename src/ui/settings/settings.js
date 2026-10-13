const api = window.settingsAPI;
const $ = (id) => document.getElementById(id);
const engineSel = $('engine');
const online = $('online');
const newTab = $('newtab');
const home = $('homepage');
const tabsSel = $('taboverflow');
const lastTab = $('lasttab');
const accent = $('accent');
const accentReset = $('accent-reset');
const accentHint = $('accent-hint');
const themesEl = $('themes');
const status = $('status');
let statusTimer = null;

const cap = (s) => s[0].toUpperCase() + s.slice(1);

function themeLabel(id) {
  if (!id.includes('-')) return cap(id);
  const [color, mode] = id.split('-');
  return `${cap(color)} (${mode})`;
}

// turns any CSS color (like hsl(...)) into #rrggbb, which <input type="color"> needs
function toHex(css) {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillStyle = css.trim();
  return ctx.fillStyle;
}

function flash(msg) {
  status.textContent = msg;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ''), 1500);
}

function apply(s) {
  applyTheme(s.theme, s.accentOverride);
  engineSel.value = s.searchEngine;
  online.checked = s.onlineSuggestions;
  newTab.value = s.newTabMode;
  home.value = s.homepage;
  tabsSel.value = s.tabOverflow;
  lastTab.value = s.lastTabClose;
  themesEl.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.id === s.theme));
  accent.value = s.accentOverride || toHex(getComputedStyle(document.documentElement).getPropertyValue('--accent'));
  accentReset.disabled = !s.accentOverride;
  accentHint.textContent = s.accentOverride ? 'Custom accent color' : 'Following the theme';
}

async function save(patch) {
  const s = await api.set(patch);
  if (!s) return;
  apply(s);
  flash('Saved ✓');
}

function buildThemes(themes) {
  const colors = [...new Set(themes.filter((t) => t.includes('-')).map((t) => t.split('-')[0]))];
  const rows = colors.map((c) => [cap(c), [`${c}-dark`, `${c}-light`]]);
  rows.push(['Plain', ['black', 'white']]);
  for (const [name, ids] of rows) {
    const label = document.createElement('span');
    label.className = 'tname';
    label.textContent = name;
    themesEl.appendChild(label);
    for (const id of ids) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.dataset.theme = id; // lets the swatch show its own theme's colors
      b.dataset.id = id;
      b.title = themeLabel(id);
      b.setAttribute('aria-label', themeLabel(id));
      b.onclick = () => save({ theme: id });
      themesEl.appendChild(b);
    }
  }
}

engineSel.onchange = () => save({ searchEngine: engineSel.value });
online.onchange = () => save({ onlineSuggestions: online.checked });
newTab.onchange = () => save({ newTabMode: newTab.value });
home.onchange = () => save({ homepage: home.value });
tabsSel.onchange = () => save({ tabOverflow: tabsSel.value });
lastTab.onchange = () => save({ lastTabClose: lastTab.value });
accent.onchange = () => save({ accentOverride: accent.value });
accentReset.onclick = () => save({ accentOverride: null });
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
  buildThemes(data.themes);
  apply(data.settings);
})();
