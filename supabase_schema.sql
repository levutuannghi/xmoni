-- XMoni Supabase Database Schema
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '💰',
  color TEXT DEFAULT '#7c3aed',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Monthly budgets
CREATE TABLE IF NOT EXISTS monthly_budgets (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  month_key TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  amount INTEGER DEFAULT 0,
  UNIQUE(user_id, month_key, budget_id)
);

-- 3. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  date TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  note TEXT DEFAULT '',
  split_count INTEGER DEFAULT NULL,
  split_unit TEXT DEFAULT NULL,
  split_start TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Each user only sees their own data
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_budgets" ON budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_monthly" ON monthly_budgets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "own_expenses" ON expenses FOR ALL USING (auth.uid() = user_id);
