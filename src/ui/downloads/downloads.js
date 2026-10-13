const api = window.downloadsAPI;
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const clearBtn = document.getElementById('clear');

function fmt(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return (n / 1024 ** i).toFixed(i ? 1 : 0) + ' ' + units[i];
}

function host(url) {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function statusText(d) {
  if (d.state === 'completed') return fmt(d.received || d.total);
  if (d.state === 'cancelled') return 'Cancelled';
  if (d.state === 'interrupted') return 'Failed';
  const sofar = d.total > 0 ? `${fmt(d.received)} of ${fmt(d.total)}` : fmt(d.received);
  return d.state === 'paused' ? `Paused · ${sofar}` : sofar;
}

function button(label, fn) {
  const b = document.createElement('button');
  b.className = 'small';
  b.textContent = label;
  b.onclick = fn;
  return b;
}

function makeRow(d) {
  const row = document.createElement('div');
  row.className = 'row';

  const text = document.createElement('div');
  text.className = 'text';
  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = d.name;
  const sub = document.createElement('div');
  sub.className = 'sub';
  sub.textContent = [statusText(d), host(d.url)].filter(Boolean).join(' · ');
  text.append(name, sub);

  const running = d.state === 'progressing' || d.state === 'paused';
  if (running && d.total > 0) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const fill = document.createElement('div');
    fill.style.width = Math.min(100, (d.received / d.total) * 100) + '%';
    bar.appendChild(fill);
    text.appendChild(bar);
  }

  const actions = document.createElement('div');
  actions.className = 'actions';
  if (d.state === 'completed') {
    actions.append(button('Open', () => api.open(d.id)), button('Show in folder', () => api.show(d.id)));
  } else if (running) {
    actions.append(
      d.state === 'paused' ? button('Resume', () => api.resume(d.id)) : button('Pause', () => api.pause(d.id)),
      button('Cancel', () => api.cancel(d.id))
    );
  }
  if (!running) actions.append(button('✕', () => api.remove(d.id)));

  row.append(text, actions);
  return row;
}

function render(list) {
  emptyEl.hidden = list.length > 0;
  clearBtn.hidden = !list.some((d) => d.state !== 'progressing' && d.state !== 'paused');
  listEl.replaceChildren(...[...list].reverse().map(makeRow)); // newest first
}

clearBtn.onclick = () => api.clear();

api.onChanged(render);
api.onSettings(applyTheme);

(async () => {
  const data = await api.get();
  if (!data) return;
  applyTheme(data.settings);
  render(data.downloads);
})();
