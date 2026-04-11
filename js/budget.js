// ============================================
// XMoni - Budget Management
// ============================================

const Budget = {
  // Render budget settings page
  render() {
    const container = document.getElementById('view-budgets');
    const monthKey = App.state.selectedMonth;
    const data = App.state.data;
    const totalDays = Utils.getDaysInMonth(monthKey);

    // Calculate carryover for display
    const carryovers = this.calculateCarryovers(monthKey);

    container.innerHTML = `
      <div class="month-nav">
        <button class="btn-icon" onclick="Budget.prevMonth()">‹</button>
        <h2 class="month-title">${Utils.formatMonth(monthKey)}</h2>
        <button class="btn-icon" onclick="Budget.nextMonth()">›</button>
      </div>

      <div class="section-header">
        <h3>Danh mục chi tiêu</h3>
        <button class="btn-add" onclick="Budget.showAddCategory()">+ Thêm</button>
      </div>

      <div class="budget-cards" id="budget-cards">
        ${data.budgets.length === 0 ? '<p class="empty-state">Chưa có danh mục nào. Tạo danh mục đầu tiên!</p>' : ''}
        ${data.budgets.map(b => {
      const monthly = (data.monthlyBudgets[monthKey] || {})[b.id] || {};
      const amount = monthly.amount || 0;
      const carryover = carryovers[b.id] || 0;
      const mode = this.getBudgetMode(b.id);
      const dailyValue = totalDays > 0 ? Math.round(amount / totalDays) : 0;
      const displayValue = mode === 'daily' ? dailyValue : amount;
      return `
            <div class="budget-card" style="--accent: ${b.color}">
              <div class="budget-card-header">
                <span class="budget-icon">${b.icon}</span>
                <span class="budget-name">${b.name}</span>
                <div class="budget-card-actions">
                  <button class="btn-icon-sm" onclick="Budget.editCategory('${b.id}')">✏️</button>
                  <button class="btn-icon-sm" onclick="Budget.deleteCategory('${b.id}')">🗑️</button>
                </div>
              </div>
              <div class="budget-mode-toggle">
                <button class="budget-mode-btn ${mode === 'daily' ? 'active' : ''}" onclick="Budget.setMode('${b.id}', 'daily')">/ ngày</button>
                <button class="budget-mode-btn ${mode === 'total' ? 'active' : ''}" onclick="Budget.setMode('${b.id}', 'total')">Tổng</button>
              </div>
              <div class="budget-amount-row">
                <label>${mode === 'daily' ? 'Chi / ngày' : 'Budget tháng này'}</label>
                <div class="input-vnd">
                  <input type="text" inputmode="numeric" value="${displayValue ? displayValue.toLocaleString('vi-VN') : ''}" 
                    placeholder="0" 
                    onchange="Budget.setMonthlyAmount('${b.id}', this.value)"
                    onfocus="this.select()">
                  <span>đ</span>
                </div>
              </div>
              ${mode === 'daily' ? `
                <div class="budget-effective" style="margin-top:4px">
                  Tổng tháng: <strong>${Utils.formatVND(amount)}</strong> (${totalDays} ngày)
                </div>
              ` : ''}
              ${carryover !== 0 ? `
                <div class="budget-carryover ${carryover >= 0 ? 'positive' : 'negative'}">
                  ${carryover >= 0 ? '🟢 Dư tháng trước: +' : '🔴 Nợ tháng trước: '}${Utils.formatVND(carryover)}
                </div>
              ` : ''}
              <div class="budget-effective">
                Thực tế: <strong>${Utils.formatVND(amount + carryover)}</strong>
              </div>
            </div>
          `;
    }).join('')}
      </div>

      <div class="budget-actions">
        <button class="btn-secondary" onclick="Budget.copyFromPrevMonth()">
          📋 Copy từ ${Utils.formatMonth(Utils.getPrevMonthKey(monthKey))}
        </button>
      </div>
    `;
  },

  // Budget input mode (daily / total)
  getBudgetMode(budgetId) {
    return localStorage.getItem(`xmoni_bmode_${budgetId}`) || 'total';
  },

  setMode(budgetId, mode) {
    localStorage.setItem(`xmoni_bmode_${budgetId}`, mode);
    this.render();
  },

  // Calculate carryovers for a given month
  calculateCarryovers(monthKey) {
    const data = App.state.data;
    const prevMonth = Utils.getPrevMonthKey(monthKey);
    const carryovers = {};

    data.budgets.forEach(b => {
      const prevBudget = (data.monthlyBudgets[prevMonth] || {})[b.id];
      if (!prevBudget) {
        carryovers[b.id] = 0;
        return;
      }

      const budgetAmount = prevBudget.amount || 0;
      const prevCarryover = this.getCarryoverRecursive(prevMonth, b.id);
      const totalSpent = this.getTotalSpent(prevMonth, b.id);
      carryovers[b.id] = budgetAmount + prevCarryover - totalSpent;
    });

    return carryovers;
  },

  // Recursive carryover calculation
  getCarryoverRecursive(monthKey, budgetId) {
    const data = App.state.data;
    const prevMonth = Utils.getPrevMonthKey(monthKey);
    const prevBudget = (data.monthlyBudgets[prevMonth] || {})[budgetId];

    if (!prevBudget) return 0;

    const budgetAmount = prevBudget.amount || 0;
    const prevCarryover = this.getCarryoverRecursive(prevMonth, budgetId);
    const totalSpent = this.getTotalSpent(prevMonth, budgetId);
    return budgetAmount + prevCarryover - totalSpent;
  },

  // Get total spent for a budget in a month
  getTotalSpent(monthKey, budgetId) {
    return App.state.data.expenses
      .filter(e => Utils.getMonthKey(e.date) === monthKey && e.budgetId === budgetId)
      .reduce((sum, e) => sum + e.amount, 0);
  },

  // Navigate months
  prevMonth() {
    App.state.selectedMonth = Utils.getPrevMonthKey(App.state.selectedMonth);
    this.render();
  },

  nextMonth() {
    App.state.selectedMonth = Utils.getNextMonthKey(App.state.selectedMonth);
    this.render();
  },

  // Set monthly budget amount
  setMonthlyAmount(budgetId, valueStr) {
    const inputValue = Utils.parseVND(valueStr);
    const monthKey = App.state.selectedMonth;
    const data = App.state.data;
    const mode = this.getBudgetMode(budgetId);

    // If daily mode, multiply by days in month
    let amount = inputValue;
    if (mode === 'daily') {
      const totalDays = Utils.getDaysInMonth(monthKey);
      amount = inputValue * totalDays;
    }

    if (!data.monthlyBudgets[monthKey]) {
      data.monthlyBudgets[monthKey] = {};
    }
    if (!data.monthlyBudgets[monthKey][budgetId]) {
      data.monthlyBudgets[monthKey][budgetId] = {};
    }
    data.monthlyBudgets[monthKey][budgetId].amount = amount;

    Drive.queueSave(data);
    this.render();
    Utils.showToast('Đã cập nhật budget');
  },

  // Copy budgets from previous month
  copyFromPrevMonth() {
    const data = App.state.data;
    const monthKey = App.state.selectedMonth;
    const prevMonth = Utils.getPrevMonthKey(monthKey);
    const prevBudgets = data.monthlyBudgets[prevMonth];

    if (!prevBudgets) {
      Utils.showToast('Tháng trước chưa có budget', 'error');
      return;
    }

    if (!data.monthlyBudgets[monthKey]) {
      data.monthlyBudgets[monthKey] = {};
    }

    data.budgets.forEach(b => {
      if (prevBudgets[b.id]) {
        data.monthlyBudgets[monthKey][b.id] = {
          ...data.monthlyBudgets[monthKey][b.id],
          amount: prevBudgets[b.id].amount || 0,
        };
      }
    });

    Drive.queueSave(data);
    this.render();
    Utils.showToast('Đã copy budget từ tháng trước');
  },

  // Show add category modal
  showAddCategory() {
    this.showCategoryModal();
  },

  // Edit category
  editCategory(id) {
    const budget = App.state.data.budgets.find(b => b.id === id);
    if (budget) this.showCategoryModal(budget);
  },

  // Delete category
  deleteCategory(id) {
    const budget = App.state.data.budgets.find(b => b.id === id);
    if (!budget) return;

    if (!confirm(`Xóa danh mục "${budget.name}"? Dữ liệu chi tiêu liên quan sẽ giữ lại.`)) return;

    App.state.data.budgets = App.state.data.budgets.filter(b => b.id !== id);
    Drive.queueSave(App.state.data);
    this.render();
    Utils.showToast('Đã xóa danh mục');
  },

  // Show category creation/edit modal
  showCategoryModal(existing = null) {
    const modal = document.getElementById('category-modal');
    const selectedIcon = existing ? existing.icon : Utils.EMOJI_LIST[0];
    const selectedColor = existing ? existing.color : Utils.COLOR_LIST[0];

    modal.innerHTML = `
      <div class="modal-overlay" onclick="Budget.closeCategoryModal()"></div>
      <div class="modal-content slide-up">
        <h3>${existing ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
        
        <div class="form-group">
          <label>Tên danh mục</label>
          <input type="text" id="cat-name" value="${existing ? existing.name : ''}" placeholder="VD: Tiền ăn" autofocus>
        </div>

        <div class="form-group">
          <label>Icon</label>
          <div class="emoji-grid" id="emoji-grid">
            ${Utils.EMOJI_LIST.map(e => `
              <button class="emoji-btn ${e === selectedIcon ? 'selected' : ''}" 
                onclick="Budget.selectEmoji(this, '${e}')">${e}</button>
            `).join('')}
          </div>
          <input type="hidden" id="cat-icon" value="${selectedIcon}">
        </div>

        <div class="form-group">
          <label>Màu sắc</label>
          <div class="color-grid" id="color-grid">
            ${Utils.COLOR_LIST.map(c => `
              <button class="color-btn ${c === selectedColor ? 'selected' : ''}" 
                style="background: ${c}" 
                onclick="Budget.selectColor(this, '${c}')"></button>
            `).join('')}
          </div>
          <input type="hidden" id="cat-color" value="${selectedColor}">
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" onclick="Budget.closeCategoryModal()">Hủy</button>
          <button class="btn-primary" onclick="Budget.saveCategory('${existing ? existing.id : ''}')">
            ${existing ? 'Cập nhật' : 'Tạo mới'}
          </button>
        </div>
      </div>
    `;

    modal.classList.add('active');
  },

  selectEmoji(btn, emoji) {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('cat-icon').value = emoji;
  },

  selectColor(btn, color) {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('cat-color').value = color;
  },

  saveCategory(existingId) {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value;
    const color = document.getElementById('cat-color').value;

    if (!name) {
      Utils.showToast('Vui lòng nhập tên danh mục', 'error');
      return;
    }

    const data = App.state.data;

    if (existingId) {
      const budget = data.budgets.find(b => b.id === existingId);
      if (budget) {
        budget.name = name;
        budget.icon = icon;
        budget.color = color;
      }
    } else {
      data.budgets.push({
        id: Utils.generateId(),
        name,
        icon,
        color,
      });
    }

    Drive.queueSave(data);
    this.closeCategoryModal();
    this.render();
    Utils.showToast(existingId ? 'Đã cập nhật' : 'Đã tạo danh mục mới');
  },

  closeCategoryModal() {
    document.getElementById('category-modal').classList.remove('active');
  },
};
