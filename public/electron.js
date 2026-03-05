const { app, BrowserWindow, ipcMain, dialog, Tray, Menu: ElectronMenu, nativeImage, globalShortcut, screen } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const Store = require('electron-store');
const { menu } = require("./menu");

const preferences = new Store({ name: 'preferences' });

let mainWindow;
let tray = null;
let searchWindow = null;
const isWindows = process.platform === "win32";

// ──────────────────────────────────────
// Main Window
// ──────────────────────────────────────
function createWindow() {
    const theme = preferences.get('appTheme') || 'light';
    const bgColor = theme === 'dark' ? '#21252B' : '#F8F8FA';

    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        icon: `${__dirname}/images/logo/snip_command.png`,
        titleBarStyle: "hidden",
        backgroundColor: bgColor,
        frame: !isWindows,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

    mainWindow.maximize();
    mainWindow.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, '../build/index.html')}`).then(r => r);

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('close', (event) => {
        if (!app.isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ──────────────────────────────────────
// System Tray
// ──────────────────────────────────────
function createTray() {
    const iconPath = path.join(__dirname, 'images', 'logo', 'snip_command.png');
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    tray = new Tray(icon);

    const contextMenu = ElectronMenu.buildFromTemplate([
        {
            label: 'Show Window',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                } else {
                    createWindow();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                app.isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('SnipCommand');
    tray.setContextMenu(contextMenu);

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide();
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        } else {
            createWindow();
        }
    });
}

// ──────────────────────────────────────
// Search Panel Window
// ──────────────────────────────────────
function getSearchPanelPosition() {
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.workArea;
    return {
        x: Math.round(x + (width - 600) / 2),
        y: Math.round(y + (height - 500) / 2)
    };
}

function createSearchWindow() {
    const pos = getSearchPanelPosition();
    const theme = preferences.get('appTheme') || 'light';
    const bgColor = theme === 'dark' ? '#21252B' : '#F8F8FA';

    searchWindow = new BrowserWindow({
        width: 600,
        height: 500,
        x: pos.x,
        y: pos.y,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        show: false,
        icon: path.join(__dirname, 'images', 'logo', 'snip_command.png'),
        backgroundColor: bgColor,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
            webSecurity: true,
            allowRunningInsecureContent: false
        }
    });

    const baseUrl = isDev
        ? 'http://localhost:3000?view=search'
        : `file://${path.join(__dirname, '../build/index.html')}?view=search`;

    searchWindow.loadURL(baseUrl);

    searchWindow.on('blur', () => {
        if (searchWindow && searchWindow.isVisible()) {
            searchWindow.hide();
        }
    });

    searchWindow.on('closed', () => {
        searchWindow = null;
    });
}

function toggleSearchPanel() {
    if (!searchWindow) {
        createSearchWindow();
        searchWindow.once('ready-to-show', () => {
            searchWindow.show();
            searchWindow.focus();
        });
    } else if (searchWindow.isVisible()) {
        searchWindow.hide();
    } else {
        const pos = getSearchPanelPosition();
        searchWindow.setPosition(pos.x, pos.y);
        searchWindow.show();
        searchWindow.focus();
        searchWindow.webContents.send('search-panel-shown');
    }
}

// ──────────────────────────────────────
// Global Hotkey
// ──────────────────────────────────────
function registerGlobalHotkey(hotkey) {
    globalShortcut.unregisterAll();
    if (hotkey) {
        const registered = globalShortcut.register(hotkey, toggleSearchPanel);
        if (!registered) {
            console.error('Failed to register global shortcut:', hotkey);
        }
    }
}

// ──────────────────────────────────────
// App Lifecycle
// ──────────────────────────────────────
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

app.on("ready", () => {
    createWindow();
    createTray();

    const hotkey = preferences.get('globalHotkey') || 'Alt+C';
    registerGlobalHotkey(hotkey);
});

app.on('before-quit', () => {
    app.isQuitting = true;
});

app.on('window-all-closed', () => {
    // App stays in tray — do nothing
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    } else {
        mainWindow.show();
    }
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// ──────────────────────────────────────
// IPC Handlers
// ──────────────────────────────────────

// Window management
ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-minimize', () => {
    if (mainWindow && mainWindow.minimizable) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// Dialogs
ipcMain.handle('show-open-dialog', async (e, options) => {
    if (!mainWindow) return undefined;
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? undefined : result.filePaths;
});

// Menu
ipcMain.handle('display-app-menu', (e, args) => {
    if (isWindows && mainWindow) menu.popup({ window: mainWindow, x: args.x, y: args.y });
});

// Search panel
ipcMain.handle('hide-search-panel', () => {
    if (searchWindow) searchWindow.hide();
});

// Settings
ipcMain.handle('update-global-hotkey', (e, newHotkey) => {
    registerGlobalHotkey(newHotkey);
});
