const api = window.browserAPI;
const tabsEl = document.getElementById('tabs');
const address = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');

backBtn.onclick = () => api.back();
forwardBtn.onclick = () => api.forward();
document.getElementById('reload').onclick = () => api.reload();
document.getElementById('newtab').onclick = () => api.newTab();

address.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    api.navigate(address.value);
    address.blur();
  }
});

api.onState((state) => {
  tabsEl.textContent = '';
  state.tabs.forEach((t) => {
    const tab = document.createElement('div');
    tab.className = 'tab' + (t.active ? ' active' : '');
    tab.onclick = () => api.switchTab(t.id);

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
    tabsEl.appendChild(tab);
  });

  backBtn.disabled = !state.canGoBack;
  forwardBtn.disabled = !state.canGoForward;
  if (document.activeElement !== address) address.value = state.url || '';
});

api.onFocusAddress(() => {
  address.focus();
  address.select();
});
