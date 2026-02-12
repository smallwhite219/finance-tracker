/**
 * overview.js — 投資總覽頁面邏輯
 * 顯示台股 vs 美股市場配置圓餅圖 + 個股細項圓餅圖
 * 所有金額統一換算為 TWD 後再比較
 */

const Overview = (() => {
    const FALLBACK_RATE = 32.5; // 備用匯率

    async function fetchExchangeRate() {
        try {
            const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            const data = await res.json();
            return data.rates.TWD || FALLBACK_RATE;
        } catch {
            console.warn('匯率 API 無法取得，使用備用匯率:', FALLBACK_RATE);
            return FALLBACK_RATE;
        }
    }

    async function init() {
        if (!API.isConfigured()) return;

        try {
            const [usResult, twResult, usdToTwd] = await Promise.all([
                API.fetchRecords('美股'),
                API.fetchRecords('台股'),
                fetchExchangeRate(),
            ]);

            const usRecords = usResult.records || [];
            const twRecords = twResult.records || [];

            // 原幣總額
            const usTotalUSD = calcTotal(usRecords, '價格(USD)');
            const twTotalTWD = calcTotal(twRecords, '價格(TWD)');

            // 統一換算為 TWD
            const usTotalTWD = usTotalUSD * usdToTwd;
            const grandTotalTWD = usTotalTWD + twTotalTWD;

            // 1) 市場配置圓餅圖（統一 TWD，由高到低）
            const marketData = [
                { label: '🇹🇼 台股', value: Math.round(twTotalTWD) },
                { label: '🇺🇸 美股', value: Math.round(usTotalTWD) },
            ].sort((a, b) => b.value - a.value);

            ChartHelper.createPieChart('overviewMarketChart', marketData, 'overviewMarketChartEmpty');

            // 2) 市場統計
            renderMarketStats(usTotalUSD, usTotalTWD, twTotalTWD, grandTotalTWD, usdToTwd);

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

    function renderMarketStats(usTotalUSD, usTotalTWD, twTotalTWD, grandTotalTWD, rate) {
        const statsEl = document.getElementById('overviewMarketStats');

        if (grandTotalTWD === 0) {
            statsEl.innerHTML = '<p class="stats-empty">尚無資料</p>';
            return;
        }

        const usPct = ((usTotalTWD / grandTotalTWD) * 100).toFixed(1);
        const twPct = ((twTotalTWD / grandTotalTWD) * 100).toFixed(1);

        // 按換算後 TWD 總額由高到低排序
        const items = [
            { icon: '🇹🇼', label: '台股', totalTWD: twTotalTWD, display: `TWD ${twTotalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, pct: twPct },
            { icon: '🇺🇸', label: '美股', totalTWD: usTotalTWD, display: `USD ${usTotalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} (≈TWD ${Math.round(usTotalTWD).toLocaleString()})`, pct: usPct },
        ].sort((a, b) => b.totalTWD - a.totalTWD);

        statsEl.innerHTML = `
      <div class="stat-item" style="border-bottom: none; padding-bottom: 4px;">
        <div class="stat-shares">匯率：1 USD = ${rate.toFixed(2)} TWD</div>
      </div>
    ` + items.map(m => `
      <div class="stat-item">
        <div>
          <div class="stat-symbol">${m.icon} ${m.label}</div>
          <div class="stat-shares">${m.pct}%</div>
        </div>
        <div class="stat-detail">
          <div class="stat-avg">${m.display}</div>
          <div class="stat-shares">總投資額</div>
        </div>
      </div>
    `).join('') + `
      <div class="stat-item" style="border-top: 2px solid rgba(255,255,255,0.1); margin-top: 8px; padding-top: 16px;">
        <div>
          <div class="stat-symbol">💰 合計</div>
        </div>
        <div class="stat-detail">
          <div class="stat-avg" style="color: #22d3ee;">TWD ${grandTotalTWD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div class="stat-shares">總投資額（換算台幣）</div>
        </div>
      </div>
    `;
    }

    return { init };
})();
