from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, date
import logging

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

class OrderUpdate(BaseModel):
    expected_return_at: Optional[datetime] = None
    note: Optional[str] = None
    surcharge: Optional[int] = None
    discount: Optional[int] = None

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


def build_order_email_context(order: dict, customer: dict, branch_name: str, service_name: str = "", order_status: str = "") -> dict:
    """Gom placeholder chuẩn ({{customer_name}}, {{order_code}}, ...) cho email đơn hàng."""
    def fmt_time(value):
        if not value:
            return ""
        try:
            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime("%H:%M %d/%m/%Y")
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


def generate_order_code() -> str:
    """Generate sequential order code: LS-YYYYMMDD-XXX"""
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"LS-{today_str}-"
    
    # Query orders with matching prefix
    response = supabase.table("orders").select("order_code").ilike("order_code", f"{prefix}%").execute()
    count = len(response.data or [])
    
    next_seq = str(count + 1).zfill(3)
    return f"{prefix}{next_seq}"

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

@router.get("/customer-lookup/{phone}")
def lookup_customer(phone: str, current_user: dict = Depends(get_current_user)):
    res = supabase.table("customers").select("*").eq("phone", phone).execute()
    if res.data:
        return res.data[0]
    return None

@router.get("")
def get_orders(
    branch_id: Optional[str] = None,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    customer_phone: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve orders with filters and role limitations."""
    role = current_user["role"]
    query = supabase.table("orders").select("*, branches(name), customers(full_name, phone)").order("created_at", desc=True)
    
    # Apply role limits
    if role == "manager":
        # Get branches managed by this manager
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
        query = query.eq("customer_phone_snapshot", customer_phone)
        
    response = query.execute()
    
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
        
        if "branches" in o_copy:
            del o_copy["branches"]
        if "customers" in o_copy:
            del o_copy["customers"]
            
        formatted.append(o_copy)
        
    return formatted

@router.post("")
def create_order(payload: OrderCreate, current_user: dict = Depends(get_current_user)):
    # 1. Customer verification / creation
    cust_res = supabase.table("customers").select("*").eq("phone", payload.customer.phone).execute()
    if cust_res.data:
        customer = cust_res.data[0]
        # Update customer info if changed
        if payload.customer.full_name != customer["full_name"] or payload.customer.email != customer["email"]:
            supabase.table("customers").update({
                "full_name": payload.customer.full_name,
                "email": payload.customer.email,
                "address": payload.customer.address or customer["address"],
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", customer["id"]).execute()
    else:
        new_cust_res = supabase.table("customers").insert({
            "full_name": payload.customer.full_name,
            "phone": payload.customer.phone,
            "email": payload.customer.email,
            "address": payload.customer.address,
            "note": payload.customer.note
        }).execute()
        if not new_cust_res.data:
            raise HTTPException(status_code=500, detail="Không thể tạo thông tin khách hàng.")
        customer = new_cust_res.data[0]

    # Calculate prices
    subtotal = sum(item.amount for item in payload.items)
    total_amount = subtotal + payload.surcharge - payload.discount
    
    # 2. Save Order
    order_code = generate_order_code()
    order_data = {
        "order_code": order_code,
        "customer_id": customer["id"],
        "branch_id": payload.branch_id,
        "created_by_staff_id": current_user["id"],
        "customer_name_snapshot": customer["full_name"],
        "customer_phone_snapshot": customer["phone"],
        "status": "new",
        "payment_status": payload.payment_status,
        "payment_method": payload.payment_method,
        "subtotal": subtotal,
        "discount": payload.discount,
        "surcharge": payload.surcharge,
        "total_amount": total_amount,
        "paid_amount": payload.paid_amount,
        "note": payload.note,
        "expected_return_at": payload.expected_return_at.isoformat() if payload.expected_return_at else None,
        "received_at": datetime.utcnow().isoformat()
    }
    
    order_res = supabase.table("orders").insert(order_data).execute()
    if not order_res.data:
        raise HTTPException(status_code=500, detail="Không thể tạo đơn hàng.")
    order = order_res.data[0]

    # 3. Save Order Items
    items_to_insert = []
    for item in payload.items:
        items_to_insert.append({
            "order_id": order["id"],
            "service_id": item.service_id,
            "service_name_snapshot": item.service_name_snapshot,
            "unit": item.unit,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "amount": item.amount
        })
    supabase.table("order_items").insert(items_to_insert).execute()

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
        service_names = ", ".join(i.service_name_snapshot for i in payload.items)
        send_trigger_email(
            "ORDER_CREATED",
            customer["email"],
            build_order_email_context(order, customer, branch_name, service_names, "Đặt đơn thành công"),
            sent_by=current_user["id"],
        )

    return order

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
    
    # Check branch access
    if current_user["role"] == "manager":
        chk = supabase.table("branches").select("id").eq("id", order["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật đơn hàng ở chi nhánh này.")
    elif current_user["role"] == "staff":
        if order["branch_id"] != current_user.get("branch_id"):
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật đơn hàng ở chi nhánh khác.")

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
    order_res = supabase.table("orders").select("branch_id").eq("id", id).execute()
    if not order_res.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    order = order_res.data[0]
    
    # Permission checks
    if current_user["role"] == "manager":
        chk = supabase.table("branches").select("id").eq("id", order["branch_id"]).eq("manager_id", current_user["id"]).execute()
        if not chk.data:
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật thanh toán đơn hàng ở chi nhánh khác.")
    elif current_user["role"] == "staff":
        if order["branch_id"] != current_user.get("branch_id"):
            raise HTTPException(status_code=403, detail="Không có quyền cập nhật thanh toán đơn hàng ở chi nhánh khác.")

    update_fields = {
        "payment_status": payload.payment_status,
        "payment_method": payload.payment_method,
        "paid_amount": payload.paid_amount,
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

@router.delete("/{id}", dependencies=[Depends(require_role(["admin"]))])
def delete_order(id: str):
    # Hard delete (on cascade handles order items)
    response = supabase.table("orders").delete().eq("id", id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn hàng.")
    return {"message": "Xóa đơn hàng thành công."}
