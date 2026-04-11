// ============================================
// XMoni - Google OAuth Authentication
// ============================================

const Auth = {
    // IMPORTANT: Replace with your own Client ID from Google Cloud Console
    CLIENT_ID: 'YOUR_CLIENT_ID_HERE',
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

                    this.tokenClient = google.accounts.oauth2.initTokenRequestFlow
                        ? null
                        : google.accounts.oauth2.initTokenClient({
                            client_id: this.CLIENT_ID,
                            scope: this.SCOPES,
                            callback: (response) => {
                                if (response.error) {
                                    console.error('Auth error:', response);
                                    Utils.showToast('Đăng nhập thất bại', 'error');
                                    return;
                                }
                                this.accessToken = response.access_token;
                                sessionStorage.setItem('xmoni_token', response.access_token);
                                this.fetchUserInfo().then(() => {
                                    App.onLoginSuccess();
                                });
                            },
                        });

                    // Check for existing token
                    const savedToken = sessionStorage.getItem('xmoni_token');
                    if (savedToken) {
                        this.accessToken = savedToken;
                        this.fetchUserInfo().then((valid) => {
                            if (valid) {
                                resolve(true);
                            } else {
                                sessionStorage.removeItem('xmoni_token');
                                resolve(false);
                            }
                        });
                    } else {
                        resolve(false);
                    }
                }
            }, 100);

            // Timeout after 5s
            setTimeout(() => {
                clearInterval(checkGsi);
                resolve(false);
            }, 5000);
        });
    },

    // Trigger login
    login() {
        if (this.CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            Utils.showToast('Cần cấu hình Google Client ID trước!', 'error');
            document.getElementById('setup-guide-modal').classList.add('active');
            return;
        }
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken();
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
        this.accessToken = null;
        this.user = null;
        sessionStorage.removeItem('xmoni_token');
        if (google.accounts.oauth2.revoke) {
            google.accounts.oauth2.revoke(this.accessToken);
        }
        App.onLogout();
    },

    // Get access token
    getToken() {
        return this.accessToken;
    },
};
