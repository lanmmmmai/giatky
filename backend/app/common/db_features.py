"""Feature-detection cho schema database.

Cho phép backend chạy được cả trước và sau khi migration mới được áp dụng:
mỗi cột/bảng mới được probe đúng một lần rồi cache kết quả trong process.
Cùng pattern với get_template_columns_has_body_text() có sẵn ở module email,
nhưng dùng chung được cho mọi bảng/cột.
"""
import logging
from app.database import supabase

logger = logging.getLogger("app.db_features")

_column_cache: dict = {}
_table_cache: dict = {}


def has_column(table: str, column: str) -> bool:
    key = f"{table}.{column}"
    if key not in _column_cache:
        try:
            supabase.table(table).select(column).limit(1).execute()
            _column_cache[key] = True
        except Exception:
            _column_cache[key] = False
            logger.info(f"Cột {key} chưa tồn tại — cần chạy migration để bật tính năng liên quan.")
    return _column_cache[key]


def has_table(table: str) -> bool:
    if table not in _table_cache:
        try:
            supabase.table(table).select("*").limit(1).execute()
            _table_cache[table] = True
        except Exception:
            _table_cache[table] = False
            logger.info(f"Bảng {table} chưa tồn tại — cần chạy migration để bật tính năng liên quan.")
    return _table_cache[table]


def filter_columns(table: str, data: dict, optional_columns: set) -> dict:
    """Loại các key thuộc optional_columns nếu cột chưa tồn tại trong DB."""
    return {
        k: v for k, v in data.items()
        if k not in optional_columns or has_column(table, k)
    }
