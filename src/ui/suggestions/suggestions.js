const list = document.getElementById('list');
const ICONS = { go: '↗', site: '🌐', recent: '🕘', search: '🔍' };

function render(items, selected) {
  list.replaceChildren(
    ...items.map((item, i) => {
      const row = document.createElement('div');
      row.className = 'row' + (i === selected ? ' sel' : '');
      row.dataset.i = String(i);

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = ICONS[item.icon] || '🔍';

      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = item.label;

      const sub = document.createElement('span');
      sub.className = 'sub';
      sub.textContent = item.sub || '';

      row.append(icon, label, sub);
      return row;
    })
  );
}

function highlight(i) {
  [...list.children].forEach((row, n) => row.classList.toggle('sel', n === i));
}

suggestAPI.onItems(({ items, selected, theme, accent }) => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.setProperty('--accent', accent);
  render(items, selected);
});
suggestAPI.onHighlight(highlight);

list.addEventListener('mousedown', (e) => {
  const row = e.target.closest('.row');
  if (!row) return;
  e.preventDefault();
  suggestAPI.choose(Number(row.dataset.i));
});
