## v0.2.5

### Bug Fixes
- **Fixed QuickSearch not finding newly added commands** — Commands added from the main window or QuickAdd panel now appear immediately in QuickSearch without restarting the app
- **Fixed long commands breaking action buttons layout** — Delete/Edit/Favourite buttons no longer get pushed off-screen when a command snippet contains very long text
- **Fixed favourite toggle not updating UI** — Clicking the favourite star now immediately reflects the change in the command list

---

## Bug Fixes
- **Fixed auto-paste and text capture for external apps** — Replaced VBS/PowerShell `SendKeys` with compiled C# helper using `keybd_event` Win32 API for reliable keystroke injection to any window (notepad, powershell, browsers, etc.)
- **Fixed Quick Add first-open data not pre-filling** — Selected text now correctly appears in the Command field on first open
- **Fixed foreground window capture timing** — HWND captured synchronously before panel steals focus

## Improvements
- Configurable "Recently used items" count in Settings > General (1–50, default 10)
- Foreground window tracking uses HWND instead of PID for more reliable window activation
