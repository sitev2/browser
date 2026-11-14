// Web browser UI. Each tab is an <iframe>, with its own history stack kept here
// (cross-origin frames don't expose their history). Sites that refuse to be
// framed show the "won't display" notice, with a link to open them in a new tab.

const HOME_URL = 'https://www.google.com';
const SEARCH_URL = 'https://www.google.com/search?q=';

const tabsEl = document.getElementById('tabs');
const viewsEl = document.getElementById('views');
const blockedEl = document.getElementById('blocked');
const addressForm = document.getElementById('address-form');
const addressInput = document.getElementById('address');
const backBtn = document.getElementById('back');
const forwardBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const homeBtn = document.getElementById('home');
const newTabBtn = document.getElementById('new-tab');
const openExternalLink = document.getElementById('open-external');

/**
 * @typedef {{id: number, history: string[], index: number, title: string,
 *   tabEl: HTMLElement, frame: HTMLIFrameElement, loadTimer: number|null}} Tab
 */
/** @type {Tab[]} */
const tabs = [];
let activeId = null;
let nextId = 1;

// Turn typed text into a URL: an address if it looks like one, otherwise a search.
function toUrl(input) {
  const text = input.trim();
  if (!text) return null;
  if (/^https?:\/\//i.test(text)) return text;
  if (!/\s/.test(text) && /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(text)) {
    return `https://${text}`;
  }
  return SEARCH_URL + encodeURIComponent(text);
}

// Only allow web links; anything else (javascript:, data:, file:) is refused.
function isSafeWebUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function getTab(id) {
  return tabs.find((t) => t.id === id);
}

function activeTab() {
  return getTab(activeId);
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function createTab(url = HOME_URL) {
  const id = nextId++;

  const tabEl = document.createElement('div');
  tabEl.className = 'tab';
  tabEl.innerHTML = '<span class="tab-title"></span><button class="tab-close" title="Close tab">&times;</button>';

  const frame = document.createElement('iframe');
  frame.className = 'page';
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  // Allow scripts and forms so pages work, but keep the frame from navigating
  // this top-level page.
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox');
  viewsEl.appendChild(frame);

  const tab = {
    id,
    history: [url],
    index: 0,
    title: hostOf(url),
    tabEl,
    frame,
    loadTimer: null,
  };
  tabs.push(tab);
  tabsEl.appendChild(tabEl);

  tabEl.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close')) closeTab(id);
    else activateTab(id);
  });

  frame.addEventListener('load', () => onFrameLoad(tab));

  loadInTab(tab, url);
  activateTab(id);
  return tab;
}

function loadInTab(tab, url) {
  if (!isSafeWebUrl(url)) {
    tab.title = 'Blocked address';
    updateTabUi(tab);
    return;
  }
  // Most sites that refuse embedding still fire a load event (showing the
  // browser's own error page), so this timer is only a backstop for frames
  // that never finish loading. "Open in new tab" is the reliable fallback.
  clearTimeout(tab.loadTimer);
  tab.loadTimer = setTimeout(() => {
    if (tab.id === activeId) showBlocked(true);
  }, 8000);
  tab.frame.src = url;
  if (tab.id === activeId) {
    showBlocked(false);
    updateToolbar();
  }
}

function onFrameLoad(tab) {
  clearTimeout(tab.loadTimer);
  if (tab.id === activeId) showBlocked(false);

  // Try to read the page title. This works only for same-origin pages;
  // for cross-origin pages we keep the hostname.
  try {
    const title = tab.frame.contentDocument?.title;
    if (title) tab.title = title;
  } catch {
    // Cross-origin: keep the current title.
  }
  updateTabUi(tab);
}

function showBlocked(show) {
  blockedEl.hidden = !show;
  for (const t of tabs) {
    t.frame.classList.toggle('active', !show && t.id === activeId);
  }
}

function updateTabUi(tab) {
  tab.tabEl.classList.toggle('active', tab.id === activeId);
  const title = tab.title || hostOf(tab.history[tab.index]);
  tab.tabEl.querySelector('.tab-title').textContent = title;
  tab.tabEl.title = title;
}

function activateTab(id) {
  const tab = getTab(id);
  if (!tab) return;
  activeId = id;

  for (const t of tabs) {
    t.frame.classList.toggle('active', t.id === id);
    updateTabUi(t);
  }
  showBlocked(false);
  updateToolbar();
}

function closeTab(id) {
  const index = tabs.findIndex((t) => t.id === id);
  if (index === -1) return;

  const [tab] = tabs.splice(index, 1);
  clearTimeout(tab.loadTimer);
  tab.tabEl.remove();
  tab.frame.remove();

  if (tabs.length === 0) {
    createTab();
    return;
  }
  if (activeId === id) {
    activateTab(tabs[Math.min(index, tabs.length - 1)].id);
  }
}

// Navigate the active tab to a new URL, dropping any forward history.
function navigate(url) {
  const tab = activeTab();
  if (!tab) return;
  tab.history = tab.history.slice(0, tab.index + 1);
  tab.history.push(url);
  tab.index = tab.history.length - 1;
  loadInTab(tab, url);
}

function goBack() {
  const tab = activeTab();
  if (!tab || tab.index === 0) return;
  tab.index -= 1;
  loadInTab(tab, tab.history[tab.index]);
}

function goForward() {
  const tab = activeTab();
  if (!tab || tab.index >= tab.history.length - 1) return;
  tab.index += 1;
  loadInTab(tab, tab.history[tab.index]);
}

function updateToolbar() {
  const tab = activeTab();
  if (!tab) return;

  backBtn.disabled = tab.index === 0;
  forwardBtn.disabled = tab.index >= tab.history.length - 1;

  const url = tab.history[tab.index];
  if (document.activeElement !== addressInput) {
    addressInput.value = url;
  }
  openExternalLink.href = isSafeWebUrl(url) ? url : '#';
}

// ---- Toolbar and shortcut handlers ----

addressForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const url = toUrl(addressInput.value);
  if (url) navigate(url);
  addressInput.blur();
});

addressInput.addEventListener('focus', () => addressInput.select());

backBtn.addEventListener('click', goBack);
forwardBtn.addEventListener('click', goForward);
homeBtn.addEventListener('click', () => navigate(HOME_URL));
reloadBtn.addEventListener('click', () => {
  const tab = activeTab();
  if (tab) loadInTab(tab, tab.history[tab.index]);
});
newTabBtn.addEventListener('click', () => {
  createTab();
  addressInput.focus();
});

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 't') {
    e.preventDefault();
    createTab();
    addressInput.focus();
  } else if (mod && key === 'w') {
    e.preventDefault();
    if (activeId !== null) closeTab(activeId);
  } else if (mod && key === 'l') {
    e.preventDefault();
    addressInput.focus();
  } else if (mod && key === 'r') {
    e.preventDefault();
    reloadBtn.click();
  } else if (e.altKey && e.key === 'ArrowLeft') {
    goBack();
  } else if (e.altKey && e.key === 'ArrowRight') {
    goForward();
  } else if (mod && e.key === 'Tab') {
    e.preventDefault();
    const i = tabs.findIndex((t) => t.id === activeId);
    const step = e.shiftKey ? -1 : 1;
    activateTab(tabs[(i + step + tabs.length) % tabs.length].id);
  }
});

// Start with one tab on the home page.
createTab(HOME_URL);
