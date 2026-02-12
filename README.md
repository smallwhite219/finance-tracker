# 投資記帳系統 (Finance Tracker)

投資記帳系統 — 追蹤美股、台股投資與樂透紀錄。

## 功能

- 📈 美股 / 台股投資記錄、均價計算、圓餅圖佔比
- 🔔 停損、停利、加碼、減碼 價格監控 + LINE 通知
- 🎰 樂透紀錄與損益統計
- ☁️ 資料存儲於 Google Sheets

## 部署

此專案部署在 GitHub Pages，前端為純 HTML/CSS/JS。

### 後端部署（Google Apps Script）

1. 開啟你的 [Google Sheet](https://docs.google.com/spreadsheets/d/1ACCtJ7BgNc_L4LCcTFT6hyb71ve5csUSuzs2GCkMRpg/edit)
2. 點選「擴充功能」→「Apps Script」
3. 將 `google-apps-script/Code.gs` 的內容貼入編輯器
4. 點選「部署」→「新增部署作業」
5. 類型選「網頁應用程式」
6. 執行身分 = **自己**，存取權限 = **所有人**
7. 點「部署」，複製產生的 URL
8. 首次部署後，在 Apps Script 編輯器中執行 `initialize` 函數

### LINE Notify 設定

1. 前往 <https://notify-bot.line.me/>
2. 登入後點「我的頁面」→「發行存取權杖」
3. 命名並選擇接收通知的聊天室
4. 將 Token 貼到 Google Sheet 裡的「設定」工作表 B1 欄

### 前端設定

1. 開啟部署後的網頁
2. 點擊右下角 ⚙️ 齒輪
3. 貼入上面取得的 Apps Script Web App URL
4. 完成！
