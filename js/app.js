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

        // 1. Load localStorage first for instant render (zero network delay)
        const localData = Drive._loadLocal();
        if (localData && localData.budgets.length > 0) {
            this.state.data = localData;
            document.getElementById('app-loading').style.display = 'none';
            document.getElementById('main-app').style.display = 'flex';
            this.switchView('dashboard');
            // Auto-open quick add if user has budgets
            if (this.state.data.budgets.length > 0) {
                setTimeout(() => Expense.showQuickAdd(), 300);
            }
        }

        // 2. Full load from Supabase (merge with WAL) in background
        try {
            const freshData = await Drive.loadData();
            if (freshData && freshData.budgets) {
                this.state.data = freshData;

                // If we didn't render yet (no localStorage), show UI now
                if (document.getElementById('app-loading').style.display !== 'none') {
                    document.getElementById('app-loading').style.display = 'none';
                    document.getElementById('main-app').style.display = 'flex';
                    this.switchView('dashboard');
                    if (this.state.data.budgets.length > 0) {
                        setTimeout(() => Expense.showQuickAdd(), 300);
                    }
                } else {
                    // Re-render to show any new server data
                    this._renderCurrentView();
                }
            }
        } catch (e) {
            console.warn('[App] Server load failed, using localStorage:', e);
            // If we have no data at all, show empty state
            if (!this.state.data) {
                this.state.data = Drive.getDefaultData();
                document.getElementById('app-loading').style.display = 'none';
                document.getElementById('main-app').style.display = 'flex';
                this.switchView('dashboard');
            }
        }

        // 3. Start Realtime subscription for continuous sync
        Drive.startRealtime();
    },

    // Called on logout
    onLogout() {
        Drive.stopRealtime();
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

        this._renderCurrentView();
    },

    _renderCurrentView() {
        switch (this.state.currentView) {
            case 'dashboard': Dashboard.render(); break;
            case 'expenses': Expense.render(); break;
            case 'budgets': Budget.render(); break;
        }
    },
};

// Boot when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

// Re-sync when returning to app (iOS PWA resume from background)
document.addEventListener('visibilitychange', async () => {
    if (document.hidden) return;
    if (!App.state.data) return; // Not logged in yet

    // Sync any pending WAL first
    await Drive.syncWAL();

    // Only re-fetch from server if no pending WAL (avoid overwriting unsaved changes)
    const pendingWAL = Drive._getWAL();
    if (pendingWAL.length > 0) {
        console.log('[App] Skipping server reload — WAL has pending entries');
        return;
    }

    // Reload fresh data from server
    try {
        const freshData = await Drive.loadData();
        if (freshData && freshData.budgets) {
            App.state.data = freshData;
            App._renderCurrentView();
        }
    } catch (e) {
        console.warn('[App] Background reload failed:', e);
    }
});

// Emergency save before page unload (iOS app kill, navigation away)
window.addEventListener('beforeunload', () => {
    Drive.saveBeforeUnload();
});

// Also save on pagehide (iOS Safari fires this instead of beforeunload)
window.addEventListener('pagehide', () => {
    Drive.saveBeforeUnload();
});
