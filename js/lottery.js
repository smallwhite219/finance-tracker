/**
 * lottery.js — 樂透紀錄邏輯
 */

const Lottery = (() => {
    const SHEET_NAME = '樂透';

    function init() {
        const form = document.getElementById('lotteryForm');
        const tableBody = document.querySelector('#lotteryTable tbody');
        const tableEmpty = document.getElementById('lotteryTableEmpty');

        loadData();

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

                const result = await API.addRecord(SHEET_NAME, data);
                if (result.error) throw new Error(result.error);

                showToast('✅ 樂透紀錄已新增', 'success');
                form.reset();
                form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);
                form.querySelector('input[name="中獎金額"]').value = '0';
                await loadData();
            } catch (err) {
                showToast('❌ ' + err.message, 'error');
            } finally {
                btn.disabled = false;
                btnText.style.display = 'inline';
                btnSpinner.style.display = 'none';
            }
        });

        // 設定預設值
        form.querySelector('input[name="日期"]').value = new Date().toISOString().slice(0, 10);

        async function loadData() {
            if (!API.isConfigured()) return;

            try {
                const result = await API.fetchRecords(SHEET_NAME);
                if (result.error) throw new Error(result.error);

                const records = result.records || [];
                renderTable(records);
                renderStats(records);
            } catch (err) {
                console.error('Load lottery error:', err);
            }
        }

        function renderTable(records) {
            if (records.length === 0) {
                tableBody.innerHTML = '';
                tableEmpty.style.display = 'block';
                document.querySelector('#lotteryTable').style.display = 'none';
                return;
            }

            tableEmpty.style.display = 'none';
            document.querySelector('#lotteryTable').style.display = 'table';

            tableBody.innerHTML = records.map(r => `
        <tr>
          <td>${r['日期']}</td>
          <td>${r['期數']}</td>
          <td>${r['號碼'] || '—'}</td>
          <td>$${Number(r['花費'] || 0).toLocaleString()}</td>
          <td class="${Number(r['中獎金額']) > 0 ? 'win-cell' : ''}">
            $${Number(r['中獎金額'] || 0).toLocaleString()}
          </td>
          <td>
            <button class="btn btn-danger" onclick="Lottery.deleteRow(${r._row})">
              刪除
            </button>
          </td>
        </tr>
      `).join('');
        }

        function renderStats(records) {
            let totalSpent = 0;
            let totalWon = 0;

            records.forEach(r => {
                totalSpent += Number(r['花費'] || 0);
                totalWon += Number(r['中獎金額'] || 0);
            });

            const net = totalWon - totalSpent;

            document.getElementById('lotteryTotalSpent').textContent = `$${totalSpent.toLocaleString()}`;
            document.getElementById('lotteryTotalWon').textContent = `$${totalWon.toLocaleString()}`;

            const netEl = document.getElementById('lotteryNet');
            netEl.textContent = `${net >= 0 ? '+' : ''}$${net.toLocaleString()}`;
            netEl.className = `stat-value ${net >= 0 ? 'win' : 'loss'}`;
        }
    }

    async function deleteRow(row) {
        if (!confirm('確定要刪除這筆紀錄？')) return;

        try {
            const result = await API.deleteRecord(SHEET_NAME, row);
            if (result.error) throw new Error(result.error);
            showToast('🗑️ 已刪除', 'success');
            init();
        } catch (err) {
            showToast('❌ ' + err.message, 'error');
        }
    }

    return { init, deleteRow };
})();
