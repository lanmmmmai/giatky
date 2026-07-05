# Lành Sạch Laundry - Hệ thống quản lý tiệm giặt ký

Hệ thống quản lý chuyên nghiệp, tinh gọn dành riêng cho chuỗi tiệm giặt ký / giặt sấy **Lành Sạch Laundry**.
Dự án được xây dựng theo mô hình **production-ready**, phân quyền chặt chẽ cho 3 vai trò: **Chủ Tiệm (Admin)**, **Quản Lý Cơ Sở (Manager)**, và **Nhân Viên (Staff)**.

---

## 1. Công nghệ sử dụng

*   **Frontend**: React (Vite) + TypeScript + Tailwind CSS + Zustand + React Router v6 + Recharts + SheetJS (xlsx).
*   **Backend**: Python FastAPI + Supabase Python Client (service role) + JWT Session + WebSockets + Jinja2 + Google Auth.
*   **Database**: Supabase PostgreSQL (có khóa ngoại, indexes tối ưu và seed dữ liệu chuẩn).

---

## 2. Hướng dẫn cài đặt và chạy thử nghiệm (Local)

### Bước 1: Thiết lập cơ sở dữ liệu trên Supabase

1.  Tạo một Project mới trên [Supabase](https://supabase.com/).
2.  Mở mục **SQL Editor** trong trang quản trị Supabase.
3.  Copy và Paste nội dung file [supabase/schema.sql](supabase/schema.sql) và bấm **Run** để khởi tạo các bảng và indexes.
4.  Copy và Paste nội dung file [supabase/seed.sql](supabase/seed.sql) và bấm **Run** để seed tài khoản Admin mặc định cùng các mẫu email, dịch vụ cơ bản.

### Bước 2: Cài đặt và Khởi động Backend (FastAPI)

1.  Di chuyển vào thư mục `backend/`:
    ```bash
    cd backend
    ```
2.  Tạo môi trường ảo Python (khuyên dùng):
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # Trên Windows dùng: venv\Scripts\activate
    ```
3.  Cài đặt các thư viện phụ thuộc:
    ```bash
    pip install -r requirements.txt
    ```
4.  Tạo file `.env` từ file mẫu `.env.example`:
    ```bash
    cp .env.example .env
    ```
5.  Cập nhật thông tin kết nối Supabase và cấu hình JWT trong file `.env`:
    *   `SUPABASE_URL` và `SUPABASE_KEY` (Sử dụng service role key trong phần API Settings của Supabase).
6.  Khởi động server Backend:
    ```bash
    python3 -m uvicorn app.main:app --reload
    ```
    *   Server Backend sẽ chạy tại: `http://localhost:8000`
    *   Tài liệu API Swagger tự động sinh tại: `http://localhost:8000/docs`

### Bước 3: Cài đặt và Khởi động Frontend (React)

1.  Di chuyển vào thư mục `frontend/`:
    ```bash
    cd ../frontend
    ```
2.  Cài đặt các gói npm:
    ```bash
    npm install
    ```
3.  Tạo file `.env` từ file mẫu `.env.example`:
    ```bash
    cp .env.example .env
    ```
4.  Khởi động server phát triển Frontend:
    ```bash
    npm run dev
    ```
    *   Server Frontend sẽ chạy tại: `http://localhost:5173`

---

## 3. Thông tin tài khoản đăng nhập kiểm thử

Đăng nhập bằng tài khoản Admin mặc định để bắt đầu quản lý:
*   **Tên đăng nhập (hoặc Email)**: `admin` hoặc `admin@lanhsach.com`
*   **Mật khẩu**: `123@Admin`
*   **Vai trò**: `admin`
*   **Trạng thái**: `active` (đã kích hoạt)

---

## 4. Cấu hình các dịch vụ mở rộng (Production)

### 4.1 Cấu hình SMTP gửi Mail thật
Trong file `.env` của backend, điền thông tin SMTP (Ví dụ: Gmail App Password hoặc Resend API Key) để gửi email kích hoạt tài khoản thật cho Manager/Staff và gửi hóa đơn cho khách hàng:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=email-cua-ban@gmail.com
SMTP_PASSWORD=mat-khau-ung-dung-gmail
SMTP_FROM_EMAIL=email-cua-ban@gmail.com
SMTP_FROM_NAME="Lành Sạch Laundry"
```
*Lưu ý: Nếu không cấu hình SMTP, backend khi chạy local sẽ tự động in nội dung email kích hoạt kèm link xác thực ra màn hình terminal để bạn click kích hoạt kiểm thử.*

### 4.2 Cấu hình đăng nhập bằng Google (Google OAuth)
1.  Truy cập Google Cloud Console, tạo dự án và tạo mã credentials **OAuth Client ID** loại Web Application.
2.  Thêm Redirect URI phù hợp với ứng dụng của bạn (Ví dụ: `http://localhost:5173`).
3.  Cấu hình Client ID vào file `.env` của cả Frontend và Backend:
    *   Backend: `GOOGLE_CLIENT_ID`
    *   Frontend: `VITE_GOOGLE_CLIENT_ID`

---

## 5. Hướng dẫn Deploy lên Production

### Frontend (Deploy lên Vercel)
1.  Kết nối kho lưu trữ GitHub của bạn với Vercel.
2.  Chọn thư mục root của dự án frontend là `frontend/`.
3.  Cấu hình biến môi trường trên Vercel Dashboard:
    *   `VITE_API_URL` = Đường dẫn URL của backend sau khi deploy lên Render.
4.  Vercel sẽ tự động build và deploy.

### Backend (Deploy lên Render)
1.  Tạo ứng dụng **Web Service** mới trên Render.
2.  Kết nối với repo GitHub của bạn.
3.  Chọn môi trường chạy là **Python**.
4.  Cấu hình Build Command và Start Command:
    *   Build Command: `pip install -r backend/requirements.txt`
    *   Start Command: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5.  Thêm đầy đủ các biến môi trường từ file `backend/.env.example` vào cấu hình Environment Variables của Render.

---

## 6. Hướng dẫn chạy bằng Docker (Khuyên dùng cho Local Dev)

Hệ thống đã được cấu hình Docker để khởi chạy cả Backend và Frontend chỉ bằng một lệnh duy nhất.

### Khởi chạy hệ thống

Chạy lệnh sau tại thư mục gốc của dự án:
```bash
docker compose up --build
```

Sau khi khởi chạy thành công:
*   **Giao diện Frontend**: `http://localhost:5173`
*   **FastAPI Backend URL**: `http://localhost:8000`
*   **FastAPI Swagger Docs**: `http://localhost:8000/docs`

### Dừng hệ thống

```bash
docker compose down
```

### Khởi chạy lại sạch (Dọn dẹp volumes)

Nếu có sự thay đổi lớn về package dependency, sử dụng:
```bash
docker compose down -v
docker compose up --build
```
