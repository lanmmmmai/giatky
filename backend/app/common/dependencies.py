from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.common.security import decode_access_token
from app.database import supabase
from typing import List, Optional

security_scheme = HTTPBearer()

def get_user_branch_assignments(user: dict) -> List[dict]:
    """Return branches assigned to a user, with legacy branch_id fallback."""
    user_id = user.get("id")
    branches_by_id: dict[str, dict] = {}

    if user_id:
        try:
            user_branch_res = supabase.table("user_branches")\
                .select("branch_id, branches(name)")\
                .eq("user_id", user_id)\
                .execute()
            for row in (user_branch_res.data or []):
                branch_id = row.get("branch_id")
                if not branch_id:
                    continue
                branches_by_id[str(branch_id)] = {
                    "branch_id": str(branch_id),
                    "branch_name": ((row.get("branches") or {}).get("name") or "N/A")
                }
        except Exception:
            pass

    if user.get("role") == "manager" and user_id:
        try:
            managed_res = supabase.table("branches").select("id, name").eq("manager_id", user_id).execute()
            for branch in (managed_res.data or []):
                branches_by_id[str(branch["id"])] = {
                    "branch_id": str(branch["id"]),
                    "branch_name": branch.get("name") or "N/A"
                }
        except Exception:
            pass

    if user.get("branch_id") and str(user["branch_id"]) not in branches_by_id:
        try:
            branch_res = supabase.table("branches").select("id, name").eq("id", user["branch_id"]).execute()
            branch_name = (branch_res.data or [{}])[0].get("name") or "N/A"
        except Exception:
            branch_name = "N/A"
        branches_by_id[str(user["branch_id"])] = {
            "branch_id": str(user["branch_id"]),
            "branch_name": branch_name
        }

    return list(branches_by_id.values())


def attach_branch_context(user: dict, current_branch_id: Optional[str] = None) -> dict:
    user = dict(user)
    assigned_branches = get_user_branch_assignments(user)
    branch_ids = [item["branch_id"] for item in assigned_branches]

    if current_branch_id:
        current_branch_id = str(current_branch_id)
        if user.get("role") != "admin" and current_branch_id not in branch_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền truy cập cơ sở đang chọn.",
            )
        if user.get("role") == "admin":
            exists = supabase.table("branches").select("id").eq("id", current_branch_id).execute()
            if not exists.data:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cơ sở đang chọn không tồn tại.")
        user["branch_id"] = current_branch_id
    elif len(branch_ids) == 1:
        user["branch_id"] = branch_ids[0]

    current_branch = next((item for item in assigned_branches if item["branch_id"] == str(user.get("branch_id"))), None)
    user["assigned_branches"] = assigned_branches
    user["branch_ids"] = branch_ids
    user["facilities"] = [{"id": item["branch_id"], "name": item["branch_name"]} for item in assigned_branches]
    user["current_branch_id"] = user.get("branch_id")
    user["current_branch_name"] = current_branch["branch_name"] if current_branch else None
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    x_current_branch: Optional[str] = Header(default=None, alias="X-Current-Branch"),
) -> dict:
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
        
    return attach_branch_context(user, x_current_branch)

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
        allowed_branch_ids = [str(item["branch_id"]) for item in get_user_branch_assignments(current_user)]
        if str(branch_id) not in allowed_branch_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không thuộc cơ sở này.",
            )
        return
