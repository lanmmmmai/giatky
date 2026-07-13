import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getServices, Service } from '../../api/services';
import { getBranches, Branch } from '../../api/branches';
import { createCustomer, createOrder, CustomerProfile, lookupCustomer, OrderItem, searchCustomers } from '../../api/orders';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { ArrowLeft, User, Phone, Mail, MapPin, Plus, Minus, Trash, ShoppingCart, DollarSign, Calendar, Search, X, PackagePlus, Clock3, ReceiptText, History, BadgeCheck, Shirt, Save, Printer, CreditCard, SlidersHorizontal } from 'lucide-react';
import {
  vnTodayInputValue,
  vnNowTimeInputValue,
  addDaysToDateInput,
  isValidDateTimeInput,
  vnPartsToIso,
  formatVnDateTime,
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

const createIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const getCreateOrderErrorMessage = (err: any) => {
  const status = err.response?.status;
  const data = err.response?.data;
  const code = data?.code || data?.detail?.code;

  if (status === 409 && code === 'ORDER_CODE_CONFLICT') {
    return 'Không thể tạo mã đơn mới. Vui lòng thử lại.';
  }
  if (status === 409 && code === 'ORDER_CREATE_IN_PROGRESS') {
    return 'Đơn hàng đang được xử lý, vui lòng chờ trong giây lát.';
  }
  if (status === 422) {
    return 'Vui lòng kiểm tra lại thông tin đơn hàng.';
  }
  if (status === 500) {
    return 'Không thể tạo đơn hàng lúc này. Vui lòng thử lại hoặc liên hệ quản trị viên.';
  }
  if (status === 403) {
    return 'Bạn không có quyền tạo đơn tại cơ sở này.';
  }
  if (status === 400) {
    return typeof data?.detail === 'string' ? data.detail : 'Dữ liệu đơn hàng không hợp lệ.';
  }
  return 'Không thể tạo đơn hàng lúc này. Vui lòng thử lại.';
};

const CreateOrder: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const base = `/${user?.role}`;
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedUnit, setSelectedUnit] = useState('all');

  // Customer state
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [customerBirthDate, setCustomerBirthDate] = useState('');
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerProfile[]>([]);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [showCustomerHistory, setShowCustomerHistory] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    full_name: '',
    phone: '',
    email: '',
    address: '',
    date_of_birth: '',
    note: '',
  });

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
  const categories = useMemo(() => Array.from(new Set(services.map(service => service.category_name || 'Chưa phân loại'))), [services]);
  const units = useMemo(() => Array.from(new Set(services.map(service => service.unit || 'lần'))), [services]);
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      if (selectedCategory !== 'all' && (service.category_name || 'Chưa phân loại') !== selectedCategory) return false;
      if (selectedUnit !== 'all' && service.unit !== selectedUnit) return false;
      if (!normalizedServiceSearch) return true;
      const haystack = normalizeSearchText([
        service.name,
        service.category_name,
        service.category_id,
        service.unit,
        service.id,
      ].filter(Boolean).join(' '));
      return haystack.includes(normalizedServiceSearch);
    });
  }, [services, normalizedServiceSearch, selectedCategory, selectedUnit]);

  useEffect(() => {
    const query = customerQuery.trim();
    if (query.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchCustomers(query);
        setCustomerResults(results);
      } catch (_) {
        setCustomerResults([]);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

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
    setCustomerQuery(val);
    if (val.trim().length >= 9) {
      try {
        const cust = await lookupCustomer(val.trim());
        if (cust) {
          applyCustomer(cust);
          addToast(`Tìm thấy khách hàng thành viên: ${cust.full_name}`, 'info');
        }
      } catch (_) {}
    }
  };

  const applyCustomer = (cust: CustomerProfile) => {
    setCustomerProfile(cust);
    setCustomerName(cust.full_name || '');
    setCustomerPhone(cust.phone || '');
    setCustomerEmail(cust.email || '');
    setCustomerAddress(cust.address || '');
    setCustomerNote(cust.note || '');
    setCustomerBirthDate(cust.date_of_birth || '');
    setCustomerQuery(`${cust.full_name} - ${cust.phone}`);
    setCustomerResults([]);
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.full_name.trim() || !newCustomer.phone.trim()) {
      addToast('Vui lòng nhập tên và số điện thoại khách hàng.', 'warning');
      return;
    }
    try {
      const customer = await createCustomer({
        full_name: newCustomer.full_name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim() || null,
        address: newCustomer.address.trim() || null,
        date_of_birth: newCustomer.date_of_birth || null,
        note: newCustomer.note.trim() || null,
      });
      applyCustomer(customer);
      setShowCustomerModal(false);
      setNewCustomer({ full_name: '', phone: '', email: '', address: '', date_of_birth: '', note: '' });
      addToast('Đã tạo khách hàng mới.', 'success');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tạo khách hàng.', 'error');
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
    if (submitting) return;
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

    setSubmitting(true);
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
          date_of_birth: customerBirthDate || null,
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

      await createOrder(payload, idempotencyKeyRef.current);
      idempotencyKeyRef.current = createIdempotencyKey();
      addToast('Tạo đơn hàng thành công.', 'success');
      navigate(`${base}/orders`);
    } catch (err: any) {
      addToast(getCreateOrderErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  if (loading && services.length === 0) return <LoadingSpinner />;

  const activeCategoryLabel = selectedCategory === 'all' ? 'Tất cả dịch vụ' : selectedCategory;
  const completedPayment = paymentStatus === 'paid';
  const totalQuantity = selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`${base}/orders`} className="p-2 hover:bg-white rounded-2xl text-slate-500 transition-colors border border-transparent hover:border-slate-200">
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Quầy tiếp nhận</p>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Nhận đồ</h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200">
            <Clock3 size={13} /> {receivedDate} {receivedTime}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white border border-slate-200">
            <ShoppingCart size={13} /> {selectedItems.length} dịch vụ
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[minmax(0,7fr)_minmax(360px,3fr)] gap-5 items-start">
        <section className="space-y-5 min-w-0">
          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <PackagePlus size={17} /> Chọn dịch vụ
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Click một lần để thêm vào phiếu.</p>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  <SlidersHorizontal size={14} /> {activeCategoryLabel}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} strokeWidth={1.7} />
                  <input
                    type="search"
                    value={serviceSearch}
                    onChange={(e) => setServiceSearch(e.target.value)}
                    placeholder="Tìm dịch vụ theo tên, loại, đơn vị..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5 rounded-2xl text-xs transition-all outline-none"
                  />
                  {serviceSearch && (
                    <button type="button" onClick={() => setServiceSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors">
                      <X size={14} strokeWidth={1.7} />
                    </button>
                  )}
                </div>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-slate-900">
                  <option value="all">Tất cả danh mục</option>
                  {categories.map(category => <option key={category} value={category}>{category}</option>)}
                </select>
                <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value)} className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:bg-white focus:border-slate-900">
                  <option value="all">Tất cả đơn vị</option>
                  {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </div>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3 max-h-[440px] overflow-y-auto">
              {filteredServices.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-slate-400">Không tìm thấy dịch vụ phù hợp.</div>
              ) : filteredServices.map(service => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => handleAddService(service)}
                  className="group text-left p-3 rounded-2xl border border-slate-200 hover:border-slate-900 hover:bg-slate-950 hover:text-white transition-all active:scale-[0.99] min-h-[92px]"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-2xl bg-slate-100 text-slate-900 group-hover:bg-white group-hover:text-slate-950 flex items-center justify-center shrink-0 transition-colors">
                      <Shirt size={17} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-black leading-snug line-clamp-2">{service.name}</span>
                      <span className="block text-[10px] text-slate-400 group-hover:text-white/60 mt-1">{service.category_name || 'Chưa phân loại'}</span>
                    </span>
                    <Plus size={16} className="text-emerald-500 group-hover:text-white shrink-0" />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-900 group-hover:text-white">{formatCurrency(service.price)}</span>
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 group-hover:bg-white/10 group-hover:text-white">/{service.unit}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><ReceiptText size={17} /> Dịch vụ đã chọn</h3>
                <p className="text-xs text-slate-500 mt-0.5">Có thể nhập trực tiếp số lượng, kg hỗ trợ số lẻ.</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Tạm tính</p>
                <p className="text-sm font-black text-slate-900">{formatCurrency(subtotal)}</p>
              </div>
            </div>

            {selectedItems.length === 0 ? (
              <div className="py-14 text-center text-xs text-slate-400">Chọn dịch vụ ở phía trên để bắt đầu lập phiếu.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left">Tên dịch vụ</th>
                      <th className="px-4 py-3 text-right">Đơn giá</th>
                      <th className="px-4 py-3 text-center">Số lượng</th>
                      <th className="px-4 py-3 text-center">Đơn vị</th>
                      <th className="px-4 py-3 text-right">Thành tiền</th>
                      <th className="px-4 py-3 text-center">Xóa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedItems.map(item => {
                      const isWeight = isWeightUnit(item.unit);
                      const key = String(item.service_id || '');
                      const quantityError = quantityErrors[key];
                      return (
                        <tr key={key} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-bold text-slate-900 min-w-48">{item.service_name_snapshot}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">{formatCurrency(item.unit_price)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1.5">
                              <button type="button" onClick={() => handleUpdateQty(item.service_id, -1)} className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center"><Minus size={13} /></button>
                              <input
                                type="text"
                                inputMode={isWeight ? 'decimal' : 'numeric'}
                                value={isWeight ? (quantityInputs[key] ?? String(item.quantity)) : String(item.quantity)}
                                onChange={(event) => isWeight ? handleWeightQuantityChange(item.service_id, event.target.value) : handleUpdateQty(item.service_id, Number(event.target.value) - item.quantity)}
                                className={`w-16 h-8 text-center rounded-xl border text-xs font-bold outline-none ${quantityError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`}
                              />
                              <button type="button" onClick={() => handleUpdateQty(item.service_id, 1)} className="w-8 h-8 rounded-xl border border-slate-200 hover:bg-slate-100 flex items-center justify-center"><Plus size={13} /></button>
                            </div>
                            {quantityError && <p className="mt-1 text-center text-[10px] text-rose-600 font-semibold">{quantityError}</p>}
                          </td>
                          <td className="px-4 py-3 text-center"><span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 font-bold">{item.unit}</span></td>
                          <td className="px-4 py-3 text-right font-black text-slate-900">{formatCurrency(item.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" onClick={() => handleRemoveItem(item.service_id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl"><Trash size={14} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="xl:sticky xl:top-4 space-y-4 min-w-0">
          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><User size={17} /> Khách hàng</h3>
              <button type="button" onClick={() => setShowCustomerModal(true)} className="text-xs font-black text-slate-900 hover:underline">+ Tạo mới</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={customerQuery} onChange={e => setCustomerQuery(e.target.value)} placeholder="Tìm tên hoặc số điện thoại..." className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:bg-white focus:border-slate-900" />
                {customerResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-card z-20 overflow-hidden">
                    {customerResults.map(customer => (
                      <button key={customer.id} type="button" onClick={() => applyCustomer(customer)} className="w-full px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-50 last:border-b-0">
                        <span className="block text-xs font-black text-slate-900">{customer.full_name}</span>
                        <span className="block text-[10px] text-slate-500">{customer.phone} · {customer.total_orders || 0} đơn</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2">
                <input value={customerPhone} onChange={handlePhoneChange} placeholder="Số điện thoại *" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900" required />
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Tên khách hàng *" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900" required />
                <input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900" />
                <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="Địa chỉ" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900" />
              </div>

              {customerProfile && (
                <div className="rounded-2xl bg-slate-950 text-white p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black">{customerProfile.full_name}</p>
                      <p className="text-xs text-white/60">{customerProfile.phone}</p>
                    </div>
                    {(customerProfile.is_vip || (customerProfile.total_orders || 0) > 20) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-slate-950 text-[10px] font-black"><BadgeCheck size={11} /> VIP</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><p className="text-white/50">Tổng đơn</p><p className="font-black">{customerProfile.total_orders || 0} đơn</p></div>
                    <div><p className="text-white/50">Tổng chi</p><p className="font-black">{formatCurrency(customerProfile.total_spent || 0)}</p></div>
                    <div><p className="text-white/50">Tổng kg</p><p className="font-black">{customerProfile.total_kg || 0} kg</p></div>
                    <div><p className="text-white/50">TB/đơn</p><p className="font-black">{formatCurrency(customerProfile.average_order || 0)}</p></div>
                  </div>
                  <button type="button" onClick={() => setShowCustomerHistory(true)} className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-black flex items-center justify-center gap-1.5"><History size={13} /> Xem lịch sử</button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card p-4 space-y-4">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2"><Calendar size={17} /> Thông tin đơn</h3>
            {user?.role === 'staff' ? (
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500">{user.current_branch_name || 'Cơ sở đang chọn'}</div>
            ) : (
              <select value={branchId} onChange={e => setBranchId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-2xl text-xs font-bold outline-none" required>
                <option value="">Chọn cơ sở nhận đồ</option>
                {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={receivedDate} onChange={e => handleReceivedDateChange(e.target.value)} className={`px-3 py-2 border rounded-2xl text-xs outline-none ${receivedError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} required />
              <input type="time" value={receivedTime} onChange={e => { setReceivedTime(e.target.value); setReceivedError(''); setReturnError(''); }} className={`px-3 py-2 border rounded-2xl text-xs outline-none ${receivedError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} required />
              <input type="date" min={receivedDate || undefined} value={expectedReturnDate} onChange={e => { setExpectedReturnDate(e.target.value); setReturnDateTouched(true); setReturnError(''); }} className={`px-3 py-2 border rounded-2xl text-xs outline-none ${returnError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} />
              <input type="time" value={expectedReturnTime} onChange={e => { setExpectedReturnTime(e.target.value); setReturnDateTouched(true); setReturnError(''); }} className={`px-3 py-2 border rounded-2xl text-xs outline-none ${returnError ? 'border-rose-300 bg-rose-50' : 'border-slate-200'}`} />
            </div>
            {(receivedError || returnError) && <p className="text-[10px] text-rose-600 font-semibold">{receivedError || returnError}</p>}
            <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder="Ghi chú hóa đơn" rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-slate-900" />
          </div>

          <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card p-4 space-y-3">
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Tổng số lượng</span><span className="font-black">{formatQuantity(totalQuantity)}</span></div>
            <div className="flex items-center justify-between text-xs"><span className="text-slate-500">Tổng tiền</span><span className="font-black">{formatCurrency(subtotal)}</span></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1"><span className="text-[10px] font-bold text-slate-500">Phụ thu</span><input type="number" min="0" value={surcharge} onChange={e => setSurcharge(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs text-right outline-none" /></label>
              <label className="space-y-1"><span className="text-[10px] font-bold text-slate-500">Giảm giá</span><input type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs text-right outline-none" /></label>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <input type="checkbox" checked={completedPayment} onChange={e => setPaymentStatus(e.target.checked ? 'paid' : 'unpaid')} className="w-4 h-4 rounded border-slate-300" /> Khách thanh toán trước
            </label>
            {completedPayment && (
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)} className="w-full px-3 py-2.5 border border-slate-200 rounded-2xl text-xs font-bold outline-none">
                <option value="none">Chọn phương thức thanh toán</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank_transfer">Chuyển khoản</option>
                <option value="e_wallet">Ví điện tử</option>
              </select>
            )}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">Thành tiền</span>
              <span className="text-2xl font-black text-slate-950 tracking-tight">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="submit" disabled={loading || submitting} className="col-span-2 h-11 rounded-2xl bg-slate-950 hover:bg-black text-white text-xs font-black flex items-center justify-center gap-2 disabled:opacity-60"><Save size={15} /> {submitting ? 'Đang lưu...' : 'Lưu đơn'}</button>
              <button type="button" onClick={() => addToast('Chức năng in sẽ dùng phiếu vừa lưu.', 'info')} className="h-10 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-black flex items-center justify-center gap-1.5"><Printer size={14} /> Lưu & In</button>
              <button type="button" onClick={() => { setPaymentStatus('paid'); addToast('Đã bật thanh toán trước. Chọn phương thức để lưu.', 'info'); }} className="h-10 rounded-2xl border border-slate-200 hover:bg-slate-50 text-xs font-black flex items-center justify-center gap-1.5"><CreditCard size={14} /> Thanh toán</button>
              <Link to={`${base}/orders`} className="col-span-2 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-xs font-black flex items-center justify-center">Hủy</Link>
            </div>
          </div>
        </aside>
      </form>

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-[24px] shadow-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Tạo khách hàng mới</h3>
              <button onClick={() => setShowCustomerModal(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input value={newCustomer.full_name} onChange={e => setNewCustomer(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Tên khách hàng *" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
              <input value={newCustomer.phone} onChange={e => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))} placeholder="Số điện thoại *" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
              <input value={newCustomer.email} onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="Email" className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
              <input type="date" value={newCustomer.date_of_birth} onChange={e => setNewCustomer(prev => ({ ...prev, date_of_birth: e.target.value }))} className="px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
              <input value={newCustomer.address} onChange={e => setNewCustomer(prev => ({ ...prev, address: e.target.value }))} placeholder="Địa chỉ" className="sm:col-span-2 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
              <textarea value={newCustomer.note} onChange={e => setNewCustomer(prev => ({ ...prev, note: e.target.value }))} placeholder="Ghi chú" rows={3} className="sm:col-span-2 px-3 py-2.5 border border-slate-200 rounded-2xl text-xs outline-none" />
            </div>
            <button type="button" onClick={handleCreateCustomer} className="w-full h-11 rounded-2xl bg-slate-950 text-white text-xs font-black">Lưu khách hàng</button>
          </div>
        </div>
      )}

      {showCustomerHistory && customerProfile && (
        <div className="fixed inset-0 z-50 bg-black/35 flex justify-end">
          <div className="w-full max-w-xl h-full bg-white shadow-xl p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Lịch sử khách hàng</h3>
                <p className="text-xs text-slate-500">{customerProfile.full_name} · {customerProfile.total_orders || 0} đơn</p>
              </div>
              <button onClick={() => setShowCustomerHistory(false)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={16} /></button>
            </div>
            {(customerProfile.recent_orders || []).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Khách hàng chưa có lịch sử đơn.</div>
            ) : (
              <div className="space-y-2">
                {(customerProfile.recent_orders || []).map(order => (
                  <Link key={order.id} to={`${base}/orders/${order.id}`} className="block p-3 rounded-2xl border border-slate-200 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-black text-sm text-slate-900">{order.order_code}</span>
                      <span className="font-black text-sm text-slate-900">{formatCurrency(order.total_amount)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                      <span>Nhận: {formatVnDateTime(order.received_at)}</span>
                      <span>Trả: {formatVnDateTime(order.expected_return_at)}</span>
                      <span>Trạng thái: {order.status}</span>
                      <span>Thanh toán: {order.payment_status}</span>
                      <span className="col-span-2">Nhân viên: {order.staff_name || '-'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrder;
