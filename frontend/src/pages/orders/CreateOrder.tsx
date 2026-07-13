import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getServices, Service } from '../../api/services';
import { getBranches, Branch } from '../../api/branches';
import { createOrder, OrderItem } from '../../api/orders';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import apiClient from '../../api/client';
import { ArrowLeft, User, Phone, Mail, MapPin, Plus, Minus, Trash, ShoppingCart, DollarSign, Calendar, Search, X } from 'lucide-react';
import {
  vnTodayInputValue,
  vnNowTimeInputValue,
  addDaysToDateInput,
  isValidDateTimeInput,
  vnPartsToIso,
} from '../../utils/vnDatetime';

const normalizeSearchText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();

const isWeightUnit = (unit?: string | null) => {
  const normalizedUnit = String(unit || '').trim().toLowerCase();
  return ['kg', 'kilogram', 'ký', 'cân'].includes(normalizedUnit);
};

const roundWeight = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const formatQuantity = (value: number) =>
  Number(value).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

const isValidWeightQuantity = (value: number) =>
  Number.isFinite(value) && value > 0 && /^\d+(\.\d{1,2})?$/.test(String(value));

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const base = `/${user?.role}`;

  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');

  // Customer state
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');

  // Order settings state
  const [branchId, setBranchId] = useState('');
  // Ngày giờ nhận: khởi tạo MỘT LẦN khi mở form theo giờ Việt Nam hiện tại
  // (lazy initializer — không bị tính lại mỗi lần render, không nhảy thời gian)
  const [receivedDate, setReceivedDate] = useState(() => vnTodayInputValue());
  const [receivedTime, setReceivedTime] = useState(() => vnNowTimeInputValue());
  const [receivedError, setReceivedError] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState(() => vnTodayInputValue(1));
  const [expectedReturnTime, setExpectedReturnTime] = useState('17:00');
  // Người dùng đã tự chỉnh ngày trả → không tự động tính lại theo ngày nhận nữa
  const [returnDateTouched, setReturnDateTouched] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [orderNote, setOrderNote] = useState('');

  const handleReceivedDateChange = (value: string) => {
    setReceivedDate(value);
    setReceivedError('');
    setReturnError('');
    // Ngày trả mặc định = ngày nhận + 1, chỉ khi người dùng chưa chỉnh tay ngày trả
    if (!returnDateTouched && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      setExpectedReturnDate(addDaysToDateInput(value, 1));
    }
  };

  // Items / Pricing state
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [quantityErrors, setQuantityErrors] = useState<Record<string, string>>({});
  const [quantityInputs, setQuantityInputs] = useState<Record<string, string>>({});
  const [surcharge, setSurcharge] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  
  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'e_wallet' | 'none'>('none');

  useEffect(() => {
    loadInitialData();
  }, [user?.branch_id]);

  // Sync paidAmount automatically based on paymentStatus
  const subtotal = selectedItems.reduce((acc, item) => acc + item.amount, 0);
  const totalAmount = subtotal + surcharge - discount;
  const normalizedServiceSearch = normalizeSearchText(serviceSearch);
  const filteredServices = useMemo(() => {
    if (!normalizedServiceSearch) return services;
    return services.filter((service) => {
      const haystack = normalizeSearchText([
        service.name,
        service.category_name,
        service.category_id,
        service.unit,
        service.id,
      ].filter(Boolean).join(' '));
      return haystack.includes(normalizedServiceSearch);
    });
  }, [services, normalizedServiceSearch]);

  useEffect(() => {
    if (paymentStatus === 'unpaid') {
      setPaymentMethod('none');
    }
  }, [paymentStatus]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [servicesData, branchesData] = await Promise.all([
        getServices(),
        user?.role !== 'staff' ? getBranches() : Promise.resolve([])
      ]);
      setServices(servicesData.filter((s) => s.status === 'active'));
      if (user?.role === 'staff' && user.branch_id) {
        setBranchId(user.branch_id);
      } else {
        setBranches(branchesData);
      }
    } catch (_) {
      addToast('Không thể tải dịch vụ và cơ sở.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Realtime customer lookup on typing phone
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomerPhone(val);
    if (val.trim().length >= 9) {
      try {
        const response = await apiClient.get(`/orders/customer-lookup/${val.trim()}`);
        if (response.data) {
          const cust = response.data;
          setCustomerName(cust.full_name);
          setCustomerEmail(cust.email || '');
          setCustomerAddress(cust.address || '');
          setCustomerNote(cust.note || '');
          addToast(`Tìm thấy khách hàng thành viên: ${cust.full_name}`, 'info');
        }
      } catch (_) {}
    }
  };

  const handleAddService = (service: Service) => {
    setSelectedItems(prev => {
      const existIdx = prev.findIndex(item => item.service_id === service.id);
      if (existIdx > -1) {
        const copy = [...prev];
        const newQty = isWeightUnit(copy[existIdx].unit)
          ? roundWeight(copy[existIdx].quantity + 0.1)
          : copy[existIdx].quantity + 1;
        copy[existIdx].quantity = newQty;
        copy[existIdx].amount = Math.round(newQty * service.price);
        if (isWeightUnit(copy[existIdx].unit)) {
          setQuantityInputs(current => ({ ...current, [String(copy[existIdx].service_id || '')]: String(newQty) }));
        }
        return copy;
      }
      if (isWeightUnit(service.unit)) {
        setQuantityInputs(current => ({ ...current, [String(service.id)]: '1' }));
      }
      return [...prev, {
        service_id: service.id,
        service_name_snapshot: service.name,
        unit: service.unit,
        quantity: 1,
        unit_price: service.price,
        amount: service.price
      }];
    });
  };

  const handleUpdateQty = (serviceId: string | null | undefined, change: number) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.service_id === serviceId) {
        const isWeight = isWeightUnit(item.unit);
        const step = isWeight ? 0.1 : 1;
        const min = isWeight ? 0.1 : 1;
        const direction = change < 0 ? -1 : 1;
        const newQty = Math.max(min, roundWeight(item.quantity + step * direction));
        if (isWeight) {
          setQuantityInputs(current => ({ ...current, [String(item.service_id || '')]: String(newQty) }));
        }
        return {
          ...item,
          quantity: isWeight ? newQty : Math.round(newQty),
          amount: Math.round(newQty * item.unit_price)
        };
      }
      return item;
    }));
  };

  const handleWeightQuantityChange = (serviceId: string | null | undefined, rawValue: string) => {
    const key = String(serviceId || '');
    const normalizedValue = rawValue.trim().replace(',', '.');
    setQuantityInputs(prev => ({ ...prev, [key]: normalizedValue }));

    if (!normalizedValue) {
      setQuantityErrors(prev => ({ ...prev, [key]: 'Số cân phải lớn hơn 0.' }));
      return;
    }

    if (!/^\d+(\.\d{0,2})?$/.test(normalizedValue)) {
      setQuantityErrors(prev => ({ ...prev, [key]: 'Số cân chỉ được tối đa 2 chữ số thập phân.' }));
      return;
    }

    if (normalizedValue.endsWith('.')) {
      setQuantityErrors(prev => ({ ...prev, [key]: '' }));
      return;
    }

    const quantity = Number(normalizedValue);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setQuantityErrors(prev => ({ ...prev, [key]: 'Số cân phải lớn hơn 0.' }));
      return;
    }

    const roundedQuantity = roundWeight(quantity);
    setQuantityErrors(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setSelectedItems(prev => prev.map(item => item.service_id === serviceId
      ? { ...item, quantity: roundedQuantity, amount: Math.round(roundedQuantity * item.unit_price) }
      : item
    ));
  };

  const handleRemoveItem = (serviceId: string | null | undefined) => {
    setSelectedItems(prev => prev.filter(item => item.service_id !== serviceId));
    setQuantityErrors(prev => {
      const next = { ...prev };
      delete next[String(serviceId || '')];
      return next;
    });
    setQuantityInputs(prev => {
      const next = { ...prev };
      delete next[String(serviceId || '')];
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerPhone.trim() || !customerName.trim()) {
      addToast('Vui lòng nhập Tên và Số điện thoại khách hàng.', 'warning');
      return;
    }
    if (!branchId) {
      addToast('Vui lòng chọn cơ sở tiếp nhận.', 'warning');
      return;
    }
    if (selectedItems.length === 0) {
      addToast('Vui lòng chọn ít nhất một dịch vụ giặt.', 'warning');
      return;
    }
    if (!receivedDate || !receivedTime) {
      setReceivedError('Vui lòng chọn ngày và giờ nhận.');
      addToast('Vui lòng chọn ngày và giờ nhận.', 'warning');
      return;
    }
    if (!isValidDateTimeInput(receivedDate, receivedTime)) {
      setReceivedError('Ngày giờ nhận không hợp lệ.');
      addToast('Ngày giờ nhận không hợp lệ.', 'warning');
      return;
    }
    if (expectedReturnDate) {
      if (!isValidDateTimeInput(expectedReturnDate, expectedReturnTime || '00:00')) {
        setReturnError('Ngày giờ trả không hợp lệ.');
        addToast('Ngày giờ trả không hợp lệ.', 'warning');
        return;
      }
      // Ngày trả phải sau ngày nhận (cùng ngày thì giờ trả phải lớn hơn giờ nhận)
      const receivedMs = new Date(vnPartsToIso(receivedDate, receivedTime)).getTime();
      const returnMs = new Date(vnPartsToIso(expectedReturnDate, expectedReturnTime || '00:00')).getTime();
      if (returnMs <= receivedMs) {
        setReturnError('Ngày trả phải sau ngày nhận.');
        addToast('Ngày trả phải sau ngày nhận.', 'warning');
        return;
      }
    }
    if (paymentStatus === 'paid' && paymentMethod === 'none') {
      addToast('Vui lòng chọn hình thức thanh toán.', 'warning');
      return;
    }
    const invalidItem = selectedItems.find(item => {
      if (isWeightUnit(item.unit)) {
        const inputValue = quantityInputs[String(item.service_id || '')] ?? String(item.quantity);
        return !/^\d+(\.\d{1,2})?$/.test(inputValue) || !isValidWeightQuantity(item.quantity);
      }
      return !Number.isInteger(item.quantity) || item.quantity <= 0;
    });
    if (invalidItem) {
      addToast(isWeightUnit(invalidItem.unit) ? 'Số cân phải lớn hơn 0 và tối đa 2 chữ số thập phân.' : 'Số lượng dịch vụ phải là số nguyên dương.', 'warning');
      return;
    }
    if (Object.values(quantityErrors).some(Boolean)) {
      addToast('Vui lòng kiểm tra lại số cân đã nhập.', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Gửi ISO 8601 kèm timezone Việt Nam (+07:00) để backend lưu TIMESTAMPTZ chính xác
      const receivedAt = vnPartsToIso(receivedDate, receivedTime);
      let expectedReturn: string | null = null;
      if (expectedReturnDate) {
        expectedReturn = vnPartsToIso(expectedReturnDate, expectedReturnTime || '00:00');
      }

      const payload = {
        customer: {
          phone: customerPhone.trim(),
          full_name: customerName.trim(),
          email: customerEmail.trim() || null,
          address: customerAddress.trim() || null,
          note: customerNote.trim() || null
        },
        branch_id: branchId,
        note: orderNote.trim() || null,
        received_at: receivedAt,
        expected_return_at: expectedReturn,
        items: selectedItems.map(item => ({
          service_id: item.service_id,
          service_name_snapshot: item.service_name_snapshot,
          unit: item.unit,
          quantity: Number(item.quantity),
          unit_price: item.unit_price,
          amount: item.amount,
        })),
        surcharge,
        discount,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        paid_amount: 0
      };

      await createOrder(payload);
      addToast('Tạo đơn hàng thành công!', 'success');
      navigate(`${base}/orders`);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tạo đơn hàng.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  if (loading && services.length === 0) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Link to={`${base}/orders`} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Tạo đơn hàng mới</h2>
          <p className="text-xs text-slate-500">Tiếp nhận thông tin khách hàng và dịch vụ giặt sấy ký gửi</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Customer & Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer info card */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <User size={16} className="text-primary" /> Thông tin khách hàng
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Số điện thoại *</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Nhập SĐT để tự động tra cứu thành viên..."
                    value={customerPhone}
                    onChange={handlePhoneChange}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:border-primary transition-all outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Họ và tên khách hàng *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Nguyễn Văn A"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:border-primary transition-all outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Email khách hàng (nếu có)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">Địa chỉ khách hàng (nếu cần giao nhận)</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    placeholder="Số nhà, tên đường, phường..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-2xl text-xs focus:border-primary transition-all outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Service grid selection */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShoppingCart size={16} className="text-primary" /> Danh mục dịch vụ khả dụng
            </h3>

            <div className="relative">
              <label htmlFor="service-search" className="sr-only">Tìm kiếm dịch vụ</label>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} strokeWidth={1.7} />
              <input
                id="service-search"
                type="search"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Tìm kiếm dịch vụ..."
                aria-label="Tìm kiếm dịch vụ"
                className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-2xl text-xs transition-all outline-none"
              />
              {serviceSearch && (
                <button
                  type="button"
                  onClick={() => setServiceSearch('')}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <X size={14} strokeWidth={1.7} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {services.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-400">Không có dịch vụ nào đang hoạt động.</div>
              ) : filteredServices.length === 0 ? (
                <div className="col-span-full py-6 text-center space-y-3">
                  <p className="text-xs text-slate-400">Không tìm thấy dịch vụ phù hợp.</p>
                  <button
                    type="button"
                    onClick={() => setServiceSearch('')}
                    className="px-3 py-2 border border-slate-200 hover:border-slate-900 text-slate-700 rounded-2xl text-[11px] font-bold transition-colors"
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                filteredServices.map(srv => (
                  <div
                    key={srv.id}
                    onClick={() => handleAddService(srv)}
                    className="p-3 border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/10 cursor-pointer transition-all space-y-1.5"
                  >
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[9px] font-bold uppercase rounded-md tracking-wider">
                      {srv.category_name || 'Chưa phân loại'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[2rem]" title={srv.name}>{srv.name}</h4>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-primary font-bold">{formatCurrency(srv.price)}</span>
                      <span className="text-slate-400 font-medium">/{srv.unit}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column: Cart and checkout */}
        <div className="space-y-6">
          {/* Order Details & Cart */}
          <div className="bg-white p-5 rounded-[20px] border border-[#ECECEC] shadow-card space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShoppingCart size={16} className="text-primary" /> Chi tiết đơn hàng
            </h3>

            {/* Branch selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Cơ sở tiếp nhận *</label>
              {user?.role === 'staff' ? (
                <input
                  type="text"
                  value={user.branch_id ? "Cơ sở của bạn" : ""}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-2xl text-xs outline-none"
                  disabled
                />
              ) : (
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs focus:border-primary outline-none"
                  required
                >
                  <option value="">Chọn cơ sở nhận đồ</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Received date & time */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Ngày nhận *</label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => handleReceivedDateChange(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none focus:border-primary ${receivedError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Giờ nhận *</label>
                  <input
                    type="time"
                    value={receivedTime}
                    onChange={(e) => { setReceivedTime(e.target.value); setReceivedError(''); setReturnError(''); }}
                    className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none focus:border-primary ${receivedError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                    required
                  />
                </div>
              </div>
              {receivedError && <p className="text-[10px] text-rose-600 font-semibold">{receivedError}</p>}
            </div>

            {/* Expected return date */}
            <div className="space-y-1.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Ngày hẹn trả</label>
                  <input
                    type="date"
                    min={receivedDate || undefined}
                    value={expectedReturnDate}
                    onChange={(e) => { setExpectedReturnDate(e.target.value); setReturnDateTouched(true); setReturnError(''); }}
                    className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none focus:border-primary ${returnError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">Giờ hẹn trả</label>
                  <input
                    type="time"
                    value={expectedReturnTime}
                    onChange={(e) => { setExpectedReturnTime(e.target.value); setReturnDateTouched(true); setReturnError(''); }}
                    className={`w-full px-3 py-2 border rounded-2xl text-xs outline-none focus:border-primary ${returnError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                  />
                </div>
              </div>
              {returnError && <p className="text-[10px] text-rose-600 font-semibold">{returnError}</p>}
            </div>

            {/* Cart Items list */}
            <div className="space-y-2 max-h-48 overflow-y-auto border-t border-b border-slate-100 py-3">
              {selectedItems.length === 0 ? (
                <p className="text-center py-6 text-xs text-slate-400 font-medium">Chưa có dịch vụ nào được chọn</p>
              ) : (
                selectedItems.map(item => {
                  const isWeight = isWeightUnit(item.unit);
                  const quantityError = quantityErrors[String(item.service_id || '')];
                  return (
                  <div key={item.service_id} className="flex justify-between items-start py-1.5 border-b border-slate-50 last:border-b-0 gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{item.service_name_snapshot}</h4>
                      <p className="text-[10px] text-slate-400">{formatCurrency(item.unit_price)}/{item.unit}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.service_id, -1)}
                          className="p-1 hover:bg-slate-100 rounded border border-slate-200"
                          aria-label="Giảm số lượng"
                        >
                          <Minus size={10} />
                        </button>
                        {isWeight ? (
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            inputMode="decimal"
                            value={quantityInputs[String(item.service_id || '')] ?? String(item.quantity)}
                            onChange={(e) => handleWeightQuantityChange(item.service_id, e.target.value)}
                            className={`w-16 px-1.5 py-1 border rounded-lg text-xs font-bold text-center outline-none focus:border-slate-900 ${quantityError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                            aria-label={`Số cân ${item.service_name_snapshot}`}
                          />
                        ) : (
                          <span className="text-xs font-bold px-1 min-w-[24px] text-center">{formatQuantity(item.quantity)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.service_id, 1)}
                          className="p-1 hover:bg-slate-100 rounded border border-slate-200"
                          aria-label="Tăng số lượng"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      {quantityError && <p className="text-[9px] text-rose-600 font-semibold max-w-[120px]">{quantityError}</p>}
                    </div>
                    <div className="text-xs font-bold text-slate-700 w-16 text-right">
                      {formatCurrency(item.amount)}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.service_id)}
                      className="p-1 hover:bg-rose-50 text-rose-500 rounded transition-colors"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                  );
                })
              )}
            </div>

            {/* Surcharge & Discount */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Phụ thu (VNĐ)</label>
                <input
                  type="number"
                  value={surcharge || ''}
                  onChange={(e) => setSurcharge(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-2xl outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-600">Giảm giá (VNĐ)</label>
                <input
                  type="number"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-2xl outline-none"
                />
              </div>
            </div>

            {/* Total calculation panel */}
            <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>Tạm tính:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {surcharge > 0 && (
                <div className="flex justify-between text-xs text-slate-500 font-medium">
                  <span>Phụ thu:</span>
                  <span>+{formatCurrency(surcharge)}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-medium">
                  <span>Giảm giá:</span>
                  <span>-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-800 border-t border-slate-200 pt-2">
                <span>Tổng cộng:</span>
                <span className="text-primary">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            {/* Payment configuration */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Thanh toán</h4>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Tình trạng</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                  >
                    <option value="unpaid">Chưa trả</option>
                    <option value="paid">Đã trả hết</option>
                  </select>
                </div>

                {paymentStatus === 'paid' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Phương thức</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                  >
                    <option value="none">Chưa thanh toán</option>
                    <option value="cash">Tiền mặt</option>
                    <option value="bank_transfer">Chuyển khoản</option>
                    <option value="e_wallet">Ví điện tử</option>
                  </select>
                </div>
                )}
              </div>

              {paymentStatus === 'paid' && (
                <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2 flex justify-between text-xs font-semibold">
                  <span className="text-slate-500">Tổng cần thanh toán</span>
                  <span className="text-slate-900">{formatCurrency(totalAmount)}</span>
                </div>
              )}
            </div>

            {/* Order Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600">Ghi chú đơn hàng</label>
              <textarea
                placeholder="Ghi chú về quần áo, vết bẩn..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary min-h-16"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99]"
              disabled={loading || selectedItems.length === 0}
            >
              {loading ? 'Đang gửi yêu cầu tạo...' : 'Xác nhận tạo đơn'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateOrder;
