/**
 * api.js — Google Apps Script Web App API 封裝
 */

const API = (() => {
    const STORAGE_KEY = 'finance_tracker_api_url';

    function getBaseUrl() {
        return localStorage.getItem(STORAGE_KEY) || '';
    }

    function setBaseUrl(url) {
        localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
    }

    function isConfigured() {
        return !!getBaseUrl();
    }

    async function fetchRecords(sheetName) {
        const url = getBaseUrl();
        if (!url) throw new Error('API URL 未設定');

        const res = await fetch(`${url}?action=getAll&sheet=${encodeURIComponent(sheetName)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async function addRecord(sheetName, data) {
        const url = getBaseUrl();
        if (!url) throw new Error('API URL 未設定');

        const res = await fetch(`${url}?action=add&sheet=${encodeURIComponent(sheetName)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async function deleteRecord(sheetName, row) {
        const url = getBaseUrl();
        if (!url) throw new Error('API URL 未設定');

        const res = await fetch(
            `${url}?action=delete&sheet=${encodeURIComponent(sheetName)}&row=${row}`,
            { method: 'POST' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async function getPrices() {
        const url = getBaseUrl();
        if (!url) throw new Error('API URL 未設定');

        const res = await fetch(`${url}?action=getPrices`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async function fetchRiskMetrics() {
        const url = getBaseUrl();
        if (!url) throw new Error('API URL 未設定');

        const res = await fetch(`${url}?action=getRiskMetrics`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    return { getBaseUrl, setBaseUrl, isConfigured, fetchRecords, addRecord, deleteRecord, getPrices, fetchRiskMetrics };
})();
