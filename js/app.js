// ============================================
// XMoni - Main App Controller
// ============================================

const App = {
    state: {
        data: null,
        currentView: 'dashboard',
        selectedMonth: null,
    },

    // Initialize app
    async init() {
        this.state.selectedMonth = Utils.getCurrentMonthKey();
        Expense.init(); // Load VietQR bank list

        // Show loading
        document.getElementById('app-loading').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';

        const isLoggedIn = await Auth.init();

        if (isLoggedIn) {
            await this.onLoginSuccess();
        } else {
            document.getElementById('app-loading').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex';
        }
    },

    // Called after successful login
    async onLoginSuccess() {
        document.getElementById('app-loading').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';

        // Load data from Supabase
        this.state.data = await Drive.loadData();

        document.getElementById('app-loading').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';

        // Render current view
        this.switchView('dashboard');

        // Auto-open quick add if user has budgets
        if (this.state.data.budgets.length > 0) {
            setTimeout(() => Expense.showQuickAdd(), 300);
        }
    },

    // Called on logout
    onLogout() {
        this.state.data = null;
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    },

    // Switch between views
    switchView(view) {
        this.state.currentView = view;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Hide all views
        document.querySelectorAll('.view-content').forEach(v => {
            v.classList.remove('active');
        });

        // Show target view
        const viewEl = document.getElementById(`view-${view}`);
        if (viewEl) {
            viewEl.classList.add('active');
        }

        // Render view content
        switch (view) {
            case 'dashboard':
                Dashboard.render();
                break;
            case 'expenses':
                Expense.render();
                break;
            case 'budgets':
                Budget.render();
                break;
        }
    },
};

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());
