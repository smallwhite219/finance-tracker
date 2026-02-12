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
      const [usResult, twResult, usdToTwd, pricesResult] = await Promise.all([
        API.fetchRecords('美股'),
        API.fetchRecords('台股'),
        fetchExchangeRate(),
        API.getPrices().catch(() => ({ prices: {} })),
      ]);

      const usRecords = usResult.records || [];
      const twRecords = twResult.records || [];
      const prices = pricesResult.prices || {};

      // 原幣總額
      const usTotalUSD = calcTotal(usRecords, '價格(USD)');
      const twTotalTWD = calcTotal(twRecords, '價格(TWD)');

      // 統一換算為 TWD
      const usTotalTWD = usTotalUSD * usdToTwd;
      const grandTotalTWD = usTotalTWD + twTotalTWD;

      // P&L 計算
      renderPortfolioPL(usRecords, twRecords, prices, usdToTwd);

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

  // ===== Portfolio P&L =====

  function renderPortfolioPL(usRecords, twRecords, prices, usdToTwd) {
    const container = document.getElementById('overviewPlSummary');

    // Group holdings per symbol
    function calcHoldings(records, priceKey) {
      const grouped = {};
      records.forEach(r => {
        const sym = String(r['代號']).trim();
        if (!grouped[sym]) grouped[sym] = { totalCost: 0, totalShares: 0 };
        const p = Number(r[priceKey]) || 0;
        const s = Number(r['股數']) || 0;
        grouped[sym].totalCost += p * s;
        grouped[sym].totalShares += s;
      });
      return grouped;
    }

    const twHoldings = calcHoldings(twRecords, '價格(TWD)');
    const usHoldings = calcHoldings(usRecords, '價格(USD)');

    let totalCostTWD = 0;
    let totalValueTWD = 0;
    let hasPrices = false;

    // TW stocks
    Object.entries(twHoldings).forEach(([sym, h]) => {
      totalCostTWD += h.totalCost;
      const cp = prices[sym] ? prices[sym].price : null;
      if (cp !== null) {
        totalValueTWD += cp * h.totalShares;
        hasPrices = true;
      } else {
        totalValueTWD += h.totalCost; // fallback to cost
      }
    });

    // US stocks (convert to TWD)
    Object.entries(usHoldings).forEach(([sym, h]) => {
      totalCostTWD += h.totalCost * usdToTwd;
      const cp = prices[sym] ? prices[sym].price : null;
      if (cp !== null) {
        totalValueTWD += cp * h.totalShares * usdToTwd;
        hasPrices = true;
      } else {
        totalValueTWD += h.totalCost * usdToTwd; // fallback
      }
    });

    if (!hasPrices && totalCostTWD === 0) return;

    container.style.display = 'grid';

    const pl = totalValueTWD - totalCostTWD;
    const roi = totalCostTWD > 0 ? (pl / totalCostTWD * 100) : 0;
    const isProfit = pl >= 0;
    const plColor = isProfit ? '#22c55e' : '#ef4444';
    const plSign = isProfit ? '+' : '';

    const fmt = n => Math.round(n).toLocaleString();

    document.getElementById('plTotalCost').textContent = `TWD ${fmt(totalCostTWD)}`;
    document.getElementById('plTotalValue').textContent = `TWD ${fmt(totalValueTWD)}`;
    document.getElementById('plTotalValue').style.color = plColor;

    const plEl = document.getElementById('plTotalPL');
    plEl.textContent = `${plSign}TWD ${fmt(pl)}`;
    plEl.style.color = plColor;
    plEl.className = `stat-value ${isProfit ? 'win' : 'loss'}`;

    const roiEl = document.getElementById('plTotalROI');
    roiEl.textContent = `${plSign}${roi.toFixed(2)}%`;
    roiEl.style.color = plColor;
  }

  // ===== Risk Analysis =====

  async function loadRisk() {
    const btn = document.getElementById('calcRiskBtn');
    const content = document.getElementById('riskContent');
    const btnText = btn.querySelector('.btn-text');
    const btnSpinner = btn.querySelector('.btn-spinner');

    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline';
    btn.disabled = true;
    content.innerHTML = '<p class="stats-empty">⏳ 正在抓取歷史數據並計算風險指標...</p>';

    try {
      const data = await API.fetchRiskMetrics();
      if (data.error) {
        content.innerHTML = `<p class="stats-empty" style="color:#f87171;">❌ ${data.error}</p>`;
        return;
      }
      renderRisk(data);
    } catch (err) {
      content.innerHTML = `<p class="stats-empty" style="color:#f87171;">❌ 計算失敗: ${err.message}</p>`;
    } finally {
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
      btn.disabled = false;
    }
  }

  function getRiskLevel(vol) {
    if (vol === null) return { label: '—', color: '#888', level: 0 };
    if (vol < 15) return { label: '低風險', color: '#22c55e', level: 1 };
    if (vol < 25) return { label: '中等', color: '#eab308', level: 2 };
    if (vol < 40) return { label: '偏高', color: '#f97316', level: 3 };
    return { label: '高風險', color: '#ef4444', level: 4 };
  }

  function renderRisk(data) {
    const content = document.getElementById('riskContent');

    // Portfolio summary cards
    const twRisk = getRiskLevel(data.twPortfolioVol);
    const usRisk = getRiskLevel(data.usPortfolioVol);

    // Combined portfolio risk (weighted average)
    let combinedVol = null;
    if (data.twPortfolioVol !== null || data.usPortfolioVol !== null) {
      const twV = data.twPortfolioVol || 0;
      const usV = data.usPortfolioVol || 0;
      const total = twV + usV;
      combinedVol = total > 0 ? Math.round(((twV + usV) / (twV > 0 && usV > 0 ? 2 : 1)) * 100) / 100 : null;
    }
    const combinedRisk = getRiskLevel(combinedVol);

    let html = `
        <div class="risk-summary" style="grid-template-columns: repeat(3, 1fr);">
            <div class="risk-gauge">
                <div class="risk-label">🇹🇼 台股組合</div>
                <div class="risk-value" style="color:${twRisk.color}">
                    ${data.twPortfolioVol !== null ? data.twPortfolioVol + '%' : '—'}
                </div>
                <div class="risk-level" style="color:${twRisk.color}">${twRisk.label}</div>
                <div class="risk-bar"><div class="risk-bar-fill" style="width:${Math.min((data.twPortfolioVol || 0) / 60 * 100, 100)}%;background:${twRisk.color}"></div></div>
                <div class="risk-bench">基準 0050: ${data.benchmarks['0050'] !== null ? data.benchmarks['0050'] + '%' : '—'}</div>
            </div>
            <div class="risk-gauge">
                <div class="risk-label">🇺🇸 美股組合</div>
                <div class="risk-value" style="color:${usRisk.color}">
                    ${data.usPortfolioVol !== null ? data.usPortfolioVol + '%' : '—'}
                </div>
                <div class="risk-level" style="color:${usRisk.color}">${usRisk.label}</div>
                <div class="risk-bar"><div class="risk-bar-fill" style="width:${Math.min((data.usPortfolioVol || 0) / 60 * 100, 100)}%;background:${usRisk.color}"></div></div>
                <div class="risk-bench">基準 SPY: ${data.benchmarks['SPY'] !== null ? data.benchmarks['SPY'] + '%' : '—'}</div>
            </div>
            <div class="risk-gauge" style="border-color:${combinedRisk.color}40;">
                <div class="risk-label">🌐 總體組合</div>
                <div class="risk-value" style="color:${combinedRisk.color}">
                    ${combinedVol !== null ? combinedVol + '%' : '—'}
                </div>
                <div class="risk-level" style="color:${combinedRisk.color}">${combinedRisk.label}</div>
                <div class="risk-bar"><div class="risk-bar-fill" style="width:${Math.min((combinedVol || 0) / 60 * 100, 100)}%;background:${combinedRisk.color}"></div></div>
                <div class="risk-bench">台+美 加權平均</div>
            </div>
        </div>
        `;

    // Per-stock tables
    const twEntries = Object.entries(data.tw || {});
    const usEntries = Object.entries(data.us || {});

    if (twEntries.length > 0) {
      html += renderRiskTable('🇹🇼 台股個股風險', twEntries, '0050');
    }

    if (usEntries.length > 0) {
      html += renderRiskTable('🇺🇸 美股個股風險', usEntries, 'SPY');
    }

    content.innerHTML = html;
  }

  function renderRiskTable(title, entries, benchLabel) {
    // Sort by volatility descending
    entries.sort((a, b) => (b[1].volatility || 0) - (a[1].volatility || 0));

    let rows = entries.map(([sym, m]) => {
      const risk = getRiskLevel(m.volatility);
      return `
                <tr>
                    <td><strong>${sym}</strong></td>
                    <td>${m.volatility !== null ? m.volatility + '%' : '—'}</td>
                    <td>${m.beta !== null ? m.beta : '—'}</td>
                    <td style="color:${risk.color}">${risk.label}</td>
                </tr>
            `;
    }).join('');

    return `
            <h3 style="margin: 24px 0 12px; font-size: 1rem; color: rgba(255,255,255,0.8);">${title}</h3>
            <div class="table-wrapper">
                <table class="risk-table">
                    <thead>
                        <tr>
                            <th>代號</th>
                            <th>年化波動率</th>
                            <th>Beta (vs ${benchLabel})</th>
                            <th>風險等級</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
  }

  return { init, loadRisk };
})();
