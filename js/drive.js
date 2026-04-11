// ============================================
// XMoni - Supabase Data Layer
// ============================================

const Drive = {
    // Default empty data
    getDefaultData() {
        return {
            budgets: [],
            monthlyBudgets: {},
            expenses: [],
        };
    },

    // Load all data from Supabase
    async loadData() {
        const userId = Auth.getUserId();
        if (!userId) return this.getDefaultData();

        try {
            // Query all 3 tables in parallel
            const [budgetsRes, monthlyRes, expensesRes] = await Promise.all([
                supabaseClient.from('budgets').select('*').eq('user_id', userId),
                supabaseClient.from('monthly_budgets').select('*').eq('user_id', userId),
                supabaseClient.from('expenses').select('*').eq('user_id', userId),
            ]);

            // Transform budgets
            const budgets = (budgetsRes.data || []).map(b => ({
                id: b.id,
                name: b.name,
                icon: b.icon,
                color: b.color,
            }));

            // Transform monthly budgets: { "2026-04": { "budgetId": { amount: 500000 } } }
            const monthlyBudgets = {};
            (monthlyRes.data || []).forEach(m => {
                if (!monthlyBudgets[m.month_key]) monthlyBudgets[m.month_key] = {};
                monthlyBudgets[m.month_key][m.budget_id] = { amount: m.amount };
            });

            // Transform expenses
            const expenses = (expensesRes.data || []).map(e => ({
                id: e.id,
                date: e.date,
                budgetId: e.budget_id,
                amount: e.amount,
                note: e.note || '',
            }));

            return { budgets, monthlyBudgets, expenses };
        } catch (e) {
            console.error('Supabase loadData error:', e);
            Utils.showToast('Lỗi tải dữ liệu', 'error');
            return this.getDefaultData();
        }
    },

    // Save full data object to Supabase (sync all tables)
    async saveData(data) {
        const userId = Auth.getUserId();
        if (!userId) return;

        try {
            // Upsert budgets
            const budgetRows = data.budgets.map(b => ({
                id: b.id,
                user_id: userId,
                name: b.name,
                icon: b.icon || '💰',
                color: b.color || '#7c3aed',
            }));
            if (budgetRows.length > 0) {
                await supabaseClient.from('budgets').upsert(budgetRows, { onConflict: 'id' });
            }

            // Delete removed budgets
            const budgetIds = data.budgets.map(b => b.id);
            if (budgetIds.length > 0) {
                await supabaseClient.from('budgets')
                    .delete()
                    .eq('user_id', userId)
                    .not('id', 'in', `(${budgetIds.join(',')})`);
            }

            // Upsert monthly budgets
            const monthlyRows = [];
            Object.entries(data.monthlyBudgets || {}).forEach(([monthKey, budgets]) => {
                Object.entries(budgets).forEach(([budgetId, config]) => {
                    monthlyRows.push({
                        user_id: userId,
                        month_key: monthKey,
                        budget_id: budgetId,
                        amount: config.amount || 0,
                    });
                });
            });
            if (monthlyRows.length > 0) {
                await supabaseClient.from('monthly_budgets').upsert(monthlyRows, {
                    onConflict: 'user_id,month_key,budget_id',
                });
            }

            // Upsert expenses
            const expenseRows = data.expenses.map(e => ({
                id: e.id,
                user_id: userId,
                date: e.date,
                budget_id: e.budgetId,
                amount: e.amount,
                note: e.note || '',
            }));
            if (expenseRows.length > 0) {
                await supabaseClient.from('expenses').upsert(expenseRows, { onConflict: 'id' });
            }

            // Delete removed expenses
            const expenseIds = data.expenses.map(e => e.id);
            if (expenseIds.length > 0) {
                await supabaseClient.from('expenses')
                    .delete()
                    .eq('user_id', userId)
                    .not('id', 'in', `(${expenseIds.join(',')})`);
            }

        } catch (e) {
            console.error('Supabase saveData error:', e);
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
};
