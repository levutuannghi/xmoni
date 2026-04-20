// ============================================
// XMoni - Expense Entry & Listing (Redesigned)
// ============================================

const Expense = {
  inputAmount: '',
  lastCategoryId: localStorage.getItem('xmoni_last_category') || null,
  scannedQR: null,
  selectedBankApp: localStorage.getItem('xmoni_selected_bank') || null,
  qrAmountLocked: false,

  init() { this.loadBankList(); this.loadAppList(); },

  // === Render expense list view ===
  render() {
    const container = document.getElementById('view-expenses');
    const data = App.state.data;
    const monthKey = App.state.selectedMonth;
    const monthExpenses = data.expenses
      .filter(e => Utils.getMonthKey(e.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const grouped = {};
    monthExpenses.forEach(e => {
      if (!grouped[e.date]) grouped[e.date] = [];
      grouped[e.date].push(e);
    });

    container.innerHTML = `
      <div class="month-nav">
        <button class="btn-icon" onclick="Expense.prevMonth()">‹</button>
        <h2 class="month-title">${Utils.formatMonth(monthKey)}</h2>
        <button class="btn-icon" onclick="Expense.nextMonth()">›</button>
      </div>
      <div class="expense-summary">
        <div class="summary-item">
          <span class="summary-label">Tổng chi tháng này</span>
          <span class="summary-value">${Utils.formatVND(monthExpenses.reduce((s, e) => s + e.amount, 0))}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Số giao dịch</span>
          <span class="summary-value">${monthExpenses.length}</span>
        </div>
      </div>
      <div class="expense-list" id="expense-list">
        ${Object.keys(grouped).length === 0 ? '<p class="empty-state">Chưa có chi tiêu nào tháng này</p>' : ''}
        ${Object.entries(grouped).map(([date, expenses]) => `
          <div class="expense-date-group">
            <div class="expense-date-header">
              <span>${Utils.formatDate(date)}</span>
              <span class="expense-date-total">${Utils.formatVND(expenses.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            ${expenses.map(e => {
      const budget = data.budgets.find(b => b.id === e.budgetId);
      const splitBadge = e.splitCount > 1 ? `<span class="split-badge">✂️ ${e.splitCount} ${e.splitUnit === 'day' ? 'ngày' : e.splitUnit === 'week' ? 'tuần' : 'tháng'}</span>` : '';
      const displayAmount = e.splitCount > 1 ? Utils.getSplitAmountForMonth(e, monthKey) : e.amount;
      return `
                <div class="expense-item" data-id="${e.id}" onclick="Expense.showEditExpense('${e.id}')">
                  <div class="expense-item-left">
                    <span class="expense-item-icon" style="background: ${budget ? budget.color : '#666'}">${budget ? budget.icon : '?'}</span>
                    <div class="expense-item-info">
                      <span class="expense-item-category">${budget ? budget.name : 'Đã xóa'} ${splitBadge}</span>
                      ${e.note ? `<span class="expense-item-note">${e.note}</span>` : ''}
                    </div>
                  </div>
                  <div class="expense-item-right">
                    <span class="expense-item-amount">-${Utils.formatVND(displayAmount)}</span>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  },

  // === Full-screen Quick Add ===
  showQuickAdd() {
    const data = App.state.data;
    if (data.budgets.length === 0) {
      Utils.showToast('Tạo danh mục chi tiêu trước!', 'error');
      App.switchView('budgets');
      return;
    }

    this.inputAmount = '';
    this.scannedQR = null;
    this.qrAmountLocked = false;
    const modal = document.getElementById('expense-modal');

    const today = Utils.getToday();

    // Bank app display
    const bankDisplay = this._getBankDisplay();

    modal.innerHTML = `
      <div class="modal-content quick-add-modal slide-up">

        <div class="quick-add-header">
          <h3>Thêm chi tiêu</h3>
          <span class="qa-header-daily" id="qa-header-budget"></span>
          <button class="btn-icon" onclick="Expense.closeQuickAdd()">✕</button>
        </div>

        <div class="qa-body">
          <div class="quick-add-categories" id="qa-categories">
            ${data.budgets.map(b => {
      const sel = this.lastCategoryId ? b.id === this.lastCategoryId : false;
      return `<button class="category-chip ${sel ? 'selected' : ''}" style="--chip-color:${b.color}" data-id="${b.id}" onclick="Expense.selectCategory(this)"><span>${b.icon}</span><span>${b.name}</span></button>`;
    }).join('')}
          </div>

          <input type="hidden" id="qa-date" value="${today}">

          <div class="quick-add-display compact">
            <span class="qa-amount" id="qa-amount">0đ</span>
          </div>

          <div id="qa-numpad-section">
            <div class="preset-amounts">
              ${[10, 15, 20, 25, 30, 50, 100, 200].map(v =>
      `<button class="preset-btn" onclick="Expense.presetAmount(${v})">${v}k</button>`
    ).join('')}
            </div>
            <div class="numpad compact">
              ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key =>
      `<button class="numpad-btn ${key === '⌫' ? 'numpad-delete' : ''} ${key === '.' ? 'numpad-dot' : ''}" onclick="Expense.numpadPress('${key}')">${key === '.' ? ',5' : key}</button>`
    ).join('')}
            </div>
          </div>

          <div class="qa-transfer-fields">
            <div class="qa-transfer-row">
              <span class="qa-transfer-label">🏦 Ngân hàng</span>
              <button id="qa-bank-btn" class="qa-transfer-input qa-bank-picker-btn" onclick="Expense.showBankFieldPicker()">
                <span id="qa-bank-display">Chọn ngân hàng</span>
                <span class="bank-arrow">▾</span>
              </button>
              <input type="hidden" id="qa-bank" value="">
            </div>
            <div class="qa-transfer-row">
              <span class="qa-transfer-label">💳 Số TK</span>
              <input type="text" id="qa-stk" class="qa-transfer-input" placeholder="Số tài khoản" inputmode="numeric">
            </div>
            <div class="qa-transfer-row">
              <span class="qa-transfer-label">👤 Người nhận</span>
              <input type="text" id="qa-recipient" class="qa-transfer-input" readonly placeholder="Tự động từ QR">
            </div>
            <div class="qa-transfer-row">
              <span class="qa-transfer-label">📝 Nội dung</span>
              <input type="text" id="qa-memo" class="qa-transfer-input" placeholder="Nội dung CK (tuỳ chọn)">
            </div>
            <div class="qa-transfer-row">
              <span class="qa-transfer-label">✏️ Ghi chú</span>
              <input type="text" id="qa-note" class="qa-transfer-input" placeholder="Ghi chú (tuỳ chọn)">
            </div>
          </div>

          <div id="qr-scanner-container"></div>
          <div id="qr-scan-banner"></div>
        </div>

        <div class="qa-bottom-bar">
          <div class="qa-action-row">
            <button class="btn-bank-selector" id="btn-bank-selector" onclick="Expense.showBankPicker()">
              ${bankDisplay}
            </button>
            <button class="btn-split-expense" onclick="Expense.showSplitFromQuickAdd()">✂️</button>
            <button class="btn-save-expense" id="btn-save-expense" onclick="Expense.saveExpense()" disabled>💾 Lưu</button>
          </div>
          <div class="qa-scan-row">
            <button class="btn-upload-qr" onclick="document.getElementById('qr-file-input').click()">📤</button>
            <button class="btn-qr-scan" onclick="Expense.startQRScanner()">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/><rect x="7" y="7" width="4" height="4"/><rect x="13" y="7" width="4" height="4"/><rect x="7" y="13" width="4" height="4"/><path d="M13 13h4v4h-4z"/></svg>
              Quét QR
            </button>
            <input type="file" id="qr-file-input" accept="image/*" style="display:none" onchange="Expense.uploadQRImage(event)">
          </div>
        </div>

      </div>
    `;

    modal.classList.add('active');
    if (!modal.querySelector('.category-chip.selected')) {
      const first = modal.querySelector('.category-chip');
      if (first) { first.classList.add('selected'); this.lastCategoryId = first.dataset.id; }
    }
    this._updateHeaderBudget();
  },

  // Bank display helper
  _getBankDisplay() {
    if (this.selectedBankApp && this.appList) {
      const app = this.appList.find(a => a.appId === this.selectedBankApp);
      if (app) {
        const n = app.appName.replace(/[\u200E\u200F]/g, '');
        return `<img src="${app.appLogo}" class="bank-logo-sm" onerror="this.style.display='none'"><span>${n}</span><span class="bank-arrow">▾</span>`;
      }
    }
    return `<span>🏦 Chọn NH</span><span class="bank-arrow">▾</span>`;
  },

  // === Bank Picker Modal ===
  showBankPicker() {
    if (!this.appList || this.appList.length === 0) {
      this.loadAppList().then(() => this.showBankPicker());
      return;
    }

    let overlay = document.getElementById('bank-picker-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bank-picker-overlay';
      overlay.className = 'bank-picker-overlay';
      document.body.appendChild(overlay);
    }

    const recent = JSON.parse(localStorage.getItem('xmoni_recent_banks') || '[]');
    const recentApps = recent.slice(0, 5).map(id => this.appList.find(a => a.appId === id)).filter(Boolean);
    const sorted = [...this.appList].sort((a, b) => (b.monthlyInstall || 0) - (a.monthlyInstall || 0));

    overlay.innerHTML = `
      <div class="bank-picker-sheet" onclick="event.stopPropagation()">
        <div class="bank-picker-header">
          <h3>Chọn ứng dụng ngân hàng</h3>
          <button class="bank-picker-close" onclick="Expense.closeBankPicker()">✕</button>
        </div>
        <div class="bank-picker-search">
          <input type="text" placeholder="🔍 Tìm kiếm" id="bank-search-input" oninput="Expense.filterBanks(this.value)">
        </div>
        <div class="bank-picker-body" id="bank-picker-body">
          ${recentApps.length > 0 ? `
            <div class="bank-picker-section-title">Ngân hàng đề xuất</div>
            <div class="bank-picker-grid" id="bank-recent-grid">
              ${recentApps.map(app => this._bankPickerItem(app)).join('')}
            </div>
          ` : ''}
          <div class="bank-picker-section-title">Tất cả ngân hàng <span style="font-size:0.65rem;color:var(--accent-success);font-weight:400">✔ = hỗ trợ mở app</span></div>
          <div class="bank-picker-grid" id="bank-all-grid">
            <button class="bank-picker-item ${!this.selectedBankApp ? 'selected' : ''}" onclick="event.stopPropagation();Expense.clearBankApp()">
              <span style="font-size:1.5rem">🚫</span>
              <span>Không chọn</span>
            </button>
            ${sorted.map(app => this._bankPickerItem(app)).join('')}
          </div>
        </div>
      </div>
    `;

    overlay.onclick = () => this.closeBankPicker();
    overlay.classList.add('active');
  },

  _bankPickerItem(app) {
    const n = app.appName.replace(/[\u200E\u200F]/g, '');
    const selected = this.selectedBankApp === app.appId ? 'selected' : '';
    // autofill=1 means VietQR fills data; TPBank has its own hydro:// deeplink
    const supported = app.autofill === 1 || app.appId === 'tpb';
    const openOnly = app.appId === 'momo'; // MoMo: chỉ mở app
    let badge = '';
    if (openOnly) badge = '<span style="position:absolute;bottom:-2px;right:-4px;font-size:0.6rem;" title="Chỉ mở app">⚡</span>';
    else if (supported) badge = '<span style="position:absolute;bottom:-2px;right:-4px;font-size:0.6rem;">✅</span>';
    return `<button class="bank-picker-item ${selected}" data-id="${app.appId}" onclick="event.stopPropagation();Expense.selectBankApp('${app.appId}')">
      <div style="position:relative">
        <img src="${app.appLogo}" onerror="this.style.display='none'">
        ${badge}
      </div>
      <span>${n}</span>
    </button>`;
  },

  filterBanks(query) {
    const q = query.toLowerCase().trim();
    const grid = document.getElementById('bank-all-grid');
    if (!grid) return;
    grid.querySelectorAll('.bank-picker-item').forEach(item => {
      const name = item.querySelector('span')?.textContent?.toLowerCase() || '';
      item.style.display = !q || name.includes(q) ? '' : 'none';
    });
  },

  selectBankApp(appId) {
    this.selectedBankApp = appId;
    localStorage.setItem('xmoni_selected_bank', appId);
    this.trackRecentBank(appId);

    // Update selector button
    const btn = document.getElementById('btn-bank-selector');
    if (btn) btn.innerHTML = this._getBankDisplay();

    this.closeBankPicker();
  },

  clearBankApp() {
    this.selectedBankApp = null;
    localStorage.removeItem('xmoni_selected_bank');
    const btn = document.getElementById('btn-bank-selector');
    if (btn) btn.innerHTML = this._getBankDisplay();
    this.closeBankPicker();
  },

  closeBankPicker() {
    const overlay = document.getElementById('bank-picker-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  // === Category ===
  selectCategory(btn) {
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    this.lastCategoryId = btn.dataset.id;
    localStorage.setItem('xmoni_last_category', btn.dataset.id);
    this._updateHeaderBudget();
  },

  _updateHeaderBudget() {
    const el = document.getElementById('qa-header-budget');
    if (!el) return;
    const catId = this.lastCategoryId;
    const data = App.state.data;
    const budget = data.budgets.find(b => b.id === catId);
    if (!budget) { el.innerHTML = ''; return; }

    const monthKey = Utils.getCurrentMonthKey();
    const today = Utils.getToday();
    const totalDays = Utils.getDaysInMonth(monthKey);
    const remainingDays = Utils.getRemainingDays(monthKey);

    const monthly = (data.monthlyBudgets[monthKey] || {})[catId] || {};
    const budgetAmt = monthly.amount || 0;
    const carryover = Budget.calculateCarryovers(monthKey)[catId] || 0;
    const spent = Budget.getTotalSpent(monthKey, catId);
    const todaySpent = data.expenses.filter(e => e.date === today && e.budgetId === catId).reduce((s, e) => s + e.amount, 0);

    const remaining = budgetAmt + carryover - spent;
    const dailyRaw = remainingDays > 0 ? remaining / remainingDays : 0;
    const dailyBase = totalDays > 0 ? budgetAmt / totalDays : 0;
    const dailyAllowance = Math.max(0, Math.round(Math.min(dailyRaw, dailyBase)));
    const pct = dailyAllowance > 0 ? Math.min((todaySpent / dailyAllowance) * 100, 100) : 0;
    const cls = pct > 85 ? 'danger' : pct > 60 ? 'warning' : 'safe';

    el.className = 'qa-header-daily ' + cls;
    el.innerHTML = `
      <span class="qa-budget-text">${Utils.formatCompactVND(todaySpent)} / ${Utils.formatCompactVND(dailyAllowance)}</span>
      <div class="qa-budget-bar"><div class="qa-budget-bar-fill ${cls}" style="width:${Math.round(pct)}%"></div></div>
    `;
  },

  // === Amount Input ===
  presetAmount(k) {
    if (this.qrAmountLocked) return;
    this.inputAmount = k.toString();
    const realAmount = k * 1000;
    const display = document.getElementById('qa-amount');
    display.textContent = Utils.formatVND(realAmount);
    display.classList.add('has-value');
    document.getElementById('btn-save-expense').disabled = false;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
  },

  numpadPress(key) {
    if (this.qrAmountLocked) return;
    if (key === '⌫') {
      this.inputAmount = this.inputAmount.slice(0, -1);
    } else if (key === '.') {
      if (!this.inputAmount.includes('.')) {
        this.inputAmount += this.inputAmount ? '.5' : '0.5';
      }
    } else {
      if (this.inputAmount.includes('.')) return;
      if (this.inputAmount.length >= 7) return;
      this.inputAmount += key;
    }
    const parsed = parseFloat(this.inputAmount) || 0;
    const realAmount = Math.round(parsed * 1000);
    const display = document.getElementById('qa-amount');
    display.textContent = Utils.formatVND(realAmount);
    display.classList.toggle('has-value', realAmount > 0);
    document.getElementById('btn-save-expense').disabled = realAmount === 0;
  },

  // === Save Expense ===
  async saveExpense() {
    const parsed = parseFloat(this.inputAmount) || 0;
    const amount = Math.round(parsed * 1000);
    if (amount === 0) return;

    const selectedChip = document.querySelector('.category-chip.selected');
    if (!selectedChip) {
      Utils.showToast('Chọn danh mục', 'error');
      return;
    }

    // Build note from transfer fields
    const note = this._buildNote();

    const expense = {
      id: Utils.generateId(),
      date: document.getElementById('qa-date').value,
      budgetId: selectedChip.dataset.id,
      amount,
      note,
    };

    // Build metadata if transfer info present
    const stk = (document.getElementById('qa-stk')?.value || '').trim();
    let metadata = null;
    if (stk) {
      const bankBin = (document.getElementById('qa-bank')?.value || '').trim();
      const bank = this.lookupBank(bankBin);
      metadata = {
        expense_id: expense.id,
        qr_bank: bank ? bank.shortName : '',
        qr_account: stk,
        qr_recipient: (document.getElementById('qa-recipient')?.value || '').trim(),
        qr_memo: (document.getElementById('qa-memo')?.value || '').trim(),
      };
    }

    // Commit: localStorage instant + WAL + async Supabase sync
    Drive.commitChange('upsert_expense', { expense, metadata });

    // If bank app selected, open deep link AFTER save is persisted
    if (this.selectedBankApp && stk) {
      this._openBankDeepLink(amount);
    }

    this.closeQuickAdd();
    Utils.showToast(`Đã lưu -${Utils.formatVND(amount)}`, 'success');
    if (App.state.currentView === 'expenses') this.render();
    if (App.state.currentView === 'dashboard') Dashboard.render();
  },

  _buildNote() {
    const parts = [];
    const stk = (document.getElementById('qa-stk')?.value || '').trim();
    const recipient = (document.getElementById('qa-recipient')?.value || '').trim();
    const memo = (document.getElementById('qa-memo')?.value || '').trim();
    const note = (document.getElementById('qa-note')?.value || '').trim();

    if (stk) parts.push(`STK: ${stk}`);
    if (recipient) parts.push(recipient);
    if (memo) parts.push(memo);
    if (note) parts.push(note);
    return parts.join(' | ');
  },

  _openBankDeepLink(amount) {
    const app = this.selectedBankApp;

    // MoMo: chỉ mở app, không truyền data
    if (app === 'momo') {
      this.trackRecentBank(app);
      setTimeout(() => { window.location.href = 'momo://'; }, 100);
      return;
    }

    let deeplink = `https://dl.vietqr.io/pay?app=${app}`;

    if (this.scannedQR && this.scannedQR.accountNo) {
      const qr = this.scannedQR;
      const bankCode = qr.bankCode || qr.bankBin;
      const userMemo = (document.getElementById('qa-memo')?.value || '').trim();
      const memo = userMemo || qr.addInfo || 'XMoni';
      const name = qr.accountName || '';

      if (app === 'tpb' && qr.rawText) {
        let qrContent = qr.rawText;
        // Rebuild QR with user amount if changed
        if (amount > 0 && amount !== qr.amount) {
          qrContent = this.rebuildQRWithAmount(qrContent, amount);
        }
        // Rebuild QR with user memo if changed
        if (userMemo && userMemo !== qr.addInfo) {
          qrContent = this.rebuildQRWithMemo(qrContent, userMemo);
        }
        deeplink = `hydro://applink?targetPage=QRPay&source=XMoni&qrContent=${encodeURIComponent(qrContent)}&callbackurl=${encodeURIComponent('https://levutuannghi.github.io/xmoni/')}`;
      } else {
        deeplink += `&ba=${qr.accountNo}@${bankCode}`;
        deeplink += `&am=${amount > 0 ? amount : 0}`;
        deeplink += `&tn=${encodeURIComponent(memo)}`;
        if (name) deeplink += `&bn=${encodeURIComponent(name)}`;
        deeplink += `&url=${encodeURIComponent('https://levutuannghi.github.io/xmoni/')}`;
      }
    } else {
      const stk = (document.getElementById('qa-stk')?.value || '').trim();
      const bankEl = document.getElementById('qa-bank');
      const bankBin = bankEl?.value || '';
      const bank = this.lookupBank(bankBin);
      const memo = (document.getElementById('qa-memo')?.value || '').trim() || 'XMoni';

      if (stk && bank) {
        if (app === 'tpb') {
          // TPBank uses hydro:// with full EMVCo QR content
          const qrContent = this._buildEMVCoQR(stk, bankBin, amount, memo);
          deeplink = `hydro://applink?targetPage=QRPay&source=XMoni&qrContent=${encodeURIComponent(qrContent)}&callbackurl=${encodeURIComponent('https://levutuannghi.github.io/xmoni/')}`;
        } else {
          deeplink += `&ba=${stk}@${bank.code}`;
          deeplink += `&am=${amount > 0 ? amount : 0}`;
          deeplink += `&tn=${encodeURIComponent(memo)}`;
          deeplink += `&url=${encodeURIComponent('https://levutuannghi.github.io/xmoni/')}`;
        }
      }
    }

    this.trackRecentBank(app);
    setTimeout(() => { window.location.href = deeplink; }, 100);
  },

  // === Delete expense ===
  deleteExpense(id) {
    if (!confirm('Xóa khoản chi này?')) return;
    Drive.commitChange('delete_expense', { id });
    this.render();
    Utils.showToast('Đã xóa');
  },

  // === QR Scanner ===
  qrScanner: null,

  startQRScanner() {
    if (this.qrScanner) { this.stopQRScanner(); return; }

    // Create popup overlay
    let overlay = document.getElementById('qr-scanner-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'qr-scanner-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
      document.body.appendChild(overlay);
    }

    const video = document.createElement('video');
    video.style.cssText = 'width:100%;max-width:400px;border-radius:12px;';

    overlay.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;width:100%;max-width:400px;margin-bottom:12px;';
    header.innerHTML = `<span style="color:white;font-weight:700;font-size:1rem;">📷 Quét mã QR</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:rgba(255,255,255,0.15);border:none;color:white;width:36px;height:36px;border-radius:50%;font-size:1.2rem;cursor:pointer;';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => Expense.stopQRScanner();
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    overlay.appendChild(video);

    // Status text
    const status = document.createElement('div');
    status.id = 'qr-scan-status';
    status.style.cssText = 'color:rgba(255,255,255,0.7);font-size:0.8rem;margin-top:12px;text-align:center;';
    status.textContent = 'Hướng camera vào mã QR...';
    overlay.appendChild(status);

    this._lastScannedText = null;

    try {
      this.qrScanner = new QrScanner(video, result => {
        // Prevent duplicate scans of same QR
        if (result.data === this._lastScannedText) return;
        this._lastScannedText = result.data;
        this.onQRScanned(result.data);
        // Auto-close scanner on successful scan
        this.stopQRScanner();
      }, {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      });
      this.qrScanner.start().catch(err => {
        const s = document.getElementById('qr-scan-status');
        if (s) { s.textContent = `❌ Camera: ${err}`; s.style.color = '#FF4757'; }
        this.qrScanner = null;
      });
    } catch (err) {
      const s = document.getElementById('qr-scan-status');
      if (s) { s.textContent = '❌ Không hỗ trợ camera'; s.style.color = '#FF4757'; }
      this.qrScanner = null;
    }
  },

  stopQRScanner() {
    if (this.qrScanner) { this.qrScanner.stop(); this.qrScanner.destroy(); this.qrScanner = null; }
    const overlay = document.getElementById('qr-scanner-overlay');
    if (overlay) overlay.remove();
  },

  async uploadQRImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Engine 1: Html5Qrcode (ZXing-based, best for QR with logos — proven to work)
    if (typeof Html5Qrcode !== 'undefined') {
      try {
        // Create temp container FIRST (required by Html5Qrcode)
        let tmp = document.getElementById('__qr_scan_tmp__');
        if (!tmp) {
          tmp = document.createElement('div');
          tmp.id = '__qr_scan_tmp__';
          tmp.style.display = 'none';
          document.body.appendChild(tmp);
        }
        const html5Qr = new Html5Qrcode('__qr_scan_tmp__', false);
        const decoded = await html5Qr.scanFile(file, false);
        html5Qr.clear();
        if (decoded) {
          this.onQRScanned(decoded);
          event.target.value = '';
          return;
        }
      } catch (e) { /* fallthrough */ }
    }

    // Engine 2: Native BarcodeDetector (Chrome 83+, Safari 17.2+)
    if (typeof BarcodeDetector !== 'undefined') {
      try {
        const bitmap = await createImageBitmap(file);
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const results = await detector.detect(bitmap);
        bitmap.close();
        if (results.length > 0) {
          this.onQRScanned(results[0].rawValue);
          event.target.value = '';
          return;
        }
      } catch (e) { /* fallthrough */ }
    }

    // Engine 3: QrScanner (jsQR fallback — may fail on CDN due to CORS worker)
    try {
      const result = await QrScanner.scanImage(file, {
        returnDetailedScanResult: true,
        alsoTryWithoutScanRegion: true,
      });
      this.onQRScanned(result.data);
    } catch (err) {
      const banner = document.getElementById('qr-scan-banner');
      if (banner) {
        banner.innerHTML = '<div class="qr-banner error">\u274c Không tìm thấy mã QR trong ảnh</div>';
        setTimeout(() => banner.innerHTML = '', 3000);
      }
    }
    event.target.value = '';
  },

  onQRScanned(text) {
    // Don't stop scanner - user closes manually

    const tlv = this.parseEMVCo(text);
    const tag38 = tlv['38'];
    const banner = document.getElementById('qr-scan-banner');

    if (!tag38) {
      if (banner) {
        banner.innerHTML = '<div class="qr-banner error">❌ Không phải mã VietQR</div>';
        setTimeout(() => banner.innerHTML = '', 3000);
      }
      return;
    }

    const tag38Data = this.parseEMVCo(tag38);
    const merchantData = this.parseEMVCo(tag38Data['01'] || '');
    const bankBin = merchantData['00'] || '';
    const accountNo = merchantData['01'] || '';
    const rawAmount = tlv['54'] ? tlv['54'].replace(/[^0-9.]/g, '') : '';
    const amount = rawAmount ? Math.round(parseFloat(rawAmount)) : 0;
    console.log('[QR Debug] tag54 raw:', JSON.stringify(tlv['54']), '→ cleaned:', rawAmount, '→ amount:', amount);
    const accountName = tlv['59'] || '';

    let addInfo = '';
    if (tlv['62']) { const t62 = this.parseEMVCo(tlv['62']); addInfo = t62['08'] || ''; }

    const bank = this.lookupBank(bankBin);
    const bankName = bank ? bank.shortName : bankBin;
    const bankCode = bank ? bank.code : null;

    this.scannedQR = { bankBin, accountNo, amount, addInfo, bankName, accountName, bankCode, rawText: text };

    // Auto-fill transfer fields
    const bankInput = document.getElementById('qa-bank');
    const bankDisplay = document.getElementById('qa-bank-display');
    const bankBtn = document.getElementById('qa-bank-btn');
    if (bankBin) {
      if (bankInput) bankInput.value = bankBin;
      if (bankDisplay) bankDisplay.textContent = bankName;
      if (bankBtn) bankBtn.disabled = true;
      this.selectedBankBin = bankBin;
    }

    const stkInput = document.getElementById('qa-stk');
    if (stkInput && accountNo) { stkInput.value = accountNo; stkInput.readOnly = true; }

    const recipientInput = document.getElementById('qa-recipient');
    if (recipientInput && accountName) recipientInput.value = accountName;

    const memoInput = document.getElementById('qa-memo');
    if (memoInput && addInfo) { memoInput.value = addInfo; memoInput.readOnly = true; }

    // Auto-fill amount + lock numpad if QR has amount
    if (amount > 0) {
      this.inputAmount = (amount / 1000).toString();
      const display = document.getElementById('qa-amount');
      if (display) {
        display.textContent = Utils.formatVND(amount);
        display.classList.add('has-value');
        display.classList.add('locked');
      }
      const btn = document.getElementById('btn-save-expense');
      if (btn) btn.disabled = false;

      // Hide numpad
      this.qrAmountLocked = true;
      const numpadSection = document.getElementById('qa-numpad-section');
      if (numpadSection) numpadSection.style.display = 'none';
    }



    Utils.showToast('Đã quét QR!', 'success');
  },

  // === Bank Field Picker (transfer field) ===
  selectedBankBin: null,

  showBankFieldPicker() {
    if (!this.bankList || this.bankList.length === 0) {
      this.loadBankList().then(() => this.showBankFieldPicker());
      return;
    }

    let overlay = document.getElementById('bank-field-picker-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'bank-field-picker-overlay';
      overlay.className = 'bank-picker-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="bank-picker-sheet" onclick="event.stopPropagation()">
        <div class="bank-picker-header">
          <h3>Chọn ngân hàng</h3>
          <button class="bank-picker-close" onclick="Expense.closeBankFieldPicker()">✕</button>
        </div>
        <div class="bank-picker-search">
          <input type="text" placeholder="🔍 Tìm kiếm" id="bank-field-search" oninput="Expense.filterBankFields(this.value)">
        </div>
        <div class="bank-picker-body" id="bank-field-body">
          <div class="bank-picker-grid" id="bank-field-grid">
            <button class="bank-picker-item ${!this.selectedBankBin ? 'selected' : ''}" onclick="event.stopPropagation();Expense.selectBankField('')">
              <span style="font-size:1.5rem">🚫</span>
              <span>Không chọn</span>
            </button>
            ${this.bankList.map(b => {
      const sel = this.selectedBankBin === b.bin ? 'selected' : '';
      return `<button class="bank-picker-item ${sel}" data-bin="${b.bin}" onclick="event.stopPropagation();Expense.selectBankField('${b.bin}')">
                <img src="${b.logo}" onerror="this.style.display='none'">
                <span>${b.shortName}</span>
              </button>`;
    }).join('')}
          </div>
        </div>
      </div>
    `;

    overlay.onclick = () => this.closeBankFieldPicker();
    overlay.classList.add('active');
    setTimeout(() => document.getElementById('bank-field-search')?.focus(), 300);
  },

  filterBankFields(query) {
    const q = query.toLowerCase().trim();
    const grid = document.getElementById('bank-field-grid');
    if (!grid) return;
    grid.querySelectorAll('.bank-picker-item').forEach(item => {
      const name = item.querySelector('span')?.textContent?.toLowerCase() || '';
      item.style.display = !q || name.includes(q) ? '' : 'none';
    });
  },

  selectBankField(bin) {
    this.selectedBankBin = bin || null;
    document.getElementById('qa-bank').value = bin;
    const display = document.getElementById('qa-bank-display');
    if (display) {
      if (bin) {
        const bank = this.bankList?.find(b => b.bin === bin);
        display.textContent = bank ? bank.shortName : bin;
      } else {
        display.textContent = 'Chọn ngân hàng';
      }
    }
    this.closeBankFieldPicker();
  },

  closeBankFieldPicker() {
    const overlay = document.getElementById('bank-field-picker-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  // === Helpers ===
  closeQuickAdd() {
    this.stopQRScanner();
    document.getElementById('expense-modal').classList.remove('active');
    this.inputAmount = '';
    this.scannedQR = null;
    this.qrAmountLocked = false;
  },

  trackRecentBank(code) {
    let recent = JSON.parse(localStorage.getItem('xmoni_recent_banks') || '[]');
    recent = recent.filter(c => c !== code);
    recent.unshift(code);
    recent = recent.slice(0, 10);
    localStorage.setItem('xmoni_recent_banks', JSON.stringify(recent));
  },

  prevMonth() {
    App.state.selectedMonth = Utils.getPrevMonthKey(App.state.selectedMonth);
    this.render();
  },

  nextMonth() {
    App.state.selectedMonth = Utils.getNextMonthKey(App.state.selectedMonth);
    this.render();
  },

  // === EMVCo / VietQR parsing ===
  // Build a complete VietQR EMVCo QR string from fields
  _buildEMVCoQR(accountNo, bankBin, amount, memo) {
    const tlv = (tag, val) => tag + val.length.toString().padStart(2, '0') + val;

    let qr = '';
    qr += tlv('00', '01');                     // Payload format indicator
    qr += tlv('01', '12');                     // Dynamic QR
    // Tag 38: VietQR merchant info
    const guid = tlv('00', 'A000000727');      // VietQR GUID
    const merchant = tlv('00', bankBin) + tlv('01', accountNo);
    const tag01 = tlv('01', merchant);
    qr += tlv('38', guid + tag01 + tlv('02', 'QRIBFTTA')); // Service code
    qr += tlv('52', '5999');                   // MCC
    qr += tlv('53', '704');                    // Currency VND
    if (amount > 0) {
      qr += tlv('54', amount.toString());      // Amount
    }
    qr += tlv('58', 'VN');                     // Country
    // Tag 62: Additional data (memo)
    if (memo) {
      qr += tlv('62', tlv('08', memo));
    }
    return this._recalcCRC(qr);
  },

  rebuildQRWithAmount(raw, newAmount) {
    let base = raw.replace(/6304[A-F0-9]{4}$/i, '');
    // Parse all tags, replace/add tag 54
    const tags = this.parseEMVCo(base);
    tags['54'] = newAmount.toString();
    // Rebuild in proper order
    let rebuilt = '';
    const orderedKeys = Object.keys(tags).sort();
    for (const k of orderedKeys) {
      rebuilt += k + tags[k].length.toString().padStart(2, '0') + tags[k];
    }
    return this._recalcCRC(rebuilt);
  },

  rebuildQRWithMemo(raw, newMemo) {
    let base = raw.replace(/6304[A-F0-9]{4}$/i, '');
    const tags = this.parseEMVCo(base);
    // Tag 62 sub-tags: parse, replace sub-tag 08
    const tag62Content = tags['62'] || '';
    const subTags = tag62Content ? this.parseEMVCo(tag62Content) : {};
    subTags['08'] = newMemo;
    // Rebuild tag 62
    let rebuilt62 = '';
    for (const [k, v] of Object.entries(subTags)) {
      rebuilt62 += k + v.length.toString().padStart(2, '0') + v;
    }
    tags['62'] = rebuilt62;
    // Rebuild full QR
    let rebuilt = '';
    const orderedKeys = Object.keys(tags).sort();
    for (const k of orderedKeys) {
      rebuilt += k + tags[k].length.toString().padStart(2, '0') + tags[k];
    }
    return this._recalcCRC(rebuilt);
  },

  _recalcCRC(base) {
    base += '6304';
    let crc = 0xFFFF;
    for (let i = 0; i < base.length; i++) {
      crc ^= base.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    return base + crc.toString(16).toUpperCase().padStart(4, '0');
  },

  parseEMVCo(data) {
    const r = {};
    let i = 0;
    while (i < data.length - 3) {
      const tag = data.substring(i, i + 2);
      const len = parseInt(data.substring(i + 2, i + 4));
      if (isNaN(len) || i + 4 + len > data.length) break;
      r[tag] = data.substring(i + 4, i + 4 + len);
      i += 4 + len;
    }
    return r;
  },

  bankList: null,
  appList: null,

  async loadBankList() {
    const cached = localStorage.getItem('xmoni_banks');
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 86400000) { this.bankList = data; return; }
      } catch (e) { }
    }
    try {
      const res = await fetch('https://api.vietqr.io/v2/banks');
      const json = await res.json();
      if (json.code === '00' && json.data) {
        this.bankList = json.data;
        localStorage.setItem('xmoni_banks', JSON.stringify({ data: json.data, ts: Date.now() }));
      }
    } catch (e) { console.warn('Cannot load bank list:', e); }
  },

  async loadAppList() {
    const cached = localStorage.getItem('xmoni_apps');
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 86400000) { this.appList = data; this._injectExtraApps(); return; }
      } catch (e) { }
    }
    try {
      const isAndroid = /android/i.test(navigator.userAgent);
      const apiUrl = isAndroid
        ? 'https://api.vietqr.io/v2/android-app-deeplinks'
        : 'https://api.vietqr.io/v2/ios-app-deeplinks';
      const res = await fetch(apiUrl);
      const json = await res.json();
      if (json.apps) {
        this.appList = json.apps;
        this._injectExtraApps();
        localStorage.setItem('xmoni_apps', JSON.stringify({ data: this.appList, ts: Date.now() }));
      }
    } catch (e) { console.warn('Cannot load app list:', e); }
  },

  // Inject apps not in VietQR API (e.g. MoMo — open-app only)
  _injectExtraApps() {
    if (!this.appList) return;
    if (!this.appList.find(a => a.appId === 'momo')) {
      this.appList.unshift({
        appId: 'momo',
        appName: 'MoMo',
        appLogo: 'https://developers.momo.vn/v3/assets/images/MOMO-Logo-App-6262c3743a290ef02396a24ea2b66c35.png',
        autofill: 0,
        monthlyInstall: 999999 // sort to top
      });
    }
  },

  lookupBank(bin) {
    if (!this.bankList) return null;
    const bank = this.bankList.find(b => b.bin === bin);
    if (!bank) return null;
    return { code: bank.code.toLowerCase(), shortName: bank.shortName, bin: bank.bin };
  },

  // ========== EDIT EXPENSE ==========
  showEditExpense(id) {
    const data = App.state.data;
    const expense = data.expenses.find(e => e.id === id);
    if (!expense) return;

    const budget = data.budgets.find(b => b.id === expense.budgetId);
    const modal = document.getElementById('expense-modal');

    modal.innerHTML = `
      <div class="modal-content quick-add-modal slide-up">
        <div class="quick-add-header">
          <h3>Chỉnh sửa chi tiêu</h3>
          <button class="btn-icon" onclick="Expense.closeQuickAdd()">✕</button>
        </div>
        <div class="qa-body">
          <div class="edit-field">
            <label>Danh mục</label>
            <div class="quick-add-categories" id="edit-categories">
              ${data.budgets.map(b => {
      const sel = b.id === expense.budgetId ? 'selected' : '';
      return `<button class="category-chip ${sel}" style="--chip-color:${b.color}" data-id="${b.id}" onclick="Expense.selectEditCategory(this)"><span>${b.icon}</span><span>${b.name}</span></button>`;
    }).join('')}
            </div>
          </div>
          <div class="edit-field">
            <label>Số tiền</label>
            <div class="input-vnd" style="justify-content:center;font-size:1.3rem">
              <input type="text" inputmode="numeric" id="edit-amount" value="${expense.amount.toLocaleString('vi-VN')}" onfocus="this.select()" style="text-align:center;font-size:1.3rem;width:100%">
              <span>đ</span>
            </div>
          </div>
          <div class="edit-field">
            <label>Ngày</label>
            <input type="date" id="edit-date" value="${expense.date}" class="qa-transfer-input">
          </div>
          <div class="edit-field">
            <label>Ghi chú</label>
            <input type="text" id="edit-note" value="${expense.note || ''}" class="qa-transfer-input" placeholder="Ghi chú (tuỳ chọn)">
          </div>

          <div class="edit-split-section">
            <label>✂️ Chia nhỏ</label>
            <div class="split-controls">
              <div class="split-row">
                <span>Chia trong</span>
                <input type="number" id="edit-split-count" min="1" max="120" value="${expense.splitCount || 1}" class="split-input" oninput="Expense.updateEditSplitPreview()">
                <select id="edit-split-unit" class="split-select" onchange="Expense.updateEditSplitPreview()">
                  <option value="day" ${expense.splitUnit === 'day' ? 'selected' : ''}>Ngày</option>
                  <option value="week" ${expense.splitUnit === 'week' ? 'selected' : ''}>Tuần</option>
                  <option value="month" ${(!expense.splitUnit || expense.splitUnit === 'month') ? 'selected' : ''}>Tháng</option>
                </select>
              </div>
              <div class="split-row">
                <span>Bắt đầu</span>
                <input type="date" id="edit-split-start" value="${expense.splitStart || expense.date}" class="split-date" onchange="Expense.updateEditSplitPreview()">
              </div>
              <div id="edit-split-preview" class="split-preview"></div>
            </div>
          </div>
        </div>

        <div class="qa-bottom-bar">
          <div class="qa-action-row">
            <button class="btn-delete-expense" onclick="Expense.deleteExpense('${expense.id}')">🗑️ Xóa</button>
            <button class="btn-save-expense" onclick="Expense.saveEditExpense('${expense.id}')">💾 Lưu</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
    this.updateEditSplitPreview();
  },

  selectEditCategory(btn) {
    document.querySelectorAll('#edit-categories .category-chip').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
  },

  updateEditSplitPreview() {
    const count = parseInt(document.getElementById('edit-split-count')?.value) || 1;
    const unit = document.getElementById('edit-split-unit')?.value || 'month';
    const startDate = document.getElementById('edit-split-start')?.value || Utils.getToday();
    const amountStr = document.getElementById('edit-amount')?.value || '0';
    const totalAmount = Utils.parseVND(amountStr);
    const preview = document.getElementById('edit-split-preview');
    if (!preview) return;

    if (count <= 1) {
      preview.innerHTML = '<span class="split-hint">Nhập số lớn hơn 1 để chia nhỏ</span>';
      return;
    }

    const perUnit = Math.round(totalAmount / count);
    const dates = Utils.getSplitDates(startDate, Math.min(count, 12), unit); // Show max 12
    const unitLabel = unit === 'day' ? 'ngày' : unit === 'week' ? 'tuần' : 'tháng';

    preview.innerHTML = `
      <div class="split-summary">Mỗi ${unitLabel}: <strong>${Utils.formatVND(perUnit)}</strong> × ${count} kỳ</div>
      <div class="split-dates">
        ${dates.map((d, i) => `<div class="split-date-item">📅 ${Utils.formatDate(d)} → ${Utils.formatVND(perUnit)}</div>`).join('')}
        ${count > 12 ? `<div class="split-date-item">... và ${count - 12} kỳ nữa</div>` : ''}
      </div>
    `;
  },

  saveEditExpense(id) {
    const selectedChip = document.querySelector('#edit-categories .category-chip.selected');
    if (!selectedChip) { Utils.showToast('Chọn danh mục', 'error'); return; }

    const amount = Utils.parseVND(document.getElementById('edit-amount').value);
    if (amount <= 0) { Utils.showToast('Nhập số tiền', 'error'); return; }

    const date = document.getElementById('edit-date').value;
    const note = (document.getElementById('edit-note').value || '').trim();
    const splitCount = parseInt(document.getElementById('edit-split-count').value) || 1;
    const splitUnit = document.getElementById('edit-split-unit').value;
    const splitStart = document.getElementById('edit-split-start').value;

    const expense = {
      id,
      date,
      budgetId: selectedChip.dataset.id,
      amount,
      note,
      splitCount: splitCount > 1 ? splitCount : null,
      splitUnit: splitCount > 1 ? splitUnit : null,
      splitStart: splitCount > 1 ? splitStart : null,
    };

    Drive.commitChange('upsert_expense', { expense, metadata: null });
    this.closeQuickAdd();
    Utils.showToast('Đã cập nhật', 'success');
    if (App.state.currentView === 'expenses') this.render();
    if (App.state.currentView === 'dashboard') Dashboard.render();
  },

  // ========== SPLIT FROM QUICK ADD ==========
  showSplitFromQuickAdd() {
    const parsed = parseFloat(this.inputAmount) || 0;
    const amount = Math.round(parsed * 1000);
    if (amount === 0) { Utils.showToast('Nhập số tiền trước', 'error'); return; }

    const selectedChip = document.querySelector('.category-chip.selected');
    if (!selectedChip) { Utils.showToast('Chọn danh mục', 'error'); return; }

    // Build note
    const note = this._buildNote();
    const date = document.getElementById('qa-date').value;

    // Build metadata if present
    const stk = (document.getElementById('qa-stk')?.value || '').trim();
    let metadata = null;
    if (stk) {
      const bankBin = (document.getElementById('qa-bank')?.value || '').trim();
      const bank = this.lookupBank(bankBin);
      metadata = {
        expense_id: null, // will be set after generating id
        qr_bank: bank ? bank.shortName : '',
        qr_account: stk,
        qr_recipient: (document.getElementById('qa-recipient')?.value || '').trim(),
        qr_memo: (document.getElementById('qa-memo')?.value || '').trim(),
      };
    }

    // Show split config popup
    const modal = document.getElementById('expense-modal');
    modal.innerHTML = `
      <div class="modal-content quick-add-modal slide-up">
        <div class="quick-add-header">
          <h3>✂️ Chia ${Utils.formatVND(amount)}</h3>
          <button class="btn-icon" onclick="Expense.closeQuickAdd()">✕</button>
        </div>
        <div class="qa-body">
          <div class="split-controls">
            <div class="split-row">
              <span>Chia trong</span>
              <input type="number" id="split-count" min="2" max="120" value="2" class="split-input" oninput="Expense.updateSplitPreview(${amount})">
              <select id="split-unit" class="split-select" onchange="Expense.updateSplitPreview(${amount})">
                <option value="day">Ngày</option>
                <option value="week">Tuần</option>
                <option value="month" selected>Tháng</option>
              </select>
            </div>
            <div class="split-row">
              <span>Bắt đầu</span>
              <input type="date" id="split-start" value="${date}" class="split-date" onchange="Expense.updateSplitPreview(${amount})">
            </div>
            <div id="split-preview" class="split-preview"></div>
          </div>
        </div>
        <div class="qa-bottom-bar">
          <div class="qa-action-row">
            <button class="btn-secondary" onclick="Expense.showQuickAdd()" style="flex:1">← Quay lại</button>
            <button class="btn-save-expense" id="btn-confirm-split" onclick="Expense.confirmSplitFromQuickAdd()" style="flex:2">✂️ Tạo chia nhỏ</button>
          </div>
        </div>
      </div>
    `;

    // Store context for confirm
    this._splitContext = { amount, budgetId: selectedChip.dataset.id, note, date, metadata };

    modal.classList.add('active');
    this.updateSplitPreview(amount);
  },

  updateSplitPreview(totalAmount) {
    const count = parseInt(document.getElementById('split-count')?.value) || 2;
    const unit = document.getElementById('split-unit')?.value || 'month';
    const startDate = document.getElementById('split-start')?.value || Utils.getToday();
    const preview = document.getElementById('split-preview');
    if (!preview) return;

    const perUnit = Math.round(totalAmount / count);
    const dates = Utils.getSplitDates(startDate, Math.min(count, 12), unit);
    const unitLabel = unit === 'day' ? 'ngày' : unit === 'week' ? 'tuần' : 'tháng';

    preview.innerHTML = `
      <div class="split-summary">Mỗi ${unitLabel}: <strong>${Utils.formatVND(perUnit)}</strong> × ${count} kỳ</div>
      <div class="split-dates">
        ${dates.map(d => `<div class="split-date-item">📅 ${Utils.formatDate(d)} → ${Utils.formatVND(perUnit)}</div>`).join('')}
        ${count > 12 ? `<div class="split-date-item">... và ${count - 12} kỳ nữa</div>` : ''}
      </div>
    `;
  },

  confirmSplitFromQuickAdd() {
    const ctx = this._splitContext;
    if (!ctx) return;

    const count = parseInt(document.getElementById('split-count')?.value) || 2;
    const unit = document.getElementById('split-unit')?.value || 'month';
    const startDate = document.getElementById('split-start')?.value || ctx.date;

    const expense = {
      id: Utils.generateId(),
      date: ctx.date,
      budgetId: ctx.budgetId,
      amount: ctx.amount,
      note: ctx.note,
      splitCount: count,
      splitUnit: unit,
      splitStart: startDate,
    };

    const metadata = ctx.metadata;
    if (metadata) metadata.expense_id = expense.id;

    Drive.commitChange('upsert_expense', { expense, metadata });

    // Open bank app if selected
    if (this.selectedBankApp && metadata?.qr_account) {
      this._openBankDeepLink(ctx.amount);
    }

    this._splitContext = null;
    this.closeQuickAdd();
    Utils.showToast(`Đã tạo chia ${count} ${unit === 'day' ? 'ngày' : unit === 'week' ? 'tuần' : 'tháng'}`, 'success');
    if (App.state.currentView === 'expenses') this.render();
    if (App.state.currentView === 'dashboard') Dashboard.render();
  },
};
