const { app, BrowserWindow, ipcMain, dialog, Tray, Menu: ElectronMenu, nativeImage, globalShortcut, screen, clipboard } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { execFile } = require('child_process');
const Store = require('electron-store');
const { menu } = require("./menu");

const preferences = new Store({ name: 'preferences' });

let mainWindow;
let tray = null;
let searchWindow = null;
let quickAddWindow = null;
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
function getPanelPosition(panelWidth = 600, panelHeight = 500) {
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.workArea;
    return {
        x: Math.round(x + (width - panelWidth) / 2),
        y: Math.round(y + (height - panelHeight) / 2)
    };
}

function createSearchWindow() {
    const pos = getPanelPosition();
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
        const pos = getPanelPosition();
        searchWindow.setPosition(pos.x, pos.y);
        searchWindow.show();
        searchWindow.focus();
        searchWindow.webContents.send('search-panel-shown');
    }
}

// ──────────────────────────────────────
// Quick Add Panel Window
// ──────────────────────────────────────
function createQuickAddWindow() {
    const pos = getPanelPosition(500, 460);
    const theme = preferences.get('appTheme') || 'light';
    const bgColor = theme === 'dark' ? '#21252B' : '#F8F8FA';

    quickAddWindow = new BrowserWindow({
        width: 500,
        height: 460,
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
        ? 'http://localhost:3000?view=quickadd'
        : `file://${path.join(__dirname, '../build/index.html')}?view=quickadd`;

    quickAddWindow.loadURL(baseUrl);

    quickAddWindow.on('blur', () => {
        if (quickAddWindow && quickAddWindow.isVisible()) {
            quickAddWindow.hide();
        }
    });

    quickAddWindow.on('closed', () => {
        quickAddWindow = null;
    });
}

function captureSelectedText() {
    return new Promise((resolve) => {
        const prevClipboard = clipboard.readText();

        let copyCmd, copyArgs;
        if (process.platform === 'win32') {
            copyCmd = 'powershell';
            copyArgs = ['-NoProfile', '-NonInteractive', '-Command',
                'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")'];
        } else if (process.platform === 'darwin') {
            copyCmd = 'osascript';
            copyArgs = ['-e', 'tell application "System Events" to keystroke "c" using command down'];
        } else {
            copyCmd = 'xdotool';
            copyArgs = ['key', 'ctrl+c'];
        }

        execFile(copyCmd, copyArgs, () => {
            setTimeout(() => {
                const captured = clipboard.readText();
                clipboard.writeText(prevClipboard);
                resolve(captured !== prevClipboard ? captured : '');
            }, 100);
        });
    });
}

async function toggleQuickAddPanel() {
    const selectedText = await captureSelectedText();

    if (!quickAddWindow) {
        createQuickAddWindow();
        quickAddWindow.once('ready-to-show', () => {
            quickAddWindow.show();
            quickAddWindow.focus();
            quickAddWindow.webContents.send('quick-add-shown', {selectedText});
        });
    } else if (quickAddWindow.isVisible()) {
        quickAddWindow.hide();
    } else {
        const pos = getPanelPosition(500, 460);
        quickAddWindow.setPosition(pos.x, pos.y);
        quickAddWindow.show();
        quickAddWindow.focus();
        quickAddWindow.webContents.send('quick-add-shown', {selectedText});
    }
}

// ──────────────────────────────────────
// Global Hotkey
// ──────────────────────────────────────
function registerGlobalHotkeys() {
    globalShortcut.unregisterAll();

    const searchHotkey = preferences.get('globalHotkey') || 'Alt+C';
    if (searchHotkey) {
        const ok = globalShortcut.register(searchHotkey, toggleSearchPanel);
        if (!ok) console.error('Failed to register search hotkey:', searchHotkey);
    }

    const addHotkey = preferences.get('quickAddHotkey') || 'Alt+Z';
    if (addHotkey) {
        const ok = globalShortcut.register(addHotkey, toggleQuickAddPanel);
        if (!ok) console.error('Failed to register quick-add hotkey:', addHotkey);
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
    registerGlobalHotkeys();
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

// Paste to foreground app
ipcMain.handle('paste-to-foreground', () => {
    if (searchWindow) searchWindow.hide();

    setTimeout(() => {
        if (process.platform === 'win32') {
            execFile('powershell', [
                '-NoProfile', '-NonInteractive', '-Command',
                'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")'
            ]);
        } else if (process.platform === 'darwin') {
            execFile('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
        } else {
            execFile('xdotool', ['key', 'ctrl+v']);
        }
    }, 150);
});

// Quick Add panel
ipcMain.handle('hide-quick-add-panel', () => {
    if (quickAddWindow) quickAddWindow.hide();
});

// Settings — re-register all hotkeys when any hotkey changes
ipcMain.handle('update-global-hotkeys', () => {
    registerGlobalHotkeys();
});
