from pathlib import Path
import unittest


class AttendanceSchemaCompatibilityTests(unittest.TestCase):
    def test_attendance_does_not_reference_work_minutes(self):
        source = Path("backend/app/attendance/routes.py").read_text(encoding="utf-8")

        self.assertNotIn("work_minutes", source)

    def test_attendance_filters_optional_columns_before_writes(self):
        source = Path("backend/app/attendance/routes.py").read_text(encoding="utf-8")

        self.assertIn("_filter_attendance_payload(insert_data)", source)
        self.assertIn("_filter_attendance_payload(update_data)", source)
        self.assertIn("has_column(\"attendance\", \"shift_id\")", source)
        self.assertIn("has_column(\"attendance\", \"source\")", source)

    def test_attendance_queries_do_not_use_invalid_user_relationships(self):
        source = "\n".join([
            Path("backend/app/attendance/routes.py").read_text(encoding="utf-8"),
            Path("backend/app/reports/routes.py").read_text(encoding="utf-8"),
        ])

        self.assertNotIn("attendance_updated_by_fkey", source)
        self.assertNotIn("users!attendance_updated_by_fkey", source)
        self.assertNotIn("updated_by_user", source)
        self.assertNotIn('attendance").select("staff_id", "users!staff_id', source)

    def test_attendance_hydrates_staff_by_staff_id(self):
        source = Path("backend/app/attendance/routes.py").read_text(encoding="utf-8")

        self.assertIn("def _hydrate_attendance_staff", source)
        self.assertIn('row.get("staff_id")', source)
        self.assertIn('supabase.table("users").select("id, full_name, username, role")', source)
        self.assertIn('item["staff_name"]', source)


if __name__ == "__main__":
    unittest.main()
