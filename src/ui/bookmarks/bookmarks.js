const api = window.bookmarksAPI;
const listEl = document.getElementById('list');
const search = document.getElementById('q');
const emptyEl = document.getElementById('empty');
let all = [];
let editingId = null;

function globe() {
  const g = document.createElement('span');
  g.className = 'globe';
  g.textContent = '🌐';
  return g;
}

function iconButton(label, title, onClick) {
  const b = document.createElement('button');
  b.className = 'icon-btn';
  b.textContent = label;
  b.title = title;
  b.onclick = (e) => {
    e.stopPropagation();
    onClick();
  };
  return b;
}

function makeRow(b) {
  const row = document.createElement('div');
  row.className = 'row';

  if (b.favicon) {
    const img = new Image();
    img.className = 'fav';
    img.draggable = false;
    img.onerror = () => img.replaceWith(globe());
    img.src = b.favicon;
    row.appendChild(img);
  } else {
    row.appendChild(globe());
  }

  const text = document.createElement('div');
  text.className = 'text';

  if (editingId === b.id) {
    const input = document.createElement('input');
    input.className = 'edit';
    input.value = b.title;
    input.onclick = (e) => e.stopPropagation();
    const finish = (save) => {
      if (editingId !== b.id) return;
      editingId = null;
      const title = input.value.trim();
      if (save && title && title !== b.title) api.rename(b.id, title); // the update re-renders the list
      else render();
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') finish(true);
      else if (e.key === 'Escape') finish(false);
    };
    input.onblur = () => finish(true);
    text.appendChild(input);
    setTimeout(() => {
      input.focus();
      input.select();
    });
  } else {
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = b.title;
    text.appendChild(title);
  }

  const url = document.createElement('div');
  url.className = 'url';
  url.textContent = b.url;
  text.appendChild(url);

  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(
    iconButton('✎', 'Rename', () => {
      editingId = b.id;
      render();
    }),
    iconButton('✕', 'Delete bookmark', () => api.remove(b.id))
  );

  row.onclick = (e) => {
    if (editingId) return;
    api.open(b.id, e.metaKey || e.ctrlKey);
  };
  row.onauxclick = (e) => {
    if (e.button === 1 && !editingId) api.open(b.id, true);
  };

  row.append(text, actions);
  return row;
}

function render() {
  const q = search.value.trim().toLowerCase();
  const rows = all.filter((b) => !q || b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q));
  emptyEl.hidden = rows.length > 0;
  emptyEl.textContent = all.length
    ? 'No bookmarks match your search.'
    : 'No bookmarks yet. Press ⌘D on any page to add one.';
  listEl.replaceChildren(...rows.map(makeRow));
}

search.oninput = render;
api.onChanged((list) => {
  all = list;
  render();
});
api.onSettings(applyTheme);
api.get().then((data) => {
  if (!data) return;
  applyTheme(data.settings);
  all = data.bookmarks;
  render();
});
