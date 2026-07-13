import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { completeOrderDelivery, getOrderDetail, updateOrderStatus, updateOrderPayment, Order } from '../../api/orders';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ArrowLeft, Printer, DollarSign, RefreshCw, Calendar, Tag, ShieldCheck, Clock, User, Phone, MapPin } from 'lucide-react';

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const base = `/${user?.role}`;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deliveryPaymentOpen, setDeliveryPaymentOpen] = useState(false);
  const [deliveryPaymentMethod, setDeliveryPaymentMethod] = useState<'cash' | 'bank_transfer' | 'e_wallet' | 'none'>('none');
  const [deliveryPaymentNote, setDeliveryPaymentNote] = useState('');

  // Quick payment update state
  const [payStatus, setPayStatus] = useState<'unpaid' | 'paid' | 'partial'>('unpaid');
  const [payMethod, setPayMethod] = useState<'cash' | 'bank_transfer' | 'e_wallet' | 'none'>('none');
  const [payAmount, setPayAmount] = useState<number>(0);

  useEffect(() => {
    loadOrderDetail();
  }, [id]);

  const loadOrderDetail = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getOrderDetail(id);
      setOrder(data);
      setPayStatus(data.payment_status);
      setPayMethod(data.payment_method);
      setPayAmount(data.paid_amount);
    } catch (_) {
      addToast('Không thể tải thông tin chi tiết đơn hàng.', 'error');
      navigate(`${base}/orders`);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    if (newStatus === 'delivered') {
      await handleCompleteDeliveryClick();
      return;
    }
    setUpdating(true);
    try {
      await updateOrderStatus(order.id, newStatus);
      addToast(`Cập nhật trạng thái đơn sang ${newStatus} thành công.`, 'success');
      setOrder(prev => prev ? { ...prev, status: newStatus as any } : null);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật trạng thái thất bại.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteDeliveryClick = async () => {
    if (!order) return;
    if (order.status === 'delivered') return;
    if (order.payment_status !== 'paid') {
      setDeliveryPaymentOpen(true);
      return;
    }
    setUpdating(true);
    try {
      const result = await completeOrderDelivery(order.id);
      setOrder(prev => prev ? { ...prev, ...result.order } : result.order);
      addToast('Đã hoàn tất trả đồ cho khách.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể hoàn tất trả đơn.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirmDeliveryPayment = async () => {
    if (!order) return;
    if (deliveryPaymentMethod === 'none') {
      addToast('Vui lòng chọn hình thức thanh toán.', 'warning');
      return;
    }
    setUpdating(true);
    try {
      const result = await completeOrderDelivery(order.id, {
        payment_method: deliveryPaymentMethod,
        note: deliveryPaymentNote.trim() || undefined,
      });
      setOrder(prev => prev ? { ...prev, ...result.order } : result.order);
      setPayStatus('paid');
      setPayMethod(deliveryPaymentMethod);
      setPayAmount(result.order.paid_amount);
      setDeliveryPaymentOpen(false);
      setDeliveryPaymentMethod('none');
      setDeliveryPaymentNote('');
      addToast('Đã thanh toán và trả đồ thành công.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể thanh toán và trả đơn.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;

    setUpdating(true);
    try {
      if (payStatus === 'paid' && payMethod === 'none') {
        addToast('Vui lòng chọn hình thức thanh toán.', 'warning');
        setUpdating(false);
        return;
      }
      await updateOrderPayment(order.id, {
        payment_status: payStatus,
        payment_method: payStatus === 'paid' ? payMethod : 'none',
        paid_amount: payStatus === 'paid' ? order.total_amount : 0
      });
      addToast('Cập nhật thông tin thanh toán thành công.', 'success');
      setOrder(prev => prev ? { 
        ...prev, 
        payment_status: payStatus, 
        payment_method: payStatus === 'paid' ? payMethod : 'none',
        paid_amount: payStatus === 'paid' ? order.total_amount : 0
      } : null);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật thanh toán thất bại.', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatQuantity = (val: number) => {
    return Number(val).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  };

  if (loading) return <LoadingSpinner />;
  if (!order) return <div className="text-center py-12 text-slate-500">Đơn hàng không tồn tại.</div>;

  const remainingAmount = order.total_amount - order.paid_amount;

  return (
    <div className="space-y-6">
      {/* Print Style - Hide Sidebar/Topbar during printing */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #invoice-print-area, #invoice-print-area * {
            visibility: visible;
          }
          #invoice-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header section (Non-printable) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4 no-print">
        <div className="flex items-center gap-3">
          <Link to={`${base}/orders`} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-500 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-800">Đơn hàng: {order.order_code}</h2>
              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider ${
                {
                  new: 'bg-primary/10 text-primary border-primary/20',
                  washing: 'bg-secondary/10 text-secondary border-secondary/20',
                  drying: 'bg-neutral-100 text-neutral-700 border-neutral-200',
                  ready: 'bg-amber-50 text-amber-600 border-amber-200',
                  delivered: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                  cancelled: 'bg-rose-50 text-rose-600 border-rose-200',
                }[order.status] || 'bg-slate-50 border-slate-200'
              }`}>
                {
                  {
                    new: 'Mới tạo',
                    washing: 'Đang giặt',
                    drying: 'Đang sấy',
                    ready: 'Sẵn sàng giao',
                    delivered: 'Đã giao khách',
                    cancelled: 'Đã hủy',
                  }[order.status] || order.status
                }
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">Nhận lúc: {new Date(order.received_at).toLocaleString('vi-VN')}</p>
          </div>
        </div>

        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Printer size={16} />
          In hóa đơn biên nhận
        </button>
      </div>

      {/* Main Details Panel */}
      <div id="invoice-print-area" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Printable Invoice Header (Visible only when printing) */}
        <div className="hidden print:block col-span-full border-b border-dashed border-slate-300 pb-4 text-center space-y-1">
          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-widest">Giặt Ký</h1>
          <p className="text-xs text-slate-500">Sạch Thơm Tinh Tươm - Giao Nhận Tận Nơi</p>
          <p className="text-[10px] text-slate-400">Điện thoại liên hệ: {order.customer_phone_snapshot}</p>
          <h2 className="text-sm font-bold text-slate-800 pt-2">HÓA ĐƠN BIÊN NHẬN GIẶT LÀ ({order.order_code})</h2>
        </div>

        {/* Left Column: Order Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Branch Snapshots */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <User size={12} /> Khách hàng
              </h3>
              <div className="text-xs space-y-1">
                <div className="font-bold text-slate-800 text-sm">{order.customer_name_snapshot}</div>
                <div className="flex items-center gap-1 text-slate-500">
                  <Phone size={12} /> {order.customer_phone_snapshot}
                </div>
                {order.customers?.email && (
                  <div className="text-slate-400">{order.customers.email}</div>
                )}
                {order.customers?.address && (
                  <div className="flex items-start gap-1 text-slate-500 mt-1.5">
                    <MapPin size={12} className="mt-0.5" />
                    <span>{order.customers.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Tag size={12} /> Tiếp nhận
              </h3>
              <div className="text-xs space-y-1.5">
                <div className="font-semibold text-slate-700">Cơ sở: <span className="font-bold text-slate-800">{order.branch_name || 'Chi nhánh'}</span></div>
                <div className="text-slate-500">Nhân viên lập: {order.staff_name || 'Nhân viên'}</div>
                {order.expected_return_at && (
                  <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-medium border border-amber-200 mt-1 w-fit">
                    <Clock size={12} />
                    Hẹn trả: {new Date(order.expected_return_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Items Table */}
          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-primary/5">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Danh sách đồ gửi</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-4">Tên dịch vụ</th>
                  <th className="p-4">Đơn vị</th>
                  <th className="p-4">Số lượng</th>
                  <th className="p-4 text-right">Đơn giá</th>
                  <th className="p-4 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                {order.items?.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-slate-100 last:border-b-0">
                    <td className="p-4 font-bold text-slate-800">{item.service_name_snapshot}</td>
                    <td className="p-4 text-slate-500">{item.unit}</td>
                    <td className="p-4 font-bold text-slate-700">{formatQuantity(item.quantity)}</td>
                    <td className="p-4 text-right text-slate-600">{formatCurrency(item.unit_price)}</td>
                    <td className="p-4 text-right font-bold text-slate-800">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Order Note Card */}
          {order.note && (
            <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ghi chú tiếp nhận</h4>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">{order.note}</p>
            </div>
          )}
        </div>

        {/* Right Column: Checkout Status, Payment & Actions */}
        <div className="space-y-6">
          
          {/* Bill summary card */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Thành tiền hóa đơn
            </h3>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Tạm tính:</span>
                <span className="font-semibold">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.surcharge > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Phụ thu thêm:</span>
                  <span className="font-semibold">+{formatCurrency(order.surcharge)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Khấu trừ/Giảm giá:</span>
                  <span className="font-semibold">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-100 pt-2">
                <span>Tổng phải trả:</span>
                <span className="text-primary text-base">{formatCurrency(order.total_amount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 border-t border-slate-50 pt-2 font-medium">
                <span>Khách đã trả:</span>
                <span className="text-slate-800 font-bold">{formatCurrency(order.paid_amount)}</span>
              </div>
              
              <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2">
                {remainingAmount <= 0 ? (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1 w-full justify-center">
                    <ShieldCheck size={14} /> Hóa đơn đã hoàn tất
                  </span>
                ) : (
                  <>
                    <span className="text-rose-600">Còn nợ lại:</span>
                    <span className="text-rose-600">{formatCurrency(remainingAmount)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Update Status Card (Non-printable) */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4 no-print">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Trạng thái xử lý
            </h3>
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-500">Cập nhật nhanh tiến độ đồ giặt</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'new', label: 'Mới tạo' },
                  { key: 'washing', label: 'Đang giặt' },
                  { key: 'drying', label: 'Đang sấy' },
                  { key: 'ready', label: 'Sẵn sàng' },
                  { key: 'delivered', label: 'Đã giao' },
                  { key: 'cancelled', label: 'Hủy đơn' }
                ].map(st => {
                  const isCurrent = order.status === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => handleStatusChange(st.key)}
                      disabled={updating}
                      className={`py-2 px-3 rounded-2xl text-[11px] font-bold text-center border transition-all ${
                        isCurrent 
                          ? 'bg-primary border-primary text-white shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Payment updates card (Non-printable) */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4 no-print">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
              Thu tiền / Cập nhật thanh toán
            </h3>
            
            <form onSubmit={handlePaymentUpdateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái thanh toán</label>
                <select
                  value={payStatus}
                  onChange={(e) => {
                    const next = e.target.value as any;
                    setPayStatus(next);
                    if (next === 'unpaid') setPayMethod('none');
                  }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary bg-white"
                  disabled={updating}
                >
                  <option value="unpaid">Chưa trả</option>
                  <option value="paid">Đã trả hết</option>
                </select>
              </div>

              {payStatus === 'paid' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Phương thức thanh toán</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:border-primary bg-white"
                  disabled={updating}
                >
                  <option value="none">Chưa thu</option>
                  <option value="cash">Tiền mặt</option>
                  <option value="bank_transfer">Chuyển khoản</option>
                  <option value="e_wallet">Ví điện tử</option>
                </select>
              </div>
              )}

              <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Tổng cần thanh toán</span>
                <span className="text-slate-900">{formatCurrency(order.total_amount)}</span>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-2xl font-bold text-xs shadow-sm flex items-center justify-center gap-1"
                disabled={updating}
              >
                <DollarSign size={14} />
                Lưu thông tin thu tiền
              </button>
            </form>
          </div>

        </div>
      </div>

      {deliveryPaymentOpen && order && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4 no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-5 space-y-5">
            <div>
              <h3 className="text-base font-bold text-slate-950">Xác nhận thanh toán khi trả đơn</h3>
              <p className="text-xs text-slate-500 mt-1">Đơn chưa thanh toán. Vui lòng chọn hình thức thanh toán để hoàn tất trả đồ.</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-semibold">Mã đơn</span>
                <span className="font-bold text-slate-900">{order.order_code}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-semibold">Khách hàng</span>
                <span className="font-bold text-slate-900 text-right">{order.customer_name_snapshot}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500 font-semibold">Tạm tính</span>
                <span className="font-bold text-slate-900">{formatCurrency(order.subtotal)}</span>
              </div>
              {order.surcharge > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Phụ phí</span>
                  <span className="font-bold text-slate-900">+{formatCurrency(order.surcharge)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-semibold">Giảm giá</span>
                  <span className="font-bold text-rose-600">-{formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 border-t border-slate-200 pt-2">
                <span className="text-slate-700 font-bold">Tổng cần thanh toán</span>
                <span className="font-black text-slate-950">{formatCurrency(order.total_amount)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Hình thức thanh toán</label>
              <select
                value={deliveryPaymentMethod}
                onChange={(e) => setDeliveryPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900 bg-white"
                disabled={updating}
              >
                <option value="none">Chọn hình thức</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="e_wallet">Ví điện tử</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ghi chú</label>
              <textarea
                value={deliveryPaymentNote}
                onChange={(e) => setDeliveryPaymentNote(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900 min-h-[72px]"
                placeholder="Ghi chú thanh toán nếu có..."
                disabled={updating}
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setDeliveryPaymentOpen(false)}
                disabled={updating}
                className="px-4 py-2 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDeliveryPayment}
                disabled={updating}
                className="px-4 py-2 rounded-2xl bg-slate-950 hover:bg-black text-white text-xs font-bold disabled:opacity-60"
              >
                {updating ? 'Đang xử lý...' : 'Xác nhận thanh toán và trả đơn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
