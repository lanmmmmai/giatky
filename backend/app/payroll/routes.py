from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import calendar
import logging

from app.common.dependencies import get_current_user, require_role
from app.database import supabase
from app.email.email_service import send_template_email

logger = logging.getLogger("app.payroll")
router = APIRouter(prefix="/payrolls", tags=["Payroll"])

class PayrollGenerateRequest(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020)
    branch_id: str
    staff_id: Optional[str] = None

@router.get("")
def get_payrolls(
    month: Optional[int] = None,
    year: Optional[int] = None,
    branch_id: Optional[str] = None,
    staff_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List payroll records.
    Admin sees all.
    Manager sees payroll for their branches.
    Staff sees only their own payroll.
    """
    role = current_user["role"]
    query = supabase.table("payrolls").select("*, branches(name), users!staff_id(full_name, username, hourly_rate)").order("year", desc=True).order("month", desc=True)
    
    if role == "manager":
        # Get manager's branches
        branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
        m_branch_ids = [b["id"] for b in (branch_res.data or [])]
        if not m_branch_ids:
            return []
        query = query.in_("branch_id", m_branch_ids)
        
    elif role == "staff":
        query = query.eq("staff_id", current_user["id"])
        
    # Filters
    if month:
        query = query.eq("month", month)
    if year:
        query = query.eq("year", year)
    if branch_id and role in ["admin", "manager"]:
        query = query.eq("branch_id", branch_id)
    if staff_id and role in ["admin", "manager"]:
        query = query.eq("staff_id", staff_id)
        
    response = query.execute()
    
    # Format response
    formatted = []
    for pr in (response.data or []):
        b_name = pr.get("branches", {}).get("name") if pr.get("branches") else None
        staff_name = pr.get("users", {}).get("full_name") if pr.get("users") else None
        staff_username = pr.get("users", {}).get("username") if pr.get("users") else None
        
        pr_copy = dict(pr)
        pr_copy["branch_name"] = b_name
        pr_copy["staff_name"] = staff_name
        pr_copy["staff_username"] = staff_username
        
        if "branches" in pr_copy: del pr_copy["branches"]
        if "users" in pr_copy: del pr_copy["users"]
        
        formatted.append(pr_copy)
        
    return formatted

@router.post("/generate", dependencies=[Depends(require_role(["admin", "manager"]))])
def generate_payroll(payload: PayrollGenerateRequest, current_user: dict = Depends(get_current_user)):
    """Generate or regenerate draft payroll for all staff in a branch for a given month/year."""
    # If manager, verify access to branch
    if current_user["role"] == "manager":
        branch_res = supabase.table("branches").select("id").eq("id", payload.branch_id).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Bạn không quản lý cơ sở này.")
            
    # Calculate dates
    last_day = calendar.monthrange(payload.year, payload.month)[1]
    start_date = f"{payload.year}-{payload.month:02d}-01"
    end_date = f"{payload.year}-{payload.month:02d}-{last_day}"

    # Single-staff generation: compute payroll for exactly the selected employee
    if payload.staff_id:
        staff_res = supabase.table("users").select("id, full_name, hourly_rate, role, branch_id")\
            .eq("id", payload.staff_id).execute()
        if not staff_res.data:
            raise HTTPException(status_code=404, detail="Không tìm thấy nhân viên.")
        staff = staff_res.data[0]

        if staff["role"] != "staff":
            raise HTTPException(status_code=400, detail="Chỉ có thể tính lương cho tài khoản nhân viên (staff).")
        if staff.get("branch_id") != payload.branch_id:
            raise HTTPException(status_code=400, detail="Nhân viên không thuộc chi nhánh đã chọn.")

        # Duplicate guard: one payroll per staff + month + year + branch
        dup_res = supabase.table("payrolls").select("id")\
            .eq("staff_id", staff["id"])\
            .eq("month", payload.month)\
            .eq("year", payload.year)\
            .eq("branch_id", payload.branch_id)\
            .execute()
        if dup_res.data:
            raise HTTPException(status_code=400, detail="Bảng lương của nhân viên này trong tháng đã tồn tại.")

        # Real attendance data for the selected month
        att_res = supabase.table("attendance").select("total_hours, work_minutes")\
            .eq("staff_id", staff["id"])\
            .in_("status", ["completed", "on_time", "late", "early_leave", "manual_adjusted"])\
            .gte("work_date", start_date)\
            .lte("work_date", end_date)\
            .execute()
        att_rows = att_res.data or []
        if not att_rows:
            raise HTTPException(status_code=400, detail="Nhân viên chưa có dữ liệu chấm công trong tháng này.")

        total_hours = sum((float(a.get("work_minutes") or 0) / 60) if a.get("work_minutes") is not None else float(a.get("total_hours") or 0) for a in att_rows)
        hourly_rate = staff["hourly_rate"] or 0
        insert_data = {
            "staff_id": staff["id"],
            "branch_id": payload.branch_id,
            "month": payload.month,
            "year": payload.year,
            "hourly_rate_snapshot": hourly_rate,
            "total_hours": total_hours,
            "total_salary": int(total_hours * hourly_rate),
            "generated_by": current_user["id"],
            "status": "draft"
        }
        res = supabase.table("payrolls").insert(insert_data).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Không thể tạo bảng lương.")
        return {
            "message": f"Đã tạo bảng lương nháp cho {staff['full_name']} ({total_hours:g} giờ).",
            "payrolls": res.data
        }

    # 1. Fetch all staff in the branch
    staff_res = supabase.table("users").select("id, full_name, hourly_rate").eq("branch_id", payload.branch_id).eq("role", "staff").execute()
    staff_members = staff_res.data or []

    if not staff_members:
        return {"message": "Không có nhân viên nào thuộc chi nhánh này để tính lương."}
        
    # Delete existing drafts for this month/year and branch to prevent duplicate
    supabase.table("payrolls")\
        .delete()\
        .eq("month", payload.month)\
        .eq("year", payload.year)\
        .eq("branch_id", payload.branch_id)\
        .eq("status", "draft")\
        .execute()
        
    payrolls_created = []
    
    for staff in staff_members:
        # Sum completed attendance total_hours in this date range
        att_res = supabase.table("attendance")\
            .select("total_hours, work_minutes")\
            .eq("staff_id", staff["id"])\
            .in_("status", ["completed", "on_time", "late", "early_leave", "manual_adjusted"])\
            .gte("work_date", start_date)\
            .lte("work_date", end_date)\
            .execute()
            
        total_hours = sum((float(a.get("work_minutes") or 0) / 60) if a.get("work_minutes") is not None else float(a.get("total_hours") or 0) for a in (att_res.data or []))
        
        # Calculate salary
        hourly_rate = staff["hourly_rate"] or 0
        total_salary = int(total_hours * hourly_rate)
        
        # Check if confirmed/paid record exists
        lock_res = supabase.table("payrolls")\
            .select("id")\
            .eq("staff_id", staff["id"])\
            .eq("month", payload.month)\
            .eq("year", payload.year)\
            .in_("status", ["confirmed", "paid"])\
            .execute()
            
        if lock_res.data:
            # Skip if confirmed or paid already (salary locked)
            continue
            
        insert_data = {
            "staff_id": staff["id"],
            "branch_id": payload.branch_id,
            "month": payload.month,
            "year": payload.year,
            "hourly_rate_snapshot": hourly_rate,
            "total_hours": total_hours,
            "total_salary": total_salary,
            "generated_by": current_user["id"],
            "status": "draft"
        }
        
        res = supabase.table("payrolls").insert(insert_data).execute()
        if res.data:
            payrolls_created.append(res.data[0])
            
    return {
        "message": f"Tính lương thành công. Đã tạo {len(payrolls_created)} bảng lương nháp.",
        "payrolls": payrolls_created
    }

@router.patch("/{id}/confirm", dependencies=[Depends(require_role(["admin", "manager"]))])
def confirm_payroll(id: str, current_user: dict = Depends(get_current_user)):
    """Confirm a draft payroll and send email details to the staff."""
    # Fetch payroll
    pr_res = supabase.table("payrolls").select("*, users!staff_id(full_name, email)").eq("id", id).execute()
    if not pr_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bảng lương.")
        
    payroll = pr_res.data[0]
    if payroll["status"] != "draft":
        return {"message": "Bảng lương đã được xác nhận trước đó.", "payroll": payroll}
        
    # If manager, check branch access
    if current_user["role"] == "manager":
        chk = supabase.table("branches").select("id").eq("id", payroll["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không có quyền xác nhận bảng lương của chi nhánh khác.")
            
    response = supabase.table("payrolls").update({"status": "confirmed"}).eq("id", id).execute()
    confirmed_payroll = response.data[0]
    
    # Send email notification
    staff_user = payroll.get("users", {})
    if staff_user and staff_user.get("email"):
        try:
            send_template_email(
                to_email=staff_user["email"],
                template_type="payroll",
                template_data={
                    "full_name": staff_user["full_name"],
                    "month": payroll["month"],
                    "year": payroll["year"],
                    "total_hours": payroll["total_hours"],
                    "hourly_rate": "{:,}".format(payroll["hourly_rate_snapshot"]),
                    "total_salary": "{:,}".format(payroll["total_salary"]),
                    "status": "Đã xác nhận (Chờ thanh toán)"
                },
                sent_by=current_user["id"]
            )
        except Exception as e:
            logger.error(f"Failed to send payroll confirmation email: {str(e)}")
        
    # Trigger system notification
    try:
        supabase.table("notifications").insert({
            "title": "Bảng lương được xác nhận",
            "content": f"Bảng lương tháng {payroll['month']}/{payroll['year']} của bạn đã được xác nhận.",
            "type": "payroll",
            "sender_id": current_user["id"],
            "target_user_id": payroll["staff_id"]
        }).execute()
    except Exception as e:
        logger.error(f"Failed to create payroll notification: {str(e)}")
        
    return confirmed_payroll

@router.patch("/{id}/paid", dependencies=[Depends(require_role(["admin", "manager"]))])
def mark_payroll_paid(id: str, current_user: dict = Depends(get_current_user)):
    """Mark a confirmed payroll as paid."""
    pr_res = supabase.table("payrolls").select("*").eq("id", id).execute()
    if not pr_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bảng lương.")
        
    payroll = pr_res.data[0]
    if payroll["status"] == "paid":
        return {"message": "Bảng lương đã thanh toán.", "payroll": payroll}
        
    # If manager, check branch access
    if current_user["role"] == "manager":
        chk = supabase.table("branches").select("id").eq("id", payroll["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không có quyền thanh toán bảng lương của chi nhánh khác.")
            
    response = supabase.table("payrolls").update({"status": "paid"}).eq("id", id).execute()
    paid_payroll = response.data[0]
    
    # Trigger system notification
    try:
        supabase.table("notifications").insert({
            "title": "Đã chi trả lương",
            "content": f"Lương tháng {payroll['month']}/{payroll['year']} của bạn đã được chi trả.",
            "type": "payroll",
            "sender_id": current_user["id"],
            "target_user_id": payroll["staff_id"]
        }).execute()
    except Exception as e:
        logger.error(f"Failed to create payroll notification: {str(e)}")
        
    return paid_payroll

@router.get("/me")
def get_my_payroll(current_user: dict = Depends(get_current_user)):
    """Get history for the currently logged in staff."""
    response = supabase.table("payrolls").select("*, branches(name)")\
        .eq("staff_id", current_user["id"])\
        .order("year", desc=True)\
        .order("month", desc=True)\
        .execute()
        
    formatted = []
    for pr in (response.data or []):
        b_name = pr.get("branches", {}).get("name") if pr.get("branches") else None
        pr_copy = dict(pr)
        pr_copy["branch_name"] = b_name
        if "branches" in pr_copy: del pr_copy["branches"]
        formatted.append(pr_copy)
        
    return formatted
