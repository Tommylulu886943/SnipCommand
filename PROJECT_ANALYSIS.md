# SnipCommand 專案深度分析報告

> 分析日期：2026-03-04
> 專案類型：Electron + React 桌面應用（指令片段管理器）

---

## 目錄

- [一、專案概覽](#一專案概覽)
- [二、現有功能分析](#二現有功能分析)
- [三、已知 Bug 與問題清單](#三已知-bug-與問題清單)
- [四、新功能提案](#四新功能提案)
- [五、開發優先級路線圖](#五開發優先級路線圖)

---

## 一、專案概覽

### 技術棧

| 層級 | 技術 | 版本 |
|------|------|------|
| 前端框架 | React | 16.13.1 |
| 桌面運行時 | Electron | 9.1.0 |
| 狀態管理 | Redux + Redux-Thunk | - |
| 資料庫 | LowDB (JSON) | 1.0.0 |
| 樣式 | SCSS (Light/Dark) | - |
| 建構 | CRA + Rescripts + Webpack | - |

### 資料模型

```javascript
// 指令片段 (Command Snippet)
{
  id: string,           // shortid 產生
  title: string,        // 標題（必填）
  command: string,      // 指令內容（支援動態參數）
  tags: string,         // 逗號分隔標籤
  description: string,  // Markdown 說明文件
  isFavourite: boolean, // 是否收藏
  isTrash: boolean      // 是否在垃圾桶
}
```

### 動態參數語法

```
變數：     [sc_variable name="名稱" value="預設值" /]
選項：     [sc_choice name="名稱" value="選項1,選項2,選項3" /]
密碼產生： [sc_password name="名稱" length="16" /]
```

---

## 二、現有功能分析

### 已完成的功能

| # | 功能 | 說明 | 狀態 |
|---|------|------|------|
| 1 | 指令片段 CRUD | 建立、編輯、檢視、刪除指令片段 | ✅ 完成 |
| 2 | 動態參數 | 支援變數、選擇框、密碼產生器三種參數類型 | ✅ 完成 |
| 3 | 標籤系統 | 多標籤分類，支援自動補全 | ✅ 完成 |
| 4 | 收藏功能 | 將常用指令標記為收藏 | ✅ 完成 |
| 5 | 全文搜尋 | 搜尋標題和指令內容（大小寫不敏感） | ✅ 完成 |
| 6 | Markdown 文件 | 為每個片段添加 Markdown 說明 | ✅ 完成 |
| 7 | 垃圾桶 | 軟刪除，支援恢復和永久刪除 | ✅ 完成 |
| 8 | 自動備份 | 每 6 小時自動備份，支援手動備份和恢復 | ✅ 完成 |
| 9 | 主題支援 | 淺色 / 深色主題切換 | ✅ 完成 |
| 10 | 一鍵複製 | 一鍵複製指令到剪貼簿（含動態參數填寫） | ✅ 完成 |
| 11 | 雲端同步就緒 | 資料庫放在使用者目錄，方便搭配雲端同步 | ✅ 完成 |
| 12 | 跨平台 | Windows / macOS / Linux | ✅ 完成 |

### 功能缺口分析

| # | 缺失功能 | 影響 |
|---|----------|------|
| 1 | **無全域快捷鍵** | 無法在任何應用中快速呼叫 SnipCommand |
| 2 | **無快速搜尋面板** | 必須切換到應用視窗才能搜尋指令 |
| 3 | **無指令匯入/匯出** | 無法與他人分享指令集 |
| 4 | **無指令使用頻率追蹤** | 無法根據使用頻率排序 |
| 5 | **搜尋演算法簡陋** | 僅使用 indexOf 子字串匹配，無模糊搜尋 |
| 6 | **無自動更新** | 檢查更新只是打開 GitHub Releases 頁面 |
| 7 | **無分類資料夾** | 只有標籤，沒有階層式分類 |
| 8 | **無指令歷史記錄** | 無法追蹤指令的修改歷史 |

---

## 三、已知 Bug 與問題清單

### 🔴 嚴重 (Critical)

#### BUG-001: Electron 安全漏洞 - nodeIntegration 啟用
- **檔案**: `public/electron.js:19-20`
- **問題**: `nodeIntegration: true` 和 `enableRemoteModule: true` 已啟用
- **風險**: 如果存在 XSS 漏洞，攻擊者可以直接執行系統指令
- **修復**: 使用 `contextBridge` 和 `preload` 腳本替代

#### BUG-002: 未過濾標籤的 getAllUntaggedCommands 邏輯錯誤
- **檔案**: `src/core/Api.js:30-33`
- **問題**: `||` 運算子與物件字面值搭配使用邏輯錯誤
```javascript
// 當前（錯誤）：
getAllUntaggedCommands = () => db.get('commands')
  .filter({tags: "", isTrash: false} || {tags: null, isTrash: false})
  .value();

// 因為 {tags: "", isTrash: false} 是 truthy，所以 || 後面的條件永遠不會被評估
// 導致 tags 為 null 的指令不會被顯示在「未標記」分類中
```
- **修復**: 使用函式過濾器替代
```javascript
getAllUntaggedCommands = () => db.get('commands')
  .filter(t => (!t.tags || t.tags === "") && t.isTrash === false)
  .value();
```

### 🟠 高嚴重性 (High)

#### BUG-003: 正則表達式匹配的空值崩潰
- **檔案**: `src/core/Helpers.js:51-52, 75`
- **問題**: `val.match(/name="(.*?)"/)[1]` 在正則不匹配時會回傳 `null`，導致存取 `[1]` 時拋出例外
- **影響**: 當指令參數格式不正確時，應用程式會崩潰
- **修復**: 加入 null 檢查
```javascript
const nameMatch = val.match(/name="(.*?)"/);
if (!nameMatch) return null;
const name = nameMatch[1];
```

#### BUG-004: getCommandsContainsTag 空值崩潰
- **檔案**: `src/core/Api.js:39`
- **問題**: 如果 `t.tags` 為 `null/undefined`，呼叫 `.indexOf()` 會崩潰
```javascript
// 當前：
getCommandsContainsTag = tag => db.get('commands')
  .filter((t => t.tags.indexOf(tag) > -1 && t.isTrash === false))
  .value();
// t.tags 可能是 null，調用 null.indexOf() 會報錯
```
- **修復**: 加入空值保護 `(t.tags && t.tags.indexOf(tag) > -1)`

#### BUG-005: queryCommand 空值崩潰
- **檔案**: `src/core/Api.js:41`
- **問題**: `t.title.toLowerCase()` 和 `t.command.toLowerCase()` 在值為 `null/undefined` 時會崩潰
- **修復**: 加入空值保護或使用可選鏈 `t.title?.toLowerCase()`

### 🟡 中嚴重性 (Medium)

#### BUG-006: dangerouslySetInnerHTML XSS 風險
- **檔案**:
  - `src/components/CommandListItem/index.js:128`
  - `src/components/ConfirmDialog/index.js:24`
  - `src/components/FormElements/TagsField.js:173`
  - `src/components/SnippetGeneratorModal/index.js:147, 191`
- **問題**: 多處使用 `dangerouslySetInnerHTML` 但未做 HTML 消毒（sanitization）
- **風險**: 結合 BUG-001，可能導致遠端程式碼執行
- **修復**: 使用 DOMPurify 進行消毒

#### BUG-007: setInterval 未清除（記憶體洩漏）
- **檔案**: `src/App.js:20`
- **問題**: 自動備份的 `setInterval` 在元件卸載時未清除
```javascript
// 當前：
componentDidMount() {
  setInterval(StorageHelpers.autoBackup, 1000 * 60 * 60 * 6);
}
// 缺少 componentWillUnmount 清理
```

#### BUG-008: IPC 監聽器未取消註冊（記憶體洩漏）
- **檔案**: `src/components/TopMenu/index.js:27`
- **問題**: `ipcRenderer.on('appMenu', ...)` 在元件卸載時未移除
- **影響**: 元件重新掛載時會累積多個監聽器，導致重複處理和記憶體洩漏

#### BUG-009: 檔案操作缺少錯誤處理
- **檔案**: `src/core/Helpers.js:162-236`
- **問題**: 所有 `fs` 操作（mkdirSync, renameSync, copyFileSync, readdirSync）都缺少 try-catch
- **影響**: 磁碟滿、權限不足、檔案鎖定等情況會導致應用崩潰

#### BUG-010: macOS 活化處理已被註解
- **檔案**: `public/electron.js:41-45`
- **問題**: `activate` 事件處理器被註解掉
- **影響**: macOS 用戶點擊 Dock 圖示時無法重新開啟視窗

### 🟢 低嚴重性 (Low)

#### BUG-011: 嚴重過時的依賴套件
- **Electron**: 9.1.0（已知安全漏洞，當前穩定版 28+）
- **React**: 16.13.1（當前穩定版 18+）
- **node-sass**: 4.14.1（已棄用，應遷移到 dart-sass）
- **Moment.js**: 已進入維護模式，建議遷移到 date-fns 或 Day.js
- **LowDB**: 1.0.0（當前版本 7+）

#### BUG-012: 多次實例化 Api 類別（效能問題）
- **檔案**: 整個專案（14 處）
- **問題**: 每次操作都 `new Api()` 建立新實例，應該使用單例模式
- **影響**: 不必要的資源消耗

#### BUG-013: PropTypes 驗證不完整
- **檔案**: `src/components/CommandList/index.js:28`
- **問題**: `items: PropTypes.array` 應改為 `PropTypes.arrayOf(PropTypes.shape({...}))`

---

## 四、新功能提案

### 🌟 核心功能：全域快速搜尋面板（Quick Search Panel）

這是你提到的核心想法，也是我認為能帶來最大價值的功能。

#### 4.1 全域快捷鍵呼叫（Global Hotkey）

**概念**: 在任何應用中按下快捷鍵（如 `Ctrl+Shift+Space` 或 `Alt+Space`），快速彈出一個輕量級搜尋面板。

**技術方案**:
```
用戶按下全域快捷鍵
    ↓
Electron globalShortcut 攔截
    ↓
顯示小型浮動視窗（不是主視窗）
    ↓
用戶輸入搜尋詞 / Prompt
    ↓
即時顯示匹配的指令片段
    ↓
選中後一鍵複製到剪貼簿 / 直接貼上
```

**實作要點**:
- 使用 Electron 的 `globalShortcut.register()` 註冊全域快捷鍵
- 建立獨立的 BrowserWindow 作為浮動搜尋面板（類似 Spotlight / Alfred）
- 支援 `Esc` 關閉、`Enter` 確認、`↑↓` 導航
- 面板應該在螢幕中央彈出，失去焦點時自動隱藏

#### 4.2 智能搜尋（Smart Search）

**概念**: 用自然語言描述需求來搜尋指令，而不只是關鍵字匹配。

**搜尋改進方案**:

| 層級 | 搜尋方式 | 說明 |
|------|----------|------|
| L1 | 模糊匹配 | 使用 Fuse.js 實現模糊搜尋，容忍拼字錯誤 |
| L2 | 多欄位加權搜尋 | 標題權重 > 指令內容權重 > 標籤權重 > 說明權重 |
| L3 | 頻率加權 | 最常用的指令排在前面 |
| L4 | Prompt 搜尋（進階） | 接入 LLM API，用自然語言描述需求來查找指令 |

#### 4.3 快速儲存功能（Quick Save）

**概念**: 在快速搜尋面板中，如果搜尋結果是從 Prompt/AI 產生的新指令，可以一鍵儲存。

**流程**:
```
用戶在快速面板輸入 Prompt → AI 產生指令建議
    ↓
用戶覺得有用 → 點擊「儲存」圖示
    ↓
彈出簡化版儲存對話框（標題 + 標籤）
    ↓
指令自動存入資料庫
```

---

### 📋 其他重要新功能

#### 4.4 指令使用追蹤（Usage Tracking）
- 記錄每次複製/使用的時間戳
- 在資料模型中增加 `usageCount` 和 `lastUsedAt` 欄位
- 支援「最近使用」和「最常使用」排序
- 在快速搜尋結果中優先顯示常用指令

#### 4.5 指令匯入/匯出
- 匯出為 JSON / CSV 格式
- 匯入其他工具的指令集（如 Dash、Snippet Manager 等）
- 支援選擇性匯出（按標籤、按收藏）
- 產生可分享的連結或檔案

#### 4.6 資料夾/分類系統
- 在現有標籤之上增加階層式分類
- 支援拖曳排序
- 側邊欄顯示樹狀結構
- 與標籤系統並存，不衝突

#### 4.7 指令模板市集（Community Templates）
- 提供預建的指令集模板（Git 常用、Docker 常用、SQL 常用等）
- 用戶可以一鍵匯入整個模板集
- 未來可擴展為社群分享平台

#### 4.8 系統匣常駐（System Tray）
- 關閉視窗時最小化到系統匣而非退出
- 系統匣右鍵選單提供快速存取
- 減少記憶體佔用（隱藏主視窗）
- 確保全域快捷鍵始終可用

#### 4.9 指令執行功能（Command Execution）
- 對於終端指令，支援直接在內建終端中執行
- 顯示執行結果
- 記錄執行歷史
- 安全警告機制（危險指令提示）

#### 4.10 多語言支援（i18n）
- 支援繁體中文、簡體中文、英文、日文等
- 使用 react-i18next 實現
- 包含介面翻譯和說明文件翻譯

---

## 五、開發優先級路線圖

### Phase 1 — 基礎修復（穩定性優先）
> 目標：修復所有嚴重和高嚴重性 Bug

| # | 任務 | 對應 Bug | 優先級 |
|---|------|----------|--------|
| 1 | 修復 Electron 安全漏洞（contextBridge + preload） | BUG-001 | 🔴 Critical |
| 2 | 修復 getAllUntaggedCommands 邏輯錯誤 | BUG-002 | 🔴 Critical |
| 3 | 修復所有正則表達式空值崩潰 | BUG-003 | 🟠 High |
| 4 | 修復 Api.js 中所有空值崩潰 | BUG-004, BUG-005 | 🟠 High |
| 5 | 加入 HTML 消毒（DOMPurify） | BUG-006 | 🟡 Medium |
| 6 | 修復記憶體洩漏（setInterval, IPC） | BUG-007, BUG-008 | 🟡 Medium |
| 7 | 加入檔案操作錯誤處理 | BUG-009 | 🟡 Medium |
| 8 | 修復 macOS activate 處理 | BUG-010 | 🟡 Medium |

### Phase 2 — 核心新功能（價值提升）
> 目標：實現全域快速搜尋面板

| # | 任務 | 對應提案 |
|---|------|----------|
| 1 | 實作系統匣常駐 | 4.8 |
| 2 | 實作全域快捷鍵 + 浮動搜尋面板 | 4.1 |
| 3 | 升級搜尋演算法（Fuse.js 模糊搜尋） | 4.2 L1-L2 |
| 4 | 加入使用頻率追蹤和排序 | 4.4 |
| 5 | 實作快速儲存功能 | 4.3 |

### Phase 3 — 進階功能（生態擴展）
> 目標：擴展功能邊界

| # | 任務 | 對應提案 |
|---|------|----------|
| 1 | 指令匯入/匯出 | 4.5 |
| 2 | 資料夾/分類系統 | 4.6 |
| 3 | Prompt/AI 智能搜尋 | 4.2 L4 |
| 4 | 指令執行功能 | 4.9 |

### Phase 4 — 技術債償還
> 目標：現代化技術棧

| # | 任務 | 對應 Bug |
|---|------|----------|
| 1 | 升級 Electron 到最新穩定版 | BUG-011 |
| 2 | 升級 React 到 18+ | BUG-011 |
| 3 | 遷移 node-sass 到 dart-sass | BUG-011 |
| 4 | Api 類別重構為單例模式 | BUG-012 |
| 5 | 遷移 Moment.js 到 date-fns | BUG-011 |
| 6 | 完善 PropTypes 或遷移到 TypeScript | BUG-013 |

---

## 快速參考：關鍵檔案路徑

| 用途 | 路徑 |
|------|------|
| Electron 主程序 | `public/electron.js` |
| 應用選單 | `public/menu.js` |
| React 根元件 | `src/App.js` |
| 資料庫存取層 | `src/core/Api.js` |
| 業務邏輯 | `src/core/Helpers.js` |
| 常數定義 | `src/core/Constants.js` |
| Redux Store | `src/redux/store.js` |
| 搜尋功能 | `src/components/FormElements/SearchField.js` |
| 指令 CRUD 彈窗 | `src/components/SnippetCrudModal/index.js` |
| 參數產生器 | `src/components/SnippetGeneratorModal/index.js` |
| 設定彈窗 | `src/components/SettingsModal/index.js` |
