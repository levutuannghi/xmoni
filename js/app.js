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

        // Show loading
        document.getElementById('app-loading').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';

        // Check if last session was demo mode
        const lastMode = localStorage.getItem('xmoni_login_mode');
        if (lastMode === 'demo') {
            await this.enterDemoMode(true);
            return;
        }

        const isLoggedIn = await Auth.init();

        if (isLoggedIn) {
            localStorage.setItem('xmoni_login_mode', 'google');
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

        // Load data from Drive
        this.state.data = await Drive.loadData();

        document.getElementById('app-loading').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';

        // Render current view
        this.switchView('dashboard');
    },

    // Called on logout
    onLogout() {
        this.state.data = null;
        Drive.demoMode = false;
        localStorage.removeItem('xmoni_login_mode');
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
    },

    // Demo mode: skip Google login, use localStorage
    async enterDemoMode(silent = false) {
        Drive.demoMode = true;
        localStorage.setItem('xmoni_login_mode', 'demo');
        document.getElementById('app-loading').style.display = 'flex';
        document.getElementById('login-screen').style.display = 'none';

        this.state.data = await Drive.loadData();

        // Set demo user info
        const userInfo = document.getElementById('user-info');
        userInfo.innerHTML = `
            <span class="user-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent-primary);font-size:1rem;width:32px;height:32px;border-radius:50%">🧪</span>
            <span class="user-name">Demo Mode</span>
        `;

        document.getElementById('app-loading').style.display = 'none';
        document.getElementById('main-app').style.display = 'flex';
        this.switchView('dashboard');
        Utils.showToast('Chế độ demo — dữ liệu lưu trên máy', 'info');
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
