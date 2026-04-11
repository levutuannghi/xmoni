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

        // Listen for auth state changes
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
            given_name: meta.full_name || meta.name || supaUser.email?.split('@')[0] || '',
            picture: meta.avatar_url || meta.picture || '',
        };
    },

    // Login with Google OAuth
    async loginGoogle() {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin + window.location.pathname,
            },
        });
        if (error) {
            console.error('Google login error:', error);
            Utils.showToast('Đăng nhập Google thất bại: ' + error.message, 'error');
        }
    },

    // Login / Sign up with email + password
    async loginEmail() {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            Utils.showToast('Nhập email và mật khẩu', 'error');
            return;
        }
        if (password.length < 6) {
            Utils.showToast('Mật khẩu ít nhất 6 ký tự', 'error');
            return;
        }

        // Try sign in first, if fails try sign up
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error && error.message.includes('Invalid login')) {
            // User doesn't exist, sign up
            const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
                email,
                password,
            });
            if (signUpError) {
                Utils.showToast('Lỗi: ' + signUpError.message, 'error');
                return;
            }
            if (signUpData.user && !signUpData.session) {
                Utils.showToast('Kiểm tra email để xác nhận tài khoản!', 'info');
                return;
            }
            // Auto-confirmed, login success
            this.user = this.extractUser(signUpData.user);
            this.renderUserInfo();
            App.onLoginSuccess();
        } else if (error) {
            Utils.showToast('Lỗi: ' + error.message, 'error');
        } else if (data.session) {
            this.user = this.extractUser(data.user);
            this.renderUserInfo();
            App.onLoginSuccess();
        }
    },

    // Render user info in header
    renderUserInfo() {
        const el = document.getElementById('user-info');
        if (!el || !this.user) return;
        const avatar = this.user.picture
            ? `<img src="${this.user.picture}" alt="avatar" class="user-avatar" referrerpolicy="no-referrer">`
            : `<div class="user-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--accent-primary);color:white;font-weight:700">${(this.user.name || '?')[0].toUpperCase()}</div>`;
        el.innerHTML = `${avatar}<span class="user-name">${this.user.given_name}</span>`;
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
