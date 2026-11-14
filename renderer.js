// Browser UI: manages tabs, the address bar and navigation controls.
// Each tab is a <webview> that renders a page in its own isolated process.

const HOME_URL = 'https://www.google.com';
const SEARCH_URL = 'https://www.google.com/search?q=';

const tabsEl = document.getElementById('tabs');
const viewsEl = document.getElementById('views');
const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const homeBtn = document.getElementById('home');
const newTabBtn = document.getElementById('new-tab');

/** @type {{id: number, url: string, title: string, loading: boolean, tabEl: HTMLElement, view: HTMLElement}[]} */
const tabs = [];
let activeId = null;
let nextId = 1;

// Turn whatever the user typed into a URL: an address if it looks like one,
// otherwise a search query.
function toUrl(input) {
  const text = input.trim();
  if (!text) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return text;
  if (/^(about|file):/i.test(text)) return text;
  if (!/\s/.test(text) && /^(localhost(:\d+)?|[\w-]+(\.[\w-]+)+)(\/.*)?$/i.test(text)) {
    return `https://${text}`;
  }
  return SEARCH_URL + encodeURIComponent(text);
}

function getTab(id) {
  return tabs.find((t) => t.id === id);
}

function activeTab() {
  return getTab(activeId);
}

function createTab(url = HOME_URL) {
  const id = nextId++;

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML = '<span class="tab-spinner"></span><span class="tab-title">New Tab</span><button class="tab-close" title="Close tab">&times;</button>';

  const view = document.createElement('webview');
  view.setAttribute('src', url);
  view.setAttribute('allowpopups', '');
  viewsEl.appendChild(view);

  const tab = { id, url, title: 'New Tab', loading: true, tabEl, view };
  tabs.push(tab);
  tabsEl.appendChild(tabEl);

  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close')) {
      closeTab(id);
    } else {
      activateTab(id);
    }
  });

  wireWebview(tab);
  activateTab(id);
  return tab;
}

function wireWebview(tab) {
  const { view } = tab;

  view.addEventListener('did-start-loading', () => {
    tab.loading = true;
    updateTabUi(tab);
    if (tab.id === activeId) updateToolbar();
  });

  view.addEventListener('did-stop-loading', () => {
    tab.loading = false;
    updateTabUi(tab);
    if (tab.id === activeId) updateToolbar();
  });

  const onNavigate = (e) => {
    tab.url = e.url;
    if (tab.id === activeId) updateToolbar();
  };
  view.addEventListener('did-navigate', onNavigate);
  view.addEventListener('did-navigate-in-page', onNavigate);

  view.addEventListener('page-title-updated', (e) => {
    tab.title = e.title || tab.url;
    updateTabUi(tab);
  });
}

function updateTabUi(tab) {
  tab.tabEl.classList.toggle('active', tab.id === activeId);
  tab.tabEl.classList.toggle('loading', tab.loading);
  tab.tabEl.querySelector('.tab-title').textContent = tab.title;
  tab.tabEl.title = tab.title;
}

function activateTab(id) {
  const tab = getTab(id);
  if (!tab) return;
  activeId = id;

  for (const t of tabs) {
    t.view.classList.toggle('active', t.id === id);
    updateTabUi(t);
  }
  updateToolbar();
}

function closeTab(id) {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;

  const [tab] = tabs.splice(index, 1);
  tab.tabEl.remove();
  tab.view.remove();

  if (tabs.length === 0) {
    // Like Chrome, closing the last tab leaves a fresh one open.
    createTab();
    return;
  }

  if (activeId === id) {
    const next = tabs[Math.min(index, tabs.length - 1)];
    activateTab(next.id);
  }
}

function updateToolbar() {
  const tab = activeTab();
  if (!tab) return;

  // webview navigation queries throw until the guest page is attached.
  try {
    backBtn.disabled = !tab.view.canGoBack();
    forwardBtn.disabled = !tab.view.canGoForward();
  } catch {
    backBtn.disabled = true;
    forwardBtn.disabled = true;
  }

  // Don't overwrite the address while the user is typing in it.
  if (document.activeElement !== addressInput) {
    addressInput.value = tab.url;
  }

  reloadBtn.innerHTML = tab.loading ? '&#10005;' : '&#8635;';
  reloadBtn.title = tab.loading ? 'Stop' : 'Reload (Ctrl+R)';
}

// ---- Toolbar and shortcut handlers ----

addressForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = toUrl(addressInput.value);
  const tab = activeTab();
  if (url && tab) {
    tab.url = url;
    tab.view.loadURL(url);
    addressInput.blur();
  }
});

addressInput.addEventListener('focus', () => addressInput.select());

backBtn.addEventListener('click', () => activeTab()?.view.goBack());
forwardBtn.addEventListener('click', () => activeTab()?.view.goForward());
homeBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) tab.view.loadURL(HOME_URL);
});
reloadBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (!tab) return;
  if (tab.loading) tab.view.stop();
  else tab.view.reload();
});
newTabBtn.addEventListener('click', () => {
  createTab();
  addressInput.focus();
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 't') {
    e.preventDefault();
    createTab();
    addressInput.focus();
  } else if (mod && e.key.toLowerCase() === 'w') {
    e.preventDefault();
    if (activeId !== null) closeTab(activeId);
  } else if (mod && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    addressInput.focus();
  } else if (mod && e.key.toLowerCase() === 'r') {
    e.preventDefault();
    reloadBtn.click();
  } else if (e.altKey && e.key === 'ArrowLeft') {
    backBtn.click();
  } else if (e.altKey && e.key === 'ArrowRight') {
    forwardBtn.click();
  } else if (mod && e.key === 'Tab') {
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === activeId);
    const step = e.shiftKey ? -1 : 1;
    activateTab(tabs[(i + step + tabs.length) % tabs.length].id);
  }
});

// Start with one tab on the home page.
createTab(HOME_URL);
