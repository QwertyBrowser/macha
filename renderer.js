const api = window.browserAPI;
const tabsEl = document.getElementById('tabs');
const address = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');

backBtn.onclick = () => api.back();
forwardBtn.onclick = () => api.forward();
document.getElementById('reload').onclick = () => api.reload();
document.getElementById('newtab').onclick = () => api.newTab();
document.getElementById('settings').onclick = () => api.openSettings();

/* ---------- suggestions ---------- */

let seq = 0;
let items = [];
let itemsFor = '';
let selected = 0;
let open = false;
let currentURL = '';
let debounceTimer = null;
let blurTimer = null;

function addressRect() {
  const r = address.getBoundingClientRect();
  return { x: Math.round(r.left), y: Math.round(r.bottom), width: Math.round(r.width) };
}

function closeSuggestions() {
  clearTimeout(debounceTimer);
  seq++;
  open = false;
  items = [];
  selected = 0;
  api.hideSuggestions(seq);
}

function requestSuggestions() {
  if (!address.value.trim()) return closeSuggestions();
  api.suggest(address.value, addressRect(), ++seq);
}

address.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(requestSuggestions, 60);
});
let selectOnMouseUp = false;
let suppressSelect = false;
let regained = false;

window.addEventListener('blur', () => {
  regained = true;
});

address.addEventListener('mousedown', () => {
  regained = false;
  // first click (or first click after the window was inactive) selects everything;
  // clicking again while already focused just places the caret
  selectOnMouseUp = document.activeElement !== address || !document.hasFocus();
});

address.addEventListener('mouseup', (e) => {
  if (selectOnMouseUp) {
    e.preventDefault();
    address.select();
    selectOnMouseUp = false;
  }
});

address.addEventListener('focus', () => {
  clearTimeout(blurTimer);
  if (selectOnMouseUp || suppressSelect) return;
  if (regained) {
    // the window just got focus back, so keep whatever you were typing
    regained = false;
    return;
  }
  address.select(); // keyboard focus, e.g. Tab
});
address.addEventListener('blur', () => {
  blurTimer = setTimeout(closeSuggestions, 150);
});

address.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!open || !items.length) return;
    e.preventDefault();
    selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    api.highlightSuggestion(selected);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const text = address.value;
    if (open && selected > 0 && itemsFor === text) api.chooseSuggestion(selected);
    else if (text.trim()) api.navigate(text);
    closeSuggestions();
    address.blur();
  } else if (e.key === 'Escape') {
    if (open) {
      closeSuggestions();
    } else {
      address.value = currentURL;
      address.blur();
    }
  }
});

api.onSuggestItems((msg) => {
  if (msg.seq !== seq) return;
  items = msg.items;
  itemsFor = msg.text;
  selected = 0;
  open = items.length > 0;
});

/* ---------- tabs + state ---------- */

let lastActiveId = null;
let lastTabCount = 0;

tabsEl.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      tabsEl.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false }
);

api.onState((state) => {
  const prevScroll = tabsEl.scrollLeft;
  const els = state.tabs.map((t) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (t.active ? ' active' : '');
    tab.title = t.title;
    tab.onclick = () => api.switchTab(t.id);
    tab.onauxclick = (e) => {
      if (e.button === 1) api.closeTab(t.id);
    };

    if (t.favicon) {
      const img = new Image();
      img.className = 'fav';
      img.draggable = false;
      img.onerror = () => img.remove();
      img.src = t.favicon;
      tab.appendChild(img);
    }

    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = t.title;

    const close = document.createElement('button');
    close.className = 'close';
    close.textContent = '×';
    close.onclick = (e) => {
      e.stopPropagation();
      api.closeTab(t.id);
    };

    tab.append(title, close);
    return tab;
  });
  tabsEl.replaceChildren(...els);
  tabsEl.scrollLeft = prevScroll;

  const active = state.tabs.find((t) => t.active);
  const activeId = active ? active.id : null;
  const activeChanged = activeId !== lastActiveId;
  lastActiveId = activeId;
  if (activeChanged || state.tabs.length !== lastTabCount) {
    const el = tabsEl.querySelector('.tab.active');
    if (el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }
  lastTabCount = state.tabs.length;

  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;

  currentURL = state.url || '';
  const editing = document.activeElement === address && document.hasFocus();
  if (activeChanged) closeSuggestions();
  if (activeChanged || !editing) address.value = currentURL;
});

api.onFocusAddress((opts) => {
  if (opts.clear) address.value = '';
  suppressSelect = opts.select === false;
  address.focus();
  suppressSelect = false;
  if (opts.select !== false) address.select();
});

api.onBlurAddress(() => address.blur());

api.onSettings((s) => {
  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.tabs = s.tabOverflow;
  document.documentElement.style.setProperty('--accent', s.accent);
});
