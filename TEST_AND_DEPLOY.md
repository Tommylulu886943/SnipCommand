# SnipCommand 測試與部署指南

> 建立日期：2026-03-04

---

## 目錄

- [一、環境準備](#一環境準備)
- [二、安裝依賴](#二安裝依賴)
- [三、開發模式](#三開發模式)
- [四、測試](#四測試)
- [五、建構與打包](#五建構與打包)
- [六、已知注意事項](#六已知注意事項)

---

## 一、環境準備

### 必要工具

| 工具 | 建議版本 | 說明 |
|------|---------|------|
| **Node.js** | 14.x 或 16.x | 專案使用較舊的依賴，Node 18+ 可能有相容性問題 |
| **Yarn** | 1.x (Classic) | 專案使用 `yarn.lock`，建議用 Yarn 安裝 |
| **npm** | 6.x+ | 若無 Yarn，npm 也可用 |
| **Python** | 2.7 或 3.x | `node-sass` 編譯需要 |
| **C++ Build Tools** | — | `node-sass` 需要原生編譯環境 |

### 各平台額外需求

**Windows:**
```bash
# 安裝 windows-build-tools（管理員權限）
npm install --global windows-build-tools
```

**macOS:**
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install build-essential libx11-dev libxkbfile-dev
```

---

## 二、安裝依賴

```bash
# 進入專案目錄
cd SnipCommand-master

# 使用 Yarn（推薦，因為有 yarn.lock）
yarn install

# 或使用 npm
npm install
```

### node-sass 編譯問題

`node-sass` 是原生模組，容易在不同 Node 版本間出問題。如果遇到編譯錯誤：

```bash
# 方法 1：重新建構原生模組
npm rebuild node-sass

# 方法 2：如果 Node 版本太新，使用 nvm 切換
nvm install 16
nvm use 16
yarn install
```

> **提示**: Phase 4 計劃將 `node-sass` 遷移到 `dart-sass (sass)`，屆時就不再有原生編譯問題。

---

## 三、開發模式

### 啟動 Electron 開發環境（推薦）

```bash
yarn electron-dev
```

此命令會同時：
1. 啟動 React 開發伺服器（`http://localhost:3000`，瀏覽器不會自動開啟）
2. 等待開發伺服器就緒後啟動 Electron 視窗
3. 自動開啟 Chrome DevTools

**底層原理：**
```
concurrently
  ├── cross-env BROWSER=none yarn start    → React Dev Server (port 3000)
  └── wait-on http://localhost:3000 && electron .  → Electron Window
```

### 只啟動 React（純網頁模式，無 Electron 功能）

```bash
yarn start
```

> ⚠️ 注意：純網頁模式下，所有 Electron API（clipboard、ipcRenderer、fs 等）都無法使用，會看到錯誤。此模式僅適合純 UI 開發。

### 開發時熱更新

- React 元件修改 → 自動熱更新（HMR）
- Electron 主進程修改（`public/electron.js`、`public/menu.js`）→ 需手動重啟
  - 在 Electron 視窗按 `Ctrl+R`（或 `Cmd+R`）重新載入渲染進程
  - 若修改了主進程檔案，需要關閉並重新執行 `yarn electron-dev`

---

## 四、測試

### 現有測試框架

- **測試框架**: Jest（透過 Create React App 內建）
- **測試工具**: @testing-library/react、@testing-library/jest-dom
- **測試檔案**: `src/App.test.js`（目前只有一個預設的 CRA 測試）

### 執行測試

```bash
# 互動式監聽模式（開發時使用）
yarn test

# 單次執行（CI 環境）
CI=true yarn test

# 帶覆蓋率報告
CI=true yarn test -- --coverage
```

### 現有測試的問題

目前 `App.test.js` 是 CRA 預設模板，測試的是 "learn react" 文字，與實際應用無關，執行後會**失敗**：

```javascript
// src/App.test.js（現有 — 會失敗）
test('renders learn react link', () => {
  const { getByText } = render(<App />);
  const linkElement = getByText(/learn react/i);  // App 裡沒有這段文字
  expect(linkElement).toBeInTheDocument();
});
```

此外，`App` 元件在初始化時會呼叫 `electron-store` 和 `fs` 模組，在純 Jest 環境中也會失敗。

### 手動測試清單（Phase 1 修復驗證）

在 `yarn electron-dev` 啟動後，依序驗證以下項目：

#### BUG-001: Electron 安全修復
- [ ] 應用正常啟動，無 `remote` 相關報錯
- [ ] 【Windows】標題列按鈕（最小化/最大化/關閉）正常運作
- [ ] 【Windows】點擊漢堡選單圖示彈出應用選單
- [ ] 【macOS】點擊 Dock 圖示能重新開啟視窗（BUG-010）

#### BUG-002: 未標記指令
- [ ] 建立一個不帶標籤的指令
- [ ] 點擊側邊欄「Untagged」，確認該指令出現在列表中

#### BUG-003/004/005: 空值崩潰
- [ ] 建立包含動態參數的指令，正常顯示
- [ ] 建立不含任何標籤的指令，按標籤過濾不會崩潰
- [ ] 搜尋框輸入文字，搜尋不會崩潰

#### BUG-006: XSS 防護
- [ ] 建立一個指令，內容包含 `<script>alert(1)</script>`，確認不會執行腳本
- [ ] 指令的 HTML 標籤應被跳脫顯示為純文字

#### BUG-007/008: 記憶體洩漏
- [ ] 應用運行一段時間後無明顯記憶體增長（可在 DevTools → Memory 觀察）

#### BUG-009: 檔案操作
- [ ] 設定 → Storage → Backup Now，備份成功並顯示通知
- [ ] 設定 → Storage → Move Directory，移動成功
- [ ] 設定 → Storage → Restore，恢復成功

---

## 五、建構與打包

### 步驟 1：建構 React 前端

```bash
yarn build
```

產出目錄：`build/`（包含編譯後的 HTML、JS、CSS）

### 步驟 2：打包為安裝程式

```bash
# 建構 + 打包（一步完成）
yarn release
```

等同於執行：
```bash
rescripts build && electron-builder
```

### 各平台產出

打包產出位於 `app/` 目錄：

| 平台 | 格式 | 產出路徑 |
|------|------|---------|
| **Windows** | `.exe` 安裝程式 | `app/SnipCommand Setup x.x.x.exe` |
| **macOS** | `.dmg` 安裝映像 | `app/SnipCommand-x.x.x.dmg` |
| **Linux** | `.AppImage` | `app/SnipCommand-x.x.x.AppImage` |

### 跨平台打包

electron-builder 預設只打包當前作業系統的安裝程式。如需跨平台打包：

```bash
# 指定平台
yarn release --mac
yarn release --win
yarn release --linux

# macOS 可以打包所有平台（需額外設定）
yarn release -mwl
```

> ⚠️ Windows 上無法打包 macOS `.dmg`，需要 macOS 環境。
>
> ⚠️ 跨平台打包建議使用 CI/CD（如 GitHub Actions）。

### 打包設定參考

`package.json` 中的 `build` 欄位控制 electron-builder 行為：

```json
{
  "build": {
    "productName": "SnipCommand",
    "appId": "com.snipcommand.app",
    "directories": { "output": "app" },
    "files": ["build/**/*"],
    "mac": { "icon": "public/images/app.icns" },
    "win": { "icon": "public/images/app.ico" },
    "linux": {
      "icon": "public/images/logo/snip_command.png",
      "target": ["AppImage"]
    }
  }
}
```

---

## 六、已知注意事項

### Node.js 版本相容性

此專案的依賴較舊，推薦使用 **Node 14 或 16**。主要瓶頸：

| 依賴 | 問題 | Node 18+ 影響 |
|------|------|---------------|
| `node-sass@4.14.1` | 原生模組 | 編譯失敗 |
| `react-scripts@3.4.1` | OpenSSL 變更 | 可能需要 `NODE_OPTIONS=--openssl-legacy-provider` |
| `electron@9.1.0` | 舊版 Chromium | 功能正常但有安全警告 |

如果必須使用 Node 18+：
```bash
# Linux/macOS
export NODE_OPTIONS=--openssl-legacy-provider
yarn start

# Windows (PowerShell)
$env:NODE_OPTIONS="--openssl-legacy-provider"
yarn start

# Windows (CMD)
set NODE_OPTIONS=--openssl-legacy-provider
yarn start
```

### 資料庫位置

應用的資料儲存在使用者家目錄：

| 平台 | 路徑 |
|------|------|
| Windows | `%USERPROFILE%\snipCommand\snipcommand.db` |
| macOS/Linux | `~/snipCommand/snipcommand.db` |
| 備份 | 同目錄下的 `backups/` 資料夾 |

### 開發除錯技巧

```bash
# 在 Electron 視窗中開啟 DevTools
# 快捷鍵：Ctrl+Shift+I (Windows/Linux) 或 Cmd+Option+I (macOS)
# 或從選單：View → Toggle DevTools

# 查看渲染進程的 console 輸出
# → DevTools → Console 分頁

# 查看主進程的 console 輸出
# → 啟動 electron-dev 的終端機視窗
```

---

## 快速參考

```bash
# 安裝
yarn install

# 開發
yarn electron-dev

# 測試
CI=true yarn test

# 建構 + 打包
yarn release

# 僅建構前端
yarn build
```
