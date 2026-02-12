/**
 * app.js — 主控制器
 */

// ========== Navigation ==========
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    const pages = document.querySelectorAll('.page');
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');

    // Tab navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;

            // Update active nav
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // Show page
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(`page-${pageId}`).classList.add('active');

            // Close mobile sidebar
            sidebar.classList.remove('open');
        });
    });

    // Mobile menu toggle
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Close sidebar on outside click (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 &&
            !sidebar.contains(e.target) &&
            !menuToggle.contains(e.target)) {
            sidebar.classList.remove('open');
        }
    });

    // Settings FAB
    document.getElementById('settingsFab').addEventListener('click', openSettings);

    // Initialize
    initApp();
});

function initApp() {
    updateApiStatus();

    if (!API.isConfigured()) {
        showToast('⚙️ 請先設定 Google Apps Script URL', 'info');
        openSettings();
        return;
    }

    // Init all pages
    Stock.init('us');
    Stock.init('tw');
    Lottery.init();
}

// ========== API Status ==========
function updateApiStatus() {
    const statusEl = document.getElementById('apiStatus');
    if (API.isConfigured()) {
        statusEl.innerHTML = '<span class="status-dot online"></span><span>已連線</span>';
    } else {
        statusEl.innerHTML = '<span class="status-dot offline"></span><span>未連線</span>';
    }
}

// ========== Settings ==========
function openSettings() {
    const modal = document.getElementById('settingsModal');
    const input = document.getElementById('apiUrlInput');
    input.value = API.getBaseUrl();
    modal.classList.add('open');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.remove('open');
}

function saveSettings() {
    const input = document.getElementById('apiUrlInput');
    const url = input.value.trim();

    if (!url) {
        showToast('❌ 請輸入 URL', 'error');
        return;
    }

    API.setBaseUrl(url);
    closeSettings();
    updateApiStatus();
    showToast('✅ API URL 已儲存', 'success');

    // Re-init with new URL
    Stock.init('us');
    Stock.init('tw');
    Lottery.init();
}

// Close modal on backdrop click
document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSettings();
});

// ========== Toast ==========
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
