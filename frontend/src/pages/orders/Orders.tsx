import React, { useEffect, useState } from 'react';
import { getOrders, deleteOrder, Order, updateOrderStatus, updateOrderPayment } from '../../api/orders';
import { getBranches, Branch } from '../../api/branches';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Eye, 
  DollarSign, 
  CheckCircle,
  Truck,
  Layers,
  Calendar,
  AlertTriangle
} from 'lucide-react';

const Orders: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const base = `/${user?.role}`;

  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  useEffect(() => {
    loadBranches();
    loadOrders();
  }, [selectedBranch, selectedStatus, selectedPaymentStatus]);

  const loadBranches = async () => {
    if (user?.role !== 'staff') {
      try {
        const data = await getBranches();
        setBranches(data);
      } catch (_) {}
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await getOrders({
        branch_id: selectedBranch || undefined,
        status: selectedStatus || undefined,
        payment_status: selectedPaymentStatus || undefined,
        customer_phone: searchPhone.trim() || undefined
      });
      setOrders(data);
    } catch (err: any) {
      addToast('Không thể tải danh sách đơn hàng.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleDelete = async (id: string, code: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn đơn hàng ${code}?`)) return;

    try {
      await deleteOrder(id);
      addToast(`Xóa đơn hàng ${code} thành công.`, 'success');
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể xóa đơn hàng.', 'error');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string, code: string) => {
    try {
      await updateOrderStatus(id, newStatus);
      addToast(`Cập nhật trạng thái đơn ${code} thành công.`, 'success');
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus as any } : o));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật trạng thái thất bại.', 'error');
    }
  };

  const handleQuickPay = async (order: Order) => {
    try {
      await updateOrderPayment(order.id, {
        payment_status: 'paid',
        payment_method: 'cash',
        paid_amount: order.total_amount
      });
      addToast(`Thanh toán đơn hàng ${order.order_code} thành công (Tiền mặt).`, 'success');
      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: 'paid', paid_amount: order.total_amount, payment_method: 'cash' } : o));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thanh toán thất bại.', 'error');
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Title section & Create Order Link */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Danh sách đơn hàng</h2>
          <p className="text-xs text-slate-500">Quản lý nhận và xử lý đồ giặt ký của khách hàng</p>
        </div>
        <Link
          to={`${base}/orders/create`}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Plus size={16} />
          Tạo đơn hàng mới
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo số điện thoại khách hàng..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            Tìm kiếm
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-1">
            <Filter size={14} className="text-slate-400" />
            <span>Bộ lọc:</span>
          </div>

          {user?.role !== 'staff' && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg focus:bg-white outline-none"
            >
              <option value="">Tất cả cơ sở</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg focus:bg-white outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="new">Mới tạo</option>
            <option value="washing">Đang giặt</option>
            <option value="drying">Đang sấy</option>
            <option value="ready">Sẵn sàng giao</option>
            <option value="delivered">Đã giao khách</option>
            <option value="cancelled">Đã hủy</option>
          </select>

          <select
            value={selectedPaymentStatus}
            onChange={(e) => setSelectedPaymentStatus(e.target.value)}
            className="px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg focus:bg-white outline-none"
          >
            <option value="">Tất cả thanh toán</option>
            <option value="unpaid">Chưa thanh toán</option>
            <option value="paid">Đã thanh toán</option>
            <option value="partial">Thanh toán một phần</option>
          </select>
        </div>
      </div>

      {/* Orders List Table */}
      {loading ? (
        <LoadingSpinner />
      ) : orders.length === 0 ? (
        <EmptyState message="Không có đơn hàng nào khớp với bộ lọc." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-4">Mã đơn</th>
                  <th className="p-4">Khách hàng</th>
                  <th className="p-4">Cơ sở</th>
                  <th className="p-4">Tổng cộng</th>
                  <th className="p-4">Đã trả</th>
                  <th className="p-4">Trạng thái đơn</th>
                  <th className="p-4">Thanh toán</th>
                  <th className="p-4 text-center">Thao tác nhanh</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const statusColors = {
                    new: 'bg-blue-50 text-blue-600 border-blue-200',
                    washing: 'bg-cyan-50 text-cyan-600 border-cyan-200',
                    drying: 'bg-purple-50 text-purple-600 border-purple-200',
                    ready: 'bg-amber-50 text-amber-600 border-amber-200',
                    delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                    cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
                  }[order.status] || 'bg-slate-50 text-slate-500';

                  const statusNames = {
                    new: 'Mới tạo',
                    washing: 'Đang giặt',
                    drying: 'Đang sấy',
                    ready: 'Sẵn sàng',
                    delivered: 'Đã giao',
                    cancelled: 'Đã hủy',
                  }[order.status] || order.status;

                  const payColors = {
                    unpaid: 'text-rose-600 bg-rose-50 border-rose-200',
                    paid: 'text-emerald-600 bg-emerald-50 border-emerald-200',
                    partial: 'text-amber-600 bg-amber-50 border-amber-200',
                  }[order.payment_status] || 'text-slate-500 bg-slate-50 border-slate-200';

                  const payNames = {
                    unpaid: 'Chưa trả',
                    paid: 'Đã trả',
                    partial: 'Một phần',
                  }[order.payment_status] || order.payment_status;

                  return (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-blue-600">
                        <Link to={`${base}/orders/${order.id}`} className="hover:underline">{order.order_code}</Link>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{order.customer_name_snapshot}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{order.customer_phone_snapshot}</div>
                      </td>
                      <td className="p-4 text-slate-500">{order.branch_name || 'Cơ sở'}</td>
                      <td className="p-4 font-bold text-slate-800">{formatCurrency(order.total_amount)}</td>
                      <td className="p-4 text-slate-600">{formatCurrency(order.paid_amount)}</td>
                      <td className="p-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value, order.order_code)}
                          className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold outline-none ${statusColors}`}
                        >
                          <option value="new">Mới tạo</option>
                          <option value="washing">Đang giặt</option>
                          <option value="drying">Đang sấy</option>
                          <option value="ready">Sẵn sàng</option>
                          <option value="delivered">Đã giao khách</option>
                          <option value="cancelled">Đã hủy</option>
                        </select>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${payColors}`}>
                          {payNames}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            to={`${base}/orders/${order.id}`}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Xem chi tiết"
                          >
                            <Eye size={16} />
                          </Link>

                          {order.payment_status !== 'paid' && (
                            <button
                              onClick={() => handleQuickPay(order)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Thanh toán ngay bằng Tiền mặt"
                            >
                              <DollarSign size={16} />
                            </button>
                          )}

                          {user?.role === 'admin' && (
                            <button
                              onClick={() => handleDelete(order.id, order.order_code)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa đơn hàng"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;
