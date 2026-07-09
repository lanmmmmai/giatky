from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime
import uuid
import logging
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.common.security import hash_password, verify_password, create_access_token
from app.common.dependencies import get_current_user
from app.database import supabase
from app.config import settings
from app.email.email_service import send_template_email

logger = logging.getLogger("app.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    username_or_email: str
    password: str
    expected_role: Literal["admin", "manager", "staff"]

class GoogleLoginRequest(BaseModel):
    id_token: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class ResendVerificationRequest(BaseModel):
    email: EmailStr

class PublicStaffRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    username: str
    password: str
    phone: Optional[str] = None
    branch_id: str

@router.post("/login")
def login(payload: LoginRequest):
    # Log parameters temporarily and safely
    val = payload.username_or_email.strip()
    logger.info(f"[LOGIN DEBUG] username_or_email: {val}")
    logger.info(f"[LOGIN DEBUG] expected_role: {payload.expected_role}")
    print(f"[LOGIN DEBUG] username_or_email: {val}")
    print(f"[LOGIN DEBUG] expected_role: {payload.expected_role}")
    
    # Query user by username or email
    response = supabase.table("users").select("*").or_(f"username.eq.{val},email.eq.{val}").execute()
    users = response.data
    
    logger.info(f"[LOGIN DEBUG] User found: {len(users) > 0}")
    print(f"[LOGIN DEBUG] User found: {len(users) > 0}")
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )
        
    user = users[0]
    logger.info(f"[LOGIN DEBUG] user.role: {user.get('role')}")
    logger.info(f"[LOGIN DEBUG] user.status: {user.get('status')}")
    print(f"[LOGIN DEBUG] user.role: {user.get('role')}")
    print(f"[LOGIN DEBUG] user.status: {user.get('status')}")
    
    p_hash = user.get("password_hash", "")
    logger.info(f"[LOGIN DEBUG] password_hash startswith '$2b$': {p_hash.startswith('$2b$') if p_hash else False}")
    print(f"[LOGIN DEBUG] password_hash startswith '$2b$': {p_hash.startswith('$2b$') if p_hash else False}")

    # Check password
    if not verify_password(payload.password, p_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác."
        )
        
    # Check expected role
    if user["role"] != payload.expected_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không thuộc luồng đăng nhập này"
        )

    # Check status
    if user["status"] == "pending_verification":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản chưa được kích hoạt. Vui lòng xác thực email của bạn."
        )
    elif user["status"] == "blocked":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin."
        )
        
    # Update last login
    supabase.table("users").update({"last_login_at": datetime.utcnow().isoformat()}).eq("id", user["id"]).execute()
    
    # Generate token
    token = create_access_token({"sub": user["id"], "role": user["role"]})
    
    return {
        "token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "full_name": user["full_name"],
            "email": user["email"],
            "username": user["username"],
            "role": user["role"],
            "status": user["status"],
            "branch_id": user["branch_id"],
            "avatar_url": user["avatar_url"]
        }
    }

@router.post("/google")
def google_login(payload: GoogleLoginRequest):
    try:
        # Validate Google token
        # For security, verify id_token using google-auth library
        # If client ID is configured, verify it. Otherwise, handle gracefully or use standard mock for testing
        email = None
        full_name = ""
        avatar_url = ""
        
        if settings.GOOGLE_CLIENT_ID:
            idinfo = id_token.verify_oauth2_token(payload.id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID)
            email = idinfo.get("email")
            full_name = idinfo.get("name", "")
            avatar_url = idinfo.get("picture", "")
        else:
            # Fallback mock for testing in case Client ID is not ready
            # Decode payload locally (assuming it's a test token or standard JWT payload)
            # For testing, we can let user pass an email string as token or decode safely
            # Let's try decoding as generic JWT without signature verification if client ID is missing
            # (Just for testing, in production GOOGLE_CLIENT_ID is required)
            from jose import jwt
            try:
                unverified_claims = jwt.get_unverified_claims(payload.id_token)
                email = unverified_claims.get("email")
                full_name = unverified_claims.get("name", "")
                avatar_url = unverified_claims.get("picture", "")
            except Exception:
                # If that fails, assume it's just the email address itself passed directly for mock testing
                email = payload.id_token
                full_name = "Google User"
        
        if not email:
            raise HTTPException(status_code=400, detail="Không thể xác minh thông tin tài khoản Google.")
            
        # Check if email exists in database
        response = supabase.table("users").select("*").eq("email", email).execute()
        users = response.data
        
        if not users:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản Google này chưa được cấp quyền. Vui lòng liên hệ quản trị viên."
            )
            
        user = users[0]
        
        # Check status
        if user["status"] == "pending_verification":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản của bạn chưa được xác thực. Vui lòng kiểm tra email kích hoạt."
            )
        elif user["status"] == "blocked":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin."
            )
            
        # Update last login & avatar if empty
        update_fields = {"last_login_at": datetime.utcnow().isoformat()}
        if not user.get("avatar_url") and avatar_url:
            update_fields["avatar_url"] = avatar_url
            
        supabase.table("users").update(update_fields).eq("id", user["id"]).execute()
        
        # Generate token
        token = create_access_token({"sub": user["id"], "role": user["role"]})
        
        return {
            "token": token,
            "token_type": "bearer",
            "user": {
                "id": user["id"],
                "full_name": user["full_name"],
                "email": user["email"],
                "username": user["username"],
                "role": user["role"],
                "status": user["status"],
                "branch_id": user["branch_id"],
                "avatar_url": user["avatar_url"] or avatar_url
            }
        }
    except Exception as e:
        logger.error(f"Google login failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Đăng nhập Google thất bại: {str(e)}"
        )

@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "full_name": current_user["full_name"],
        "email": current_user["email"],
        "username": current_user["username"],
        "role": current_user["role"],
        "status": current_user["status"],
        "branch_id": current_user["branch_id"],
        "avatar_url": current_user["avatar_url"],
        "phone": current_user["phone"],
        "hourly_rate": current_user["hourly_rate"]
    }

@router.post("/logout")
def logout():
    return {"message": "Đăng xuất thành công."}

@router.get("/verify-email")
def verify_email(token: str):
    response = supabase.table("users").select("*").eq("verification_token", token).execute()
    users = response.data
    
    if not users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mã xác thực không hợp lệ hoặc đã hết hạn."
        )
        
    user = users[0]
    
    # Update status to active
    supabase.table("users").update({
        "status": "active",
        "email_verified_at": datetime.utcnow().isoformat(),
        "verification_token": None
    }).eq("id", user["id"]).execute()
    
    return {"message": "Tài khoản của bạn đã được xác thực thành công. Bạn có thể đăng nhập ngay."}

@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest):
    response = supabase.table("users").select("*").eq("email", payload.email).execute()
    users = response.data
    
    if not users:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản với email này.")
        
    user = users[0]
    if user["status"] == "active":
        return {"message": "Tài khoản này đã được xác thực."}
        
    # Generate new token
    new_token = str(uuid.uuid4())
    supabase.table("users").update({"verification_token": new_token}).eq("id", user["id"]).execute()
    
    verify_link = f"{settings.FRONTEND_URL}/verify-account?token={new_token}"
    
    # Send verification email
    try:
        send_template_email(
            to_email=user["email"],
            template_type="verify_account",
            template_data={
                "full_name": user["full_name"],
                "role": user["role"].upper(),
                "verify_link": verify_link
            }
        )
        return {"message": "Email xác thực mới đã được gửi."}
    except Exception as e:
        logger.warning(f"Failed to send resend verification email: {str(e)}")
        print("\n" + "="*80)
        print(" [VERIFY ACCOUNT MOCK - EMAIL SENDING FAILED]")
        print(f" Verify Link: {verify_link}")
        print("="*80 + "\n")
        return {
            "message": "Không thể gửi email xác thực thật, nhưng link kích hoạt đã được tạo (xem log console/terminal).",
            "verify_link_local": verify_link,
            "email_status": "failed"
        }

@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest):
    response = supabase.table("users").select("*").eq("email", payload.email).execute()
    users = response.data
    
    if not users:
        # For security, we can return success even if user not found,
        # but in dashboard admin setting, direct response is fine.
        raise HTTPException(status_code=404, detail="Không tìm thấy email trong hệ thống.")
        
    user = users[0]
    reset_token = str(uuid.uuid4())
    
    supabase.table("users").update({"reset_password_token": reset_token}).eq("id", user["id"]).execute()
    
    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={reset_token}"
    
    try:
        send_template_email(
            to_email=user["email"],
            template_type="reset_password",
            template_data={
                "full_name": user["full_name"],
                "reset_link": reset_link
            }
        )
        return {"message": "Email đặt lại mật khẩu đã được gửi."}
    except Exception as e:
        logger.warning(f"Failed to send reset password email: {str(e)}")
        
        # Check environment: dev if FRONTEND_URL is localhost / 127.0.0.1
        is_dev = "localhost" in settings.FRONTEND_URL or "127.0.0.1" in settings.FRONTEND_URL
        err_str = str(e)
        
        if "Brevo đã chặn IP" in err_str or "401" in err_str or "unauthorised" in err_str.lower() or "unrecognised ip" in err_str.lower():
            friendly_msg = "Brevo đã chặn IP gửi mail. Vui lòng thêm IP backend vào Authorized IPs trong Brevo."
        else:
            friendly_msg = f"Không thể gửi email đặt lại mật khẩu: {err_str}"

        if is_dev:
            print("\n" + "="*80)
            print(" [RESET PASSWORD MOCK - EMAIL SENDING FAILED]")
            print(f" Reset Link: {reset_link}")
            print("="*80 + "\n")
            return {
                "message": friendly_msg,
                "reset_link_local": reset_link,
                "email_status": "failed"
            }
        else:
            raise HTTPException(
                status_code=400,
                detail=friendly_msg
            )

@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest):
    response = supabase.table("users").select("*").eq("reset_password_token", payload.token).execute()
    users = response.data
    
    if not users:
        raise HTTPException(status_code=400, detail="Mã khôi phục không hợp lệ hoặc đã hết hạn.")
        
    user = users[0]
    hashed_pwd = hash_password(payload.new_password)
    
    supabase.table("users").update({
        "password_hash": hashed_pwd,
        "reset_password_token": None
    }).eq("id", user["id"]).execute()
    
    return {"message": "Mật khẩu đã được thay đổi thành công. Bạn có thể đăng nhập."}

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    # Verify old password
    if not verify_password(payload.old_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="Mật khẩu cũ không chính xác.")
        
    hashed_pwd = hash_password(payload.new_password)
    supabase.table("users").update({
        "password_hash": hashed_pwd, 
        "updated_at": datetime.utcnow().isoformat()
    }).eq("id", current_user["id"]).execute()
    
    return {"message": "Đổi mật khẩu thành công."}

@router.post("/register-staff")
def register_staff_public(payload: PublicStaffRegisterRequest):
    # Verify unique email/username
    email_check = supabase.table("users").select("id").eq("email", payload.email).execute()
    if email_check.data:
        raise HTTPException(status_code=400, detail="Email này đã được đăng ký.")
        
    user_check = supabase.table("users").select("id").eq("username", payload.username).execute()
    if user_check.data:
        raise HTTPException(status_code=400, detail="Tên đăng nhập này đã tồn tại.")
        
    pwd_hash = hash_password(payload.password)
    verification_token = str(uuid.uuid4())
    
    insert_data = {
        "full_name": payload.full_name,
        "email": payload.email,
        "username": payload.username,
        "password_hash": pwd_hash,
        "role": "staff",
        "status": "pending_verification",
        "phone": payload.phone,
        "branch_id": payload.branch_id,
        "hourly_rate": 0,
        "verification_token": verification_token
    }
    
    response = supabase.table("users").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản nhân viên.")
        
    new_user = response.data[0]
    
    # Send verification email
    verify_link = f"{settings.FRONTEND_URL}/verify-account?token={verification_token}"
    try:
        send_template_email(
            to_email=new_user["email"],
            template_type="verify_account",
            template_data={
                "full_name": new_user["full_name"],
                "role": "STAFF",
                "verify_link": verify_link
            }
        )
    except Exception as e:
        logger.warning(f"Failed to send registration verification email: {str(e)}")
        return {"message": "Đăng ký thành công, nhưng gửi email xác thực thất bại. Vui lòng liên hệ Admin."}
    
    return {"message": "Đăng ký thành công. Vui lòng kiểm tra email để xác thực."}
