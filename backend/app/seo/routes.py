import html
import logging
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from pydantic import BaseModel

from app.common.db_features import filter_columns, has_column
from app.common.dependencies import get_current_user, require_role
from app.database import supabase

logger = logging.getLogger("app.seo")
router = APIRouter(prefix="/seo-settings", tags=["SEO"])

SEO_BUCKET = "seo-assets"
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5 MB

# Magic-byte signatures — MIME is verified from file content, not just the extension
IMAGE_SIGNATURES = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/webp": [b"RIFF"],  # + WEBP at offset 8, checked below
    "image/x-icon": [b"\x00\x00\x01\x00"],
}
EXTENSION_BY_MIME = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
}

DOMAIN_RE = re.compile(r"^(localhost|[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+)$")


def normalize_domain(raw: str) -> str:
    """Normalize user input like 'https://www.Giatky.vn/' -> 'giatky.vn'.

    Rejects paths, query strings, fragments and invalid hostnames.
    """
    value = (raw or "").strip().lower()
    value = re.sub(r"^https?://", "", value)
    value = value.rstrip("/")
    if value.startswith("www."):
        value = value[4:]
    # strip port for matching purposes (localhost:5173 -> localhost)
    value = value.split(":")[0]
    if not value:
        raise HTTPException(status_code=400, detail="Domain không được để trống.")
    if any(c in value for c in ["/", "?", "#", " "]):
        raise HTTPException(status_code=400, detail="Domain không hợp lệ: không được chứa đường dẫn con, query hoặc khoảng trắng.")
    if not DOMAIN_RE.match(value):
        raise HTTPException(status_code=400, detail=f"Domain '{value}' không đúng định dạng hợp lệ.")
    return value


def sniff_image_mime(content: bytes) -> Optional[str]:
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"RIFF") and len(content) > 12 and content[8:12] == b"WEBP":
        return "image/webp"
    if content.startswith(b"\x00\x00\x01\x00"):
        return "image/x-icon"
    return None


# Các cột chỉ tồn tại sau khi chạy migration seo_email_module_migration.sql —
# payload được lọc qua filter_columns() nên backend chạy được cả trước migration.
SEO_EXTENDED_COLUMNS = {
    "robots", "og_title", "og_description",
    "twitter_card", "twitter_title", "twitter_description", "twitter_image",
    "favicon",
}


class SeoSettingsBase(BaseModel):
    domain: str
    page_key: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_image: Optional[str] = None
    robots: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    twitter_card: Optional[str] = None
    twitter_title: Optional[str] = None
    twitter_description: Optional[str] = None
    twitter_image: Optional[str] = None
    favicon: Optional[str] = None


class SeoSettingsCreate(SeoSettingsBase):
    pass


class SeoSettingsUpdate(BaseModel):
    domain: Optional[str] = None
    page_key: Optional[str] = None
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_image: Optional[str] = None
    robots: Optional[str] = None
    og_title: Optional[str] = None
    og_description: Optional[str] = None
    twitter_card: Optional[str] = None
    twitter_title: Optional[str] = None
    twitter_description: Optional[str] = None
    twitter_image: Optional[str] = None
    favicon: Optional[str] = None


def _format_row(row: dict) -> dict:
    out = dict(row)
    updater = out.pop("users", None)
    out["updated_by_name"] = (updater or {}).get("full_name") if updater else None
    return out


@router.get("")
def get_seo_settings():
    """Retrieve SEO settings for all domains."""
    response = supabase.table("seo_settings").select("*, users!updated_by(full_name)").order("updated_at", desc=True).execute()
    return [_format_row(r) for r in (response.data or [])]


@router.get("/by-domain")
def get_seo_by_domain(request: Request, host: Optional[str] = Query(None)):
    """Resolve the SEO config for the domain currently being visited.

    Prefers the real request hostname (Host / X-Forwarded-Host); an explicit
    ?host= is only a development convenience.
    """
    raw = host or request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    raw = raw.split(",")[0].strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Không xác định được domain từ request.")
    domain = normalize_domain(raw)

    res = supabase.table("seo_settings").select("*").eq("domain", domain).limit(1).execute()
    if res.data:
        return res.data[0]
    raise HTTPException(status_code=404, detail=f"Chưa có cấu hình SEO cho domain '{domain}'.")


def build_head_tags(seo: dict) -> str:
    """Sinh đầy đủ <title>, <meta>, OpenGraph, Twitter Card, Canonical từ một
    cấu hình SEO. Mọi giá trị đều được escape để chèn thẳng vào <head>."""
    domain = seo.get("domain") or ""
    title = seo.get("meta_title") or ""
    description = seo.get("meta_description") or ""
    keywords = seo.get("keywords") or ""
    canonical = seo.get("canonical_url") or (f"https://{domain}" if domain else "")
    robots = seo.get("robots") or "index, follow"
    og_title = seo.get("og_title") or title
    og_description = seo.get("og_description") or description
    og_image = seo.get("og_image") or ""
    twitter_card = seo.get("twitter_card") or "summary_large_image"
    twitter_title = seo.get("twitter_title") or og_title
    twitter_description = seo.get("twitter_description") or og_description
    twitter_image = seo.get("twitter_image") or og_image
    favicon = seo.get("favicon") or ""

    e = lambda v: html.escape(str(v), quote=True)
    lines = []
    if title:
        lines.append(f"<title>{e(title)}</title>")
        lines.append(f'<meta name="title" content="{e(title)}" />')
    if description:
        lines.append(f'<meta name="description" content="{e(description)}" />')
    if keywords:
        lines.append(f'<meta name="keywords" content="{e(keywords)}" />')
    lines.append(f'<meta name="robots" content="{e(robots)}" />')
    if canonical:
        lines.append(f'<link rel="canonical" href="{e(canonical)}" />')
    if favicon:
        lines.append(f'<link rel="icon" href="{e(favicon)}" />')
    # Open Graph
    lines.append('<meta property="og:type" content="website" />')
    if canonical:
        lines.append(f'<meta property="og:url" content="{e(canonical)}" />')
    if og_title:
        lines.append(f'<meta property="og:title" content="{e(og_title)}" />')
    if og_description:
        lines.append(f'<meta property="og:description" content="{e(og_description)}" />')
    if og_image:
        lines.append(f'<meta property="og:image" content="{e(og_image)}" />')
    # Twitter Card
    lines.append(f'<meta name="twitter:card" content="{e(twitter_card)}" />')
    if twitter_title:
        lines.append(f'<meta name="twitter:title" content="{e(twitter_title)}" />')
    if twitter_description:
        lines.append(f'<meta name="twitter:description" content="{e(twitter_description)}" />')
    if twitter_image:
        lines.append(f'<meta name="twitter:image" content="{e(twitter_image)}" />')
    return "\n".join(lines)


@router.get("/head-tags")
def get_seo_head_tags(request: Request, host: Optional[str] = Query(None), id: Optional[str] = Query(None)):
    """Trả về bộ thẻ <head> hoàn chỉnh cho website sử dụng.

    - ?host=domain (hoặc theo Host header như /by-domain) — dùng cho website public.
    - ?id=<uuid> — dùng cho nút Preview trong trang quản trị.
    """
    if id:
        res = supabase.table("seo_settings").select("*").eq("id", id).limit(1).execute()
    else:
        raw = host or request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
        raw = raw.split(",")[0].strip()
        if not raw:
            raise HTTPException(status_code=400, detail="Không xác định được domain từ request.")
        domain = normalize_domain(raw)
        res = supabase.table("seo_settings").select("*").eq("domain", domain).limit(1).execute()

    if not res.data:
        raise HTTPException(status_code=404, detail="Chưa có cấu hình SEO phù hợp.")
    seo = res.data[0]
    return {"domain": seo.get("domain"), "html": build_head_tags(seo)}


@router.get("/{id}")
def get_seo_setting(id: str):
    res = supabase.table("seo_settings").select("*, users!updated_by(full_name)").eq("id", id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình SEO.")
    return _format_row(res.data[0])


@router.post("", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_seo_settings(payload: SeoSettingsCreate, current_user: dict = Depends(get_current_user)):
    domain = normalize_domain(payload.domain)

    # One SEO config per domain
    chk = supabase.table("seo_settings").select("id").eq("domain", domain).execute()
    if chk.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Domain này đã có cấu hình SEO.")

    insert_data = filter_columns("seo_settings", payload.model_dump(), SEO_EXTENDED_COLUMNS)
    insert_data["domain"] = domain
    # page_key mirrors the normalized domain: reuses the existing UNIQUE(page_key)
    # constraint as a database-level duplicate-domain guard.
    insert_data["page_key"] = domain
    if not insert_data.get("canonical_url"):
        insert_data["canonical_url"] = f"https://{domain}"
    insert_data["updated_by"] = current_user["id"]

    response = supabase.table("seo_settings").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo cấu hình SEO.")
    return response.data[0]


@router.put("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_seo_settings(id: str, payload: SeoSettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    update_data = filter_columns("seo_settings", update_data, SEO_EXTENDED_COLUMNS)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")

    if "domain" in update_data:
        domain = normalize_domain(update_data["domain"])
        dup = supabase.table("seo_settings").select("id").eq("domain", domain).neq("id", id).execute()
        if dup.data:
            raise HTTPException(status_code=400, detail="Domain này đã có cấu hình SEO.")
        update_data["domain"] = domain
        update_data["page_key"] = domain

    update_data["updated_by"] = current_user["id"]
    update_data["updated_at"] = datetime.utcnow().isoformat()

    response = supabase.table("seo_settings").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình SEO.")
    return response.data[0]


@router.delete("/upload-image", dependencies=[Depends(require_role(["admin", "manager"]))])
def delete_seo_image(path: str = Query(...), exclude_id: Optional[str] = Query(None)):
    """Delete an uploaded SEO image, refusing when another config still uses it."""
    clean = path.strip()
    if ".." in clean or clean.startswith("/") or not clean.startswith("seo/"):
        raise HTTPException(status_code=400, detail="Đường dẫn ảnh không hợp lệ.")

    used_q = supabase.table("seo_settings").select("id, og_image").like("og_image", f"%{clean}%")
    if exclude_id:
        used_q = used_q.neq("id", exclude_id)
    used = used_q.execute()
    if used.data:
        raise HTTPException(status_code=400, detail="Ảnh đang được cấu hình SEO khác sử dụng, không thể xóa.")

    try:
        supabase.storage.from_(SEO_BUCKET).remove([clean])
    except Exception as e:
        logger.error(f"Failed to delete SEO image {clean}: {str(e)}")
        raise HTTPException(status_code=500, detail="Xóa ảnh trong Storage thất bại.")
    return {"message": "Đã xóa ảnh."}


@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def delete_seo_settings(id: str):
    target = supabase.table("seo_settings").select("*").eq("id", id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình SEO.")
    row = target.data[0]

    supabase.table("seo_settings").delete().eq("id", id).execute()

    # Remove the OG image object only when no other config still references it
    og = row.get("og_image") or ""
    path = _storage_path_from_url(og)
    if path:
        still_used = supabase.table("seo_settings").select("id").eq("og_image", og).execute()
        if not still_used.data:
            try:
                supabase.storage.from_(SEO_BUCKET).remove([path])
            except Exception as e:
                logger.error(f"Failed to remove SEO image {path}: {str(e)}")

    return {"message": "Đã xóa cấu hình SEO."}


def _storage_path_from_url(url: str) -> Optional[str]:
    if not url:
        return None
    marker = f"/object/public/{SEO_BUCKET}/"
    if marker in url:
        return url.split(marker, 1)[1].split("?")[0]
    if url.startswith("seo/"):
        return url
    return None


@router.post("/upload-image", dependencies=[Depends(require_role(["admin", "manager"]))])
async def upload_seo_image(
    file: UploadFile = File(...),
    domain: str = Form("general"),
    kind: str = Form("og"),
):
    """Upload an SEO image to Supabase Storage via the backend (multipart only).

    Validates size and real MIME (magic bytes), renames to UUID, and returns
    the storage path + public URL to be saved on the SEO record.
    """
    if kind not in ("og", "favicon", "logo", "twitter"):
        raise HTTPException(status_code=400, detail="Loại ảnh không hợp lệ.")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="File rỗng hoặc không đọc được.")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Ảnh vượt quá dung lượng tối đa 5 MB.")

    mime = sniff_image_mime(content)
    if not mime:
        raise HTTPException(
            status_code=400,
            detail="File không phải ảnh hợp lệ. Chỉ chấp nhận JPG, PNG, WEBP (favicon: thêm ICO)."
        )
    if kind != "favicon" and mime == "image/x-icon":
        raise HTTPException(status_code=400, detail="Định dạng ICO chỉ dùng cho favicon.")

    # Safe folder segment from the (normalized) domain — never trust raw input in paths
    try:
        safe_domain = normalize_domain(domain) if domain and domain != "general" else "general"
    except HTTPException:
        safe_domain = "general"

    ext = EXTENSION_BY_MIME[mime]
    object_path = f"seo/{safe_domain}/{kind}/{uuid.uuid4()}.{ext}"

    try:
        supabase.storage.from_(SEO_BUCKET).upload(
            object_path, content, {"content-type": mime, "cache-control": "3600"}
        )
    except Exception as e:
        logger.error(f"SEO image upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload ảnh thất bại: {str(e)}")

    public_url = supabase.storage.from_(SEO_BUCKET).get_public_url(object_path).split("?")[0]
    return {
        "path": object_path,
        "public_url": public_url,
        "original_name": file.filename,
        "mime_type": mime,
        "size": len(content),
        "uploaded_at": datetime.utcnow().isoformat(),
    }
