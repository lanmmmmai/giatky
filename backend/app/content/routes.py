import html
import logging
import re
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from pydantic import BaseModel, EmailStr, Field

from app.common.db_features import has_column
from app.common.dependencies import get_current_user, require_role
from app.config import settings
from app.database import supabase
from app.email.email_service import (
    get_active_template_by_trigger,
    get_email_settings_record,
    render_template_string,
    send_raw_email,
)

logger = logging.getLogger("app.content")

router = APIRouter(tags=["Posts & Recruitment"])
admin_router = APIRouter(prefix="/admin", tags=["Admin Posts & Recruitment"])

POST_TYPES = {"news", "recruitment", "announcement", "guide", "other"}
POST_STATUSES = {"draft", "pending", "published", "hidden", "expired"}
APPLICATION_STATUSES = {
    "NEW", "VIEWED", "CONTACTING", "INTERVIEW_SCHEDULED", "INTERVIEW_PASSED",
    "INTERVIEW_FAILED", "HIRED", "REJECTED", "ARCHIVED"
}
CV_MIME_TYPES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
MAX_CV_SIZE = 5 * 1024 * 1024
APPLICATION_BUCKET = "job-applications"


def slugify(value: str) -> str:
    value = (value or "").strip().lower()
    replacements = {
        "àáạảãâầấậẩẫăằắặẳẵ": "a",
        "èéẹẻẽêềếệểễ": "e",
        "ìíịỉĩ": "i",
        "òóọỏõôồốộổỗơờớợởỡ": "o",
        "ùúụủũưừứựửữ": "u",
        "ỳýỵỷỹ": "y",
        "đ": "d",
    }
    for chars, replacement in replacements.items():
        for char in chars:
            value = value.replace(char, replacement)
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "bai-viet"


def sanitize_html(raw: str) -> str:
    cleaned = re.sub(r"<\s*(script|style|iframe|object|embed)[^>]*>.*?<\s*/\s*\1\s*>", "", raw or "", flags=re.I | re.S)
    cleaned = re.sub(r"\son\w+\s*=\s*(['\"]).*?\1", "", cleaned, flags=re.I | re.S)
    cleaned = re.sub(r"\s(href|src)\s*=\s*(['\"])\s*javascript:.*?\2", "", cleaned, flags=re.I | re.S)
    return cleaned


def public_post_select() -> str:
    return "*, users!author_id(full_name), job_posts(*, job_post_branches(branch_id, branches(name)))"


def format_post(row: dict) -> dict:
    post = dict(row)
    author = post.pop("users", None)
    post["author_name"] = (author or {}).get("full_name")
    job = post.get("job_posts")
    if isinstance(job, list):
        job = job[0] if job else None
    if job:
        branches = []
        for item in job.get("job_post_branches") or []:
            branches.append({
                "branch_id": item.get("branch_id"),
                "branch_name": (item.get("branches") or {}).get("name"),
            })
        job = dict(job)
        job.pop("job_post_branches", None)
        job["branches"] = branches
        post["job_post"] = job
    else:
        post["job_post"] = None
    post.pop("job_posts", None)
    return post


def ensure_unique_slug(base_slug: str, exclude_id: Optional[str] = None) -> str:
    base = slugify(base_slug)
    slug = base
    counter = 2
    while True:
        query = supabase.table("posts").select("id").eq("slug", slug).is_("deleted_at", "null")
        if exclude_id:
            query = query.neq("id", exclude_id)
        res = query.limit(1).execute()
        if not res.data:
            return slug
        slug = f"{base}-{counter}"
        counter += 1


TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
SHIFT_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,39}$")


class ShiftPayload(BaseModel):
    """Một ca tuyển dụng có cấu trúc: id ổn định + tên + khung giờ."""
    id: str
    name: str
    start_time: str
    end_time: str


def validate_shifts(shifts: List["ShiftPayload"]) -> List[dict]:
    cleaned = []
    seen_ids = set()
    for shift in shifts or []:
        sid = shift.id.strip().lower()
        name = shift.name.strip()
        if not SHIFT_ID_RE.match(sid):
            raise HTTPException(status_code=400, detail="Mã ca không hợp lệ (chỉ chữ thường, số, gạch ngang).")
        if sid in seen_ids:
            raise HTTPException(status_code=400, detail="Danh sách ca tuyển dụng bị trùng mã ca.")
        if not name:
            raise HTTPException(status_code=400, detail="Tên ca không được để trống.")
        if not TIME_RE.match(shift.start_time) or not TIME_RE.match(shift.end_time):
            raise HTTPException(status_code=400, detail="Giờ ca phải theo định dạng HH:MM.")
        seen_ids.add(sid)
        cleaned.append({"id": sid, "name": name, "start_time": shift.start_time, "end_time": shift.end_time})
    return cleaned


def shift_label(shift: dict) -> str:
    return f"{shift.get('name')} {shift.get('start_time')}-{shift.get('end_time')}"


def resolve_application_branch(job: dict, preferred_branch_id: Optional[str]) -> tuple[Optional[str], str]:
    """Xác định cơ sở ứng tuyển từ bài tuyển dụng (nguồn tin cậy duy nhất).

    Trả về (branch_id, branch_name). Không tin ID client khi bài chỉ có 1 cơ sở.
    Raise 422 khi bài có ≥2 cơ sở mà client không chọn hoặc chọn ngoài danh sách.
    """
    job_branches = job.get("branches") or []
    branch_by_id = {b["branch_id"]: b for b in job_branches}
    if len(job_branches) == 1:
        return job_branches[0]["branch_id"], job_branches[0].get("branch_name") or ""
    if len(job_branches) >= 2:
        if not preferred_branch_id:
            raise HTTPException(status_code=422, detail="Vui lòng chọn cơ sở mong muốn.")
        if preferred_branch_id not in branch_by_id:
            raise HTTPException(status_code=422, detail="Cơ sở đã chọn không thuộc tin tuyển dụng này.")
        return preferred_branch_id, branch_by_id[preferred_branch_id].get("branch_name") or ""
    return None, ""  # bài không gắn cơ sở → không nhận cơ sở từ client


def resolve_application_shift(
    job: dict, preferred_shift_id: Optional[str], legacy_shift_text: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    """Xác định ca ứng tuyển từ bài tuyển dụng.

    Trả về (shift_id, shift_label). Tự gán khi bài có đúng 1 ca; raise 422 khi bài
    có ≥2 ca mà client không chọn hoặc chọn ngoài danh sách. Bài cũ chưa có ca cấu
    trúc thì giữ text tự do làm nhãn tham khảo, shift_id = None.
    """
    job_shifts = job.get("shifts") or []
    shift_by_id = {s["id"]: s for s in job_shifts if isinstance(s, dict) and s.get("id")}
    if len(shift_by_id) == 1:
        only_shift = next(iter(shift_by_id.values()))
        return only_shift["id"], shift_label(only_shift)
    if len(shift_by_id) >= 2:
        if not preferred_shift_id:
            raise HTTPException(status_code=422, detail="Vui lòng chọn ca làm việc mong muốn.")
        if preferred_shift_id not in shift_by_id:
            raise HTTPException(status_code=422, detail="Ca đã chọn không thuộc tin tuyển dụng này.")
        return preferred_shift_id, shift_label(shift_by_id[preferred_shift_id])
    return None, (legacy_shift_text or "").strip() or (job.get("shift_name") or "").strip() or None


class JobPostPayload(BaseModel):
    job_title: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    shift_name: Optional[str] = None
    shifts: List[ShiftPayload] = Field(default_factory=list)
    salary_text: Optional[str] = None
    quantity: Optional[int] = Field(default=None, ge=0)
    experience: Optional[str] = None
    gender: Optional[str] = None
    age_range: Optional[str] = None
    application_deadline: Optional[date] = None
    recruiter_id: Optional[str] = None
    receiving_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    benefits: Optional[str] = None
    requirements: Optional[str] = None
    responsibilities: Optional[str] = None
    allow_online_application: bool = True
    branch_ids: List[str] = Field(default_factory=list)


class PostPayload(BaseModel):
    title: str
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: str = ""
    post_type: str = "news"
    status: str = "draft"
    featured_image: Optional[str] = None
    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    is_featured: bool = False
    sort_order: int = 0
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_image: Optional[str] = None
    published_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    allow_application_form: bool = False
    allow_comments: bool = False
    job_post: Optional[JobPostPayload] = None


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    internal_note: Optional[str] = None
    assigned_to: Optional[str] = None


def validate_post_payload(payload: PostPayload) -> None:
    if payload.post_type not in POST_TYPES:
        raise HTTPException(status_code=400, detail="Loại bài viết không hợp lệ.")
    if payload.status not in POST_STATUSES:
        raise HTTPException(status_code=400, detail="Trạng thái bài viết không hợp lệ.")
    if payload.post_type == "recruitment" and not payload.job_post:
        raise HTTPException(status_code=400, detail="Bài tuyển dụng cần thông tin tuyển dụng.")
    # Vị trí làm việc theo ca bắt buộc phải chọn ca trước khi xuất bản
    if (
        payload.post_type == "recruitment"
        and payload.status == "published"
        and payload.job_post
        and payload.job_post.employment_type == "shift"
        and not payload.job_post.shifts
        and not (payload.job_post.shift_name or "").strip()
    ):
        raise HTTPException(status_code=400, detail="Vị trí làm việc theo ca cần chọn ít nhất một ca tuyển dụng trước khi xuất bản.")


def save_job_post(post_id: str, job_payload: Optional[JobPostPayload]) -> None:
    if not job_payload:
        supabase.table("job_posts").delete().eq("post_id", post_id).execute()
        return
    data = job_payload.model_dump(exclude={"branch_ids", "shifts"})
    data["post_id"] = post_id
    data["receiving_email"] = str(job_payload.receiving_email) if job_payload.receiving_email else None
    if data.get("application_deadline"):
        data["application_deadline"] = data["application_deadline"].isoformat()
    # Ca tuyển dụng có cấu trúc — cột chỉ tồn tại sau job_post_shifts_migration.sql
    if has_column("job_posts", "shifts"):
        data["shifts"] = validate_shifts(job_payload.shifts)

    existing = supabase.table("job_posts").select("id").eq("post_id", post_id).limit(1).execute()
    if existing.data:
        job_id = existing.data[0]["id"]
        supabase.table("job_posts").update(data).eq("id", job_id).execute()
    else:
        res = supabase.table("job_posts").insert(data).execute()
        job_id = res.data[0]["id"]

    supabase.table("job_post_branches").delete().eq("job_post_id", job_id).execute()
    branch_ids = list(dict.fromkeys(job_payload.branch_ids or []))
    if branch_ids:
        branches = supabase.table("branches").select("id").in_("id", branch_ids).execute()
        found = {b["id"] for b in (branches.data or [])}
        if len(found) != len(branch_ids):
            raise HTTPException(status_code=400, detail="Một hoặc nhiều cơ sở tuyển dụng không tồn tại.")
        supabase.table("job_post_branches").insert([
            {"job_post_id": job_id, "branch_id": branch_id}
            for branch_id in branch_ids
        ]).execute()


def post_payload_to_row(payload: PostPayload, current_user: dict, existing_id: Optional[str] = None) -> dict:
    slug = ensure_unique_slug(payload.slug or payload.title, existing_id)
    return {
        "title": payload.title.strip(),
        "slug": slug,
        "excerpt": payload.excerpt,
        "content": sanitize_html(payload.content),
        "post_type": payload.post_type,
        "status": payload.status,
        "featured_image": payload.featured_image,
        "author_id": current_user["id"],
        "category": payload.category,
        "tags": payload.tags,
        "is_featured": payload.is_featured,
        "sort_order": payload.sort_order,
        "meta_title": payload.meta_title,
        "meta_description": payload.meta_description,
        "keywords": payload.keywords,
        "canonical_url": payload.canonical_url,
        "og_image": payload.og_image,
        "published_at": payload.published_at.isoformat() if payload.published_at else None,
        "expired_at": payload.expired_at.isoformat() if payload.expired_at else None,
        "allow_application_form": payload.allow_application_form,
        "allow_comments": payload.allow_comments,
        "updated_at": datetime.utcnow().isoformat(),
    }


@router.get("/posts")
def public_posts(
    search: Optional[str] = None,
    post_type: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
):
    query = supabase.table("posts").select(public_post_select()).eq("status", "published").is_("deleted_at", "null")
    if post_type:
        query = query.eq("post_type", post_type)
    if search:
        query = query.ilike("title", f"%{search}%")
    offset = max(page - 1, 0) * page_size
    res = query.order("published_at", desc=True).range(offset, offset + page_size - 1).execute()
    return [format_post(row) for row in (res.data or [])]


@router.get("/posts/{slug}")
def public_post_detail(slug: str):
    res = supabase.table("posts").select(public_post_select()).eq("slug", slug).is_("deleted_at", "null").limit(1).execute()
    if not res.data or res.data[0]["status"] != "published":
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
    return format_post(res.data[0])


@router.get("/jobs")
def public_jobs(search: Optional[str] = None, page: int = 1, page_size: int = 12):
    return public_posts(search=search, post_type="recruitment", page=page, page_size=page_size)


@router.get("/jobs/{slug}")
def public_job_detail(slug: str):
    post = public_post_detail(slug)
    if post["post_type"] != "recruitment":
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng.")
    return post


def validate_cv(file: Optional[UploadFile]) -> Optional[bytes]:
    if not file:
        return None
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in {"pdf", "doc", "docx"}:
        raise HTTPException(status_code=400, detail="CV chỉ cho phép PDF, DOC hoặc DOCX.")
    content = file.file.read()
    if len(content) > MAX_CV_SIZE:
        raise HTTPException(status_code=400, detail="CV không được vượt quá 5MB.")
    if file.content_type not in CV_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Định dạng CV không hợp lệ.")
    return content


def upload_cv(file: Optional[UploadFile], content: Optional[bytes], application_code: str) -> Optional[str]:
    if not file or content is None:
        return None
    ext = CV_MIME_TYPES[file.content_type]
    path = f"cv/{application_code}-{uuid.uuid4().hex[:8]}.{ext}"
    try:
        supabase.storage.from_(APPLICATION_BUCKET).upload(path, content, {"content-type": file.content_type})
        return path
    except Exception as e:
        logger.error(f"Failed to upload CV: {str(e)}")
        raise HTTPException(status_code=500, detail="Không thể lưu file CV. Vui lòng thử lại.")


def send_application_email(trigger_code: str, to_email: str, data: dict) -> None:
    template = get_active_template_by_trigger(trigger_code)
    if not template:
        logger.warning(f"No active email template for {trigger_code}")
        return
    subject = render_template_string(template.get("subject") or "", data)
    body_html = render_template_string(template.get("body_html") or "", data)
    send_raw_email(
        to_email=to_email,
        subject=subject,
        html_content=body_html,
        template_id=template.get("id"),
        trigger_code=trigger_code,
    )


@router.post("/jobs/{post_id}/applications", status_code=status.HTTP_201_CREATED)
def submit_job_application(
    post_id: str,
    full_name: str = Form(...),
    phone: str = Form(...),
    email: Optional[EmailStr] = Form(None),
    date_of_birth: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    preferred_branch_id: Optional[str] = Form(None),
    preferred_shift: Optional[str] = Form(None),
    preferred_shift_id: Optional[str] = Form(None),
    experience: Optional[str] = Form(None),
    education: Optional[str] = Form(None),
    available_date: Optional[str] = Form(None),
    expected_salary: Optional[str] = Form(None),
    introduction: Optional[str] = Form(None),
    agreed_terms: bool = Form(False),
    cv: Optional[UploadFile] = File(None),
):
    if not agreed_terms:
        raise HTTPException(status_code=400, detail="Bạn cần đồng ý điều khoản xử lý dữ liệu.")
    if len(full_name.strip()) < 2:
        raise HTTPException(status_code=400, detail="Họ tên phải có ít nhất 2 ký tự.")
    if not re.match(r"^(0|\+84)[0-9]{8,10}$", phone.replace(" ", "")):
        raise HTTPException(status_code=400, detail="Số điện thoại không đúng định dạng.")
    if date_of_birth:
        try:
            if date.fromisoformat(date_of_birth) >= date.today():
                raise HTTPException(status_code=400, detail="Ngày sinh không hợp lệ.")
        except ValueError:
            raise HTTPException(status_code=400, detail="Ngày sinh không đúng định dạng.")

    post_res = supabase.table("posts").select(public_post_select()).eq("id", post_id).is_("deleted_at", "null").limit(1).execute()
    if not post_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy tin tuyển dụng.")
    post = format_post(post_res.data[0])
    job = post.get("job_post")
    if post["status"] != "published" or post["post_type"] != "recruitment" or not job:
        raise HTTPException(status_code=400, detail="Tin tuyển dụng không nhận hồ sơ trực tuyến.")
    if not job.get("allow_online_application"):
        raise HTTPException(status_code=400, detail="Tin tuyển dụng này không nhận hồ sơ trực tuyến.")
    if job.get("application_deadline") and date.fromisoformat(job["application_deadline"]) < date.today():
        raise HTTPException(status_code=400, detail="Tin tuyển dụng đã hết hạn ứng tuyển.")

    # Cơ sở & ca: dữ liệu chính thức lấy từ bài tuyển dụng, không tin ID/text client
    preferred_branch_id, branch_name = resolve_application_branch(job, preferred_branch_id)
    preferred_shift_id, resolved_shift_label = resolve_application_shift(job, preferred_shift_id, preferred_shift)

    cv_content = validate_cv(cv)
    application_code = f"GKCV-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    cv_path = upload_cv(cv, cv_content, application_code)
    now = datetime.utcnow().isoformat()
    insert_data = {
        "application_code": application_code,
        "job_post_id": job["id"],
        "full_name": full_name.strip(),
        "date_of_birth": date_of_birth or None,
        "phone": phone.strip(),
        "email": str(email) if email else None,
        "address": address,
        "preferred_branch_id": preferred_branch_id,
        # preferred_shift lưu label đã resolve từ dữ liệu bài — không phải text client
        "preferred_shift": resolved_shift_label,
        "experience": experience,
        "education": education,
        "available_date": available_date or None,
        "expected_salary": expected_salary,
        "introduction": introduction,
        "cv_path": cv_path,
        "status": "NEW",
        "submitted_at": now,
        "created_at": now,
        "updated_at": now,
    }
    if has_column("job_applications", "preferred_shift_id"):
        insert_data["preferred_shift_id"] = preferred_shift_id
    res = supabase.table("job_applications").insert(insert_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Không thể lưu hồ sơ ứng tuyển.")
    application = res.data[0]
    supabase.table("job_application_logs").insert({
        "application_id": application["id"],
        "action": "SUBMITTED",
        "new_status": "NEW",
        "note": "Ứng viên gửi hồ sơ trực tuyến",
        "created_at": now,
    }).execute()

    email_data = {
        "full_name": full_name,
        "application_code": application_code,
        "job_title": job.get("job_title") or post["title"],
        "branch_name": branch_name,
        "shift_name": resolved_shift_label or "",
        "application_date": datetime.utcnow().strftime("%d/%m/%Y"),
        "job_url": f"{settings.FRONTEND_URL}/bai-viet/{post['slug']}",
        "support_email": settings.MAIL_FROM_EMAIL or "",
        "support_phone": job.get("contact_phone") or "",
        "company_name": "Giặt Ký",
        "phone": phone,
        "email": str(email or ""),
        "available_date": available_date or "",
        "admin_application_url": f"{settings.FRONTEND_URL}/admin/content?tab=applications&id={application['id']}",
    }
    try:
        if email:
            send_application_email("JOB_APPLICATION_RECEIVED", str(email), email_data)
    except Exception as e:
        logger.warning(f"Applicant confirmation email failed: {str(e)}")
    try:
        hr_email = job.get("receiving_email")
        if not hr_email:
            email_settings = get_email_settings_record()
            hr_email = (email_settings or {}).get("sender_email") or settings.MAIL_FROM_EMAIL
        if hr_email:
            send_application_email("NEW_JOB_APPLICATION", hr_email, email_data)
    except Exception as e:
        logger.warning(f"Admin application email failed: {str(e)}")

    return {
        "message": "Gửi hồ sơ ứng tuyển thành công. Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất.",
        "application": application,
        "job_title": job.get("job_title") or post["title"],
        "branch_name": branch_name,
        "shift_name": resolved_shift_label or "",
    }


@admin_router.get("/posts", dependencies=[Depends(require_role(["admin", "manager"]))])
def admin_posts(search: Optional[str] = None, post_type: Optional[str] = None, status_filter: Optional[str] = None, page: int = 1, page_size: int = 50):
    query = supabase.table("posts").select(public_post_select()).is_("deleted_at", "null")
    if search:
        query = query.ilike("title", f"%{search}%")
    if post_type:
        query = query.eq("post_type", post_type)
    if status_filter:
        query = query.eq("status", status_filter)
    offset = max(page - 1, 0) * page_size
    res = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
    return [format_post(row) for row in (res.data or [])]


@admin_router.post("/posts", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_post(payload: PostPayload, current_user: dict = Depends(get_current_user)):
    validate_post_payload(payload)
    row = post_payload_to_row(payload, current_user)
    row["created_at"] = datetime.utcnow().isoformat()
    res = supabase.table("posts").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Không thể tạo bài viết.")
    post = res.data[0]
    save_job_post(post["id"], payload.job_post if payload.post_type == "recruitment" else None)
    detail = supabase.table("posts").select(public_post_select()).eq("id", post["id"]).limit(1).execute()
    return format_post(detail.data[0])


@admin_router.get("/posts/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def admin_post_detail(id: str):
    res = supabase.table("posts").select(public_post_select()).eq("id", id).is_("deleted_at", "null").limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
    return format_post(res.data[0])


@admin_router.put("/posts/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_post(id: str, payload: PostPayload, current_user: dict = Depends(get_current_user)):
    validate_post_payload(payload)
    existing = supabase.table("posts").select("id").eq("id", id).is_("deleted_at", "null").limit(1).execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài viết.")
    row = post_payload_to_row(payload, current_user, id)
    res = supabase.table("posts").update(row).eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Không thể cập nhật bài viết.")
    save_job_post(id, payload.job_post if payload.post_type == "recruitment" else None)
    detail = supabase.table("posts").select(public_post_select()).eq("id", id).limit(1).execute()
    return format_post(detail.data[0])


@admin_router.delete("/posts/{id}", dependencies=[Depends(require_role(["admin"]))])
def delete_post(id: str):
    supabase.table("posts").update({"deleted_at": datetime.utcnow().isoformat(), "status": "hidden"}).eq("id", id).execute()
    return {"message": "Đã xóa bài viết."}


@admin_router.post("/posts/{id}/publish", dependencies=[Depends(require_role(["admin", "manager"]))])
def publish_post(id: str):
    res = supabase.table("posts").update({"status": "published", "published_at": datetime.utcnow().isoformat()}).eq("id", id).execute()
    return res.data[0] if res.data else {"message": "Đã xuất bản bài viết."}


@admin_router.post("/posts/{id}/unpublish", dependencies=[Depends(require_role(["admin", "manager"]))])
def unpublish_post(id: str):
    res = supabase.table("posts").update({"status": "hidden"}).eq("id", id).execute()
    return res.data[0] if res.data else {"message": "Đã ẩn bài viết."}


@admin_router.post("/posts/{id}/duplicate", dependencies=[Depends(require_role(["admin", "manager"]))])
def duplicate_post(id: str, current_user: dict = Depends(get_current_user)):
    detail = admin_post_detail(id)
    row = {k: detail.get(k) for k in [
        "title", "excerpt", "content", "post_type", "featured_image", "category", "tags",
        "is_featured", "sort_order", "meta_title", "meta_description", "keywords",
        "canonical_url", "og_image", "allow_application_form", "allow_comments"
    ]}
    row["title"] = f"{detail['title']} (bản sao)"
    row["slug"] = ensure_unique_slug(f"{detail['slug']}-copy")
    row["status"] = "draft"
    row["author_id"] = current_user["id"]
    row["created_at"] = datetime.utcnow().isoformat()
    row["updated_at"] = datetime.utcnow().isoformat()
    res = supabase.table("posts").insert(row).execute()
    if detail.get("job_post") and res.data:
        job = detail["job_post"]
        payload = JobPostPayload(**{**job, "branch_ids": [b["branch_id"] for b in job.get("branches", [])]})
        save_job_post(res.data[0]["id"], payload)
    return res.data[0]


def format_application(row: dict) -> dict:
    item = dict(row)
    job = item.pop("job_posts", None)
    if job:
        post = job.get("posts") or {}
        item["job_title"] = job.get("job_title") or post.get("title")
        item["post_title"] = post.get("title")
        item["post_slug"] = post.get("slug")
    branch = item.pop("branches", None)
    item["branch_name"] = (branch or {}).get("name")
    assignee = item.pop("assigned_user", None)
    item["assigned_to_name"] = (assignee or {}).get("full_name")
    return item


@admin_router.get("/job-applications", dependencies=[Depends(require_role(["admin", "manager"]))])
def admin_applications(search: Optional[str] = None, status_filter: Optional[str] = None, page: int = 1, page_size: int = 50):
    query = supabase.table("job_applications")\
        .select("*, job_posts(job_title, posts(title, slug)), branches(name), assigned_user:users!job_applications_assigned_to_fkey(full_name)")\
        .is_("deleted_at", "null")
    if search:
        query = query.or_(f"full_name.ilike.%{search}%,phone.ilike.%{search}%,email.ilike.%{search}%,application_code.ilike.%{search}%")
    if status_filter:
        query = query.eq("status", status_filter)
    offset = max(page - 1, 0) * page_size
    res = query.order("submitted_at", desc=True).range(offset, offset + page_size - 1).execute()
    return [format_application(row) for row in (res.data or [])]


@admin_router.get("/job-applications/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def admin_application_detail(id: str):
    res = supabase.table("job_applications")\
        .select("*, job_posts(job_title, posts(title, slug)), branches(name), assigned_user:users!job_applications_assigned_to_fkey(full_name)")\
        .eq("id", id).is_("deleted_at", "null").limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy hồ sơ ứng tuyển.")
    return format_application(res.data[0])


@admin_router.put("/job-applications/{id}/status", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_application_status(id: str, payload: ApplicationUpdate, current_user: dict = Depends(get_current_user)):
    old = admin_application_detail(id)
    update_data = {}
    if payload.status:
        if payload.status not in APPLICATION_STATUSES:
            raise HTTPException(status_code=400, detail="Trạng thái hồ sơ không hợp lệ.")
        update_data["status"] = payload.status
    if payload.internal_note is not None:
        update_data["internal_note"] = payload.internal_note
    if payload.assigned_to is not None:
        update_data["assigned_to"] = payload.assigned_to or None
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
    update_data["updated_at"] = datetime.utcnow().isoformat()
    res = supabase.table("job_applications").update(update_data).eq("id", id).execute()
    new_status = update_data.get("status", old.get("status"))
    supabase.table("job_application_logs").insert({
        "application_id": id,
        "action": "UPDATED",
        "old_status": old.get("status"),
        "new_status": new_status,
        "note": payload.internal_note,
        "changed_by": current_user["id"],
    }).execute()
    return res.data[0]


@admin_router.put("/job-applications/{id}/assign", dependencies=[Depends(require_role(["admin", "manager"]))])
def assign_application(id: str, payload: ApplicationUpdate, current_user: dict = Depends(get_current_user)):
    return update_application_status(id, payload, current_user)


@admin_router.put("/job-applications/{id}/note", dependencies=[Depends(require_role(["admin", "manager"]))])
def note_application(id: str, payload: ApplicationUpdate, current_user: dict = Depends(get_current_user)):
    return update_application_status(id, payload, current_user)


@admin_router.get("/job-applications/{id}/logs", dependencies=[Depends(require_role(["admin", "manager"]))])
def application_logs(id: str):
    res = supabase.table("job_application_logs").select("*, users!changed_by(full_name)").eq("application_id", id).order("created_at", desc=True).execute()
    return res.data or []


@admin_router.post("/job-applications/{id}/resend-email", dependencies=[Depends(require_role(["admin", "manager"]))])
def resend_application_email(id: str):
    application = admin_application_detail(id)
    if not application.get("email"):
        raise HTTPException(status_code=400, detail="Hồ sơ không có email ứng viên.")
    send_application_email("JOB_APPLICATION_RECEIVED", application["email"], {
        "full_name": application["full_name"],
        "application_code": application["application_code"],
        "job_title": application.get("job_title") or "",
        "branch_name": application.get("branch_name") or "",
        "application_date": application.get("submitted_at") or "",
        "job_url": f"{settings.FRONTEND_URL}/bai-viet/{application.get('post_slug') or ''}",
        "support_email": settings.MAIL_FROM_EMAIL or "",
        "support_phone": "",
        "company_name": "Giặt Ký",
    })
    return {"message": "Đã gửi lại email xác nhận."}

