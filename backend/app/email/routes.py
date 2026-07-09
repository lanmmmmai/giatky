from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from pydantic import BaseModel, Field

from app.common.dependencies import require_role
from app.database import supabase

router = APIRouter(prefix="/email", tags=["Email & Templates"])

_template_columns_cache = None

def get_template_columns_has_body_text() -> bool:
    global _template_columns_cache
    if _template_columns_cache is not None:
        return _template_columns_cache
    try:
        supabase.table("email_templates").select("body_text").limit(1).execute()
        _template_columns_cache = True
    except Exception:
        _template_columns_cache = False
    return _template_columns_cache

class EmailTemplateBase(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    variables: Optional[List[str]] = Field(default_factory=list)
    type: str
    is_active: bool = True

class EmailTemplateCreate(EmailTemplateBase):
    pass

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
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
        
    payload_dict = payload.model_dump()
    if not get_template_columns_has_body_text():
        payload_dict.pop("body_text", None)
        
    response = supabase.table("email_templates").insert(payload_dict).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo email template.")
    return response.data[0]

@router.put("/templates/{id}", dependencies=[Depends(require_role(["admin"]))])
def update_email_template(id: str, payload: EmailTemplateUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    if not get_template_columns_has_body_text():
        update_data.pop("body_text", None)
        
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

from app.common.dependencies import get_current_user
from app.email.email_service import send_raw_email

class EmailTestRequest(BaseModel):
    to_email: str

@router.post("/test", dependencies=[Depends(require_role(["admin"]))])
def test_email(payload: EmailTestRequest, current_user: dict = Depends(get_current_user)):
    from app.config import settings
    configured = "yes" if settings.BREVO_API_KEY else "no"
    from_email = settings.MAIL_FROM_EMAIL or "noreply@giatky.site"
    print(f"[EMAIL TEST LOG] Brevo API configured: {configured}")
    print(f"[EMAIL TEST LOG] From email: {from_email}")

    subject = "Kiểm tra gửi mail Giặt Ký"
    body = "<p>Nếu bạn nhận được email này, Brevo Transactional Email của Giặt Ký đã hoạt động.</p>"
    
    try:
        send_raw_email(
            to_email=payload.to_email,
            subject=subject,
            html_content=body,
            sent_by=current_user["id"]
        )
        return {
            "message": "Email test đã được gửi",
            "provider": "brevo",
            "result": {"status": "success", "to": payload.to_email}
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Gửi email thử nghiệm thất bại: {str(e)}"
        )
