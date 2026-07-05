import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from jinja2 import Template
import logging

from app.config import settings
from app.database import supabase

logger = logging.getLogger("app.email")

def log_email_to_db(to_email: str, subject: str, body_html: str, status: str, error_message: Optional[str] = None, sent_by: Optional[str] = None):
    """Log email details into the email_logs table."""
    try:
        supabase.table("email_logs").insert({
            "to_email": to_email,
            "subject": subject,
            "body_html": body_html,
            "status": status,
            "error_message": error_message,
            "sent_by": sent_by
        }).execute()
    except Exception as e:
        logger.error(f"Failed to log email to database: {str(e)}")

def send_raw_email(to_email: str, subject: str, html_content: str, sent_by: Optional[str] = None) -> bool:
    """Send an email using SMTP. If SMTP configuration is missing, print to console."""
    # Check if SMTP configuration is present
    has_smtp = all([
        settings.SMTP_HOST,
        settings.SMTP_PORT,
        settings.SMTP_USERNAME,
        settings.SMTP_PASSWORD,
        settings.SMTP_FROM_EMAIL
    ])
    
    if not has_smtp:
        # Fallback to printing in console for local development
        print("\n" + "="*80)
        print(" [EMAIL SENDING MOCK - NO SMTP CONFIGURED]")
        print(f" TO: {to_email}")
        print(f" SUBJECT: {subject}")
        print(f" BODY:")
        print(html_content)
        print("="*80 + "\n")
        
        # Log as sent (since it's printed to console for verification)
        log_email_to_db(to_email, subject, html_content, "sent", None, sent_by)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to_email

        part = MIMEText(html_content, "html", "utf-8")
        msg.attach(part)

        # Connect and send
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to_email, msg.as_string())
            
        log_email_to_db(to_email, subject, html_content, "sent", None, sent_by)
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        log_email_to_db(to_email, subject, html_content, "failed", str(e), sent_by)
        return False

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
        return False
