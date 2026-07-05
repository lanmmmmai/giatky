from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from app.common.dependencies import get_current_user, require_role
from app.database import supabase

router = APIRouter(prefix="/seo-settings", tags=["SEO"])

class SeoSettingsBase(BaseModel):
    domain: str
    page_key: str
    meta_title: Optional[str] = None
    meta_description: Optional[str] = None
    keywords: Optional[str] = None
    canonical_url: Optional[str] = None
    og_image: Optional[str] = None

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

@router.get("")
def get_seo_settings():
    """Retrieve SEO settings for all pages."""
    response = supabase.table("seo_settings").select("*").order("page_key").execute()
    return response.data or []

@router.post("", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_seo_settings(payload: SeoSettingsCreate, current_user: dict = Depends(get_current_user)):
    # Check if page_key already exists
    chk = supabase.table("seo_settings").select("id").eq("page_key", payload.page_key).execute()
    if chk.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cấu hình SEO cho trang '{payload.page_key}' đã tồn tại."
        )
        
    insert_data = payload.model_dump()
    insert_data["updated_by"] = current_user["id"]
    
    response = supabase.table("seo_settings").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo cấu hình SEO.")
    return response.data[0]

@router.put("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_seo_settings(id: str, payload: SeoSettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    update_data["updated_by"] = current_user["id"]
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("seo_settings").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình SEO.")
    return response.data[0]
