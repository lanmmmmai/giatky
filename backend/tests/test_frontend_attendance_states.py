from pathlib import Path
import unittest


class FrontendAttendanceStateTests(unittest.TestCase):
    def test_attendance_api_error_is_separate_from_empty_state(self):
        source = Path("frontend/src/pages/payroll/Payroll.tsx").read_text(encoding="utf-8")

        self.assertIn("attendanceLoading", source)
        self.assertIn("attendanceError", source)
        self.assertIn("setAttendanceError(detail)", source)
        self.assertIn("setAttendanceRecords([])", source)
        self.assertIn(") : attendanceError ? (", source)
        self.assertIn(") : attendanceRecords.length === 0 ? (", source)


if __name__ == "__main__":
    unittest.main()
