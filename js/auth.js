// ============================================
// XMoni - Google OAuth Authentication
// ============================================

const Auth = {
    // IMPORTANT: Replace with your own Client ID from Google Cloud Console
    CLIENT_ID: '1071728757258-tidtkuf5rkj1nafjt3q9fe58gk2t71dk.apps.googleusercontent.com',
    SCOPES: 'https://www.googleapis.com/auth/drive.file',

    tokenClient: null,
    accessToken: null,
    user: null,

    // Initialize Google Identity Services
    init() {
        return new Promise((resolve) => {
            // Wait for Google Identity Services to load
            const checkGsi = setInterval(() => {
                if (window.google && google.accounts && google.accounts.oauth2) {
                    clearInterval(checkGsi);
                    clearTimeout(timeout);

                    this.tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: this.CLIENT_ID,
                        scope: this.SCOPES,
                        callback: (response) => {
                            if (response.error) {
                                console.error('Auth error:', response);
                                // If silent refresh failed, show login screen
                                if (this._silentResolve) {
                                    this._silentResolve(false);
                                    this._silentResolve = null;
                                } else {
                                    Utils.showToast('Đăng nhập thất bại', 'error');
                                }
                                return;
                            }
                            this.accessToken = response.access_token;
                            localStorage.setItem('xmoni_token', response.access_token);
                            localStorage.setItem('xmoni_token_time', Date.now().toString());

                            this.fetchUserInfo().then(() => {
                                if (this._silentResolve) {
                                    this._silentResolve(true);
                                    this._silentResolve = null;
                                } else {
                                    localStorage.setItem('xmoni_login_mode', 'google');
                                    App.onLoginSuccess();
                                }
                            });
                        },
                    });

                    // Check for previous Google login — try silent refresh
                    const lastMode = localStorage.getItem('xmoni_login_mode');
                    const savedToken = localStorage.getItem('xmoni_token');
                    const tokenTime = parseInt(localStorage.getItem('xmoni_token_time') || '0');
                    const tokenAge = Date.now() - tokenTime;

                    if (lastMode === 'google' && savedToken) {
                        if (tokenAge < 3500000) {
                            // Token < ~58 min old, try using it directly
                            this.accessToken = savedToken;
                            this.fetchUserInfo().then((valid) => {
                                if (valid) {
                                    resolve(true);
                                } else {
                                    // Token expired, try silent refresh
                                    this.silentRefresh().then(resolve);
                                }
                            });
                        } else {
                            // Token expired, try silent refresh
                            this.silentRefresh().then(resolve);
                        }
                    } else {
                        resolve(false);
                    }
                }
            }, 100);

            // Timeout after 5s
            const timeout = setTimeout(() => {
                clearInterval(checkGsi);
                resolve(false);
            }, 5000);
        });
    },

    // Try to get a new token silently (no user interaction)
    silentRefresh() {
        return new Promise((resolve) => {
            this._silentResolve = resolve;
            try {
                this.tokenClient.requestAccessToken({ prompt: '' });
            } catch (e) {
                console.log('Silent refresh failed:', e);
                resolve(false);
            }
            // Timeout: if silent refresh doesn't respond in 3s, fail
            setTimeout(() => {
                if (this._silentResolve) {
                    this._silentResolve(false);
                    this._silentResolve = null;
                }
            }, 3000);
        });
    },

    // Trigger login (user-initiated)
    login() {
        if (this.CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            Utils.showToast('Cần cấu hình Google Client ID trước!', 'error');
            document.getElementById('setup-guide-modal').classList.add('active');
            return;
        }
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        }
    },

    // Fetch user profile info
    async fetchUserInfo() {
        try {
            const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${this.accessToken}` },
            });
            if (!res.ok) return false;
            this.user = await res.json();
            this.renderUserInfo();
            return true;
        } catch (e) {
            console.error('Failed to fetch user info:', e);
            return false;
        }
    },

    // Render user info in header
    renderUserInfo() {
        const el = document.getElementById('user-info');
        if (!el || !this.user) return;
        el.innerHTML = `
      <img src="${this.user.picture}" alt="avatar" class="user-avatar" referrerpolicy="no-referrer">
      <span class="user-name">${this.user.given_name || this.user.name}</span>
    `;
    },

    // Logout
    logout() {
        const token = this.accessToken;
        this.accessToken = null;
        this.user = null;
        localStorage.removeItem('xmoni_token');
        localStorage.removeItem('xmoni_token_time');
        localStorage.removeItem('xmoni_login_mode');
        try {
            if (token && google.accounts.oauth2.revoke) {
                google.accounts.oauth2.revoke(token);
            }
        } catch (e) { /* ignore */ }
        App.onLogout();
    },

    // Get access token
    getToken() {
        return this.accessToken;
    },
};
