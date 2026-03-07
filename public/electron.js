const { app, BrowserWindow, ipcMain, dialog, Tray, Menu: ElectronMenu, nativeImage, globalShortcut, screen, clipboard } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { execFile, execFileSync } = require('child_process');
const fs = require('fs');
const Store = require('electron-store');
const { menu } = require("./menu");

const preferences = new Store({ name: 'preferences' });

let mainWindow;
let tray = null;
let searchWindow = null;
let quickAddWindow = null;
let lastFocusTarget = null;
let inputHelperPath = null;
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
function getSearchPanelHeight() {
    const count = preferences.get('recentCount') || 10;
    const headerHeight = 52;
    const itemHeight = 54;
    const minHeight = 200;
    const maxHeight = 600;
    return Math.max(minHeight, Math.min(maxHeight, headerHeight + count * itemHeight));
}

function getPanelPosition(panelWidth = 600, panelHeight = 500, position) {
    const cursorPoint = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);
    const { x, y, width, height } = display.workArea;
    const margin = 20;

    switch (position || preferences.get('panelPosition') || 'center') {
        case 'top-left':
            return { x: x + margin, y: y + margin };
        case 'top-center':
            return { x: Math.round(x + (width - panelWidth) / 2), y: y + margin };
        case 'top-right':
            return { x: Math.round(x + width - panelWidth - margin), y: y + margin };
        case 'bottom-left':
            return { x: x + margin, y: Math.round(y + height - panelHeight - margin) };
        case 'bottom-center':
            return { x: Math.round(x + (width - panelWidth) / 2), y: Math.round(y + height - panelHeight - margin) };
        case 'bottom-right':
            return { x: Math.round(x + width - panelWidth - margin), y: Math.round(y + height - panelHeight - margin) };
        case 'center':
        default:
            return { x: Math.round(x + (width - panelWidth) / 2), y: Math.round(y + (height - panelHeight) / 2) };
    }
}

function createSearchWindow() {
    const panelHeight = getSearchPanelHeight();
    const pos = getPanelPosition(600, panelHeight);
    const theme = preferences.get('appTheme') || 'light';
    const bgColor = theme === 'dark' ? '#21252B' : '#F8F8FA';

    searchWindow = new BrowserWindow({
        width: 600,
        height: panelHeight,
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
        captureForegroundWindow();
        createSearchWindow();
        searchWindow.once('ready-to-show', () => {
            searchWindow.show();
            searchWindow.focus();
        });
    } else if (searchWindow.isVisible()) {
        searchWindow.hide();
    } else {
        captureForegroundWindow();
        const panelHeight = getSearchPanelHeight();
        const pos = getPanelPosition(600, panelHeight);
        searchWindow.setSize(600, panelHeight);
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
            if (inputHelperPath) {
                copyCmd = inputHelperPath;
                copyArgs = ['copy'];
            } else {
                resolve('');
                return;
            }
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
            }, 150);
        });
    });
}

let pendingQuickAddText = '';

async function toggleQuickAddPanel() {
    pendingQuickAddText = await captureSelectedText();

    if (!quickAddWindow) {
        createQuickAddWindow();
        quickAddWindow.once('ready-to-show', () => {
            quickAddWindow.show();
            quickAddWindow.focus();
        });
    } else if (quickAddWindow.isVisible()) {
        quickAddWindow.hide();
    } else {
        const pos = getPanelPosition(500, 460);
        quickAddWindow.setPosition(pos.x, pos.y);
        quickAddWindow.show();
        quickAddWindow.focus();
        quickAddWindow.webContents.send('quick-add-shown', {selectedText: pendingQuickAddText});
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
// Foreground Window Tracking & Paste
// ──────────────────────────────────────
function captureForegroundWindow() {
    try {
        if (process.platform === 'win32') {
            if (inputHelperPath) {
                const result = execFileSync(inputHelperPath, ['getfg'],
                    { timeout: 3000 }).toString().trim();
                if (result) lastFocusTarget = result;
            }
        } else if (process.platform === 'darwin') {
            const result = execFileSync('osascript', ['-e',
                'tell application "System Events" to get name of first process whose frontmost is true'
            ], { timeout: 3000 }).toString().trim();
            if (result) lastFocusTarget = result;
        } else {
            const result = execFileSync('xdotool', ['getactivewindow'],
                { timeout: 3000 }).toString().trim();
            if (result) lastFocusTarget = result;
        }
    } catch (e) {
        console.error('Failed to capture foreground window:', e.message);
    }
}

function initInputHelper() {
    if (process.platform === 'win32') {
        const exePath = path.join(app.getPath('temp'), 'snipcommand-input.exe');
        const srcPath = path.join(app.getPath('temp'), 'snipcommand-input.cs');

        // If exe already exists and is recent (same session), skip compile
        if (fs.existsSync(exePath)) {
            inputHelperPath = exePath;
            return;
        }

        const csSource = `using System;
using System.Runtime.InteropServices;
using System.Threading;
class S {
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern void keybd_event(byte k, byte s, uint f, UIntPtr x);
    const uint KEYEVENTF_KEYUP = 2;
    static void PressKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(5);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(5);
    }
    static void SendCtrl(byte key) {
        keybd_event(0x11, 0, 0, UIntPtr.Zero);
        Thread.Sleep(5);
        keybd_event(key, 0, 0, UIntPtr.Zero);
        Thread.Sleep(5);
        keybd_event(key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(5);
        keybd_event(0x11, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(5);
    }
    static void Main(string[] a) {
        if (a.Length == 0) return;
        if (a[0] == "getfg") {
            Console.Write(GetForegroundWindow().ToInt64());
        } else if (a[0] == "paste" && a.Length > 1) {
            IntPtr h = new IntPtr(long.Parse(a[1]));
            // Press and release Alt to allow SetForegroundWindow
            keybd_event(0x12, 0, 0, UIntPtr.Zero);
            keybd_event(0x12, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(30);
            SetForegroundWindow(h);
            Thread.Sleep(80);
            SendCtrl(0x56); // Ctrl+V
        } else if (a[0] == "copy") {
            SendCtrl(0x43); // Ctrl+C
        }
    }
}`;

        fs.writeFileSync(srcPath, csSource);

        // Find csc.exe from .NET Framework
        const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
        try {
            execFileSync(cscPath, ['/nologo', '/optimize', '/out:' + exePath, srcPath],
                { timeout: 15000 });
            inputHelperPath = exePath;
        } catch (e) {
            // Try 32-bit .NET Framework path
            const csc32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
            try {
                execFileSync(csc32, ['/nologo', '/optimize', '/out:' + exePath, srcPath],
                    { timeout: 15000 });
                inputHelperPath = exePath;
            } catch (e2) {
                console.error('Failed to compile input helper:', e2.message);
            }
        }
    }
}

function pasteToForeground() {
    if (searchWindow) searchWindow.hide();

    const target = lastFocusTarget;

    if (process.platform === 'win32') {
        if (target && inputHelperPath) {
            const safeHwnd = String(target).replace(/[^0-9]/g, '');
            if (safeHwnd) {
                execFile(inputHelperPath, ['paste', safeHwnd]);
                return;
            }
        }
    } else if (process.platform === 'darwin') {
        if (target) {
            const appName = target.replace(/"/g, '\\"');
            execFile('osascript', [
                '-e', `tell application "${appName}" to activate`,
                '-e', 'delay 0.05',
                '-e', 'tell application "System Events" to keystroke "v" using command down'
            ]);
        } else {
            setTimeout(() => {
                execFile('osascript', ['-e', 'tell application "System Events" to keystroke "v" using command down']);
            }, 150);
        }
    } else {
        if (target) {
            const wid = String(target).replace(/[^0-9]/g, '');
            if (wid) {
                execFile('xdotool', ['windowactivate', '--sync', wid, 'key', 'ctrl+v']);
                return;
            }
        }
        setTimeout(() => {
            execFile('xdotool', ['key', 'ctrl+v']);
        }, 150);
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
    initInputHelper();
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
    pasteToForeground();
});

// Quick Add panel
ipcMain.handle('hide-quick-add-panel', () => {
    if (quickAddWindow) quickAddWindow.hide();
});

ipcMain.handle('get-quick-add-data', () => {
    return { selectedText: pendingQuickAddText };
});

// Settings — re-register all hotkeys when any hotkey changes
ipcMain.handle('update-global-hotkeys', () => {
    registerGlobalHotkeys();
});
