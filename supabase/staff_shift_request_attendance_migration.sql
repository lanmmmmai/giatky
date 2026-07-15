-- Public staff shift registration requests.
CREATE TABLE IF NOT EXISTS staff_shift_registration_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  date_of_birth DATE,
  address TEXT,
  desired_shift TEXT NOT NULL,
  available_start_date DATE NOT NULL,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CONTACTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_shift_requests_status ON staff_shift_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_staff_shift_requests_branch ON staff_shift_registration_requests(branch_id);

-- Extend the existing attendance table without removing legacy check-in/check-out data.
ALTER TABLE attendance ALTER COLUMN check_in_time DROP NOT NULL;

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS shift_id TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS shift_name TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS shift_start_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS shift_end_time TIME;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_in_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS check_out_at TIMESTAMPTZ;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS break_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS early_leave_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'STAFF_CHECK_IN';
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS is_manual BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS adjustment_type TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS manual_reason TEXT;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

UPDATE attendance
SET
  check_in_at = COALESCE(check_in_at, check_in_time),
  check_out_at = COALESCE(check_out_at, check_out_time),
  total_hours = COALESCE(total_hours, 0)
WHERE TRUE;

DO $$
BEGIN
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
  ALTER TABLE attendance ADD CONSTRAINT attendance_status_check CHECK (
    status IN (
      'checked_in',
      'completed',
      'missing_checkout',
      'on_time',
      'late',
      'early_leave',
      'missing_checkin',
      'leave_paid',
      'leave_unpaid',
      'manual_adjusted'
    )
  );
END $$;

DO $$
BEGIN
  ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_source_check;
  ALTER TABLE attendance ADD CONSTRAINT attendance_source_check CHECK (
    source IN ('STAFF_CHECK_IN', 'STAFF_CHECK_OUT', 'ADMIN_MANUAL', 'SYSTEM')
  );
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_staff_date_shift
  ON attendance (staff_id, work_date, COALESCE(shift_id, shift_name, 'DEFAULT_SHIFT'))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_branch_date ON attendance(branch_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status_source ON attendance(status, source);

CREATE TABLE IF NOT EXISTS attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  reason TEXT NOT NULL,
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_logs_attendance ON attendance_audit_logs(attendance_id);
