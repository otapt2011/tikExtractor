// app.js – Class‑based TikTok data extractor core, with embedded Data module
(function(global) {
  'use strict';

  // ============================ Data Module ============================
  // 1. Data Types
  class DataTypes {
    static get defaults() {
      return [
        { id: 'profile', label: 'Profile', icon: 'id-card', iconColor: 'text-indigo-500 dark:text-indigo-400', defaultPath: ['Profile And Settings', 'Profile Info', 'ProfileMap'], isComputed: false, needsCurrentUser: false },
        { id: 'friends', label: 'Friends (Mutual)', icon: 'handshake', iconColor: 'text-gold-500 dark:text-gold-300', defaultPath: null, isComputed: true, dependsOn: ['following', 'follower'] },
        { id: 'blocked', label: 'Blocked', icon: 'ban', iconColor: 'text-red-600 dark:text-red-500', defaultPath: ['Profile And Settings', 'Block List', 'BlockList'], isComputed: false },
        { id: 'following', label: 'Following', icon: 'user-plus', iconColor: 'text-purple-500 dark:text-purple-400', defaultPath: ['Profile And Settings', 'Following', 'Following'], isComputed: false },
        { id: 'dm', label: 'Direct Messages', icon: 'comment-dots', iconColor: 'text-brand-500 dark:text-teal-400', defaultPath: ['Direct Message', 'Direct Messages', 'ChatHistory'], isComputed: false, needsCurrentUser: true },
        { id: 'follower', label: 'Follower', icon: 'user-check', iconColor: 'text-purple-500 dark:text-purple-400', defaultPath: ['Profile And Settings', 'Follower', 'FansList'], isComputed: false },
        { id: 'comment', label: 'Comments', icon: 'comment', iconColor: 'text-teal-500 dark:text-teal-300', defaultPath: ['Comment', 'Comments', 'CommentsList'], isComputed: false },
        { id: 'post', label: 'Posts', icon: 'video', iconColor: 'text-red-500 dark:text-red-400', defaultPath: ['Post', 'Posts', 'VideoList'], isComputed: false }
      ];
    }

    static getAll() {
      return this.defaults;
    }
  }

  // 2. Data Renderer (helpers, TableManager, and static render methods)
  const MAX_JSON_ITEMS = 5000;
  const PAGE_SIZE = 100;

  function safeStringify(data) {
    if (!Array.isArray(data)) return JSON.stringify(data, null, 2);
    if (data.length <= MAX_JSON_ITEMS) return JSON.stringify(data, null, 2);
    const truncated = data.slice(0, MAX_JSON_ITEMS);
    const json = JSON.stringify(truncated, null, 2);
    return json + `\n\n// ... (${data.length - MAX_JSON_ITEMS} more items not shown)\n// Full data available via Download button`;
  }

  function isDateString(value) {
    if (typeof value !== 'string') return false;
    // Match exact date/time patterns (TikTok data formats)
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/;
    if (dateTimeRegex.test(value)) return true;
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    if (isoRegex.test(value)) return true;
    // Do NOT fall back to generic Date parsing – prevents pure numbers from being misinterpreted as dates
    return false;
  }

  function formatShortDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function formatCellValue(value) {
    if (value === undefined || value === null) return '';
    const str = String(value);
    if (isDateString(str)) return formatShortDate(str);
    return str;
  }

  function getSortedKeys(arrayOfObjects) {
    const keySet = new Set();
    for (const obj of arrayOfObjects) {
      if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => keySet.add(k));
    }
    return [...keySet].sort();
  }

  class TableManager {
    constructor(container, data, columns, title) {
      this.container = container;
      // FIX: clone the array so sorting does not mutate original extracted data
      this.fullData = [...data];
      this.filteredData = [...data];
      this.columns = columns;
      this.title = title;
      this.currentPage = 1;
      this.sortCol = -1;
      this.sortAsc = true;
      this.buildUI();
      this.renderPage();
    }

    buildUI() {
      this.container.innerHTML = '';
      if (this.title) {
        const header = document.createElement('div');
        header.className = 'text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';
        header.textContent = `${this.title} (${this.fullData.length})`;
        this.container.appendChild(header);
      }
      this.filterInput = document.createElement('input');
      this.filterInput.type = 'text';
      this.filterInput.placeholder = 'Filter table...';
      this.filterInput.className = 'mb-2 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded w-full dark:bg-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-brand-300';
      this.filterInput.addEventListener('input', () => {
        this.filterData(this.filterInput.value.toLowerCase());
        this.currentPage = 1;
        this.renderPage();
      });
      this.container.appendChild(this.filterInput);
      this.table = document.createElement('table');
      this.table.className = 'data-table w-full text-xs border-collapse';
      this.container.appendChild(this.table);
      this.loadMoreContainer = document.createElement('div');
      this.loadMoreContainer.className = 'mt-2 text-center';
      this.container.appendChild(this.loadMoreContainer);
    }

    filterData(query) {
      if (!query) this.filteredData = this.fullData;
      else {
        this.filteredData = this.fullData.filter(row => {
          return this.columns.some(col => {
            const val = formatCellValue(row[col]).toLowerCase();
            return val.includes(query);
          });
        });
      }
    }

    renderPage() {
      this.table.innerHTML = '';
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      this.columns.forEach((col, idx) => {
        const th = document.createElement('th');
        th.setAttribute('data-col-index', idx);
        th.style.cursor = 'pointer';
        let iconClass = 'fas fa-sort text-gray-400 dark:text-gray-500 ml-1';
        if (idx === this.sortCol) {
          iconClass = this.sortAsc ? 'fas fa-sort-up text-brand-600 dark:text-teal-400 ml-1' : 'fas fa-sort-down text-brand-600 dark:text-teal-400 ml-1';
        }
        th.innerHTML = `${col} <i class="${iconClass}"></i>`;
        th.className = 'sticky top-0 bg-gray-100 dark:bg-gray-700 font-semibold text-left px-2 py-1 border-b border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200';
        th.addEventListener('click', () => {
          const colIndex = parseInt(th.dataset.colIndex, 10);
          if (this.sortCol === colIndex) this.sortAsc = !this.sortAsc;
          else { this.sortCol = colIndex; this.sortAsc = true; }
          this.sortFullData();
          this.filterData(this.filterInput.value.toLowerCase());
          this.currentPage = 1;
          this.renderPage();
        });
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      this.table.appendChild(thead);

      const tbody = document.createElement('tbody');
      const totalRows = this.filteredData.length;
      const end = Math.min(this.currentPage * PAGE_SIZE, totalRows);
      const pageRows = this.filteredData.slice(0, end);

      pageRows.forEach((row, idx) => {
        const tr = document.createElement('tr');
        tr.className = idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
        this.columns.forEach(col => {
          const td = document.createElement('td');
          td.textContent = formatCellValue(row[col]);
          td.className = 'px-2 py-1 border-b border-gray-200 dark:border-gray-600 break-all text-gray-800 dark:text-gray-200';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      this.table.appendChild(tbody);

      this.loadMoreContainer.innerHTML = '';
      if (end < totalRows) {
        const btn = document.createElement('button');
        btn.className = 'px-3 py-1 text-xs bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500';
        btn.textContent = `Show more (${end} of ${totalRows})`;
        btn.addEventListener('click', () => { this.currentPage++; this.renderPage(); });
        this.loadMoreContainer.appendChild(btn);
      } else if (totalRows > PAGE_SIZE) {
        const span = document.createElement('span');
        span.className = 'text-xs text-gray-500 dark:text-gray-400';
        span.textContent = `Showing all ${totalRows} rows`;
        this.loadMoreContainer.appendChild(span);
      }
    }

    sortFullData() {
      const col = this.columns[this.sortCol];
      this.fullData.sort((a, b) => {
        const valA = a[col], valB = b[col];
        const numA = parseFloat(valA), numB = parseFloat(valB);
        if (!isNaN(numA) && !isNaN(numB)) return this.sortAsc ? numA - numB : numB - numA;
        const strA = formatCellValue(valA), strB = formatCellValue(valB);
        return this.sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }
  }

  function renderArrayAsTable(container, data, title) {
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-xs p-4">No data</p>';
      return;
    }
    const columns = getSortedKeys(data);
    new TableManager(container, data, columns, title);
  }

  function renderObjectAsKV(container, obj, title) {
    if (!obj || typeof obj !== 'object') {
      container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-xs p-4">No data</p>';
      return;
    }
    container.innerHTML = '';
    if (title) {
      const header = document.createElement('div');
      header.className = 'text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1';
      header.textContent = `${title} (1)`;
      container.appendChild(header);
    }
    const table = document.createElement('table');
    table.className = 'w-full text-xs';
    Object.entries(obj).forEach(([key, value], idx) => {
      const tr = document.createElement('tr');
      tr.className = idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700';
      const tdKey = document.createElement('td');
      tdKey.textContent = key;
      tdKey.className = 'font-medium px-2 py-1 border-b border-gray-200 dark:border-gray-600 w-1/3 text-gray-800 dark:text-gray-200';
      const tdVal = document.createElement('td');
      tdVal.textContent = formatCellValue(value);
      tdVal.className = 'px-2 py-1 border-b border-gray-200 dark:border-gray-600 break-all text-gray-800 dark:text-gray-200';
      tr.appendChild(tdKey);
      tr.appendChild(tdVal);
      table.appendChild(tr);
    });
    container.appendChild(table);
  }

  class DataRenderer {
    static renderAsJSON(container, data, typeLabel = 'Data') {
      if (!container) return;
      container.innerHTML = '';
      const pre = document.createElement('pre');
      pre.className = 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 p-3 rounded-lg text-xs overflow-auto h-full font-mono whitespace-pre-wrap break-all';
      if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && Object.keys(data).length === 0)) {
        pre.textContent = `// No ${typeLabel} data extracted`;
      } else {
        pre.textContent = safeStringify(data);
      }
      container.appendChild(pre);
    }

    static renderAsTable(container, data, typeLabel = 'Data') {
      if (!container) return;
      container.innerHTML = '';
      if (!data || (Array.isArray(data) && data.length === 0)) {
        container.innerHTML = `<p class="text-gray-500 dark:text-gray-400 text-xs p-4">No ${typeLabel} data</p>`;
        return;
      }
      if (typeLabel === 'Profile' && Array.isArray(data) && data.length === 1 && typeof data[0] === 'object') {
        renderObjectAsKV(container, data[0], typeLabel);
      } else if (Array.isArray(data)) {
        renderArrayAsTable(container, data, typeLabel);
      } else {
        renderObjectAsKV(container, data, typeLabel);
      }
    }
  }

  // 3. Data Share
  function getCleanFullData() {
    const data = window.App.getExtracted();
    if (!data) return null;
    const { validation, currentUserUsed, ...clean } = data;
    return clean;
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        return success;
      } catch (fallbackErr) {
        console.error('Copy failed:', fallbackErr);
        return false;
      }
    }
  }

  function downloadJson(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  class DataShare {
    static async copyType(type) {
      const data = window.App.getExtracted();
      if (!data) return { success: false, message: 'No data extracted yet.' };
      const arr = data[type];
      if (!arr) return { success: false, message: `Unknown data type: ${type}` };
      // FIX: use safeStringify to avoid freezing on large data
      const jsonStr = safeStringify(arr);
      const ok = await copyToClipboard(jsonStr);
      return ok ? { success: true, message: `${type} copied to clipboard` } : { success: false, message: 'Copy failed' };
    }

    static downloadType(type, filename) {
      const data = window.App.getExtracted();
      if (!data) { console.warn('No data to download'); return; }
      const arr = data[type];
      if (!arr) { console.warn(`Unknown data type: ${type}`); return; }
      const jsonStr = JSON.stringify(arr, null, 2);
      const currentUser = window.App.getCurrentUser() || 'tiktok';
      const name = filename || `${currentUser}_${type}`;
      downloadJson(jsonStr, `${name}.json`);
    }

    static async copyAll() {
      const clean = getCleanFullData();
      if (!clean) return { success: false, message: 'No data extracted yet.' };
      // FIX: use safeStringify
      const jsonStr = safeStringify(clean);
      const ok = await copyToClipboard(jsonStr);
      return ok ? { success: true, message: 'Full data copied to clipboard' } : { success: false, message: 'Copy failed' };
    }

    static downloadAll(filename) {
      const clean = getCleanFullData();
      if (!clean) { console.warn('No data to download'); return; }
      const jsonStr = JSON.stringify(clean, null, 2);
      const currentUser = window.App.getCurrentUser() || 'tiktok';
      const name = filename || `${currentUser}_extracted_full`;
      downloadJson(jsonStr, `${name}.json`);
    }
  }

  // ============================ Core App Class ============================
  class TikTokApp {
    constructor() {
      this.worker = null;
      this.currentRawJson = null;
      this.extracted = {
        dm: [], comment: [], post: [], following: [], follower: [],
        blocked: [], friends: [], profile: []
      };
      this.currentUser = "jfr";
      this.listeners = [];
      this.progressListener = null;
      this.errorListener = null;
    }

    emitUpdate() {
      this.listeners.forEach(fn => fn(this.extracted));
    }

    onDataUpdate(cb) {
      this.listeners.push(cb);
    }

    onProgress(cb) {
      this.progressListener = cb;
    }

    onError(cb) {
      this.errorListener = cb;
    }

    emitProgress(msg) {
      if (this.progressListener) this.progressListener(msg);
    }

    emitError(err) {
      if (this.errorListener) this.errorListener(err);
    }

    sendToWorker(enabled, manualUser) {
      if (!this.currentRawJson) return;
      if (this.worker) this.worker.terminate();
      this.worker = new Worker('worker.js');
      this.worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          this.emitProgress(msg);
        } else if (msg.type === 'complete') {
          if (msg.success) {
            this.extracted = msg.data;
            this.emitUpdate();
          } else {
            this.emitError(msg.error);
          }
        }
      };
      this.worker.onerror = (err) => this.emitError(err.message);
      this.worker.postMessage({
        jsonData: this.currentRawJson,
        currentUser: manualUser,
        enabled,
        dataTypes: window.DATA_TYPES || DataTypes.getAll()
      });
    }

    processWithOptions(enabled, manualUser) {
      if (!this.currentRawJson) return;
      this.sendToWorker(enabled, manualUser);
    }

    setCurrentUser(user) {
      if (typeof user === 'string' && user.trim()) this.currentUser = user.trim();
    }

    getCurrentUser() {
      return this.currentUser;
    }

    getRawJson() {
      return this.currentRawJson;
    }

    getExtracted() {
      return this.extracted;
    }

    loadNewJson(jsonData) {
      this.currentRawJson = jsonData;
    }
  }

  // Create a single instance
  const appInstance = new TikTokApp();

  // Attach the Data classes as static properties under the App namespace
  appInstance.Types = DataTypes;
  appInstance.Renderer = DataRenderer;
  appInstance.Share = DataShare;

  // Expose as window.App
  global.App = appInstance;

  // Legacy globals for backward compatibility (ui.js and worker still use these)
  global.DATA_TYPES = DataTypes.getAll();
  global.DataRenderer = DataRenderer;
  global.ShareData = DataShare;

})(window);