// ============================================
// XMoni - Expense Entry & Listing
// ============================================

const Expense = {
  inputAmount: '',
  lastCategoryId: localStorage.getItem('xmoni_last_category') || null,
  scannedQR: null, // stores parsed QR data after scan

  // Init: load bank list from VietQR API
  init() { this.loadBankList(); this.loadAppList(); },

  // Render expense view
  render() {
    const container = document.getElementById('view-expenses');
    const data = App.state.data;
    const monthKey = App.state.selectedMonth;
    const monthExpenses = data.expenses
      .filter(e => Utils.getMonthKey(e.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    // Group by date
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
      return `
                <div class="expense-item" data-id="${e.id}">
                  <div class="expense-item-left">
                    <span class="expense-item-icon" style="background: ${budget ? budget.color : '#666'}">${budget ? budget.icon : '?'}</span>
                    <div class="expense-item-info">
                      <span class="expense-item-category">${budget ? budget.name : 'Đã xóa'}</span>
                      ${e.note ? `<span class="expense-item-note">${e.note}</span>` : ''}
                    </div>
                  </div>
                  <div class="expense-item-right">
                    <span class="expense-item-amount">-${Utils.formatVND(e.amount)}</span>
                    <button class="btn-delete" onclick="Expense.deleteExpense('${e.id}')">×</button>
                  </div>
                </div>
              `;
    }).join('')}
          </div>
        `).join('')}
      </div>
    `;
  },

  // Show quick add modal - COMPACT layout for iPhone
  showQuickAdd() {
    const data = App.state.data;
    if (data.budgets.length === 0) {
      Utils.showToast('Tạo danh mục chi tiêu trước!', 'error');
      App.switchView('budgets');
      return;
    }

    this.inputAmount = '';
    this.scannedQR = null;
    const modal = document.getElementById('expense-modal');

    // Calculate daily spending
    const monthKey = Utils.getCurrentMonthKey();
    const today = Utils.getToday();
    const totalDays = Utils.getDaysInMonth(monthKey);
    const remainingDays = Utils.getRemainingDays(monthKey);

    let totalBudget = 0, totalSpent = 0, totalCarryover = 0, todaySpent = 0;
    data.budgets.forEach(b => {
      const monthly = (data.monthlyBudgets[monthKey] || {})[b.id] || {};
      totalBudget += monthly.amount || 0;
      totalCarryover += Budget.calculateCarryovers(monthKey)[b.id] || 0;
      totalSpent += Budget.getTotalSpent(monthKey, b.id);
    });
    todaySpent = data.expenses.filter(e => e.date === today).reduce((s, e) => s + e.amount, 0);

    const totalRemaining = totalBudget + totalCarryover - totalSpent;
    const dailyRaw = remainingDays > 0 ? totalRemaining / remainingDays : 0;
    const dailyBase = totalDays > 0 ? totalBudget / totalDays : 0;
    const dailyAllowance = Math.max(0, Math.round(Math.min(dailyRaw, dailyBase)));
    const dailyPct = dailyAllowance > 0 ? Math.min((todaySpent / dailyAllowance) * 100, 100) : 0;
    const dailyClass = dailyPct > 85 ? 'danger' : dailyPct > 60 ? 'warning' : 'safe';

    modal.innerHTML = `
      <div class="modal-overlay" onclick="Expense.closeQuickAdd()"></div>
      <div class="modal-content quick-add-modal slide-up">

        <div class="quick-add-header">
          <h3>Thêm chi tiêu</h3>
          <div class="qa-header-actions">
            <button class="btn-icon" onclick="Expense.startQRScanner()" title="Quét QR">📷</button>
            <button class="btn-icon" onclick="Expense.closeQuickAdd()">✕</button>
          </div>
        </div>

        <div class="qa-daily-bar">
          <div class="qa-daily-info">
            <span>Hôm nay: <strong>${Utils.formatCompactVND(todaySpent)}</strong></span>
            <span>/ ${Utils.formatCompactVND(dailyAllowance)}</span>
          </div>
          <div class="qa-daily-progress"><div class="qa-daily-fill ${dailyClass}" style="width:${dailyPct}%"></div></div>
        </div>

        <div id="qr-scanner-container"></div>
        <div id="qr-scan-banner"></div>

        <div class="quick-add-categories" id="qa-categories">
          ${data.budgets.map(b => {
      const sel = this.lastCategoryId ? b.id === this.lastCategoryId : false;
      return `<button class="category-chip ${sel ? 'selected' : ''}" style="--chip-color:${b.color}" data-id="${b.id}" onclick="Expense.selectCategory(this)"><span>${b.icon}</span><span>${b.name}</span></button>`;
    }).join('')}
        </div>

        <input type="hidden" id="qa-date" value="${today}">
        <input type="hidden" id="qa-note" value="">

        <div class="quick-add-display compact">
          <span class="qa-amount" id="qa-amount">0đ</span>
        </div>

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

        <div class="qa-bottom-row">
          <button class="btn-save-expense" id="btn-save-expense" onclick="Expense.saveExpense()" disabled>💾 Lưu</button>
        </div>

        <div class="qa-bank-label">Lưu & mở app ngân hàng:</div>
        <div class="qa-bank-grid" id="qa-bank-grid"></div>

      </div>
    `;

    modal.classList.add('active');
    if (!modal.querySelector('.category-chip.selected')) {
      modal.querySelector('.category-chip')?.classList.add('selected');
    }
    this.renderBankGrid();
  },

  // Render bank grid from iOS deep links API data
  renderBankGrid() {
    const grid = document.getElementById('qa-bank-grid');
    if (!grid) return;

    if (!this.appList || this.appList.length === 0) {
      grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem;text-align:center">Đang tải...</p>';
      this.loadAppList().then(() => this.renderBankGrid());
      return;
    }

    // Sort: recently used first, then by popularity (monthlyInstall)
    const recent = JSON.parse(localStorage.getItem('xmoni_recent_banks') || '[]');
    const sorted = [...this.appList].sort((a, b) => {
      const ai = recent.indexOf(a.appId);
      const bi = recent.indexOf(b.appId);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return (b.monthlyInstall || 0) - (a.monthlyInstall || 0);
    });

    grid.innerHTML = sorted.map(app =>
      `<button class="bank-grid-btn" onclick="Expense.saveAndPay('${app.appId}')" title="${app.appName}">
        <img src="${app.appLogo}" alt="${app.appName}" class="bank-logo" onerror="this.style.display='none'">
        <span>${app.appName.replace(/[\u200E\u200F]/g, '').replace(/^\u200e/g, '')}</span>
      </button>`
    ).join('');
  },

  // Track recently used bank
  trackRecentBank(code) {
    let recent = JSON.parse(localStorage.getItem('xmoni_recent_banks') || '[]');
    recent = recent.filter(c => c !== code);
    recent.unshift(code);
    recent = recent.slice(0, 10); // keep top 10
    localStorage.setItem('xmoni_recent_banks', JSON.stringify(recent));
  },

  // Category selection
  selectCategory(btn) {
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    this.lastCategoryId = btn.dataset.id;
    localStorage.setItem('xmoni_last_category', btn.dataset.id);
  },

  // Preset amount - one tap
  presetAmount(k) {
    this.inputAmount = k.toString();
    const realAmount = k * 1000;
    const display = document.getElementById('qa-amount');
    display.textContent = Utils.formatVND(realAmount);
    display.classList.add('has-value');
    document.getElementById('btn-save-expense').disabled = false;
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
  },

  // Numpad input (x1000)
  numpadPress(key) {
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

  // Save expense
  saveExpense() {
    const parsed = parseFloat(this.inputAmount) || 0;
    const amount = Math.round(parsed * 1000);
    if (amount === 0) return;

    const selectedChip = document.querySelector('.category-chip.selected');
    if (!selectedChip) {
      Utils.showToast('Chọn danh mục', 'error');
      return;
    }

    const expense = {
      id: Utils.generateId(),
      date: document.getElementById('qa-date').value,
      budgetId: selectedChip.dataset.id,
      amount,
      note: (document.getElementById('qa-note').value || '').trim(),
    };

    App.state.data.expenses.push(expense);
    Drive.queueSave(App.state.data);
    this.closeQuickAdd();
    Utils.showToast(`Đã lưu -${Utils.formatVND(amount)}`, 'success');
    if (App.state.currentView === 'expenses') this.render();
    if (App.state.currentView === 'dashboard') Dashboard.render();
  },

  // Delete expense
  deleteExpense(id) {
    if (!confirm('Xóa khoản chi này?')) return;
    App.state.data.expenses = App.state.data.expenses.filter(e => e.id !== id);
    Drive.queueSave(App.state.data);
    this.render();
    Utils.showToast('Đã xóa');
  },

  // Save expense then open banking app (or show QR if scanned)
  saveAndPay(app) {
    const parsed = parseFloat(this.inputAmount) || 0;
    const amount = Math.round(parsed * 1000);

    // Save the expense
    if (amount > 0) {
      const selectedChip = document.querySelector('.category-chip.selected');
      if (selectedChip) {
        const expense = {
          id: Utils.generateId(),
          date: document.getElementById('qa-date').value,
          budgetId: selectedChip.dataset.id,
          amount,
          note: (document.getElementById('qa-note').value || '').trim(),
        };
        App.state.data.expenses.push(expense);
        Drive.queueSave(App.state.data);
        Utils.showToast(`Đã lưu -${Utils.formatVND(amount)}`, 'success');
        if (App.state.currentView === 'expenses') this.render();
        if (App.state.currentView === 'dashboard') Dashboard.render();
      }
    }

    // Build VietQR deep link with payment data
    let deeplink = `https://dl.vietqr.io/pay?app=${app}`;
    if (this.scannedQR && this.scannedQR.accountNo) {
      const qr = this.scannedQR;
      const bankCode = qr.bankCode || qr.bankBin;
      const memo = qr.addInfo || 'XMoni';
      const name = qr.accountName || '';
      deeplink += `&ba=${qr.accountNo}@${bankCode}`;
      deeplink += `&am=${amount > 0 ? amount : 0}`;
      deeplink += `&tn=${encodeURIComponent(memo)}`;
      if (name) deeplink += `&bn=${encodeURIComponent(name)}`;
      deeplink += `&url=${encodeURIComponent('https://levutuannghi.github.io/xmoni/')}`;
    }

    this.trackRecentBank(app);
    this.closeQuickAdd();
    window.open(deeplink, '_blank');
  },

  // ===== QR Scanner =====
  qrScanner: null,

  startQRScanner() {
    const container = document.getElementById('qr-scanner-container');
    if (this.qrScanner) { this.stopQRScanner(); return; }

    container.innerHTML = `
      <div class="qr-scanner-wrapper">
        <div id="qr-reader"></div>
        <button class="preset-btn" onclick="Expense.stopQRScanner()" style="width:100%;margin-top:6px">✕ Đóng camera</button>
      </div>
    `;

    try {
      this.qrScanner = new Html5Qrcode('qr-reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
      const scanConfig = {
        fps: 20,
        qrbox: { width: 280, height: 280 },
        disableFlip: true,
        videoConstraints: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      };
      this.qrScanner.start(
        { facingMode: 'environment' },
        scanConfig,
        (text) => this.onQRScanned(text),
        () => { }
      ).catch((err) => {
        container.innerHTML = `<p style="color:var(--accent-danger);text-align:center;padding:8px;font-size:0.8rem">Camera: ${err}</p>`;
        this.qrScanner = null;
      });
    } catch (err) {
      container.innerHTML = `<p style="color:var(--accent-danger);text-align:center;padding:8px;font-size:0.8rem">Không hỗ trợ camera</p>`;
      this.qrScanner = null;
    }
  },

  stopQRScanner() {
    if (this.qrScanner) { this.qrScanner.stop().catch(() => { }); this.qrScanner = null; }
    const c = document.getElementById('qr-scanner-container');
    if (c) c.innerHTML = '';
  },

  // Parse EMVCo TLV (VietQR / NAPAS format)
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

  // Bank list (for BIN lookup) and app list (for deep links)
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
        if (Date.now() - ts < 86400000) { this.appList = data; return; }
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
        localStorage.setItem('xmoni_apps', JSON.stringify({ data: json.apps, ts: Date.now() }));
      }
    } catch (e) { console.warn('Cannot load app list:', e); }
  },

  lookupBank(bin) {
    if (!this.bankList) return null;
    const bank = this.bankList.find(b => b.bin === bin);
    if (!bank) return null;
    return { code: bank.code.toLowerCase(), shortName: bank.shortName, bin: bank.bin };
  },

  onQRScanned(text) {
    this.stopQRScanner();

    const tlv = this.parseEMVCo(text);
    const tag38 = tlv['38'];
    const banner = document.getElementById('qr-scan-banner');

    if (!tag38) {
      banner.innerHTML = '<div class="qr-banner error">❌ Không phải mã VietQR</div>';
      setTimeout(() => banner.innerHTML = '', 3000);
      return;
    }

    // 3-level parse: Tag38 → Sub01 (merchant data) → Sub00 (BIN) + Sub01 (account)
    const tag38Data = this.parseEMVCo(tag38);
    const merchantData = this.parseEMVCo(tag38Data['01'] || '');
    const bankBin = merchantData['00'] || '';
    const accountNo = merchantData['01'] || '';

    // Tag 54 = amount, Tag 59 = account holder name
    const amount = tlv['54'] ? parseInt(tlv['54']) : 0;
    const accountName = tlv['59'] || '';

    // Tag 62 = additional data (sub-tag 08 = memo)
    let addInfo = '';
    if (tlv['62']) { const t62 = this.parseEMVCo(tlv['62']); addInfo = t62['08'] || ''; }

    const bank = this.lookupBank(bankBin);
    const bankName = bank ? bank.shortName : bankBin;
    const bankCode = bank ? bank.code : null;

    // Store scanned data
    this.scannedQR = { bankBin, accountNo, amount, addInfo, bankName, accountName, bankCode };

    // Show banner with scanned info
    banner.innerHTML = `
      <div class="qr-banner success">
        <span>✅ ${bankName} • ${accountNo}${accountName ? ' • ' + accountName : ''}${amount > 0 ? ' • ' + Utils.formatCompactVND(amount) : ''}</span>
      </div>
    `;



    // Auto-fill amount
    if (amount > 0) {
      this.inputAmount = (amount / 1000).toString();
      const display = document.getElementById('qa-amount');
      if (display) { display.textContent = Utils.formatVND(amount); display.classList.add('has-value'); }
      const btn = document.getElementById('btn-save-expense');
      if (btn) btn.disabled = false;
    }

    // Auto-fill note with account name or memo
    const noteVal = addInfo || accountName;
    if (noteVal) {
      const note = document.getElementById('qa-note');
      if (note) note.value = noteVal;
    }

    Utils.showToast('Đã quét QR!', 'success');
  },

  closeQuickAdd() {
    this.stopQRScanner();
    document.getElementById('expense-modal').classList.remove('active');
    this.inputAmount = '';
    this.scannedQR = null;
  },

  prevMonth() {
    App.state.selectedMonth = Utils.getPrevMonthKey(App.state.selectedMonth);
    this.render();
  },

  nextMonth() {
    App.state.selectedMonth = Utils.getNextMonthKey(App.state.selectedMonth);
    this.render();
  },
};
