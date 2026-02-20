/**
 * stock.js — 美股/台股共用邏輯（含買入條件評比 & 賣出檢討）
 */

const Stock = (() => {
    // 快取各市場載入的紀錄, 供獲利計算使用
    const _cache = { us: [], tw: [] };

    /**
     * 初始化股票頁面
     * @param {string} market - 'us' | 'tw'
     */
    function init(market) {
        const sheetName = market === 'us' ? '美股' : '台股';
        const priceKey = market === 'us' ? '價格(USD)' : '價格(TWD)';
        const prefix = market === 'us' ? 'us' : 'tw';
        const currency = market === 'us' ? 'USD' : 'TWD';

        const form = document.getElementById(`${prefix}StockForm`);
        const tableBody = document.querySelector(`#${prefix}StockTable tbody`);
        const tableEmpty = document.getElementById(`${prefix}TableEmpty`);
        const chartId = `${prefix}StockChart`;
        const chartEmpty = `${prefix}ChartEmpty`;
        const statsEl = document.getElementById(`${prefix}StockStats`);
        const typeSelect = document.getElementById(`${prefix}Type`);
        const buySection = document.getElementById(`${prefix}BuySection`);
        const sellSection = document.getElementById(`${prefix}SellSection`);
        const symbolInput = document.getElementById(`${prefix}SymbolInput`);
        const priceInput = document.getElementById(`${prefix}PriceInput`);
        const sharesInput = document.getElementById(`${prefix}SharesInput`);
        const imageUpload = document.getElementById(`${prefix}ImageUpload`);
        const imagePreview = document.getElementById(`${prefix}ImagePreview`);

        // 買入/賣出切換
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const isSell = typeSelect.value === '賣出';
                if (buySection) buySection.style.display = isSell ? 'none' : '';
                if (sellSection) sellSection.style.display = isSell ? '' : 'none';
            });
        }

        // 賣出時 — 即時計算獲利
        const calcProfit = () => {
            if (typeSelect.value !== '賣出') return;
            const sym = (symbolInput?.value || '').trim().toUpperCase();
            const sellPrice = parseFloat(priceInput?.value) || 0;
            const sellShares = parseFloat(sharesInput?.value) || 0;
            const profitDisplay = document.getElementById(`${prefix}ProfitDisplay`);

            if (!sym || !sellPrice || !sellShares) {
                if (profitDisplay) profitDisplay.style.display = 'none';
                return;
            }

            // 從快取找出該代號的買入均價
            const records = _cache[market] || [];
            const buyRecords = records.filter(
                r => (r['代號'] || '').toString().toUpperCase() === sym && (r['類型'] || '買入') === '買入'
            );

            if (buyRecords.length === 0) {
                if (profitDisplay) profitDisplay.style.display = 'none';
                return;
            }

            let totalCost = 0, totalShares = 0;
            buyRecords.forEach(r => {
                const p = Number(r[priceKey]) || 0;
                const s = Number(r['股數']) || 0;
                totalCost += p * s;
                totalShares += s;
            });

            const avgBuy = totalShares > 0 ? totalCost / totalShares : 0;
            const diff = sellPrice - avgBuy;
            const profit = diff * sellShares;
            const roi = avgBuy > 0 ? (diff / avgBuy * 100) : 0;
            const isProfit = profit >= 0;

            if (profitDisplay) {
                profitDisplay.style.display = '';
                document.getElementById(`${prefix}AvgBuyPrice`).textContent = `${currency} ${avgBuy.toFixed(2)}`;
                document.getElementById(`${prefix}SellPrice`).textContent = `${currency} ${sellPrice.toFixed(2)}`;
                document.getElementById(`${prefix}PriceDiff`).textContent = `${diff >= 0 ? '+' : ''}${currency} ${diff.toFixed(2)}`;

                const amountEl = document.getElementById(`${prefix}ProfitAmount`);
                amountEl.textContent = `${profit >= 0 ? '+' : ''}${currency} ${profit.toFixed(2)}`;
                amountEl.style.color = isProfit ? '#22c55e' : '#ef4444';

                const roiEl = document.getElementById(`${prefix}ProfitRoi`);
                roiEl.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`;
                roiEl.style.color = isProfit ? '#22c55e' : '#ef4444';
            }
        };

        if (symbolInput) symbolInput.addEventListener('input', calcProfit);
        if (priceInput) priceInput.addEventListener('input', calcProfit);
        if (sharesInput) sharesInput.addEventListener('input', calcProfit);

        // 圖片預覽
        if (imageUpload) {
            imageUpload.addEventListener('change', () => {
                const file = imageUpload.files[0];
                if (file && imagePreview) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        imagePreview.innerHTML = `<img src="${e.target.result}" style="max-width:200px;max-height:150px;border-radius:8px;margin-top:8px;">`;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        // 載入資料
        loadData();

        // 表單送出
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = form.querySelector('.btn-primary');
            const btnText = btn.querySelector('.btn-text');
            const btnSpinner = btn.querySelector('.btn-spinner');

            btn.disabled = true;
            btnText.style.display = 'none';
            btnSpinner.style.display = 'inline';

            try {
                const formData = new FormData(form);
                const data = {};
                formData.forEach((val, key) => {
                    // 跳過 file input
                    if (key === 'file') return;
                    data[key] = val === '' ? '' : (isNaN(val) ? val : Number(val));
                });
                // 類型一定要是字串
                data['類型'] = formData.get('類型');

                const isSell = data['類型'] === '賣出';

                // 買入：收集 checkbox 組成買入條件字串
                if (!isSell) {
                    const conditions = [];
                    // 收益增長
                    if (form.querySelector('[name="chk_收益增長"]')?.checked) conditions.push('收益增長');

                    // 成交量POC (3個子選項)
                    const p9w = form.querySelector('[name="chk_POC_9w"]')?.checked ? '有' : '無';
                    const p6m = form.querySelector('[name="chk_POC_6m"]')?.checked ? '有' : '無';
                    const p1y = form.querySelector('[name="chk_POC_1y"]')?.checked ? '有' : '無';
                    conditions.push(`成交量POC[${p9w},${p6m},${p1y}]`);

                    // 其他單一項
                    if (form.querySelector('[name="chk_SMA200"]')?.checked) conditions.push('SMA200上');
                    if (form.querySelector('[name="chk_VWAP突破"]')?.checked) conditions.push('VWAP突破');
                    if (form.querySelector('[name="chk_損益比"]')?.checked) conditions.push('損益比>1');

                    data['買入條件'] = conditions.join(', ');

                    // 清除所有以 chk_ 開頭的 key (避免送到後端)
                    Object.keys(data).forEach(k => { if (k.startsWith('chk_')) delete data[k]; });
                }

                // 賣出：計算獲利 & 上傳圖片
                if (isSell) {
                    const sym = (data['代號'] || '').toString().toUpperCase();
                    const sellPrice = Number(data[priceKey]) || 0;
                    const sellShares = Number(data['股數']) || 0;
                    const records = _cache[market] || [];
                    const buyRecords = records.filter(
                        r => (r['代號'] || '').toString().toUpperCase() === sym && (r['類型'] || '買入') === '買入'
                    );

                    let avgBuy = 0;
                    if (buyRecords.length > 0) {
                        let tc = 0, ts = 0;
                        buyRecords.forEach(r => {
                            tc += (Number(r[priceKey]) || 0) * (Number(r['股數']) || 0);
                            ts += Number(r['股數']) || 0;
                        });
                        avgBuy = ts > 0 ? tc / ts : 0;
                    }

                    const profitAmt = (sellPrice - avgBuy) * sellShares;
                    const roi = avgBuy > 0 ? ((sellPrice - avgBuy) / avgBuy * 100) : 0;
                    data['獲利'] = Math.round(profitAmt * 100) / 100;
                    data['報酬率'] = Math.round(roi * 100) / 100 + '%';

                    // 上傳圖片
                    const fileInput = document.getElementById(`${prefix}ImageUpload`);
                    if (fileInput?.files?.length > 0) {
                        try {
                            const base64 = await fileToBase64(fileInput.files[0]);
                            const fileName = `${sym}_${data['日期'] || 'sell'}_${Date.now()}.${fileInput.files[0].name.split('.').pop()}`;
                            const uploadResult = await API.uploadImage(base64, fileName);
                            if (uploadResult.fileUrl) {
                                data['圖片連結'] = uploadResult.fileUrl;
                            }
                        } catch (uploadErr) {
                            console.error('Image upload error:', uploadErr);
                            showToast('⚠️ 圖片上傳失敗，紀錄仍會儲存', 'info');
                        }
                    }

                    // 清除買入專用欄位避免送到賣出紀錄
                    delete data['買入條件'];
                    delete data['股票類型'];
                    delete data['操作建議'];
                    delete data['目標價'];
                    delete data['AI判斷'];
                }

                const result = await API.addRecord(sheetName, data);
                if (result.error) throw new Error(result.error);

                showToast(isSell ? '✅ 賣出紀錄已新增' : '✅ 買入紀錄已新增', 'success');
                form.reset();
                // 設定今天日期 & 重置類型
                form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);
                if (typeSelect) typeSelect.value = '買入';
                if (buySection) buySection.style.display = '';
                if (sellSection) sellSection.style.display = 'none';
                if (imagePreview) imagePreview.innerHTML = '';
                const profitDisplay = document.getElementById(`${prefix}ProfitDisplay`);
                if (profitDisplay) profitDisplay.style.display = 'none';
                await loadData();
            } catch (err) {
                showToast('❌ ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btnText.style.display = 'inline';
                btnSpinner.style.display = 'none';
            }
        });

        // 設定今天日期為預設
        form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);

        async function loadData() {
            if (!API.isConfigured()) return;

            try {
                const [result, pricesResult] = await Promise.all([
                    API.fetchRecords(sheetName),
                    API.getPrices().catch(() => ({ prices: {} })),
                ]);
                if (result.error) throw new Error(result.error);

                const records = result.records || [];
                _cache[market] = records;
                renderTable(records);
                renderStats(records, pricesResult.prices || {});
                renderChart(records);
            } catch (err) {
                console.error(`Load ${sheetName} error:`, err);
            }
        }

        function renderTable(records) {
            if (records.length === 0) {
                tableBody.innerHTML = '';
                tableEmpty.style.display = 'block';
                document.querySelector(`#${prefix}StockTable`).style.display = 'none';
                return;
            }

            tableEmpty.style.display = 'none';
            document.querySelector(`#${prefix}StockTable`).style.display = 'table';

            tableBody.innerHTML = records.map(r => {
                const type = r['類型'] || '買入';
                const isSell = type === '賣出';
                const typeBadge = isSell
                    ? '<span style="color:#ef4444;font-weight:600;">賣出</span>'
                    : '<span style="color:#22c55e;font-weight:600;">買入</span>';

                // 條件/心得 欄
                let infoHtml = '';
                if (isSell) {
                    if (r['檢討心得']) {
                        infoHtml = `<span style="font-size:0.75rem;" title="${r['檢討心得']}">${truncate(r['檢討心得'], 20)}</span>`;
                    }
                    if (r['圖片連結']) {
                        infoHtml += ` <a href="${r['圖片連結']}" target="_blank" style="font-size:0.75rem;">📷</a>`;
                    }
                } else {
                    const parts = [];
                    if (r['買入條件']) parts.push(r['買入條件']);
                    if (r['股票類型']) parts.push(r['股票類型']);
                    if (r['操作建議']) parts.push(`[${r['操作建議']}]`);
                    infoHtml = `<span style="font-size:0.75rem;" title="${parts.join(' | ')}">${truncate(parts.join(' | '), 25)}</span>`;
                }

                // 獲利 欄
                let profitHtml = '—';
                if (isSell && r['獲利'] !== undefined && r['獲利'] !== '') {
                    const p = Number(r['獲利']);
                    const color = p >= 0 ? '#22c55e' : '#ef4444';
                    const sign = p >= 0 ? '+' : '';
                    profitHtml = `<span style="color:${color};font-weight:600;font-size:0.8rem;">${sign}${formatNum(p)}</span>`;
                    if (r['報酬率']) {
                        profitHtml += `<br><span style="color:${color};font-size:0.7rem;">${r['報酬率']}</span>`;
                    }
                }

                return `
        <tr style="${isSell ? 'background:rgba(239,68,68,0.05);' : ''}">
          <td>${r['代號']}</td>
          <td>${typeBadge}</td>
          <td>${r['日期']}</td>
          <td>${formatNum(r[priceKey])}</td>
          <td>${formatNum(r['股數'])}</td>
          <td>${infoHtml || '—'}</td>
          <td>${profitHtml}</td>
          <td>
            <button class="btn btn-danger" onclick="Stock.deleteRow('${sheetName}', ${r._row}, '${market}')">
              刪除
            </button>
          </td>
        </tr>
      `;
            }).join('');
        }

        function renderStats(records, prices) {
            if (records.length === 0) {
                statsEl.innerHTML = '<p class="stats-empty">尚無資料</p>';
                return;
            }

            // 按代號分組計算均價（考慮賣出）
            const grouped = {};
            records.forEach(r => {
                const sym = r['代號'];
                const type = r['類型'] || '買入';
                if (!grouped[sym]) grouped[sym] = { totalCost: 0, totalShares: 0, sellCost: 0, sellShares: 0 };
                const price = Number(r[priceKey]) || 0;
                const shares = Number(r['股數']) || 0;
                if (type === '賣出') {
                    grouped[sym].sellCost += price * shares;
                    grouped[sym].sellShares += shares;
                } else {
                    grouped[sym].totalCost += price * shares;
                    grouped[sym].totalShares += shares;
                }
            });

            statsEl.innerHTML = Object.entries(grouped).map(([sym, data]) => {
                const netShares = data.totalShares - data.sellShares;
                const avgBuy = data.totalShares > 0 ? (data.totalCost / data.totalShares) : 0;
                const currentPrice = prices[sym] ? prices[sym].price : null;

                let sharesLabel = `${formatNum(netShares)} 股`;
                if (data.sellShares > 0) {
                    sharesLabel += ` <span style="color:#ef4444;font-size:0.7rem;">(已賣 ${formatNum(data.sellShares)})</span>`;
                }

                let priceHtml = '';
                let plHtml = '';

                if (currentPrice !== null && netShares > 0) {
                    const totalPL = (currentPrice - avgBuy) * netShares;
                    const roi = avgBuy > 0 ? ((currentPrice - avgBuy) / avgBuy * 100) : 0;
                    const isProfit = totalPL >= 0;
                    const plColor = isProfit ? '#22c55e' : '#ef4444';
                    const plSign = isProfit ? '+' : '';

                    priceHtml = `
                        <div class="stat-current">
                            <span style="color:var(--text-muted);font-size:0.75rem;">現價</span>
                            <span style="font-weight:600;">${currency} ${formatNum(currentPrice)}</span>
                        </div>
                    `;
                    plHtml = `
                        <div style="display:flex;gap:12px;margin-top:4px;">
                            <span style="color:${plColor};font-size:0.8rem;font-weight:600;">
                                ${plSign}${currency} ${formatNum(totalPL.toFixed(2))}
                            </span>
                            <span style="color:${plColor};font-size:0.8rem;font-weight:700;background:${isProfit ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'};padding:2px 8px;border-radius:6px;">
                                ${plSign}${roi.toFixed(2)}%
                            </span>
                        </div>
                    `;
                }

                // 已全部賣出的標記
                const soldOut = netShares <= 0 && data.sellShares > 0;

                return `
          <div class="stat-item" style="flex-wrap:wrap;${soldOut ? 'opacity:0.5;' : ''}">
            <div>
              <div class="stat-symbol">${sym}${soldOut ? ' <span style="font-size:0.7rem;color:#ef4444;">已清倉</span>' : ''}</div>
              <div class="stat-shares">${sharesLabel}</div>
            </div>
            <div class="stat-detail">
              <div class="stat-avg">${currency} ${avgBuy.toFixed(2)}</div>
              <div class="stat-shares">均價</div>
              ${priceHtml}
              ${plHtml}
            </div>
          </div>
        `;
            }).join('');
        }

        function renderChart(records) {
            // 按代號分組計算淨投資金額（買入 - 賣出）
            const grouped = {};
            records.forEach(r => {
                const sym = r['代號'];
                const type = r['類型'] || '買入';
                const price = Number(r[priceKey]) || 0;
                const shares = Number(r['股數']) || 0;
                if (!grouped[sym]) grouped[sym] = 0;
                if (type === '賣出') {
                    grouped[sym] -= price * shares;
                } else {
                    grouped[sym] += price * shares;
                }
            });

            const chartData = Object.entries(grouped)
                .filter(([, value]) => value > 0)
                .map(([label, value]) => ({
                    label,
                    value: Math.round(value * 100) / 100,
                }))
                .sort((a, b) => b.value - a.value);

            ChartHelper.createPieChart(chartId, chartData, chartEmpty);
        }
    }

    async function deleteRow(sheetName, row, market) {
        if (!confirm('確定要刪除這筆紀錄？')) return;

        try {
            const result = await API.deleteRecord(sheetName, row);
            if (result.error) throw new Error(result.error);
            showToast('🗑️ 已刪除', 'success');
            // 重新載入
            init(market);
        } catch (err) {
            showToast('❌ ' + err.message, 'error');
        }
    }

    function formatNum(n) {
        if (n === '' || n === undefined || n === null) return '—';
        const num = Number(n);
        if (isNaN(num)) return n;
        return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }

    function truncate(str, len) {
        if (!str) return '';
        str = String(str);
        return str.length > len ? str.slice(0, len) + '…' : str;
    }

    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:... prefix
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return { init, deleteRow };
})();
