import React, { useEffect, useState } from 'react';
import {
  getServices,
  createService,
  updateService,
  deleteService,
  importExcelServices,
  Service,
} from '../../api/services';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import * as XLSX from 'xlsx';
import {
  Plus,
  Edit2,
  Trash2,
  Import,
  Upload,
  AlertCircle,
  FileSpreadsheet,
  X,
  Check,
  BarChart3,
  BadgeCheck,
  PauseCircle,
  Layers3,
} from 'lucide-react';

interface ServiceFormState {
  name: string;
  category_name: string;
  unit: string;
  price: number;
  description: string;
  status: 'active' | 'inactive';
}

const defaultFormState: ServiceFormState = {
  name: '',
  category_name: '',
  unit: 'kg',
  price: 0,
  description: '',
  status: 'active',
};

const Services: React.FC = () => {
  const { addToast } = useToastStore();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [createForm, setCreateForm] = useState<ServiceFormState>(defaultFormState);
  const [editForm, setEditForm] = useState<ServiceFormState>(defaultFormState);
  const [editingServiceId, setEditingServiceId] = useState('');

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ServiceFormState[]>([]);
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

  const handleCreateChange = (field: keyof ServiceFormState, value: string | number) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditChange = (field: keyof ServiceFormState, value: string | number) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetImportState = () => {
    setExcelFile(null);
    setImportPreview([]);
    setImportErrors([]);
    setImportLoading(false);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name.trim() || !createForm.unit.trim()) {
      addToast('Vui lòng điền đầy đủ thông tin bắt buộc.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await createService({
        name: createForm.name.trim(),
        category_id: createForm.category_name.trim() || null,
        category_name: createForm.category_name.trim() || null,
        price: createForm.price,
        unit: createForm.unit.trim(),
        description: createForm.description.trim(),
        status: createForm.status,
      });
      addToast('Thêm dịch vụ thành công.', 'success');
      setCreateModalOpen(false);
      setCreateForm(defaultFormState);
      await loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Thêm dịch vụ thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (service: Service) => {
    setEditingServiceId(service.id);
    setEditForm({
      name: service.name,
      category_name: service.category_name || '',
      unit: service.unit,
      price: service.price,
      description: service.description || '',
      status: service.status,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateService(editingServiceId, {
        name: editForm.name.trim(),
        category_id: editForm.category_name.trim() || null,
        category_name: editForm.category_name.trim() || null,
        price: editForm.price,
        unit: editForm.unit.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
      });
      addToast('Cập nhật dịch vụ thành công.', 'success');
      setEditModalOpen(false);
      await loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Cập nhật thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, serviceName: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa dịch vụ: ${serviceName}?`)) return;

    try {
      const result = await deleteService(id);
      addToast(result.message || 'Xóa dịch vụ thành công.', 'success');
      await loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xóa dịch vụ thất bại.', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

        const validRows: ServiceFormState[] = [];
        const errorsList: string[] = [];

        rawData.forEach((row, index) => {
          const lineNum = index + 2;
          const nameValue = row.name || row['Tên dịch vụ'] || row['Name'];
          const priceValue = row.price || row['Đơn giá'] || row['Price'];
          const categoryValue = row.category || row['Phân loại'] || row['Category'];
          const unitValue = row.unit || row['Đơn vị'] || row['Unit'];
          const descriptionValue = row.description || row['Mô tả'] || row['Description'];
          const statusValue = row.status || row['Trạng thái'] || row['Status'];

          if (!nameValue || !nameValue.toString().trim()) {
            errorsList.push(`Dòng ${lineNum}: Tên dịch vụ không được để trống.`);
            return;
          }

          if (
            priceValue === undefined ||
            priceValue === null ||
            Number.isNaN(Number(priceValue)) ||
            Number(priceValue) < 0
          ) {
            errorsList.push(`Dòng ${lineNum}: Đơn giá không hợp lệ (bắt buộc và phải >= 0).`);
            return;
          }

          const normalizedStatus =
            `${statusValue || ''}`.toLowerCase() === 'inactive' ? 'inactive' : 'active';

          validRows.push({
            name: nameValue.toString().trim(),
            category_name: categoryValue ? categoryValue.toString().trim() : '',
            unit: unitValue ? unitValue.toString().trim() : 'kg',
            price: Math.round(Number(priceValue)),
            description: descriptionValue ? descriptionValue.toString().trim() : '',
            status: normalizedStatus,
          });
        });

        setImportPreview(validRows);
        setImportErrors(errorsList);
      } catch (_) {
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
      resetImportState();
      await loadServices();
    } catch (err: any) {
      addToast(err.response?.data?.detail?.message || 'Nhập Excel thất bại.', 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  const totalServices = services.length;
  const activeServices = services.filter((service) => service.status === 'active').length;
  const inactiveServices = services.filter((service) => service.status === 'inactive').length;
  const uncategorizedServices = services.filter((service) => !service.category_id).length;

  const getStatusBadge = (status: Service['status']) => {
    if (status === 'active') {
      return {
        label: 'Đang hoạt động',
        className: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600',
      };
    }

    return {
      label: 'Tạm ngừng',
      className: 'bg-rose-500/10 border-rose-500/20 text-rose-600',
    };
  };

  return (
    <div className="page-shell">
      {/* Standard page title block — same structure/spacing as Payroll and other admin pages */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý dịch vụ</h2>
          <p className="text-xs text-slate-500 mt-1">Quản lý danh mục, đơn giá và trạng thái các dịch vụ giặt là.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button onClick={() => setImportModalOpen(true)} className="primary-action">
            <Import size={15} strokeWidth={1.5} />
            Nhập Excel
          </button>
          <button onClick={() => setCreateModalOpen(true)} className="primary-action">
            <Plus size={15} strokeWidth={1.5} />
            Thêm dịch vụ
          </button>
        </div>
      </div>

      {!loading && services.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="surface-card p-5 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tổng dịch vụ</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold font-mono text-slate-900">{totalServices}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">dịch vụ</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-[20px] bg-primary/10 text-primary border border-primary/10 flex items-center justify-center">
                <BarChart3 size={18} strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="surface-card p-5 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Đang hoạt động</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold font-mono text-emerald-600">{activeServices}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">đang áp dụng</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-[20px] bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center">
                <BadgeCheck size={18} strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="surface-card p-5 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Tạm ngừng</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold font-mono text-rose-600">{inactiveServices}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">chưa sử dụng</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-[20px] bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                <PauseCircle size={18} strokeWidth={1.5} />
              </div>
            </div>
          </div>

          <div className="surface-card p-5 hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Chưa phân loại</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold font-mono text-amber-600">{uncategorizedServices}</span>
                  <span className="text-[10px] text-slate-400 font-semibold">cần bổ sung</span>
                </div>
              </div>
              <div className="w-11 h-11 rounded-[20px] bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center">
                <Layers3 size={18} strokeWidth={1.5} />
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && services.length === 0 ? (
        <LoadingSpinner />
      ) : services.length === 0 ? (
        <EmptyState message="Chưa có dịch vụ nào." />
      ) : (
        <div className="surface-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-primary/5 text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[9px] font-bold">
                  <th className="p-4 pl-6">Tên dịch vụ</th>
                  <th className="p-4">Phân loại</th>
                  <th className="p-4">Đơn giá</th>
                  <th className="p-4">Đơn vị</th>
                  <th className="p-4">Mô tả</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 pr-6 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service) => {
                  const statusBadge = getStatusBadge(service.status);

                  return (
                    <tr key={service.id} className="border-b border-slate-100 hover:bg-primary/5 transition-colors">
                      <td className="p-4 pl-6 font-bold text-slate-900">{service.name}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/10 rounded-2xl font-semibold text-[9px] whitespace-nowrap inline-block">
                          {service.category_name || 'Chưa phân loại'}
                        </span>
                      </td>
                      <td className="p-4 font-bold font-mono text-slate-900 whitespace-nowrap">{formatCurrency(service.price)}</td>
                      <td className="p-4 text-slate-500 font-semibold whitespace-nowrap">/{service.unit}</td>
                      <td className="p-4 text-slate-400 font-medium max-w-sm truncate">{service.description || '-'}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full tracking-wide inline-flex items-center gap-1 whitespace-nowrap ${statusBadge.className}`}>
                          {statusBadge.label}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(service)}
                            className="p-2 text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 rounded-2xl transition-all btn-press"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={13} strokeWidth={1.5} />
                          </button>
                          <button
                            onClick={() => handleDelete(service.id, service.name)}
                            className="p-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-2xl transition-all btn-press"
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

      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full shadow-card border border-white overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-[0.18em]">Thêm dịch vụ mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors btn-press">
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tên dịch vụ *</label>
                <input
                  type="text"
                  placeholder="Giặt sấy chăn mền lớn"
                  value={createForm.name}
                  onChange={(e) => handleCreateChange('name', e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phân loại</label>
                <input
                  type="text"
                  placeholder="Giặt thường"
                  value={createForm.category_name}
                  onChange={(e) => handleCreateChange('category_name', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn giá (VNĐ) *</label>
                  <input
                    type="number"
                    placeholder="20000"
                    value={createForm.price || ''}
                    onChange={(e) => handleCreateChange('price', Number(e.target.value))}
                    className="form-control font-mono font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn vị *</label>
                  <select
                    value={createForm.unit}
                    onChange={(e) => handleCreateChange('unit', e.target.value)}
                    className="form-control cursor-pointer appearance-none"
                    required
                  >
                    <option value="kg">kg</option>
                    <option value="cái">cái</option>
                    <option value="bộ">bộ</option>
                    <option value="đôi">đôi</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mô tả</label>
                <textarea
                  placeholder="Mô tả quy trình hoặc ghi chú dịch vụ..."
                  value={createForm.description}
                  onChange={(e) => handleCreateChange('description', e.target.value)}
                  className="form-control min-h-[88px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</label>
                <select
                  value={createForm.status}
                  onChange={(e) => handleCreateChange('status', e.target.value as Service['status'])}
                  className="form-control cursor-pointer appearance-none"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngừng</option>
                </select>
              </div>

              <button type="submit" className="primary-action w-full mt-3" disabled={loading}>
                Xác nhận thêm
              </button>
            </form>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-md w-full shadow-card border border-white overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-[0.18em]">Chỉnh sửa dịch vụ</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors btn-press">
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tên dịch vụ *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => handleEditChange('name', e.target.value)}
                  className="form-control"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phân loại</label>
                <input
                  type="text"
                  value={editForm.category_name}
                  onChange={(e) => handleEditChange('category_name', e.target.value)}
                  className="form-control"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn giá (VNĐ) *</label>
                  <input
                    type="number"
                    value={editForm.price || ''}
                    onChange={(e) => handleEditChange('price', Number(e.target.value))}
                    className="form-control font-mono font-semibold"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Đơn vị *</label>
                  <select
                    value={editForm.unit}
                    onChange={(e) => handleEditChange('unit', e.target.value)}
                    className="form-control cursor-pointer appearance-none"
                    required
                  >
                    <option value="kg">kg</option>
                    <option value="cái">cái</option>
                    <option value="bộ">bộ</option>
                    <option value="đôi">đôi</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mô tả</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => handleEditChange('description', e.target.value)}
                  className="form-control min-h-[88px] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</label>
                <select
                  value={editForm.status}
                  onChange={(e) => handleEditChange('status', e.target.value as Service['status'])}
                  className="form-control cursor-pointer appearance-none"
                >
                  <option value="active">Đang hoạt động</option>
                  <option value="inactive">Tạm ngừng</option>
                </select>
              </div>

              <button type="submit" className="primary-action w-full mt-3" disabled={loading}>
                Cập nhật
              </button>
            </form>
          </div>
        </div>
      )}

      {importModalOpen && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] max-w-lg w-full shadow-card border border-white overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-[0.18em] flex items-center gap-1.5">
                <FileSpreadsheet className="text-primary" size={15} strokeWidth={1.5} />
                Nhập dịch vụ từ file Excel
              </h3>
              <button
                onClick={() => {
                  setImportModalOpen(false);
                  resetImportState();
                }}
                className="p-2 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-colors btn-press"
              >
                <X size={15} strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="border-2 border-dashed border-primary/20 rounded-[24px] p-6 text-center bg-primary/5 transition-all relative cursor-pointer group">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                />
                <Upload className="mx-auto text-slate-400 group-hover:text-primary transition-colors mb-2" size={24} strokeWidth={1.5} />
                <p className="text-xs font-bold text-slate-700">Tải file Excel lên</p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-[320px] mx-auto leading-normal">
                  Định dạng hỗ trợ: `.xlsx`, `.xls`. Cột dùng được: `name`, `price`, `category`, `unit`, `description`, `status`.
                </p>
                {excelFile && (
                  <p className="mt-3 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 px-3 rounded-lg inline-flex items-center gap-1">
                    <Check size={13} strokeWidth={1.5} />
                    {excelFile.name}
                  </p>
                )}
              </div>

              {importErrors.length > 0 && (
                <div className="bg-rose-500/5 border border-rose-500/10 rounded-[20px] p-3 max-h-24 overflow-y-auto space-y-1">
                  <h4 className="text-[9px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={11} strokeWidth={1.5} />
                    Lỗi định dạng dòng Excel
                  </h4>
                  <ul className="text-[10px] text-rose-700 list-disc pl-4 space-y-0.5">
                    {importErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {importPreview.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Bản xem trước dữ liệu hợp lệ ({importPreview.length} dịch vụ)
                  </h4>
                  <div className="border border-slate-100 rounded-[20px] max-h-36 overflow-y-auto shadow-inner bg-white">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-white text-slate-400 font-bold uppercase text-[9px] border-b border-slate-100 sticky top-0">
                        <tr>
                          <th className="p-2 pl-3">Tên dịch vụ</th>
                          <th className="p-2">Phân loại</th>
                          <th className="p-2">Đơn giá</th>
                          <th className="p-2 pr-3">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, index) => (
                          <tr key={index} className="border-b border-slate-100/60 last:border-b-0">
                            <td className="p-2 pl-3 font-bold text-slate-800">{item.name}</td>
                            <td className="p-2 text-slate-500">{item.category_name || 'Chưa phân loại'}</td>
                            <td className="p-2 font-mono font-bold text-slate-700">{formatCurrency(item.price)}</td>
                            <td className="p-2 pr-3 text-slate-500">{item.status === 'active' ? 'Đang hoạt động' : 'Tạm ngừng'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleImportSubmit}
                className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-[20px] font-semibold text-xs shadow-[0_12px_26px_rgba(108,99,255,0.24)] transition-all btn-press flex items-center justify-center gap-1.5 mt-3"
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
