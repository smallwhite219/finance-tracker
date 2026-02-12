/**
 * chart-helper.js — Chart.js 圓餅圖封裝
 */

const ChartHelper = (() => {
    const charts = {};

    // 精心挑選的配色
    const COLORS = [
        '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
        '#f97316', '#f59e0b', '#10b981', '#14b8a6',
        '#06b6d4', '#3b82f6', '#a78bfa', '#fb923c',
        '#34d399', '#22d3ee', '#818cf8', '#e879f9',
    ];

    function createPieChart(canvasId, data, emptyId) {
        const canvas = document.getElementById(canvasId);
        const emptyEl = document.getElementById(emptyId);

        // 銷毀舊的 chart
        if (charts[canvasId]) {
            charts[canvasId].destroy();
            delete charts[canvasId];
        }

        if (!data || data.length === 0) {
            canvas.style.display = 'none';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }

        canvas.style.display = 'block';
        if (emptyEl) emptyEl.style.display = 'none';

        const labels = data.map(d => d.label);
        const values = data.map(d => d.value);
        const total = values.reduce((a, b) => a + b, 0);

        charts[canvasId] = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: COLORS.slice(0, data.length),
                    borderColor: 'rgba(10, 14, 26, 0.8)',
                    borderWidth: 2,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '55%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: "'Inter', sans-serif", size: 12 },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 10,
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        titleColor: '#f1f5f9',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        cornerRadius: 10,
                        padding: 12,
                        callbacks: {
                            label(ctx) {
                                const pct = ((ctx.raw / total) * 100).toFixed(1);
                                return ` ${ctx.label}: $${ctx.raw.toLocaleString()} (${pct}%)`;
                            },
                        },
                    },
                },
                animation: {
                    animateRotate: true,
                    animateScale: true,
                    duration: 800,
                    easing: 'easeOutQuart',
                },
            },
        });
    }

    return { createPieChart };
})();
