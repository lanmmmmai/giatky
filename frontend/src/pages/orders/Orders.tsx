import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { completeOrderDelivery, deleteOrder, getOrderDetail, getOrders, Order, updateOrderPayment, updateOrderStatus } from '../../api/orders';
import { getBranches, Branch } from '../../api/branches';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import { formatVnDateTime } from '../../utils/vnDatetime';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Trash2,
  Eye,
  DollarSign,
  MoreVertical,
  Printer,
  PackageCheck,
  Copy,
  X,
  ReceiptText,
  User,
  Clock3,
  BadgeCheck,
  CalendarDays,
  Filter,
} from 'lucide-react';

const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'new', label: 'Đơn mới' },
  { key: 'washing', label: 'Đang giặt' },
  { key: 'ready', label: 'Đã giặt' },
  { key: 'delivered', label: 'Đã trả' },
  { key: 'debt', label: 'Khách nợ' },
  { key: 'cancelled', label: 'Đã hủy' },
];

const statusNames: Record<string, string> = {
  new: 'Đơn mới',
  washing: 'Đang giặt',
  drying: 'Đang sấy',
  ready: 'Đã giặt',
  delivered: 'Đã trả',
  cancelled: 'Đã hủy',
};

const paymentNames: Record<string, string> = {
  unpaid: 'Khách nợ',
  paid: 'Đã thanh toán',
  partial: 'Một phần',
  none: 'Chưa chọn',
};

const Orders: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const confirm = useConfirm();
  const base = `/${user?.role}`;

  const [orders, setOrders] = useState<Order[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [openMenu, setOpenMenu] = useState<{ order: Order; top: number; left: number; openUp: boolean } | null>(null);

  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('');
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    loadBranches();
  }, [user?.role]);

  useEffect(() => {
    loadOrders();
  }, [selectedBranch, selectedStatus, selectedPaymentStatus, debouncedSearch, user?.branch_id]);

  useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('resize', close);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('resize', close);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  const loadBranches = async () => {
    if (user?.role !== 'staff') {
      try {
        setBranches(await getBranches());
      } catch (_) {}
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    try {
      const status = selectedStatus === 'debt' ? '' : selectedStatus;
      const data = await getOrders({
        branch_id: selectedBranch || undefined,
        status: status || undefined,
        payment_status: selectedStatus === 'debt' ? 'unpaid' : selectedPaymentStatus || undefined,
        search: debouncedSearch || undefined,
        page: 1,
        page_size: 80,
      });
      setOrders(data);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tải danh sách đơn hàng.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openQuickDetail = async (order: Order) => {
    setDrawerLoading(true);
    setSelectedOrder(order);
    setOpenMenu(null);
    try {
      const detail = await getOrderDetail(order.id);
      setSelectedOrder(detail);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tải chi tiết đơn.', 'error');
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleDelete = async (order: Order) => {
    setOpenMenu(null);
    await confirm({
      title: 'Xóa đơn hàng?',
      description: 'Đơn hàng sẽ bị xóa vĩnh viễn khỏi danh sách. Vui lòng kiểm tra kỹ trước khi xác nhận.',
      objectName: order.order_code,
      confirmText: 'Xóa đơn hàng',
      variant: 'danger',
      disableBackdropClose: true,
      onConfirm: async () => {
        try {
          await deleteOrder(order.id);
          addToast(`Xóa đơn hàng ${order.order_code} thành công.`, 'success');
          setOrders(prev => prev.filter(item => item.id !== order.id));
          if (selectedOrder?.id === order.id) setSelectedOrder(null);
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Không thể xóa đơn hàng.', 'error');
          throw err;
        }
      },
    });
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    setOpenMenu(null);
    try {
      await updateOrderStatus(order.id, newStatus);
      addToast(`Cập nhật trạng thái đơn ${order.order_code} thành công.`, 'success');
      setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: newStatus as any } : item));
      setSelectedOrder(prev => prev?.id === order.id ? { ...prev, status: newStatus as any } : prev);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật trạng thái thất bại.', 'error');
    }
  };

  const handleQuickPay = async (order: Order) => {
    setOpenMenu(null);
    try {
      await updateOrderPayment(order.id, { payment_status: 'paid', payment_method: 'cash', paid_amount: order.total_amount });
      addToast(`Thanh toán đơn hàng ${order.order_code} thành công.`, 'success');
      const patch = { payment_status: 'paid' as const, paid_amount: order.total_amount, payment_method: 'cash' as const };
      setOrders(prev => prev.map(item => item.id === order.id ? { ...item, ...patch } : item));
      setSelectedOrder(prev => prev?.id === order.id ? { ...prev, ...patch } : prev);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thanh toán thất bại.', 'error');
    }
  };

  const handleDeliver = async (order: Order) => {
    setOpenMenu(null);
    try {
      await completeOrderDelivery(order.id, order.payment_status === 'paid' ? {} : { payment_method: 'cash' });
      addToast(`Đã trả đồ đơn ${order.order_code}.`, 'success');
      setOrders(prev => prev.map(item => item.id === order.id ? { ...item, status: 'delivered', payment_status: 'paid', payment_method: item.payment_method === 'none' ? 'cash' : item.payment_method, paid_amount: item.total_amount } : item));
      if (selectedOrder?.id === order.id) openQuickDetail(order);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể trả đồ.', 'error');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

  const counts = useMemo(() => {
    const next: Record<string, number> = { '': orders.length, debt: 0 };
    for (const order of orders) {
      next[order.status] = (next[order.status] || 0) + 1;
      if (order.payment_status !== 'paid') next.debt += 1;
    }
    return next;
  }, [orders]);

  const statusBadge = (status: string) => ({
    new: 'bg-slate-950 text-white',
    washing: 'bg-slate-100 text-slate-900',
    drying: 'bg-slate-100 text-slate-900',
    ready: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    delivered: 'bg-neutral-100 text-neutral-500 border border-neutral-200',
    cancelled: 'bg-rose-50 text-rose-700 border border-rose-200',
  }[status] || 'bg-slate-100 text-slate-700');

  const paymentBadge = (paymentStatus: string) => paymentStatus === 'paid'
    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
    : 'bg-amber-50 text-amber-700 border border-amber-200';

  const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>, order: Order) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuHeight = 330;
    const menuWidth = 224;
    const openUp = rect.bottom + menuHeight > window.innerHeight - 16;
    const left = Math.min(Math.max(12, rect.right - menuWidth), window.innerWidth - menuWidth - 12);
    const top = openUp ? Math.max(12, rect.top - menuHeight - 8) : rect.bottom + 8;
    setOpenMenu({ order, top, left, openUp });
  };

  const badgeClass = (extra: string) =>
    `inline-flex items-center justify-center whitespace-nowrap shrink-0 min-h-8 px-3 py-1 rounded-full text-[11px] font-black ${extra}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Quầy vận hành</p>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">Danh sách đơn hàng</h2>
        </div>
        <Link to={`${base}/orders/create`} className="h-11 px-4 bg-slate-950 hover:bg-black text-white rounded-2xl text-xs font-black transition-all active:scale-[0.98] flex items-center justify-center gap-2">
          <Plus size={16} /> Nhận đồ mới
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key || 'all'}
            type="button"
            onClick={() => setSelectedStatus(tab.key)}
            className={`shrink-0 px-4 py-2 rounded-2xl text-xs font-black transition-all ${selectedStatus === tab.key ? 'bg-slate-950 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {tab.label} <span className={`ml-1 ${selectedStatus === tab.key ? 'text-white/70' : 'text-slate-400'}`}>{counts[tab.key] || 0}</span>
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-[20px] border border-[#ECECEC] shadow-card space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              placeholder="Tìm mã đơn, tên khách, SĐT, nhân viên..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:bg-white focus:border-slate-950 focus:ring-4 focus:ring-slate-950/5 transition-all"
            />
          </div>
          {user?.role !== 'staff' && (
            <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white">
              <option value="">Tất cả cơ sở</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          )}
          <select value={selectedPaymentStatus} onChange={e => setSelectedPaymentStatus(e.target.value)} className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white">
            <option value="">Tất cả thanh toán</option>
            <option value="unpaid">Khách nợ</option>
            <option value="paid">Đã thanh toán</option>
            <option value="partial">Một phần</option>
          </select>
        </div>
        <p className="text-[11px] text-slate-400 font-semibold flex items-center gap-1.5"><Filter size={13} /> Đang hiển thị tối đa 80 đơn gần nhất theo bộ lọc.</p>
      </div>

      {loading ? <LoadingSpinner /> : orders.length === 0 ? <EmptyState message="Không có đơn hàng nào khớp với bộ lọc." /> : (
        <div className="space-y-3 pb-10">
          <div className="hidden xl:grid grid-cols-[1.3fr_1.5fr_1.5fr_0.8fr_0.9fr_0.95fr_0.85fr_auto] gap-5 px-5 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>Mã đơn</span>
            <span>Khách hàng</span>
            <span>Ngày nhận / trả</span>
            <span>Nhân viên</span>
            <span>Trạng thái</span>
            <span>Thanh toán</span>
            <span className="text-right">Tổng tiền</span>
            <span className="text-center">Menu</span>
          </div>

          {orders.map(order => {
            const loyal = (order.customer_total_orders || 0) > 20;
            return (
              <article
                key={order.id}
                onClick={() => openQuickDetail(order)}
                className="group bg-white border border-[#ECECEC] shadow-card rounded-[22px] p-5 lg:p-6 min-h-[132px] cursor-pointer hover:border-slate-300 hover:shadow-[0_16px_34px_rgba(15,23,42,0.08)] transition-all"
              >
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.3fr_1.5fr_1.5fr_0.8fr_0.9fr_0.95fr_0.85fr_auto] xl:items-center">
                  <div className="min-w-0">
                    <p className="font-black text-slate-950 text-sm truncate">{order.order_code}</p>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{order.branch_name || 'Cơ sở'}</p>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black text-slate-900 truncate max-w-full">{order.customer_name_snapshot}</span>
                      {order.customer_is_vip && <span className={badgeClass('bg-slate-950 text-white min-h-6 px-2 text-[9px]')}>VIP</span>}
                      {loyal && <span className={badgeClass('bg-slate-100 text-slate-700 min-h-6 px-2 text-[9px]')}>Khách thân thiết</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 whitespace-nowrap">{order.customer_phone_snapshot}</p>
                  </div>

                  <div className="min-w-0 text-slate-600 space-y-1">
                    <p className="font-semibold whitespace-nowrap">Nhận: {formatVnDateTime(order.received_at)}</p>
                    <p className="text-[11px] text-slate-400 whitespace-nowrap">Trả: {formatVnDateTime(order.expected_return_at) || '-'}</p>
                  </div>

                  <div className="font-bold text-slate-700 truncate">{order.staff_name || 'Nhân viên'}</div>

                  <div onClick={event => event.stopPropagation()}>
                    <select value={order.status} onChange={e => handleStatusChange(order, e.target.value)} className={badgeClass(`${statusBadge(order.status)} outline-none cursor-pointer min-w-[112px]`)}>
                      <option value="new">Đơn mới</option>
                      <option value="washing">Đang giặt</option>
                      <option value="drying">Đang sấy</option>
                      <option value="ready">Đã giặt</option>
                      <option value="delivered">Đã trả</option>
                      <option value="cancelled">Đã hủy</option>
                    </select>
                  </div>

                  <div><span className={badgeClass(`${paymentBadge(order.payment_status)} min-w-[112px]`)}>{paymentNames[order.payment_status]}</span></div>

                  <div className="font-black text-slate-950 text-base xl:text-right whitespace-nowrap">{formatCurrency(order.total_amount)}</div>

                  <div className="flex xl:justify-center" onClick={e => e.stopPropagation()}>
                    <button onClick={event => openActionMenu(event, order)} className="w-10 h-10 rounded-2xl hover:bg-slate-100 text-slate-500 flex items-center justify-center transition-colors" aria-label={`Mở menu đơn ${order.order_code}`}>
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {openMenu && createPortal(
        <div
          className="fixed z-[80] w-56 rounded-2xl border border-slate-200 bg-white p-1.5 text-left text-xs shadow-[0_22px_60px_rgba(15,23,42,0.18)]"
          style={{ top: openMenu.top, left: openMenu.left }}
          onClick={event => event.stopPropagation()}
        >
          <Link to={`${base}/orders/${openMenu.order.id}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><Eye size={14} /> Xem</Link>
          <Link to={`${base}/orders/${openMenu.order.id}`} className="flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><ReceiptText size={14} /> Sửa</Link>
          <button onClick={() => openQuickDetail(openMenu.order)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><ReceiptText size={14} /> Chi tiết nhanh</button>
          <button onClick={() => addToast('Chức năng in sẽ dùng mẫu phiếu hiện có.', 'info')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><Printer size={14} /> In</button>
          {openMenu.order.payment_status !== 'paid' && <button onClick={() => handleQuickPay(openMenu.order)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-emerald-700"><DollarSign size={14} /> Thanh toán</button>}
          {openMenu.order.status !== 'delivered' && <button onClick={() => handleDeliver(openMenu.order)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><PackageCheck size={14} /> Trả đồ</button>}
          <button onClick={() => addToast('Đã sẵn sàng nhân bản từ đơn đang chọn trong bước tiếp theo.', 'info')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 font-bold text-slate-700"><Copy size={14} /> Nhân bản</button>
          {openMenu.order.status !== 'cancelled' && <button onClick={() => handleStatusChange(openMenu.order, 'cancelled')} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-rose-50 font-bold text-rose-700"><X size={14} /> Hủy đơn</button>}
          {user?.role === 'admin' && <button onClick={() => handleDelete(openMenu.order)} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-rose-50 font-bold text-rose-700"><Trash2 size={14} /> Xóa</button>}
        </div>,
        document.body
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end" onClick={() => setSelectedOrder(null)}>
          <aside className="w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between gap-4 z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Chi tiết nhanh</p>
                <h3 className="text-lg font-black text-slate-950">{selectedOrder.order_code}</h3>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-xl hover:bg-slate-100"><X size={17} /></button>
            </div>

            {drawerLoading ? <div className="p-8"><LoadingSpinner /></div> : (
              <div className="p-5 space-y-5">
                <section className="rounded-[20px] bg-slate-950 text-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black flex items-center gap-2"><User size={16} /> {selectedOrder.customer_name_snapshot}</p>
                      <p className="text-xs text-white/60 mt-1">{selectedOrder.customer_phone_snapshot}</p>
                    </div>
                    {(selectedOrder.customer_is_vip || (selectedOrder.customer_total_orders || 0) > 20) && <span className="px-2 py-1 rounded-lg bg-white text-slate-950 text-[10px] font-black flex items-center gap-1"><BadgeCheck size={11} /> VIP</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                    <div><p className="text-white/50">Tổng đơn</p><p className="font-black">{selectedOrder.customer_total_orders || 0}</p></div>
                    <div><p className="text-white/50">Tổng chi</p><p className="font-black">{formatCurrency(selectedOrder.customer_total_spent || 0)}</p></div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">Ngày nhận</p><p className="text-xs font-black text-slate-800 mt-1 flex items-center gap-1"><Clock3 size={13} /> {formatVnDateTime(selectedOrder.received_at)}</p></div>
                  <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">Ngày trả</p><p className="text-xs font-black text-slate-800 mt-1 flex items-center gap-1"><CalendarDays size={13} /> {formatVnDateTime(selectedOrder.expected_return_at) || '-'}</p></div>
                  <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">Trạng thái</p><p className="text-xs font-black text-slate-800 mt-1">{statusNames[selectedOrder.status]}</p></div>
                  <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] text-slate-400 font-bold uppercase">Thanh toán</p><p className="text-xs font-black text-slate-800 mt-1">{paymentNames[selectedOrder.payment_status]}</p></div>
                </section>

                <section className="space-y-2">
                  <h4 className="text-sm font-black text-slate-900">Dịch vụ</h4>
                  {(selectedOrder.items || []).length === 0 ? <div className="text-xs text-slate-400">Chưa tải danh sách dịch vụ.</div> : selectedOrder.items?.map(item => (
                    <div key={item.id || item.service_id} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50">
                      <div><p className="text-xs font-black text-slate-900">{item.service_name_snapshot}</p><p className="text-[11px] text-slate-500">{item.quantity} {item.unit} x {formatCurrency(item.unit_price)}</p></div>
                      <p className="text-xs font-black text-slate-900">{formatCurrency(item.amount)}</p>
                    </div>
                  ))}
                </section>

                <section className="rounded-[20px] border border-slate-200 p-4 space-y-2">
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Tạm tính</span><span className="font-bold">{formatCurrency(selectedOrder.subtotal)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Phụ thu</span><span className="font-bold">{formatCurrency(selectedOrder.surcharge)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-slate-500">Giảm giá</span><span className="font-bold">{formatCurrency(selectedOrder.discount)}</span></div>
                  <div className="flex justify-between pt-3 border-t border-slate-100"><span className="text-sm font-black">Tổng tiền</span><span className="text-lg font-black">{formatCurrency(selectedOrder.total_amount)}</span></div>
                </section>

                {selectedOrder.note && <section className="rounded-2xl bg-slate-50 p-4"><p className="text-[10px] text-slate-400 font-bold uppercase">Ghi chú</p><p className="text-xs text-slate-700 mt-1">{selectedOrder.note}</p></section>}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default Orders;
