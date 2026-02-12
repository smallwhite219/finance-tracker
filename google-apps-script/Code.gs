/**
 * 記帳系統 — Google Apps Script Backend
 * 部署方式：在 Google Sheet 中開啟 Apps Script 編輯器，貼上此程式碼，部署為 Web App
 * Web App 設定：執行身分 = 自己，存取權限 = 任何人
 */

const SHEET_ID = '1ACCtJ7BgNc_L4LCcTFT6hyb71ve5csUSuzs2GCkMRpg';

// ========== Web API ==========

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const params = e.parameter;
  const action = params.action || '';
  const sheetName = params.sheet || '';

  let result;

  try {
    switch (action) {
      case 'getAll':
        result = getAllRecords(sheetName);
        break;
      case 'add':
        const postData = JSON.parse(e.postData.contents);
        result = addRecord(sheetName, postData);
        break;
      case 'delete':
        const row = parseInt(params.row);
        result = deleteRecord(sheetName, row);
        break;
      case 'getPrices':
        result = getCurrentPrices();
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========== CRUD ==========

function getAllRecords(sheetName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { headers: data[0] || [], records: [] };

  const headers = data[0];
  const records = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      let val = data[i][j];
      // 日期格式化
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      row[headers[j]] = val;
    }
    row._row = i + 1; // 1-indexed row number for deletion
    records.push(row);
  }
  return { headers, records };
}

function addRecord(sheetName, data) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(sheetName);

  // 如果工作表不存在，自動建立
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headers = getDefaultHeaders(sheetName);
    sheet.appendRow(headers);
    // 設定標題列格式
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#4a86c8')
      .setFontColor('#ffffff');
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = headers.map(h => data[h] !== undefined ? data[h] : '');
  sheet.appendRow(row);

  return { success: true, row: sheet.getLastRow() };
}

function deleteRecord(sheetName, rowNum) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { error: 'Sheet not found: ' + sheetName };

  sheet.deleteRow(rowNum);
  return { success: true };
}

function getDefaultHeaders(sheetName) {
  switch (sheetName) {
    case '美股':
      return ['代號', '日期', '價格(USD)', '股數', '停損價', '停利價', '加碼價', '減碼價'];
    case '台股':
      return ['代號', '日期', '價格(TWD)', '股數', '停損價', '停利價', '加碼價', '減碼價'];
    case '樂透':
      return ['日期', '期數', '號碼', '花費', '中獎金額'];
    default:
      return [];
  }
}

// ========== 股價抓取 ==========

function getCurrentPrices() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const prices = {};

  // 從美股工作表取得所有代號
  const usSheet = ss.getSheetByName('美股');
  if (usSheet && usSheet.getLastRow() > 1) {
    const usSymbols = [...new Set(
      usSheet.getRange(2, 1, usSheet.getLastRow() - 1, 1).getValues().flat().filter(s => s)
    )];
    usSymbols.forEach(symbol => {
      try {
        const price = fetchUSStockPrice(symbol);
        if (price) prices[symbol] = { price, market: 'us' };
      } catch (e) {
        Logger.log('Error fetching US price for ' + symbol + ': ' + e.message);
      }
    });
  }

  // 從台股工作表取得所有代號
  const twSheet = ss.getSheetByName('台股');
  if (twSheet && twSheet.getLastRow() > 1) {
    const twSymbols = [...new Set(
      twSheet.getRange(2, 1, twSheet.getLastRow() - 1, 1).getValues().flat().filter(s => s)
    )];
    twSymbols.forEach(symbol => {
      try {
        const price = fetchTWStockPrice(symbol);
        if (price) prices[symbol] = { price, market: 'tw' };
      } catch (e) {
        Logger.log('Error fetching TW price for ' + symbol + ': ' + e.message);
      }
    });
  }

  return { prices };
}

function fetchUSStockPrice(symbol) {
  // 使用 Google Finance（透過在 Sheet 中放入 GOOGLEFINANCE 公式來取值）
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let monitorSheet = ss.getSheetByName('股價監控');
  if (!monitorSheet) {
    monitorSheet = ss.insertSheet('股價監控');
    monitorSheet.getRange('A1').setValue('代號');
    monitorSheet.getRange('B1').setValue('市場');
    monitorSheet.getRange('C1').setValue('現價');
  }

  // 找到對應的 row 或建立新的
  const lastRow = monitorSheet.getLastRow();
  let targetRow = -1;
  if (lastRow > 1) {
    const symbols = monitorSheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    targetRow = symbols.indexOf(symbol);
    if (targetRow !== -1) targetRow += 2;
  }

  if (targetRow === -1) {
    targetRow = lastRow + 1;
    monitorSheet.getRange(targetRow, 1).setValue(symbol);
    monitorSheet.getRange(targetRow, 2).setValue('US');
    monitorSheet.getRange(targetRow, 3).setFormula('=GOOGLEFINANCE("' + symbol + '","price")');
    SpreadsheetApp.flush();
    Utilities.sleep(2000); // 等待公式計算
  }

  const price = monitorSheet.getRange(targetRow, 3).getValue();
  return typeof price === 'number' ? price : null;
}

function fetchTWStockPrice(symbol) {
  try {
    // TWSE API - 取得個股盤後資訊
    const today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
    const url = 'https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=' + today + '&stockNo=' + symbol;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());

    if (json.stat === 'OK' && json.data && json.data.length > 0) {
      const lastDay = json.data[json.data.length - 1];
      // 收盤價在第 6 欄 (index 6)
      const closePrice = parseFloat(lastDay[6].replace(/,/g, ''));
      return closePrice;
    }
  } catch (e) {
    Logger.log('TWSE API error for ' + symbol + ': ' + e.message);
  }

  // Fallback: 嘗試用 mis.twse.com.tw 即時報價
  try {
    const url = 'https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_' + symbol + '.tw';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const json = JSON.parse(response.getContentText());
    if (json.msgArray && json.msgArray.length > 0) {
      const price = parseFloat(json.msgArray[0].z);
      if (!isNaN(price)) return price;
    }
  } catch (e) {
    Logger.log('TWSE realtime API error for ' + symbol + ': ' + e.message);
  }

  return null;
}

// ========== 價格監控 + LINE Notify ==========

function checkPriceAlerts() {
  const pricesData = getCurrentPrices();
  const prices = pricesData.prices;
  const alerts = [];

  const ss = SpreadsheetApp.openById(SHEET_ID);

  ['美股', '台股'].forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return;

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    for (let i = 1; i < data.length; i++) {
      const row = {};
      headers.forEach((h, j) => row[h] = data[i][j]);

      const symbol = row['代號'];
      const priceKey = sheetName === '美股' ? '價格(USD)' : '價格(TWD)';
      const currentPrice = prices[symbol] ? prices[symbol].price : null;
      if (!currentPrice) continue;

      // 檢查四個目標價
      if (row['停損價'] && currentPrice <= row['停損價']) {
        alerts.push(`🔴 停損警報！${symbol} 現價 ${currentPrice}，已觸及停損價 ${row['停損價']}`);
      }
      if (row['停利價'] && currentPrice >= row['停利價']) {
        alerts.push(`🟢 停利通知！${symbol} 現價 ${currentPrice}，已達停利價 ${row['停利價']}`);
      }
      if (row['加碼價'] && currentPrice <= row['加碼價']) {
        alerts.push(`🔵 加碼時機！${symbol} 現價 ${currentPrice}，已達加碼價 ${row['加碼價']}`);
      }
      if (row['減碼價'] && currentPrice >= row['減碼價']) {
        alerts.push(`🟡 減碼提醒！${symbol} 現價 ${currentPrice}，已達減碼價 ${row['減碼價']}`);
      }
    }
  });

  if (alerts.length > 0) {
    const message = '\n📊 投資提醒\n' + alerts.join('\n');
    sendLineNotify(message);
  }

  return { alerts };
}

function sendLineNotify(message) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let settingsSheet = ss.getSheetByName('設定');
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet('設定');
    settingsSheet.getRange('A1').setValue('LINE_NOTIFY_TOKEN');
    settingsSheet.getRange('B1').setValue('在此貼上你的 LINE Notify Token');
    return;
  }

  const token = settingsSheet.getRange('B1').getValue();
  if (!token || token === '在此貼上你的 LINE Notify Token') {
    Logger.log('LINE Notify Token 未設定');
    return;
  }

  const options = {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + token
    },
    payload: {
      message: message
    }
  };

  try {
    UrlFetchApp.fetch('https://notify-api.line.me/api/notify', options);
    Logger.log('LINE Notify sent successfully');
  } catch (e) {
    Logger.log('LINE Notify error: ' + e.message);
  }
}

// ========== 初始化 ==========

/**
 * 首次執行：建立所有工作表 + 設定定時觸發器
 */
function initialize() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // 建立工作表
  ['美股', '台股', '樂透'].forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sheet = ss.insertSheet(name);
      const headers = getDefaultHeaders(name);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4a86c8')
        .setFontColor('#ffffff');
    }
  });

  // 建立設定表
  if (!ss.getSheetByName('設定')) {
    const sheet = ss.insertSheet('設定');
    sheet.getRange('A1').setValue('LINE_NOTIFY_TOKEN');
    sheet.getRange('B1').setValue('在此貼上你的 LINE Notify Token');
  }

  // 設定定時觸發器（每 30 分鐘檢查一次）
  const triggers = ScriptApp.getProjectTriggers();
  const hasAlertTrigger = triggers.some(t => t.getHandlerFunction() === 'checkPriceAlerts');
  if (!hasAlertTrigger) {
    ScriptApp.newTrigger('checkPriceAlerts')
      .timeBased()
      .everyMinutes(30)
      .create();
  }

  Logger.log('初始化完成！');
}
