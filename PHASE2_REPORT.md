# Phase 2 實作報告 — 核心新功能

## 概覽

Phase 2 實作了 7 個核心功能步驟，將 SnipCommand 從一個基本的程式碼片段管理器升級為具備**全域快捷鍵呼叫、模糊搜尋、浮動面板快速操作**的生產力工具。

---

## 實作成果

### Step 1: FuzzySearch 模糊搜尋引擎 ✅
**新建** `src/core/FuzzySearch.js`

- 四級評分演算法：
  - Exact match: 100 分
  - Starts-with: 75 分
  - Contains: 50 分
  - Fuzzy character match: 10-40 分（根據匹配比例）
- 多欄位加權搜尋：title(3x) > command(2x) > tags(1x) > description(0.5x)
- 支援 `usageBoostFn` 回呼函式，可依使用頻率加分
- 回傳 `[{ item, score }]` 降序排列

### Step 2: 使用頻率追蹤 ✅
**修改** `src/core/Api.js`
- 新增 `incrementUsage(id)` 方法
  - 更新 `usageCount`（計數器 +1）
  - 更新 `lastUsedAt`（ISO 時間戳）
  - 向下相容：用 `|| 0` / `|| null` 處理舊資料

**修改** `src/components/SnippetGeneratorModal/index.js`
- `copyCommand()` 複製後呼叫 `new Api().incrementUsage(item.id)`

### Step 3: 整合模糊搜尋到現有應用 ✅
**修改** `src/core/Api.js`
- 替換 `queryCommand` 方法：FuzzySearch 取代原始 indexOf
- 使用頻率加成公式：`Math.min(Math.log2((usageCount || 0) + 1) * 5, 25)`
  - 上限 25 分，避免過度偏向高頻指令
  - 對數函式確保邊際遞減效應

### Step 4: 系統匣常駐 ✅
**修改** `public/electron.js`
- 引入 `Tray, Menu, nativeImage, globalShortcut, screen`
- `createTray()` 函式：
  - 圖示：`public/images/logo/snip_command.png`（16x16 nativeImage）
  - 左鍵點擊：切換主視窗顯示/隱藏
  - 右鍵選單：Show Window / Quit
- 關閉視窗行為改為隱藏：
  - `mainWindow.on('close')` → `preventDefault()` + `hide()`
  - `app.isQuitting` 旗標控制真正退出
  - `before-quit` 事件設定旗標
  - Tray Quit 選單項也設定旗標

### Step 5: Settings 設定整合 ✅
**修改** `src/core/Helpers.js`
- electron-store schema 新增兩個偏好設定：
  - `globalHotkey`：預設 `"Alt+C"`
  - `autoCloseAfterCopy`：預設 `true`

**修改** `src/components/SettingsModal/index.js`
- 新增 "General" 分頁（位於 Storage 和 Themes 之間）
- 快捷鍵錄製器：
  - TextField 即時顯示當前快捷鍵
  - "Record" 按鈕進入錄製模式，監聽 `keydown` 組合鍵
  - 支援 Ctrl/Alt/Shift/Meta + 按鍵組合
  - "Save" 按鈕透過 `ipcRenderer.invoke('update-global-hotkey', hotkey)` 通知主進程
- 自動關閉開關：checkbox toggle

**修改** `src/components/SettingsModal/style.scss`
- 新增 `.general-section` 區塊樣式
- `.hotkey-recorder`：flex 佈局，TextField + 按鈕
- `.checkbox-container`：label + checkbox 對齊

**修改** `public/electron.js`
- 新增 IPC handler `update-global-hotkey`
- 收到新快捷鍵後重新註冊全域快捷鍵

### Step 6: 全域快捷鍵 + 浮動搜尋面板 ✅
**修改** `public/electron.js`
- `registerGlobalHotkey(hotkey)`：
  - `globalShortcut.unregisterAll()` → `register(hotkey, toggleSearchPanel)`
- `createSearchWindow()`：
  - frameless, alwaysOnTop, skipTaskbar
  - 尺寸 600×500，螢幕中央定位
  - 載入 `index.html?view=search`（dev: `localhost:3000?view=search`）
  - `blur` 事件自動隱藏
  - `closed` 事件清除參考
- `toggleSearchPanel()`：建立/顯示/隱藏搜尋視窗
  - 顯示時發送 `search-panel-shown` 事件通知 React 重置狀態
- IPC handlers：`hide-search-panel`
- `will-quit` 時 `globalShortcut.unregisterAll()`

**修改** `src/index.js`
- 檢測 URL 參數 `?view=search`
- `view=search` → 渲染 `<QuickSearchPanel />`
- 其他 → 渲染 `<App />`

**新建** `src/components/QuickSearchPanel/index.js`
- 獨立元件（不依賴 Redux，直接使用 Api.js）
- 核心功能：
  - 自動 focus 搜尋框
  - 即時模糊搜尋（使用 FuzzySearch + 使用頻率加成）
  - 鍵盤導航：↑↓ 選擇、Enter 複製、Esc 關閉/返回
  - 空查詢顯示最近使用的指令（按 `lastUsedAt` 排序，前 10 筆）
  - 動態參數指令 → 顯示參數填寫表單（支援 text/choice/password 類型）
  - 複製後呼叫 `incrementUsage`
  - 根據 `autoCloseAfterCopy` 設定決定複製後行為
- 生命週期：
  - `componentDidMount`：監聽 `search-panel-shown` IPC 事件
  - `componentWillUnmount`：移除 IPC listener
- 主題支援：讀取 `appTheme` 偏好設定，套用 body class

**新建** `src/components/QuickSearchPanel/style.scss`
- 無邊框浮動面板佈局
- flex 直向排列：搜尋框 → 結果列表
- 結果列表可捲動，溢出文字省略
- 參數表單 / 快速儲存表單覆蓋顯示
- 命令文字使用等寬字體

**修改** `src/themes/_light.scss`
- 新增 `.comp_quick-search-panel` 主題色：
  - 背景白色，陰影 `0 8px 32px rgba(0,0,0,0.15)`
  - 選中項目：`#0078d4` 藍色高亮，白色文字
  - 標籤：`#e5e5e5` 背景

**修改** `src/themes/_dark.scss`
- 新增 `.comp_quick-search-panel` 主題色：
  - 背景 `#1e1e1e`，陰影 `0 8px 32px rgba(0,0,0,0.5)`
  - 選中項目：`#0078d4` 藍色高亮，白色文字
  - 標籤：`#444` 背景

### Step 7: 快速儲存功能 ✅
**已在 Step 6 的 QuickSearchPanel 中一併實作**

- 搜尋框旁 "+" 按鈕開啟快速儲存表單
- 簡化表單欄位：
  - Title *（必填）
  - Command *（必填，textarea 支援多行）
  - Tags（自動填入當前搜尋詞）
- 使用 `shortid` 生成唯一 ID
- 儲存後自動重新整理搜尋結果
- Cancel 或 Esc 返回搜尋模式

---

## 檔案變更總覽

### 新建（3 個）
| 檔案 | 行數 | 用途 |
|------|------|------|
| `src/core/FuzzySearch.js` | ~75 | 模糊搜尋引擎 |
| `src/components/QuickSearchPanel/index.js` | ~375 | 浮動搜尋面板 React 元件 |
| `src/components/QuickSearchPanel/style.scss` | ~175 | 搜尋面板樣式 |

### 修改（9 個）
| 檔案 | 變更摘要 |
|------|----------|
| `public/electron.js` | Tray、globalShortcut、searchWindow、4 個新 IPC handlers |
| `src/index.js` | URL 參數路由（App vs QuickSearchPanel） |
| `src/core/Api.js` | incrementUsage、FuzzySearch 整合取代 indexOf |
| `src/core/Helpers.js` | electron-store schema 新增 globalHotkey + autoCloseAfterCopy |
| `src/components/SnippetGeneratorModal/index.js` | 複製後呼叫 incrementUsage |
| `src/components/SettingsModal/index.js` | 新增 General 分頁（快捷鍵錄製器 + 自動關閉開關） |
| `src/components/SettingsModal/style.scss` | General 分頁樣式 |
| `src/themes/_light.scss` | QuickSearchPanel 淺色主題 |
| `src/themes/_dark.scss` | QuickSearchPanel 深色主題 |

---

## 架構決策

1. **QuickSearchPanel 獨立於 Redux**：搜尋面板在獨立 BrowserWindow 中運行，不需要主應用的狀態管理，直接透過 Api.js 存取 LowDB。
2. **URL 參數路由**：用 `?view=search` 區分主應用與搜尋面板，共用同一份 React build，避免多入口配置。
3. **自製 FuzzySearch**：不引入外部依賴（如 Fuse.js），保持零新依賴的原則，且演算法針對指令搜尋場景最佳化。
4. **對數使用頻率加成**：`log2(count+1)*5` 確保高頻指令有優勢但不會壟斷排名，新指令仍有機會出現。
5. **IPC 通訊模式**：統一使用 `ipcMain.handle` / `ipcRenderer.invoke`（Promise-based），取代已棄用的 `remote` 模組。

---

## 驗證清單

| # | 測試項目 | 預期結果 |
|---|----------|----------|
| 1 | `yarn electron-dev` 啟動 | 主視窗正常顯示 |
| 2 | 系統匣圖示 | 出現在系統匣，左鍵切換視窗、右鍵選單可用 |
| 3 | 關閉主視窗 | 視窗隱藏但應用不退出，匣圖示仍在 |
| 4 | 按 Alt+C | 螢幕中央彈出浮動搜尋面板 |
| 5 | 再按 Alt+C 或 Esc | 搜尋面板關閉 |
| 6 | 搜尋面板輸入文字 | 即時顯示模糊搜尋結果 |
| 7 | ↑↓ 鍵盤導航 | 藍色高亮跟隨移動 |
| 8 | Enter 選擇指令 | 指令複製到剪貼簿，面板自動關閉 |
| 9 | 含動態參數的指令 | 彈出參數填寫表單 |
| 10 | "+" 按鈕 | 開啟快速儲存表單 |
| 11 | 填寫並儲存新片段 | 出現在搜尋結果中 |
| 12 | Settings → General | 快捷鍵錄製器和自動關閉開關可用 |
| 13 | 更改快捷鍵 | 新快捷鍵立即生效 |
| 14 | 深色主題 | 搜尋面板和 General 分頁色彩正確 |
| 15 | 空搜尋 | 顯示最近使用的指令（前 10 筆） |
| 16 | 多次使用同一指令 | 該指令在搜尋結果中排名逐漸提升 |

---

## 下一步建議（Phase 3）

根據 PROJECT_ANALYSIS.md 的路線圖，可考慮：

1. **匯入/匯出功能**（JSON/CSV）
2. **資料夾/分類系統**
3. **Gist 同步**
4. **Shell 整合**（直接在終端執行指令）
5. **多語系支援**
