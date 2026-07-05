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
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <h2 className="text-2xl font-bold">Xin chào, {user?.full_name}!</h2>
          <p className="text-blue-100 text-sm">
            {user?.role === 'admin' 
              ? 'Hôm nay hệ thống của bạn hoạt động thế nào? Dưới đây là báo cáo toàn chuỗi.'
              : user?.role === 'manager'
              ? 'Quản lý vận hành chi nhánh ổn định. Theo dõi ca và đơn hàng bên dưới.'
              : 'Chúc bạn có một ngày làm việc hiệu quả và phục vụ khách hàng chu đáo.'}
          </p>
        </div>
        <div className="absolute right-0 bottom-[-50px] opacity-10 text-white font-bold text-9xl pointer-events-none font-mono">
          {user?.role.toUpperCase()}
        </div>
      </div>

      {/* Top Level Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Doanh thu hôm nay</span>
            <h3 className="text-xl font-bold text-slate-800">{formatCurrency(data.revenue_today)}</h3>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <CircleDollarSign size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Doanh thu tháng này</span>
            <h3 className="text-xl font-bold text-slate-800">{formatCurrency(data.revenue_month)}</h3>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <TrendingUp size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Đơn hàng mới hôm nay</span>
            <h3 className="text-xl font-bold text-slate-800">{data.orders_today_count} đơn</h3>
          </div>
          <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
            <ShoppingBag size={24} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Đang xử lý (Giặt/Sấy)</span>
            <h3 className="text-xl font-bold text-slate-800">{data.orders_processing_count} đơn</h3>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Admin Specific Graphs */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Over Time Chart */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Biểu đồ doanh thu 7 ngày qua</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.daily_revenue || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                  <Tooltip formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} />
                  <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue by branch */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Doanh thu theo cơ sở</h3>
            {data.revenue_by_branch && data.revenue_by_branch.length > 0 ? (
              <div className="h-64 flex flex-col justify-between">
                <div className="flex-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenue_by_branch}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="branch_name" stroke="#94A3B8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(value), 'Doanh thu']} />
                      <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                        {(data.revenue_by_branch || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-500 mt-2">
                  {data.revenue_by_branch.map((item, idx) => (
                    <div key={item.branch_name} className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="font-bold text-slate-800 text-sm">Nhân viên đang làm ca</h3>
              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={10} /> Realtime
              </span>
            </div>
            <div className="space-y-3">
              {data.active_staff && data.active_staff.length > 0 ? (
                data.active_staff.map(st => (
                  <div key={st.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-b-0">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {st.full_name[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{st.full_name}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-slate-400">Hiện không có nhân viên nào check-in ca làm việc.</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
            <h3 className="font-bold text-slate-800 text-sm">Thao tác nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Link to={`${base}/orders/create`} className="p-4 bg-blue-50/50 hover:bg-blue-50 border border-blue-100 rounded-2xl text-center space-y-2 group transition-all">
                <ShoppingBag className="mx-auto text-blue-600 group-hover:scale-110 transition-transform" size={24} />
                <h4 className="text-xs font-bold text-slate-700">Tạo đơn hàng</h4>
              </Link>
              <Link to={`${base}/staff`} className="p-4 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-2xl text-center space-y-2 group transition-all">
                <Users className="mx-auto text-indigo-600 group-hover:scale-110 transition-transform" size={24} />
                <h4 className="text-xs font-bold text-slate-700">Quản lý Staff</h4>
              </Link>
              <Link to={`${base}/services`} className="p-4 bg-cyan-50/50 hover:bg-cyan-50 border border-cyan-100 rounded-2xl text-center space-y-2 group transition-all">
                <Briefcase className="mx-auto text-cyan-600 group-hover:scale-110 transition-transform" size={24} />
                <h4 className="text-xs font-bold text-slate-700 font-sans">Dịch vụ</h4>
              </Link>
              <Link to={`${base}/cms`} className="p-4 bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-100 rounded-2xl text-center space-y-2 group transition-all">
                <Globe className="mx-auto text-emerald-600 group-hover:scale-110 transition-transform" size={24} />
                <h4 className="text-xs font-bold text-slate-700 font-sans">CMS SEO</h4>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Staff Quick Checkin / Checkout Card */}
      {user?.role === 'staff' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-800 text-sm">Chấm công hàng ngày</h3>
            <span className="text-xs font-medium text-slate-500">Giờ làm việc sẽ được tính trực tiếp từ lúc Check-in đến Check-out</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-slate-50 p-4 rounded-xl">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khu vực làm việc</h4>
              <p className="text-sm font-semibold text-slate-800">Bạn đã sẵn sàng cho ca làm hôm nay?</p>
            </div>
            <Link
              to={`${base}/attendance`}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-2"
            >
              <Clock size={16} />
              Đến Trang Chấm Công
            </Link>
          </div>
        </div>
      )}

      {/* Recent Orders List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">Đơn hàng mới tiếp nhận</h3>
          <Link to={`${base}/orders`} className="text-xs text-blue-600 hover:text-blue-800 font-semibold">Xem tất cả</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                <th className="p-4">Mã đơn</th>
                <th className="p-4">Khách hàng</th>
                <th className="p-4">Cơ sở</th>
                <th className="p-4">Tổng tiền</th>
                <th className="p-4">Trạng thái đơn</th>
                <th className="p-4">Thanh toán</th>
                <th className="p-4">Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Không có đơn hàng nào gần đây.</td>
                </tr>
              ) : (
                data.recent_orders.map(order => {
                  const statusColors = {
                    new: 'bg-blue-50 text-blue-600 border-blue-200',
                    washing: 'bg-cyan-50 text-cyan-600 border-cyan-200',
                    drying: 'bg-purple-50 text-purple-600 border-purple-200',
                    ready: 'bg-amber-50 text-amber-600 border-amber-200',
                    delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
                  }[order.status as string] || 'bg-slate-50 text-slate-500';

                  const statusNames = {
                    new: 'Mới tạo',
                    washing: 'Đang giặt',
                    drying: 'Đang sấy',
                    ready: 'Sẵn sàng',
                    delivered: 'Đã giao',
                    cancelled: 'Đã hủy',
                  }[order.status as string] || order.status;

                  const payColors = {
                    unpaid: 'text-rose-600 bg-rose-50 border-rose-200',
                    paid: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                    partial: 'text-amber-600 bg-amber-50 border-amber-200',
                  }[order.payment_status as string] || 'text-slate-500 bg-slate-50 border-slate-200';

                  const payNames = {
                    unpaid: 'Chưa trả',
                    paid: 'Đã trả',
                    partial: 'Một phần',
                  }[order.payment_status as string] || order.payment_status;

                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-blue-600">
                        <Link to={`${base}/orders/${order.id}`} className="hover:underline">{order.order_code}</Link>
                      </td>
                      <td className="p-4 font-medium text-slate-700">
                        <div>{order.customer_name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{order.customer_phone}</div>
                      </td>
                      <td className="p-4 text-slate-500">{order.branch_name}</td>
                      <td className="p-4 font-bold text-slate-800">{formatCurrency(order.total_amount)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusColors}`}>
                          {statusNames}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${payColors}`}>
                          {payNames}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">
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
