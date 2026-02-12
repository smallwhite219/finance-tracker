/**
 * overview.js — 投資總覽頁面邏輯
 * 顯示台股 vs 美股市場配置圓餅圖 + 個股細項圓餅圖
 */

const Overview = (() => {
    async function init() {
        if (!API.isConfigured()) return;

        try {
            const [usResult, twResult] = await Promise.all([
                API.fetchRecords('美股'),
                API.fetchRecords('台股'),
            ]);

            const usRecords = usResult.records || [];
            const twRecords = twResult.records || [];

            // 計算各市場總投資額
            const usTotal = calcTotal(usRecords, '價格(USD)');
            const twTotal = calcTotal(twRecords, '價格(TWD)');

            // 1) 市場配置圓餅圖（台股 vs 美股，由高到低）
            const marketData = [
                { label: '🇹🇼 台股', value: Math.round(twTotal * 100) / 100 },
                { label: '🇺🇸 美股', value: Math.round(usTotal * 100) / 100 },
            ].sort((a, b) => b.value - a.value);

            ChartHelper.createPieChart('overviewMarketChart', marketData, 'overviewMarketChartEmpty');

            // 2) 市場統計
            renderMarketStats(usTotal, twTotal);

            // 3) 台股個股佔比圓餅圖
            const twStockData = calcStockBreakdown(twRecords, '價格(TWD)');
            ChartHelper.createPieChart('overviewTwChart', twStockData, 'overviewTwChartEmpty');

            // 4) 美股個股佔比圓餅圖
            const usStockData = calcStockBreakdown(usRecords, '價格(USD)');
            ChartHelper.createPieChart('overviewUsChart', usStockData, 'overviewUsChartEmpty');

        } catch (err) {
            console.error('Overview load error:', err);
        }
    }

    function calcTotal(records, priceKey) {
        return records.reduce((sum, r) => {
            return sum + (Number(r[priceKey]) || 0) * (Number(r['股數']) || 0);
        }, 0);
    }

    function calcStockBreakdown(records, priceKey) {
        const grouped = {};
        records.forEach(r => {
            const sym = r['代號'];
            const cost = (Number(r[priceKey]) || 0) * (Number(r['股數']) || 0);
            if (!grouped[sym]) grouped[sym] = 0;
            grouped[sym] += cost;
        });

        return Object.entries(grouped)
            .map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }))
            .sort((a, b) => b.value - a.value);
    }

    function renderMarketStats(usTotal, twTotal) {
        const total = usTotal + twTotal;
        const statsEl = document.getElementById('overviewMarketStats');

        if (total === 0) {
            statsEl.innerHTML = '<p class="stats-empty">尚無資料</p>';
            return;
        }

        const usPct = ((usTotal / total) * 100).toFixed(1);
        const twPct = ((twTotal / total) * 100).toFixed(1);

        // 按總額由高到低排序
        const items = [
            { icon: '🇹🇼', label: '台股', total: twTotal, pct: twPct, currency: 'TWD' },
            { icon: '🇺🇸', label: '美股', total: usTotal, pct: usPct, currency: 'USD' },
        ].sort((a, b) => b.total - a.total);

        statsEl.innerHTML = items.map(m => `
      <div class="stat-item">
        <div>
          <div class="stat-symbol">${m.icon} ${m.label}</div>
          <div class="stat-shares">${m.pct}%</div>
        </div>
        <div class="stat-detail">
          <div class="stat-avg">${m.currency} ${m.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div class="stat-shares">總投資額</div>
        </div>
      </div>
    `).join('') + `
      <div class="stat-item" style="border-top: 2px solid rgba(255,255,255,0.1); margin-top: 8px; padding-top: 16px;">
        <div>
          <div class="stat-symbol">💰 合計</div>
        </div>
        <div class="stat-detail">
          <div class="stat-avg" style="color: #22d3ee;">$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div class="stat-shares">總投資額（混合幣別）</div>
        </div>
      </div>
    `;
    }

    return { init };
})();
