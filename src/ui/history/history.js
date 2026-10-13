const api = window.historyAPI;
const listEl = document.getElementById('list');
const search = document.getElementById('q');
const emptyEl = document.getElementById('empty');
const noteEl = document.getElementById('note');
const clearBtn = document.getElementById('clear');
const LIMIT = 500;
let searchTimer = null;

const startOfDay = (ts) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

function dayLabel(ts) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' })
  });
}

function makeRow(s) {
  const row = document.createElement('div');
  row.className = 'row';

  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = new Date(s.last).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const text = document.createElement('div');
  text.className = 'text';
  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = s.title || s.url;
  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = s.url;
  text.append(title, url);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const del = document.createElement('button');
  del.className = 'icon-btn';
  del.textContent = '✕';
  del.title = 'Remove from history';
  del.onclick = async (e) => {
    e.stopPropagation();
    await api.remove(s.url);
    load();
  };
  actions.appendChild(del);

  row.onclick = (e) => api.open(s.url, e.metaKey || e.ctrlKey);
  row.onauxclick = (e) => {
    if (e.button === 1) api.open(s.url, true);
  };
  row.append(time, text, actions);
  return row;
}

function render(sites) {
  emptyEl.hidden = sites.length > 0;
  emptyEl.textContent = search.value.trim() ? 'No matching history.' : 'No history yet.';
  noteEl.hidden = sites.length < LIMIT;

  const nodes = [];
  let lastLabel = null;
  for (const s of sites) {
    const label = dayLabel(s.last);
    if (label !== lastLabel) {
      const h = document.createElement('h2');
      h.textContent = label;
      nodes.push(h);
      lastLabel = label;
    }
    nodes.push(makeRow(s));
  }
  listEl.replaceChildren(...nodes);
}

async function load() {
  const data = await api.get(search.value);
  if (!data) return;
  applyTheme(data.settings);
  render(data.sites);
}

search.oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 120);
};

let armed = false;
let armTimer = null;
function disarm() {
  armed = false;
  clearTimeout(armTimer);
  clearBtn.classList.remove('armed');
  clearBtn.textContent = 'Clear history and past searches';
}
clearBtn.onclick = async () => {
  if (!armed) {
    armed = true;
    clearBtn.classList.add('armed');
    clearBtn.textContent = 'Click again to confirm';
    armTimer = setTimeout(disarm, 4000);
    return;
  }
  disarm();
  if (await api.clear()) load();
};

api.onSettings(applyTheme);
load();
