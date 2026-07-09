import requests
from typing import Optional, Dict, Any
from jinja2 import Template
import logging

from app.config import settings
from app.database import supabase

logger = logging.getLogger("app.email")

def log_email_to_db(to_email: str, subject: str, body_html: str, status: str, error_message: Optional[str] = None, sent_by: Optional[str] = None, provider: str = "brevo", provider_message_id: Optional[str] = None):
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
        try:
            supabase.table("email_logs").insert({
                **insert_data,
                "provider": provider,
                "provider_message_id": provider_message_id
            }).execute()
        except Exception:
            # Fallback if provider and provider_message_id columns do not exist in schema
            supabase.table("email_logs").insert(insert_data).execute()
    except Exception as e:
        logger.error(f"Failed to log email to database: {str(e)}")

def send_raw_email(to_email: str, subject: str, html_content: str, sent_by: Optional[str] = None) -> bool:
    """Send an email using Brevo SMTP REST API."""
    brevo_key = settings.BREVO_API_KEY
    brevo_url = settings.BREVO_API_URL or "https://api.brevo.com/v3/smtp/email"
    from_email = settings.MAIL_FROM_EMAIL or "noreply@giatky.site"
    from_name = settings.MAIL_FROM_NAME or "Giặt Ký"

    # Log secure parameters without showing full key
    masked_key = f"{brevo_key[:8]}...{brevo_key[-4:]}" if brevo_key else "None"
    logger.info(f"Sending email to: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Brevo API URL: {brevo_url}")
    logger.info(f"Brevo API Key configured: {masked_key}")

    if not brevo_key:
        err_msg = "BREVO_API_KEY is missing in settings"
        logger.error(err_msg)
        log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by)
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
            err_msg = f"Brevo API returned error status: {status_code} - {response.text}"
            logger.error(err_msg)
            log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by)
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
            provider_message_id=message_id
        )
        return True
    except Exception as e:
        err_msg = f"Exception occurred while calling Brevo API: {str(e)}"
        logger.error(err_msg, exc_info=True)
        log_email_to_db(to_email, subject, html_content, "failed", err_msg, sent_by)
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
