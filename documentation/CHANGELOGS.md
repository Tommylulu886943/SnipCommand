# CHANGELOGS


### v0.2.3
**March 6, 2026**

#### Bug Fixes
- **Fixed auto-paste and text capture for external apps** — Replaced VBS/PowerShell `SendKeys` (which used journal hooks that fail for external apps, console windows, and elevated processes) with a compiled C# helper using `keybd_event` Win32 API for reliable keystroke injection to any window
- **Fixed Quick Add first-open data not pre-filling** — Selected text from external apps now correctly appears in the Command field on first open (switched from push-based IPC to pull-based `ipcRenderer.invoke`)
- **Fixed foreground window capture timing** — HWND is now captured synchronously before the panel steals focus, ensuring paste targets the correct window

#### Improvements
- Configurable "Recently used items" count in Settings > General (1–50, default 10)
- Foreground window tracking now uses HWND instead of PID for more reliable window activation

---

### v0.2.2
**March 6, 2026**

#### New Features
- **Quick Add Panel (Alt+Z)** — Press Alt+Z (customizable) to instantly open a floating "New Command" form. Automatically captures the selected text from the active application and pre-fills the Command field. Just add a title, tags, and description, then save
- **Auto-paste to active window** — After copying a command from Quick Search, it automatically pastes into the previously focused application. Supports Windows (SendKeys), macOS (osascript), and Linux (xdotool). Can be toggled in Settings > General
- **Unsaved changes guard** — When creating or editing a command snippet, accidentally clicking the overlay, X button, or Cancel will now prompt a confirmation dialog if any fields have been modified, preventing data loss

#### Improvements
- Added Quick Add Hotkey recorder in Settings > General tab (default: Alt+Z)
- Added "Auto-paste" checkbox in Settings > General tab (enabled by default, requires auto-close to be enabled)
- Tag input in Quick Add panel supports auto-complete suggestions from existing tags

---

### v0.2.1
**March 5, 2026**

#### Improvements
- **Multi-monitor support** — Quick Search panel now appears on whichever screen your cursor is on, instead of always defaulting to the primary display

#### Bug Fixes
- Fixed white border/edge visible on the right side and bottom of the main window, and the right side of the Quick Search panel
- BrowserWindow background color now matches the active theme (light/dark) to eliminate flash-of-white on launch
- Removed `border-radius` from Quick Search panel that caused white corners in the frameless window
- Added `overflow: hidden` on `html, body` to prevent scrollbar-induced gaps

---

### v0.2.0
**March 5, 2026**

#### New Features
- **Global Hotkey + Quick Search Panel** — Press Alt+C (customizable) to open a floating search panel anywhere, search commands instantly, and copy to clipboard
- **Fuzzy Search Engine** — Replaced basic indexOf search with a multi-field weighted fuzzy search algorithm (title > command > tags > description)
- **#tag Prefix Search** — Type `#docker` to filter commands by tag, optionally followed by a search query (e.g. `#docker restart`)
- **Usage Frequency Tracking** — Commands you use often rank higher in search results (logarithmic boost with diminishing returns)
- **System Tray** — App runs in the background; close the window and it stays in the tray. Left-click to toggle, right-click for menu
- **Quick Save** — Save new command snippets directly from the search panel via the "+" button
- **Settings: General Tab** — Configure global hotkey (with live key recorder) and auto-close-after-copy behavior
- **Parameterized Commands in Quick Search** — Fill variable/choice/password parameters directly in the floating panel

#### Bug Fixes
- Fixed Electron `remote` module security vulnerability — replaced with IPC handlers
- Fixed `getAllUntaggedCommands` logic error — commands with `null` tags were not returned
- Fixed regex null-access crashes in `organizeCommands` and `commandAsHtml`
- Fixed `getCommandsContainsTag` crash when tags is null/undefined
- Fixed `queryCommand` crash when title or command is null/undefined
- Fixed XSS vulnerability in `dangerouslySetInnerHTML` — added HTML escaping via `escapeHtml` utility
- Fixed memory leak: `setInterval` for auto-backup now cleared on unmount
- Fixed memory leak: IPC listeners in `TopMenu` now removed on unmount
- Added error handling (try-catch) to all file system operations in StorageHelpers
- Fixed macOS `activate` event handler (was commented out)

#### Tech Debt / Refactoring
- **Api Singleton** — Replaced 13+ `new Api()` calls across 6 files with `Api.getInstance()`, eliminating redundant disk reads on every operation
- **Removed Moment.js** (~330 KB) — Replaced with 3 native Date utility functions
- **Removed Lodash** (~531 KB) — Replaced `forEach/forOwn/sortBy/uniq` with native JS equivalents across 4 files
- **Removed unused TypeScript** devDependency (~60 MB dev)

---

### v0.1.0
**September 13, 2020**

- First release
