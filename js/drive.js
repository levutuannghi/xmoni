// ============================================
// XMoni - Data Layer (localStorage-First + WAL)
// Zero data loss: every change → localStorage instant → Supabase async
// ============================================

const Drive = {
    // --- Storage Keys ---
    _LOCAL_KEY: 'xmoni_data',
    _WAL_KEY: 'xmoni_wal',
    _PENDING_KEY: 'xmoni_pending_sync', // legacy, will be migrated

    // --- Default empty data ---
    getDefaultData() {
        return {
            budgets: [],
            monthlyBudgets: {},
            expenses: [],
            expenseMetadata: [],
        };
    },

    // ========== localStorage Mirror ==========
    _saveLocal(data) {
        try {
            // SHRINK GUARD: never overwrite good data with empty/smaller data
            const existing = localStorage.getItem(this._LOCAL_KEY);
            if (existing) {
                try {
                    const old = JSON.parse(existing);
                    const oldCount = (old.expenses?.length || 0) + (old.budgets?.length || 0);
                    const newCount = (data.expenses?.length || 0) + (data.budgets?.length || 0);
                    // If new data has 0 records but old had data → refuse to save
                    if (newCount === 0 && oldCount > 0) {
                        console.warn(`[Drive] SHRINK GUARD: refusing to save empty data over ${oldCount} records`);
                        return;
                    }
                } catch { /* ignore parse errors, save anyway */ }
            }
            localStorage.setItem(this._LOCAL_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('[Drive] localStorage save failed:', e);
        }
    },

    _loadLocal() {
        try {
            const raw = localStorage.getItem(this._LOCAL_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Ensure all expected fields exist
                return {
                    budgets: parsed.budgets || [],
                    monthlyBudgets: parsed.monthlyBudgets || {},
                    expenses: parsed.expenses || [],
                    expenseMetadata: parsed.expenseMetadata || [],
                };
            }
        } catch (e) {
            console.warn('[Drive] localStorage load failed:', e);
        }
        return null;
    },

    // Union merge: keep all records from both local & server (server wins for same id)
    _unionMerge(local, server) {
        // Merge arrays by id: server records override local, but local-only records survive
        const mergeById = (localArr, serverArr, idKey = 'id') => {
            const map = new Map();
            // Local first
            for (const item of localArr) map.set(item[idKey], item);
            // Server overwrites
            for (const item of serverArr) map.set(item[idKey], item);
            return Array.from(map.values());
        };

        const merged = {
            budgets: mergeById(local.budgets || [], server.budgets || []),
            expenses: mergeById(local.expenses || [], server.expenses || []),
            expenseMetadata: mergeById(local.expenseMetadata || [], server.expenseMetadata || [], 'expense_id'),
            monthlyBudgets: {},
        };

        // Deep merge monthlyBudgets: { monthKey: { budgetId: { amount } } }
        const allMonthKeys = new Set([
            ...Object.keys(local.monthlyBudgets || {}),
            ...Object.keys(server.monthlyBudgets || {}),
        ]);
        for (const mk of allMonthKeys) {
            merged.monthlyBudgets[mk] = {
                ...(local.monthlyBudgets?.[mk] || {}),
                ...(server.monthlyBudgets?.[mk] || {}), // server wins
            };
        }

        console.log(`[Drive] Union merge: ${merged.expenses.length} expenses, ${merged.budgets.length} budgets (local: ${local.expenses.length}, server: ${server.expenses.length})`);
        return merged;
    },

    // ========== Write-Ahead Log (WAL) ==========
    _getWAL() {
        try {
            return JSON.parse(localStorage.getItem(this._WAL_KEY) || '[]');
        } catch { return []; }
    },

    _saveWAL(entries) {
        try {
            localStorage.setItem(this._WAL_KEY, JSON.stringify(entries));
        } catch (e) {
            console.error('[Drive] WAL save failed:', e);
        }
    },

    _appendWAL(action, payload) {
        const wal = this._getWAL();
        const entry = { id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5), action, payload, ts: Date.now() };
        wal.push(entry);
        this._saveWAL(wal);
        return entry;
    },

    _removeWALEntry(entryId) {
        const wal = this._getWAL().filter(e => e.id !== entryId);
        this._saveWAL(wal);
    },

    // ========== Migrate legacy pending queue ==========
    _migrateLegacyPending() {
        try {
            const legacy = JSON.parse(localStorage.getItem(this._PENDING_KEY) || '[]');
            if (legacy.length > 0) {
                console.log(`[Drive] Migrating ${legacy.length} legacy pending items to WAL`);
                for (const item of legacy) {
                    this._appendWAL('upsert_expense', {
                        expense: item.expense,
                        metadata: item.metadata,
                    });
                }
                localStorage.removeItem(this._PENDING_KEY);
            }
        } catch { }
    },

    // ========== Core API: commitChange() ==========
    // Every mutation goes through here: localStorage instant + WAL + schedule sync
    commitChange(action, payload) {
        const data = App.state.data;
        if (!data) return;

        // 1. Apply mutation to in-memory state
        this._applyMutation(data, action, payload);

        // 2. Persist to localStorage immediately (survives app kill)
        this._saveLocal(data);

        // 3. Append to WAL for server sync
        this._appendWAL(action, payload);

        // 4. Schedule async sync to Supabase
        this._scheduleSync();

        console.log(`[Drive] Committed: ${action}`);
    },

    // Apply a mutation to in-memory data
    _applyMutation(data, action, payload) {
        switch (action) {
            case 'upsert_expense': {
                const e = payload.expense;
                const idx = data.expenses.findIndex(x => x.id === e.id);
                if (idx >= 0) data.expenses[idx] = e;
                else data.expenses.push(e);

                if (payload.metadata) {
                    if (!data.expenseMetadata) data.expenseMetadata = [];
                    const mi = data.expenseMetadata.findIndex(x => x.expense_id === payload.metadata.expense_id);
                    if (mi >= 0) data.expenseMetadata[mi] = payload.metadata;
                    else data.expenseMetadata.push(payload.metadata);
                }
                break;
            }
            case 'delete_expense': {
                data.expenses = data.expenses.filter(e => e.id !== payload.id);
                if (data.expenseMetadata) {
                    data.expenseMetadata = data.expenseMetadata.filter(m => m.expense_id !== payload.id);
                }
                break;
            }
            case 'upsert_budget': {
                const b = payload.budget;
                const idx = data.budgets.findIndex(x => x.id === b.id);
                if (idx >= 0) data.budgets[idx] = b;
                else data.budgets.push(b);
                break;
            }
            case 'delete_budget': {
                data.budgets = data.budgets.filter(b => b.id !== payload.id);
                break;
            }
            case 'set_monthly_budget': {
                const { monthKey, budgetId, amount } = payload;
                if (!data.monthlyBudgets[monthKey]) data.monthlyBudgets[monthKey] = {};
                if (!data.monthlyBudgets[monthKey][budgetId]) data.monthlyBudgets[monthKey][budgetId] = {};
                data.monthlyBudgets[monthKey][budgetId].amount = amount;
                break;
            }
            case 'copy_monthly_budgets': {
                const { monthKey, entries } = payload;
                if (!data.monthlyBudgets[monthKey]) data.monthlyBudgets[monthKey] = {};
                for (const [budgetId, config] of Object.entries(entries)) {
                    data.monthlyBudgets[monthKey][budgetId] = { ...data.monthlyBudgets[monthKey][budgetId], ...config };
                }
                break;
            }
        }
    },

    // ========== Sync WAL to Supabase ==========
    _syncTimer: null,
    _syncing: false,

    _scheduleSync(delayMs = 2000) {
        if (this._syncTimer) clearTimeout(this._syncTimer);
        this._syncTimer = setTimeout(() => this.syncWAL(), delayMs);
    },

    async syncWAL() {
        const userId = Auth.getUserId();
        if (!userId || this._syncing) return;

        const wal = this._getWAL();
        if (wal.length === 0) return;

        this._syncing = true;
        console.log(`[Drive] Syncing ${wal.length} WAL entries...`);

        for (const entry of wal) {
            try {
                await this._replayWALEntry(userId, entry);
                this._removeWALEntry(entry.id);
                console.log(`[Drive] WAL synced: ${entry.action} (${entry.id})`);
            } catch (err) {
                console.warn(`[Drive] WAL sync failed for ${entry.action}:`, err.message || err);
                // Stop on first failure to avoid hammering server
                break;
            }
        }

        this._syncing = false;

        const remaining = this._getWAL();
        if (remaining.length > 0) {
            console.log(`[Drive] ${remaining.length} WAL entries still pending, retrying in 10s`);
            this._scheduleSync(10000);
        } else {
            console.log('[Drive] All WAL entries synced!');
        }
    },

    // Replay a single WAL entry to Supabase
    async _replayWALEntry(userId, entry) {
        const p = entry.payload;

        switch (entry.action) {
            case 'upsert_expense': {
                const e = p.expense;
                const row = {
                    id: e.id, user_id: userId,
                    date: e.date, budget_id: e.budgetId,
                    amount: e.amount, note: e.note || '',
                    split_count: e.splitCount || null,
                    split_unit: e.splitUnit || null,
                    split_start: e.splitStart || null,
                };
                const { error } = await supabaseClient.from('expenses').upsert([row], { onConflict: 'id' });
                if (error) throw error;

                if (p.metadata && p.metadata.qr_account) {
                    const m = p.metadata;
                    await supabaseClient.from('expense_metadata').upsert([{
                        expense_id: m.expense_id, user_id: userId,
                        qr_bank: m.qr_bank || '', qr_account: m.qr_account || '',
                        qr_recipient: m.qr_recipient || '', qr_memo: m.qr_memo || '',
                    }], { onConflict: 'expense_id' });
                }
                break;
            }
            case 'delete_expense': {
                const { error } = await supabaseClient.from('expenses')
                    .delete().eq('id', p.id).eq('user_id', userId);
                if (error) throw error;
                // Also clean metadata
                await supabaseClient.from('expense_metadata')
                    .delete().eq('expense_id', p.id).eq('user_id', userId);
                break;
            }
            case 'upsert_budget': {
                const b = p.budget;
                const row = {
                    id: b.id, user_id: userId,
                    name: b.name, icon: b.icon || '💰', color: b.color || '#7c3aed',
                };
                const { error } = await supabaseClient.from('budgets').upsert([row], { onConflict: 'id' });
                if (error) throw error;
                break;
            }
            case 'delete_budget': {
                const { error } = await supabaseClient.from('budgets')
                    .delete().eq('id', p.id).eq('user_id', userId);
                if (error) throw error;
                break;
            }
            case 'set_monthly_budget': {
                const { monthKey, budgetId, amount } = p;
                const { error } = await supabaseClient.from('monthly_budgets').upsert([{
                    user_id: userId, month_key: monthKey,
                    budget_id: budgetId, amount: amount || 0,
                }], { onConflict: 'user_id,month_key,budget_id' });
                if (error) throw error;
                break;
            }
            case 'copy_monthly_budgets': {
                const { monthKey, entries } = p;
                const rows = Object.entries(entries).map(([budgetId, config]) => ({
                    user_id: userId, month_key: monthKey,
                    budget_id: budgetId, amount: config.amount || 0,
                }));
                if (rows.length > 0) {
                    const { error } = await supabaseClient.from('monthly_budgets').upsert(rows, {
                        onConflict: 'user_id,month_key,budget_id',
                    });
                    if (error) throw error;
                }
                break;
            }
        }
    },

    // ========== Load data: localStorage first, then Supabase merge ==========
    async loadData() {
        // 1. Migrate any legacy pending queue
        this._migrateLegacyPending();

        // 2. Load localStorage for instant render
        const localData = this._loadLocal();
        if (localData && localData.budgets.length > 0) {
            console.log('[Drive] Loaded from localStorage (instant):', localData.expenses.length, 'expenses');
        }

        // 3. Fetch from Supabase (retry up to 3 times)
        const userId = Auth.getUserId();
        if (!userId) return localData || this.getDefaultData();

        let serverData = null;
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const [budgetsRes, monthlyRes, expensesRes, metaRes] = await Promise.all([
                    supabaseClient.from('budgets').select('*').eq('user_id', userId),
                    supabaseClient.from('monthly_budgets').select('*').eq('user_id', userId),
                    supabaseClient.from('expenses').select('*').eq('user_id', userId),
                    supabaseClient.from('expense_metadata').select('*').eq('user_id', userId),
                ]);

                // Check for errors — retry if ANY table fails
                const errors = [budgetsRes, monthlyRes, expensesRes, metaRes].filter(r => r.error);
                if (errors.length > 0) {
                    throw new Error(errors.map(r => r.error.message).join('; '));
                }

                // Validate: make sure we got arrays (not null/undefined)
                if (!Array.isArray(budgetsRes.data) || !Array.isArray(expensesRes.data)) {
                    throw new Error('Invalid response: data is not an array');
                }

                serverData = {
                    budgets: (budgetsRes.data || []).map(b => ({
                        id: b.id, name: b.name, icon: b.icon, color: b.color,
                    })),
                    monthlyBudgets: {},
                    expenses: (expensesRes.data || []).map(e => ({
                        id: e.id, date: e.date, budgetId: e.budget_id,
                        amount: e.amount, note: e.note || '',
                        splitCount: e.split_count || null,
                        splitUnit: e.split_unit || null,
                        splitStart: e.split_start || null,
                    })),
                    expenseMetadata: (metaRes.data || []).map(m => ({
                        id: m.id, expense_id: m.expense_id,
                        qr_bank: m.qr_bank || '', qr_account: m.qr_account || '',
                        qr_recipient: m.qr_recipient || '', qr_memo: m.qr_memo || '',
                    })),
                };

                (monthlyRes.data || []).forEach(m => {
                    if (!serverData.monthlyBudgets[m.month_key]) serverData.monthlyBudgets[m.month_key] = {};
                    serverData.monthlyBudgets[m.month_key][m.budget_id] = { amount: m.amount };
                });

                console.log(`[Drive] Server data loaded: ${serverData.expenses.length} expenses, ${serverData.budgets.length} budgets`);
                break; // success
            } catch (e) {
                console.warn(`[Drive] loadData attempt ${attempt}/${MAX_RETRIES} failed:`, e.message || e);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 1500 * attempt)); // Progressive backoff
                }
            }
        }

        // 4. SHRINK GUARD: union merge server + local (never lose local-only records)
        let baseData;
        if (serverData && localData) {
            baseData = this._unionMerge(localData, serverData);
        } else {
            baseData = serverData || localData || this.getDefaultData();
        }

        // 5. Replay WAL on top (WAL always wins for pending changes)
        const wal = this._getWAL();
        if (wal.length > 0) {
            for (const entry of wal) {
                this._applyMutation(baseData, entry.action, entry.payload);
            }
            console.log(`[Drive] Merged ${wal.length} pending WAL entries`);
        }

        // 6. Save merged result to localStorage
        this._saveLocal(baseData);

        // 7. Background sync WAL if there are pending entries
        if (wal.length > 0) {
            this.syncWAL().catch(() => { });
        }

        if (!serverData && localData) {
            Utils.showToast('Đang dùng bản offline, sẽ tự sync khi có mạng', 'info');
        }

        return baseData;
    },

    // ========== Supabase Realtime: continuous sync ==========
    _realtimeChannel: null,

    startRealtime() {
        const userId = Auth.getUserId();
        if (!userId || !supabaseClient) return;

        // Clean up any existing subscription
        this.stopRealtime();

        this._realtimeChannel = supabaseClient
            .channel('xmoni-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `user_id=eq.${userId}` },
                (payload) => this._onRealtimeChange('expenses', payload))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'budgets', filter: `user_id=eq.${userId}` },
                (payload) => this._onRealtimeChange('budgets', payload))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_budgets', filter: `user_id=eq.${userId}` },
                (payload) => this._onRealtimeChange('monthly_budgets', payload))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_metadata', filter: `user_id=eq.${userId}` },
                (payload) => this._onRealtimeChange('expense_metadata', payload))
            .subscribe((status) => {
                console.log('[Drive] Realtime status:', status);
            });

        console.log('[Drive] Realtime subscription started');
    },

    stopRealtime() {
        if (this._realtimeChannel) {
            supabaseClient.removeChannel(this._realtimeChannel);
            this._realtimeChannel = null;
        }
    },

    _onRealtimeChange(table, payload) {
        if (!App.state.data) return;

        // Skip if this change came from our own WAL sync (avoid echo loop)
        // We detect this by checking if the record matches a recent WAL entry
        const wal = this._getWAL();
        const data = App.state.data;
        const eventType = payload.eventType; // INSERT, UPDATE, DELETE
        const newRec = payload.new;
        const oldRec = payload.old;

        console.log(`[Drive] Realtime: ${table} ${eventType}`);

        switch (table) {
            case 'expenses': {
                if (eventType === 'DELETE') {
                    const id = oldRec?.id;
                    if (id && !wal.some(w => w.action === 'delete_expense' && w.payload.id === id)) {
                        data.expenses = data.expenses.filter(e => e.id !== id);
                    }
                } else {
                    const mapped = {
                        id: newRec.id, date: newRec.date, budgetId: newRec.budget_id,
                        amount: newRec.amount, note: newRec.note || '',
                        splitCount: newRec.split_count || null,
                        splitUnit: newRec.split_unit || null,
                        splitStart: newRec.split_start || null,
                    };
                    // Don't overwrite if we have a pending WAL change for this id
                    if (!wal.some(w => w.action === 'upsert_expense' && w.payload.expense?.id === mapped.id)) {
                        const idx = data.expenses.findIndex(e => e.id === mapped.id);
                        if (idx >= 0) data.expenses[idx] = mapped;
                        else data.expenses.push(mapped);
                    }
                }
                break;
            }
            case 'budgets': {
                if (eventType === 'DELETE') {
                    const id = oldRec?.id;
                    if (id && !wal.some(w => w.action === 'delete_budget' && w.payload.id === id)) {
                        data.budgets = data.budgets.filter(b => b.id !== id);
                    }
                } else {
                    const mapped = { id: newRec.id, name: newRec.name, icon: newRec.icon, color: newRec.color };
                    if (!wal.some(w => w.action === 'upsert_budget' && w.payload.budget?.id === mapped.id)) {
                        const idx = data.budgets.findIndex(b => b.id === mapped.id);
                        if (idx >= 0) data.budgets[idx] = mapped;
                        else data.budgets.push(mapped);
                    }
                }
                break;
            }
            case 'monthly_budgets': {
                if (eventType !== 'DELETE' && newRec) {
                    const mk = newRec.month_key;
                    const bid = newRec.budget_id;
                    if (!wal.some(w => w.action === 'set_monthly_budget' && w.payload.monthKey === mk && w.payload.budgetId === bid)) {
                        if (!data.monthlyBudgets[mk]) data.monthlyBudgets[mk] = {};
                        data.monthlyBudgets[mk][bid] = { amount: newRec.amount };
                    }
                }
                break;
            }
            case 'expense_metadata': {
                if (eventType !== 'DELETE' && newRec) {
                    const mapped = {
                        id: newRec.id, expense_id: newRec.expense_id,
                        qr_bank: newRec.qr_bank || '', qr_account: newRec.qr_account || '',
                        qr_recipient: newRec.qr_recipient || '', qr_memo: newRec.qr_memo || '',
                    };
                    if (!data.expenseMetadata) data.expenseMetadata = [];
                    const idx = data.expenseMetadata.findIndex(m => m.expense_id === mapped.expense_id);
                    if (idx >= 0) data.expenseMetadata[idx] = mapped;
                    else data.expenseMetadata.push(mapped);
                }
                break;
            }
        }

        // Update localStorage mirror
        this._saveLocal(data);

        // Re-render current view
        this._debounceRender();
    },

    _renderTimer: null,
    _debounceRender() {
        if (this._renderTimer) clearTimeout(this._renderTimer);
        this._renderTimer = setTimeout(() => {
            switch (App.state.currentView) {
                case 'dashboard': Dashboard.render(); break;
                case 'expenses': Expense.render(); break;
                case 'budgets': Budget.render(); break;
            }
        }, 300);
    },

    // ========== Emergency save before page unload ==========
    saveBeforeUnload() {
        const data = App.state.data;
        if (data) {
            this._saveLocal(data);
        }
    },

    // ========== Legacy compat: syncPending (now routes to syncWAL) ==========
    async syncPending() {
        this._migrateLegacyPending();
        await this.syncWAL();
    },
};
