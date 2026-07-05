from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel, Field

from app.common.dependencies import require_role
from app.database import supabase

router = APIRouter(prefix="/email", tags=["Email & Templates"])

class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    body_html: str
    variables: Optional[List[str]] = Field(default_factory=list)
    type: str
    is_active: bool = True

class EmailTemplateCreate(EmailTemplateBase):
    pass

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    variables: Optional[List[str]] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/templates", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_email_templates():
    response = supabase.table("email_templates").select("*").order("created_at", desc=True).execute()
    return response.data or []

@router.post("/templates", dependencies=[Depends(require_role(["admin"]))])
def create_email_template(payload: EmailTemplateCreate):
    # Check if type already exists
    exist_check = supabase.table("email_templates").select("id").eq("type", payload.type).execute()
    if exist_check.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template type '{payload.type}' đã tồn tại."
        )
        
    response = supabase.table("email_templates").insert(payload.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo email template.")
    return response.data[0]

@router.put("/templates/{id}", dependencies=[Depends(require_role(["admin"]))])
def update_email_template(id: str, payload: EmailTemplateUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    response = supabase.table("email_templates").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy email template hoặc cập nhật thất bại.")
    return response.data[0]

@router.delete("/templates/{id}", dependencies=[Depends(require_role(["admin"]))])
def delete_email_template(id: str):
    response = supabase.table("email_templates").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy email template.")
    return {"message": "Xóa email template thành công."}

@router.get("/logs", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_email_logs():
    response = supabase.table("email_logs").select("*, users(full_name)").order("created_at", desc=True).execute()
    # Flatten/format the sender relation if needed
    formatted = []
    for log in (response.data or []):
        sender_name = log.get("users", {}).get("full_name") if log.get("users") else None
        log_copy = dict(log)
        log_copy["sender_name"] = sender_name
        if "users" in log_copy:
            del log_copy["users"]
        formatted.append(log_copy)
    return formatted
