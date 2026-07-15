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


if __name__ == "__main__":
    unittest.main()
