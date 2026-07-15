import React, { useEffect, useState } from 'react';
import { getPayrolls, generatePayroll, confirmPayroll, payPayroll, getMyPayroll, PayrollRecord } from '../../api/payroll';
import { createManualAttendance, getAdminAttendance, AttendanceRecord, ManualAttendancePayload } from '../../api/attendance';
import { getBranches, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import { CircleDollarSign, PlusCircle, Check, Filter, CreditCard, Clock, X } from 'lucide-react';

const Payroll: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const confirm = useConfirm();

  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'payroll' | 'attendance'>('payroll');
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceErrors, setAttendanceErrors] = useState<Record<string, string>>({});

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
  const [attendanceFilters, setAttendanceFilters] = useState({ date_from: '', date_to: '', branch_id: '', staff_id: '', status_filter: '', source: '' });
  const [manualForm, setManualForm] = useState<ManualAttendancePayload>({
    staff_id: '',
    work_date: new Date().toISOString().slice(0, 10),
    shift_name: 'Ca sáng',
    shift_start_time: '08:00',
    shift_end_time: '17:00',
    check_in_at: '',
    check_out_at: '',
    break_minutes: 60,
    adjustment_type: 'Quên chấm giờ vào',
    manual_reason: '',
    note: ''
  });

  useEffect(() => {
    loadBranches();
    loadPayrollData();
  }, [filterMonth, filterYear, filterBranch, user?.branch_id]);

  useEffect(() => {
    if (activeTab === 'attendance' && user?.role !== 'staff') {
      loadAttendanceData();
    }
  }, [activeTab, attendanceFilters]);

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
  const userBelongsToBranch = (staff: User, branchId: string) => {
    if (!branchId) return true;
    return staff.branch_id === branchId || (staff.assigned_branches || []).some(branch => branch.branch_id === branchId) || (staff.branch_ids || []).includes(branchId);
  };

  const branchStaffOptions = staffUsers.filter(u => userBelongsToBranch(u, genBranchId));

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

  const loadAttendanceData = async () => {
    setAttendanceLoading(true);
    setAttendanceError('');
    try {
      const data = await getAdminAttendance({
        date_from: attendanceFilters.date_from || undefined,
        date_to: attendanceFilters.date_to || undefined,
        branch_id: attendanceFilters.branch_id || undefined,
        staff_id: attendanceFilters.staff_id || undefined,
        status_filter: attendanceFilters.status_filter || undefined,
        source: attendanceFilters.source || undefined
      });
      setAttendanceRecords(data);
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Không thể tải dữ liệu chấm công.';
      setAttendanceRecords([]);
      setAttendanceError(detail);
      addToast(detail, 'error');
    } finally {
      setAttendanceLoading(false);
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
    await confirm({
      title: 'Chốt bảng lương?',
      description: 'Hành động này sẽ xác nhận bảng lương, gửi email và thông báo lương tới nhân viên.',
      objectName: name,
      confirmText: 'Chốt bảng lương',
      variant: 'warning',
      onConfirm: async () => {
        try {
          await confirmPayroll(id);
          addToast('Xác nhận bảng lương thành công.', 'success');
          setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'confirmed' } : p));
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Xác nhận thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const handlePay = async (id: string, name: string) => {
    await confirm({
      title: 'Xác nhận chi trả lương?',
      description: 'Bảng lương sẽ được chuyển sang trạng thái đã thanh toán.',
      objectName: name,
      confirmText: 'Xác nhận chi trả',
      variant: 'default',
      onConfirm: async () => {
        try {
          await payPayroll(id);
          addToast('Cập nhật trạng thái Đã thanh toán lương thành công.', 'success');
          setPayrolls(prev => prev.map(p => p.id === id ? { ...p, status: 'paid' } : p));
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Thanh toán lương thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const toDateTimeIso = (workDate: string, clock?: string, addDay = false) => {
    if (!clock) return undefined;
    const value = new Date(`${workDate}T${clock}:00`);
    if (addDay) value.setDate(value.getDate() + 1);
    return value.toISOString();
  };

  const handleManualAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!manualForm.staff_id) errors.staff_id = 'Vui lòng chọn nhân viên.';
    if (!manualForm.work_date) errors.work_date = 'Vui lòng chọn ngày làm việc.';
    if (!manualForm.shift_name.trim()) errors.shift_name = 'Vui lòng nhập ca làm việc.';
    if (!manualForm.manual_reason.trim()) errors.manual_reason = 'Bắt buộc nhập lý do.';
    setAttendanceErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setActionLoading(true);
    try {
      const checkoutIsNextDay = Boolean(manualForm.check_in_at && manualForm.check_out_at && manualForm.check_out_at <= manualForm.check_in_at);
      await createManualAttendance({
        ...manualForm,
        check_in_at: toDateTimeIso(manualForm.work_date, manualForm.check_in_at),
        check_out_at: toDateTimeIso(manualForm.work_date, manualForm.check_out_at, checkoutIsNextDay),
        shift_start_time: manualForm.shift_start_time || undefined,
        shift_end_time: manualForm.shift_end_time || undefined,
        break_minutes: Number(manualForm.break_minutes || 0)
      });
      addToast('Đã thêm chấm công thủ công.', 'success');
      setShowAttendanceModal(false);
      setManualForm(prev => ({ ...prev, staff_id: '', manual_reason: '', note: '', check_in_at: '', check_out_at: '' }));
      loadAttendanceData();
      loadPayrollData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể thêm chấm công.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatTime = (value?: string) => value ? new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '-';

  const statusLabel = (status?: string) => ({
    checked_in: 'Đang làm',
    completed: 'Hoàn tất',
    on_time: 'Đúng giờ',
    late: 'Đi muộn',
    early_leave: 'Về sớm',
    missing_checkin: 'Thiếu giờ vào',
    missing_checkout: 'Thiếu giờ ra',
    leave_paid: 'Nghỉ có phép',
    leave_unpaid: 'Nghỉ không phép',
    manual_adjusted: 'Đã chỉnh sửa thủ công'
  }[status || ''] || status || '-');

  const activeStaffOptions = staffUsers.filter(u => userBelongsToBranch(u, attendanceFilters.branch_id));

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

      {user?.role !== 'staff' && (
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'payroll' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Bảng lương
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'attendance' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            Chấm công
          </button>
        </div>
      )}

      {activeTab === 'payroll' && (
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
      )}

      {user?.role !== 'staff' && activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-[20px] border border-[#ECECEC] shadow-card flex flex-wrap gap-3 items-center text-xs font-semibold text-slate-600">
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-slate-400" />
              <span>Lọc chấm công:</span>
            </div>
            <input type="date" value={attendanceFilters.date_from} onChange={e => setAttendanceFilters(prev => ({ ...prev, date_from: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white" />
            <input type="date" value={attendanceFilters.date_to} onChange={e => setAttendanceFilters(prev => ({ ...prev, date_to: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white" />
            <select value={attendanceFilters.branch_id} onChange={e => setAttendanceFilters(prev => ({ ...prev, branch_id: e.target.value, staff_id: '' }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white">
              <option value="">Tất cả cơ sở</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={attendanceFilters.staff_id} onChange={e => setAttendanceFilters(prev => ({ ...prev, staff_id: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white">
              <option value="">Tất cả nhân viên</option>
              {activeStaffOptions.map(st => <option key={st.id} value={st.id}>{st.full_name}</option>)}
            </select>
            <select value={attendanceFilters.status_filter} onChange={e => setAttendanceFilters(prev => ({ ...prev, status_filter: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white">
              <option value="">Tất cả trạng thái</option>
              <option value="on_time">Đúng giờ</option>
              <option value="late">Đi muộn</option>
              <option value="early_leave">Về sớm</option>
              <option value="missing_checkin">Thiếu giờ vào</option>
              <option value="missing_checkout">Thiếu giờ ra</option>
              <option value="leave_paid">Nghỉ có phép</option>
              <option value="leave_unpaid">Nghỉ không phép</option>
              <option value="manual_adjusted">Đã chỉnh sửa thủ công</option>
            </select>
            <select value={attendanceFilters.source} onChange={e => setAttendanceFilters(prev => ({ ...prev, source: e.target.value }))} className="px-3 py-1.5 border border-slate-200 rounded-lg outline-none bg-slate-50 focus:bg-white">
              <option value="">Tất cả nguồn</option>
              <option value="STAFF_CHECK_IN">STAFF_CHECK_IN</option>
              <option value="STAFF_CHECK_OUT">STAFF_CHECK_OUT</option>
              <option value="ADMIN_MANUAL">ADMIN_MANUAL</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
            <button onClick={() => setShowAttendanceModal(true)} className="ml-auto px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm">
              <PlusCircle size={14} />
              Thêm chấm công
            </button>
          </div>

          {attendanceLoading ? (
            <LoadingSpinner />
          ) : attendanceError ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
              {attendanceError}
            </div>
          ) : attendanceRecords.length === 0 ? (
            <EmptyState message="Không có bản ghi chấm công nào được tìm thấy." />
          ) : (
            <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs min-w-[1280px]">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      <th className="p-4">Nhân viên</th>
                      <th className="p-4">Ngày làm việc</th>
                      <th className="p-4">Ca</th>
                      <th className="p-4">Giờ vào</th>
                      <th className="p-4">Giờ ra</th>
                      <th className="p-4">Giờ làm</th>
                      <th className="p-4">Đi muộn</th>
                      <th className="p-4">Về sớm</th>
                      <th className="p-4">Tăng ca</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Nguồn</th>
                      <th className="p-4">Ghi chú</th>
                      <th className="p-4">Cập nhật</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map(rec => (
                      <tr key={rec.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-800">{rec.staff_name || 'Nhân viên'}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{rec.staff_username || rec.branch_name || '-'}</div>
                        </td>
                        <td className="p-4 font-semibold text-slate-700">{rec.work_date}</td>
                        <td className="p-4 text-slate-600">{rec.shift_name || '-'}</td>
                        <td className="p-4 text-slate-600">{formatTime(rec.check_in_at || rec.check_in_time)}</td>
                        <td className="p-4 text-slate-600">{formatTime(rec.check_out_at || rec.check_out_time)}</td>
                        <td className="p-4 font-bold text-slate-700">{rec.total_hours || 0}</td>
                        <td className="p-4">{rec.late_minutes || 0} phút</td>
                        <td className="p-4">{rec.early_leave_minutes || 0} phút</td>
                        <td className="p-4">{rec.overtime_minutes || 0} phút</td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 border text-[9px] font-bold uppercase rounded-md tracking-wider bg-primary/5 text-primary border-primary/20">
                            {statusLabel(rec.status)}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-500">{rec.source || 'STAFF_CHECK_IN'}</td>
                        <td className="p-4 max-w-[180px] text-slate-500 truncate">{rec.note || rec.manual_reason || '-'}</td>
                        <td className="p-4 text-slate-500">
                          <div>{rec.updated_by_name || '-'}</div>
                          <div className="text-[10px] text-slate-400">{rec.updated_at ? new Date(rec.updated_at).toLocaleString('vi-VN') : '-'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] border border-slate-200 shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5"><Clock size={16} className="text-primary" /> Thêm chấm công thủ công</h3>
                <p className="text-xs text-slate-500">Dùng khi nhân viên quên chấm công hoặc cần điều chỉnh có lý do.</p>
              </div>
              <button onClick={() => setShowAttendanceModal(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>

            <form onSubmit={handleManualAttendance} className="p-5 space-y-4" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nhân viên *</label>
                  <select value={manualForm.staff_id} onChange={e => setManualForm(prev => ({ ...prev, staff_id: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary">
                    <option value="">Chọn nhân viên</option>
                    {staffUsers.map(st => <option key={st.id} value={st.id}>{st.full_name} - {st.username}</option>)}
                  </select>
                  {attendanceErrors.staff_id && <p className="text-[10px] text-rose-600 font-semibold">{attendanceErrors.staff_id}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Ngày làm việc *</label>
                  <input type="date" value={manualForm.work_date} onChange={e => setManualForm(prev => ({ ...prev, work_date: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                  {attendanceErrors.work_date && <p className="text-[10px] text-rose-600 font-semibold">{attendanceErrors.work_date}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Ca làm việc *</label>
                  <input value={manualForm.shift_name} onChange={e => setManualForm(prev => ({ ...prev, shift_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                  {attendanceErrors.shift_name && <p className="text-[10px] text-rose-600 font-semibold">{attendanceErrors.shift_name}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Bắt đầu ca</label>
                  <input type="time" value={manualForm.shift_start_time} onChange={e => setManualForm(prev => ({ ...prev, shift_start_time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Kết thúc ca</label>
                  <input type="time" value={manualForm.shift_end_time} onChange={e => setManualForm(prev => ({ ...prev, shift_end_time: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Giờ vào</label>
                  <input type="time" value={manualForm.check_in_at} onChange={e => setManualForm(prev => ({ ...prev, check_in_at: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Giờ ra</label>
                  <input type="time" value={manualForm.check_out_at} onChange={e => setManualForm(prev => ({ ...prev, check_out_at: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                  {attendanceErrors.check_out_at && <p className="text-[10px] text-rose-600 font-semibold">{attendanceErrors.check_out_at}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Nghỉ giữa ca (phút)</label>
                  <input type="number" min={0} value={manualForm.break_minutes} onChange={e => setManualForm(prev => ({ ...prev, break_minutes: Number(e.target.value) }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Loại điều chỉnh *</label>
                <select value={manualForm.adjustment_type} onChange={e => setManualForm(prev => ({ ...prev, adjustment_type: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary">
                  {['Quên chấm giờ vào', 'Quên chấm giờ ra', 'Quên cả giờ vào và giờ ra', 'Nghỉ có phép', 'Tăng ca', 'Điều chỉnh sai giờ', 'Khác'].map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Lý do *</label>
                <input value={manualForm.manual_reason} onChange={e => setManualForm(prev => ({ ...prev, manual_reason: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary" placeholder="Nhân viên quên chấm công do..." />
                {attendanceErrors.manual_reason && <p className="text-[10px] text-rose-600 font-semibold">{attendanceErrors.manual_reason}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Ghi chú</label>
                <textarea value={manualForm.note} onChange={e => setManualForm(prev => ({ ...prev, note: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none bg-white focus:border-primary resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAttendanceModal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">Hủy</button>
                <button type="submit" disabled={actionLoading} className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-dark disabled:bg-secondary text-white text-xs font-bold shadow-sm">
                  {actionLoading ? 'Đang lưu...' : 'Lưu chấm công'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payroll;
