-- ============================================================
--  REVENUE REPORT MODULE MIGRATION SQL
-- ============================================================

-- 1. Create revenue_reports table
CREATE TABLE IF NOT EXISTS revenue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  report_date DATE NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,

  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES users(id) ON DELETE SET NULL,

  opening_cash BIGINT NOT NULL DEFAULT 0,

  cumulative_revenue_before BIGINT NOT NULL DEFAULT 0,
  daily_revenue BIGINT NOT NULL DEFAULT 0,

  order_invoice_count INTEGER DEFAULT 0,
  order_bank_transfer BIGINT DEFAULT 0,
  order_cash BIGINT DEFAULT 0,
  order_debt BIGINT DEFAULT 0,

  debt_collection_total BIGINT DEFAULT 0,
  debt_invoice_count INTEGER DEFAULT 0,
  debt_bank_transfer BIGINT DEFAULT 0,
  debt_cash BIGINT DEFAULT 0,

  total_expense BIGINT DEFAULT 0,
  closing_cash BIGINT DEFAULT 0,

  note TEXT,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),

  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  reject_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(report_date, branch_id)
);

-- 2. Create revenue_report_expenses table
CREATE TABLE IF NOT EXISTS revenue_report_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  report_id UUID NOT NULL REFERENCES revenue_reports(id) ON DELETE CASCADE,

  expense_type TEXT DEFAULT 'other',
  amount BIGINT NOT NULL DEFAULT 0,
  description TEXT NOT NULL,

  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
