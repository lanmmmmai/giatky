import React, { useEffect, useState } from 'react';
import { getServices, createService, updateService, deleteService, importExcelServices, Service } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, Import, Upload, AlertCircle, FileSpreadsheet, X, Check } from 'lucide-react';

// Helper function to derive mock stock information deterministically from UUID
const getStockInfo = (id: string, isActive: boolean) => {
  if (!isActive) {
    return {
      quantity: 0,
      label: 'Hết hàng',
      colorClass: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
      status: 'out_of_stock'
    };
  }

  // Simple deterministic hash based on UUID string
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const quantity = Math.abs(hash) % 150; // Mock quantity from 0 to 149
  
  if (quantity === 0 || Math.abs(hash) % 13 === 0) {
    return {
      quantity: 0,
      label: 'Hết hàng',
      colorClass: 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400',
      status: 'out_of_stock'
    };
  } else if (quantity < 15) {
    return {
      quantity,
      label: 'Sắp hết hàng',
      colorClass: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
      status: 'low_stock'
    };
  } else {
    return {
      quantity,
      label: 'Còn hàng',
      colorClass: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      status: 'in_stock'
    };
  }
};

const Services: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal open states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Form Create State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('kg');
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState('');

  // Form Edit State
  const [editingServiceId, setEditingServiceId] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('kg');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDescription, setEditDescription] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    setLoading(true);
    try {
      const data = await getServices();
      setServices(data);
    } catch (_) {
      addToast('Không thể tải danh sách dịch vụ.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !unit.trim()) {
      addToast('Vui lòng điền đầy đủ thông tin bắt buộc.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await createService({
        name,
        category: category || 'Chưa phân loại',
        unit,
        price,
        description: description || undefined
      });
      addToast('Thêm dịch vụ thành công.', 'success');
      setCreateModalOpen(false);
      setName('');
      setCategory('');
      setUnit('kg');
      setPrice(0);
      setDescription('');
      loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thêm dịch vụ thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (s: Service) => {
    setEditingServiceId(s.id);
    setEditName(s.name);
    setEditCategory(s.category || '');
    setEditUnit(s.unit);
    setEditPrice(s.price);
    setEditDescription(s.description || '');
    setEditIsActive(s.is_active);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateService(editingServiceId, {
        name: editName,
        category: editCategory,
        unit: editUnit,
        price: editPrice,
        description: editDescription,
        is_active: editIsActive
      });
      addToast('Cập nhật dịch vụ thành công.', 'success');
      setEditModalOpen(false);
      loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, sName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dịch vụ: ${sName}?`)) return;

    try {
      const result = await deleteService(id);
      addToast(result.message || 'Xóa dịch vụ thành công.', 'success');
      loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xóa dịch vụ thất bại.', 'error');
    }
  };

  // Excel File upload parsing with SheetJS
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    const reader = new FileReader();
    
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Parse rows to JSON
        const rawData: any[] = XLSX.utils.sheet_to_json(ws);
        
        // Validation check
        const validRows: any[] = [];
        const errorsList: string[] = [];

        rawData.forEach((row, index) => {
          const lineNum = index + 2; // Header is line 1
          const nameVal = row.name || row['Tên dịch vụ'] || row['Name'];
          const priceVal = row.price || row['Đơn giá'] || row['Price'];
          const categoryVal = row.category || row['Danh mục'] || row['Category'];
          const unitVal = row.unit || row['Đơn vị'] || row['Unit'];
          const descVal = row.description || row['Mô tả'] || row['Description'];

          if (!nameVal || !nameVal.toString().trim()) {
            errorsList.push(`Dòng ${lineNum}: Tên dịch vụ không được để trống.`);
            return;
          }
          
          if (priceVal === undefined || priceVal === null || isNaN(Number(priceVal)) || Number(priceVal) < 0) {
            errorsList.push(`Dòng ${lineNum}: Đơn giá không hợp lệ (Bắt buộc và phải >= 0).`);
            return;
          }

          validRows.push({
            name: nameVal.toString().trim(),
            category: categoryVal ? categoryVal.toString().trim() : 'Chưa phân loại',
            unit: unitVal ? unitVal.toString().trim() : 'kg',
            price: Math.round(Number(priceVal)),
            description: descVal ? descVal.toString().trim() : ''
          });
        });

        setImportPreview(validRows);
        setImportErrors(errorsList);
      } catch (err: any) {
        addToast('Không thể đọc file Excel. Định dạng file bị lỗi.', 'error');
      }
    };

    reader.readAsBinaryString(file);
  };

  const handleImportSubmit = async () => {
    if (importPreview.length === 0) {
      addToast('Không có dịch vụ hợp lệ để nhập.', 'warning');
      return;
    }

    setImportLoading(true);
    try {
      await importExcelServices(importPreview);
      addToast(`Đã nhập thành công ${importPreview.length} dịch vụ từ Excel.`, 'success');
      setImportModalOpen(false);
      setExcelFile(null);
      setImportPreview([]);
      setImportErrors([]);
      loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail?.message || 'Nhập Excel thất bại.', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  // Calculate stock levels stats
  const stockStats = services.reduce((acc, s) => {
    const stock = getStockInfo(s.id, s.is_active);
    if (stock.status === 'in_stock') acc.inStock++;
    else if (stock.status === 'low_stock') acc.lowStock++;
    else acc.outOfStock++;
    return acc;
  }, { inStock: 0, lowStock: 0, outOfStock: 0, total: services.length });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/60 pb-5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Dịch vụ giặt ủi</h2>
          <p className="text-xs text-slate-500 mt-0.5">Thiết lập bảng giá dịch vụ và theo dõi trạng thái tồn kho</p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] flex items-center gap-1.5 btn-press"
          >
            <Import size={15} strokeWidth={1.5} />
            Nhập Excel
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-[0.98] flex items-center gap-1.5 btn-press"
          >
            <Plus size={15} strokeWidth={1.5} />
            Thêm dịch vụ
          </button>
        </div>
      </div>

      {/* Stock Stats Row */}
      {!loading && services.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng dịch vụ</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-slate-800">{stockStats.total}</span>
              <span className="text-[10px] text-slate-400 font-semibold">loại</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-emerald-600">Còn hàng</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-600">{stockStats.inStock}</span>
              <span className="text-[10px] text-slate-400 font-semibold">sẵn sàng</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-amber-600">Sắp hết hàng</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-amber-600">{stockStats.lowStock}</span>
              <span className="text-[10px] text-slate-400 font-semibold">cần kiểm tra</span>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-card hover:-translate-y-0.5 transition-all duration-300">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-rose-600">Hết hàng</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-rose-600">{stockStats.outOfStock}</span>
              <span className="text-[10px] text-slate-400 font-semibold">tạm ngưng</span>
            </div>
          </div>
        </div>
      )}

      {/* Services Table */}
      {loading && services.length === 0 ? (
        <LoadingSpinner />
      ) : services.length === 0 ? (
        <EmptyState message="Chưa có dịch vụ nào." />
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
                  <th className="p-4 pl-6">Tên dịch vụ</th>
                  <th className="p-4">Phân loại</th>
                  <th className="p-4">Đơn giá</th>
                  <th className="p-4">Đơn vị</th>
                  <th className="p-4">Mô tả</th>
                  <th className="p-4">Tồn kho</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 pr-6 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => {
                  const stock = getStockInfo(s.id, s.is_active);
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/20 transition-colors">
                      <td className="p-4 pl-6 font-bold text-slate-800">{s.name}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/10 rounded-md font-semibold text-[9px]">
                          {s.category}
                        </span>
                      </td>
                      <td className="p-4 font-bold font-mono text-slate-800">{formatCurrency(s.price)}</td>
                      <td className="p-4 text-slate-500 font-semibold">/{s.unit}</td>
                      <td className="p-4 text-slate-400 font-medium max-w-xs truncate">{s.description || '-'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full tracking-wide inline-flex items-center gap-1.5 ${stock.colorClass}`}>
                          <span className={`w-1 h-1 rounded-full ${
                            stock.status === 'in_stock' ? 'bg-emerald-500' : stock.status === 'low_stock' ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {stock.label} {stock.quantity > 0 && `(${stock.quantity})`}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full tracking-wide inline-flex items-center gap-1 ${
                          s.is_active 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600'
                            : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                        }`}>
                          {s.is_active ? 'Hoạt động' : 'Tạm dừng'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(s)}
                            className="p-2 text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20/50 rounded-xl transition-all btn-press"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={13} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.name)}
                            className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200/50 rounded-xl transition-all btn-press"
                            title="Xóa dịch vụ"
                          >
                            <Trash2 size={13} strokeWidth={1.5} />
                          </button>
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

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/40 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight">Thêm dịch vụ mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors btn-press">
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tên dịch vụ *</label>
                <input
                  type="text"
                  placeholder="Giặt sấy chăn mền lớn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Danh mục</label>
                  <input
                    type="text"
                    placeholder="Giặt thường"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn vị *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors cursor-pointer"
                    required
                  >
                    <option value="kg">kg (Khối lượng)</option>
                    <option value="cái">cái (Số lượng)</option>
                    <option value="bộ">bộ (Quần áo comple...)</option>
                    <option value="đôi">đôi (Giày thể thao...)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn giá (VNĐ) *</label>
                <input
                  type="number"
                  placeholder="20000"
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors font-mono font-semibold"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mô tả dịch vụ</label>
                <textarea
                  placeholder="Mô tả các bước thực hiện hoặc cam kết..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 min-h-[70px] transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-xs shadow-md transition-all btn-press mt-3"
                disabled={loading}
              >
                Xác nhận thêm
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200/40 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight">Chỉnh sửa dịch vụ</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors btn-press">
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tên dịch vụ *</label>
                <input
                  type="text"
                  placeholder="Giặt sấy chăn mền lớn"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Danh mục</label>
                  <input
                    type="text"
                    placeholder="Giặt thường"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn vị *</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors cursor-pointer"
                    required
                  >
                    <option value="kg">kg</option>
                    <option value="cái">cái</option>
                    <option value="bộ">bộ</option>
                    <option value="đôi">đôi</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn giá (VNĐ) *</label>
                  <input
                    type="number"
                    placeholder="20000"
                    value={editPrice || ''}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors font-mono font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</label>
                  <select
                    value={editIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditIsActive(e.target.value === 'active')}
                    className="w-full px-3.5 py-2.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mô tả dịch vụ</label>
                <textarea
                  placeholder="Mô tả các bước thực hiện..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-3.5 border border-slate-200 focus:border-primary rounded-xl text-xs outline-none bg-slate-50/50 min-h-[70px] transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-semibold text-xs shadow-md transition-all btn-press mt-3"
                disabled={loading}
              >
                Cập nhật
              </button>
            </form>
          </div>
        </div>
      )}

      {/* IMPORT EXCEL MODAL */}
      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200/40 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-tight flex items-center gap-1.5">
                <FileSpreadsheet className="text-emerald-500" size={15} strokeWidth={1.5} /> Nhập dịch vụ từ file Excel
              </h3>
              <button 
                onClick={() => {
                  setImportModalOpen(false);
                  setExcelFile(null);
                  setImportPreview([]);
                  setImportErrors([]);
                }} 
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors btn-press"
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* File Input */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50/50 transition-all relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <Upload className="mx-auto text-slate-400 group-hover:text-primary transition-colors mb-2" size={24} strokeWidth={1.5} />
                <p className="text-xs font-bold text-slate-700">Tải file Excel lên</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[280px] mx-auto leading-normal">Định dạng hỗ trợ: .xlsx, .xls. Các cột yêu cầu: name, price, category, unit, description</p>
                {excelFile && (
                  <p className="mt-3 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 px-3 rounded-lg inline-flex items-center gap-1">
                    <Check size={13} strokeWidth={1.5} /> {excelFile.name}
                  </p>
                )}
              </div>

              {/* Errors List */}
              {importErrors.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 max-h-24 overflow-y-auto space-y-1">
                  <h4 className="text-[9px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={11} strokeWidth={1.5} /> Lỗi định dạng dòng Excel:
                  </h4>
                  <ul className="text-[10px] text-rose-700 list-disc pl-4 space-y-0.5">
                    {importErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Bản xem trước dữ liệu hợp lệ ({importPreview.length} dịch vụ)
                  </h4>
                  <div className="border border-slate-100 rounded-xl max-h-36 overflow-y-auto shadow-inner bg-slate-50/30">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="p-2 pl-3">Tên dịch vụ</th>
                          <th className="p-2">Phân loại</th>
                          <th className="p-2">Đơn giá</th>
                          <th className="p-2 pr-3">Đơn vị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100/60 last:border-b-0">
                            <td className="p-2 pl-3 font-bold text-slate-800">{item.name}</td>
                            <td className="p-2 text-slate-500">{item.category}</td>
                            <td className="p-2 font-mono font-bold text-slate-700">{formatCurrency(item.price)}</td>
                            <td className="p-2 text-slate-400 pr-3">/{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleImportSubmit}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-semibold text-xs shadow-sm transition-all btn-press flex items-center justify-center gap-1.5 mt-3"
                disabled={importLoading || importPreview.length === 0 || importErrors.length > 0}
              >
                {importLoading ? 'Đang nhập dữ liệu...' : `Xác nhận nhập ${importPreview.length} dịch vụ`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
