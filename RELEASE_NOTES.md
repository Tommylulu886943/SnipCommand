## New Features
- **Quick Add Panel (Alt+Z)** — Press Alt+Z (customizable) to instantly open a floating "New Command" form. Automatically captures the selected text from the active application and pre-fills the Command field. Just add a title, tags, and description, then save
- **Auto-paste to active window** — After copying a command from Quick Search, it automatically pastes into the previously focused application. Supports Windows (SendKeys), macOS (osascript), and Linux (xdotool). Can be toggled in Settings > General
- **Unsaved changes guard** — When creating or editing a command snippet, accidentally clicking the overlay, X button, or Cancel will now prompt a confirmation dialog if any fields have been modified, preventing data loss

## Improvements
- Added Quick Add Hotkey recorder in Settings > General tab (default: Alt+Z)
- Added "Auto-paste" checkbox in Settings > General tab (enabled by default, requires auto-close to be enabled)
- Tag input in Quick Add panel supports auto-complete suggestions from existing tags
