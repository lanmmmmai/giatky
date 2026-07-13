import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

from app.common.db_features import has_column, has_table
from app.common.dependencies import get_current_user, require_role
from app.database import supabase
from app.email.email_service import (
    SAMPLE_PLACEHOLDER_DATA,
    get_active_template_by_trigger,
    get_email_settings_record,
    render_template_string,
    send_raw_email,
    send_via_smtp,
)

router = APIRouter(prefix="/email", tags=["Email & Templates"])

TRIGGER_CODE_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,63}$")

# Danh mục trigger mặc định — fallback khi bảng email_triggers chưa được migrate.
BUILTIN_TRIGGERS = [
    {"code": "verify_account", "name": "Đăng ký tài khoản", "is_system": True},
    {"code": "reset_password", "name": "Quên mật khẩu", "is_system": True},
    {"code": "otp", "name": "OTP", "is_system": True},
    {"code": "order_success", "name": "Đặt đơn thành công (legacy)", "is_system": True},
    {"code": "ORDER_CREATED", "name": "Đặt đơn thành công", "is_system": True},
    {"code": "ORDER_RECEIVED", "name": "Đơn đã nhận", "is_system": True},
    {"code": "ORDER_WASHING", "name": "Đơn đang giặt", "is_system": True},
    {"code": "ORDER_DRYING", "name": "Đơn đang sấy", "is_system": True},
    {"code": "ORDER_COMPLETED", "name": "Đơn hoàn thành", "is_system": True},
    {"code": "ORDER_DELIVERED", "name": "Đơn giao thành công", "is_system": True},
    {"code": "ORDER_CANCELLED", "name": "Hủy đơn", "is_system": True},
    {"code": "PAYMENT_SUCCESS", "name": "Thanh toán thành công", "is_system": True},
    {"code": "PAYMENT_FAILED", "name": "Thanh toán thất bại", "is_system": True},
    {"code": "announcement", "name": "Thông báo chung", "is_system": True},
    {"code": "payroll", "name": "Thông báo bảng lương", "is_system": True},
]

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

def _format_template_row(row: dict) -> dict:
    out = dict(row)
    updater = out.pop("users", None)
    out["updated_by_name"] = (updater or {}).get("full_name") if updater else None
    return out


def _template_select() -> str:
    if has_column("email_templates", "updated_by"):
        return "*, users!updated_by(full_name)"
    return "*"


def _stamp_updated_by(data: dict, current_user: Optional[dict]):
    if current_user and has_column("email_templates", "updated_by"):
        data["updated_by"] = current_user["id"]


def _is_unique_violation(err: Exception) -> bool:
    text = str(err).lower()
    return "duplicate" in text or "unique" in text or "23505" in text


@router.get("/templates", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_email_templates():
    response = supabase.table("email_templates").select(_template_select()).order("created_at", desc=True).execute()
    return [_format_template_row(r) for r in (response.data or [])]

@router.post("/templates", dependencies=[Depends(require_role(["admin"]))])
def create_email_template(payload: EmailTemplateCreate, current_user: dict = Depends(get_current_user)):
    payload_dict = payload.model_dump()
    if not get_template_columns_has_body_text():
        payload_dict.pop("body_text", None)
    _stamp_updated_by(payload_dict, current_user)

    try:
        response = supabase.table("email_templates").insert(payload_dict).execute()
    except Exception as e:
        # Trước migration, UNIQUE(type) chỉ cho phép một mẫu mỗi trigger
        if _is_unique_violation(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Trigger '{payload.type}' đã có mẫu. Chạy migration seo_email_module_migration.sql để cho phép nhiều mẫu trên cùng trigger.",
            )
        raise HTTPException(status_code=500, detail=f"Không thể tạo email template: {str(e)}")
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo email template.")
    return response.data[0]

@router.put("/templates/{id}", dependencies=[Depends(require_role(["admin"]))])
def update_email_template(id: str, payload: EmailTemplateUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")

    if not get_template_columns_has_body_text():
        update_data.pop("body_text", None)
    _stamp_updated_by(update_data, current_user)
    update_data["updated_at"] = datetime.utcnow().isoformat()

    response = supabase.table("email_templates").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy email template hoặc cập nhật thất bại.")
    return response.data[0]

@router.post("/templates/{id}/duplicate", dependencies=[Depends(require_role(["admin"]))])
def duplicate_email_template(id: str, current_user: dict = Depends(get_current_user)):
    """Nhân bản một mẫu email. Bản sao mặc định TẮT (is_active=False) để không
    ảnh hưởng mẫu đang chạy cho đến khi admin chủ động bật."""
    res = supabase.table("email_templates").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy email template.")
    src = res.data[0]

    copy_data = {
        "name": f"{src['name']} (bản sao)",
        "subject": src["subject"],
        "body_html": src["body_html"],
        "variables": src.get("variables"),
        "type": src["type"],
        "is_active": False,
    }
    if get_template_columns_has_body_text():
        copy_data["body_text"] = src.get("body_text")
    _stamp_updated_by(copy_data, current_user)

    try:
        response = supabase.table("email_templates").insert(copy_data).execute()
    except Exception as e:
        if _is_unique_violation(e):
            raise HTTPException(
                status_code=400,
                detail="Không thể nhân bản: database còn ràng buộc một mẫu mỗi trigger. Chạy migration seo_email_module_migration.sql trước.",
            )
        raise HTTPException(status_code=500, detail=f"Nhân bản mẫu thất bại: {str(e)}")
    if not response.data:
        raise HTTPException(status_code=500, detail="Nhân bản mẫu thất bại.")
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


# ─────────────────────────────────────────────
# PLACEHOLDERS + PREVIEW + GỬI THỬ THEO TEMPLATE
# ─────────────────────────────────────────────

@router.get("/placeholders", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_placeholders():
    """Danh sách placeholder chuẩn kèm dữ liệu mẫu (dùng cho bảng hướng dẫn + preview)."""
    return SAMPLE_PLACEHOLDER_DATA


class EmailPreviewRequest(BaseModel):
    subject: str = ""
    body_html: str = ""
    body_text: Optional[str] = None
    sample_data: Optional[Dict[str, str]] = None


@router.post("/templates/preview", dependencies=[Depends(require_role(["admin", "manager"]))])
def preview_email_template(payload: EmailPreviewRequest):
    """Render subject/body với dữ liệu mẫu — thay {{placeholder}} như khi gửi thật."""
    context = {**SAMPLE_PLACEHOLDER_DATA, **(payload.sample_data or {})}
    try:
        return {
            "subject": render_template_string(payload.subject, context),
            "body_html": render_template_string(payload.body_html, context),
            "body_text": render_template_string(payload.body_text or "", context),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template có lỗi cú pháp: {str(e)}")


class SendTestRequest(BaseModel):
    to_email: str
    subject_override: Optional[str] = None
    sample_data: Optional[Dict[str, str]] = None


@router.post("/templates/{id}/send-test", dependencies=[Depends(require_role(["admin"]))])
def send_test_email(id: str, payload: SendTestRequest, current_user: dict = Depends(get_current_user)):
    """Send Test Email: render mẫu với dữ liệu mẫu rồi gửi tới email chỉ định."""
    res = supabase.table("email_templates").select("*").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy email template.")
    template = res.data[0]

    context = {**SAMPLE_PLACEHOLDER_DATA, **(payload.sample_data or {})}
    try:
        subject = render_template_string(payload.subject_override or template["subject"], context)
        body_html = render_template_string(template["body_html"], context)
        body_text = render_template_string(template.get("body_text") or "", context) or None
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Template có lỗi cú pháp: {str(e)}")

    subject = f"[TEST] {subject}"
    try:
        send_raw_email(
            payload.to_email, subject, body_html, current_user["id"],
            text_content=body_text, template_id=template["id"], trigger_code=template["type"],
        )
        return {"message": "Email gửi thành công", "to": payload.to_email, "subject": subject}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gửi email thất bại: {str(e)}")


@router.get("/templates/active", dependencies=[Depends(require_role(["admin", "manager"]))])
def load_active_template(trigger: str):
    """Load Active Template: mẫu đang được hệ thống dùng cho một trigger."""
    template = get_active_template_by_trigger(trigger)
    if not template:
        raise HTTPException(status_code=404, detail=f"Chưa có mẫu active cho trigger '{trigger}'.")
    return template


# ─────────────────────────────────────────────
# TRIGGERS: danh mục sự kiện gửi mail (admin thêm mới được)
# ─────────────────────────────────────────────

class TriggerCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None


@router.get("/triggers", dependencies=[Depends(require_role(["admin", "manager"]))])
def get_email_triggers():
    if not has_table("email_triggers"):
        # Chưa migration: trả danh mục mặc định để UI vẫn hoạt động
        return BUILTIN_TRIGGERS
    response = supabase.table("email_triggers").select("*").order("created_at").execute()
    return response.data or []


@router.post("/triggers", dependencies=[Depends(require_role(["admin"]))])
def create_email_trigger(payload: TriggerCreate, current_user: dict = Depends(get_current_user)):
    if not has_table("email_triggers"):
        raise HTTPException(
            status_code=400,
            detail="Bảng email_triggers chưa tồn tại. Chạy migration seo_email_module_migration.sql trong Supabase SQL Editor trước.",
        )
    code = payload.code.strip()
    if not TRIGGER_CODE_RE.match(code):
        raise HTTPException(status_code=400, detail="Mã trigger chỉ gồm chữ, số, dấu gạch dưới; bắt đầu bằng chữ (VD: ORDER_CREATED).")
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tên trigger không được để trống.")

    try:
        response = supabase.table("email_triggers").insert({
            "code": code,
            "name": payload.name.strip(),
            "description": (payload.description or "").strip() or None,
            "is_system": False,
            "created_by": current_user["id"],
        }).execute()
    except Exception as e:
        if _is_unique_violation(e):
            raise HTTPException(status_code=400, detail=f"Trigger '{code}' đã tồn tại.")
        raise HTTPException(status_code=500, detail=f"Không thể tạo trigger: {str(e)}")
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo trigger.")
    return response.data[0]


@router.delete("/triggers/{code}", dependencies=[Depends(require_role(["admin"]))])
def delete_email_trigger(code: str):
    if not has_table("email_triggers"):
        raise HTTPException(status_code=400, detail="Bảng email_triggers chưa tồn tại — không có gì để xóa.")
    res = supabase.table("email_triggers").select("*").eq("code", code).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy trigger.")
    if res.data[0].get("is_system"):
        raise HTTPException(status_code=400, detail="Không thể xóa trigger hệ thống.")
    used = supabase.table("email_templates").select("id").eq("type", code).limit(1).execute()
    if used.data:
        raise HTTPException(status_code=400, detail="Trigger đang được mẫu email sử dụng, không thể xóa.")
    supabase.table("email_triggers").delete().eq("code", code).execute()
    return {"message": "Đã xóa trigger."}


# ─────────────────────────────────────────────
# EMAIL SETTINGS: cấu hình SMTP
# ─────────────────────────────────────────────

class EmailSettingsUpdate(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None  # bỏ trống = giữ mật khẩu cũ
    encryption: Optional[str] = Field(None, pattern="^(none|ssl|tls)$")
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    is_active: Optional[bool] = None


def _mask_settings(row: Optional[dict]) -> dict:
    """Không bao giờ trả mật khẩu SMTP về client — chỉ trả cờ has_password."""
    if not row:
        return {"smtp_host": "", "smtp_port": 587, "smtp_user": "", "encryption": "tls",
                "sender_name": "", "sender_email": "", "is_active": False, "has_password": False}
    out = {k: v for k, v in row.items() if k != "smtp_password"}
    out["has_password"] = bool(row.get("smtp_password"))
    return out


@router.get("/settings", dependencies=[Depends(require_role(["admin"]))])
def get_email_settings():
    if not has_table("email_settings"):
        raise HTTPException(
            status_code=400,
            detail="Bảng email_settings chưa tồn tại. Chạy migration seo_email_module_migration.sql trong Supabase SQL Editor trước.",
        )
    return _mask_settings(get_email_settings_record())


@router.put("/settings", dependencies=[Depends(require_role(["admin"]))])
def update_email_settings(payload: EmailSettingsUpdate, current_user: dict = Depends(get_current_user)):
    if not has_table("email_settings"):
        raise HTTPException(
            status_code=400,
            detail="Bảng email_settings chưa tồn tại. Chạy migration seo_email_module_migration.sql trong Supabase SQL Editor trước.",
        )
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    # Bỏ trống mật khẩu = giữ nguyên mật khẩu cũ
    if data.get("smtp_password") == "":
        data.pop("smtp_password")
    data["updated_by"] = current_user["id"]
    data["updated_at"] = datetime.utcnow().isoformat()

    existing = get_email_settings_record()
    if existing:
        response = supabase.table("email_settings").update(data).eq("id", existing["id"]).execute()
    else:
        response = supabase.table("email_settings").insert(data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Lưu cấu hình email thất bại.")
    return _mask_settings(response.data[0])


class SmtpTestRequest(BaseModel):
    to_email: str


@router.post("/settings/test", dependencies=[Depends(require_role(["admin"]))])
def test_smtp_settings(payload: SmtpTestRequest, current_user: dict = Depends(get_current_user)):
    """Test SMTP: gửi thẳng qua cấu hình SMTP đã lưu (kể cả khi is_active đang tắt)."""
    config = get_email_settings_record()
    if not config or not (config.get("smtp_host") or "").strip():
        raise HTTPException(status_code=400, detail="Chưa lưu cấu hình SMTP. Điền và bấm Lưu trước khi test.")
    subject = "Kiểm tra cấu hình SMTP - Giặt Ký"
    body = "<p>Nếu bạn nhận được email này, cấu hình SMTP của hệ thống Giặt Ký đã hoạt động.</p>"
    try:
        send_via_smtp(config, payload.to_email, subject, body)
        from app.email.email_service import log_email_to_db
        log_email_to_db(payload.to_email, subject, body, "sent", None, current_user["id"], provider="smtp")
        return {"message": "Email gửi thành công", "to": payload.to_email}
    except Exception as e:
        from app.email.email_service import log_email_to_db
        log_email_to_db(payload.to_email, subject, body, "failed", str(e), current_user["id"], provider="smtp")
        raise HTTPException(status_code=500, detail=f"Test SMTP thất bại: {str(e)}")
