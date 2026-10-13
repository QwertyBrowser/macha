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
const downloadsBtn = document.getElementById('downloads');
downloadsBtn.onclick = () => api.openPage('downloads');
api.onDownloadsActive((n) => downloadsBtn.classList.toggle('active', n > 0));

const starBtn = document.getElementById('star');
starBtn.onclick = () => api.toggleBookmark();
document.getElementById('allbookmarks').onclick = () => api.openPage('bookmarks');

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

const ANIM_MS = 180;
const tabEls = new Map(); // tab id -> { el, titleEl, img, favicon }
let firstRender = true;
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

function makeTab(t) {
  const el = document.createElement('div');
  el.className = 'tab';
  el.onclick = () => api.switchTab(t.id);
  el.onauxclick = (e) => {
    if (e.button === 1) api.closeTab(t.id);
  };

  const titleEl = document.createElement('span');
  titleEl.className = 'title';

  const close = document.createElement('button');
  close.className = 'close';
  close.textContent = '×';
  close.onclick = (e) => {
    e.stopPropagation();
    api.closeTab(t.id);
  };

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    api.tabMenu(t.id);
  });

  el.append(titleEl, close);
  return { el, titleEl, img: null, favicon: null };
}

function updateTab(entry, t) {
  const { el, titleEl } = entry;
  el.classList.toggle('active', t.active);
  el.title = t.title;
  if (titleEl.textContent !== t.title) titleEl.textContent = t.title;

  const favicon = t.favicon || null;
  if (entry.favicon !== favicon) {
    entry.favicon = favicon;
    if (entry.img) {
      entry.img.remove();
      entry.img = null;
    }
    if (favicon) {
      const img = new Image();
      img.className = 'fav';
      img.draggable = false;
      img.onerror = () => {
        img.remove();
        if (entry.img === img) entry.img = null;
      };
      img.src = favicon;
      el.insertBefore(img, titleEl);
      entry.img = img;
    }
  }
}

function scrollActiveIntoView() {
  const el = tabsEl.querySelector('.tab.active:not(.leaving)');
  if (el) el.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

api.onState((state) => {
  const ids = new Set(state.tabs.map((t) => t.id));

  // closed tabs stay in place and slide out, then get removed
  for (const [id, entry] of tabEls) {
    if (ids.has(id)) continue;
    tabEls.delete(id);
    const el = entry.el;
    el.style.maxWidth = el.getBoundingClientRect().width + 'px';
    void el.offsetWidth; // commit the starting width so it can animate from here
    el.classList.add('leaving');
    el.style.maxWidth = '0px';
    setTimeout(() => el.remove(), ANIM_MS + 40);
  }

  // new tabs slide in (but not the very first render at launch)
  const animate = !firstRender;
  firstRender = false;
  for (const t of state.tabs) {
    let entry = tabEls.get(t.id);
    if (entry) {
      updateTab(entry, t);
      continue;
    }
    entry = makeTab(t);
    tabEls.set(t.id, entry);
    updateTab(entry, t);
    if (animate) entry.el.classList.add('enter');
    tabsEl.appendChild(entry.el);
    if (animate) {
      void entry.el.offsetWidth; // commit the start state
      entry.el.classList.remove('enter');
    }
  }

  const active = state.tabs.find((t) => t.active);
  const activeId = active ? active.id : null;
  const activeChanged = activeId !== lastActiveId;
  lastActiveId = activeId;
  if (activeChanged || state.tabs.length !== lastTabCount) {
    scrollActiveIntoView();
    setTimeout(scrollActiveIntoView, ANIM_MS + 20); // again once the slide has finished
  }
  lastTabCount = state.tabs.length;

  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;
  starBtn.disabled = !state.canBookmark;
  starBtn.textContent = state.bookmarked ? '★' : '☆';
  starBtn.classList.toggle('on', !!state.bookmarked);
  starBtn.title = state.bookmarked ? 'Remove bookmark' : 'Bookmark this page';

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
  applyTheme(s);
  document.documentElement.dataset.tabs = s.tabOverflow;
  document.documentElement.dataset.bar = s.bookmarksBar ? 'on' : 'off';
});

/* ---------- bookmarks bar ---------- */

const barItems = document.getElementById('baritems');

barItems.addEventListener(
  'wheel',
  (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      barItems.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  },
  { passive: false }
);

api.onBookmarks((list) => {
  if (!list.length) {
    const hint = document.createElement('span');
    hint.className = 'barhint';
    hint.textContent = 'Press ⌘D to bookmark a page';
    barItems.replaceChildren(hint);
    return;
  }
  barItems.replaceChildren(
    ...list.map((b) => {
      const el = document.createElement('button');
      el.className = 'bm';
      el.title = b.title + '\n' + b.url;
      if (b.favicon) {
        const img = new Image();
        img.className = 'fav';
        img.draggable = false;
        img.onerror = () => img.remove();
        img.src = b.favicon;
        el.appendChild(img);
      }
      const label = document.createElement('span');
      label.textContent = b.title;
      el.appendChild(label);
      el.onclick = (e) => api.openBookmark(b.id, e.metaKey || e.ctrlKey);
      el.onauxclick = (e) => {
        if (e.button === 1) api.openBookmark(b.id, true);
      };
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        api.bookmarkMenu(b.id);
      });
      return el;
    })
  );
});

/* ---------- find in page ---------- */

const findInput = document.getElementById('findinput');
const findCount = document.getElementById('findcount');
const runFind = (forward, next) => api.find(findInput.value, forward, next);

findInput.addEventListener('input', () => {
  if (!findInput.value) findCount.textContent = '';
  runFind(true, false);
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    runFind(!e.shiftKey, true);
  } else if (e.key === 'Escape') {
    api.closeFind();
  }
});
document.getElementById('findprev').onclick = () => runFind(false, true);
document.getElementById('findnext').onclick = () => runFind(true, true);
document.getElementById('findclose').onclick = () => api.closeFind();

api.onFindOpen(() => {
  document.documentElement.dataset.find = 'on';
  findInput.focus();
  findInput.select();
  if (findInput.value) runFind(true, false);
});
api.onFindClose(() => {
  document.documentElement.dataset.find = 'off';
  findCount.textContent = '';
});
api.onFindResult((r) => {
  findCount.textContent = !findInput.value ? '' : r.total ? `${r.active} of ${r.total}` : 'No results';
});
