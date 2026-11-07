const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');

// Launch local Express backend if running packaged
let serverInstance = null;
try {
  require('../server/server.js');
} catch (err) {
  console.log('[Electron] Server already running or launched separately');
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: "SMN SWEET'S — Billing & PDF Invoice Management System",
    icon: path.join(__dirname, '../assets/smn-logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#FFFDF9',
    autoHideMenuBar: false
  });

  // App menu
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Bill (F1)', accelerator: 'F1', click: () => mainWindow.webContents.send('shortcut', 'F1') },
        { label: 'Search Product (F2)', accelerator: 'F2', click: () => mainWindow.webContents.send('shortcut', 'F2') },
        { label: 'Register Customer (F7)', accelerator: 'F7', click: () => mainWindow.webContents.send('shortcut', 'F7') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About SMN SWEET\'S Billing',
          click: () => {
            shell.openExternal('http://127.0.0.1:4000');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Load URL: in dev, load Vite port 5173; else load express port 4000
  const isDev = process.env.NODE_ENV === 'development';
  const startUrl = isDev ? 'http://127.0.0.1:5173' : 'http://127.0.0.1:4000';

  mainWindow.loadURL(startUrl).catch(() => {
    // Retry loading if server takes a moment
    setTimeout(() => {
      mainWindow.loadURL(startUrl);
    }, 1500);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('print-invoice', async (event, options) => {
  if (!mainWindow) return { success: false, error: 'Window not available' };
  return new Promise((resolve) => {
    mainWindow.webContents.print({ silent: false, printBackground: true, ...options }, (success, failureReason) => {
      resolve({ success, error: failureReason });
    });
  });
});

ipcMain.handle('open-external', async (event, url) => {
  shell.openExternal(url);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

