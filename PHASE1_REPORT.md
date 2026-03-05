# Phase 1 Bug 修復報告

> 完成日期：2026-03-04
> 修復範圍：所有嚴重(Critical)、高(High)、中(Medium) 級別的 Bug

---

## 修復總覽

| # | Bug ID | 嚴重性 | 狀態 | 說明 |
|---|--------|--------|------|------|
| 1 | BUG-001 | 🔴 Critical | ✅ 已修復 | Electron 安全漏洞 (remote 模組) |
| 2 | BUG-002 | 🔴 Critical | ✅ 已修復 | getAllUntaggedCommands 邏輯錯誤 |
| 3 | BUG-003 | 🟠 High | ✅ 已修復 | 正則表達式空值崩潰 |
| 4 | BUG-004 | 🟠 High | ✅ 已修復 | getCommandsContainsTag 空值崩潰 |
| 5 | BUG-005 | 🟠 High | ✅ 已修復 | queryCommand 空值崩潰 |
| 6 | BUG-006 | 🟡 Medium | ✅ 已修復 | dangerouslySetInnerHTML XSS 風險 |
| 7 | BUG-007 | 🟡 Medium | ✅ 已修復 | setInterval 未清除 (記憶體洩漏) |
| 8 | BUG-008 | 🟡 Medium | ✅ 已修復 | IPC 監聽器未取消註冊 (記憶體洩漏) |
| 9 | BUG-009 | 🟡 Medium | ✅ 已修復 | 檔案操作缺少錯誤處理 |
| 10 | BUG-010 | 🟡 Medium | ✅ 已修復 | macOS activate 處理被註解 |

**修復成果**: 10/10 Bug 全部修復

---

## 修改的檔案清單

| # | 檔案 | 修改的 Bug |
|---|------|-----------|
| 1 | `public/electron.js` | BUG-001, BUG-010 |
| 2 | `src/core/Api.js` | BUG-002, BUG-004, BUG-005 |
| 3 | `src/core/Helpers.js` | BUG-003, BUG-006, BUG-009 |
| 4 | `src/core/Utils.js` | BUG-006 (新增 escapeHtml 工具函式) |
| 5 | `src/App.js` | BUG-007 |
| 6 | `src/components/TopMenu/index.js` | BUG-001, BUG-008 |
| 7 | `src/components/SettingsModal/index.js` | BUG-001 |
| 8 | `src/components/FormElements/TagsField.js` | BUG-006 |
| 9 | `src/components/SnippetGeneratorModal/index.js` | BUG-006 |

---

## 各 Bug 詳細修復說明

### BUG-001: Electron 安全漏洞 — `remote` 模組移除

**問題**: `enableRemoteModule: true` 允許渲染進程直接存取主進程 API，存在安全風險。

**修復方式**:
1. 在 `electron.js` 中設定 `enableRemoteModule: false`，增加 `webSecurity: true`
2. 新增 IPC handlers 取代所有 `remote` 模組功能：
   - `window-close` — 關閉視窗
   - `window-minimize` — 最小化視窗
   - `window-maximize` — 最大化/還原視窗
   - `window-is-maximized` — 查詢最大化狀態
   - `show-open-dialog` — 開啟資料夾選擇對話框
3. 更新 `TopMenu` 元件：移除 `remote` 匯入，改用 `ipcRenderer.invoke()`
4. 更新 `SettingsModal` 元件：移除 `remote` 匯入，改用 `ipcRenderer.invoke()`

**修改前（TopMenu）**:
```javascript
import { remote, ipcRenderer } from "electron";
onClickClose = () => remote.getCurrentWindow().close();
```

**修改後（TopMenu）**:
```javascript
import { ipcRenderer } from "electron";
onClickClose = () => ipcRenderer.invoke('window-close');
```

**修改前（SettingsModal）**:
```javascript
import {remote, shell} from 'electron';
const dir = remote.dialog.showOpenDialogSync({properties: ['openDirectory']});
```

**修改後（SettingsModal）**:
```javascript
import {ipcRenderer, shell} from 'electron';
const dir = await ipcRenderer.invoke('show-open-dialog', {properties: ['openDirectory']});
```

---

### BUG-002: getAllUntaggedCommands 邏輯錯誤

**問題**: `||` 運算子與物件字面值搭配時，第一個物件永遠是 truthy，導致 `tags: null` 的指令不會被返回。

**修改前**:
```javascript
getAllUntaggedCommands = () => db.get('commands')
  .filter({tags: "", isTrash: false} || {tags: null, isTrash: false})
  .value();
```

**修改後**:
```javascript
getAllUntaggedCommands = () => db.get('commands')
  .filter(t => (!t.tags || t.tags === "") && t.isTrash === false)
  .value();
```

---

### BUG-003: 正則表達式空值崩潰

**問題**: `val.match(/name="(.*?)"/)[1]` 在正則不匹配時回傳 `null`，存取 `[1]` 會拋出例外。

**修改前（organizeCommands）**:
```javascript
result.push({
    id: shortid.generate(),
    type,
    name: val.match(/name="(.*?)"/)[1],
    value: val.match(val.indexOf('sc_password') > -1 ? /length="(.*?)"/ : /value="(.*?)"/)[1]
});
```

**修改後（organizeCommands）**:
```javascript
const nameMatch = val.match(/name="(.*?)"/);
const valueMatch = val.match(val.indexOf('sc_password') > -1 ? /length="(.*?)"/ : /value="(.*?)"/);

if (!nameMatch) return;

result.push({
    id: shortid.generate(),
    type,
    name: nameMatch[1],
    value: valueMatch ? valueMatch[1] : ''
});
```

**修改前（commandAsHtml）**:
```javascript
text = text.replace(val, `<span>&#60;${val.match(/name="(.*?)"/)[1]}&#62;</span>`)
```

**修改後（commandAsHtml）**:
```javascript
const nameMatch = val.match(/name="(.*?)"/);
if (!nameMatch) return;
escaped = escaped.replace(escapedVal, `<span>&#60;${escapeHtml(nameMatch[1])}&#62;</span>`);
```

---

### BUG-004: getCommandsContainsTag 空值崩潰

**問題**: `t.tags` 為 `null/undefined` 時呼叫 `.indexOf()` 會崩潰。

**修改前**:
```javascript
getCommandsContainsTag = tag => db.get('commands')
  .filter((t => t.tags.indexOf(tag) > -1 && t.isTrash === false)).value();
```

**修改後**:
```javascript
getCommandsContainsTag = tag => db.get('commands')
  .filter(t => t.tags && t.tags.indexOf(tag) > -1 && t.isTrash === false).value();
```

---

### BUG-005: queryCommand 空值崩潰

**問題**: `t.title` 或 `t.command` 為 `null/undefined` 時呼叫 `.toLowerCase()` 會崩潰。

**修改前**:
```javascript
queryCommand = query => db.get('commands')
  .filter((t => (t.title.toLowerCase().indexOf(query) > -1 ||
    t.command.toLowerCase().indexOf(query) > -1) && t.isTrash === false)).value();
```

**修改後**:
```javascript
queryCommand = query => db.get('commands')
  .filter(t => ((t.title && t.title.toLowerCase().indexOf(query) > -1) ||
    (t.command && t.command.toLowerCase().indexOf(query) > -1)) && t.isTrash === false).value();
```

---

### BUG-006: dangerouslySetInnerHTML XSS 風險

**問題**: 多處使用 `dangerouslySetInnerHTML` 但未做 HTML 消毒。

**修復方式**:

1. **新增 `escapeHtml` 工具函式**（`src/core/Utils.js`）:
```javascript
export const escapeHtml = str => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
```

2. **`commandAsHtml`（Helpers.js）**: 先對整個指令文字做 HTML 跳脫，再替換參數標籤為 `<span>` 樣式標籤。這樣即使指令中包含 `<script>` 等危險標籤也會被安全跳脫。

3. **`boldQuery`（TagsField.js）**: 對標籤文字和搜尋輸入做 HTML 跳脫後再插入 `<b>` 粗體標籤。

4. **MarkdownIt（SnippetGeneratorModal.js）**: 設定 `{html: false}` 禁用 Markdown 中的原始 HTML 渲染。

---

### BUG-007: setInterval 未清除（記憶體洩漏）

**問題**: `App.js` 中的自動備份 `setInterval` 未在元件卸載時清除。

**修改前**:
```javascript
constructor(props) {
    super(props);
    setInterval(StorageHelpers.autoBackup, 1000 * 60 * 60 * 6);
}
```

**修改後**:
```javascript
constructor(props) {
    super(props);
    this._backupInterval = setInterval(StorageHelpers.autoBackup, 1000 * 60 * 60 * 6);
}

componentWillUnmount() {
    if (this._backupInterval) {
        clearInterval(this._backupInterval);
    }
}
```

---

### BUG-008: IPC 監聽器未取消註冊（記憶體洩漏）

**問題**: `TopMenu` 的 `ipcRenderer.on('appMenu', ...)` 在元件卸載時未移除。

**修改前**:
```javascript
componentDidMount() {
    ipcRenderer.on('appMenu', (event, args) => { ... });
}
// componentWillUnmount 中未移除此監聽器
```

**修改後**:
```javascript
componentDidMount() {
    this._appMenuHandler = (event, args) => { ... };
    ipcRenderer.on('appMenu', this._appMenuHandler);
}

componentWillUnmount() {
    ipcRenderer.removeListener('appMenu', this._appMenuHandler);
    // ...
}
```

---

### BUG-009: 檔案操作缺少錯誤處理

**問題**: `Helpers.js` 中所有 `fs` 同步操作（mkdirSync, renameSync, copyFileSync, readdirSync）都沒有 try-catch。

**修復方式**: 為所有 `StorageHelpers` 方法加入 try-catch 包裹：
- `initDb()` — 資料庫初始化
- `moveDb()` — 移動資料庫（失敗時顯示錯誤通知）
- `restoreDb()` — 恢復備份（失敗時顯示錯誤通知）
- `autoBackup()` — 自動備份
- `backupNow()` — 手動備份（失敗時顯示錯誤通知）
- `backupFiles()` — 列出備份檔案（增加目錄存在性檢查和無效日期過濾）

同時增加 `{recursive: true}` 選項到所有 `mkdirSync` 呼叫，避免父目錄不存在時失敗。

---

### BUG-010: macOS activate 處理被註解

**問題**: `electron.js` 中的 `activate` 事件處理器被註解，導致 macOS 點擊 Dock 圖示無法重開視窗。

**修改前**:
```javascript
// app.on('activate', () => {
//     if (mainWindow === null) {
//         createWindow();
//     }
// });
```

**修改後**:
```javascript
app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
```
同時將視窗建立邏輯提取為 `createWindow()` 函式，供 `ready` 和 `activate` 事件共用。

---

## 未修復項目（Phase 4 計劃）

以下為低嚴重性問題，安排在 Phase 4 處理：

| Bug ID | 說明 | 原因 |
|--------|------|------|
| BUG-011 | 過時依賴套件 | 需要大規模升級和相容性測試 |
| BUG-012 | Api 多實例化 | 效能問題，非功能性 Bug |
| BUG-013 | PropTypes 不完整 | 開發階段警告，不影響執行 |
| — | 完整 contextIsolation 遷移 | 需要重構整個資料層（目前已移除 remote 模組，降低風險） |

---

## 下一步：Phase 2 — 核心新功能

Phase 1 完成後，專案已具備穩固基礎。Phase 2 將聚焦於提升產品價值：

1. **系統匣常駐** — 背景運行，隨時可用
2. **全域快捷鍵 + 浮動搜尋面板** — 類似 Spotlight/Alfred 的快速存取
3. **模糊搜尋升級 (Fuse.js)** — 替換簡陋的 indexOf 搜尋
4. **使用頻率追蹤** — 常用指令優先顯示
5. **快速儲存功能** — 搜尋面板中一鍵儲存新指令
