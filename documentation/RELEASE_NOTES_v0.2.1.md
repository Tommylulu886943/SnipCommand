# SnipCommand v0.2.1 Release Notes

**Release Date**: March 5, 2026

A quick follow-up patch to v0.2.0 addressing visual glitches and adding multi-monitor awareness.

---

## What's New

### Multi-Monitor Support
The Quick Search panel (Alt+C) now detects which screen your cursor is on and opens centered on that display. Previously it always appeared on the primary monitor.

---

## Bug Fixes

### White Border / Edge Fix
- **Root cause**: The `body` element had no explicit `background-color`, so the browser default (white) showed through gaps — especially visible in dark theme.
- **Fix**: Added theme-aware `background-color` to `body` in both light (`#F8F8FA`) and dark (`#21252B`) themes.
- Both `BrowserWindow` instances (main + search) now read the `appTheme` preference and set a matching `backgroundColor` at creation time.
- Removed `border-radius: 8px` from the Quick Search panel — in a frameless rectangular window, this only created visible white corners.
- Added `overflow: hidden` on `html, body` to prevent scroll-triggered gaps.

---

## Files Changed (from v0.2.0)

| File | Change |
|------|--------|
| `package.json` | Version bump `0.2.0` → `0.2.1` |
| `public/electron.js` | Theme-aware `backgroundColor` for both windows; `getSearchPanelPosition()` using cursor-based display detection |
| `src/components/common.scss` | Added `overflow: hidden` on `html, body` |
| `src/themes/_light.scss` | Added `background: #F8F8FA` on `body.light-theme` |
| `src/themes/_dark.scss` | Added `background: #21252B` on `body.dark-theme` |
| `src/components/QuickSearchPanel/style.scss` | Removed `border-radius: 8px` |

---

## Build Instructions

```bash
yarn install
yarn electron-dev    # development
yarn release         # production build → app/
```
