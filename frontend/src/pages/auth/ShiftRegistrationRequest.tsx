import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2, Calendar, Mail, MapPin, Phone, Send, User } from 'lucide-react';
import { getPublicBranches } from '../../api/branches';
import { createShiftRegistrationRequest, ShiftRegistrationRequestPayload } from '../../api/staffRequests';
import { useToastStore } from '../../stores/toastStore';

interface BranchOption {
  id: string;
  name: string;
  address?: string;
}

const shiftOptions = [
  'Ca sáng (06:00 - 14:00)',
  'Ca chiều (14:00 - 22:00)',
  'Ca tối (22:00 - 06:00)',
  'Ca linh hoạt'
];

const today = new Date().toISOString().slice(0, 10);

const ShiftRegistrationRequest: React.FC = () => {
  const { addToast } = useToastStore();
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<ShiftRegistrationRequestPayload>({
    full_name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    address: '',
    desired_shift: '',
    available_start_date: today,
    branch_id: '',
    note: ''
  });

  useEffect(() => {
    getPublicBranches()
      .then(setBranches)
      .catch(() => setBranches([]));
  }, []);

  const updateField = (field: keyof ShiftRegistrationRequestPayload, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const phoneRegex = /^(0|\+84)[0-9]{8,10}$/;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!form.full_name.trim()) nextErrors.full_name = 'Vui lòng nhập họ và tên.';
    if (!phoneRegex.test(form.phone.trim())) nextErrors.phone = 'Số điện thoại không đúng định dạng.';
    if (form.email && !emailRegex.test(form.email.trim())) nextErrors.email = 'Email không đúng định dạng.';
    if (!form.desired_shift) nextErrors.desired_shift = 'Vui lòng chọn ca muốn đăng ký.';
    if (!form.available_start_date) nextErrors.available_start_date = 'Vui lòng chọn ngày có thể bắt đầu.';
    if (form.available_start_date && form.available_start_date < today) {
      nextErrors.available_start_date = 'Ngày bắt đầu không được nhỏ hơn ngày hiện tại.';
    }
    if (!form.branch_id) nextErrors.branch_id = 'Vui lòng chọn chi nhánh.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || !validate()) return;

    setLoading(true);
    try {
      await createShiftRegistrationRequest({
        ...form,
        email: form.email?.trim() || undefined,
        date_of_birth: form.date_of_birth || undefined,
        address: form.address?.trim() || undefined,
        note: form.note?.trim() || undefined
      });
      setSuccess(true);
      addToast('Gửi yêu cầu đăng ký ca thành công. Quản trị viên sẽ liên hệ với bạn.', 'success');
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Không thể gửi yêu cầu. Vui lòng kiểm tra lại thông tin.';
      setErrors(prev => ({ ...prev, submit: detail }));
      addToast(detail, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/staff/login" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Quay lại trang đăng nhập</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Gửi yêu cầu đăng ký ca</h2>
        <p className="text-xs text-slate-500 font-medium">Thông tin của bạn sẽ được quản trị viên xem xét và liên hệ lại.</p>
      </div>

      {success ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-700">
          Gửi yêu cầu đăng ký ca thành công. Quản trị viên sẽ liên hệ với bạn.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Họ và tên *</label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={form.full_name} onChange={e => updateField('full_name', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="Nguyễn Văn A" disabled={loading} />
            </div>
            {errors.full_name && <p className="text-[10px] text-rose-600 font-semibold">{errors.full_name}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Số điện thoại *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input value={form.phone} onChange={e => updateField('phone', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="0987654321" disabled={loading} />
              </div>
              {errors.phone && <p className="text-[10px] text-rose-600 font-semibold">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="name@example.com" disabled={loading} />
              </div>
              {errors.email && <p className="text-[10px] text-rose-600 font-semibold">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ngày sinh</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="date" value={form.date_of_birth} onChange={e => updateField('date_of_birth', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" disabled={loading} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ngày có thể bắt đầu *</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="date" min={today} value={form.available_start_date} onChange={e => updateField('available_start_date', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" disabled={loading} />
              </div>
              {errors.available_start_date && <p className="text-[10px] text-rose-600 font-semibold">{errors.available_start_date}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Địa chỉ</label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={form.address} onChange={e => updateField('address', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" placeholder="Địa chỉ liên hệ" disabled={loading} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ca muốn đăng ký *</label>
              <select value={form.desired_shift} onChange={e => updateField('desired_shift', e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none" disabled={loading}>
                <option value="">Chọn ca làm việc</option>
                {shiftOptions.map(shift => <option key={shift} value={shift}>{shift}</option>)}
              </select>
              {errors.desired_shift && <p className="text-[10px] text-rose-600 font-semibold">{errors.desired_shift}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Chi nhánh *</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <select value={form.branch_id} onChange={e => updateField('branch_id', e.target.value)} className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none appearance-none" disabled={loading}>
                  <option value="">Chọn chi nhánh</option>
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </div>
              {errors.branch_id && <p className="text-[10px] text-rose-600 font-semibold">{errors.branch_id}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Ghi chú</label>
            <textarea value={form.note} onChange={e => updateField('note', e.target.value)} rows={3} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none resize-none" placeholder="Thời gian rảnh, kinh nghiệm, hoặc thông tin cần trao đổi thêm" disabled={loading} />
          </div>

          {errors.submit && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">{errors.submit}</div>}

          <button type="submit" disabled={loading} className="w-full h-11 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-semibold text-xs shadow-sm transition-all btn-press flex items-center justify-center gap-1.5">
            <Send size={14} />
            {loading ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ShiftRegistrationRequest;

