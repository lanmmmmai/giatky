-- Allow multiple attendance sessions per staff member per day.
-- Existing deployments may already have the previous unique index.
DROP INDEX IF EXISTS idx_attendance_staff_date_shift_unique;

CREATE INDEX IF NOT EXISTS idx_attendance_staff_date_shift
  ON attendance (staff_id, work_date, COALESCE(shift_id, shift_name, 'DEFAULT_SHIFT'))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_staff_open_session
  ON attendance (staff_id, status)
  WHERE status = 'checked_in';
