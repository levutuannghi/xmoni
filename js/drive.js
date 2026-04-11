// ============================================
// XMoni - Google Drive Data Layer
// ============================================

const Drive = {
    FILE_NAME: 'xmoni_data.json',
    STORAGE_KEY: 'xmoni_demo_data',
    fileId: null,
    demoMode: false,

    // Default empty data
    getDefaultData() {
        return {
            budgets: [],
            monthlyBudgets: {},
            expenses: [],
        };
    },

    // Find or create xmoni_data.json in user's Drive (or localStorage in demo mode)
    async loadData() {
        // Demo mode: use localStorage
        if (this.demoMode) {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved) {
                try { return this.migrateData(JSON.parse(saved)); }
                catch (e) { /* corrupted, reset */ }
            }
            return this.getDefaultData();
        }

        try {
            // Search for existing file
            const searchRes = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=name='${this.FILE_NAME}' and trashed=false&spaces=drive&fields=files(id,name)`,
                { headers: { Authorization: `Bearer ${Auth.getToken()}` } }
            );
            const searchData = await searchRes.json();

            if (searchData.files && searchData.files.length > 0) {
                // File exists, read it
                this.fileId = searchData.files[0].id;
                const contentRes = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${this.fileId}?alt=media`,
                    { headers: { Authorization: `Bearer ${Auth.getToken()}` } }
                );
                const data = await contentRes.json();
                return this.migrateData(data);
            } else {
                // Create new file
                const data = this.getDefaultData();
                await this.createFile(data);
                return data;
            }
        } catch (e) {
            console.error('Drive loadData error:', e);
            Utils.showToast('Lỗi tải dữ liệu từ Drive', 'error');
            return this.getDefaultData();
        }
    },

    // Create new file on Drive
    async createFile(data) {
        const metadata = {
            name: this.FILE_NAME,
            mimeType: 'application/json',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));

        const res = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${Auth.getToken()}` },
                body: form,
            }
        );
        const result = await res.json();
        this.fileId = result.id;
        return result;
    },

    // Save data to Drive (update existing file) or localStorage in demo mode
    async saveData(data) {
        if (this.demoMode) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return;
        }

        if (!this.fileId) {
            await this.createFile(data);
            return;
        }

        try {
            await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${this.fileId}?uploadType=media`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${Auth.getToken()}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data, null, 2),
                }
            );
        } catch (e) {
            console.error('Drive saveData error:', e);
            Utils.showToast('Lỗi lưu dữ liệu', 'error');
        }
    },

    // Debounced save
    _debouncedSave: null,
    queueSave(data) {
        if (!this._debouncedSave) {
            this._debouncedSave = Utils.debounce((d) => this.saveData(d), 800);
        }
        this._debouncedSave(data);
    },

    // Migrate data structure if needed
    migrateData(data) {
        if (!data.budgets) data.budgets = [];
        if (!data.monthlyBudgets) data.monthlyBudgets = {};
        if (!data.expenses) data.expenses = [];
        return data;
    },
};
