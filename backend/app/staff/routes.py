from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.database import supabase
from app.common.dependencies import require_role

router = APIRouter(prefix="/staff", tags=["Staff Requests"])


class ShiftRegistrationRequestCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=150)
    phone: str = Field(..., min_length=9, max_length=16)
    email: Optional[EmailStr] = None
    date_of_birth: Optional[date] = None
    address: Optional[str] = None
    desired_shift: str = Field(..., min_length=1, max_length=120)
    available_start_date: date
    branch_id: str
    note: Optional[str] = None

    @field_validator("full_name", "phone", "desired_shift", "branch_id")
    @classmethod
    def strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Trường này là bắt buộc.")
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        normalized = value.replace(" ", "")
        if not (normalized.startswith("0") or normalized.startswith("+84")):
            raise ValueError("Số điện thoại không đúng định dạng.")
        digits = normalized[1:] if normalized.startswith("0") else normalized[3:]
        if not digits.isdigit() or len(digits) < 8 or len(digits) > 10:
            raise ValueError("Số điện thoại không đúng định dạng.")
        return normalized

    @field_validator("available_start_date")
    @classmethod
    def validate_start_date(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Ngày bắt đầu không được nhỏ hơn ngày hiện tại.")
        return value


@router.post("/shift-registration-requests", status_code=status.HTTP_201_CREATED)
def create_shift_registration_request(payload: ShiftRegistrationRequestCreate):
    branch_res = supabase.table("branches")\
        .select("id")\
        .eq("id", payload.branch_id)\
        .eq("status", "active")\
        .execute()
    if not branch_res.data:
        raise HTTPException(status_code=400, detail="Chi nhánh không hợp lệ hoặc đã ngừng hoạt động.")

    insert_data = {
        "full_name": payload.full_name,
        "phone": payload.phone,
        "email": str(payload.email) if payload.email else None,
        "date_of_birth": payload.date_of_birth.isoformat() if payload.date_of_birth else None,
        "address": payload.address,
        "desired_shift": payload.desired_shift,
        "available_start_date": payload.available_start_date.isoformat(),
        "branch_id": payload.branch_id,
        "note": payload.note,
        "status": "PENDING",
        "created_at": datetime.utcnow().isoformat()
    }

    response = supabase.table("staff_shift_registration_requests").insert(insert_data).execute()
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể lưu yêu cầu đăng ký ca.")

    return {
        "message": "Gửi yêu cầu đăng ký ca thành công. Quản trị viên sẽ liên hệ với bạn.",
        "request": response.data[0]
    }


@router.get("/shift-registration-requests", dependencies=[Depends(require_role(["admin", "manager"]))])
def list_shift_registration_requests(
    status_filter: Optional[str] = None,
    branch_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    query = supabase.table("staff_shift_registration_requests")\
        .select("*, branches(name)")\
        .order("created_at", desc=True)\
        .range(max(page - 1, 0) * page_size, max(page, 1) * page_size - 1)
    if status_filter:
        query = query.eq("status", status_filter)
    if branch_id:
        query = query.eq("branch_id", branch_id)
    response = query.execute()
    results = []
    for row in (response.data or []):
        item = dict(row)
        item["branch_name"] = (row.get("branches") or {}).get("name")
        item.pop("branches", None)
        results.append(item)
    return results
