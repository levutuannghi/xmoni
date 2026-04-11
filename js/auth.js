// ============================================
// XMoni - Supabase Authentication
// ============================================

const SUPABASE_URL = 'https://fmcupvjellycdvdfrhxx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtY3VwdmplbGx5Y2R2ZGZyaHh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5MDQ3ODQsImV4cCI6MjA5MTQ4MDc4NH0.DYLF4__IUt496IXKiX28VgLoMpAHazS2inmUwKratUw';

let supabaseClient;

const Auth = {
    user: null,

    // Initialize Supabase client + check existing session
    async init() {
        // Wait for Supabase SDK to load
        await new Promise((resolve) => {
            const check = setInterval(() => {
                if (window.supabase) {
                    clearInterval(check);
                    clearTimeout(timeout);
                    resolve();
                }
            }, 50);
            const timeout = setTimeout(() => { clearInterval(check); resolve(); }, 5000);
        });

        if (!window.supabase) {
            console.error('Supabase SDK not loaded');
            return false;
        }

        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        // Listen for auth state changes (auto-refresh, login, logout)
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                this.user = this.extractUser(session.user);
                this.renderUserInfo();
            } else if (event === 'SIGNED_OUT') {
                this.user = null;
            }
        });

        // Check existing session
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            this.user = this.extractUser(session.user);
            this.renderUserInfo();
            return true;
        }

        // Handle OAuth redirect callback (after Google/Facebook login)
        if (window.location.hash && window.location.hash.includes('access_token')) {
            const { data: { session: newSession } } = await supabaseClient.auth.getSession();
            if (newSession) {
                this.user = this.extractUser(newSession.user);
                this.renderUserInfo();
                // Clean URL hash
                history.replaceState(null, '', window.location.pathname);
                return true;
            }
        }

        return false;
    },

    // Extract user info from Supabase user object
    extractUser(supaUser) {
        if (!supaUser) return null;
        const meta = supaUser.user_metadata || {};
        return {
            id: supaUser.id,
            email: supaUser.email,
            name: meta.full_name || meta.name || supaUser.email,
            given_name: meta.full_name || meta.name || '',
            picture: meta.avatar_url || meta.picture || '',
        };
    },

    // Login with provider (google / facebook)
    async login(provider = 'google') {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: window.location.origin + window.location.pathname,
            },
        });
        if (error) {
            console.error('Login error:', error);
            Utils.showToast('Đăng nhập thất bại: ' + error.message, 'error');
        }
    },

    // Render user info in header
    renderUserInfo() {
        const el = document.getElementById('user-info');
        if (!el || !this.user) return;
        const avatar = this.user.picture
            ? `<img src="${this.user.picture}" alt="avatar" class="user-avatar" referrerpolicy="no-referrer">`
            : `<div class="user-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent-primary);color:white;font-weight:700">${(this.user.name || '?')[0]}</div>`;
        el.innerHTML = `${avatar}<span class="user-name">${this.user.given_name || this.user.name}</span>`;
    },

    // Logout
    async logout() {
        await supabaseClient.auth.signOut();
        this.user = null;
        App.onLogout();
    },

    // Get current user ID
    getUserId() {
        return this.user ? this.user.id : null;
    },
};
