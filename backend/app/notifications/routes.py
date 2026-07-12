from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import logging

from app.common.dependencies import get_current_user, require_role
from app.database import supabase
from app.email.email_service import send_template_email

logger = logging.getLogger("app.notifications")
router = APIRouter(prefix="/notifications", tags=["Notifications"])

class NotificationCreate(BaseModel):
    title: str
    content: str
    type: str # order | system | payroll | announcement | chat
    target_role: Optional[str] = None # admin | manager | staff | None (all)
    target_user_id: Optional[str] = None
    branch_id: Optional[str] = None
    send_email: bool = False

@router.get("")
def get_my_notifications(current_user: dict = Depends(get_current_user)):
    """Retrieve notifications targeting this user, their role, or branch."""
    role = current_user["role"]
    user_id = current_user["id"]
    branch_id = current_user.get("branch_id")
    
    # Query all notifications that are:
    # 1. Global (target_role, target_user_id, branch_id are all NULL)
    # 2. Targeted to role (target_role = role)
    # 3. Targeted to specific user (target_user_id = user_id)
    # 4. Targeted to branch (branch_id = branch_id)
    
    # We can fetch notifications and filter them locally or build a query
    # To keep it simple, query notifications from last 30 days and filter locally
    thirty_days_ago = (datetime.utcnow() - timedelta(days=30)).isoformat()
    response = supabase.table("notifications").select("*").gte("created_at", thirty_days_ago).order("created_at", desc=True).execute()
    all_notifs = response.data or []
    
    # Fetch read notifications for this user
    read_res = supabase.table("notification_reads").select("notification_id").eq("user_id", user_id).execute()
    read_ids = {r["notification_id"] for r in (read_res.data or [])}
    
    filtered_notifs = []
    for n in all_notifs:
        is_target = False
        
        # Check global
        if not n["target_role"] and not n["target_user_id"] and not n["branch_id"]:
            is_target = True
        # Check role
        elif n["target_role"] == role:
            is_target = True
        # Check user
        elif n["target_user_id"] == user_id:
            is_target = True
        # Check branch
        elif branch_id and n["branch_id"] == branch_id:
            is_target = True
            
        if is_target:
            n_copy = dict(n)
            n_copy["is_read"] = n["id"] in read_ids
            filtered_notifs.append(n_copy)
            
    return filtered_notifs

@router.post("", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_notification(payload: NotificationCreate, current_user: dict = Depends(get_current_user)):
    """Send notifications to users, roles, or branches."""
    # Manager can only notify their own branch staff
    if current_user["role"] == "manager":
        if payload.branch_id:
            # Check manager manages this branch
            chk = supabase.table("branches").select("id").eq("id", payload.branch_id).eq("manager_id", current_user["id"]).execute()
            if not chk.data:
                raise HTTPException(status_code=403, detail="Bạn không thể gửi thông báo cho chi nhánh khác.")
        else:
            raise HTTPException(status_code=400, detail="Quản lý bắt buộc phải chọn chi nhánh gửi đến.")

    insert_data = payload.model_dump()
    insert_data["sender_id"] = current_user["id"]
    
    response = supabase.table("notifications").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo thông báo.")
        
    created_notif = response.data[0]
    
    # Handle send_email
    if payload.send_email:
        # Determine emails to send
        emails_to_send = []
        
        if payload.target_user_id:
            u_res = supabase.table("users").select("email, full_name").eq("id", payload.target_user_id).execute()
            if u_res.data:
                emails_to_send.append(u_res.data[0])
        else:
            # Query multiple users
            u_query = supabase.table("users").select("email, full_name").eq("status", "active")
            if payload.branch_id:
                u_query = u_query.eq("branch_id", payload.branch_id)
            if payload.target_role:
                u_query = u_query.eq("role", payload.target_role)
                
            u_res = u_query.execute()
            emails_to_send = u_res.data or []
            
        for user in emails_to_send:
            try:
                send_template_email(
                    to_email=user["email"],
                    template_type="announcement",
                    template_data={
                        "title": payload.title,
                        "content": payload.content
                    },
                    sent_by=current_user["id"]
                )
            except Exception as e:
                logger.error(f"Failed to send announcement email to {user['email']}: {str(e)}")
            
    return created_notif

@router.patch("/{id}/read")
def mark_as_read(id: str, current_user: dict = Depends(get_current_user)):
    """Mark a notification as read for current user."""
    user_id = current_user["id"]
    
    # Check if already read
    chk = supabase.table("notification_reads").select("id").eq("notification_id", id).eq("user_id", user_id).execute()
    if chk.data:
        return {"message": "Thông báo đã đọc."}
        
    response = supabase.table("notification_reads").insert({
        "notification_id": id,
        "user_id": user_id
    }).execute()
    
    return {"message": "Đã đánh dấu đọc."}

@router.patch("/read-all")
def mark_all_as_read(current_user: dict = Depends(get_current_user)):
    """Mark all eligible notifications as read for current user."""
    notifs = get_my_notifications(current_user)
    user_id = current_user["id"]
    
    to_insert = []
    for n in notifs:
        if not n["is_read"]:
            to_insert.append({
                "notification_id": n["id"],
                "user_id": user_id
            })
            
    if to_insert:
        supabase.table("notification_reads").insert(to_insert).execute()
        
    return {"message": "Đã đánh dấu đọc tất cả thông báo."}
