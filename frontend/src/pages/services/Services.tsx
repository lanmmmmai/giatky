import React, { useEffect, useState } from 'react';
import { getServices, createService, updateService, deleteService, importExcelServices, Service } from '../../api/services';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, Import, Upload, AlertCircle, FileSpreadsheet, X, Check } from 'lucide-react';

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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Dịch vụ giặt ủi</h2>
          <p className="text-xs text-slate-500">Thiết lập bảng giá dịch vụ giặt sấy, hấp ủi chi tiết</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Import size={16} />
            Nhập từ Excel
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={16} />
            Thêm dịch vụ
          </button>
        </div>
      </div>

      {/* Services Table */}
      {loading && services.length === 0 ? (
        <LoadingSpinner />
      ) : services.length === 0 ? (
        <EmptyState message="Chưa có dịch vụ nào." />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-4">Tên dịch vụ</th>
                  <th className="p-4">Phân loại</th>
                  <th className="p-4">Đơn giá</th>
                  <th className="p-4">Đơn vị</th>
                  <th className="p-4">Mô tả</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {services.map(s => (
                  <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{s.name}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md font-semibold text-[10px] border border-blue-100">
                        {s.category}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-800">{formatCurrency(s.price)}</td>
                    <td className="p-4 text-slate-500 font-medium">/{s.unit}</td>
                    <td className="p-4 text-slate-400 font-medium max-w-xs truncate">{s.description || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 border text-[10px] font-semibold rounded-full ${
                        s.is_active 
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                          : 'bg-rose-50 border-rose-200 text-rose-600'
                      }`}>
                        {s.is_active ? 'Hoạt động' : 'Tạm dừng'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEditClick(s)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Chỉnh sửa"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Xóa dịch vụ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Thêm dịch vụ mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên dịch vụ *</label>
                <input
                  type="text"
                  placeholder="Giặt sấy chăn mền lớn"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Phân loại / Danh mục</label>
                  <input
                    type="text"
                    placeholder="Giặt thường / Hấp / Nhanh"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Đơn vị tính *</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-white"
                    required
                  >
                    <option value="kg">kg (Khối lượng)</option>
                    <option value="cái">cái (Số lượng)</option>
                    <option value="bộ">bộ (Quần áo comple...)</option>
                    <option value="đôi">đôi (Giày thể thao...)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Đơn giá dịch vụ (VNĐ) *</label>
                <input
                  type="number"
                  placeholder="20000"
                  value={price || ''}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Mô tả chi tiết dịch vụ</label>
                <textarea
                  placeholder="Mô tả các bước thực hiện hoặc cam kết..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 min-h-16"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
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
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa dịch vụ</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên dịch vụ *</label>
                <input
                  type="text"
                  placeholder="Giặt sấy chăn mền lớn"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Phân loại / Danh mục</label>
                  <input
                    type="text"
                    placeholder="Giặt thường / Hấp"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Đơn vị tính *</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-white"
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Đơn giá (VNĐ) *</label>
                  <input
                    type="number"
                    placeholder="20000"
                    value={editPrice || ''}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Trạng thái dịch vụ</label>
                  <select
                    value={editIsActive ? 'active' : 'inactive'}
                    onChange={(e) => setEditIsActive(e.target.value === 'active')}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Mô tả chi tiết dịch vụ</label>
                <textarea
                  placeholder="Mô tả các bước thực hiện..."
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 min-h-16"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
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
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <FileSpreadsheet className="text-emerald-500" size={18} /> Nhập dịch vụ từ file Excel
              </h3>
              <button 
                onClick={() => {
                  setImportModalOpen(false);
                  setExcelFile(null);
                  setImportPreview([]);
                  setImportErrors([]);
                }} 
                className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {/* File Input */}
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors relative cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto text-slate-400 mb-2" size={32} />
                <p className="text-xs font-bold text-slate-700">Tải file Excel mẫu lên</p>
                <p className="text-[10px] text-slate-400 mt-1">Hỗ trợ định dạng .xlsx hoặc .xls. Yêu cầu có các cột: name, price, category, unit, description</p>
                {excelFile && (
                  <p className="mt-3 text-xs text-emerald-600 font-bold bg-emerald-50 py-1.5 px-3 rounded-lg inline-flex items-center gap-1">
                    <Check size={14} /> {excelFile.name}
                  </p>
                )}
              </div>

              {/* Errors List */}
              {importErrors.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 max-h-24 overflow-y-auto space-y-1">
                  <h4 className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={12} /> Phát hiện lỗi dòng Excel:
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
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Bản xem trước dữ liệu hợp lệ ({importPreview.length} dòng)
                  </h4>
                  <div className="border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                    <table className="w-full text-left text-[10px]">
                      <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="p-2">Tên dịch vụ</th>
                          <th className="p-2">Phân loại</th>
                          <th className="p-2">Đơn giá</th>
                          <th className="p-2">Đơn vị</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 last:border-b-0">
                            <td className="p-2 font-bold text-slate-800">{item.name}</td>
                            <td className="p-2 text-slate-500">{item.category}</td>
                            <td className="p-2 font-bold text-slate-700">{formatCurrency(item.price)}</td>
                            <td className="p-2 text-slate-400">/{item.unit}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleImportSubmit}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-1.5"
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
