# SnipCommand v0.2.0 Release Notes

**Release Date**: March 5, 2026

This is a major update that transforms SnipCommand from a basic snippet manager into a productivity tool with instant global access, smart search, and significantly improved stability.

---

## Highlights

### Global Quick Search (Alt+C)
Press **Alt+C** from anywhere to open a floating search panel. Search your commands, fill in parameters, and copy to clipboard — all without leaving your current app.

### Smart Fuzzy Search
Search now understands typos and partial matches. Results are ranked by relevance across title, command, tags, and description — with frequently used commands bubbling to the top.

### #tag Filtering
Type `#docker` to instantly filter by tag. Combine with search: `#docker restart` finds "restart" commands tagged with "docker".

### System Tray
SnipCommand now lives in your system tray. Close the window and it keeps running in the background, ready when you need it.

---

## What's New

- **Global Hotkey + Floating Search Panel** — Customizable hotkey (default: Alt+C) opens a Spotlight-like search overlay
- **Fuzzy Search Engine** — Multi-field weighted search with usage frequency boosting
- **#tag Prefix Search** — Filter by tag with optional search query
- **Usage Tracking** — Frequently used commands rank higher automatically
- **System Tray Integration** — Background operation with tray icon and context menu
- **Quick Save** — Add new snippets directly from the search panel
- **Settings: General Tab** — Live hotkey recorder + auto-close-after-copy toggle
- **Parameterized Commands in Quick Search** — Variable, choice, and password fields work in the floating panel

## Bug Fixes

- Fixed critical security vulnerability (Electron `remote` module removed, replaced with IPC)
- Fixed XSS vulnerability in command display (HTML now properly escaped)
- Fixed multiple null-reference crashes in search and tag filtering
- Fixed `getAllUntaggedCommands` not returning commands with null tags
- Fixed memory leaks (uncleared intervals and IPC listeners)
- Added error handling to all file system operations
- Fixed macOS dock icon click not reopening window

## Under the Hood

- Api class refactored to Singleton — eliminates redundant disk reads
- Removed **Moment.js** (~330 KB) — replaced with native Date API
- Removed **Lodash** (~531 KB) — replaced with native JS equivalents
- Removed unused TypeScript devDependency
- Production bundle reduced by ~861 KB

---

## System Requirements

- Windows 7+ / macOS 10.10+ / Linux (AppImage)
- ~50 MB disk space

## Build Instructions

```bash
# Development
yarn install
yarn electron-dev

# Production build
yarn release
```

Output will be in the `app/` directory.

---

## Known Limitations

- Electron 9 / React 16 — upgrade planned for a future release
- Global hotkey may conflict with other apps using the same shortcut (configurable in Settings > General)

## Files Changed (from v0.1.0)

**New files (5)**:
- `src/core/FuzzySearch.js` — Fuzzy search engine
- `src/core/Utils.js` — escapeHtml utility
- `src/components/QuickSearchPanel/index.js` — Floating search panel
- `src/components/QuickSearchPanel/style.scss` — Search panel styles
- `src/components/common.scss` — Shared component styles

**Modified files (14)**:
- `package.json` — Version bump, dependency cleanup
- `public/electron.js` — Tray, global hotkey, search window, IPC handlers
- `src/index.js` — URL parameter routing for search panel
- `src/App.js` — Interval cleanup on unmount
- `src/core/Api.js` — Singleton, fuzzy search, usage tracking, bug fixes
- `src/core/Helpers.js` — Native Date/JS replacements, error handling, XSS fix
- `src/components/TopMenu/index.js` — IPC migration, listener cleanup
- `src/components/SettingsModal/index.js` — General settings tab
- `src/components/SettingsModal/style.scss` — General tab styles
- `src/components/CommandListItem/index.js` — Singleton + native JS
- `src/components/SnippetCrudModal/index.js` — Singleton migration
- `src/components/SnippetGeneratorModal/index.js` — Usage tracking, singleton, native JS
- `src/components/FormElements/TagsField.js` — XSS fix, native JS
- `src/themes/_light.scss`, `src/themes/_dark.scss` — Quick search panel theme
