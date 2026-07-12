import React, { useEffect, useState } from 'react';
import { getPayrolls, generatePayroll, confirmPayroll, payPayroll, getMyPayroll, PayrollRecord } from '../../api/payroll';
import { getBranches, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { CircleDollarSign, Calendar, PlusCircle, Check, DollarSign, Filter, CreditCard } from 'lucide-react';

const Payroll: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Generate form state
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [genBranchId, setGenBranchId] = useState('');
  const [genStaffId, setGenStaffId] = useState('');
  const [formErrors, setFormErrors] = useState<{ month?: string; year?: string; branch?: string; staff?: string }>({});

  // Filters state
  const [filterMonth, setFilterMonth] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');

  useEffect(() => {
    loadBranches();
    loadPayrollData();
  }, [filterMonth, filterYear, filterBranch]);

  const loadBranches = async () => {
    if (user?.role !== 'staff') {
      try {
        const [branchData, userData] = await Promise.all([getBranches(), getUsers()]);
        setBranches(branchData);
        setStaffUsers(userData.filter(u => u.role === 'staff' && u.status === 'active'));
      } catch (_) {}
    }
  };

  // Staff options are restricted to the selected branch (real data from Supabase via backend)
  const branchStaffOptions = staffUsers.filter(u => u.branch_id === genBranchId);

  const loadPayrollData = async () => {
    setLoading(true);
    try {
      if (user?.role === 'staff') {
        const data = await getMyPayroll();
        setPayrolls(data);
      } else {
        const data = await getPayrolls({
          month: filterMonth ? Number(filterMonth) : undefined,
          year: filterYear ? Number(filterYear) : undefined,
          branch_id: filterBranch || undefined
        });
        setPayrolls(data);
      }
    } catch (_) {
      addToast('Không thể tải dữ liệu bảng lương.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: typeof formErrors = {};
    if (!selectedMonth) errors.month = 'Vui lòng chọn tháng.';
    if (!selectedYear) errors.year = 'Vui lòng chọn năm.';
    if (!genBranchId) errors.branch = 'Vui lòng chọn chi nhánh.';
    if (!genStaffId) errors.staff = 'Vui lòng chọn nhân viên cần tính lương.';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setActionLoading(true);
    try {
      const result = await generatePayroll(selectedMonth, selectedYear, genBranchId, genStaffId);
      addToast(result.message || 'Tính toán bảng lương thành công.', 'success');
      setGenStaffId('');
      loadPayrollData();
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Tính lương thất bại.';
      // Business errors relate to the selected employee — surface them under that field too
      setFormErrors(prev => ({ ...prev, staff: detail }));
      addToast(detail, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xác nhận bảng lương cho nhân viên ${name}? Hành động này sẽ gửi email và thông báo lương tới nhân viên.`)) return;

    try {
      await confirmPayroll(id);
      addToast('Xác nhận bảng lương thành công.', 'success');
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'confirmed' } : p));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xác nhận thất bại.', 'error');
    }
  };

  const handlePay = async (id: string, name: string) => {
    if (!window.confirm(`Xác nhận đã thanh toán/chi trả lương cho nhân viên ${name}?`)) return;

    try {
      await payPayroll(id);
      addToast('Cập nhật trạng thái Đã thanh toán lương thành công.', 'success');
      setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' } : p));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thanh toán lương thất bại.', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800">Tính & Thanh toán lương</h2>
        <p className="text-xs text-slate-500">
          {user?.role === 'staff'
            ? 'Theo dõi lịch sử tính lương và chi trả lương hằng tháng của bạn'
            : 'Quản lý bảng tính lương giờ cho tất cả nhân sự theo tháng và chi nhánh'}
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${user?.role !== 'staff' ? 'lg:grid-cols-[380px_1fr]' : ''}`}>

        {/* Payroll Generation controls (Only for Admin/Manager) */}
        {user?.role !== 'staff' && (
          <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4 h-fit">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1">
              <PlusCircle size={14} className="text-primary" /> Tính lương tháng mới
            </h3>

            <form onSubmit={handleGenerate} className="space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Tháng</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => { setSelectedMonth(Number(e.target.value)); setFormErrors(prev => ({ ...prev, month: undefined })); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary"
                  >
                    {[...Array(12)].map((_, i) => (
                      <option key={i+1} value={i+1}>Tháng {i+1}</option>
                    ))}
                  </select>
                  {formErrors.month && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.month}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Năm</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => { setSelectedYear(Number(e.target.value)); setFormErrors(prev => ({ ...prev, year: undefined })); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary"
                  >
                    <option value={2026}>2026</option>
                    <option value={2027}>2027</option>
                  </select>
                  {formErrors.year && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.year}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Chọn cơ sở chi nhánh</label>
                <select
                  value={genBranchId}
                  onChange={(e) => {
                    setGenBranchId(e.target.value);
                    setGenStaffId('');
                    setFormErrors(prev => ({ ...prev, branch: undefined, staff: undefined }));
                  }}
                  className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none bg-white focus:border-primary ${formErrors.branch ? 'border-rose-300' : 'border-slate-200'}`}
                >
                  <option value="">Chọn chi nhánh cần tính</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {formErrors.branch && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.branch}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Nhân viên</label>
                <select
                  value={genStaffId}
                  onChange={(e) => { setGenStaffId(e.target.value); setFormErrors(prev => ({ ...prev, staff: undefined })); }}
                  disabled={!genBranchId}
                  className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none bg-white focus:border-primary disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed ${formErrors.staff ? 'border-rose-300' : 'border-slate-200'}`}
                >
                  <option value="">
                    {!genBranchId
                      ? 'Vui lòng chọn chi nhánh trước'
                      : branchStaffOptions.length === 0
                      ? 'Chi nhánh chưa có nhân viên nào'
                      : 'Chọn nhân viên cần tính lương'}
                  </option>
                  {genBranchId && branchStaffOptions.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.full_name} — {st.username}{st.hourly_rate ? ` (${new Intl.NumberFormat('vi-VN').format(st.hourly_rate)} đ/giờ)` : ''}
                    </option>
                  ))}
                </select>
                {formErrors.staff && <p className="text-[10px] text-rose-600 font-semibold">{formErrors.staff}</p>}
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <CircleDollarSign size={16} />
                {actionLoading ? 'Đang tính lương...' : 'Tính lương tự động'}
              </button>
            </form>
          </div>
        )}

        {/* Filters & Listing */}
        <div className="space-y-4">
          
          {/* Filters (Admin/Manager only) */}
          {user?.role !== 'staff' && (
            <div className="bg-white p-4 rounded-[20px] border border-[#ECECEC] shadow-card flex flex-wrap gap-4 items-center text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-1">
                <Filter size={14} className="text-slate-400" />
                <span>Lọc bảng lương:</span>
              </div>

              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
              >
                <option value="">Tất cả tháng</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i+1} value={i+1}>Tháng {i+1}</option>
                ))}
              </select>

              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
              >
                <option value="">Tất cả năm</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>

              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white"
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Listing */}
          {loading ? (
            <LoadingSpinner />
          ) : payrolls.length === 0 ? (
            <EmptyState message="Không có bản ghi lương nào được tìm thấy." />
          ) : (
            <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-4">Nhân viên</th>
                      <th className="p-4">Thời gian</th>
                      <th className="p-4">Mức lương giờ</th>
                      <th className="p-4">Tổng giờ</th>
                      <th className="p-4">Thành tiền</th>
                      <th className="p-4">Trạng thái</th>
                      {user?.role !== 'staff' && <th className="p-4 text-center">Xử lý</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map(pr => {
                      const statColors = {
                        draft: 'bg-slate-50 text-slate-500 border-slate-200',
                        confirmed: 'bg-amber-50 text-amber-600 border-amber-200',
                        paid: 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      }[pr.status] || 'bg-slate-50 text-slate-500';

                      const statNames = {
                        draft: 'Bản nháp',
                        confirmed: 'Đã khóa/Chờ trả',
                        paid: 'Đã chi trả'
                      }[pr.status] || pr.status;

                      return (
                        <tr key={pr.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{pr.staff_name || 'Nhân viên'}</div>
                            {user?.role !== 'staff' && (
                              <div className="text-[10px] text-slate-400 mt-0.5">{pr.branch_name || 'Cơ sở'}</div>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-slate-700">
                            Tháng {pr.month}/{pr.year}
                          </td>
                          <td className="p-4 font-semibold text-slate-600">
                            {formatCurrency(pr.hourly_rate_snapshot)}/giờ
                          </td>
                          <td className="p-4 font-bold text-slate-700">
                            {pr.total_hours} giờ
                          </td>
                          <td className="p-4 font-extrabold text-primary">
                            {formatCurrency(pr.total_salary)}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded-md tracking-wider ${statColors}`}>
                              {statNames}
                            </span>
                          </td>
                          {user?.role !== 'staff' && (
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                {pr.status === 'draft' && (
                                  <button
                                    onClick={() => handleConfirm(pr.id, pr.staff_name || '')}
                                    className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 shadow-sm transition-all"
                                  >
                                    <Check size={12} /> Khóa/Chốt
                                  </button>
                                )}
                                {pr.status === 'confirmed' && (
                                  <button
                                    onClick={() => handlePay(pr.id, pr.staff_name || '')}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-0.5 shadow-sm transition-all"
                                  >
                                    <CreditCard size={12} /> Chi trả
                                  </button>
                                )}
                                {pr.status === 'paid' && (
                                  <span className="text-[10px] text-slate-400 font-semibold italic flex items-center gap-0.5">
                                    <Check size={12} className="text-emerald-500" /> Đã hoàn thành
                                  </span>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Payroll;
