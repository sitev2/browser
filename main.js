const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    title: 'Browser',
    webPreferences: {
      // The UI page itself gets no Node access; web pages live in <webview>
      // tags with their own isolated, sandboxed process.
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Block webviews from attaching preload scripts or enabling Node.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (_e, webPreferences) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  });
});
