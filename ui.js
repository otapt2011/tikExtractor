// ui.js – Modular, class‑based UI with persistent config, modal, toast & custom dialog
(function() {
  'use strict';

  // ====================== CUSTOM DIALOG MODULE ======================
  class Dialog {
    static init() {
      if (Dialog._container) return;
      Dialog._container = document.createElement('div');
      Dialog._container.className =
        'fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 hidden';
      Dialog._container.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg max-w-sm w-full p-6 modal-enter">
          <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2" id="dialogTitle"></h3>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-4" id="dialogMessage"></p>
          <div id="dialogInputContainer" class="mb-4 hidden">
            <input type="text" id="dialogInput"
                   class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded
                          dark:bg-gray-700 text-gray-800 dark:text-gray-200">
          </div>
          <div class="flex justify-end gap-2" id="dialogButtons"></div>
        </div>
      `;
      document.body.appendChild(Dialog._container);
      Dialog._resolve = null;
    }

    static _show(options) {
      Dialog.init();
      const {
        message,
        title = '',
        buttons = [{ text: 'OK', value: true, primary: true }],
        input = false,
        defaultValue = ''
      } = options;

      document.getElementById('dialogTitle').textContent = title;
      document.getElementById('dialogMessage').textContent = message;

      const inputContainer = document.getElementById('dialogInputContainer');
      const inputEl = document.getElementById('dialogInput');
      const buttonsContainer = document.getElementById('dialogButtons');
      buttonsContainer.innerHTML = '';

      if (input) {
        inputContainer.classList.remove('hidden');
        inputEl.value = defaultValue;
        inputEl.focus();
      } else {
        inputContainer.classList.add('hidden');
      }

      buttons.forEach(btnDef => {
        const btn = document.createElement('button');
        btn.textContent = btnDef.text;
        btn.className = btnDef.primary
          ? 'px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600'
          : 'px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg';
        btn.addEventListener('click', () => {
          const result = input ? inputEl.value : btnDef.value;
          Dialog._close(result);
        });
        buttonsContainer.appendChild(btn);
      });

      Dialog._container.classList.remove('hidden');
      return new Promise(resolve => {
        Dialog._resolve = resolve;
      });
    }

    static _close(result) {
      Dialog._container.classList.add('hidden');
      if (Dialog._resolve) {
        Dialog._resolve(result);
        Dialog._resolve = null;
      }
    }

    static alert(message, title = '') {
      return Dialog._show({
        message,
        title,
        buttons: [{ text: 'OK', value: undefined, primary: true }]
      });
    }

    static confirm(message, title = '') {
      return Dialog._show({
        message,
        title,
        buttons: [
          { text: 'Cancel', value: false },
          { text: 'OK', value: true, primary: true }
        ]
      });
    }

    static prompt(message, defaultValue = '', title = '') {
      return Dialog._show({
        message,
        title,
        input: true,
        defaultValue,
        buttons: [
          { text: 'Cancel', value: null },
          { text: 'OK', value: 'ok', primary: true }
        ]
      }).then(result => {
        if (result === 'ok') {
          return document.getElementById('dialogInput').value;
        }
        return null;
      });
    }
  }

  // ====================== TOAST MANAGER ======================
  class Toast {
    constructor() {
      this.container = document.getElementById('toastContainer');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toastContainer';
        this.container.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
        document.body.appendChild(this.container);
      }
      this.queue = [];
      this.activeTimeout = null;
    }

    show(message, duration = 3000) {
      this.queue.push({ message, duration });
      if (!this.activeTimeout) this._processQueue();
    }

    _processQueue() {
      if (this.queue.length === 0) {
        this.activeTimeout = null;
        return;
      }
      const { message, duration } = this.queue.shift();
      const toastEl = document.createElement('div');
      toastEl.className = 'bg-gray-900 dark:bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2 transition-opacity duration-300 opacity-100 max-w-xs';
      toastEl.innerHTML = message;
      this.container.appendChild(toastEl);
      const timeout = setTimeout(() => {
        toastEl.style.opacity = '0';
        setTimeout(() => toastEl.remove(), 300);
        this._processQueue();
      }, duration);
      this.activeTimeout = timeout;
    }

    clear() {
      this.queue = [];
      if (this.activeTimeout) clearTimeout(this.activeTimeout);
      this.container.innerHTML = '';
    }
  }

  // ====================== MODAL ======================
  class Modal {
    constructor(modalEl, options = {}) {
      this.el = modalEl;
      this.onOpen = options.onOpen || null;
      this.onClose = options.onClose || null;
      this.closeOnOverlay = options.closeOnOverlay !== false;
      this.closeOnEscape = options.closeOnEscape !== false;
      this._boundOverlayClick = this._onOverlayClick.bind(this);
      this._boundKeyDown = this._onKeyDown.bind(this);
    }

    open() {
      this.el.classList.remove('hidden');
      this.el.classList.add('flex');
      if (this.closeOnOverlay) {
        this.el.addEventListener('click', this._boundOverlayClick);
      }
      if (this.closeOnEscape) {
        document.addEventListener('keydown', this._boundKeyDown);
      }
      if (this.onOpen) this.onOpen();
    }

    close() {
      this.el.classList.add('hidden');
      this.el.classList.remove('flex');
      this.el.removeEventListener('click', this._boundOverlayClick);
      document.removeEventListener('keydown', this._boundKeyDown);
      if (this.onClose) this.onClose();
    }

    _onOverlayClick(e) {
      if (e.target === this.el) this.close();
    }

    _onKeyDown(e) {
      if (e.key === 'Escape' && !this.el.classList.contains('hidden')) {
        this.close();
      }
    }
  }

  // ====================== TAB MANAGER ======================
  class TabManager {
    constructor(container, panes, onChange = null) {
      this.container = container;
      this.panes = panes;
      this.onChange = onChange;
      this._setActiveTab('input');
      this.container.addEventListener('click', (e) => {
        const btn = e.target.closest('.main-tab-btn');
        if (btn && btn.dataset.main) {
          this._setActiveTab(btn.dataset.main);
        }
      });
    }

    _setActiveTab(tabId) {
      Object.values(this.panes).forEach(pane => pane.classList.add('hidden'));
      if (this.panes[tabId]) this.panes[tabId].classList.remove('hidden');
      this.container.querySelectorAll('.main-tab-btn').forEach(btn => {
        if (btn.dataset.main === tabId) {
          btn.classList.add('bg-brand-500', 'text-white');
          btn.classList.remove('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
        } else {
          btn.classList.remove('bg-brand-500', 'text-white');
          btn.classList.add('bg-gray-100', 'dark:bg-gray-700', 'text-gray-700', 'dark:text-gray-200');
        }
      });
      if (this.onChange) this.onChange(tabId);
    }

    get current() {
      const activeBtn = this.container.querySelector('.main-tab-btn.bg-brand-500');
      return activeBtn ? activeBtn.dataset.main : 'input';
    }
  }

  // ====================== DATA TYPE CONFIG ======================
  class DataTypeConfig {
    constructor(storageKey = 'tiktok_data_types') {
      this.storageKey = storageKey;
      this.dataTypes = this._load();
      window.DATA_TYPES = this.dataTypes;
      if (!window.DEFAULT_DATA_TYPES) {
        window.DEFAULT_DATA_TYPES = JSON.parse(JSON.stringify(this.dataTypes));
      }
    }

    _load() {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        try { return JSON.parse(stored); } catch(e) {}
      }
      return window.DATA_TYPES && window.DATA_TYPES.length
        ? JSON.parse(JSON.stringify(window.DATA_TYPES))
        : [];
    }

    save() {
      localStorage.setItem(this.storageKey, JSON.stringify(this.dataTypes));
      window.DATA_TYPES = this.dataTypes;
    }

    reset() {
      this.dataTypes = JSON.parse(JSON.stringify(window.DEFAULT_DATA_TYPES));
      this.save();
    }

    addOrUpdate(typeObj) {
      const idx = this.dataTypes.findIndex(t => t.id === typeObj.id);
      if (idx >= 0) this.dataTypes[idx] = typeObj;
      else this.dataTypes.push(typeObj);
      this.save();
    }

    delete(id) {
      const idx = this.dataTypes.findIndex(t => t.id === id);
      if (idx !== -1) {
        this.dataTypes.splice(idx, 1);
        this.save();
      }
    }

    get(id) {
      return this.dataTypes.find(t => t.id === id);
    }

    getAll() {
      return this.dataTypes;
    }
  }

  // ====================== MAIN APPLICATION UI ======================
  class AppUI {
    constructor() {
      // DOM cache
      this.enableContainer = document.getElementById('checkboxesContainer');
      this.dataTypeSelect = document.getElementById('dataTypeSelect');
      this.currentUserInput = document.getElementById('currentUserInput');
      this.applyUserBtn = document.getElementById('applyUserBtn');
      this.jsonFileInput = document.getElementById('jsonFileInput');
      this.chooseFileBtn = document.getElementById('chooseFileBtn');
      this.selectedFileName = document.getElementById('selectedFileName');
      this.extractFileBtn = document.getElementById('extractFileBtn');
      this.jsonUrlInput = document.getElementById('jsonUrlInput');
      this.fetchJsonBtn = document.getElementById('fetchJsonBtn');
      this.detectedUserInfo = document.getElementById('detectedUserInfo');
      this.progressContainer = document.getElementById('progressContainer');
      this.progressStepSpan = document.getElementById('progressStep');
      this.progressMessageSpan = document.getElementById('progressMessage');
      this.progressBar = document.getElementById('progressBar');
      this.clearBtn = document.getElementById('clearBtn');
      this.reportBtn = document.getElementById('reportBtn');
      this.copyAllBtn = document.getElementById('copyAllBtn');
      this.downloadAllBtn = document.getElementById('downloadAllBtn');
      this.darkModeToggle = document.getElementById('darkModeToggle');
      this.darkModeIcon = document.getElementById('darkModeIcon');
      this.dataViewerContent = document.getElementById('dataViewerContent');
      this.statsContent = document.getElementById('statsContent');
      this.viewJsonBtn = document.getElementById('viewJsonBtn');
      this.viewTableBtn = document.getElementById('viewTableBtn');
      this.copyDataBtn = document.getElementById('copyDataBtn');
      this.downloadDataBtn = document.getElementById('downloadDataBtn');
      this.selectedTypeIcon = document.getElementById('selectedTypeIcon');
      this.followingExtracted = document.getElementById('followingExtracted');
      this.followingProfile = document.getElementById('followingProfile');
      this.followingIcon = document.getElementById('followingIcon');
      this.followerExtracted = document.getElementById('followerExtracted');
      this.followerProfile = document.getElementById('followerProfile');
      this.followerIcon = document.getElementById('followerIcon');
      this.likesExtracted = document.getElementById('likesExtracted');
      this.likesProfile = document.getElementById('likesProfile');
      this.likesIcon = document.getElementById('likesIcon');
      this.naFollowingRemoved = document.getElementById('naFollowingRemoved');
      this.naFollowerRemoved = document.getElementById('naFollowerRemoved');

      // Config modal elements
      this.configModalEl = document.getElementById('configModal');
      this.configListDiv = document.getElementById('configList');
      this.configId = document.getElementById('configId');
      this.configLabel = document.getElementById('configLabel');
      this.configIcon = document.getElementById('configIcon');
      this.configIconColor = document.getElementById('configIconColor');
      this.configPath = document.getElementById('configPath');
      this.configComputed = document.getElementById('configComputed');
      this.configDependsOn = document.getElementById('configDependsOn');
      this.saveConfigBtn = document.getElementById('saveConfigBtn');
      this.deleteConfigBtn = document.getElementById('deleteConfigBtn');
      this.resetConfigBtn = document.getElementById('resetConfigBtn');
      
      this.arrayInfoContent = document.getElementById('arrayInfoContent');
this.copyArrayInfoBtn = document.getElementById('copyArrayInfoBtn');
this.downloadArrayInfoBtn = document.getElementById('downloadArrayInfoBtn');

this.transformedContent = document.getElementById('transformedContent');
this.transformBtn = document.getElementById('transformBtn');
this.downloadTransformedBtn = document.getElementById('downloadTransformedBtn');
this.viewTransformedBtn = document.getElementById('viewTransformedBtn');

      this.selectedConfigId = null;
this.cachedTransformed = null;
      // Instances
      this.toast = new Toast();
      this.dataConfig = new DataTypeConfig();

      // Upload modal
      this.uploadModal = new Modal(document.getElementById('uploadModal'), {
        onOpen: () => document.getElementById('closeModalBtn').focus(),
        onClose: () => document.getElementById('uploadBtn').focus()
      });

      // Config modal
      this.configModal = new Modal(this.configModalEl, {
        onOpen: () => this._loadConfigList(),
        onClose: () => { this.selectedConfigId = null; }
      });

      // Tab manager
      this.tabs = new TabManager(
  document.getElementById('mainFooter'),
  {
    input: document.getElementById('pane-input'),
    'data-viewer': document.getElementById('pane-data-viewer'),
    stats: document.getElementById('pane-stats'),
    'array-info': document.getElementById('pane-array-info'),
    'transformed': document.getElementById('pane-transformed')
  },
  (tabId) => {
    if (tabId === 'data-viewer') this._renderCurrentDataType();
    if (tabId === 'stats') this._renderStats();
    if (tabId === 'array-info') this._renderArrayInfo();
    // No line for 'transformed' → no automatic action when tab is selected.
  }
);
      // View mode
      this.currentViewMode = 'json';
      this._setViewMode('json');
    }

    _normalizeQuotes(str) {
      return str.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    }

    init() {
      this._applyDarkModeFromStorage();
      this._attachGlobalListeners();
      this._bindEvents();
      this._buildUI();
      this._attachCheckboxListeners();
      this.tabs._setActiveTab('input');
    }

    _applyDarkModeFromStorage() {
      const saved = localStorage.getItem('darkMode');
      if (saved === '1') this._setDarkMode(true);
    }

    _setDarkMode(enabled) {
      document.documentElement.classList.toggle('dark', enabled);
      this.darkModeIcon.className = enabled
        ? 'fas fa-sun text-xl text-gold-400'
        : 'fas fa-moon text-xl text-brand-500';
      localStorage.setItem('darkMode', enabled ? '1' : '0');
    }

    _buildUI() {
      this._buildCheckboxes();
      this._buildDropdown();
      this._buildStatsTable();
    }

    _buildCheckboxes() {
      this.enableContainer.innerHTML = '';
      this.dataConfig.getAll().forEach(type => {
        const label = document.createElement('label');
        label.className = 'inline-flex items-center gap-1 text-gray-800 dark:text-gray-200 select-none';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.id = `enable_${type.id}`;
        cb.checked = true;
        cb.className = 'w-3.5 h-3.5';
        const icon = document.createElement('i');
        icon.className = `fas fa-${type.icon} ${type.iconColor} mr-1`;
        label.appendChild(cb);
        label.appendChild(icon);
        label.appendChild(document.createTextNode(` ${type.label}`));
        this.enableContainer.appendChild(label);
      });
    }

    _buildDropdown() {
      this.dataTypeSelect.innerHTML = '';
      this.dataConfig.getAll().forEach(type => {
        const option = document.createElement('option');
        option.value = type.id;
        option.textContent = type.label;
        option.dataset.icon = type.icon;
        option.dataset.color = type.iconColor;
        this.dataTypeSelect.appendChild(option);
      });
      this._updateDataTypeIcon();
    }

    _updateDataTypeIcon() {
      const selected = this.dataTypeSelect.options[this.dataTypeSelect.selectedIndex];
      if (!selected) return;
      this.selectedTypeIcon.className = `fas fa-${selected.dataset.icon} ${selected.dataset.color}`;
    }

    _buildStatsTable() {
      const tbody = document.getElementById('statsTableBody');
      if (!tbody) return;
      tbody.innerHTML = '';
      this.dataConfig.getAll().forEach(type => {
        const tr = document.createElement('tr');
        tr.className = 'border-b border-gray-100 dark:border-gray-700';
        tr.innerHTML = `
          <td class="py-1 pr-1 text-center text-gray-600 dark:text-gray-400"><i class="fas fa-${type.icon} ${type.iconColor}"></i></td>
          <td class="py-1 font-medium text-gray-800 dark:text-gray-200">${type.label}</td>
          <td id="${type.id}Stat" class="py-1 text-right text-gray-800 dark:text-gray-200">--</td>
          <td id="removed_${type.id}" class="py-1 text-right text-gray-800 dark:text-gray-200">--</td>
        `;
        tbody.appendChild(tr);
      });
    }

    _updateStatsTable(data) {
      this.dataConfig.getAll().forEach(type => {
        const el = document.getElementById(`${type.id}Stat`);
        if (el) el.textContent = data?.[type.id]?.length ?? 'off';
      });
    }

    _updateRemovedStats(validation) {
      if (!validation || !validation.naRemoved) {
        this.dataConfig.getAll().forEach(type => {
          const el = document.getElementById(`removed_${type.id}`);
          if (el) el.textContent = '--';
        });
        return;
      }
      const na = validation.naRemoved;
      const map = {
        following: na.following,
        follower: na.follower,
        blocked: na.blocked
      };
      for (const [typeId, removedCount] of Object.entries(map)) {
        const el = document.getElementById(`removed_${typeId}`);
        if (el) el.textContent = (removedCount !== undefined && removedCount !== null) ? removedCount : '';
      }
    }

    _updateValidation(v) {
      if (!v) return;

      const setText = (el, val, def = '--') => {
        if (el) el.textContent = (val !== undefined && val !== null) ? val : def;
      };

      setText(this.followingExtracted, v.following?.extracted);
      setText(this.followingProfile, v.following?.profile);
      if (this.followingIcon) this._setValidationIcon(this.followingIcon, v.following?.match);

      setText(this.followerExtracted, v.follower?.extracted);
      setText(this.followerProfile, v.follower?.profile);
      if (this.followerIcon) this._setValidationIcon(this.followerIcon, v.follower?.match);

      setText(this.likesExtracted, v.likes?.extracted);
      setText(this.likesProfile, v.likes?.profile);
      if (this.likesIcon) this._setValidationIcon(this.likesIcon, v.likes?.match);

      setText(this.naFollowingRemoved, v.naRemoved?.following);
      setText(this.naFollowerRemoved, v.naRemoved?.follower);

      // Difference columns (profile - (extracted + removed))
      const extractedFollowing = v.following?.extracted || 0;
      const removedFollowing = v.naRemoved?.following || 0;
      const diffFollowing = (v.following?.profile || 0) - (extractedFollowing + removedFollowing);

      const extractedFollower = v.follower?.extracted || 0;
      const removedFollower = v.naRemoved?.follower || 0;
      const diffFollower = (v.follower?.profile || 0) - (extractedFollower + removedFollower);

      const diffLikes = (v.likes?.profile || 0) - (v.likes?.extracted || 0);

      const diffFollowingEl = document.getElementById('diffFollowing');
      const diffFollowerEl = document.getElementById('diffFollower');
      const diffLikesEl = document.getElementById('diffLikes');

      setText(diffFollowingEl, diffFollowing);
      setText(diffFollowerEl, diffFollower);
      setText(diffLikesEl, diffLikes);

      const applyDiffColor = (el, isZero) => {
        if (!el) return;
        el.classList.remove('text-green-600', 'dark:text-green-400', 'text-red-600', 'dark:text-red-400');
        if (isZero) {
          el.classList.add('text-green-600', 'dark:text-green-400');
        } else {
          el.classList.add('text-red-600', 'dark:text-red-400');
        }
      };
      applyDiffColor(diffFollowingEl, diffFollowing === 0);
      applyDiffColor(diffFollowerEl, diffFollower === 0);
      applyDiffColor(diffLikesEl, diffLikes === 0);
    }

    _setValidationIcon(el, match) {
      if (!el) return;
      el.className = match
        ? 'fas fa-check-circle text-green-600 dark:text-green-400'
        : 'fas fa-exclamation-triangle text-red-500 dark:text-red-400';
    }

    _renderCurrentDataType() {
      const data = window.App.getExtracted();
      if (!data) {
        this.dataViewerContent.innerHTML = '<div class="text-center text-gray-400 dark:text-gray-500 mt-10">No data loaded yet. Upload a JSON file first.</div>';
        return;
      }
      const typeId = this.dataTypeSelect.value;
      let dataset = data[typeId] || [];
      const typeObj = this.dataConfig.get(typeId);
      const label = typeObj ? typeObj.label : typeId;
      if (this.currentViewMode === 'json') {
        DataRenderer.renderAsJSON(this.dataViewerContent, dataset, label);
      } else {
        DataRenderer.renderAsTable(this.dataViewerContent, dataset, label);
      }
    }

    _renderStats() {
  const data = window.App.getExtracted();
  if (!data || !data.validation) {
    this.statsContent.textContent = '// No extraction data available. Upload a file and extract first.';
    return;
  }
  const v = data.validation;
  // Compute differences for following/follower using the correct formula
  const extractedFollowing = v.following?.extracted || 0;
  const removedFollowing = v.naRemoved?.following || 0;
  const diffFollowing = (v.following?.profile || 0) - (extractedFollowing + removedFollowing);
  
  const extractedFollower = v.follower?.extracted || 0;
  const removedFollower = v.naRemoved?.follower || 0;
  const diffFollower = (v.follower?.profile || 0) - (extractedFollower + removedFollower);
  
  const diffLikes = (v.likes?.profile || 0) - (v.likes?.extracted || 0);
  
  const stats = {
    extraction_timestamp: new Date().toISOString(),
    current_user: data.currentUserUsed || 'unknown',
    counts: {},
    validation: {
      following: {
        extracted: v.following?.extracted,
        profile: v.following?.profile,
        match: v.following?.match,
        naRemoved: v.naRemoved?.following,
        difference: diffFollowing
      },
      follower: {
        extracted: v.follower?.extracted,
        profile: v.follower?.profile,
        match: v.follower?.match,
        naRemoved: v.naRemoved?.follower,
        difference: diffFollower
      },
      likes: {
        extracted: v.likes?.extracted,
        profile: v.likes?.profile,
        match: v.likes?.match,
        difference: diffLikes
      },
      naRemoved: v.naRemoved
    },
    additional_notes: "N/A counts represent entries removed before extraction because UserName was 'N/A'. Difference = profile - (extracted + removed)."
  };
  this.dataConfig.getAll().forEach(type => {
    stats.counts[type.id] = data[type.id]?.length || 0;
  });
  this.statsContent.textContent = JSON.stringify(stats, null, 2);
}

_renderArrayInfo() {
  const data = window.App.getExtracted();
  if (!data) {
    this.arrayInfoContent.textContent = '// No extraction data available. Upload a file first.';
    return;
  }
  const arrayInfo = window.App.Share.extractArrayInfo(data);
  this.arrayInfoContent.textContent = JSON.stringify(arrayInfo, null, 2);
}

_renderTransformedData(data = null) {
  const source = data || window.App.getExtracted();
  if (!source) {
    this.transformedContent.textContent = '// No extraction data available. Upload and extract first.';
    return;
  }
  const transformed = window.App.Transform.transform(source);
  this.transformedContent.textContent = JSON.stringify(transformed, null, 2);
}

_transformAndRender() {
  const data = window.App.getExtracted();
  if (!data) {
    this.toast.show('No extracted data to transform');
    return;
  }
  this._renderTransformedData(data);
  this.toast.show('Transformation complete');
}
_previewTransformed() {
  if (!this.cachedTransformed) {
    this.toast.show('Click Transform first');
    return;
  }
  const preview = safeStringify(this.cachedTransformed);
  this.transformedContent.textContent = preview;
}

_viewTransformed() {
  if (!this.cachedTransformed) {
    this.transformedContent.textContent = '// No transformed data available. Click "Transform" first.';
    return;
  }
  
  const MAX_PREVIEW_ITEMS = 10; // show only first 10 items per array
  const preview = {};
  
  for (const [key, value] of Object.entries(this.cachedTransformed)) {
    if (Array.isArray(value)) {
      preview[key] = {
        count: value.length,
        preview: value.slice(0, MAX_PREVIEW_ITEMS),
        truncated: value.length > MAX_PREVIEW_ITEMS
      };
    } else {
      preview[key] = value;
    }
  }
  
  const lines = [];
  lines.push('// Transformed Data Preview (arrays truncated to first ' + MAX_PREVIEW_ITEMS + ' items)');
  for (const [key, val] of Object.entries(preview)) {
    if (val && typeof val === 'object' && 'count' in val) {
      lines.push(`\n--- ${key} (${val.count} total) ---`);
      lines.push(JSON.stringify(val.preview, null, 2));
      if (val.truncated) lines.push(`// ... (${val.count - MAX_PREVIEW_ITEMS} more items not shown)`);
    } else {
      lines.push(`\n--- ${key} ---`);
      lines.push(JSON.stringify(val, null, 2));
    }
  }
  this.transformedContent.textContent = lines.join('\n');
  this.toast.show('Preview displayed (truncated to 10 items per array)');
}

_transformData() {
  const data = window.App.getExtracted();
  if (!data) {
    this.toast.show('No extracted data to transform');
    return false;
  }
  this.cachedTransformed = window.App.Transform.transform(data);
  this.toast.show('Transformation complete. You can now download.');
  return true;
}
_downloadTransformed() {
  if (!this.cachedTransformed) {
    this.toast.show('Please click Transform first');
    return;
  }
  const jsonStr = JSON.stringify(this.cachedTransformed, null, 2);
  const data = window.App.getExtracted();
  const username = data?.currentUserUsed || 'tiktok';
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${username}_transformed.json`;
  a.click();
  URL.revokeObjectURL(url);
  this.toast.show('Transformed JSON downloaded');
}

    _setViewMode(mode) {
      this.currentViewMode = mode;
      if (mode === 'json') {
        this.viewJsonBtn.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
        this.viewJsonBtn.classList.add('bg-brand-500', 'text-white', 'dark:bg-teal-600');
        this.viewTableBtn.classList.remove('bg-brand-500', 'text-white', 'dark:bg-teal-600');
        this.viewTableBtn.classList.add('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
      } else {
        this.viewTableBtn.classList.remove('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
        this.viewTableBtn.classList.add('bg-brand-500', 'text-white', 'dark:bg-teal-600');
        this.viewJsonBtn.classList.remove('bg-brand-500', 'text-white', 'dark:bg-teal-600');
        this.viewJsonBtn.classList.add('bg-gray-200', 'dark:bg-gray-600', 'text-gray-700', 'dark:text-gray-200');
      }
    }

    _loadConfigList() {
      this.configListDiv.innerHTML = '';
      this.dataConfig.getAll().forEach(type => {
        const div = document.createElement('div');
        div.className = 'p-1 border-b cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center text-gray-800 dark:text-gray-200';
        div.innerHTML = `<span><strong>${type.id}</strong> – ${type.label}</span><i class="fas fa-edit text-gray-500 dark:text-gray-400"></i>`;
        div.addEventListener('click', () => {
          this.selectedConfigId = type.id;
          this.configId.value = type.id;
          this.configLabel.value = type.label;
          this.configIcon.value = type.icon;
          this.configIconColor.value = type.iconColor;
          this.configPath.value = type.defaultPath ? JSON.stringify(type.defaultPath) : '';
          this.configComputed.checked = type.isComputed || false;
          this.configDependsOn.value = type.dependsOn ? type.dependsOn.join(',') : '';
        });
        this.configListDiv.appendChild(div);
      });
    }

    async _saveConfigFromForm() {
      const id = this.configId.value.trim();
      if (!id) {
        await Dialog.alert('ID is required');
        return;
      }
      const label = this.configLabel.value.trim() || id;
      const icon = this.configIcon.value.trim() || 'circle';
      const iconColor = this.configIconColor.value.trim() || 'text-gray-500 dark:text-gray-300';
      let defaultPath = null;
      const pathStr = this.configPath.value.trim();
      if (pathStr) {
        try {
          const normalized = this._normalizeQuotes(pathStr);
          defaultPath = JSON.parse(normalized);
        } catch (e) {
          await Dialog.alert('Invalid JSON path');
          return;
        }
      }
      const typeObj = {
        id,
        label,
        icon,
        iconColor,
        defaultPath,
        isComputed: this.configComputed.checked,
        dependsOn: this.configDependsOn.value.split(',').map(s => s.trim()).filter(s => s),
        needsCurrentUser: false
      };
      this.dataConfig.addOrUpdate(typeObj);
      this._buildUI();
      this._attachCheckboxListeners();
      this.configModal.close();
    }

    async _deleteSelectedConfig() {
      if (!this.selectedConfigId) return;
      const ok = await Dialog.confirm(`Delete "${this.selectedConfigId}"?`);
      if (!ok) return;
      this.dataConfig.delete(this.selectedConfigId);
      this._buildUI();
      this._attachCheckboxListeners();
      this.configModal.close();
    }

    async _resetConfig() {
      const ok = await Dialog.confirm('Reset all data types to factory defaults?');
      if (!ok) return;
      if (!window.DEFAULT_DATA_TYPES) {
        await Dialog.alert('No default configuration available.');
        return;
      }
      this.dataConfig.reset();
      this._buildUI();
      this._attachCheckboxListeners();
      this.configModal.close();
    }

    _attachCheckboxListeners() {
      this.dataConfig.getAll().forEach(type => {
        const cb = document.getElementById(`enable_${type.id}`);
        if (cb && !cb._boundReprocess) {
          cb._boundReprocess = () => this._reprocess();
          cb.addEventListener('change', cb._boundReprocess);
        }
      });
    }

    _getEnabledTypes() {
      const enabled = {};
      this.dataConfig.getAll().forEach(type => {
        const cb = document.getElementById(`enable_${type.id}`);
        enabled[type.id] = cb ? cb.checked : true;
      });
      return enabled;
    }

    _reprocess() {
      if (window.App.getRawJson()) {
        const enabled = this._getEnabledTypes();
        window.App.processWithOptions(enabled, '');
      } else {
        const data = window.App.getExtracted();
        this._updateStatsTable(data);
        if (data?.validation) {
          this._updateValidation(data.validation);
          this._updateRemovedStats(data.validation);
        } else {
          this._updateRemovedStats(null);
        }
        this._renderCurrentDataType();
        this._renderStats();
      }
    }

    _startExtraction(jsonData) {
      window.App.loadNewJson(jsonData);
      const enabled = this._getEnabledTypes();
      this._disableButtons();
      window.App.processWithOptions(enabled, '');
    }

    _disableButtons() {
      this.extractFileBtn.disabled = true;
      this.extractFileBtn.classList.add('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
      this.extractFileBtn.classList.remove('bg-brand-500', 'hover:bg-brand-600');
      this.fetchJsonBtn.disabled = true;
      this.fetchJsonBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }

    _enableButtons() {
      if (this.jsonFileInput.files.length > 0) {
        this.extractFileBtn.disabled = false;
        this.extractFileBtn.classList.remove('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
        this.extractFileBtn.classList.add('bg-brand-500', 'hover:bg-brand-600');
      }
      this.fetchJsonBtn.disabled = false;
      this.fetchJsonBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    _clearAll() {
      window.App.loadNewJson(null);
      window.App.extracted = {
        messages: [], comment: [], post: [], following: [], follower: [],
        blocked: [], friends: [], profile: [],
        currentUserUsed: null,
        validation: null
      };
      window.App.emitUpdate();
      this.selectedFileName.textContent = 'No file chosen';
      this.jsonFileInput.value = '';
      this.extractFileBtn.disabled = true;
      this.extractFileBtn.classList.add('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
      this.extractFileBtn.classList.remove('bg-brand-500', 'hover:bg-brand-600');
      this.currentUserInput.value = '';
      this.detectedUserInfo.innerHTML = '';
      this.toast.show('<i class="fas fa-check-circle text-green-600 dark:text-green-400 mr-1"></i>Cleared');
    }

    _attachGlobalListeners() {
      window.App.onDataUpdate((data) => {
        this._updateStatsTable(data);
        if (data.validation) {
          this._updateValidation(data.validation);
          this._updateRemovedStats(data.validation);
        } else {
          this._updateRemovedStats(null);
        }

        if (data.currentUserUsed) {
          this.currentUserInput.value = data.currentUserUsed;
          this.detectedUserInfo.innerHTML = `<i class="fas fa-user-check text-green-600"></i> Active user: ${data.currentUserUsed}`;
        } else {
          this.detectedUserInfo.innerHTML = `<i class="fas fa-exclamation-triangle text-yellow-500"></i> No user detected – please set manually.`;
        }

        if (!this.tabs.panes['data-viewer'].classList.contains('hidden')) this._renderCurrentDataType();
        if (!this.tabs.panes.stats.classList.contains('hidden')) this._renderStats();
        
        if (!this.tabs.panes['array-info'].classList.contains('hidden')) this._renderArrayInfo();
        
        this.toast.show('<i class="fas fa-check-circle text-green-600 dark:text-green-400 mr-1"></i>Extraction complete');
        this._enableButtons();
        this.uploadModal.close();
        this.progressContainer.classList.add('hidden');
      });

      window.App.onProgress((msg) => {
        this.progressContainer.classList.remove('hidden');
        this.progressStepSpan.innerText = `${msg.current}/${msg.total}`;
        this.progressMessageSpan.innerText = msg.message;
        this.progressBar.style.width = `${(msg.current / msg.total) * 100}%`;
      });

      window.App.onError((err) => {
        this.toast.show(`<i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 mr-1"></i>Error: ${err}`, 5000);
        this.progressContainer.classList.add('hidden');
        this._enableButtons();
        this.uploadModal.close();
      });
    }

    _bindEvents() {
      this.darkModeToggle.addEventListener('click', () => {
        const isDark = !document.documentElement.classList.contains('dark');
        this._setDarkMode(isDark);
      });

      document.getElementById('uploadBtn').addEventListener('click', () => this.uploadModal.open());
      document.getElementById('closeModalBtn').addEventListener('click', () => this.uploadModal.close());

      document.getElementById('openConfigBtn').addEventListener('click', () => this.configModal.open());
      document.getElementById('closeConfigBtn').addEventListener('click', () => this.configModal.close());

      this.saveConfigBtn.addEventListener('click', () => this._saveConfigFromForm());
      this.deleteConfigBtn.addEventListener('click', () => this._deleteSelectedConfig());
      this.resetConfigBtn.addEventListener('click', () => this._resetConfig());

      this.chooseFileBtn.addEventListener('click', () => this.jsonFileInput.click());
      this.jsonFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.selectedFileName.textContent = file.name;
          this.extractFileBtn.disabled = false;
          this.extractFileBtn.classList.remove('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
          this.extractFileBtn.classList.add('bg-brand-500', 'hover:bg-brand-600');
        } else {
          this.selectedFileName.textContent = 'No file chosen';
          this.extractFileBtn.disabled = true;
          this.extractFileBtn.classList.add('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
          this.extractFileBtn.classList.remove('bg-brand-500', 'hover:bg-brand-600');
        }
      });

      this.extractFileBtn.addEventListener('click', () => {
        const file = this.jsonFileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
          try {
            const json = JSON.parse(ev.target.result);
            this._startExtraction(json);
            this.extractFileBtn.disabled = true;
            this.extractFileBtn.classList.add('bg-gray-400', 'opacity-50', 'cursor-not-allowed');
            this.extractFileBtn.classList.remove('bg-brand-500', 'hover:bg-brand-600');
            this.selectedFileName.textContent = 'No file chosen';
            this.jsonFileInput.value = '';
          } catch (err) {
            this.toast.show('<span class="text-red-600 dark:text-red-400">Invalid JSON</span>');
          }
        };
        reader.readAsText(file);
      });

      this.fetchJsonBtn.addEventListener('click', async () => {
        let url = this.jsonUrlInput.value.trim();
        if (!url) return;
        if (!url.startsWith('http') && !url.startsWith('/')) url = '/' + url;
        this.toast.show('<span class="loader mr-1"></span>Fetching...');
        this._disableButtons();
        try {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const json = await resp.json();
          this._startExtraction(json);
        } catch (err) {
          this.toast.show(`<span class="text-red-600 dark:text-red-400">Fetch error: ${err.message}</span>`, 5000);
          this._enableButtons();
        }
      });

      this.applyUserBtn.addEventListener('click', () => {
        if (!window.App.getRawJson()) return;
        const manualUser = this.currentUserInput.value.trim();
        if (manualUser) window.App.setCurrentUser(manualUser);
        const enabled = this._getEnabledTypes();
        window.App.processWithOptions(enabled, manualUser);
      });

      this.clearBtn.addEventListener('click', () => this._clearAll());

      this.reportBtn.addEventListener('click', () => {
  const data = window.App.getExtracted();
  if (!data || !data.profile || data.profile.length === 0) {
    this.toast.show('No data to report');
    return;
  }
  const v = data.validation;
  // Compute differences for report
  const diffFollowing = (v.following?.profile || 0) - ((v.following?.extracted || 0) + (v.naRemoved?.following || 0));
  const diffFollower = (v.follower?.profile || 0) - ((v.follower?.extracted || 0) + (v.naRemoved?.follower || 0));
  const diffLikes = (v.likes?.profile || 0) - (v.likes?.extracted || 0);
  
  const lines = [
    'TikTok Data Extraction Report',
    `Generated: ${new Date().toISOString()}`,
    `Username: ${data.currentUserUsed || 'N/A'}`,
    ''
  ];
  lines.push('--- Extracted Counts ---');
  this.dataConfig.getAll().forEach(type => lines.push(`${type.label}: ${data[type.id]?.length ?? 0}`));
  lines.push(`Friends: ${data.friends?.length ?? 0}`);
  lines.push('', '--- Validation ---');
  if (v) {
    lines.push(`Following: extracted=${v.following.extracted}, profile=${v.following.profile}, N/A removed=${v.naRemoved?.following ?? 0}, difference=${diffFollowing}, match=${v.following.match}`);
    lines.push(`Followers: extracted=${v.follower.extracted}, profile=${v.follower.profile}, N/A removed=${v.naRemoved?.follower ?? 0}, difference=${diffFollower}, match=${v.follower.match}`);
    lines.push(`Likes: extracted=${v.likes.extracted}, profile=${v.likes.profile}, difference=${diffLikes}, match=${v.likes.match}`);
    lines.push('', '--- N/A Removed ---');
    lines.push(`Following: ${v.naRemoved?.following ?? 0}`);
    lines.push(`Followers: ${v.naRemoved?.follower ?? 0}`);
    lines.push(`Blocked: ${v.naRemoved?.blocked ?? 0}`);
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${data.currentUserUsed || 'tiktok'}_report.txt`;
  a.click();
  URL.revokeObjectURL(url);
  this.toast.show('Report downloaded');
});

      this.copyAllBtn.addEventListener('click', async () => {
        const res = await ShareData.copyAll();
        this.toast.show(res.message);
      });
      this.downloadAllBtn.addEventListener('click', () => ShareData.downloadAll());

this.copyArrayInfoBtn.addEventListener('click', async () => {
  const text = this.arrayInfoContent.textContent;
  if (!text || text.startsWith('// No extraction')) {
    this.toast.show('No array info to copy');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    this.toast.show('Array info copied to clipboard');
  } catch (err) {
    this.toast.show('Copy failed');
  }
});

this.downloadArrayInfoBtn.addEventListener('click', () => {
  const text = this.arrayInfoContent.textContent;
  if (!text || text.startsWith('// No extraction')) {
    this.toast.show('No array info to download');
    return;
  }
  const data = window.App.getExtracted();
  const username = data?.currentUserUsed || 'tiktok';
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${username}_array_info.json`;
  a.click();
  URL.revokeObjectURL(url);
  this.toast.show('Array info downloaded');
});

this.transformBtn.addEventListener('click', () => this._transformData());

this.downloadTransformedBtn.addEventListener('click', () => this._downloadTransformed());

this.viewTransformedBtn.addEventListener('click', () => this._viewTransformed());

      this.dataTypeSelect.addEventListener('change', () => {
        this._updateDataTypeIcon();
        this._renderCurrentDataType();
      });
      this.viewJsonBtn.addEventListener('click', () => {
        this._setViewMode('json');
        this._renderCurrentDataType();
      });
      this.viewTableBtn.addEventListener('click', () => {
        this._setViewMode('table');
        this._renderCurrentDataType();
      });
      this.copyDataBtn.addEventListener('click', async () => {
        const res = await ShareData.copyType(this.dataTypeSelect.value);
        this.toast.show(res.message);
      });
      this.downloadDataBtn.addEventListener('click', () => {
        ShareData.downloadType(this.dataTypeSelect.value);
      });
    }
  }

  // ====================== INIT ======================
  document.addEventListener('DOMContentLoaded', () => {
    const ui = new AppUI();
    ui.init();
  });
})();