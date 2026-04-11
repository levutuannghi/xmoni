// ============================================
// XMoni - Dashboard & Daily Allowance
// ============================================

const Dashboard = {
    render() {
        const container = document.getElementById('view-dashboard');
        const data = App.state.data;
        const monthKey = Utils.getCurrentMonthKey();
        const totalDays = Utils.getDaysInMonth(monthKey);
        const remainingDays = Utils.getRemainingDays(monthKey);

        // Calculate totals
        let totalBudget = 0;
        let totalSpent = 0;
        let totalCarryover = 0;

        const cards = data.budgets.map(b => {
            const monthly = (data.monthlyBudgets[monthKey] || {})[b.id] || {};
            const budgetAmount = monthly.amount || 0;
            const carryover = Budget.calculateCarryovers(monthKey)[b.id] || 0;
            const spent = Budget.getTotalSpent(monthKey, b.id);
            const effective = budgetAmount + carryover;
            const remaining = effective - spent;

            // Daily allowance with cap
            const dailyRaw = remainingDays > 0 ? remaining / remainingDays : 0;
            const dailyBase = totalDays > 0 ? budgetAmount / totalDays : 0;
            const dailyAllowance = Math.min(dailyRaw, dailyBase);

            // Progress percentage
            const progress = effective > 0 ? Math.min((spent / effective) * 100, 100) : 0;
            const progressClass = progress > 85 ? 'danger' : progress > 60 ? 'warning' : 'safe';

            totalBudget += budgetAmount;
            totalSpent += spent;
            totalCarryover += carryover;

            return `
        <div class="dash-card" style="--accent: ${b.color}">
          <div class="dash-card-header">
            <span class="dash-card-icon">${b.icon}</span>
            <span class="dash-card-name">${b.name}</span>
          </div>
          
          <div class="dash-progress-container">
            <div class="dash-progress-bar ${progressClass}" style="width: ${progress}%"></div>
          </div>
          
          <div class="dash-stats">
            <div class="dash-stat">
              <span class="dash-stat-label">Đã chi</span>
              <span class="dash-stat-value spent">${Utils.formatCompactVND(spent)}</span>
            </div>
            <div class="dash-stat">
              <span class="dash-stat-label">Còn lại</span>
              <span class="dash-stat-value ${remaining >= 0 ? 'remaining' : 'overspent'}">${Utils.formatCompactVND(remaining)}</span>
            </div>
            <div class="dash-stat highlight">
              <span class="dash-stat-label">/ ngày</span>
              <span class="dash-stat-value daily ${dailyAllowance < 0 ? 'overspent' : ''}">${Utils.formatCompactVND(Math.max(0, dailyAllowance))}</span>
            </div>
          </div>

          ${carryover !== 0 ? `
            <div class="dash-carryover ${carryover >= 0 ? 'positive' : 'negative'}">
              ${carryover >= 0 ? '↗ Dư' : '↘ Nợ'} tháng trước: ${Utils.formatCompactVND(carryover)}
            </div>
          ` : ''}
        </div>
      `;
        });

        const totalRemaining = totalBudget + totalCarryover - totalSpent;
        const totalDailyRaw = remainingDays > 0 ? totalRemaining / remainingDays : 0;
        const totalDailyBase = totalDays > 0 ? totalBudget / totalDays : 0;
        const totalDailyAllowance = Math.min(totalDailyRaw, totalDailyBase);

        container.innerHTML = `
      <div class="dash-overview">
        <div class="dash-month-label">${Utils.formatMonth(monthKey)}</div>
        <div class="dash-hero">
          <div class="dash-hero-label">Còn được xài / ngày</div>
          <div class="dash-hero-amount ${totalDailyAllowance < 0 ? 'overspent' : ''}">
            ${Utils.formatVND(Math.max(0, Math.round(totalDailyAllowance)))}
          </div>
          <div class="dash-hero-days">${remainingDays} ngày còn lại</div>
        </div>

        <div class="dash-totals">
          <div class="dash-total-item">
            <span class="dash-total-label">Budget</span>
            <span class="dash-total-value">${Utils.formatCompactVND(totalBudget + totalCarryover)}</span>
          </div>
          <div class="dash-total-item">
            <span class="dash-total-label">Đã chi</span>
            <span class="dash-total-value spent">${Utils.formatCompactVND(totalSpent)}</span>
          </div>
          <div class="dash-total-item">
            <span class="dash-total-label">Còn lại</span>
            <span class="dash-total-value ${totalRemaining >= 0 ? 'remaining' : 'overspent'}">${Utils.formatCompactVND(totalRemaining)}</span>
          </div>
        </div>
      </div>

      <div class="dash-cards">
        ${cards.length === 0 ? '<p class="empty-state">Tạo danh mục chi tiêu để bắt đầu!</p>' : cards.join('')}
      </div>
    `;
    },
};
