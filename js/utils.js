// ============================================
// XMoni - Utility Functions
// ============================================

const Utils = {
  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // Format currency VND
  formatVND(amount) {
    if (amount === null || amount === undefined || isNaN(amount)) return '0đ';
    const abs = Math.abs(amount);
    const formatted = abs.toLocaleString('vi-VN');
    return (amount < 0 ? '-' : '') + formatted + 'đ';
  },

  // Parse VND string back to integer (e.g., "1.234.567đ" → 1234567)
  parseVND(str) {
    if (!str) return 0;
    const cleaned = String(str).replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  },

  // Format compact VND (e.g., 1.5tr, 500k)
  formatCompactVND(amount) {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1000000) {
      return sign + (abs / 1000000).toFixed(1).replace('.0', '') + 'tr';
    }
    if (abs >= 1000) {
      return sign + (abs / 1000).toFixed(0) + 'k';
    }
    return sign + abs + 'đ';
  },

  // Parse VND input (remove dots, commas)
  parseVND(str) {
    if (!str) return 0;
    return parseInt(str.toString().replace(/[.,\s đ]/g, ''), 10) || 0;
  },

  // Get current month key (YYYY-MM)
  getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  },

  // Get month key from date
  getMonthKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },

  // Get today's date string (YYYY-MM-DD)
  getToday() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  },

  // Get days in month
  getDaysInMonth(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    return new Date(year, month, 0).getDate();
  },

  // Get remaining days in month (including today)
  getRemainingDays(monthKey) {
    const today = new Date();
    const [year, month] = monthKey.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const currentMonth = this.getCurrentMonthKey();

    if (monthKey < currentMonth) return 0;
    if (monthKey > currentMonth) return totalDays;
    return Math.max(1, totalDays - today.getDate() + 1);
  },

  // Format month display (Tháng 4, 2026)
  formatMonth(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    return `Tháng ${month}, ${year}`;
  },

  // Get next month key
  getNextMonthKey(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    if (month === 12) return `${year + 1}-01`;
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  },

  // Get previous month key
  getPrevMonthKey(monthKey) {
    const [year, month] = monthKey.split('-').map(Number);
    if (month === 1) return `${year - 1}-12`;
    return `${year}-${String(month - 1).padStart(2, '0')}`;
  },

  // Debounce
  debounce(fn, ms = 500) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), ms);
    };
  },

  // Format date display
  formatDate(dateStr) {
    const d = new Date(dateStr);
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return `${days[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
  },

  // Show toast notification
  showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  },

  // Emoji list for budget icons
  EMOJI_LIST: ['🍜', '🛒', '🏠', '🚗', '💊', '🎮', '📚', '👔', '💇', '🎬', '✈️', '🎁', '💰', '📱', '🔌', '🐶', '👶', '🏋️', '☕', '🍺'],

  // Color palette for budgets
  COLOR_LIST: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA', '#F8C471', '#AED6F1', '#D7BDE2', '#A3E4D7'],

  // === Date Arithmetic ===
  addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  },

  addMonths(dateStr, n) {
    const d = new Date(dateStr);
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    // Handle month overflow (e.g., Jan 31 + 1 month = Feb 28)
    if (d.getDate() !== day) d.setDate(0);
    return d.toISOString().split('T')[0];
  },

  // Get split installment dates for preview
  getSplitDates(startDate, count, unit) {
    const dates = [];
    for (let i = 0; i < count; i++) {
      switch (unit) {
        case 'day': dates.push(this.addDays(startDate, i)); break;
        case 'week': dates.push(this.addDays(startDate, i * 7)); break;
        case 'month': dates.push(this.addMonths(startDate, i)); break;
      }
    }
    return dates;
  },

  // Calculate how much of a split expense falls in a given month
  getSplitAmountForMonth(expense, monthKey) {
    if (!expense.splitCount || expense.splitCount <= 1) return expense.amount;
    const perUnit = Math.round(expense.amount / expense.splitCount);
    const dates = this.getSplitDates(
      expense.splitStart || expense.date,
      expense.splitCount,
      expense.splitUnit || 'month'
    );
    const count = dates.filter(d => this.getMonthKey(d) === monthKey).length;
    return perUnit * count;
  },
};
