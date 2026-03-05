# Phase 4 — Tech Debt Payoff

**Status**: Completed
**Date**: 2026-03-05

## Summary

Cleaned up three outdated dependencies and patterns that were safe, independent, and immediately verifiable — without touching the higher-risk Electron/React upgrade path.

---

## What Was Done

### Step 1: Api Class — Singleton Refactor

**Problem**: Every call to `new Api()` re-opened the lowdb `FileSync` adapter and re-read the database file from disk. Across 6 files with 13+ call sites, this caused redundant I/O on every operation.

**Solution**: Converted `Api` to a Singleton pattern.

**Changes**:

| File | Change |
|------|--------|
| `src/core/Api.js` | Added `static getInstance()` (lazy init), `static resetInstance()` (for path changes), changed module-level `db` → instance `this.db` |
| `src/core/Helpers.js` | 7x `new Api()` → `Api.getInstance()`, added `Api.resetInstance()` in `moveDb()` |
| `src/components/CommandListItem/index.js` | 4x `new Api()` → `Api.getInstance()` |
| `src/components/SnippetCrudModal/index.js` | 3x `new Api()` → `Api.getInstance()` |
| `src/components/QuickSearchPanel/index.js` | 4x `new Api()` → `Api.getInstance()` |
| `src/components/SnippetGeneratorModal/index.js` | 1x `new Api()` → `Api.getInstance()` |

**Key design decision**: `resetInstance()` is called after `moveDb()` so the singleton rebuilds with the new storage path.

---

### Step 2: Remove Moment.js → Native Date API

**Problem**: `moment` (330 KB) was imported for only 4 calls in a single file (`Helpers.js`) — formatting backup folder names and parsing them back for display.

**Solution**: Three small utility functions using native `Date`:

| Function | Purpose | Output Example |
|----------|---------|----------------|
| `formatDateForBackup(date)` | Backup folder name | `2026-03-05_14-30-00` |
| `parseDateFromBackup(str)` | Parse folder name back to Date | `Date` object or `null` |
| `formatDateForDisplay(date)` | Human-readable display | `05 Mar 2026, 14:30:00` |

**Replaced calls**:

| Location | Before | After |
|----------|--------|-------|
| `autoBackup()` | `moment(...).add(6, 'hours')` / `moment()` / `.isAfter()` | `new Date().getTime() + 6*60*60*1000` / `Date.now() > lastBackupTime` |
| `backupNow()` | `moment().format('YYYY-MM-DD_HH-mm-ss')` | `formatDateForBackup(new Date())` |
| `backupFiles()` | `moment(value, fmt)` parse + format | `parseDateFromBackup()` + `formatDateForDisplay()` |

**Removed**: `import moment from 'moment'` and `"moment": "^2.27.0"` from `package.json`.

---

### Step 3: Remove Lodash → Native JS

**Problem**: `lodash` (531 KB) was imported in 4 files for only 4 utility functions that have trivial native equivalents.

**Replacement map**:

| Lodash | Native Equivalent | Sites |
|--------|-------------------|-------|
| `_.forEach(arr, fn)` | `(arr \|\| []).forEach(fn)` | 7 |
| `_.forOwn(obj, fn)` | `Object.values(obj)` | 1 |
| `_.sortBy(arr)` | `[...arr].sort()` | 2 |
| `_.uniq(arr)` | `[...new Set(arr)]` | 1 |

**Files changed**:

| File | Changes |
|------|---------|
| `src/core/Helpers.js` | 7 replacements, removed `import _ from 'lodash'` |
| `src/components/CommandListItem/index.js` | 1 `_.sortBy` → `[...tags].sort()`, removed import |
| `src/components/FormElements/TagsField.js` | 3 `_.forEach` → `.forEach()`, removed import |
| `src/components/SnippetGeneratorModal/index.js` | 1 `_.forEach` → `.forEach()`, removed import |

**Removed from `package.json`**:
- `"lodash": "^4.17.19"` (dependency)
- `"typescript": "^3.9.7"` (unused devDependency — TS was installed but never configured or used)

---

## What Was NOT Done (and Why)

| Item | Reason |
|------|--------|
| Electron 9 → 28+ | Requires contextBridge/preload migration, async DB calls, build tool change. Separate project. |
| React 16 → 18 | Depends on Electron upgrade (CRA 3 doesn't support React 18). Blocked. |
| TypeScript migration | 41 JS files, no existing TS config or types. ROI too low for this codebase. |
| node-sass → dart-sass | Already done — `sass` 1.77.8 is in use. |

---

## Verification Checklist

- [ ] `yarn install` (update lockfile after dependency removal)
- [ ] `yarn electron-dev` starts without errors
- [ ] CRUD: create / edit / delete / favourite / trash commands
- [ ] Search: general search + `#tag` prefix search
- [ ] QuickSearchPanel (Alt+C): search, copy, quick save
- [ ] Parameterized commands: variable / choice / password fields work
- [ ] Settings > Storage: backup file dates display correctly (format: `DD MMM YYYY, HH:mm:ss`)
- [ ] Auto-backup creates folders with correct name format (`YYYY-MM-DD_HH-mm-ss`)
- [ ] Tag sorting and sidebar display
- [ ] Move database directory → app continues to function (`resetInstance` rebuilds the DB connection)

---

## Dependency Size Impact

| Package Removed | Approximate Size |
|-----------------|-----------------|
| moment | ~330 KB (minified) |
| lodash | ~531 KB (minified) |
| typescript (dev) | ~60 MB (node_modules) |

Total estimated savings: **~861 KB production + ~60 MB dev**.
