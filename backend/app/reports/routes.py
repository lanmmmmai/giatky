from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import logging

from app.common.dependencies import get_current_user
from app.database import supabase

logger = logging.getLogger("app.reports")
router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/dashboard")
def get_dashboard_summary(current_user: dict = Depends(get_current_user)):
    """Retrieve summarized statistics for Dashboard, depending on user role."""
    role = current_user["role"]
    today_str = date.today().isoformat()
    start_of_month = date(date.today().year, date.today().month, 1).isoformat()
    
    # Base structures
    summary = {
        "revenue_today": 0,
        "revenue_month": 0,
        "orders_today_count": 0,
        "orders_processing_count": 0,
        "orders_delivered_count": 0,
        "recent_orders": []
    }

    # Fetch orders based on role limits
    orders_query = supabase.table("orders").select("*, branches(name)")
    if role == "manager":
        # Get branches managed by this manager
        if current_user.get("current_branch_id"):
            m_branch_ids = [current_user["current_branch_id"]]
        else:
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            m_branch_ids = [b["id"] for b in (branch_res.data or [])]
        if not m_branch_ids:
            return summary
        orders_query = orders_query.in_("branch_id", m_branch_ids)
    elif role == "staff":
        if not current_user.get("branch_id"):
            return summary
        orders_query = orders_query.eq("branch_id", current_user["branch_id"])
        
    orders_res = orders_query.execute()
    all_orders = orders_res.data or []
    
    # Calculate statistics in memory
    for order in all_orders:
        created_at_date = order["created_at"][:10]
        total = order["total_amount"] or 0
        status = order["status"]
        
        # Today
        if created_at_date == today_str:
            summary["orders_today_count"] += 1
            summary["revenue_today"] += total
            
        # Month
        if created_at_date >= start_of_month:
            summary["revenue_month"] += total
            
        # Status counts
        if status in ["new", "washing", "drying", "ready"]:
            summary["orders_processing_count"] += 1
        elif status == "delivered":
            summary["orders_delivered_count"] += 1

    # Format recent orders
    recent_raw = sorted(all_orders, key=lambda x: x["created_at"], reverse=True)[:5]
    for order in recent_raw:
        summary["recent_orders"].append({
            "id": order["id"],
            "order_code": order["order_code"],
            "customer_name": order["customer_name_snapshot"],
            "total_amount": order["total_amount"],
            "status": order["status"],
            "payment_status": order["payment_status"],
            "branch_name": order.get("branches", {}).get("name") if order.get("branches") else "Cơ sở",
            "created_at": order["created_at"]
        })

    if role == "admin":
        # Additional statistics for Admin
        branches_res = supabase.table("branches").select("id").execute()
        managers_res = supabase.table("users").select("id").eq("role", "manager").execute()
        staff_res = supabase.table("users").select("id").eq("role", "staff").execute()
        
        summary["branches_count"] = len(branches_res.data or [])
        summary["managers_count"] = len(managers_res.data or [])
        summary["staff_count"] = len(staff_res.data or [])
        
        # Revenue by branch calculation
        branch_revs = {}
        for order in all_orders:
            b_id = order["branch_id"]
            b_name = order.get("branches", {}).get("name") if order.get("branches") else "Chưa phân chi nhánh"
            total = order["total_amount"] or 0
            if b_id:
                branch_revs[b_name] = branch_revs.get(b_name, 0) + total
                
        summary["revenue_by_branch"] = [{"branch_name": k, "revenue": v} for k, v in branch_revs.items()]
        
        # Daily revenue graph (last 7 days)
        last_7_days = [date.today() - timedelta(days=i) for i in range(6, -1, -1)]
        daily_revs = {d.isoformat(): 0 for d in last_7_days}
        
        for order in all_orders:
            d_str = order["created_at"][:10]
            if d_str in daily_revs:
                daily_revs[d_str] += order["total_amount"] or 0
                
        summary["daily_revenue"] = [{"date": datetime.strptime(k, "%Y-%m-%d").strftime("%d/%m"), "revenue": v} for k, v in daily_revs.items()]
        
    elif role == "manager":
        # Active staff working today in manager's branches
        if current_user.get("current_branch_id"):
            m_branch_ids = [current_user["current_branch_id"]]
        else:
            branch_res = supabase.table("branches").select("id").eq("manager_id", current_user["id"]).execute()
            m_branch_ids = [b["id"] for b in (branch_res.data or [])]
        if m_branch_ids:
            att_res = supabase.table("attendance").select("staff_id")\
                .in_("branch_id", m_branch_ids)\
                .eq("work_date", today_str)\
                .eq("status", "checked_in")\
                .execute()
            staff_ids = sorted({att["staff_id"] for att in (att_res.data or []) if att.get("staff_id")})
            users_by_id = {}
            if staff_ids:
                user_res = supabase.table("users").select("id, full_name").in_("id", staff_ids).execute()
                users_by_id = {row["id"]: row for row in (user_res.data or [])}

            active_staff = []
            for att in (att_res.data or []):
                staff = users_by_id.get(att["staff_id"]) or {}
                active_staff.append({
                    "id": att["staff_id"],
                    "full_name": staff.get("full_name") or "Nhân viên"
                })
            summary["active_staff"] = active_staff

    return summary

@router.get("/revenue")
def get_revenue_report(
    branch_id: Optional[str] = None,
    staff_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    payment_status: Optional[str] = None,
    payment_method: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve a detailed revenue report with aggregations."""
    role = current_user["role"]
    query = supabase.table("orders").select("*, branches(name), users!created_by_staff_id(full_name)")
    
    # Filter based on role limits
    if role == "manager":
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

    # Query criteria
    if branch_id:
        query = query.eq("branch_id", branch_id)
    if staff_id:
        query = query.eq("created_by_staff_id", staff_id)
    if start_date:
        query = query.gte("created_at", f"{start_date}T00:00:00")
    if end_date:
        query = query.lte("created_at", f"{end_date}T23:59:59")
    if payment_status:
        query = query.eq("payment_status", payment_status)
    if payment_method:
        query = query.eq("payment_method", payment_method)
        
    response = query.execute()
    orders = response.data or []
    
    total_revenue = 0
    paid_revenue = 0
    unpaid_revenue = 0
    total_orders = len(orders)
    
    revenue_by_branch = {}
    revenue_by_staff = {}
    
    order_ids = [o["id"] for o in orders]
    
    # Fetch order items to analyze service revenue
    service_revs = {}
    if order_ids:
        # Batch items query (max 1000 orders)
        items_res = supabase.table("order_items").select("service_name_snapshot, amount").in_("order_id", order_ids[:500]).execute()
        for item in (items_res.data or []):
            s_name = item["service_name_snapshot"]
            amt = item["amount"] or 0
            service_revs[s_name] = service_revs.get(s_name, 0) + amt
            
    for order in orders:
        total = order["total_amount"] or 0
        paid = order["paid_amount"] or 0
        p_status = order["payment_status"]
        
        total_revenue += total
        paid_revenue += paid
        unpaid_revenue += max(0, total - paid)
        
        # Branch revenue
        b_name = order.get("branches", {}).get("name") if order.get("branches") else "Khác"
        revenue_by_branch[b_name] = revenue_by_branch.get(b_name, 0) + total
        
        # Staff revenue
        s_name = order.get("users", {}).get("full_name") if order.get("users") else "Khác"
        revenue_by_staff[s_name] = revenue_by_staff.get(s_name, 0) + total

    average_order_value = round(total_revenue / total_orders, 2) if total_orders > 0 else 0
    
    return {
        "summary": {
            "total_revenue": total_revenue,
            "paid_revenue": paid_revenue,
            "unpaid_revenue": unpaid_revenue,
            "total_orders": total_orders,
            "average_order_value": average_order_value
        },
        "revenue_by_branch": [{"branch_name": k, "revenue": v} for k, v in revenue_by_branch.items()],
        "revenue_by_staff": [{"staff_name": k, "revenue": v} for k, v in revenue_by_staff.items()],
        "revenue_by_service": [{"service_name": k, "revenue": v} for k, v in service_revs.items()]
    }
