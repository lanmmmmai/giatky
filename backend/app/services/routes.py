from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid

from app.common.dependencies import get_current_user, require_role
from app.database import supabase

router = APIRouter(prefix="/services", tags=["Services"])

class ServiceBase(BaseModel):
    name: str
    category: Optional[str] = None
    unit: str = "kg"
    price: int = Field(default=0, ge=0)
    description: Optional[str] = None
    is_active: bool = True

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    unit: Optional[str] = None
    price: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ServiceImportItem(BaseModel):
    name: str
    category: Optional[str] = None
    unit: Optional[str] = "kg"
    price: int
    description: Optional[str] = None

class ServiceImportRequest(BaseModel):
    services: List[ServiceImportItem]

@router.get("")
def get_services(current_user: dict = Depends(get_current_user)):
    # All active users can read services
    response = supabase.table("services").select("*").order("category").order("name").execute()
    return response.data or []

@router.post("", dependencies=[Depends(require_role(["admin", "manager"]))])
def create_service(payload: ServiceCreate, current_user: dict = Depends(get_current_user)):
    insert_data = payload.model_dump()
    insert_data["created_by"] = current_user["id"]
    
    response = supabase.table("services").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo dịch vụ.")
    return response.data[0]

@router.put("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def update_service(id: str, payload: ServiceUpdate):
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")
        
    response = supabase.table("services").update(update_data).eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")
    return response.data[0]

@router.delete("/{id}", dependencies=[Depends(require_role(["admin", "manager"]))])
def delete_service(id: str):
    # Hard delete if possible, otherwise we can soft delete using is_active=False
    # Let's check if the service is used in order_items
    orders_check = supabase.table("order_items").select("id").eq("service_id", id).execute()
    if orders_check.data:
        # Soft delete instead
        supabase.table("services").update({"is_active": False}).eq("id", id).execute()
        return {"message": "Dịch vụ đã từng có đơn hàng. Đã chuyển trạng thái sang ngưng hoạt động."}
        
    response = supabase.table("services").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy dịch vụ.")
    return {"message": "Xóa dịch vụ thành công."}

@router.post("/import-excel", dependencies=[Depends(require_role(["admin", "manager"]))])
def import_excel_services(payload: ServiceImportRequest, current_user: dict = Depends(get_current_user)):
    imported_count = 0
    errors = []
    
    # Process and validate items
    to_insert = []
    for idx, item in enumerate(payload.services):
        line = idx + 1
        if not item.name or not item.name.strip():
            errors.append(f"Dòng {line}: Tên dịch vụ không được trống.")
            continue
        if item.price is None or item.price < 0:
            errors.append(f"Dòng {line}: Đơn giá không hợp lệ.")
            continue
            
        to_insert.append({
            "name": item.name.strip(),
            "category": item.category.strip() if item.category else "Chưa phân loại",
            "unit": item.unit.strip() if item.unit else "kg",
            "price": item.price,
            "description": item.description,
            "is_active": True,
            "created_by": current_user["id"]
        })
        
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"message": "Dữ liệu Excel có lỗi.", "errors": errors}
        )
        
    if to_insert:
        response = supabase.table("services").insert(to_insert).execute()
        imported_count = len(response.data or [])
        
    return {
        "success": True,
        "message": f"Nhập thành công {imported_count} dịch vụ.",
        "imported_count": imported_count
    }
