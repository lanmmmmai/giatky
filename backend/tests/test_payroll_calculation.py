from decimal import Decimal
from pathlib import Path
import unittest

from app.payroll.calculation import calculate_payroll_amount


class PayrollCalculationTests(unittest.TestCase):
    def test_sums_multiple_numeric_total_hours(self):
        hours, salary, warnings = calculate_payroll_amount(
            [
                {"status": "completed", "total_hours": "7.5"},
                {"status": "completed", "total_hours": Decimal("2.25")},
            ],
            "20000",
        )

        self.assertEqual(hours, Decimal("9.75"))
        self.assertEqual(salary, 195000)
        self.assertEqual(warnings, [])

    def test_derives_hours_when_total_hours_is_null(self):
        hours, salary, warnings = calculate_payroll_amount(
            [
                {
                    "status": "completed",
                    "total_hours": None,
                    "check_in_time": "2026-07-01T08:00:00+00:00",
                    "check_out_time": "2026-07-01T12:30:00+00:00",
                }
            ],
            "30000",
        )

        self.assertEqual(hours, Decimal("4.50"))
        self.assertEqual(salary, 135000)
        self.assertEqual(len(warnings), 1)

    def test_skips_missing_checkout(self):
        hours, salary, warnings = calculate_payroll_amount(
            [
                {
                    "status": "completed",
                    "total_hours": None,
                    "check_in_time": "2026-07-01T08:00:00+00:00",
                    "check_out_time": None,
                }
            ],
            "30000",
        )

        self.assertEqual(hours, Decimal("0.00"))
        self.assertEqual(salary, 0)
        self.assertIn("thiếu checkout", warnings[0])

    def test_employee_without_attendance_gets_zero(self):
        hours, salary, warnings = calculate_payroll_amount([], "25000")

        self.assertEqual(hours, Decimal("0.00"))
        self.assertEqual(salary, 0)
        self.assertEqual(warnings, [])

    def test_ignores_invalid_status_before_summing(self):
        hours, salary, warnings = calculate_payroll_amount(
            [
                {"status": "checked_in", "total_hours": "8"},
                {"status": "completed", "total_hours": "2"},
            ],
            "10000",
        )

        self.assertEqual(hours, Decimal("2.00"))
        self.assertEqual(salary, 20000)
        self.assertIn("checked_in", warnings[0])

    def test_payroll_route_filters_staff_branch_month_year_and_no_work_minutes_query(self):
        route_source = Path("backend/app/payroll/routes.py").read_text(encoding="utf-8")

        self.assertNotIn("work_minutes", route_source)
        self.assertIn('.eq("staff_id"', route_source)
        self.assertIn('.eq("branch_id"', route_source)
        self.assertIn('.gte("work_date", start_date)', route_source)
        self.assertIn('.lte("work_date", end_date)', route_source)


if __name__ == "__main__":
    unittest.main()
