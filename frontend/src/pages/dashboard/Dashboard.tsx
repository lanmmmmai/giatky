import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { getDashboardSummary, DashboardSummary } from '../../api/reports';
import { checkIn, checkOut, getMyAttendance, getAttendanceSummary, AttendanceSummary, AttendanceRecord } from '../../api/attendance';
import { getBranches } from '../../api/branches';
import LoadingSpinner from '../../components/LoadingSpinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie } from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  MapPin,
  UserCheck,
  Users,
  Clock,
  CircleDollarSign,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Globe,
  Play,
  Square
} from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#171717', '#737373', '#16A34A', '#D97706', '#DC2626'];

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const base = `/${user?.role}`;

  // "Chấm công hôm nay" card state (staff only) — real data from attendance API
  const [clock, setClock] = useState(new Date());
  const [attSummary, setAttSummary] = useState<AttendanceSummary | null>(null);
  const [todayRecords, setTodayRecords] = useState<AttendanceRecord[]>([]);
  const [branchName, setBranchName] = useState('');
  const [attLoading, setAttLoading] = useState(false);
  const [attActionLoading, setAttActionLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (user?.role !== 'staff') return;
    const timer = setInterval(() => setClock(new Date()), 1000);
    loadAttendanceState();
    getBranches().then(bs => setBranchName(bs[0]?.name || '')).catch(() => {});
    return () => clearInterval(timer);
  }, [user?.role]);

  const loadAttendanceState = async () => {
    setAttLoading(true);
    try {
      const [summary, history] = await Promise.all([getAttendanceSummary(), getMyAttendance()]);
      setAttSummary(summary);
      const todayStr = new Date().toISOString().slice(0, 10);
      setTodayRecords(history.filter(r => r.work_date === todayStr));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tải trạng thái chấm công.', 'error');
    } finally {
      setAttLoading(false);
    }
  };

  const handleCheckIn = async () => {
    setAttActionLoading(true);
    try {
      await checkIn();
      addToast('Check-in thành công! Bắt đầu ca làm việc.', 'success');
      await loadAttendanceState();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Check-in thất bại.', 'error');
    } finally {
      setAttActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setAttActionLoading(true);
    try {
      await checkOut();
      addToast('Check-out thành công! Hoàn tất ca làm việc.', 'success');
      await loadAttendanceState();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Check-out thất bại.', 'error');
    } finally {
      setAttActionLoading(false);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const summary = await getDashboardSummary();
      setData(summary);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể lấy thông tin tổng quan báo cáo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!data) return <div className="text-center py-12 text-slate-500">Không có dữ liệu hiển thị.</div>;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="page-shell">
      {/* Staff: "Chấm công hôm nay" — always first so no one forgets to check in */}
      {user?.role === 'staff' && (() => {
        const workingShift = attSummary?.status === 'checked_in' ? attSummary.current_shift : null;
        const completedToday = !workingShift ? todayRecords.find(r => r.status === 'completed') : null;
        const fmtTime = (iso?: string | null) =>
          iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '--:--';

        return (
          <div className="surface-card p-6 border-2 border-primary/20 relative overflow-hidden">
            <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_80%_30%,rgba(23,23,23,0.08),transparent_55%)] pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-6 justify-between">
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={14} strokeWidth={2} /> Chấm công hôm nay
                </h3>
                <p className="text-sm font-semibold text-slate-700 capitalize">
                  {clock.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </p>
                <p className="text-3xl font-mono font-bold text-slate-900 tracking-wider">
                  {clock.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </p>
                <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                  <MapPin size={12} strokeWidth={1.5} className="text-slate-400" />
                  Chi nhánh: <span className="font-bold text-slate-700">{branchName || 'Chưa được gán chi nhánh'}</span>
                </p>
              </div>

              <div className="space-y-3 md:text-right">
                {attLoading ? (
                  <span className="text-xs text-slate-400 font-medium">Đang tải trạng thái...</span>
                ) : workingShift ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Đang làm việc
                    </span>
                    <p className="text-xs text-slate-500">
                      Giờ vào: <span className="font-bold font-mono text-slate-800">{fmtTime(workingShift.check_in_time)}</span>
                    </p>
                  </>
                ) : completedToday ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                      <CheckCircle2 size={11} strokeWidth={2} /> Đã hoàn thành
                    </span>
                    <p className="text-xs text-slate-500">
                      Vào: <span className="font-bold font-mono text-slate-800">{fmtTime(completedToday.check_in_time)}</span>
                      {' · '}Ra: <span className="font-bold font-mono text-slate-800">{fmtTime(completedToday.check_out_time)}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Tổng thời gian: <span className="font-bold text-slate-800">{Number(completedToday.total_hours).toFixed(2)} giờ</span>
                    </p>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 border border-amber-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    <AlertCircle size={11} strokeWidth={2} /> Chưa check-in
                  </span>
                )}

                {!attLoading && (
                  workingShift ? (
                    <button
                      onClick={handleCheckOut}
                      disabled={attActionLoading}
                      className="w-full md:w-auto px-8 py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-2xl text-sm font-bold shadow-[0_12px_26px_rgba(225,29,72,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Square size={16} /> {attActionLoading ? 'Đang xử lý...' : 'Chấm công ra'}
                    </button>
                  ) : completedToday ? null : (
                    <button
                      onClick={handleCheckIn}
                      disabled={attActionLoading}
                      className="w-full md:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-2xl text-sm font-bold shadow-[0_12px_26px_rgba(5,150,105,0.25)] transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Play size={16} /> {attActionLoading ? 'Đang xử lý...' : 'Chấm công vào'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Welcome Banner */}
      <div className="bg-white border border-[#ECECEC] text-slate-900 rounded-[24px] p-7 relative overflow-hidden shadow-card">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_70%_40%,rgba(23,23,23,0.10),transparent_45%)] pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-xl">
          <span className="inline-block px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-bold uppercase tracking-wider text-primary">
            Hệ thống quản trị
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">Xin chào, {user?.full_name}!</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {user?.role === 'admin' 
              ? 'Hôm nay hệ thống của bạn hoạt động thế nào? Dưới đây là báo cáo toàn chuỗi.'
              : user?.role === 'manager'
              ? 'Quản lý vận hành chi nhánh ổn định. Theo dõi ca trực và đơn hàng bên dưới.'
              : 'Chúc bạn có một ngày làm việc hiệu quả và phục vụ khách hàng chu đáo.'}
          </p>
        </div>
        <div className="absolute right-6 bottom-[-44px] opacity-[0.06] text-primary font-bold text-9xl pointer-events-none font-mono">
          {user?.role.toUpperCase()}
        </div>
      </div>

      {/* Top Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="surface-card p-6 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh thu hôm nay</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatCurrency(data.revenue_today)}</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-[20px] group-hover:bg-primary group-hover:text-white transition-colors">
            <CircleDollarSign size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="surface-card p-6 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh thu tháng này</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatCurrency(data.revenue_month)}</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-[20px] group-hover:bg-primary group-hover:text-white transition-colors">
            <TrendingUp size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="surface-card p-6 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Đơn hàng mới hôm nay</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{data.orders_today_count} đơn</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-[20px] group-hover:bg-primary group-hover:text-white transition-colors">
            <ShoppingBag size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="surface-card p-6 hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Đang xử lý (Giặt/Sấy)</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{data.orders_processing_count} đơn</h3>
          </div>
          <div className="p-3 bg-primary/10 text-primary rounded-[20px] group-hover:bg-primary group-hover:text-white transition-colors">
            <Clock size={20} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Admin Specific Graphs */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Over Time Chart */}
          <div className="lg:col-span-2 surface-card p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Biểu đồ doanh thu 7 ngày qua</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_revenue || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#171717" stopOpacity={0.16}/>
                      <stop offset="95%" stopColor="#171717" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid #ECECEC', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)' }}
                    labelClassName="text-slate-400 text-[10px] font-bold"
                    formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} 
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#171717" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue by branch */}
          <div className="surface-card p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Doanh thu theo cơ sở</h3>
            {data.revenue_by_branch && data.revenue_by_branch.length > 0 ? (
              <div className="h-64 flex flex-col justify-between">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenue_by_branch}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="branch_name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ background: '#ffffff', border: '1px solid #ECECEC', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)' }}
                        formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} 
                      />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {(data.revenue_by_branch || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-500 mt-3 pt-2 border-t border-slate-50">
                  {data.revenue_by_branch.map((item, idx) => (
                    <div key={item.branch_name} className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="truncate">{item.branch_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">Không có dữ liệu phân bổ doanh thu</div>
            )}
          </div>
        </div>
      )}

      {/* Manager Specific section */}
      {user?.role === 'manager' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active working staff card */}
          <div className="surface-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Nhân viên ca trực</h3>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={10} strokeWidth={1.5} /> Hoạt động
              </span>
            </div>
            <div className="space-y-3">
              {data.active_staff && data.active_staff.length > 0 ? (
                data.active_staff.map(st => (
                  <div key={st.id} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-[20px] bg-primary/10 text-primary border border-primary/15 flex items-center justify-center font-bold text-xs">
                        {st.full_name[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{st.full_name}</span>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">Không có nhân viên nào check-in.</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 surface-card p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Thao tác nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to={`${base}/orders/create`} className="p-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-[20px] text-center space-y-2 group transition-all btn-press">
                <ShoppingBag className="mx-auto text-primary group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Tạo đơn hàng</h4>
              </Link>
              <Link to={`${base}/staff`} className="p-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-[20px] text-center space-y-2 group transition-all btn-press">
                <Users className="mx-auto text-indigo-600 group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Quản lý Staff</h4>
              </Link>
              <Link to={`${base}/services`} className="p-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-[20px] text-center space-y-2 group transition-all btn-press">
                <Briefcase className="mx-auto text-secondary group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Dịch vụ</h4>
              </Link>
              <Link to={`${base}/cms`} className="p-4 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-[20px] text-center space-y-2 group transition-all btn-press">
                <Globe className="mx-auto text-emerald-600 group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">CMS SEO</h4>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Staff Quick Checkin / Checkout Card */}
      {user?.role === 'staff' && (
        <div className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Chấm công hàng ngày</h3>
            <span className="text-[11px] text-slate-500 font-medium">Giờ làm việc được ghi nhận trực tiếp trên hệ thống</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-primary/5 border border-primary/10 p-4 rounded-[20px]">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khu vực làm việc</h4>
              <p className="text-xs font-semibold text-slate-700">Sẵn sàng cho ca làm việc hôm nay của bạn?</p>
            </div>
            <Link
              to={`${base}/attendance`}
              className="primary-action"
            >
              <Clock size={14} strokeWidth={1.5} />
              Đến trang chấm công
            </Link>
          </div>
        </div>
      )}

      {/* Recent Orders List */}
      <div className="surface-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Đơn hàng mới nhận</h3>
          <Link to={`${base}/orders`} className="text-xs text-primary hover:text-primary-dark font-semibold transition-colors">Xem tất cả</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
                <th className="p-4 pl-6">Mã đơn</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Cơ sở</th>
                <th className="p-4">Tổng tiền</th>
                <th className="p-4">Trạng thái đơn</th>
                <th className="p-4">Thanh toán</th>
                <th className="p-4 pr-6">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">Không có đơn hàng nào gần đây.</td>
                </tr>
              ) : (
                data.recent_orders.map(order => {
                  const statusColors = {
                    new: 'bg-primary/10 text-primary border-primary/20',
                    washing: 'bg-secondary/10 text-secondary border-secondary/20',
                    drying: 'bg-neutral-100 text-neutral-700 border-neutral-200',
                    ready: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                    delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                    cancelled: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
                  }[order.status as string] || 'bg-slate-500/10 text-slate-500 border-slate-500/20';

                  const statusNames = {
                    new: 'Mới tạo',
                    washing: 'Đang giặt',
                    drying: 'Đang sấy',
                    ready: 'Sẵn sàng',
                    delivered: 'Đã giao',
                    cancelled: 'Đã hủy',
                  }[order.status as string] || order.status;

                  const payColors = {
                    unpaid: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
                    paid: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
                    partial: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
                  }[order.payment_status as string] || 'text-slate-500 bg-slate-500/10 border-slate-500/20';

                  const payNames = {
                    unpaid: 'Chưa trả',
                    paid: 'Đã trả',
                    partial: 'Một phần',
                  }[order.payment_status as string] || order.payment_status;

                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-primary/5 transition-colors">
                      <td className="p-4 pl-6 font-bold text-primary font-mono tracking-tight">
                        <Link to={`${base}/orders/${order.id}`} className="hover:underline">{order.order_code}</Link>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        <div>{order.customer_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 font-mono font-medium">{order.customer_phone}</div>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">{order.branch_name}</td>
                      <td className="p-4 font-mono font-bold text-slate-800">{formatCurrency(order.total_amount)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold tracking-wide ${statusColors}`}>
                          {statusNames}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-semibold tracking-wide ${payColors}`}>
                          {payNames}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-slate-400 font-mono text-[10px] font-medium">
                        {new Date(order.created_at).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
