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
    password: str
    phone: Optional[str] = None
    branch_id: Optional[str] = None
    branch_ids: List[str] = Field(default_factory=list)
    hourly_rate: int = Field(..., gt=0)
    manager_id: Optional[str] = None

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    hourly_rate: Optional[int] = None
    branch_id: Optional[str] = None
    branch_ids: Optional[List[str]] = None
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
    
    select_fields = (
        "id,full_name,email,username,avatar_url,phone,role,status,hourly_rate,"
        "branch_id,manager_id,created_by,email_verified_at,last_login_at,created_at,updated_at,"
        "branches!fk_users_branch(name)"
    )
    try:
        if role == "admin":
            response = supabase.table("users").select(select_fields).order("created_at", desc=True).execute()
            users_data = response.data or []
            
        elif role == "manager":
            # Get branches managed by this manager
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            branch_ids = [b["id"] for b in (branch_res.data or [])]
            
            if not branch_ids:
                # Still check if they are explicitly assigned to this manager via manager_id
                response = supabase.table("users").select(select_fields).eq("manager_id", current_user["id"]).order("created_at", desc=True).execute()
                users_data = response.data or []
            else:
                # Get users belonging to those branches, or having this manager as manager_id
                # Wrap branch ids in brackets for postgres array
                branch_list_str = ",".join(branch_ids)
                response = supabase.table("users").select(select_fields).or_(f"branch_id.in.({branch_list_str}),manager_id.eq.{current_user['id']}").order("created_at", desc=True).execute()
                users_data = response.data or []
            
        else:
            # Staff can only view their own user profile
            response = supabase.table("users").select(select_fields).eq("id", current_user["id"]).execute()
            users_data = response.data or []
            
        if users_data:
            user_ids = [u["id"] for u in users_data]
            ub_data = []
            for i in range(0, len(user_ids), 100):
                chunk = user_ids[i:i+100]
                ub_res = supabase.table("user_branches").select("user_id, branch_id, branches(name)").in_("user_id", chunk).execute()
                if ub_res.data:
                    ub_data.extend(ub_res.data)
            
            # Map user_id to assigned branches list
            ub_map = {}
            for ub in ub_data:
                u_id = ub["user_id"]
                b_id = ub["branch_id"]
                b_name = ub["branches"]["name"] if ub.get("branches") else "N/A"
                if u_id not in ub_map:
                    ub_map[u_id] = []
                ub_map[u_id].append({
                    "branch_id": b_id,
                    "branch_name": b_name
                })
                
            for u in users_data:
                u["assigned_branches"] = ub_map.get(u["id"], [])
                
        return users_data
    except Exception as e:
        print("GET /users failed:", repr(e))
        logger.error(f"Error fetching users: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Không thể tải danh sách tài khoản: {str(e)}"
        )

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
        "branch_id": None,
        "hourly_rate": 0,
        "created_by": current_user["id"],
        "verification_token": verification_token
    }
    
    response = supabase.table("users").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản Manager.")
        
    new_user = response.data[0]
    
    # Send verification email
    verify_link = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    email_sent = send_template_email(
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
        "temporary_password": raw_password,
        "email_sent": email_sent
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

    # Parse branch_ids
    branch_ids = payload.branch_ids or []
    if not branch_ids and payload.branch_id:
        branch_ids = [payload.branch_id]

    if not branch_ids:
        raise HTTPException(status_code=400, detail="Vui lòng chọn ít nhất một cơ sở làm việc.")

    # If manager is creating staff, verify branch belongs to them
    if current_user["role"] == "manager":
        for b_id in branch_ids:
            branch_res = supabase.table("branches").select("id").eq("id", b_id).eq("manager_id", current_user["id"]).execute()
            if not branch_res.data:
                raise HTTPException(status_code=403, detail="Bạn không thể tạo nhân viên cho cơ sở không thuộc quyền quản lý của mình.")

    pwd_hash = hash_password(payload.password)
    verification_token = str(uuid.uuid4())
    
    # Store first branch in branch_id for backward compatibility
    first_branch_id = branch_ids[0] if branch_ids else None
    
    insert_data = {
        "full_name": payload.full_name,
        "email": payload.email,
        "username": payload.username,
        "password_hash": pwd_hash,
        "role": "staff",
        "status": "pending_verification",
        "phone": payload.phone,
        "branch_id": first_branch_id,
        "hourly_rate": payload.hourly_rate,
        "manager_id": current_user["id"] if current_user["role"] == "manager" else payload.manager_id,
        "created_by": current_user["id"],
        "verification_token": verification_token
    }
    
    response = supabase.table("users").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản Staff.")
        
    new_user = response.data[0]
    
    # Insert assignments to user_branches
    ub_inserts = [
        {
            "user_id": new_user["id"],
            "branch_id": b_id,
            "assigned_by": current_user["id"]
        }
        for b_id in branch_ids
    ]
    supabase.table("user_branches").insert(ub_inserts).execute()
    
    # Send verification email
    verify_link = f"{settings.FRONTEND_URL}/verify-email?token={verification_token}"
    email_sent = send_template_email(
        to_email=new_user["email"],
        template_type="verify_account",
        template_data={
            "full_name": new_user["full_name"],
            "role": "STAFF",
            "verify_link": verify_link
        },
        sent_by=current_user["id"]
    )
    
    logger.info(f"Created staff {new_user['email']} with password: {payload.password}")
    return {
        "user": new_user,
        "temporary_password": payload.password,
        "email_sent": email_sent
    }

@router.get("/{id}")
def get_user_detail(id: str, current_user: dict = Depends(get_current_user)):
    # Staff can only view themselves
    if current_user["role"] == "staff" and current_user["id"] != id:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập.")
        
    response = supabase.table("users").select("*, branches(name)").eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
        
    user_rec = response.data[0]
    
    # Fetch assigned branches
    ub_res = supabase.table("user_branches").select("branch_id, branches(name)").eq("user_id", id).execute()
    assigned = []
    for ub in (ub_res.data or []):
        b_id = ub["branch_id"]
        b_name = ub["branches"]["name"] if ub.get("branches") else "N/A"
        assigned.append({
            "branch_id": b_id,
            "branch_name": b_name
        })
    user_rec["assigned_branches"] = assigned
    
    return user_rec

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
            
        # Verify manager owns target staff (either manager_id match, or manager owns their branch_id, or manager owns one of their assigned branches)
        authorized = False
        if target_user.get("manager_id") == current_user["id"]:
            authorized = True
        elif target_user.get("branch_id"):
            branch_res = supabase.table("branches").select("id").eq("id", target_user["branch_id"]).eq("manager_id", current_user["id"]).execute()
            if branch_res.data:
                authorized = True
                
        if not authorized:
            # Check user_branches table
            ub_check = supabase.table("user_branches").select("branch_id").eq("user_id", id).execute()
            b_ids = [ub["branch_id"] for ub in (ub_check.data or [])]
            if b_ids:
                mgr_branch_res = supabase.table("branches").select("id").in_("id", b_ids).eq("manager_id", current_user["id"]).execute()
                if mgr_branch_res.data:
                    authorized = True
                    
        if not authorized:
            raise HTTPException(status_code=403, detail="Tài khoản này không thuộc quyền quản lý của bạn.")
            
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    else: # admin
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        
    if target_user["role"] == "manager":
        update_data["branch_id"] = None
        update_data["hourly_rate"] = 0

    # Pop branch_ids from update_data before saving to users table
    branch_ids = update_data.pop("branch_ids", None)
    
    # Store first branch in branch_id for backward compatibility if branch_ids is modified
    if branch_ids is not None:
        update_data["branch_id"] = branch_ids[0] if branch_ids else None

    if not update_data and branch_ids is None:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    if update_data:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        response = supabase.table("users").update(update_data).eq("id", id).execute()
        if not response.data:
            raise HTTPException(status_code=500, detail="Cập nhật thông tin thất bại.")
        updated_user = response.data[0]
    else:
        updated_user = target_user

    # Update user_branches table if branch_ids list was supplied
    if branch_ids is not None:
        # First delete all current assignments
        supabase.table("user_branches").delete().eq("user_id", id).execute()
        # Then insert the new ones
        if branch_ids:
            ub_inserts = [
                {
                    "user_id": id,
                    "branch_id": b_id,
                    "assigned_by": current_user["id"]
                }
                for b_id in branch_ids
            ]
            supabase.table("user_branches").insert(ub_inserts).execute()
            
        # Re-fetch the updated assigned branches to return in the response
        ub_res = supabase.table("user_branches").select("branch_id, branches(name)").eq("user_id", id).execute()
        assigned = []
        for ub in (ub_res.data or []):
            b_id = ub["branch_id"]
            b_name = ub["branches"]["name"] if ub.get("branches") else "N/A"
            assigned.append({
                "branch_id": b_id,
                "branch_name": b_name
            })
        updated_user["assigned_branches"] = assigned
    else:
        # Fetch current assigned branches
        ub_res = supabase.table("user_branches").select("branch_id, branches(name)").eq("user_id", id).execute()
        assigned = []
        for ub in (ub_res.data or []):
            b_id = ub["branch_id"]
            b_name = ub["branches"]["name"] if ub.get("branches") else "N/A"
            assigned.append({
                "branch_id": b_id,
                "branch_name": b_name
            })
        updated_user["assigned_branches"] = assigned

    return updated_user

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
