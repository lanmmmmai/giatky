from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date, timezone
import logging

from app.common.dependencies import get_current_user, require_role
from app.database import supabase

logger = logging.getLogger("app.attendance")
router = APIRouter(prefix="/attendance", tags=["Attendance"])

class AttendanceCheckIn(BaseModel):
    note: Optional[str] = None

class AttendanceCheckOut(BaseModel):
    note: Optional[str] = None

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

    # One check-in record per staff per day
    today_res = supabase.table("attendance").select("id")\
        .eq("staff_id", staff_id)\
        .eq("work_date", date.today().isoformat())\
        .execute()

    if today_res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn đã chấm công hôm nay. Mỗi ngày chỉ chấm công một lần."
        )

    now = datetime.now(timezone.utc)
    insert_data = {
        "staff_id": staff_id,
        "branch_id": branch_id,
        "work_date": date.today().isoformat(),
        "check_in_time": now.isoformat(),
        "status": "checked_in",
        "note": payload.note
    }
    
    response = supabase.table("attendance").insert(insert_data).execute()
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
    check_in_time = datetime.fromisoformat(record["check_in_time"].replace("Z", "+00:00"))
    delta = now - check_in_time
    total_seconds = delta.total_seconds()
    
    # Standard hour calculation (rounded to 2 decimal places)
    total_hours = round(max(0.0, total_seconds / 3600.0), 2)
    
    update_data = {
        "check_out_time": now.isoformat(),
        "total_hours": total_hours,
        "status": "completed",
        "note": payload.note if payload.note else record["note"],
        "updated_at": now.isoformat()
    }
    
    response = supabase.table("attendance").update(update_data).eq("id", record["id"]).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể ghi nhận check-out.")
        
    return response.data[0]

@router.get("/me")
def get_my_attendance(current_user: dict = Depends(get_current_user)):
    """Get history of current user."""
    response = supabase.table("attendance").select("*, branches(name)")\
        .eq("staff_id", current_user["id"])\
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
    query = supabase.table("attendance").select("*, branches(name), users!staff_id(full_name, role)").order("check_in_time", desc=True)
    
    if role == "manager":
        # Get manager's branches
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
        staff_name = att.get("users", {}).get("full_name") if att.get("users") else None
        
        att_copy = dict(att)
        att_copy["branch_name"] = b_name
        att_copy["staff_name"] = staff_name
        
        if "branches" in att_copy: del att_copy["branches"]
        if "users" in att_copy: del att_copy["users"]
        
        formatted.append(att_copy)
        
    return formatted

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
        .eq("status", "completed")\
        .gte("work_date", start_of_month)\
        .execute()
        
    total_hours_month = sum(float(att["total_hours"]) for att in (history_res.data or []))
    
    # 3. Today's hours
    today_history_res = supabase.table("attendance").select("total_hours")\
        .eq("staff_id", staff_id)\
        .eq("status", "completed")\
        .eq("work_date", today.isoformat())\
        .execute()
    total_hours_today = sum(float(att["total_hours"]) for att in (today_history_res.data or []))
    
    return {
        "status": current_status,
        "current_shift": current_shift,
        "total_hours_today": total_hours_today,
        "total_hours_month": total_hours_month
    }
