from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, List, Optional, Tuple


PAYROLL_ATTENDANCE_STATUSES = {
    "completed",
    "on_time",
    "late",
    "early_leave",
    "manual_adjusted",
}

HOUR_QUANT = Decimal("0.01")


def decimal_from_value(value: Any, default: str = "0") -> Decimal:
    if value is None or value == "":
        return Decimal(default)
    return Decimal(str(value))


def parse_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def hours_between(check_in: Any, check_out: Any) -> Optional[Decimal]:
    start = parse_datetime(check_in)
    end = parse_datetime(check_out)
    if not start or not end or end <= start:
        return None
    seconds = Decimal(str((end - start).total_seconds()))
    return (seconds / Decimal("3600")).quantize(HOUR_QUANT, rounding=ROUND_HALF_UP)


def resolve_attendance_hours(record: dict[str, Any]) -> Tuple[Decimal, Optional[str]]:
    status = record.get("status")
    if status not in PAYROLL_ATTENDANCE_STATUSES:
        return Decimal("0"), f"Bỏ qua chấm công trạng thái {status or 'không xác định'}."

    if record.get("total_hours") is not None:
        return decimal_from_value(record.get("total_hours")).quantize(HOUR_QUANT, rounding=ROUND_HALF_UP), None

    derived = hours_between(record.get("check_in_time"), record.get("check_out_time"))
    if derived is not None:
        return derived, "total_hours rỗng, đã tính theo check_in_time/check_out_time."

    if record.get("check_in_time") and not record.get("check_out_time"):
        return Decimal("0"), "Bỏ qua chấm công thiếu checkout."
    return Decimal("0"), "Bỏ qua chấm công thiếu dữ liệu giờ làm."


def calculate_payroll_amount(
    attendance_rows: List[dict[str, Any]],
    hourly_rate: Any,
) -> Tuple[Decimal, int, List[str]]:
    total_hours = Decimal("0")
    warnings: List[str] = []

    for record in attendance_rows:
        hours, warning = resolve_attendance_hours(record)
        total_hours += hours
        if warning:
            warnings.append(warning)

    rate = decimal_from_value(hourly_rate)
    salary = (total_hours * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return total_hours.quantize(HOUR_QUANT, rounding=ROUND_HALF_UP), int(salary), warnings


def decimal_to_payload(value: Decimal) -> str:
    return format(value.normalize(), "f")
