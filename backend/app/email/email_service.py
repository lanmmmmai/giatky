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
    smtp_host = settings.SMTP_HOST
    smtp_port = int(settings.SMTP_PORT or 587)
    smtp_user = settings.SMTP_USER or settings.SMTP_USERNAME
    smtp_password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or smtp_user

    # Log secure parameters without showing password
    logger.info(f"Sending email to: {to_email}")
    logger.info(f"SMTP host: {smtp_host}")
    logger.info(f"SMTP port: {smtp_port}")
    logger.info(f"SMTP user configured: {'yes' if smtp_user else 'no'}")
    logger.info(f"SMTP password configured: {'yes' if smtp_password else 'no'}")

    has_smtp = all([smtp_host, smtp_port, smtp_user, smtp_password])
    
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
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_email}>"
        msg["To"] = to_email

        part = MIMEText(html_content, "html", "utf-8")
        msg.attach(part)

        # Connect and send
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_email, msg.as_string())
            
        log_email_to_db(to_email, subject, html_content, "sent", None, sent_by)
        return True
    except Exception as e:
        logger.error(f"send_email failed: {repr(e)}", exc_info=True)
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
