import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Briefcase, Calendar, CheckCircle2, Clock3, MapPin, Send, X } from 'lucide-react';
import { getPublicPost, JobShift, Post, submitJobApplication } from '../../api/content';
import LoadingSpinner from '../../components/LoadingSpinner';
import SEO, { SITE_URL, buildBreadcrumbSchema, buildOrganizationSchema } from '../../components/SEO';

const MAX_CV_SIZE = 5 * 1024 * 1024;
const CV_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const contentToParagraphs = (content?: string) =>
  (content || '').split(/\n{2,}/).map(item => item.trim()).filter(Boolean);

// PHẢI khớp shift_label() ở backend (backend/app/content/routes.py) — cùng dấu gạch nối "–".
const shiftLabel = (shift: JobShift) => `${shift.name} ${shift.start_time}–${shift.end_time}`;

// Không dùng toISOString() để so ngày local (nó quy đổi UTC, lệch ngày quanh nửa đêm giờ VN).
const todayLocalISODate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const emptyApplicationForm = {
  full_name: '',
  phone: '',
  email: '',
  date_of_birth: '',
  address: '',
  preferred_branch_id: '',
  preferred_shift_id: '',
  experience: '',
  education: '',
  available_date: '',
  expected_salary: '',
  introduction: '',
  agreed_terms: false,
};

type ApplicationForm = typeof emptyApplicationForm;
type FieldErrors = Partial<Record<keyof ApplicationForm | 'cv', string>>;

interface SuccessInfo {
  application_code: string;
  job_title: string;
  branch_name: string;
  shift_name: string;
}

/* ─────────────── Modal ứng tuyển (role=dialog, focus trap, giữ dữ liệu khi lỗi) ─────────────── */
const ApplicationModal: React.FC<{
  post: Post;
  onClose: () => void;
}> = ({ post, onClose }) => {
  const job = post.job_post!;
  const jobBranches = job.branches || [];
  const jobShifts = job.shifts || [];
  // Ca cấu trúc CHỈ áp dụng cho bài employment_type === 'shift' — bài full_time/part_time
  // dù lỡ mang theo shifts (dữ liệu cũ) cũng không bị bắt chọn ca. Phải khớp
  // resolve_application_shift() ở backend.
  const isShiftEmployment = job.employment_type === 'shift';
  const singleBranch = jobBranches.length === 1 ? jobBranches[0] : null;
  const singleShift = isShiftEmployment && jobShifts.length === 1 ? jobShifts[0] : null;
  const needBranchChoice = jobBranches.length >= 2;
  const needShiftChoice = isShiftEmployment && jobShifts.length >= 2;

  const initialForm = useRef<ApplicationForm>({
    ...emptyApplicationForm,
    preferred_branch_id: singleBranch?.branch_id || '',
    preferred_shift_id: singleShift?.id || '',
  });
  const [form, setForm] = useState<ApplicationForm>(initialForm.current);
  const [cv, setCv] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Kiểm tra TOÀN BỘ field của form (không chỉ vài field) — dữ liệu ở bất kỳ field
  // nào cũng phải kích hoạt cảnh báo xác nhận đóng. So với giá trị khởi tạo (không
  // phải rỗng cứng) để không tính nhầm ca/cơ sở tự gán (auto-assign khi bài chỉ có
  // 1 lựa chọn) là "đã nhập".
  const isDirty = useMemo(() => {
    const initial = initialForm.current;
    const fieldChanged = (Object.keys(emptyApplicationForm) as (keyof ApplicationForm)[]).some(
      key => form[key] !== initial[key],
    );
    return fieldChanged || !!cv;
  }, [form, cv]);

  // Focus vào field đầu tiên khi mở; khóa scroll nền
  useEffect(() => {
    firstFieldRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const requestClose = () => {
    if (success) { onClose(); return; }
    if (isDirty) setShowCloseConfirm(true);
    else onClose();
  };

  // Escape để đóng + focus trap trong dialog
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      // Dialog xác nhận đóng đang mở thì Escape CHỈ đóng dialog đó — không được
      // "xuyên" xuống đóng luôn modal chính, kẻo người dùng dùng bàn phím bị mất
      // control (2 lớp dialog cùng đóng một lúc, không thể huỷ ý định đóng).
      if (showCloseConfirm) {
        setShowCloseConfirm(false);
      } else {
        requestClose();
      }
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true');
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  const updateField = (field: keyof ApplicationForm, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => (prev[field] ? { ...prev, [field]: undefined } : prev));
    setApiError('');
  };

  const handleCvChange = (file?: File) => {
    if (!file) { setCv(null); return; }
    if (!CV_TYPES.includes(file.type) || !/\.(pdf|doc|docx)$/i.test(file.name)) {
      setErrors(prev => ({ ...prev, cv: 'CV chỉ hỗ trợ PDF, DOC hoặc DOCX.' }));
      return;
    }
    if (file.size > MAX_CV_SIZE) {
      setErrors(prev => ({ ...prev, cv: 'CV không được vượt quá 5MB.' }));
      return;
    }
    setErrors(prev => ({ ...prev, cv: undefined }));
    setCv(file);
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (form.full_name.trim().length < 2) next.full_name = 'Họ tên phải có ít nhất 2 ký tự.';
    if (!/^(0|\+84)[0-9]{8,10}$/.test(form.phone.replace(/\s/g, ''))) next.phone = 'Số điện thoại không đúng định dạng Việt Nam.';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Email không đúng định dạng.';
    if (form.date_of_birth && form.date_of_birth >= todayLocalISODate()) next.date_of_birth = 'Ngày sinh không hợp lệ.';
    if (needShiftChoice && !form.preferred_shift_id) next.preferred_shift_id = 'Vui lòng chọn ca làm việc mong muốn.';
    if (needBranchChoice && !form.preferred_branch_id) next.preferred_branch_id = 'Vui lòng chọn cơ sở mong muốn.';
    if (!form.agreed_terms) next.agreed_terms = 'Bạn cần đồng ý điều khoản xử lý dữ liệu để gửi hồ sơ.';
    return next;
  };

  const focusFirstError = (next: FieldErrors) => {
    const firstKey = Object.keys(next)[0];
    if (!firstKey || !dialogRef.current) return;
    const el = dialogRef.current.querySelector<HTMLElement>(`[data-field="${firstKey}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstError(next);
      return;
    }
    setSubmitting(true);
    setApiError('');
    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (typeof value === 'boolean' || String(value).trim()) payload.append(key, String(value));
      });
      if (cv) payload.append('cv', cv);
      const res = await submitJobApplication(post.id, payload);
      setSuccess({
        application_code: res.application?.application_code || '',
        job_title: res.job_title || job.job_title || post.title,
        branch_name: res.branch_name || singleBranch?.branch_name || '',
        shift_name: res.shift_name || (singleShift ? shiftLabel(singleShift) : ''),
      });
      bodyRef.current?.scrollTo({ top: 0 });
    } catch (err: any) {
      // Giữ modal mở + giữ nguyên dữ liệu đã nhập, chỉ hiển thị lỗi
      setApiError(err.response?.data?.detail || 'Không thể gửi hồ sơ. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (hasError?: string) =>
    `w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-primary ${hasError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-2 sm:items-center sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) requestClose(); }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-modal-title"
        aria-describedby="application-modal-summary"
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:max-w-[820px] sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="application-modal-title" className="text-base font-extrabold text-slate-950 md:text-lg">
              {success ? 'Gửi hồ sơ ứng tuyển thành công' : `Ứng tuyển vị trí ${job.job_title || post.title}`}
            </h2>
            {!success && <p className="mt-0.5 text-xs text-slate-500">Thông tin của bạn chỉ dùng cho mục đích tuyển dụng Giặt Ký.</p>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Đóng form ứng tuyển"
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-900"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body cuộn */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
          {success ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto text-emerald-500" size={44} />
              <p className="mt-4 text-sm text-slate-600">Cảm ơn bạn đã ứng tuyển. Bộ phận tuyển dụng sẽ liên hệ với bạn trong thời gian sớm nhất.</p>
              <div className="mx-auto mt-5 max-w-sm space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
                <p><span className="font-bold text-slate-500">Mã hồ sơ:</span> <span className="font-black text-slate-950">{success.application_code}</span></p>
                <p><span className="font-bold text-slate-500">Vị trí:</span> {success.job_title}</p>
                {success.branch_name && <p><span className="font-bold text-slate-500">Cơ sở:</span> {success.branch_name}</p>}
                {success.shift_name && <p><span className="font-bold text-slate-500">Ca ứng tuyển:</span> {success.shift_name}</p>}
              </div>
            </div>
          ) : (
            <form id="job-application-form" onSubmit={handleSubmit} noValidate>
              {/* Tóm tắt vị trí — tự điền từ bài tuyển dụng, không bắt nhập lại */}
              <section id="application-modal-summary" className="rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Thông tin vị trí">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Thông tin vị trí</h3>
                <dl className="mt-2 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                  <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Vị trí:</dt><dd className="font-bold text-slate-900">{job.job_title || post.title}</dd></div>
                  {job.department && <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Phòng ban:</dt><dd>{job.department}</dd></div>}
                  <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Cơ sở:</dt><dd>{jobBranches.length ? jobBranches.map(b => b.branch_name).join(', ') : 'Theo trao đổi'}</dd></div>
                  <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Ca tuyển:</dt><dd>{jobShifts.length ? jobShifts.map(shiftLabel).join(', ') : (job.shift_name || 'Theo trao đổi')}</dd></div>
                  {job.salary_text && <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Mức lương:</dt><dd>{job.salary_text}</dd></div>}
                  <div className="flex gap-2"><dt className="shrink-0 font-bold text-slate-500">Hạn nộp:</dt><dd>{job.application_deadline ? new Date(job.application_deadline).toLocaleDateString('vi-VN') : 'Đến khi đủ hồ sơ'}</dd></div>
                </dl>
              </section>

              {apiError && (
                <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {apiError}
                </div>
              )}

              <h3 className="mt-5 text-[11px] font-black uppercase tracking-wider text-slate-400">Thông tin ứng viên</h3>
              <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div data-field="full_name">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-full-name">Họ và tên *</label>
                  <input id="app-full-name" ref={firstFieldRef} value={form.full_name} onChange={e => updateField('full_name', e.target.value)} className={`mt-1 ${inputCls(errors.full_name)}`} />
                  {errors.full_name && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.full_name}</p>}
                </div>
                <div data-field="phone">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-phone">Số điện thoại *</label>
                  <input id="app-phone" inputMode="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} className={`mt-1 ${inputCls(errors.phone)}`} />
                  {errors.phone && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.phone}</p>}
                </div>
                <div data-field="email">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-email">Email</label>
                  <input id="app-email" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className={`mt-1 ${inputCls(errors.email)}`} />
                  {errors.email && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.email}</p>}
                </div>
                <div data-field="date_of_birth">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-dob">Ngày sinh</label>
                  <input id="app-dob" type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} className={`mt-1 ${inputCls(errors.date_of_birth)}`} />
                  {errors.date_of_birth && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.date_of_birth}</p>}
                </div>

                {/* Ca làm mong muốn: chỉ hiển thị khi bài tuyển ≥2 ca */}
                {needShiftChoice && (
                  <fieldset className="sm:col-span-2" data-field="preferred_shift_id">
                    <legend className="text-sm font-bold text-slate-700">Ca làm mong muốn *</legend>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {jobShifts.map(shift => (
                        <label key={shift.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${form.preferred_shift_id === shift.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>
                          <input
                            type="radio"
                            name="preferred_shift_id"
                            value={shift.id}
                            checked={form.preferred_shift_id === shift.id}
                            onChange={() => updateField('preferred_shift_id', shift.id)}
                            className="sr-only"
                          />
                          <Clock3 size={14} className="shrink-0" />
                          {shiftLabel(shift)}
                        </label>
                      ))}
                    </div>
                    {errors.preferred_shift_id && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.preferred_shift_id}</p>}
                  </fieldset>
                )}
                {singleShift && (
                  <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    <Clock3 size={14} className="mr-1 inline" /> Ca ứng tuyển: <span className="font-bold text-slate-900">{shiftLabel(singleShift)}</span>
                  </p>
                )}

                {/* Cơ sở mong muốn: chỉ hiển thị khi bài tuyển ≥2 cơ sở */}
                {needBranchChoice && (
                  <div className="sm:col-span-2" data-field="preferred_branch_id">
                    <label className="text-sm font-bold text-slate-700" htmlFor="app-branch">Cơ sở mong muốn *</label>
                    <select id="app-branch" value={form.preferred_branch_id} onChange={e => updateField('preferred_branch_id', e.target.value)} className={`mt-1 bg-white ${inputCls(errors.preferred_branch_id)}`}>
                      <option value="">— Chọn cơ sở —</option>
                      {jobBranches.map(branch => (
                        <option key={branch.branch_id} value={branch.branch_id}>{branch.branch_name}</option>
                      ))}
                    </select>
                    {errors.preferred_branch_id && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.preferred_branch_id}</p>}
                  </div>
                )}
                {singleBranch && (
                  <p className="sm:col-span-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
                    <MapPin size={14} className="mr-1 inline" /> Cơ sở ứng tuyển: <span className="font-bold text-slate-900">{singleBranch.branch_name}</span>
                  </p>
                )}

                <div>
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-available">Ngày có thể bắt đầu</label>
                  <input id="app-available" type="date" value={form.available_date} onChange={e => updateField('available_date', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-salary">Mức lương mong muốn</label>
                  <input id="app-salary" value={form.expected_salary} onChange={e => updateField('expected_salary', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-address">Địa chỉ</label>
                  <input id="app-address" value={form.address} onChange={e => updateField('address', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-exp">Kinh nghiệm làm việc</label>
                  <textarea id="app-exp" rows={3} value={form.experience} onChange={e => updateField('experience', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-edu">Trình độ học vấn</label>
                  <textarea id="app-edu" rows={3} value={form.education} onChange={e => updateField('education', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-intro">Giới thiệu thêm</label>
                  <textarea id="app-intro" rows={4} value={form.introduction} onChange={e => updateField('introduction', e.target.value)} className={`mt-1 ${inputCls()}`} />
                </div>
                <div className="sm:col-span-2" data-field="cv">
                  <label className="text-sm font-bold text-slate-700" htmlFor="app-cv">CV đính kèm</label>
                  <input id="app-cv" type="file" accept=".pdf,.doc,.docx" onChange={e => handleCvChange(e.target.files?.[0])} className="mt-1 block w-full text-sm" />
                  <p className={`mt-1 text-xs ${errors.cv ? 'font-semibold text-rose-600' : 'text-slate-400'}`}>{errors.cv || (cv ? cv.name : 'PDF, DOC hoặc DOCX, tối đa 5MB.')}</p>
                </div>
                <div className="sm:col-span-2" data-field="agreed_terms">
                  <label className="flex items-start gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={form.agreed_terms} onChange={e => updateField('agreed_terms', e.target.checked)} className="mt-1" />
                    <span>Tôi đồng ý để Giặt Ký lưu và xử lý thông tin ứng tuyển cho mục đích tuyển dụng, theo <Link to="/privacy" className="font-bold underline">chính sách bảo mật</Link>.</span>
                  </label>
                  {errors.agreed_terms && <p className="mt-1 text-xs font-semibold text-rose-600">{errors.agreed_terms}</p>}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer cố định */}
        <div className="border-t border-slate-100 bg-white px-5 py-3">
          {success ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-950">Xem lại bài tuyển dụng</button>
              <button type="button" onClick={onClose} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white hover:bg-black">Đóng</button>
            </div>
          ) : (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={requestClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-slate-950">Hủy</button>
              <button type="submit" form="job-application-form" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-black text-white hover:bg-black disabled:opacity-60">
                <Send size={15} />{submitting ? 'Đang gửi...' : 'Gửi hồ sơ ứng tuyển'}
              </button>
            </div>
          )}
        </div>

        {/* Xác nhận đóng khi đã nhập dữ liệu — custom dialog, không dùng window.confirm */}
        {showCloseConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 p-4" role="alertdialog" aria-modal="true" aria-label="Xác nhận đóng form">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
              <h3 className="text-sm font-black text-slate-950">Thông tin chưa được gửi</h3>
              <p className="mt-2 text-sm text-slate-600">Hồ sơ bạn đang nhập sẽ không được lưu. Bạn có muốn đóng không?</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setShowCloseConfirm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">Tiếp tục nhập</button>
                <button type="button" onClick={onClose} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white hover:bg-rose-700">Đóng form</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PublicPostDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadPost();
  }, [slug]);

  const jobBranches = useMemo(() => post?.job_post?.branches || [], [post]);
  const jobShifts = useMemo(() => post?.job_post?.shifts || [], [post]);
  const deadlinePassed = useMemo(() => {
    const deadline = post?.job_post?.application_deadline;
    if (!deadline) return false;
    return deadline < todayLocalISODate();
  }, [post]);
  // Chỉ hiện nút khi: bài đã published (API public chỉ trả published), là tuyển dụng,
  // bật ứng tuyển online và chưa quá hạn nộp
  const applicationEnabled = post?.post_type === 'recruitment'
    && !!post.job_post?.allow_online_application
    && !!post.allow_application_form;
  const canApply = applicationEnabled && !deadlinePassed;
  const postPath = post ? `/${post.post_type === 'recruitment' ? 'tuyen-dung' : location.pathname.startsWith('/bai-viet') ? 'bai-viet' : 'blog'}/${post.slug}` : location.pathname;

  const loadPost = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      setPost(await getPublicPost(slug));
    } finally {
      setLoading(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    // Trả focus về nút "Ứng tuyển ngay" khi đóng modal
    requestAnimationFrame(() => applyButtonRef.current?.focus());
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><LoadingSpinner /></div>;

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-extrabold text-slate-900">Không tìm thấy bài viết</h1>
          <Link to="/bai-viet" className="mt-3 inline-block text-primary text-sm font-bold">Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title={post.meta_title || post.title}
        description={post.meta_description || post.excerpt || 'Bài viết từ Giặt Ký.'}
        path={postPath}
        keywords={post.keywords || [post.category, ...(post.tags || [])].filter(Boolean).join(', ')}
        image={post.og_image || post.featured_image || undefined}
        type="article"
        publishedTime={post.published_at}
        modifiedTime={post.updated_at}
        jsonLd={[
          buildOrganizationSchema(),
          buildBreadcrumbSchema([
            { name: 'Trang chủ', path: '/' },
            { name: post.post_type === 'recruitment' ? 'Tuyển dụng' : 'Blog', path: post.post_type === 'recruitment' ? '/tuyen-dung' : '/blog' },
            { name: post.title, path: postPath },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': post.post_type === 'recruitment' ? 'JobPosting' : 'BlogPosting',
            headline: post.title,
            description: post.meta_description || post.excerpt || post.title,
            image: post.og_image || post.featured_image,
            url: `${SITE_URL}${postPath}`,
            datePublished: post.published_at,
            dateModified: post.updated_at || post.published_at,
            author: {
              '@type': 'Person',
              name: post.author_name || 'Giặt Ký',
            },
            publisher: { '@id': `${SITE_URL}/#organization` },
          },
        ]}
      />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-8">
        <Link to={post.post_type === 'recruitment' ? '/tuyen-dung' : '/bai-viet'} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary mb-6">
          <ArrowLeft size={16} /> Quay lại
        </Link>

        <article className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {post.featured_image && <img src={post.featured_image} alt={post.title} loading="lazy" className="w-full max-h-[420px] object-cover" />}
          <div className="p-5 md:p-8 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="px-2 py-1 rounded-md bg-slate-100 font-bold">{post.post_type === 'recruitment' ? 'Tuyển dụng' : 'Bài viết'}</span>
                <span className="inline-flex items-center gap-1"><Calendar size={13} />{post.published_at ? new Date(post.published_at).toLocaleDateString('vi-VN') : '-'}</span>
              </div>
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-950">{post.title}</h1>
              {post.excerpt && <p className="text-base text-slate-600">{post.excerpt}</p>}
            </div>

            {post.post_type === 'recruitment' && post.job_post && (
              <section className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Vị trí</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.job_title || post.title}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Lương</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.salary_text || 'Trao đổi khi phỏng vấn'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
                    <div className="text-[11px] text-slate-500 font-bold uppercase">Hạn ứng tuyển</div>
                    <div className="text-sm font-bold text-slate-900 mt-1">{post.job_post.application_deadline ? new Date(post.job_post.application_deadline).toLocaleDateString('vi-VN') : 'Đến khi đủ hồ sơ'}</div>
                  </div>
                  {jobShifts.length > 0 && (
                    <div className="md:col-span-3 rounded-lg border border-slate-200 p-4 bg-white">
                      <div className="text-[11px] text-slate-500 font-bold uppercase mb-2">Ca tuyển dụng</div>
                      <div className="flex flex-wrap gap-2">
                        {jobShifts.map(shift => (
                          <span key={shift.id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                            <Clock3 size={12} />{shiftLabel(shift)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {jobBranches.length > 0 && (
                    <div className="md:col-span-3 rounded-lg border border-slate-200 p-4 bg-white">
                      <div className="text-[11px] text-slate-500 font-bold uppercase mb-2">Cơ sở tuyển dụng</div>
                      <div className="flex flex-wrap gap-2">
                        {jobBranches.map(branch => (
                          <span key={branch.branch_id} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                            <MapPin size={12} />{branch.branch_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Nút Ứng tuyển ngay — mở modal, không chuyển trang */}
                {canApply ? (
                  <button
                    ref={applyButtonRef}
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white hover:bg-black"
                  >
                    <Briefcase size={16} /> Ứng tuyển ngay
                  </button>
                ) : applicationEnabled && deadlinePassed ? (
                  <p className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-6 py-3 text-sm font-bold text-slate-500">
                    Đã hết hạn ứng tuyển
                  </p>
                ) : null}
              </section>
            )}

            <div className="prose prose-slate max-w-none">
              {contentToParagraphs(post.content).map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line text-slate-700 leading-7">{paragraph}</p>
              ))}
            </div>
          </div>
        </article>
      </main>

      {/* Thanh Ứng tuyển cố định cuối màn hình trên mobile */}
      {canApply && !modalOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-black text-white"
          >
            <Briefcase size={16} /> Ứng tuyển ngay
          </button>
        </div>
      )}

      {modalOpen && post.job_post && <ApplicationModal post={post} onClose={closeModal} />}
    </div>
  );
};

export default PublicPostDetail;
