const api = window.settingsAPI;
const engineSel = document.getElementById('engine');
const home = document.getElementById('homepage');
const accent = document.getElementById('accent');
const themesEl = document.getElementById('themes');
const status = document.getElementById('status');
let statusTimer = null;

function apply(s) {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.style.setProperty('--accent', s.accent);
  engineSel.value = s.searchEngine;
  home.value = s.homepage;
  accent.value = s.accent;
  [...themesEl.children].forEach((b) => b.classList.toggle('active', b.dataset.theme === s.theme));
}

async function save(patch) {
  const s = await api.set(patch);
  if (!s) return;
  apply(s);
  status.textContent = 'Saved ✓';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => (status.textContent = ''), 1500);
}

engineSel.onchange = () => save({ searchEngine: engineSel.value });
home.onchange = () => save({ homepage: home.value });
accent.onchange = () => save({ accent: accent.value });

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
