import React, { useEffect, useState } from 'react';
import { checkIn, checkOut, getMyAttendance, getAttendanceList, getAttendanceSummary, AttendanceRecord, AttendanceSummary } from '../../api/attendance';
import { getBranches, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Clock, Play, Square, History, Filter, UserCheck, Calendar } from 'lucide-react';

const Attendance: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [time, setTime] = useState(new Date());
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [staffUsers, setStaffUsers] = useState<User[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState('');

  // Admin/Manager filter states
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');

  useEffect(() => {
    // Realtime digital clock update
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [selectedBranch, selectedStaff]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      if (user?.role === 'staff') {
        const [sumData, historyData] = await Promise.all([
          getAttendanceSummary(),
          getMyAttendance()
        ]);
        setSummary(sumData);
        setRecords(historyData);
      } else {
        // Manager or Admin
        const [branchesData, staffData, listData] = await Promise.all([
          getBranches(),
          getUsers(),
          getAttendanceList({
            branch_id: selectedBranch || undefined,
            staff_id: selectedStaff || undefined
          })
        ]);
        setBranches(branchesData);
        setStaffUsers(staffData.filter(u => u.role === 'staff'));
        setRecords(listData);
      }
    } catch (_) {
      addToast('Không thể tải lịch sử chấm công.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setActionLoading(true);
    try {
      await checkIn(note);
      addToast('Check-in thành công! Bắt đầu ca làm việc.', 'success');
      setNote('');
      loadInitialData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Check-in thất bại.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setActionLoading(true);
    try {
      await checkOut(note);
      addToast('Check-out thành công! Hoàn tất ca làm việc.', 'success');
      setNote('');
      loadInitialData();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Check-out thất bại.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatHours = (h: number) => {
    return `${h.toFixed(2)} giờ`;
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800">Chấm công ca làm</h2>
        <p className="text-xs text-slate-500">
          {user?.role === 'staff' 
            ? 'Thực hiện Check-in vào ca và Check-out khi tan ca hằng ngày'
            : 'Theo dõi ca làm việc hằng ngày của nhân sự tiệm giặt'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Real-time Clock & Action Card (Only for Staff) */}
        {user?.role === 'staff' && (
          <div className="bg-white p-6 rounded-[20px] border border-[#ECECEC] shadow-card space-y-6 flex flex-col justify-between">
            <div className="text-center space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Thời gian hiện tại</h3>
              <div className="text-3xl font-mono font-bold text-primary tracking-wider">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-xs font-medium text-slate-500">
                {time.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {/* Current shift stats */}
            {summary && (
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Trạng thái hiện tại:</span>
                  <span className={`font-bold ${summary.status === 'checked_in' ? 'text-emerald-600' : 'text-slate-500'}`}>
                    {summary.status === 'checked_in' ? 'Đang làm ca' : 'Nghỉ ca'}
                  </span>
                </div>
                {summary.current_shift && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Thời gian vào ca:</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(summary.current_shift.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 font-medium">
                  <span>Giờ tích lũy tháng này:</span>
                  <span className="font-bold text-slate-800">{formatHours(summary.total_hours_month)}</span>
                </div>
              </div>
            )}

            {/* Shift notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Ghi chú ca làm (nếu có)</label>
              <input
                type="text"
                placeholder="Ví dụ: Đi muộn do kẹt xe, nhận ca bàn giao..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary bg-slate-50 focus:bg-white"
                disabled={actionLoading}
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              {summary?.status === 'checked_out' || !summary ? (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Play size={16} /> Check-in Vào Ca
                </button>
              ) : (
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Square size={14} /> Check-out Tan Ca
                </button>
              )}
            </div>
          </div>
        )}

        {/* Attendance Filters (Only for Admin/Manager) */}
        {user?.role !== 'staff' && (
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-1">
              <Filter size={14} /> Bộ lọc danh sách
            </h3>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Cơ sở chi nhánh</label>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary bg-white"
                >
                  <option value="">Tất cả cơ sở</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Nhân viên (Staff)</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary bg-white"
                >
                  <option value="">Tất cả nhân viên</option>
                  {staffUsers.map(st => (
                    <option key={st.id} value={st.id}>{st.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* History Listing Logs (2 cols width) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <History size={14} /> Lịch sử chấm công
          </h3>

          {loading && records.length === 0 ? (
            <LoadingSpinner />
          ) : records.length === 0 ? (
            <EmptyState message="Không có bản ghi chấm công nào." />
          ) : (
            <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                      {user?.role !== 'staff' && <th className="p-4">Họ tên</th>}
                      <th className="p-4">Ngày</th>
                      <th className="p-4">Vào ca</th>
                      <th className="p-4">Tan ca</th>
                      <th className="p-4">Tổng giờ</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(rec => {
                      const statColors = {
                        checked_in: 'bg-primary/10 text-primary border-primary/20',
                        completed: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                        missing_checkout: 'bg-rose-50 text-rose-600 border-rose-200'
                      }[rec.status] || 'bg-slate-50 text-slate-500';

                      const statNames = {
                        checked_in: 'Đang làm',
                        completed: 'Hoàn tất',
                        missing_checkout: 'Thiếu checkout'
                      }[rec.status] || rec.status;

                      return (
                        <tr key={rec.id} className="border-b border-slate-100 last:border-b-0 hover:bg-primary/5 transition-colors">
                          {user?.role !== 'staff' && (
                            <td className="p-4 font-bold text-slate-800">{rec.staff_name || 'Nhân viên'}</td>
                          )}
                          <td className="p-4 text-slate-600 font-medium">
                            {new Date(rec.work_date).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-4 font-semibold text-slate-700">
                            {new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-4 font-semibold text-slate-700">
                            {rec.check_out_time 
                              ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '-'}
                          </td>
                          <td className="p-4 font-bold text-slate-800">
                            {rec.status === 'completed' ? formatHours(rec.total_hours) : '-'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded-md tracking-wider ${statColors}`}>
                              {statNames}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 italic max-w-xs truncate">{rec.note || '-'}</td>
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

export default Attendance;
