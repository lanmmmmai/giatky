import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { getDashboardSummary, DashboardSummary } from '../../api/reports';
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
  Globe
} from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#2563EB', '#06B6D4', '#3B82F6', '#60A5FA', '#93C5FD'];

const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const base = `/${user?.role}`;

  useEffect(() => {
    loadDashboardData();
  }, []);

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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-7 relative overflow-hidden shadow-sm">
        <div className="relative z-10 space-y-2 max-w-xl">
          <span className="inline-block px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-bold uppercase tracking-wider text-secondary">
            Hệ thống quản trị
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-slate-100">Xin chào, {user?.full_name}!</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {user?.role === 'admin' 
              ? 'Hôm nay hệ thống của bạn hoạt động thế nào? Dưới đây là báo cáo toàn chuỗi.'
              : user?.role === 'manager'
              ? 'Quản lý vận hành chi nhánh ổn định. Theo dõi ca trực và đơn hàng bên dưới.'
              : 'Chúc bạn có một ngày làm việc hiệu quả và phục vụ khách hàng chu đáo.'}
          </p>
        </div>
        <div className="absolute right-0 bottom-[-50px] opacity-[0.03] text-white font-bold text-9xl pointer-events-none font-mono">
          {user?.role.toUpperCase()}
        </div>
      </div>

      {/* Top Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh thu hôm nay</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatCurrency(data.revenue_today)}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <CircleDollarSign size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Doanh thu tháng này</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{formatCurrency(data.revenue_month)}</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <TrendingUp size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Đơn hàng mới hôm nay</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{data.orders_today_count} đơn</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <ShoppingBag size={20} strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-between group">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Đang xử lý (Giặt/Sấy)</span>
            <h3 className="text-xl font-bold font-mono tracking-tight text-slate-800">{data.orders_processing_count} đơn</h3>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
            <Clock size={20} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Admin Specific Graphs */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Over Time Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-card space-y-4">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Biểu đồ doanh thu 7 ngày qua</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_revenue || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip 
                    contentStyle={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.04)' }}
                    labelClassName="text-slate-400 text-[10px] font-bold"
                    formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} 
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue by branch */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card space-y-4">
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
                        contentStyle={{ background: '#ffffff', border: '1px solid #f1f5f9', borderRadius: '12px', boxShadow: '0 10px 30px -10px rgba(0, 0, 0, 0.04)' }}
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
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card space-y-4">
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
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/15 flex items-center justify-center font-bold text-xs">
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

          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-card space-y-4">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Thao tác nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to={`${base}/orders/create`} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-2 group transition-all btn-press">
                <ShoppingBag className="mx-auto text-primary group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Tạo đơn hàng</h4>
              </Link>
              <Link to={`${base}/staff`} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-2 group transition-all btn-press">
                <Users className="mx-auto text-indigo-600 group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Quản lý Staff</h4>
              </Link>
              <Link to={`${base}/services`} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-2 group transition-all btn-press">
                <Briefcase className="mx-auto text-secondary group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">Dịch vụ</h4>
              </Link>
              <Link to={`${base}/cms`} className="p-4 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-2xl text-center space-y-2 group transition-all btn-press">
                <Globe className="mx-auto text-emerald-600 group-hover:scale-110 transition-transform" size={20} strokeWidth={1.5} />
                <h4 className="text-xs font-semibold text-slate-700">CMS SEO</h4>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Staff Quick Checkin / Checkout Card */}
      {user?.role === 'staff' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Chấm công hàng ngày</h3>
            <span className="text-[11px] text-slate-500 font-medium">Giờ làm việc được ghi nhận trực tiếp trên hệ thống</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-slate-50/50 border border-slate-100 p-4 rounded-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Khu vực làm việc</h4>
              <p className="text-xs font-semibold text-slate-700">Sẵn sàng cho ca làm việc hôm nay của bạn?</p>
            </div>
            <Link
              to={`${base}/attendance`}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-md transition-all btn-press flex items-center gap-2"
            >
              <Clock size={14} strokeWidth={1.5} />
              Đến trang chấm công
            </Link>
          </div>
        </div>
      )}

      {/* Recent Orders List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/20">
          <h3 className="font-bold text-slate-800 text-xs tracking-tight uppercase">Đơn hàng mới nhận</h3>
          <Link to={`${base}/orders`} className="text-xs text-primary hover:text-primary-dark font-semibold transition-colors">Xem tất cả</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
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
                    new: 'bg-primary/10 text-primary border-primary/20 dark:text-secondary',
                    washing: 'bg-secondary/100/10 text-secondary border-secondary/20 dark:text-secondary',
                    drying: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
                    ready: 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400',
                    delivered: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
                    cancelled: 'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400',
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
                    unpaid: 'text-rose-600 bg-rose-500/10 border-rose-500/20 dark:text-rose-400',
                    paid: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400',
                    partial: 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400',
                  }[order.payment_status as string] || 'text-slate-500 bg-slate-500/10 border-slate-500/20';

                  const payNames = {
                    unpaid: 'Chưa trả',
                    paid: 'Đã trả',
                    partial: 'Một phần',
                  }[order.payment_status as string] || order.payment_status;

                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/20 transition-colors">
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
