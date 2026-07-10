import React, { useEffect, useState } from 'react';
import { getBranches, createBranch, updateBranch, deleteBranch, Branch } from '../../api/branches';
import { getUsers } from '../../api/users';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Plus, Edit2, Trash2, MapPin, Phone, User as UserIcon, X, Check, CheckSquare } from 'lucide-react';

const Branches: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal open states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Create Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [managerId, setManagerId] = useState('');

  // Edit Form State
  const [editingBranchId, setEditingBranchId] = useState('');
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editManagerId, setEditManagerId] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'inactive'>('active');

  useEffect(() => {
    loadBranches();
    loadManagers();
  }, []);

  const loadBranches = async () => {
    setLoading(true);
    try {
      const data = await getBranches();
      setBranches(data);
    } catch (_) {
      addToast('Không thể tải danh sách chi nhánh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadManagers = async () => {
    try {
      const allUsers = await getUsers();
      setManagers(allUsers.filter(u => u.role === 'manager' && u.status === 'active'));
    } catch (_) {}
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast('Vui lòng nhập tên chi nhánh.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        address: address || undefined,
        phone: phone || undefined,
        manager_id: managerId || undefined
      };

      await createBranch(payload);
      addToast('Tạo chi nhánh mới thành công.', 'success');
      setCreateModalOpen(false);
      setName('');
      setAddress('');
      setPhone('');
      setManagerId('');
      loadBranches();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Tạo chi nhánh thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (b: Branch) => {
    setEditingBranchId(b.id);
    setEditName(b.name);
    setEditAddress(b.address || '');
    setEditPhone(b.phone || '');
    setEditManagerId(b.manager_id || '');
    setEditStatus(b.status);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: editName,
        address: editAddress || undefined,
        phone: editPhone || undefined,
        manager_id: editManagerId || undefined,
        status: editStatus
      };

      await updateBranch(editingBranchId, payload);
      addToast('Cập nhật thông tin chi nhánh thành công.', 'success');
      setEditModalOpen(false);
      loadBranches();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể cập nhật chi nhánh.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa cơ sở ${name}?`)) return;

    try {
      await deleteBranch(id);
      addToast(`Đã xóa cơ sở ${name} thành công.`, 'success');
      setBranches(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Xóa chi nhánh thất bại.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Cơ sở chi nhánh</h2>
          <p className="text-xs text-slate-500">Quản lý mạng lưới địa điểm giặt sấy của hệ thống Giặt Ký</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus size={16} />
            Tạo cơ sở mới
          </button>
        )}
      </div>

      {/* Branch grid list */}
      {loading && branches.length === 0 ? (
        <LoadingSpinner />
      ) : branches.length === 0 ? (
        <EmptyState message="Chưa có chi nhánh nào được tạo." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {branches.map(b => {
            const mgrName = (b as any).manager?.full_name || 'Chưa gán quản lý';
            return (
              <div key={b.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="text-sm font-bold text-slate-800 line-clamp-1">{b.name}</h3>
                    <span className={`px-2 py-0.5 border text-[9px] font-bold uppercase rounded-md tracking-wider ${
                      b.status === 'active' 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : 'bg-rose-50 border-rose-200 text-rose-600'
                    }`}>
                      {b.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1.5 font-medium">
                    {b.address && (
                      <p className="flex items-start gap-1.5">
                        <MapPin size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                        <span>{b.address}</span>
                      </p>
                    )}
                    {b.phone && (
                      <p className="flex items-center gap-1.5">
                        <Phone size={14} className="text-slate-400 flex-shrink-0" />
                        <span>{b.phone}</span>
                      </p>
                    )}
                    <p className="flex items-center gap-1.5 border-t border-slate-50 pt-2 text-slate-700">
                      <UserIcon size={14} className="text-slate-400 flex-shrink-0" />
                      <span>Quản lý: <strong>{mgrName}</strong></span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-50 pt-3">
                  <button
                    onClick={() => handleEditClick(b)}
                    className="p-1.5 text-primary hover:bg-primary/10 border border-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <Edit2 size={12} />
                    Sửa
                  </button>
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(b.id, b.name)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 border border-slate-100 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                    >
                      <Trash2 size={12} />
                      Xóa
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm">Tạo cơ sở chi nhánh mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên chi nhánh *</label>
                <input
                  type="text"
                  placeholder="Giặt Ký Quận 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="123 Trần Hưng Đạo, P. Nguyễn Cư Trinh..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Số điện thoại hotline chi nhánh</label>
                <input
                  type="text"
                  placeholder="028 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                />
              </div>

              {user?.role === 'admin' && (
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Gán quản lý (Manager)</label>
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary bg-white"
                  >
                    <option value="">Không gán / Chọn sau</option>
                    {managers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
                disabled={loading}
              >
                Tạo mới
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
              <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa thông tin chi nhánh</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Tên chi nhánh *</label>
                <input
                  type="text"
                  placeholder="Giặt Ký Quận 1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Địa chỉ</label>
                <input
                  type="text"
                  placeholder="123 Trần Hưng Đạo..."
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Số điện thoại</label>
                <input
                  type="text"
                  placeholder="028 1234 5678"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {user?.role === 'admin' ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Quản lý (Manager)</label>
                    <select
                      value={editManagerId}
                      onChange={(e) => setEditManagerId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary bg-white"
                    >
                      <option value="">Không gán</option>
                      {managers.map(m => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </div>
                ) : null}

                <div className={`space-y-1 ${user?.role !== 'admin' ? 'col-span-2' : ''}`}>
                  <label className="text-xs font-semibold text-slate-600">Trạng thái vận hành</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-none focus:border-primary bg-white"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Tạm ngưng</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
                disabled={loading}
              >
                Lưu thay đổi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Branches;
