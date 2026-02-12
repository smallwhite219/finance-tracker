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

                const result = await API.addRecord(sheetName, data);
                if (result.error) throw new Error(result.error);

                showToast('✅ 紀錄已新增', 'success');
                form.reset();
                // 設定今天日期
                form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);
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
                const result = await API.fetchRecords(sheetName);
                if (result.error) throw new Error(result.error);

                const records = result.records || [];
                renderTable(records);
                renderStats(records);
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

            tableBody.innerHTML = records.map(r => `
        <tr>
          <td>${r['代號']}</td>
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
      `).join('');
        }

        function renderStats(records) {
            if (records.length === 0) {
                statsEl.innerHTML = '<p class="stats-empty">尚無資料</p>';
                return;
            }

            // 按代號分組計算均價
            const grouped = {};
            records.forEach(r => {
                const sym = r['代號'];
                if (!grouped[sym]) grouped[sym] = { totalCost: 0, totalShares: 0 };
                const price = Number(r[priceKey]) || 0;
                const shares = Number(r['股數']) || 0;
                grouped[sym].totalCost += price * shares;
                grouped[sym].totalShares += shares;
            });

            statsEl.innerHTML = Object.entries(grouped).map(([sym, data]) => {
                const avg = data.totalShares > 0 ? (data.totalCost / data.totalShares) : 0;
                return `
          <div class="stat-item">
            <div>
              <div class="stat-symbol">${sym}</div>
              <div class="stat-shares">${formatNum(data.totalShares)} 股</div>
            </div>
            <div class="stat-detail">
              <div class="stat-avg">${currency} ${avg.toFixed(2)}</div>
              <div class="stat-shares">均價</div>
            </div>
          </div>
        `;
            }).join('');
        }

        function renderChart(records) {
            // 按代號分組計算總投資金額
            const grouped = {};
            records.forEach(r => {
                const sym = r['代號'];
                const price = Number(r[priceKey]) || 0;
                const shares = Number(r['股數']) || 0;
                if (!grouped[sym]) grouped[sym] = 0;
                grouped[sym] += price * shares;
            });

            const chartData = Object.entries(grouped).map(([label, value]) => ({
                label,
                value: Math.round(value * 100) / 100,
            }));

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
