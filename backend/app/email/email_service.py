import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

import requests
from typing import Optional, Dict, Any
from jinja2 import Template
from jinja2.sandbox import SandboxedEnvironment

from app.config import settings
from app.database import supabase
from app.common.db_features import has_table

import logging

logger = logging.getLogger("app.email")

# ─────────────────────────────────────────────
# Placeholder chuẩn của hệ thống (đồng bộ với bảng hướng dẫn trên UI)
# — dùng làm dữ liệu mẫu cho Preview và Gửi thử.
# ─────────────────────────────────────────────
SAMPLE_PLACEHOLDER_DATA: Dict[str, str] = {
    "customer_name": "Nguyễn Văn A",
    "customer_email": "khachhang@example.com",
    "customer_phone": "0901 234 567",
    "order_code": "LS-20260713-001",
    "order_date": "13/07/2026 09:30",
    "branch_name": "Giặt Ký - Chi nhánh Quận 1",
    "service_name": "Giặt sấy tiêu chuẩn",
    "order_status": "Đặt đơn thành công",
    "total": "150,000đ",
    "payment_method": "Tiền mặt",
    "pickup_time": "13/07/2026 09:30",
    "delivery_time": "14/07/2026 17:00",
    "website": "https://giatky.site",
    "support_phone": "1900 0000",
    "company_name": "Giặt Ký",
    # Biến legacy của các mẫu cũ — giữ để preview không bị trống
    "full_name": "Nguyễn Văn A",
    "total_amount": "150,000",
    "payment_status": "Đã thanh toán",
    "expected_return_at": "14/07/2026 17:00",
    "reset_link": "https://giatky.site/reset-password?token=vi-du",
    "verify_link": "https://giatky.site/verify-account?token=vi-du",
}

# Môi trường Jinja sandbox: template do admin nhập không thể truy cập
# thuộc tính/nội bộ Python; biến thiếu render thành chuỗi rỗng.
_sandbox = SandboxedEnvironment(autoescape=False)


def render_template_string(source: str, context: Dict[str, Any]) -> str:
    """Render một chuỗi template {{placeholder}} trong sandbox an toàn."""
    return _sandbox.from_string(source or "").render(**context)

_columns_cache = None

def get_email_logs_columns() -> bool:
    global _columns_cache
    if _columns_cache is not None:
        return _columns_cache
    try:
        # A quick query to check if the 'provider' column exists without throwing logger errors
        supabase.table("email_logs").select("provider").limit(1).execute()
        _columns_cache = True
    except Exception:
        _columns_cache = False
    return _columns_cache

def log_email_to_db(to_email: str, subject: str, body_html: str, status: str, error_message: Optional[str] = None, sent_by: Optional[str] = None, provider: str = "brevo", provider_message_id: Optional[str] = None, template_id: Optional[str] = None, trigger_code: Optional[str] = None):
    """Log email details into the email_logs table."""
    try:
        insert_data = {
            "to_email": to_email,
            "subject": subject,
            "body_html": body_html,
            "status": status,
            "error_message": error_message,
            "sent_by": sent_by
        }
        if get_email_logs_columns():
            insert_data["provider"] = provider
            insert_data["provider_message_id"] = provider_message_id
            from app.common.db_features import has_column
            if template_id and has_column("email_logs", "template_id"):
                insert_data["template_id"] = template_id
            if trigger_code and has_column("email_logs", "trigger_code"):
                insert_data["trigger_code"] = trigger_code
        supabase.table("email_logs").insert(insert_data).execute()
    except Exception as e:
        logger.error(f"Failed to log email to database: {str(e)}")


# ─────────────────────────────────────────────
# Cấu hình SMTP (bảng email_settings — trang Email Settings)
# ─────────────────────────────────────────────
def get_email_settings_record() -> Optional[Dict[str, Any]]:
    """Lấy bản ghi cấu hình SMTP (một dòng duy nhất), None nếu chưa có/chưa migration."""
    if not has_table("email_settings"):
        return None
    try:
        res = supabase.table("email_settings").select("*").order("created_at", desc=True).limit(1).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to load email_settings: {str(e)}")
        return None


def send_via_smtp(config: Dict[str, Any], to_email: str, subject: str, html_content: str, text_content: Optional[str] = None):
    """Gửi email qua SMTP theo cấu hình trong bảng email_settings."""
    host = (config.get("smtp_host") or "").strip()
    port = int(config.get("smtp_port") or 587)
    user = (config.get("smtp_user") or "").strip()
    password = config.get("smtp_password") or ""
    encryption = (config.get("encryption") or "tls").lower()
    sender_name = config.get("sender_name") or settings.MAIL_FROM_NAME or "Giặt Ký"
    sender_email = config.get("sender_email") or user or settings.MAIL_FROM_EMAIL

    if not host:
        raise RuntimeError("Chưa cấu hình SMTP Host trong Email Settings.")
    if not sender_email:
        raise RuntimeError("Chưa cấu hình Sender Email trong Email Settings.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((sender_name, sender_email))
    msg["To"] = to_email
    if text_content:
        msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    context = ssl.create_default_context()
    if encryption == "ssl":
        with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
            if user:
                server.login(user, password)
            server.sendmail(sender_email, [to_email], msg.as_string())
    else:
        with smtplib.SMTP(host, port, timeout=20) as server:
            if encryption == "tls":
                server.starttls(context=context)
            if user:
                server.login(user, password)
            server.sendmail(sender_email, [to_email], msg.as_string())

def send_raw_email(to_email: str, subject: str, html_content: str, sent_by: Optional[str] = None, text_content: Optional[str] = None, template_id: Optional[str] = None, trigger_code: Optional[str] = None) -> bool:
    """Gửi email: ưu tiên SMTP nếu Email Settings đang bật, ngược lại dùng Brevo API (hành vi cũ)."""
    smtp_config = get_email_settings_record()
    if smtp_config and smtp_config.get("is_active"):
        try:
            send_via_smtp(smtp_config, to_email, subject, html_content, text_content)
            logger.info(f"Email sent via SMTP to {to_email}")
            log_email_to_db(to_email, subject, html_content, "sent", None, sent_by,
                            provider="smtp", template_id=template_id, trigger_code=trigger_code)
            return True
        except Exception as e:
            err_msg = f"Gửi qua SMTP thất bại: {str(e)}"
            logger.error(err_msg)
            log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by,
                            provider="smtp", template_id=template_id, trigger_code=trigger_code)
            raise RuntimeError(err_msg)

    return _send_via_brevo(to_email, subject, html_content, sent_by, template_id, trigger_code)


def _send_via_brevo(to_email: str, subject: str, html_content: str, sent_by: Optional[str] = None, template_id: Optional[str] = None, trigger_code: Optional[str] = None) -> bool:
    """Send an email using Brevo SMTP REST API."""
    brevo_key = settings.BREVO_API_KEY
    brevo_url = settings.BREVO_API_URL or "https://api.brevo.com/v3/smtp/email"
    from_email = settings.MAIL_FROM_EMAIL or "noreply@giatky.site"
    from_name = settings.MAIL_FROM_NAME or "Giặt Ký"

    logger.info(f"Sending email to: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Brevo API URL: {brevo_url}")
    logger.info(f"Brevo API Key configured: {'yes' if brevo_key else 'no'}")

    if not brevo_key:
        err_msg = "BREVO_API_KEY is missing in settings"
        logger.error(err_msg)
        log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by, template_id=template_id, trigger_code=trigger_code)
        raise RuntimeError(err_msg)

    payload = {
        "sender": {
            "name": from_name,
            "email": from_email,
        },
        "to": [
            {
                "email": to_email,
                "name": to_email,
            }
        ],
        "subject": subject,
        "htmlContent": html_content,
    }

    headers = {
        "accept": "application/json",
        "api-key": brevo_key,
        "content-type": "application/json",
    }

    try:
        response = requests.post(
            brevo_url,
            json=payload,
            headers=headers,
            timeout=20,
        )
        status_code = response.status_code
        logger.info(f"Brevo API response status code: {status_code}")

        if status_code >= 400:
            if status_code == 401 or "unrecognised IP address" in response.text or "unauthorised" in response.text.lower():
                err_msg = "Brevo đã chặn IP gửi mail. Vui lòng thêm IP backend vào Authorized IPs trong Brevo."
            else:
                err_msg = f"Brevo API returned error status: {status_code} - {response.text}"
                
            logger.error(err_msg)
            log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by, template_id=template_id, trigger_code=trigger_code)
            raise RuntimeError(err_msg)

        res_json = response.json()
        message_id = res_json.get("messageId")
        logger.info(f"Email sent successfully. messageId: {message_id}")

        log_email_to_db(
            to_email=to_email,
            subject=subject,
            body_html=html_content,
            status="sent",
            error_message=None,
            sent_by=sent_by,
            provider="brevo",
            provider_message_id=message_id,
            template_id=template_id,
            trigger_code=trigger_code
        )
        return True
    except Exception as e:
        err_msg = str(e)
        # Avoid redundant logging if already logged in error block
        if "Brevo đã chặn IP" not in err_msg and "Brevo API returned error" not in err_msg:
            logger.error(f"Exception occurred while calling Brevo API: {err_msg}", exc_info=True)
            log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by, template_id=template_id, trigger_code=trigger_code)
        raise RuntimeError(err_msg)

def send_template_email(to_email: str, template_type: str, template_data: Dict[str, Any], sent_by: Optional[str] = None) -> bool:
    """Fetch template from DB, render it with variables, and send."""
    try:
        response = supabase.table("email_templates").select("*").eq("type", template_type).eq("is_active", True).execute()
        templates = response.data
        if not templates:
            logger.error(f"Email template of type '{template_type}' not found or inactive.")
            return False
        
        template_record = templates[0]
        subject_template = Template(template_record["subject"])
        body_template = Template(template_record["body_html"])
        
        # Render subject and body with context
        subject = subject_template.render(**template_data)
        body_html = body_template.render(**template_data)
        
        return send_raw_email(to_email, subject, body_html, sent_by)
    except Exception as e:
        logger.error(f"Error in send_template_email: {str(e)}")
        raise RuntimeError(f"Error in send_template_email: {str(e)}")


def get_active_template_by_trigger(trigger_code: str) -> Optional[Dict[str, Any]]:
    """Load Active Template: mẫu đang bật của một trigger (mẫu cập nhật gần nhất)."""
    try:
        res = (
            supabase.table("email_templates")
            .select("*")
            .eq("type", trigger_code)
            .eq("is_active", True)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"Failed to load active template for trigger '{trigger_code}': {str(e)}")
        return None


def send_trigger_email(trigger_code: str, to_email: str, context: Dict[str, Any], sent_by: Optional[str] = None) -> bool:
    """Luồng tích hợp thực tế: Trigger → Load Template → Replace Variables → Send Mail.

    Không hard-code nội dung email — toàn bộ subject/body lấy từ template.
    Hàm này KHÔNG raise: dùng làm hook sau nghiệp vụ (tạo đơn, đổi trạng thái...)
    nên lỗi gửi mail không bao giờ được phép làm hỏng nghiệp vụ chính.
    """
    try:
        if not to_email:
            return False
        template = get_active_template_by_trigger(trigger_code)
        if not template:
            logger.info(f"Không có template active cho trigger '{trigger_code}' — bỏ qua gửi mail.")
            return False

        subject = render_template_string(template["subject"], context)
        body_html = render_template_string(template["body_html"], context)
        body_text = render_template_string(template.get("body_text") or "", context) or None

        return send_raw_email(
            to_email, subject, body_html, sent_by,
            text_content=body_text,
            template_id=template.get("id"),
            trigger_code=trigger_code,
        )
    except Exception as e:
        logger.error(f"send_trigger_email('{trigger_code}') failed: {str(e)}")
        return False
