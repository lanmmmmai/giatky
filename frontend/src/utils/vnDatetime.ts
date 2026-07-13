// Tiện ích ngày giờ theo timezone Việt Nam (Asia/Ho_Chi_Minh).
// Dùng cho các input date/time của đơn hàng để không bị lệch múi giờ
// (không dùng new Date().toISOString().slice(0, 16) vì sẽ lệch 7 tiếng).

export const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VN_UTC_OFFSET = '+07:00';

const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: VN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timePartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: VN_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Giá trị cho <input type="date"> (YYYY-MM-DD) theo giờ VN. */
export const toVnDateInputValue = (value: Date | string): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  return datePartsFormatter.format(d); // en-CA → YYYY-MM-DD
};

/** Giá trị cho <input type="time"> (HH:mm) theo giờ VN. */
export const toVnTimeInputValue = (value: Date | string): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  return timePartsFormatter.format(d); // en-GB h23 → HH:mm
};

/** Ngày hiện tại (YYYY-MM-DD) theo giờ VN, cộng thêm dayOffset ngày. */
export const vnTodayInputValue = (dayOffset = 0): string =>
  addDaysToDateInput(toVnDateInputValue(new Date()), dayOffset);

/** Giờ phút hiện tại (HH:mm) theo giờ VN — đúng thời gian thực, không làm tròn. */
export const vnNowTimeInputValue = (): string => toVnTimeInputValue(new Date());

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (an toàn, không phụ thuộc timezone máy). */
export const addDaysToDateInput = (dateInput: string, days: number): string => {
  const [y, m, d] = dateInput.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

/** Kiểm tra cặp date/time input tạo thành datetime hợp lệ. */
export const isValidDateTimeInput = (dateInput: string, timeInput: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput) || !/^\d{2}:\d{2}$/.test(timeInput)) return false;
  return !Number.isNaN(new Date(`${dateInput}T${timeInput}:00${VN_UTC_OFFSET}`).getTime());
};

/** Ghép date + time input thành ISO 8601 kèm timezone VN: 2026-07-13T19:30:00+07:00 */
export const vnPartsToIso = (dateInput: string, timeInput: string): string =>
  `${dateInput}T${timeInput}:00${VN_UTC_OFFSET}`;

/** Hiển thị "13/07/2026 19:30" theo giờ VN từ chuỗi ISO đã lưu. */
export const formatVnDateTime = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const [date, time] = [toVnDateInputValue(d), toVnTimeInputValue(d)];
  const [y, m, dd] = date.split('-');
  return `${dd}/${m}/${y} ${time}`;
};
