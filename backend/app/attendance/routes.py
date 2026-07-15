from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime, date, time, timezone, timedelta
import logging

from app.common.db_features import filter_columns, has_column, has_table
from app.common.dependencies import get_current_user, require_role
from app.database import supabase
from app.payroll.calculation import (
    PAYROLL_ATTENDANCE_STATUSES,
    calculate_payroll_amount,
    decimal_to_payload,
)

logger = logging.getLogger("app.attendance")
router = APIRouter(prefix="/attendance", tags=["Attendance"])
admin_router = APIRouter(prefix="/admin/attendance", tags=["Admin Attendance"])

OPTIONAL_ATTENDANCE_COLUMNS = {
    "shift_id",
    "shift_name",
    "shift_start_time",
    "shift_end_time",
    "check_in_at",
    "check_out_at",
    "break_minutes",
    "late_minutes",
    "early_leave_minutes",
    "overtime_minutes",
    "source",
    "is_manual",
    "adjustment_type",
    "manual_reason",
    "created_by",
    "updated_by",
    "deleted_at",
    "created_at",
    "updated_at",
}


def _attendance_select(required: List[str], optional: List[str]) -> str:
    selected = list(required)
    selected.extend(column for column in optional if has_column("attendance", column))
    return ", ".join(selected)


def _filter_attendance_payload(data: dict) -> dict:
    return filter_columns("attendance", data, OPTIONAL_ATTENDANCE_COLUMNS)


def _has_extended_attendance_schema() -> bool:
    return has_column("attendance", "source")


def _manual_status(calculated_status: str, adjustment_type: Optional[str] = None) -> str:
    if _has_extended_attendance_schema():
        return "manual_adjusted" if adjustment_type != "Nghỉ có phép" else "leave_paid"
    if calculated_status == "missing_checkout":
        return "missing_checkout"
    return "completed"


def _insert_attendance_audit_log(data: dict) -> None:
    if not has_table("attendance_audit_logs"):
        return
    try:
        supabase.table("attendance_audit_logs").insert(data).execute()
    except Exception as exc:
        logger.warning("Không thể ghi attendance audit log: %s", exc)

class AttendanceCheckIn(BaseModel):
    note: Optional[str] = None

class AttendanceCheckOut(BaseModel):
    note: Optional[str] = None

class ManualAttendancePayload(BaseModel):
    staff_id: str
    work_date: date
    shift_id: Optional[str] = None
    shift_name: str = Field(..., min_length=1)
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    break_minutes: int = Field(default=0, ge=0)
    adjustment_type: str = Field(..., min_length=1)
    manual_reason: str = Field(..., min_length=1)
    note: Optional[str] = None

    @field_validator("manual_reason", "adjustment_type", "shift_name")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Trường này là bắt buộc.")
        return value

class AttendanceUpdatePayload(BaseModel):
    shift_id: Optional[str] = None
    shift_name: Optional[str] = None
    shift_start_time: Optional[time] = None
    shift_end_time: Optional[time] = None
    check_in_at: Optional[datetime] = None
    check_out_at: Optional[datetime] = None
    break_minutes: Optional[int] = Field(default=None, ge=0)
    adjustment_type: Optional[str] = None
    manual_reason: str = Field(..., min_length=1)
    note: Optional[str] = None

    @field_validator("manual_reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Bắt buộc nhập lý do chỉnh sửa.")
        return value

def _parse_dt(value):
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

def _combine_work_datetime(work_date: date, value: Optional[time], overnight: bool = False):
    if not value:
        return None
    target_date = work_date + timedelta(days=1) if overnight else work_date
    return datetime.combine(target_date, value).replace(tzinfo=timezone.utc)

def _calculate_attendance(
    work_date: date,
    check_in_at: Optional[datetime],
    check_out_at: Optional[datetime],
    shift_start_time: Optional[time],
    shift_end_time: Optional[time],
    break_minutes: int
):
    if check_in_at and check_in_at.tzinfo is None:
        check_in_at = check_in_at.replace(tzinfo=timezone.utc)
    if check_out_at and check_out_at.tzinfo is None:
        check_out_at = check_out_at.replace(tzinfo=timezone.utc)

    if check_in_at and check_out_at and check_out_at <= check_in_at:
        raise HTTPException(status_code=400, detail="Giờ ra không được nhỏ hơn hoặc bằng giờ vào.")

    overnight_shift = bool(shift_start_time and shift_end_time and shift_end_time <= shift_start_time)
    expected_start = _combine_work_datetime(work_date, shift_start_time)
    expected_end = _combine_work_datetime(work_date, shift_end_time, overnight_shift)

    worked_minutes = 0
    late_minutes = 0
    early_leave_minutes = 0
    overtime_minutes = 0
    status_value = "completed"

    if check_in_at and check_out_at:
        worked_minutes = max(0, int((check_out_at - check_in_at).total_seconds() // 60) - break_minutes)
        if expected_start and check_in_at > expected_start:
            late_minutes = int((check_in_at - expected_start).total_seconds() // 60)
        if expected_end:
            if check_out_at < expected_end:
                early_leave_minutes = int((expected_end - check_out_at).total_seconds() // 60)
            elif check_out_at > expected_end:
                overtime_minutes = int((check_out_at - expected_end).total_seconds() // 60)
        status_value = "late" if late_minutes else "early_leave" if early_leave_minutes else "on_time"
    elif check_in_at:
        status_value = "missing_checkout"
    elif check_out_at:
        status_value = "missing_checkin"
    else:
        status_value = "manual_adjusted"

    return {
        "total_hours": round(worked_minutes / 60, 2),
        "late_minutes": late_minutes,
        "early_leave_minutes": early_leave_minutes,
        "overtime_minutes": overtime_minutes,
        "status": status_value,
    }

COMPLETED_ATTENDANCE_STATUSES = list(PAYROLL_ATTENDANCE_STATUSES)

def _ensure_no_overlap(staff_id: str, work_date_value: date, check_in_at: Optional[datetime], check_out_at: Optional[datetime], exclude_id: Optional[str] = None):
    if not check_in_at or not check_out_at:
        return

    records_res = supabase.table("attendance").select(_attendance_select(
        ["id", "check_in_time", "check_out_time"],
        ["check_in_at", "check_out_at"],
    ))\
        .eq("staff_id", staff_id)\
        .eq("work_date", work_date_value.isoformat())\
        .execute()

    for record in (records_res.data or []):
        if exclude_id and record.get("id") == exclude_id:
            continue
        start = _parse_dt(record.get("check_in_at") or record.get("check_in_time"))
        end = _parse_dt(record.get("check_out_at") or record.get("check_out_time"))
        if not start or not end:
            continue
        if check_in_at < end and check_out_at > start:
            raise HTTPException(status_code=400, detail="Phiên chấm công bị chồng giờ với phiên đã có.")

def _hydrate_attendance_staff(records: List[dict]) -> List[dict]:
    staff_ids = sorted({row.get("staff_id") for row in records if row.get("staff_id")})
    if not staff_ids:
        return records
    try:
        user_res = supabase.table("users").select("id, full_name, username, role").in_("id", staff_ids).execute()
        users_by_id = {row["id"]: row for row in (user_res.data or [])}
    except Exception as exc:
        logger.warning("Không thể hydrate users cho attendance theo staff_id: %s", exc)
        return records

    hydrated = []
    for row in records:
        item = dict(row)
        staff = users_by_id.get(item.get("staff_id")) or {}
        item["staff_name"] = staff.get("full_name")
        item["staff_username"] = staff.get("username")
        item["staff_role"] = staff.get("role")
        hydrated.append(item)
    return hydrated


def _format_admin_attendance(record: dict):
    branch = record.get("branches") or {}
    item = dict(record)
    item["branch_name"] = branch.get("name")
    item.pop("branches", None)
    return item

def _recalculate_draft_payrolls(staff_id: str, work_date_value: date):
    payroll_res = supabase.table("payrolls").select("*")\
        .eq("staff_id", staff_id)\
        .eq("month", work_date_value.month)\
        .eq("year", work_date_value.year)\
        .eq("status", "draft")\
        .execute()
    for payroll in (payroll_res.data or []):
        start_date = f"{payroll['year']}-{payroll['month']:02d}-01"
        end_date = f"{payroll['year']}-{payroll['month']:02d}-31"
        att_res = supabase.table("attendance").select("status, total_hours, check_in_time, check_out_time")\
            .eq("staff_id", staff_id)\
            .eq("branch_id", payroll.get("branch_id"))\
            .in_("status", COMPLETED_ATTENDANCE_STATUSES)\
            .gte("work_date", start_date)\
            .lte("work_date", end_date)\
            .execute()
        total_hours, total_salary, _warnings = calculate_payroll_amount(
            att_res.data or [],
            payroll.get("hourly_rate_snapshot") or 0,
        )
        supabase.table("payrolls").update({
            "total_hours": decimal_to_payload(total_hours),
            "total_salary": total_salary,
        }).eq("id", payroll["id"]).execute()

@router.post("/check-in")
def check_in(payload: AttendanceCheckIn, current_user: dict = Depends(get_current_user)):
    """Check-in staff ca. Ensure they are not already checked in."""
    staff_id = current_user["id"]
    branch_id = current_user.get("branch_id")
    
    if not branch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tài khoản của bạn chưa được gán vào chi nhánh nào. Vui lòng liên hệ quản trị viên."
        )
        
    # Check if there is an active check-in (status = 'checked_in')
    active_res = supabase.table("attendance").select("*")\
        .eq("staff_id", staff_id)\
        .eq("status", "checked_in")\
        .execute()
        
    if active_res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn đang có ca làm việc chưa check-out. Vui lòng check-out ca cũ trước."
        )

    now = datetime.now(timezone.utc)
    insert_data = {
        "staff_id": staff_id,
        "branch_id": branch_id,
        "work_date": date.today().isoformat(),
        "check_in_time": now.isoformat(),
        "check_in_at": now.isoformat(),
        "status": "checked_in",
        "source": "STAFF_CHECK_IN",
        "is_manual": False,
        "note": payload.note
    }
    
    response = supabase.table("attendance").insert(_filter_attendance_payload(insert_data)).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể ghi nhận check-in.")
        
    return response.data[0]

@router.post("/check-out")
def check_out(payload: AttendanceCheckOut, current_user: dict = Depends(get_current_user)):
    """Check-out staff ca. Calculate total hours."""
    staff_id = current_user["id"]
    
    # Find active check-in
    active_res = supabase.table("attendance").select("*")\
        .eq("staff_id", staff_id)\
        .eq("status", "checked_in")\
        .execute()
        
    if not active_res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn chưa check-in ca nào, hoặc ca làm việc đã hoàn tất."
        )
        
    record = active_res.data[0]
    now = datetime.now(timezone.utc)
    
    # Calculate hours
    check_in_raw = record.get("check_in_at") or record.get("check_in_time")
    check_in_time = datetime.fromisoformat(check_in_raw.replace("Z", "+00:00"))
    delta = now - check_in_time
    total_seconds = delta.total_seconds()
    
    # Standard hour calculation (rounded to 2 decimal places)
    total_hours = round(max(0.0, total_seconds / 3600.0), 2)
    update_data = {
        "check_out_time": now.isoformat(),
        "check_out_at": now.isoformat(),
        "total_hours": total_hours,
        "status": "completed",
        "source": "STAFF_CHECK_OUT",
        "note": payload.note if payload.note else record["note"],
        "updated_at": now.isoformat()
    }
    
    response = supabase.table("attendance").update(_filter_attendance_payload(update_data)).eq("id", record["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể ghi nhận check-out.")
    _recalculate_draft_payrolls(staff_id, date.fromisoformat(record["work_date"]))
        
    return response.data[0]

@router.get("/me")
def get_my_attendance(current_user: dict = Depends(get_current_user)):
    """Get history of current user."""
    response = supabase.table("attendance").select("*, branches(name)")\
        .eq("staff_id", current_user["id"])\
        .eq("branch_id", current_user.get("branch_id"))\
        .order("check_in_time", desc=True)\
        .execute()
        
    # Format branch name
    formatted = []
    for att in (response.data or []):
        b_name = att.get("branches", {}).get("name") if att.get("branches") else None
        att_copy = dict(att)
        att_copy["branch_name"] = b_name
        if "branches" in att_copy:
            del att_copy["branches"]
        formatted.append(att_copy)
        
    return formatted

@router.get("")
def get_attendance_list(
    branch_id: Optional[str] = None,
    staff_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve attendance lists for managers and admin."""
    role = current_user["role"]
    query = supabase.table("attendance").select("*, branches(name)").order("check_in_time", desc=True)
    
    if role == "manager":
        # Get manager's branches
        if current_user.get("current_branch_id"):
            m_branch_ids = [current_user["current_branch_id"]]
        else:
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            m_branch_ids = [b["id"] for b in (branch_res.data or [])]
        if not m_branch_ids:
            return []
        query = query.in_("branch_id", m_branch_ids)
        
    elif role == "staff":
        # Staff can only see their own
        query = query.eq("staff_id", current_user["id"])
        
    if branch_id and role in ["admin", "manager"]:
        query = query.eq("branch_id", branch_id)
    if staff_id and role in ["admin", "manager"]:
        query = query.eq("staff_id", staff_id)
        
    response = query.execute()
    
    formatted = []
    for att in (response.data or []):
        b_name = att.get("branches", {}).get("name") if att.get("branches") else None
        
        att_copy = dict(att)
        att_copy["branch_name"] = b_name
        
        if "branches" in att_copy: del att_copy["branches"]
        
        formatted.append(att_copy)
        
    return _hydrate_attendance_staff(formatted)

@router.get("/summary")
def get_attendance_summary(current_user: dict = Depends(get_current_user)):
    """Retrieve personal attendance summary (current status, total hours today/this month)."""
    staff_id = current_user["id"]
    
    # 1. Current status
    status_res = supabase.table("attendance").select("*").eq("staff_id", staff_id).eq("status", "checked_in").execute()
    current_status = "checked_in" if status_res.data else "checked_out"
    current_shift = status_res.data[0] if status_res.data else None
    
    # 2. Total hours this month
    today = date.today()
    start_of_month = date(today.year, today.month, 1).isoformat()
    
    history_res = supabase.table("attendance").select("total_hours")\
        .eq("staff_id", staff_id)\
        .eq("branch_id", current_user.get("branch_id"))\
        .in_("status", COMPLETED_ATTENDANCE_STATUSES)\
        .gte("work_date", start_of_month)\
        .execute()
        
    total_hours_month = sum(float(att["total_hours"]) for att in (history_res.data or []))
    
    # 3. Today's hours
    today_history_res = supabase.table("attendance").select("total_hours")\
        .eq("staff_id", staff_id)\
        .eq("branch_id", current_user.get("branch_id"))\
        .in_("status", COMPLETED_ATTENDANCE_STATUSES)\
        .eq("work_date", today.isoformat())\
        .execute()
    total_hours_today = sum(float(att["total_hours"]) for att in (today_history_res.data or []))
    
    return {
        "status": current_status,
        "current_shift": current_shift,
        "total_hours_today": total_hours_today,
        "total_hours_month": total_hours_month
    }

@admin_router.get("", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_admin_attendance(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    staff_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    shift_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    source: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("attendance")\
        .select("*, branches(name)")\
        .order("work_date", desc=True)\
        .range(max(page - 1, 0) * page_size, max(page, 1) * page_size - 1)

    if current_user["role"] == "manager":
        if current_user.get("current_branch_id"):
            branch_ids = [current_user["current_branch_id"]]
        else:
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            branch_ids = [b["id"] for b in (branch_res.data or [])]
        if not branch_ids:
            return []
        query = query.in_("branch_id", branch_ids)

    if date_from:
        query = query.gte("work_date", date_from)
    if date_to:
        query = query.lte("work_date", date_to)
    if staff_id:
        query = query.eq("staff_id", staff_id)
    if branch_id:
        query = query.eq("branch_id", branch_id)
    if shift_id:
        if not has_column("attendance", "shift_id"):
            return []
        query = query.eq("shift_id", shift_id)
    if status_filter:
        query = query.eq("status", status_filter)
    if source:
        if not has_column("attendance", "source"):
            return []
        query = query.eq("source", source)

    response = query.execute()
    records = _hydrate_attendance_staff([_format_admin_attendance(row) for row in (response.data or [])])
    if search:
        needle = search.lower().strip()
        records = [
            row for row in records
            if needle in (row.get("staff_name") or "").lower()
            or needle in (row.get("staff_username") or "").lower()
        ]
    return records

@admin_router.post("/manual", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_manual_attendance(payload: ManualAttendancePayload, current_user: dict = Depends(get_current_user)):
    if not _has_extended_attendance_schema() and not payload.check_in_at:
        raise HTTPException(
            status_code=400,
            detail="Schema chấm công hiện tại yêu cầu giờ vào khi nhập chấm công thủ công.",
        )

    staff_res = supabase.table("users").select("id, full_name, role, branch_id").eq("id", payload.staff_id).execute()
    if not staff_res.data or staff_res.data[0]["role"] != "staff":
        raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên hợp lệ.")
    staff = staff_res.data[0]

    if current_user["role"] == "manager":
        branch_res = supabase.table("branches").select("id").eq("id", staff.get("branch_id")).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Bạn không có quyền nhập chấm công cho nhân viên này.")

    calculated = _calculate_attendance(
        payload.work_date,
        payload.check_in_at,
        payload.check_out_at,
        payload.shift_start_time,
        payload.shift_end_time,
        payload.break_minutes
    )
    _ensure_no_overlap(payload.staff_id, payload.work_date, payload.check_in_at, payload.check_out_at)
    now = datetime.now(timezone.utc).isoformat()
    insert_data = {
        "staff_id": payload.staff_id,
        "branch_id": staff.get("branch_id"),
        "work_date": payload.work_date.isoformat(),
        "shift_id": payload.shift_id,
        "shift_name": payload.shift_name,
        "shift_start_time": payload.shift_start_time.isoformat() if payload.shift_start_time else None,
        "shift_end_time": payload.shift_end_time.isoformat() if payload.shift_end_time else None,
        "check_in_time": payload.check_in_at.isoformat() if payload.check_in_at else None,
        "check_out_time": payload.check_out_at.isoformat() if payload.check_out_at else None,
        "check_in_at": payload.check_in_at.isoformat() if payload.check_in_at else None,
        "check_out_at": payload.check_out_at.isoformat() if payload.check_out_at else None,
        "break_minutes": payload.break_minutes,
        "total_hours": calculated["total_hours"],
        "late_minutes": calculated["late_minutes"],
        "early_leave_minutes": calculated["early_leave_minutes"],
        "overtime_minutes": calculated["overtime_minutes"],
        "status": _manual_status(calculated["status"], payload.adjustment_type),
        "source": "ADMIN_MANUAL",
        "is_manual": True,
        "adjustment_type": payload.adjustment_type,
        "manual_reason": payload.manual_reason,
        "note": payload.note,
        "created_by": current_user["id"],
        "updated_by": current_user["id"],
        "created_at": now,
        "updated_at": now
    }
    response = supabase.table("attendance").insert(_filter_attendance_payload(insert_data)).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo bản ghi chấm công.")

    attendance = response.data[0]
    _insert_attendance_audit_log({
        "attendance_id": attendance["id"],
        "action": "CREATE_MANUAL",
        "old_data": None,
        "new_data": attendance,
        "reason": payload.manual_reason,
        "changed_by": current_user["id"],
        "changed_at": now
    })
    _recalculate_draft_payrolls(payload.staff_id, payload.work_date)
    return attendance

@admin_router.get("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_admin_attendance_detail(id: str):
    response = supabase.table("attendance")\
        .select("*, branches(name)")\
        .eq("id", id)\
        .execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi chấm công.")
    records = _hydrate_attendance_staff([_format_admin_attendance(response.data[0])])
    return records[0]

@admin_router.put("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_admin_attendance(id: str, payload: AttendanceUpdatePayload, current_user: dict = Depends(get_current_user)):
    old_res = supabase.table("attendance").select("*").eq("id", id).execute()
    if not old_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi chấm công.")
    old_record = old_res.data[0]

    if current_user["role"] == "manager":
        branch_res = supabase.table("branches").select("id").eq("id", old_record.get("branch_id")).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Bạn không có quyền chỉnh sửa chấm công này.")

    work_date_value = date.fromisoformat(old_record["work_date"])
    check_in_at = payload.check_in_at if payload.check_in_at is not None else _parse_dt(old_record.get("check_in_at") or old_record.get("check_in_time"))
    check_out_at = payload.check_out_at if payload.check_out_at is not None else _parse_dt(old_record.get("check_out_at") or old_record.get("check_out_time"))
    break_minutes = payload.break_minutes if payload.break_minutes is not None else int(old_record.get("break_minutes") or 0)
    shift_start_time = payload.shift_start_time
    shift_end_time = payload.shift_end_time

    if shift_start_time is None and old_record.get("shift_start_time"):
        shift_start_time = time.fromisoformat(old_record["shift_start_time"])
    if shift_end_time is None and old_record.get("shift_end_time"):
        shift_end_time = time.fromisoformat(old_record["shift_end_time"])

    calculated = _calculate_attendance(work_date_value, check_in_at, check_out_at, shift_start_time, shift_end_time, break_minutes)
    _ensure_no_overlap(old_record["staff_id"], work_date_value, check_in_at, check_out_at, exclude_id=id)
    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "shift_id": payload.shift_id if payload.shift_id is not None else old_record.get("shift_id"),
        "shift_name": payload.shift_name if payload.shift_name is not None else old_record.get("shift_name"),
        "shift_start_time": shift_start_time.isoformat() if shift_start_time else None,
        "shift_end_time": shift_end_time.isoformat() if shift_end_time else None,
        "check_in_time": check_in_at.isoformat() if check_in_at else None,
        "check_out_time": check_out_at.isoformat() if check_out_at else None,
        "check_in_at": check_in_at.isoformat() if check_in_at else None,
        "check_out_at": check_out_at.isoformat() if check_out_at else None,
        "break_minutes": break_minutes,
        "total_hours": calculated["total_hours"],
        "late_minutes": calculated["late_minutes"],
        "early_leave_minutes": calculated["early_leave_minutes"],
        "overtime_minutes": calculated["overtime_minutes"],
        "status": _manual_status(calculated["status"], payload.adjustment_type or old_record.get("adjustment_type")),
        "source": "ADMIN_MANUAL",
        "is_manual": True,
        "adjustment_type": payload.adjustment_type or old_record.get("adjustment_type"),
        "manual_reason": payload.manual_reason,
        "note": payload.note if payload.note is not None else old_record.get("note"),
        "updated_by": current_user["id"],
        "updated_at": now
    }
    response = supabase.table("attendance").update(_filter_attendance_payload(update_data)).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể cập nhật bản ghi chấm công.")
    new_record = response.data[0]

    _insert_attendance_audit_log({
        "attendance_id": id,
        "action": "UPDATE_MANUAL",
        "old_data": old_record,
        "new_data": new_record,
        "reason": payload.manual_reason,
        "changed_by": current_user["id"],
        "changed_at": now
    })
    _recalculate_draft_payrolls(old_record["staff_id"], work_date_value)
    return new_record

@admin_router.get("/{id}/history", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_admin_attendance_history(id: str):
    if not has_table("attendance_audit_logs"):
        return []
    response = supabase.table("attendance_audit_logs")\
        .select("*, users!changed_by(full_name)")\
        .eq("attendance_id", id)\
        .order("changed_at", desc=True)\
        .execute()
    logs = []
    for row in (response.data or []):
        item = dict(row)
        item["changed_by_name"] = (row.get("users") or {}).get("full_name")
        item.pop("users", None)
        logs.append(item)
    return logs
