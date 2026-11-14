# browser

A small Chrome-style web browser built with [Electron](https://www.electronjs.org/).

## Features

- Multiple tabs (new, close, switch, Ctrl+Tab / Ctrl+Shift+Tab)
- Address bar: type a URL, or a search that goes to Google
- Back, forward, reload / stop, and home buttons
- Keyboard shortcuts: Ctrl+T new tab, Ctrl+W close tab, Ctrl+L focus address bar, Ctrl+R reload, Alt+Left / Alt+Right back and forward
- Each page renders in an isolated `<webview>` with Node access disabled

## Run it

```sh
npm install
npm start
```

Requires Node.js 18 or newer.

## Layout

- `main.js` starts the Electron window and locks down webviews
- `index.html` and `styles.css` draw the tab strip and toolbar
- `renderer.js` handles tabs, navigation and the address bar

## Limitations

This is a learning-scale browser. It has no bookmarks, history, downloads, extensions, or password storage, and it uses Electron's Chromium engine rather than its own.
