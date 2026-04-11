// ============================================
// XMoni - Expense Entry & Listing
// ============================================

const Expense = {
  inputAmount: '',

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

  // Show quick add modal
  showQuickAdd() {
    const data = App.state.data;
    if (data.budgets.length === 0) {
      Utils.showToast('Tạo danh mục chi tiêu trước!', 'error');
      App.switchView('budgets');
      return;
    }

    this.inputAmount = '';
    const modal = document.getElementById('expense-modal');

    modal.innerHTML = `
      <div class="modal-overlay" onclick="Expense.closeQuickAdd()"></div>
      <div class="modal-content quick-add-modal slide-up">
        <div class="quick-add-header">
          <h3>Thêm chi tiêu</h3>
          <button class="btn-icon" onclick="Expense.closeQuickAdd()">✕</button>
        </div>

        <div class="quick-add-categories" id="qa-categories">
          ${data.budgets.map((b, i) => `
            <button class="category-chip ${i === 0 ? 'selected' : ''}" 
              style="--chip-color: ${b.color}"
              data-id="${b.id}"
              onclick="Expense.selectCategory(this)">
              <span>${b.icon}</span>
              <span>${b.name}</span>
            </button>
          `).join('')}
        </div>

        <div class="quick-add-display">
          <div class="qa-input-hint">Nhập số nghìn (x1.000)</div>
          <span class="qa-amount" id="qa-amount">0đ</span>
        </div>

        <div class="quick-add-date">
          <input type="date" id="qa-date" value="${Utils.getToday()}" max="${Utils.getToday()}">
        </div>

        <div class="quick-add-note">
          <input type="text" id="qa-note" placeholder="Ghi chú (không bắt buộc)" maxlength="100">
        </div>

        <div class="numpad">
          ${['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map(key => `
            <button class="numpad-btn ${key === '⌫' ? 'numpad-delete' : ''} ${key === '.' ? 'numpad-dot' : ''}" 
              onclick="Expense.numpadPress('${key}')">${key === '.' ? ',5' : key}</button>
          `).join('')}
        </div>

        <button class="btn-save-expense" id="btn-save-expense" onclick="Expense.saveExpense()" disabled>
          Lưu chi tiêu
        </button>

        <div class="quick-pay-section">
          <div class="quick-pay-label">Lưu & mở app thanh toán</div>
          <div class="quick-pay-buttons">
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('tpbank')">🏦 TPBank</button>
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('momo')">💜 MoMo</button>
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('zalopay')">💙 ZaloPay</button>
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('vcb')">🟢 VCB</button>
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('bidv')">🔵 BIDV</button>
            <button class="quick-pay-btn" onclick="Expense.saveAndPay('techcombank')">🔴 TCB</button>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');
    // Focus note after render
    setTimeout(() => document.getElementById('qa-note')?.focus(), 300);
  },

  // Category selection
  selectCategory(btn) {
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
  },

  // Numpad input (in thousands - x1000)
  numpadPress(key) {
    if (key === '⌫') {
      this.inputAmount = this.inputAmount.slice(0, -1);
    } else if (key === '.') {
      // ",5" button = add 500đ (half thousand)
      if (!this.inputAmount.includes('.')) {
        this.inputAmount += this.inputAmount ? '.5' : '0.5';
      }
    } else {
      if (this.inputAmount.includes('.')) return; // No more digits after decimal
      if (this.inputAmount.length >= 7) return; // Max 7 digits = 9,999,000
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

    const budgetId = selectedChip.dataset.id;
    const date = document.getElementById('qa-date').value;
    const note = document.getElementById('qa-note').value.trim();

    const expense = {
      id: Utils.generateId(),
      date,
      budgetId,
      amount,
      note,
    };

    App.state.data.expenses.push(expense);
    Drive.queueSave(App.state.data);

    this.closeQuickAdd();
    Utils.showToast(`Đã lưu -${Utils.formatVND(amount)}`, 'success');

    // Refresh current view
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

  // Save expense then open banking app
  saveAndPay(app) {
    // Save expense first
    const parsed = parseFloat(this.inputAmount) || 0;
    const amount = Math.round(parsed * 1000);

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
      }
    }

    this.closeQuickAdd();

    // Refresh views
    if (App.state.currentView === 'expenses') this.render();
    if (App.state.currentView === 'dashboard') Dashboard.render();

    // Deep link configs: try scheme first, fallback to app store
    const apps = {
      tpbank: {
        scheme: 'tpb.vn.ebank://',
        ios: 'https://apps.apple.com/vn/app/tpbank-mobile/id1001881988',
        android: 'https://play.google.com/store/apps/details?id=vn.tpb.mb.gprsandroid',
      },
      momo: {
        scheme: 'momo://',
        ios: 'https://apps.apple.com/vn/app/momo-chuyển-tiền-thanh-toán/id918751511',
        android: 'https://play.google.com/store/apps/details?id=com.mservice.momotransfer',
      },
      zalopay: {
        scheme: 'zalopay://',
        ios: 'https://apps.apple.com/vn/app/zalopay-chuyển-tiền-thanh-toán/id1229814460',
        android: 'https://play.google.com/store/apps/details?id=vn.com.vng.zalopay',
      },
      vcb: {
        scheme: 'vcbdigibank://',
        ios: 'https://apps.apple.com/vn/app/vietcombank/id907126017',
        android: 'https://play.google.com/store/apps/details?id=com.VCB',
      },
      bidv: {
        scheme: 'com.bidv.smartbanking://',
        ios: 'https://apps.apple.com/vn/app/bidv-smartbanking/id1067549928',
        android: 'https://play.google.com/store/apps/details?id=com.vnpay.bidv',
      },
      techcombank: {
        scheme: 'tcbmobilebanking://',
        ios: 'https://apps.apple.com/vn/app/techcombank-mobile/id1538283967',
        android: 'https://play.google.com/store/apps/details?id=vn.com.techcombank.bb.app',
      },
    };

    const config = apps[app];
    if (!config) return;

    // Try deep link via hidden iframe (won't navigate away if app isn't installed)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = config.scheme;
    document.body.appendChild(iframe);

    // Fallback: if app didn't open in 1.5s, go to app store
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setTimeout(() => {
      iframe.remove();
      // Only fallback if page is still visible (app didn't open)
      if (!document.hidden) {
        const storeLink = isIOS ? config.ios : config.android;
        window.open(storeLink, '_blank');
      }
    }, 1500);
  },

  closeQuickAdd() {
    document.getElementById('expense-modal').classList.remove('active');
    this.inputAmount = '';
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
