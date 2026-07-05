from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.common.security import decode_access_token
from app.database import supabase
from typing import List

security_scheme = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> dict:
    """Validate access token and return current user if status is active."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập hết hạn hoặc token không hợp lệ.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không chứa thông tin định danh.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    response = supabase.table("users").select("*").eq("id", user_id).execute()
    users = response.data
    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng không tồn tại trong hệ thống.",
        )
        
    user = users[0]
    if user["status"] != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản đang bị khóa hoặc chưa được xác thực (Trạng thái: {user['status']}).",
        )
        
    return user

def require_role(allowed_roles: List[str]):
    """Ensure the current user has one of the allowed roles."""
    async def dependency(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền thực hiện hành động này.",
            )
        return current_user
    return dependency

async def require_branch_access(branch_id: str, current_user: dict) -> None:
    """Verify that a user (manager/staff) has access to a specific branch.
    Admin has access to all branches.
    Manager has access if branch is assigned to them.
    Staff has access if they are assigned to this branch.
    """
    if current_user["role"] == "admin":
        return
        
    if current_user["role"] == "manager":
        # Check if the manager is assigned to this branch
        # A manager's assigned branch is stored in branch_id
        # or they manage the branch where they are the manager_id.
        branch_res = supabase.table("branches").select("id").eq("id", branch_id).eq("manager_id", current_user["id"]).execute()
        if not branch_res.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không được quyền quản lý cơ sở này.",
            )
        return
        
    if current_user["role"] == "staff":
        # Staff is strictly tied to their branch_id
        if current_user.get("branch_id") != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không thuộc cơ sở này.",
            )
        return
