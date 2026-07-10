from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from app.config import settings
from app.auth.routes import router as auth_router
from app.users.routes import router as users_router
from app.branches.routes import router as branches_router
from app.services.routes import router as services_router
from app.orders.routes import router as orders_router
from app.attendance.routes import router as attendance_router
from app.payroll.routes import router as payroll_router
from app.reports.routes import router as reports_router
from app.notifications.routes import router as notifications_router
from app.email.routes import router as email_router
from app.seo.routes import router as seo_router
from app.chat.routes import router as chat_router
from app.revenue_reports.routes import router as revenue_reports_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("app.main")

app = FastAPI(
    title="Giặt Ký API",
    description="Hệ thống quản lý chuỗi tiệm giặt ký Giặt Ký",
    version="2.0.0",
    docs_url="/docs"
)

# CORS configuration
# Allow requests from local Vite server and production domains
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.FRONTEND_URL and settings.FRONTEND_URL not in allowed_origins:
    allowed_origins.append(settings.FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(branches_router)
app.include_router(services_router)
app.include_router(orders_router)
app.include_router(attendance_router)
app.include_router(payroll_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(email_router)
app.include_router(seo_router)
app.include_router(chat_router)
app.include_router(revenue_reports_router)

# Custom exception handler for validation/uncaught errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Uncaught exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Đã xảy ra lỗi hệ thống: {str(exc)}. Vui lòng liên hệ Admin."},
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/")
def read_root():
    return {
        "message": "Giặt Ký backend is running",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
