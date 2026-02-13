/**
 * stock.js — 美股/台股共用邏輯
 */

const Stock = (() => {
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
        const targetsRow = document.getElementById(`${prefix}TargetsRow`);

        // 買入/賣出切換：賣出時隱藏停損停利等欄位
        if (typeSelect && targetsRow) {
            typeSelect.addEventListener('change', () => {
                targetsRow.style.display = typeSelect.value === '賣出' ? 'none' : '';
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
                    data[key] = val === '' ? '' : (isNaN(val) ? val : Number(val));
                });
                // 類型一定要是字串
                data['類型'] = formData.get('類型');

                const result = await API.addRecord(sheetName, data);
                if (result.error) throw new Error(result.error);

                const isSell = data['類型'] === '賣出';
                showToast(isSell ? '✅ 賣出紀錄已新增' : '✅ 買入紀錄已新增', 'success');
                form.reset();
                // 設定今天日期 & 重置類型
                form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);
                if (typeSelect) typeSelect.value = '買入';
                if (targetsRow) targetsRow.style.display = '';
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
                const prices = pricesResult.prices || {};
                renderTable(records);
                renderStats(records, prices);
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
                return `
        <tr style="${isSell ? 'background:rgba(239,68,68,0.05);' : ''}">
          <td>${r['代號']}</td>
          <td>${typeBadge}</td>
          <td>${r['日期']}</td>
          <td>${formatNum(r[priceKey])}</td>
          <td>${formatNum(r['股數'])}</td>
          <td>${r['停損價'] ? formatNum(r['停損價']) : '—'}</td>
          <td>${r['停利價'] ? formatNum(r['停利價']) : '—'}</td>
          <td>${r['加碼價'] ? formatNum(r['加碼價']) : '—'}</td>
          <td>${r['減碼價'] ? formatNum(r['減碼價']) : '—'}</td>
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
                .filter(([, value]) => value > 0) // 只顯示淨投入為正的
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

    return { init, deleteRow };
})();
