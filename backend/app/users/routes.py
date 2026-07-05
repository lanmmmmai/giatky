from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
import uuid
import logging
from datetime import datetime

from app.common.dependencies import get_current_user, require_role
from app.common.security import hash_password
from app.database import supabase
from app.config import settings
from app.email.email_service import send_template_email

logger = logging.getLogger("app.users")
router = APIRouter(prefix="/users", tags=["Users & Staff Management"])

class ManagerCreate(BaseModel):
    full_name: str
    email: EmailStr
    username: str
    password: Optional[str] = None
    phone: Optional[str] = None
    branch_id: Optional[str] = None
    hourly_rate: Optional[int] = 0

class StaffCreate(BaseModel):
    full_name: str
    email: EmailStr
    username: str
    password: Optional[str] = None
    phone: Optional[str] = None
    branch_id: str
    hourly_rate: Optional[int] = 0
    manager_id: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    hourly_rate: Optional[int] = None
    branch_id: Optional[str] = None
    manager_id: Optional[str] = None
    avatar_url: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|pending_verification|blocked)$")

@router.get("")
def get_users(current_user: dict = Depends(get_current_user)):
    """List users based on current user's role.
    Admin gets all managers and staff.
    Manager gets staff belonging to their branches.
    Staff gets only themselves.
    """
    role = current_user["role"]
    
    if role == "admin":
        response = supabase.table("users").select("*, branches(name)").order("created_at", desc=True).execute()
        return response.data or []
        
    elif role == "manager":
        # Get branches managed by this manager
        branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
        branch_ids = [b["id"] for b in (branch_res.data or [])]
        
        if not branch_ids:
            return []
            
        # Get users belonging to those branches
        response = supabase.table("users").select("*, branches(name)").in_("branch_id", branch_ids).order("created_at", desc=True).execute()
        return response.data or []
        
    else:
        # Staff can only view their own user profile
        response = supabase.table("users").select("*, branches(name)").eq("id", current_user["id"]).execute()
        return response.data or []

@router.post("/manager", dependencies=[Depends(require_role(["admin"]))])
def create_manager(payload: ManagerCreate, current_user: dict = Depends(get_current_user)):
    # Check duplicate
    email_check = supabase.table("users").select("id").eq("email", payload.email).execute()
    if email_check.data:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
    user_check = supabase.table("users").select("id").eq("username", payload.username).execute()
    if user_check.data:
        raise HTTPException(status_code=400, detail="Tên đăng nhập này đã tồn tại.")

    # Password generation
    raw_password = payload.password or f"LS@{str(uuid.uuid4())[:8]}"
    pwd_hash = hash_password(raw_password)
    
    verification_token = str(uuid.uuid4())
    
    insert_data = {
        "full_name": payload.full_name,
        "email": payload.email,
        "username": payload.username,
        "password_hash": pwd_hash,
        "role": "manager",
        "status": "pending_verification",
        "phone": payload.phone,
        "branch_id": payload.branch_id,
        "hourly_rate": payload.hourly_rate,
        "created_by": current_user["id"],
        "verification_token": verification_token
    }
    
    response = supabase.table("users").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản Manager.")
        
    new_user = response.data[0]
    
    # Send verification email
    verify_link = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    send_template_email(
        to_email=new_user["email"],
        template_type="verify_account",
        template_data={
            "full_name": new_user["full_name"],
            "role": "MANAGER",
            "verify_link": verify_link
        },
        sent_by=current_user["id"]
    )
    
    # Print random password to logs for local developer ease
    logger.info(f"Created manager {new_user['email']} with temp password: {raw_password}")
    
    return {
        "user": new_user,
        "temporary_password": raw_password
    }

@router.post("/staff", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_staff(payload: StaffCreate, current_user: dict = Depends(get_current_user)):
    # Check duplicate
    email_check = supabase.table("users").select("id").eq("email", payload.email).execute()
    if email_check.data:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
    user_check = supabase.table("users").select("id").eq("username", payload.username).execute()
    if user_check.data:
        raise HTTPException(status_code=400, detail="Tên đăng nhập này đã tồn tại.")

    # If manager is creating staff, verify branch belongs to them
    if current_user["role"] == "manager":
        branch_res = supabase.table("branches").select("id").eq("id", payload.branch_id).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Bạn không thể tạo nhân viên cho cơ sở không thuộc quyền quản lý của mình.")

    raw_password = payload.password or f"LS@{str(uuid.uuid4())[:8]}"
    pwd_hash = hash_password(raw_password)
    
    verification_token = str(uuid.uuid4())
    
    insert_data = {
        "full_name": payload.full_name,
        "email": payload.email,
        "username": payload.username,
        "password_hash": pwd_hash,
        "role": "staff",
        "status": "pending_verification",
        "phone": payload.phone,
        "branch_id": payload.branch_id,
        "hourly_rate": payload.hourly_rate,
        "manager_id": payload.manager_id or (current_user["id"] if current_user["role"] == "manager" else None),
        "created_by": current_user["id"],
        "verification_token": verification_token
    }
    
    response = supabase.table("users").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản Staff.")
        
    new_user = response.data[0]
    
    # Send verification email
    verify_link = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    send_template_email(
        to_email=new_user["email"],
        template_type="verify_account",
        template_data={
            "full_name": new_user["full_name"],
            "role": "STAFF",
            "verify_link": verify_link
        },
        sent_by=current_user["id"]
    )
    
    logger.info(f"Created staff {new_user['email']} with temp password: {raw_password}")
    
    return {
        "user": new_user,
        "temporary_password": raw_password
    }

@router.get("/{id}")
def get_user_detail(id: str, current_user: dict = Depends(get_current_user)):
    # Staff can only view themselves
    if current_user["role"] == "staff" and current_user["id"] != id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập.")
        
    response = supabase.table("users").select("*, branches(name)").eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    return response.data[0]

@router.put("/{id}")
def update_user(id: str, payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    # Access checks:
    # 1. Staff can only update their own profile (name, phone, avatar) - NOT hourly_rate or branch_id
    # 2. Manager can update Staff in their branch (but cannot update Admin or other Managers)
    # 3. Admin can update everything.
    
    target_res = supabase.table("users").select("*").eq("id", id).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    target_user = target_res.data[0]
    
    if current_user["role"] == "staff":
        if current_user["id"] != id:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật tài khoản người khác.")
        # Restrict parameters
        update_data = {
            "full_name": payload.full_name or target_user["full_name"],
            "phone": payload.phone or target_user["phone"],
            "avatar_url": payload.avatar_url or target_user["avatar_url"]
        }
    elif current_user["role"] == "manager":
        # Check if target is a staff and belongs to manager's branch
        if target_user["role"] != "staff":
            raise HTTPException(status_code=403, detail="Manager chỉ có quyền chỉnh sửa tài khoản Staff.")
            
        # Verify manager owns target's branch
        branch_res = supabase.table("branches").select("id").eq("id", target_user["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Tài khoản này thuộc cơ sở ngoài tầm quản lý của bạn.")
            
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    else: # admin
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    update_data["updated_at"] = datetime.utcnow().isoformat()
    response = supabase.table("users").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Cập nhật thông tin thất bại.")
    return response.data[0]

@router.patch("/{id}/status", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_user_status(id: str, payload: StatusUpdate, current_user: dict = Depends(get_current_user)):
    target_res = supabase.table("users").select("*").eq("id", id).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    target_user = target_res.data[0]
    
    if target_user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Không thể thay đổi trạng thái của tài khoản Admin.")
        
    if current_user["role"] == "manager":
        # Check if target is staff and under manager's branch
        if target_user["role"] != "staff":
            raise HTTPException(status_code=403, detail="Manager chỉ có quyền khóa/mở tài khoản Staff.")
            
        branch_res = supabase.table("branches").select("id").eq("id", target_user["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Tài khoản này thuộc cơ sở ngoài tầm quản lý của bạn.")

    response = supabase.table("users").update({"status": payload.status, "updated_at": datetime.utcnow().isoformat()}).eq("id", id).execute()
    return response.data[0]

@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def delete_user(id: str, current_user: dict = Depends(get_current_user)):
    target_res = supabase.table("users").select("*").eq("id", id).execute()
    if not target_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    target_user = target_res.data[0]
    
    if target_user["role"] == "admin":
        raise HTTPException(status_code=400, detail="Không thể xóa tài khoản Admin.")
        
    if current_user["role"] == "manager":
        if target_user["role"] != "staff":
            raise HTTPException(status_code=403, detail="Không thể xóa tài khoản Quản lý khác hoặc Admin.")
            
        branch_res = supabase.table("branches").select("id").eq("id", target_user["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(status_code=403, detail="Không có quyền xóa tài khoản của cơ sở khác.")
            
    # Check if there are orders or attendances
    orders_check = supabase.table("orders").select("id").eq("created_by_staff_id", id).execute()
    attendance_check = supabase.table("attendance").select("id").eq("staff_id", id).execute()
    
    if orders_check.data or attendance_check.data:
        # Instead of deleting, block/disable user to preserve historical integrity
        supabase.table("users").update({"status": "blocked", "updated_at": datetime.utcnow().isoformat()}).eq("id", id).execute()
        return {"message": "Tài khoản có dữ liệu hoạt động. Hệ thống đã tự động khóa tài khoản thay vì xóa hoàn toàn."}
        
    response = supabase.table("users").delete().eq("id", id).execute()
    return {"message": "Xóa tài khoản thành công."}
