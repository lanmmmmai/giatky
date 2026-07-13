from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import logging
import uuid

from app.common.dependencies import get_current_user, require_role, require_branch_access
from app.config import settings
from app.database import supabase
from app.email.email_service import send_template_email, send_trigger_email

logger = logging.getLogger("app.orders")
router = APIRouter(prefix="/orders", tags=["Orders"])

# Schemas
class CustomerInfo(BaseModel):
    phone: str
    full_name: str
    email: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    note: Optional[str] = None

class CustomerCreate(BaseModel):
    phone: str
    full_name: str
    email: Optional[str] = None
    address: Optional[str] = None
    date_of_birth: Optional[date] = None
    note: Optional[str] = None

class OrderItemCreate(BaseModel):
    service_id: Optional[str] = None
    service_name_snapshot: str
    unit: str = "kg"
    quantity: float
    unit_price: int
    amount: int

class OrderCreate(BaseModel):
    customer: CustomerInfo
    branch_id: str
    received_at: Optional[datetime] = None
    expected_return_at: Optional[datetime] = None
    note: Optional[str] = None
    items: List[OrderItemCreate]
    surcharge: int = 0
    discount: int = 0
    payment_status: str = "unpaid" # unpaid | paid | partial
    payment_method: str = "none" # cash | bank_transfer | e_wallet | none
    paid_amount: int = 0

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(new|washing|drying|ready|delivered|cancelled)$")

class OrderPaymentUpdate(BaseModel):
    payment_status: str = Field(..., pattern="^(unpaid|paid|partial)$")
    payment_method: str = Field(..., pattern="^(cash|bank_transfer|e_wallet|none)$")
    paid_amount: int

class CompleteDeliveryRequest(BaseModel):
    payment_method: Optional[str] = None
    note: Optional[str] = None

class OrderUpdate(BaseModel):
    received_at: Optional[datetime] = None
    expected_return_at: Optional[datetime] = None
    note: Optional[str] = None
    surcharge: Optional[int] = None
    discount: Optional[int] = None


# Timezone Việt Nam — dùng để hiển thị thời gian trong email/thông báo
VN_TZ = timezone(timedelta(hours=7))


def as_aware_utc(dt: datetime) -> datetime:
    """Chuẩn hóa datetime để so sánh: giá trị naive được coi là UTC
    (đúng với cách Postgres/Supabase lưu TIMESTAMPTZ khi nhận chuỗi naive)."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def validate_return_after_received(received_at: Optional[datetime], expected_return_at: Optional[datetime]):
    """Ngày trả không được nhỏ hơn hoặc bằng ngày giờ nhận."""
    if received_at and expected_return_at:
        if as_aware_utc(expected_return_at) <= as_aware_utc(received_at):
            raise HTTPException(status_code=400, detail="Ngày trả phải sau ngày nhận.")

# Map trạng thái đơn → trigger email (mẫu quản lý trong CMS → Email Templates).
# Chỉ gửi khi admin đã tạo và bật mẫu cho trigger tương ứng — không hard-code nội dung.
ORDER_STATUS_TRIGGER_MAP = {
    "washing": "ORDER_WASHING",
    "drying": "ORDER_DRYING",
    "ready": "ORDER_COMPLETED",
    "delivered": "ORDER_DELIVERED",
    "cancelled": "ORDER_CANCELLED",
}

PAYMENT_METHOD_VN = {
    "cash": "Tiền mặt",
    "bank_transfer": "Chuyển khoản",
    "e_wallet": "Ví điện tử",
    "none": "Chưa chọn",
}

PAYMENT_METHODS = {"cash", "bank_transfer", "e_wallet"}
_COLUMN_EXISTS_CACHE: dict[tuple[str, str], bool] = {}


def is_weight_unit(unit: Optional[str]) -> bool:
    normalized_unit = str(unit or "").strip().lower()
    return normalized_unit in {"kg", "kilogram", "ký", "cân"}


def has_column(table_name: str, column_name: str) -> bool:
    """Best-effort schema probe for optional migrations."""
    cache_key = (table_name, column_name)
    if cache_key in _COLUMN_EXISTS_CACHE:
        return _COLUMN_EXISTS_CACHE[cache_key]
    try:
        supabase.table(table_name).select(column_name).limit(1).execute()
        _COLUMN_EXISTS_CACHE[cache_key] = True
    except Exception:
        _COLUMN_EXISTS_CACHE[cache_key] = False
    return _COLUMN_EXISTS_CACHE[cache_key]


def parse_quantity(value) -> Decimal:
    try:
        quantity = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise HTTPException(status_code=400, detail="Số lượng dịch vụ không hợp lệ.")
    if not quantity.is_finite() or quantity <= 0:
        raise HTTPException(status_code=400, detail="Số lượng dịch vụ phải lớn hơn 0.")
    return quantity


def has_more_than_two_decimals(value: Decimal) -> bool:
    return value.as_tuple().exponent < -2


def money_from_decimal(value: Decimal) -> int:
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_payment_method(payment_method: Optional[str]) -> str:
    if not payment_method or payment_method == "none":
        raise HTTPException(status_code=400, detail="Vui lòng chọn hình thức thanh toán.")
    if payment_method not in PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail="Hình thức thanh toán không hợp lệ.")
    return payment_method


def ensure_order_access(order: dict, current_user: dict, action: str = "cập nhật") -> None:
    if current_user["role"] == "manager":
        if current_user.get("current_branch_id") and order["branch_id"] != current_user.get("current_branch_id"):
            raise HTTPException(status_code=403, detail=f"Không có quyền {action} đơn hàng ngoài cơ sở đang chọn.")
        chk = supabase.table("branches").select("id").eq("id", order["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail=f"Không có quyền {action} đơn hàng ở chi nhánh này.")
    elif current_user["role"] == "staff":
        if order["branch_id"] != current_user.get("branch_id"):
            raise HTTPException(status_code=403, detail=f"Không có quyền {action} đơn hàng ở chi nhánh khác.")


def record_order_payment(order: dict, payment_method: str, current_user: dict, note: Optional[str] = None) -> Optional[dict]:
    existing = supabase.table("order_payments").select("*").eq("order_id", order["id"]).eq("status", "success").limit(1).execute()
    if existing.data:
        return existing.data[0]

    amount = int(order.get("total_amount") or 0)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Đơn hàng chưa có tổng tiền hợp lệ.")

    paid_at = datetime.utcnow().isoformat()
    try:
        payment_res = supabase.table("order_payments").insert({
            "order_id": order["id"],
            "payment_method": payment_method,
            "amount": amount,
            "status": "success",
            "paid_at": paid_at,
            "created_by": current_user["id"],
            "note": note,
        }).execute()
    except Exception as payment_err:
        duplicate = supabase.table("order_payments").select("*").eq("order_id", order["id"]).eq("status", "success").limit(1).execute()
        if duplicate.data:
            return duplicate.data[0]
        logger.error(f"Failed to record order payment: {str(payment_err)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Không thể ghi nhận thanh toán.")

    return payment_res.data[0] if payment_res.data else None


def build_order_items_from_services(items: List[OrderItemCreate]) -> tuple[list[dict], int, str]:
    if not items:
        raise HTTPException(status_code=400, detail="Đơn hàng phải có ít nhất một dịch vụ.")

    service_ids = []
    for item in items:
        if not item.service_id:
            raise HTTPException(status_code=400, detail="Dịch vụ trong đơn hàng không hợp lệ.")
        try:
            uuid.UUID(str(item.service_id))
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="Mã dịch vụ không hợp lệ.")
        service_ids.append(item.service_id)

    unique_service_ids = list(dict.fromkeys(service_ids))
    services_res = supabase.table("services").select("id, name, unit, price, is_active").in_("id", unique_service_ids).execute()
    services_by_id = {service["id"]: service for service in (services_res.data or [])}

    if len(services_by_id) != len(unique_service_ids):
        raise HTTPException(status_code=400, detail="Một hoặc nhiều dịch vụ không tồn tại.")

    subtotal = 0
    order_items = []
    service_names = []

    for item in items:
        service = services_by_id[item.service_id]
        if service.get("is_active") is False:
            raise HTTPException(status_code=400, detail=f"Dịch vụ {service.get('name') or item.service_id} đang tạm ngừng.")

        unit = service.get("unit") or "kg"
        quantity = parse_quantity(item.quantity)
        if is_weight_unit(unit):
            if has_more_than_two_decimals(quantity):
                raise HTTPException(status_code=400, detail="Số cân chỉ được tối đa 2 chữ số thập phân.")
            quantity = quantity.quantize(Decimal("0.01"))
        else:
            if quantity != quantity.to_integral_value():
                raise HTTPException(status_code=400, detail="Dịch vụ không tính theo kg phải có số lượng nguyên dương.")
            quantity = quantity.to_integral_value()

        unit_price = int(service.get("price") or 0)
        amount = money_from_decimal(Decimal(unit_price) * quantity)
        subtotal += amount
        service_names.append(service.get("name") or item.service_name_snapshot)
        order_items.append({
            "service_id": item.service_id,
            "service_name_snapshot": service.get("name") or item.service_name_snapshot,
            "unit": unit,
            "quantity": float(quantity) if is_weight_unit(unit) else int(quantity),
            "unit_price": unit_price,
            "amount": amount,
        })

    return order_items, subtotal, ", ".join(service_names)


def build_order_email_context(order: dict, customer: dict, branch_name: str, service_name: str = "", order_status: str = "") -> dict:
    """Gom placeholder chuẩn ({{customer_name}}, {{order_code}}, ...) cho email đơn hàng."""
    def fmt_time(value):
        if not value:
            return ""
        try:
            dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            # Giá trị tz-aware (TIMESTAMPTZ trả về +00:00) → quy về giờ Việt Nam
            if dt.tzinfo is not None:
                dt = dt.astimezone(VN_TZ)
            return dt.strftime("%H:%M %d/%m/%Y")
        except Exception:
            return str(value)

    return {
        "customer_name": customer.get("full_name") or "",
        "customer_email": customer.get("email") or "",
        "customer_phone": customer.get("phone") or "",
        "order_code": order.get("order_code") or "",
        "order_date": fmt_time(order.get("received_at") or order.get("created_at")),
        "branch_name": branch_name,
        "service_name": service_name,
        "order_status": order_status,
        "total": "{:,}đ".format(order.get("total_amount") or 0),
        "payment_method": PAYMENT_METHOD_VN.get(order.get("payment_method") or "none", order.get("payment_method") or ""),
        "pickup_time": fmt_time(order.get("received_at")),
        "delivery_time": fmt_time(order.get("expected_return_at") or order.get("delivered_at")),
        "website": settings.FRONTEND_URL or "https://giatky.site",
        "support_phone": "1900 0000",
        "company_name": "Giặt Ký",
    }


def is_unique_violation(err: Exception) -> bool:
    """Nhận diện lỗi UNIQUE constraint từ PostgREST/Postgres (mã 23505)."""
    text = str(err)
    lowered = text.lower()
    return "23505" in text or "duplicate key" in lowered or "duplicate" in lowered


def is_order_code_conflict(err: Exception) -> bool:
    text = str(err)
    lowered = text.lower()
    return (
        "orders_order_code_key" in text
        or "ORDER_CODE_CONFLICT" in text
        or ("23505" in text and "order_code" in lowered)
        or ("duplicate key" in lowered and "order_code" in lowered)
    )


def is_idempotency_in_progress(err: Exception) -> bool:
    return "IDEMPOTENCY_REQUEST_IN_PROGRESS" in str(err) or "55P03" in str(err)


def order_code_conflict_response() -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "code": "ORDER_CODE_CONFLICT",
            "message": "Mã đơn bị trùng. Hệ thống chưa thể tạo đơn, vui lòng thử lại.",
        },
    )


def idempotency_in_progress_response() -> JSONResponse:
    return JSONResponse(
        status_code=409,
        content={
            "success": False,
            "code": "ORDER_CREATE_IN_PROGRESS",
            "message": "Đơn hàng đang được xử lý, vui lòng chờ trong giây lát.",
        },
    )


def unwrap_rpc_result(data):
    if isinstance(data, list):
        return data[0] if data else None
    return data


def create_order_atomic(order_data: dict, order_items: list[dict], payment_data: Optional[dict], idempotency_key: Optional[str]) -> tuple[dict, dict]:
    """Tạo order_code, order, items và payment trong một transaction PostgreSQL."""
    code_date = datetime.now(VN_TZ).date().isoformat()
    rpc_res = supabase.rpc(
        "create_order_atomic",
        {
            "p_order": order_data,
            "p_items": order_items,
            "p_payment": payment_data,
            "p_idempotency_key": idempotency_key,
            "p_code_date": code_date,
        },
    ).execute()
    result = unwrap_rpc_result(rpc_res.data) or {}
    order = result.get("order") if isinstance(result, dict) else None
    if not order:
        raise HTTPException(status_code=500, detail="Không thể tạo đơn hàng.")
    return order, result


def insert_order_with_unique_retry(order_data: dict, order_items: list[dict], payment_data: Optional[dict], idempotency_key: Optional[str], max_attempts: int = 3) -> tuple[dict, dict]:
    """Gọi RPC transaction; nếu gặp unique trong giai đoạn chuyển đổi thì thử lại có giới hạn."""
    last_err: Optional[Exception] = None
    for attempt in range(max_attempts):
        try:
            return create_order_atomic(order_data, order_items, payment_data, idempotency_key)
        except HTTPException:
            raise
        except Exception as err:
            if not is_order_code_conflict(err):
                raise
            last_err = err
            logger.warning(f"order_code conflict khi tạo đơn (attempt {attempt + 1}/{max_attempts}), xin sequence mới từ DB...")

    logger.error(f"Không thể sinh order_code duy nhất sau {max_attempts} lần: {str(last_err)}")
    raise HTTPException(status_code=409, detail="Không thể tạo mã đơn mới. Vui lòng thử lại.")

def create_order_notification(order_code: str, status_desc: str, branch_id: str, sender_id: str):
    """Log system notification about order events."""
    try:
        supabase.table("notifications").insert({
            "title": f"Đơn hàng {order_code}",
            "content": f"Đơn hàng {order_code} đã chuyển sang trạng thái: {status_desc}.",
            "type": "order",
            "sender_id": sender_id,
            "branch_id": branch_id,
            "target_role": "manager", # Notify managers of this branch
            "send_email": False
        }).execute()
    except Exception as e:
        logger.error(f"Failed to create order notification: {str(e)}")

def build_customer_stats(customer: dict, limit_recent: int = 5) -> dict:
    customer_id = customer.get("id")
    orders_res = supabase.table("orders")\
        .select("id, order_code, received_at, expected_return_at, delivered_at, status, payment_status, total_amount, created_at, users!created_by_staff_id(full_name)")\
        .eq("customer_id", customer_id)\
        .order("received_at", desc=True)\
        .execute()
    orders = orders_res.data or []
    order_ids = [order["id"] for order in orders]
    total_spent = sum(int(order.get("total_amount") or 0) for order in orders)
    total_orders = len(orders)
    total_kg = 0.0
    total_items = 0.0

    if order_ids:
        items_res = supabase.table("order_items").select("unit, quantity").in_("order_id", order_ids[:500]).execute()
        for item in (items_res.data or []):
            quantity = float(item.get("quantity") or 0)
            if is_weight_unit(item.get("unit")):
                total_kg += quantity
            else:
                total_items += quantity

    first_order = min((order.get("received_at") or order.get("created_at") for order in orders if order.get("received_at") or order.get("created_at")), default=None)
    last_order = max((order.get("received_at") or order.get("created_at") for order in orders if order.get("received_at") or order.get("created_at")), default=None)
    average_order = round(total_spent / total_orders, 2) if total_orders else 0
    recent_orders = []
    for order in orders[:limit_recent]:
        recent_orders.append({
            "id": order["id"],
            "order_code": order["order_code"],
            "received_at": order.get("received_at"),
            "expected_return_at": order.get("expected_return_at"),
            "delivered_at": order.get("delivered_at"),
            "status": order.get("status"),
            "payment_status": order.get("payment_status"),
            "total_amount": order.get("total_amount") or 0,
            "staff_name": (order.get("users") or {}).get("full_name") or "Nhân viên",
        })

    enriched = dict(customer)
    enriched.update({
        "total_orders": total_orders,
        "total_spent": total_spent,
        "last_order": last_order,
        "last_order_at": last_order,
        "first_order": first_order,
        "first_order_at": first_order,
        "average_order": average_order,
        "average_order_value": average_order,
        "total_kg": round(total_kg, 2),
        "total_items": round(total_items, 2),
        "is_vip": total_orders >= 20 or total_spent >= 5000000,
        "recent_orders": recent_orders,
    })
    return enriched

def build_customer_list_stats(customer_ids: list[str]) -> dict[str, dict]:
    unique_ids = list(dict.fromkeys([customer_id for customer_id in customer_ids if customer_id]))
    if not unique_ids:
        return {}
    orders_res = supabase.table("orders")\
        .select("customer_id, total_amount")\
        .in_("customer_id", unique_ids[:500])\
        .execute()
    stats = {customer_id: {"total_orders": 0, "total_spent": 0, "is_vip": False} for customer_id in unique_ids}
    for order in (orders_res.data or []):
        customer_id = order.get("customer_id")
        if not customer_id:
            continue
        stats.setdefault(customer_id, {"total_orders": 0, "total_spent": 0, "is_vip": False})
        stats[customer_id]["total_orders"] += 1
        stats[customer_id]["total_spent"] += int(order.get("total_amount") or 0)
    for item in stats.values():
        item["is_vip"] = item["total_orders"] >= 20 or item["total_spent"] >= 5000000
    return stats

@router.get("/customer-lookup/{phone}")
def lookup_customer(phone: str, current_user: dict = Depends(get_current_user)):
    res = supabase.table("customers").select("*").eq("phone", phone).execute()
    if res.data:
        return build_customer_stats(res.data[0])
    return None

@router.get("/customers/search")
def search_customers(query: str, current_user: dict = Depends(get_current_user)):
    value = query.strip()
    if len(value) < 2:
        return []
    response = supabase.table("customers").select("*")\
        .or_(f"phone.ilike.%{value}%,full_name.ilike.%{value}%")\
        .limit(8)\
        .execute()
    return [build_customer_stats(customer, limit_recent=3) for customer in (response.data or [])]

@router.post("/customers")
def create_customer(payload: CustomerCreate, current_user: dict = Depends(get_current_user)):
    phone = payload.phone.strip()
    full_name = payload.full_name.strip()
    if not phone or not full_name:
        raise HTTPException(status_code=400, detail="Tên và số điện thoại khách hàng là bắt buộc.")
    existing = supabase.table("customers").select("*").eq("phone", phone).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="Số điện thoại khách hàng đã tồn tại.")
    data = {
        "phone": phone,
        "full_name": full_name,
        "email": payload.email,
        "address": payload.address,
        "note": payload.note,
    }
    if has_column("customers", "date_of_birth"):
        data["date_of_birth"] = payload.date_of_birth.isoformat() if payload.date_of_birth else None
    try:
        response = supabase.table("customers").insert(data).execute()
    except Exception as err:
        # Double-click / 2 tab cùng tạo: UNIQUE(customers.phone) chặn bản ghi thứ hai
        # → trả 409 nghiệp vụ rõ ràng thay vì 500
        if is_unique_violation(err):
            raise HTTPException(status_code=409, detail="Số điện thoại khách hàng đã tồn tại.")
        raise
    if not response.data:
        raise HTTPException(status_code=500, detail="Không thể tạo khách hàng.")
    return build_customer_stats(response.data[0])

@router.get("")
def get_orders(
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    customer_phone: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve orders with filters and role limitations."""
    role = current_user["role"]
    query = supabase.table("orders").select("*, branches(name), customers(full_name, phone), users!created_by_staff_id(full_name)").order("created_at", desc=True)
    
    # Apply role limits
    if role == "manager":
        # Get branches managed by this manager
        if current_user.get("current_branch_id"):
            m_branch_ids = [current_user["current_branch_id"]]
        else:
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            m_branch_ids = [b["id"] for b in (branch_res.data or [])]
        if not m_branch_ids:
            return []
        query = query.in_("branch_id", m_branch_ids)
        
    elif role == "staff":
        if not current_user.get("branch_id"):
            return []
        query = query.eq("branch_id", current_user["branch_id"])
        
    # Apply standard filters
    if branch_id:
        query = query.eq("branch_id", branch_id)
    if status:
        query = query.eq("status", status)
    if payment_status:
        query = query.eq("payment_status", payment_status)
    if customer_phone:
        query = query.ilike("customer_phone_snapshot", f"%{customer_phone}%")
    if search:
        needle = search.strip()
        query = query.or_(f"order_code.ilike.%{needle}%,customer_name_snapshot.ilike.%{needle}%,customer_phone_snapshot.ilike.%{needle}%")

    page = max(page, 1)
    page_size = max(1, min(page_size, 100))
    query = query.range((page - 1) * page_size, page * page_size - 1)
        
    response = query.execute()
    
    customer_stats_by_id = build_customer_list_stats([order.get("customer_id") for order in (response.data or [])])

    # Format relations for frontend convenience
    formatted = []
    for order in (response.data or []):
        branch_name = order.get("branches", {}).get("name") if order.get("branches") else None
        cust_name = order.get("customers", {}).get("full_name") if order.get("customers") else order.get("customer_name_snapshot")
        cust_phone = order.get("customers", {}).get("phone") if order.get("customers") else order.get("customer_phone_snapshot")
        
        o_copy = dict(order)
        o_copy["branch_name"] = branch_name
        o_copy["customer_name"] = cust_name
        o_copy["customer_phone"] = cust_phone
        o_copy["staff_name"] = (order.get("users") or {}).get("full_name")
        customer_stats = customer_stats_by_id.get(order.get("customer_id"), {})
        o_copy["customer_total_orders"] = customer_stats.get("total_orders", 0)
        o_copy["customer_total_spent"] = customer_stats.get("total_spent", 0)
        o_copy["customer_is_vip"] = customer_stats.get("is_vip", False)
        
        if "branches" in o_copy:
            del o_copy["branches"]
        if "customers" in o_copy:
            del o_copy["customers"]
        if "users" in o_copy:
            del o_copy["users"]
            
        formatted.append(o_copy)
        
    return formatted

@router.post("")
def create_order(request: Request, payload: OrderCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin" and payload.branch_id != current_user.get("branch_id"):
        raise HTTPException(status_code=403, detail="Bạn chỉ được tạo đơn tại cơ sở đang chọn.")

    validate_return_after_received(payload.received_at, payload.expected_return_at)

    calculated_items, subtotal, service_names = build_order_items_from_services(payload.items)
    if payload.payment_status not in {"unpaid", "paid"}:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ tạo đơn chưa thanh toán hoặc đã thanh toán đủ.")

    # 1. Customer verification / creation
    cust_res = supabase.table("customers").select("*").eq("phone", payload.customer.phone).execute()
    if cust_res.data:
        customer = cust_res.data[0]
        # Update customer info if changed
        if payload.customer.full_name != customer["full_name"] or payload.customer.email != customer["email"]:
            update_data = {
                "full_name": payload.customer.full_name,
                "email": payload.customer.email,
                "address": payload.customer.address or customer["address"],
                "updated_at": datetime.utcnow().isoformat()
            }
            # Cột chỉ tồn tại sau customer_order_profile_migration.sql — không gửi khi DB chưa migrate
            if has_column("customers", "date_of_birth"):
                update_data["date_of_birth"] = payload.customer.date_of_birth.isoformat() if payload.customer.date_of_birth else customer.get("date_of_birth")
            supabase.table("customers").update(update_data).eq("id", customer["id"]).execute()
    else:
        insert_data = {
            "full_name": payload.customer.full_name,
            "phone": payload.customer.phone,
            "email": payload.customer.email,
            "address": payload.customer.address,
            "note": payload.customer.note
        }
        if has_column("customers", "date_of_birth"):
            insert_data["date_of_birth"] = payload.customer.date_of_birth.isoformat() if payload.customer.date_of_birth else None
        try:
            new_cust_res = supabase.table("customers").insert(insert_data).execute()
        except Exception as cust_err:
            # 2 request đồng thời cùng tạo khách mới: UNIQUE(customers.phone) chặn
            # request thứ hai → dùng lại khách vừa được tạo thay vì trả 500
            if is_unique_violation(cust_err):
                retry = supabase.table("customers").select("*").eq("phone", payload.customer.phone).execute()
                if retry.data:
                    new_cust_res = retry
                else:
                    raise HTTPException(status_code=409, detail="Số điện thoại khách hàng đã tồn tại.")
            else:
                raise
        if not new_cust_res.data:
            raise HTTPException(status_code=500, detail="Không thể tạo thông tin khách hàng.")
        customer = new_cust_res.data[0]

    total_amount = subtotal + payload.surcharge - payload.discount
    if total_amount < 0:
        raise HTTPException(status_code=400, detail="Tổng tiền đơn hàng không hợp lệ.")
    payment_method = "none"
    paid_amount = 0
    paid_at = None
    if payload.payment_status == "paid":
        payment_method = validate_payment_method(payload.payment_method)
        paid_amount = total_amount
        paid_at = datetime.utcnow().isoformat()
    
    # 2. Save Order + items + optional payment atomically in PostgreSQL
    order_data = {
        "customer_id": customer["id"],
        "branch_id": payload.branch_id,
        "created_by_staff_id": current_user["id"],
        "customer_name_snapshot": customer["full_name"],
        "customer_phone_snapshot": customer["phone"],
        "status": "new",
        "payment_status": payload.payment_status,
        "payment_method": payment_method,
        "subtotal": subtotal,
        "discount": payload.discount,
        "surcharge": payload.surcharge,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "paid_at": paid_at,
        "note": payload.note,
        "expected_return_at": payload.expected_return_at.isoformat() if payload.expected_return_at else None,
        # Tôn trọng ngày giờ nhận do người dùng chọn; chỉ mặc định NOW() khi không gửi
        "received_at": payload.received_at.isoformat() if payload.received_at else datetime.utcnow().isoformat()
    }
    payment_data = None
    if payload.payment_status == "paid":
        payment_data = {
            "payment_method": payment_method,
            "amount": total_amount,
            "status": "success",
            "paid_at": paid_at,
            "created_by": current_user["id"],
            "note": "Thanh toán khi nhận đơn",
        }

    idempotency_key = request.headers.get("Idempotency-Key")
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

    logger.info(
        "create_order transaction start request_id=%s user_id=%s branch_id=%s idempotency_key=%s",
        request_id,
        current_user["id"],
        payload.branch_id,
        bool(idempotency_key),
    )

    try:
        order, atomic_result = insert_order_with_unique_retry(order_data, calculated_items, payment_data, idempotency_key)
    except HTTPException as err:
        if err.status_code == 409:
            logger.warning(
                "create_order transaction rollback request_id=%s user_id=%s branch_id=%s reason=order_code_conflict",
                request_id,
                current_user["id"],
                payload.branch_id,
            )
            return order_code_conflict_response()
        raise
    except Exception as err:
        if is_idempotency_in_progress(err):
            logger.warning(
                "create_order transaction pending request_id=%s user_id=%s branch_id=%s",
                request_id,
                current_user["id"],
                payload.branch_id,
            )
            return idempotency_in_progress_response()
        if is_order_code_conflict(err):
            logger.error(
                "create_order transaction rollback request_id=%s user_id=%s branch_id=%s postgres_code=23505",
                request_id,
                current_user["id"],
                payload.branch_id,
                exc_info=True,
            )
            return order_code_conflict_response()
        logger.error(
            "create_order transaction rollback request_id=%s user_id=%s branch_id=%s error=%s",
            request_id,
            current_user["id"],
            payload.branch_id,
            str(err),
            exc_info=True,
        )
        raise HTTPException(status_code=500, detail="Không thể tạo đơn hàng lúc này. Vui lòng thử lại hoặc liên hệ quản trị viên.")

    order_code = order["order_code"]
    logger.info(
        "create_order transaction commit request_id=%s user_id=%s branch_id=%s generated_order_code=%s sequence_number=%s",
        request_id,
        current_user["id"],
        payload.branch_id,
        order_code,
        atomic_result.get("sequence_number") if isinstance(atomic_result, dict) else None,
    )

    # Get branch name
    branch_name_res = supabase.table("branches").select("name").eq("id", payload.branch_id).execute()
    branch_name = branch_name_res.data[0]["name"] if branch_name_res.data else "Cơ sở"

    # 4. Trigger system notification
    try:
        supabase.table("notifications").insert({
            "title": "Đơn hàng mới tạo",
            "content": f"Đơn hàng {order_code} đã được tạo thành công tại {branch_name}.",
            "type": "order",
            "sender_id": current_user["id"],
            "branch_id": payload.branch_id,
            "target_role": "manager"
        }).execute()
    except Exception as e:
        logger.error(f"Failed to create order notification: {str(e)}")

    # 5. Send order success email
    if customer.get("email"):
        try:
            send_template_email(
                to_email=customer["email"],
                template_type="order_success",
                template_data={
                    "full_name": customer["full_name"],
                    "order_code": order_code,
                    "branch_name": branch_name,
                    "total_amount": "{:,}".format(total_amount),
                    "payment_status": "Đã thanh toán" if payload.payment_status == "paid" else "Chưa thanh toán",
                    "expected_return_at": payload.expected_return_at.strftime("%H:%M %d/%m/%Y") if payload.expected_return_at else "Liên hệ sau"
                },
                sent_by=current_user["id"]
            )
        except Exception as e:
            logger.error(f"Failed to send order success email: {str(e)}")

        # Trigger ORDER_CREATED: nội dung lấy hoàn toàn từ Email Template (không hard-code).
        # send_trigger_email tự bỏ qua khi chưa có mẫu active và không bao giờ raise.
        send_trigger_email(
            "ORDER_CREATED",
            customer["email"],
            build_order_email_context(order, customer, branch_name, service_names, "Đặt đơn thành công"),
            sent_by=current_user["id"],
        )

    customer_stats = build_customer_stats(customer, limit_recent=0)
    order["items"] = calculated_items
    order["branch_name"] = branch_name
    order["customer_name"] = customer["full_name"]
    order["customer_phone"] = customer["phone"]
    order["staff_name"] = current_user.get("full_name")
    order["customer_total_orders"] = customer_stats.get("total_orders", 0)
    order["customer_total_spent"] = customer_stats.get("total_spent", 0)
    order["customer_is_vip"] = customer_stats.get("is_vip", False)
    return {"success": True, "data": order}

@router.get("/{id}")
def get_order_detail(id: str, current_user: dict = Depends(get_current_user)):
    response = supabase.table("orders").select("*, branches(name), customers(*), users!created_by_staff_id(full_name)").eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = response.data[0]
    
    # Check permissions
    if current_user["role"] == "manager":
        # Check manager manages this branch
        chk = supabase.table("branches").select("id").eq("id", order["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không có quyền xem đơn hàng của chi nhánh khác.")
    elif current_user["role"] == "staff":
        if order["branch_id"] != current_user.get("branch_id"):
            raise HTTPException(status_code=403, detail="Không có quyền xem đơn hàng của chi nhánh khác.")
            
    # Query items
    items_res = supabase.table("order_items").select("*").eq("order_id", id).execute()
    order["items"] = items_res.data or []
    
    # Flatten names
    order["branch_name"] = order.get("branches", {}).get("name") if order.get("branches") else None
    order["staff_name"] = order.get("users", {}).get("full_name") if order.get("users") else None
    
    if "branches" in order: del order["branches"]
    if "users" in order: del order["users"]
    
    return order

@router.put("/{id}")
def update_order(id: str, payload: OrderUpdate, current_user: dict = Depends(get_current_user)):
    # Only Admin or Manager of that branch can edit billing details
    order_res = supabase.table("orders").select("branch_id").eq("id", id).execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = order_res.data[0]
    
    if current_user["role"] == "staff":
        raise HTTPException(status_code=403, detail="Nhân viên không thể thay đổi thông tin tính phí hoặc ngày hẹn.")
        
    if current_user["role"] == "manager":
        chk = supabase.table("branches").select("id").eq("id", order["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không được phép cập nhật đơn hàng của chi nhánh khác.")

    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật.")

    # Ngày trả phải sau ngày nhận — so sánh với giá trị mới hoặc giá trị đang lưu
    if payload.received_at or payload.expected_return_at:
        cur = supabase.table("orders").select("received_at, expected_return_at").eq("id", id).execute().data[0]

        def parse_dt(value):
            if not value:
                return None
            try:
                return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
            except Exception:
                return None

        effective_received = payload.received_at or parse_dt(cur.get("received_at"))
        effective_return = payload.expected_return_at or parse_dt(cur.get("expected_return_at"))
        validate_return_after_received(effective_received, effective_return)

    if "received_at" in update_data and update_data["received_at"]:
        update_data["received_at"] = update_data["received_at"].isoformat()

    if "expected_return_at" in update_data and update_data["expected_return_at"]:
        update_data["expected_return_at"] = update_data["expected_return_at"].isoformat()
        
    # Re-calculate total amount if surcharge or discount changed
    if "surcharge" in update_data or "discount" in update_data:
        # Fetch current subtotal
        cur_order = supabase.table("orders").select("subtotal, surcharge, discount").eq("id", id).execute().data[0]
        surcharge = update_data.get("surcharge", cur_order["surcharge"])
        discount = update_data.get("discount", cur_order["discount"])
        update_data["total_amount"] = cur_order["subtotal"] + surcharge - discount

    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    response = supabase.table("orders").update(update_data).eq("id", id).execute()
    return response.data[0]

@router.patch("/{id}/status")
def update_order_status(id: str, payload: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    order_res = supabase.table("orders").select("order_code, branch_id, status").eq("id", id).execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = order_res.data[0]
    
    ensure_order_access(order, current_user)
    if payload.status == "delivered":
        detail_res = supabase.table("orders").select("*").eq("id", id).limit(1).execute()
        detail = detail_res.data[0] if detail_res.data else order
        if detail.get("payment_status") != "paid":
            raise HTTPException(status_code=400, detail="Không thể trả đơn khi chưa hoàn tất thanh toán.")

    update_fields = {
        "status": payload.status,
        "updated_at": datetime.utcnow().isoformat()
    }
    
    # Log delivery time
    if payload.status == "delivered":
        update_fields["delivered_at"] = datetime.utcnow().isoformat()
        
    response = supabase.table("orders").update(update_fields).eq("id", id).execute()
    
    # Translate status to Vietnamese for notifications
    status_vn = {
        "new": "Mới tạo",
        "washing": "Đang giặt",
        "drying": "Đang sấy",
        "ready": "Sẵn sàng giao",
        "delivered": "Đã giao khách",
        "cancelled": "Đã hủy"
    }
    
    create_order_notification(order["order_code"], status_vn[payload.status], order["branch_id"], current_user["id"])

    # Trigger email theo trạng thái mới (mẫu quản lý trong Email Templates)
    trigger_code = ORDER_STATUS_TRIGGER_MAP.get(payload.status)
    if trigger_code:
        try:
            updated = response.data[0]
            cust_res = supabase.table("customers").select("*").eq("id", updated["customer_id"]).execute()
            customer = cust_res.data[0] if cust_res.data else {}
            if customer.get("email"):
                branch_res = supabase.table("branches").select("name").eq("id", updated["branch_id"]).execute()
                branch_name = branch_res.data[0]["name"] if branch_res.data else "Cơ sở"
                send_trigger_email(
                    trigger_code,
                    customer["email"],
                    build_order_email_context(updated, customer, branch_name, "", status_vn[payload.status]),
                    sent_by=current_user["id"],
                )
        except Exception as e:
            logger.error(f"Failed to send status trigger email: {str(e)}")

    return response.data[0]

@router.patch("/{id}/payment")
def update_order_payment(id: str, payload: OrderPaymentUpdate, current_user: dict = Depends(get_current_user)):
    order_res = supabase.table("orders").select("*").eq("id", id).execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = order_res.data[0]
    ensure_order_access(order, current_user, "cập nhật thanh toán")

    if order.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Không thể thanh toán đơn hàng đã hủy.")
    if payload.payment_status == "partial":
        raise HTTPException(status_code=400, detail="Luồng này chỉ hỗ trợ chưa thanh toán hoặc đã thanh toán đủ.")

    paid_at = None
    payment_method = "none"
    paid_amount = 0
    if payload.payment_status == "paid":
        payment_method = validate_payment_method(payload.payment_method)
        paid_amount = int(order.get("total_amount") or 0)
        paid_at = datetime.utcnow().isoformat()
        if order.get("payment_status") != "paid":
            record_order_payment(order, payment_method, current_user, "Cập nhật thanh toán đơn hàng")

    update_fields = {
        "payment_status": payload.payment_status,
        "payment_method": payment_method,
        "paid_amount": paid_amount,
        "paid_at": paid_at,
        "updated_at": datetime.utcnow().isoformat()
    }

    response = supabase.table("orders").update(update_fields).eq("id", id).execute()

    # Trigger PAYMENT_SUCCESS khi đơn được ghi nhận thanh toán đủ
    if payload.payment_status == "paid":
        try:
            updated = response.data[0]
            cust_res = supabase.table("customers").select("*").eq("id", updated["customer_id"]).execute()
            customer = cust_res.data[0] if cust_res.data else {}
            if customer.get("email"):
                branch_res = supabase.table("branches").select("name").eq("id", updated["branch_id"]).execute()
                branch_name = branch_res.data[0]["name"] if branch_res.data else "Cơ sở"
                send_trigger_email(
                    "PAYMENT_SUCCESS",
                    customer["email"],
                    build_order_email_context(updated, customer, branch_name, "", "Thanh toán thành công"),
                    sent_by=current_user["id"],
                )
        except Exception as e:
            logger.error(f"Failed to send payment trigger email: {str(e)}")

    return response.data[0]

@router.post("/{id}/complete-delivery")
def complete_order_delivery(id: str, payload: CompleteDeliveryRequest, current_user: dict = Depends(get_current_user)):
    order_res = supabase.table("orders").select("*").eq("id", id).execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = order_res.data[0]
    ensure_order_access(order, current_user, "trả")

    if order.get("status") == "cancelled":
        raise HTTPException(status_code=400, detail="Không thể trả đơn hàng đã hủy.")
    if order.get("status") == "delivered":
        existing_payment = None
        if order.get("payment_status") == "paid":
            existing = supabase.table("order_payments").select("*").eq("order_id", id).eq("status", "success").limit(1).execute()
            existing_payment = existing.data[0] if existing.data else None
        return {"success": True, "order": order, "payment": existing_payment}

    payment = None
    payment_method = order.get("payment_method") or "none"
    paid_amount = int(order.get("paid_amount") or 0)
    paid_at = order.get("paid_at")

    if order.get("payment_status") != "paid":
        payment_method = validate_payment_method(payload.payment_method)
        payment = record_order_payment(order, payment_method, current_user, payload.note)
        paid_amount = int(order.get("total_amount") or 0)
        paid_at = (payment or {}).get("paid_at") or datetime.utcnow().isoformat()

    now = datetime.utcnow().isoformat()
    update_fields = {
        "status": "delivered",
        "delivered_at": now,
        "payment_status": "paid",
        "payment_method": payment_method,
        "paid_amount": paid_amount,
        "paid_at": paid_at,
        "updated_at": now,
    }
    updated_res = supabase.table("orders").update(update_fields).eq("id", id).execute()
    updated = updated_res.data[0] if updated_res.data else {**order, **update_fields}
    create_order_notification(updated["order_code"], "Đã giao khách", updated["branch_id"], current_user["id"])
    return {
        "success": True,
        "order": updated,
        "payment": payment,
        "payment_status": updated.get("payment_status"),
        "delivered_at": updated.get("delivered_at"),
    }

@router.delete("/{id}", dependencies=[Depends(require_role(["admin"]))])
def delete_order(id: str):
    # Hard delete (on cascade handles order items)
    response = supabase.table("orders").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    return {"message": "Xóa đơn hàng thành công."}
