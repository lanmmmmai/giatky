from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
import uuid

from app.common.dependencies import get_current_user, require_role, require_branch_access
from app.database import supabase

router = APIRouter(prefix="/branches", tags=["Branches"])

class BranchCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    manager_id: Optional[str] = None
    status: Optional[str] = None

@router.get("/public")
def get_public_branches():
    """Public branch list used by unauthenticated staff shift requests."""
    response = supabase.table("branches")\
        .select("id, name, address")\
        .eq("status", "active")\
        .order("name")\
        .execute()
    return response.data or []

@router.get("")
def get_branches(current_user: dict = Depends(get_current_user)):
    """List branches based on user role.
    Admin sees all.
    Manager sees branches they manage or created.
    Staff sees their assigned branch.
    """
    try:
        role = current_user["role"]
        query = supabase.table("branches").select("*, manager:users!manager_id(full_name)")
        
        if role == "admin":
            response = query.order("created_at", desc=True).execute()
            return response.data or []
            
        elif role == "manager":
            response = query.or_(f"manager_id.eq.{current_user['id']},created_by_admin_id.eq.{current_user['id']}").execute()
            return response.data or []
            
        elif role == "staff":
            branch_id = current_user.get("branch_id")
            if not branch_id:
                return []
            response = query.eq("id", branch_id).execute()
            return response.data or []
            
        return []
    except Exception as e:
        print("GET /branches failed:", repr(e))
        import logging
        logging.getLogger("app.branches").error(f"GET /branches failed: {repr(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Không thể tải danh sách cơ sở: {str(e)}"
        )

@router.post("", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_branch(payload: BranchCreate, current_user: dict = Depends(get_current_user)):
    insert_data = payload.model_dump()
    
    if current_user["role"] == "manager":
        insert_data["manager_id"] = current_user["id"]
    else: # admin
        # Verify manager exists and is a manager (if manager_id provided)
        if payload.manager_id:
            mgr_res = supabase.table("users").select("role").eq("id", payload.manager_id).execute()
            if not mgr_res.data or mgr_res.data[0]["role"] != "manager":
                raise HTTPException(status_code=400, detail="Người quản lý được chọn không hợp lệ.")
            
    insert_data["created_by_admin_id"] = current_user["id"]
    
    response = supabase.table("branches").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo cơ sở.")
        
    branch = response.data[0]
    
    # If a manager was assigned, we also update the manager's branch_id
    mgr_to_update = insert_data.get("manager_id")
    if mgr_to_update:
        supabase.table("users").update({"branch_id": branch["id"]}).eq("id", mgr_to_update).execute()
        
    return branch

@router.put("/{id}")
def update_branch(id: str, payload: BranchUpdate, current_user: dict = Depends(get_current_user)):
    # Check permissions: Admin can update anything.
    # Manager can update only their own branch or branch they created.
    if current_user["role"] != "admin":
        if current_user["role"] != "manager":
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật cơ sở.")
        
        # Verify manager owns this branch or created it
        branch_res = supabase.table("branches").select("manager_id,created_by_admin_id").eq("id", id).execute()
        if not branch_res.data:
            raise HTTPException(status_code=404, detail="Không tìm thấy cơ sở.")
        
        branch_rec = branch_res.data[0]
        if branch_rec["manager_id"] != current_user["id"] and branch_rec["created_by_admin_id"] != current_user["id"]:
            raise HTTPException(status_code=403, detail="Bạn chỉ có thể cập nhật cơ sở thuộc quyền quản lý của mình.")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    
    if current_user["role"] == "manager":
        update_data["manager_id"] = current_user["id"]
    else: # admin
        # Validate manager_id if updating
        if payload.manager_id:
            mgr_res = supabase.table("users").select("role").eq("id", payload.manager_id).execute()
            if not mgr_res.data or mgr_res.data[0]["role"] != "manager":
                raise HTTPException(status_code=400, detail="Người quản lý được chọn không hợp lệ.")

    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    response = supabase.table("branches").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cơ sở.")
        
    branch = response.data[0]
    
    # Update manager's branch_id if changed
    mgr_to_update = update_data.get("manager_id")
    if mgr_to_update:
        supabase.table("users").update({"branch_id": branch["id"]}).eq("id", mgr_to_update).execute()
        
    return branch

@router.delete("/{id}", dependencies=[Depends(require_role(["admin"]))])
def delete_branch(id: str):
    # Check if there are users or orders associated
    users_check = supabase.table("users").select("id").eq("branch_id", id).execute()
    if users_check.data:
        raise HTTPException(status_code=400, detail="Không thể xóa cơ sở đang có nhân viên đang làm việc.")
        
    orders_check = supabase.table("orders").select("id").eq("branch_id", id).execute()
    if orders_check.data:
        raise HTTPException(status_code=400, detail="Không thể xóa cơ sở đã phát sinh đơn hàng.")
        
    response = supabase.table("branches").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cơ sở.")
        
    return {"message": "Xóa cơ sở thành công."}
