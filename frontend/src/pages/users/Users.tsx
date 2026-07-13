import React, { useEffect, useState } from 'react';
import { getUsers, createManager, createStaff, updateUser, updateUserStatus, deleteUser } from '../../api/users';
import { getBranches, Branch } from '../../api/branches';
import { useAuthStore, User } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import { Plus, Edit2, ShieldAlert, CheckCircle, Ban, Trash, Mail, Phone, Clock, DollarSign, X } from 'lucide-react';

const Users: React.FC = () => {
  const { user } = useAuthStore();
  const { addToast } = useToastStore();
  const confirm = useConfirm();

  const [usersList, setUsersList] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal open states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Create form state
  const [roleToCreate, setRoleToCreate] = useState<'manager' | 'staff'>('staff');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [branchId, setBranchId] = useState('');
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  // Edit form state
  const [editingUserId, setEditingUserId] = useState('');
  const [editUserRole, setEditUserRole] = useState<'manager' | 'staff'>('staff');
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editHourlyRate, setEditHourlyRate] = useState<number>(0);
  const [editBranchId, setEditBranchId] = useState('');
  const [editBranchIds, setEditBranchIds] = useState<string[]>([]);
  const [editManagerId, setEditManagerId] = useState('');

  useEffect(() => {
    loadBranches();
    loadUsers();
  }, []);

  const loadBranches = async () => {
    try {
      const data = await getBranches();
      setBranches(Array.isArray(data) ? data : []);
    } catch (_) {}
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsersList(Array.isArray(data) ? data : []);
    } catch (_) {
      addToast('Không thể tải danh sách tài khoản.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setFullName('');
    setEmail('');
    setUsername('');
    setPassword('');
    setPhone('');
    setBranchId('');
    setBranchIds([]);
    setHourlyRate(0);
    setSelectedManagerId('');
  };

  const normalizeBranchIds = (u: User | any): string[] => {
    const ids =
      u.assigned_branches?.map((item: any) => item.branch_id) ??
      u.facilities?.map((item: any) => item.id) ??
      u.branch_ids ??
      (u.branch_id ? [u.branch_id] : []);

    return Array.from(new Set((ids || []).filter(Boolean).map((id: any) => String(id))));
  };

  const getUserBranches = (u: User | any) => {
    const fromAssigned = u.assigned_branches?.map((item: any) => ({
      id: String(item.branch_id),
      name: item.branch_name
    }));
    const fromFacilities = u.facilities?.map((item: any) => ({
      id: String(item.id),
      name: item.name
    }));
    const source = fromAssigned?.length ? fromAssigned : fromFacilities?.length ? fromFacilities : [];

    if (source.length > 0) {
      return source.filter((item: any, index: number, arr: any[]) => (
        item.id && arr.findIndex(other => other.id === item.id) === index
      ));
    }

    if (u.branch_id) {
      const branch = branches.find(b => String(b.id) === String(u.branch_id));
      return branch ? [{ id: String(branch.id), name: branch.name }] : [];
    }

    return [];
  };

  const getFacilityDisplay = (u: User | any) => {
    const userBranches = getUserBranches(u);
    if (userBranches.length === 0) return 'Chưa phân công';
    if (userBranches.length === 1) return userBranches[0].name;
    return `${userBranches.length} cơ sở`;
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !username.trim()) {
      addToast('Vui lòng nhập các thông tin bắt buộc.', 'warning');
      return;
    }

    if (roleToCreate === 'staff' && branchIds.length === 0) {
      addToast('Vui lòng chọn ít nhất một cơ sở làm việc.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: fullName,
        email,
        username,
        password: password || undefined,
        phone: phone || undefined,
        ...(roleToCreate === 'staff' ? {
          branch_id: branchIds[0] || undefined,
          branch_ids: branchIds,
          hourly_rate: hourlyRate,
          manager_id: selectedManagerId || undefined
        } : {
          branch_id: undefined,
          branch_ids: undefined,
          hourly_rate: 0,
          manager_id: undefined
        })
      };

      let result;
      if (roleToCreate === 'manager') {
        result = await createManager(payload);
      } else {
        result = await createStaff(payload);
      }

      if (result.email_sent) {
        addToast(`Đã tạo tài khoản ${roleToCreate === 'manager' ? 'Quản lý' : 'Nhân viên'} thành công! Mật khẩu tạm thời: ${result.temporary_password}`, 'success');
      } else {
        addToast(`Tài khoản đã tạo nhưng gửi email thất bại. Mật khẩu tạm thời: ${result.temporary_password}`, 'warning');
      }
      setCreateModalOpen(false);
      resetCreateForm();
      loadUsers();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể tạo tài khoản.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (u: User) => {
    setEditingUserId(u.id);
    setEditUserRole(u.role as any);
    setEditFullName(u.full_name || '');
    setEditPhone(u.phone || '');
    setEditHourlyRate(u.hourly_rate || 0);
    setEditBranchId(u.branch_id || '');
    
    setEditBranchIds(normalizeBranchIds(u));
    
    setEditManagerId(u.manager_id || '');
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editUserRole === 'staff' && editBranchIds.length === 0) {
      addToast('Vui lòng chọn ít nhất một cơ sở làm việc.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        full_name: editFullName,
        phone: editPhone || undefined,
        ...(editUserRole === 'staff' ? {
          hourly_rate: editHourlyRate,
          branch_id: editBranchIds[0] || undefined,
          branch_ids: editBranchIds,
          manager_id: editManagerId || undefined
        } : {
          hourly_rate: 0,
          branch_id: undefined,
          branch_ids: undefined,
          manager_id: undefined
        })
      };

      const updated = await updateUser(editingUserId, payload);
      setUsersList(prev => prev.map(item => item.id === editingUserId ? { ...item, ...updated } : item));
      addToast('Cập nhật nhân viên thành công', 'success');
      setEditModalOpen(false);
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể cập nhật tài khoản.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string, name: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    const action = currentStatus === 'active' ? 'Khóa' : 'Kích hoạt';
    
    await confirm({
      title: `${action} tài khoản?`,
      description: currentStatus === 'active'
        ? 'Tài khoản sẽ không thể đăng nhập cho đến khi được kích hoạt lại.'
        : 'Tài khoản sẽ được phép đăng nhập và sử dụng hệ thống trở lại.',
      objectName: name,
      confirmText: `${action} tài khoản`,
      variant: currentStatus === 'active' ? 'warning' : 'default',
      onConfirm: async () => {
        try {
          await updateUserStatus(id, newStatus);
          addToast(`Đã ${action} tài khoản thành công.`, 'success');
          setUsersList(prev => prev.map(u => u.id === id ? { ...u, status: newStatus as any } : u));
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Thay đổi trạng thái thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const handleDeleteClick = async (id: string, name: string) => {
    await confirm({
      title: 'Xóa tài khoản nhân viên?',
      description: 'Nếu tài khoản đã có dữ liệu nghiệp vụ liên quan, hệ thống sẽ chuyển sang trạng thái khóa thay vì xóa vĩnh viễn.',
      objectName: name,
      confirmText: 'Xóa tài khoản',
      variant: 'danger',
      disableBackdropClose: true,
      onConfirm: async () => {
        try {
          const result = await deleteUser(id);
          addToast(result.message || 'Xóa tài khoản thành công.', 'success');
          await loadUsers();
        } catch (err: any) {
          addToast(err.response?.data?.detail || 'Xóa tài khoản thất bại.', 'error');
          throw err;
        }
      },
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhân sự</h2>
          <p className="text-xs text-slate-500">Quản lý danh sách Manager, Staff, phân cơ sở và cài đặt mức lương giờ</p>
        </div>
        <button
          onClick={() => {
            setRoleToCreate('staff');
            setCreateModalOpen(true);
          }}
          className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
        >
          <Plus size={16} />
          Tạo tài khoản mới
        </button>
      </div>

      {/* Users table list */}
      {loading && usersList.length === 0 ? (
        <LoadingSpinner />
      ) : usersList.length === 0 ? (
        <EmptyState message="Không có tài khoản nào hiện có." />
      ) : (
        <div className="bg-white rounded-[20px] border border-[#ECECEC] shadow-card overflow-hidden animate-in fade-in duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase tracking-wider text-[10px] font-semibold">
                  <th className="p-4">Họ và tên</th>
                  <th className="p-4">Tên đăng nhập</th>
                  <th className="p-4">Vai trò</th>
                  <th className="p-4">Cơ sở làm việc</th>
                  <th className="p-4">Lương theo giờ</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {usersList.map(u => {
                  const roleBadges = {
                    admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    manager: 'bg-primary/10 text-primary border-primary/20',
                    staff: 'bg-secondary/10 text-secondary border-secondary/20'
                  }[u.role] || 'bg-slate-50 text-slate-500 border-slate-200';

                  const roleNames = {
                    admin: 'Chủ tiệm (Admin)',
                    manager: 'Quản lý (Manager)',
                    staff: 'Nhân viên (Staff)'
                  }[u.role] || u.role;

                  const statusBadges = {
                    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    pending_verification: 'bg-amber-50 text-amber-700 border-amber-200',
                    blocked: 'bg-rose-50 text-rose-700 border-rose-200'
                  }[u.status] || 'bg-slate-50 text-slate-500 border-slate-200';

                  const statusNames = {
                    active: 'Hoạt động',
                    pending_verification: 'Chờ kích hoạt',
                    blocked: 'Đã khóa'
                  }[u.status] || u.status;
                  const userBranches = getUserBranches(u);

                  return (
                    <tr key={u.id} className="border-b border-slate-100 hover:bg-primary/5 transition-colors">
                      <td className="p-4 font-semibold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              u.full_name[0].toUpperCase()
                            )}
                          </div>
                          <div>
                            <div>{u.full_name}</div>
                            <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                              {u.email && <span className="flex items-center gap-0.5"><Mail size={10} /> {u.email}</span>}
                              {u.phone && <span className="flex items-center gap-0.5"><Phone size={10} /> {u.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-mono font-medium text-slate-600">{u.username}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${roleBadges}`}>
                          {roleNames}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 font-medium">
                        {u.role === 'staff' ? (
                          <span
                            className={userBranches.length > 1 ? 'cursor-help underline decoration-dotted underline-offset-4' : ''}
                            title={userBranches.map((branch: { id: string; name: string }) => branch.name).join('\n')}
                          >
                            {getFacilityDisplay(u)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {u.role === 'staff' ? formatCurrency(u.hourly_rate || 0) : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusBadges}`}>
                          {statusNames}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {u.role !== 'admin' && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEditClick(u)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                              title="Chỉnh sửa thông tin"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(u.id, u.status, u.full_name)}
                              className={`p-1.5 rounded-lg transition-colors ${u.status === 'active' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                              title={u.status === 'active' ? 'Khóa tài khoản' : 'Kích hoạt tài khoản'}
                            >
                              {u.status === 'active' ? <Ban size={14} /> : <CheckCircle size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteClick(u.id, u.full_name)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Xóa tài khoản"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        )}
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
          <div className="bg-white rounded-[20px] max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-800 text-sm">Tạo tài khoản nhân viên mới</h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Vai trò</label>
                <div className="flex gap-2">
                  {user?.role === 'admin' && (
                    <button
                      type="button"
                      onClick={() => setRoleToCreate('manager')}
                      className={`flex-1 py-2 text-xs font-bold rounded-2xl border transition-all ${
                        roleToCreate === 'manager' 
                          ? 'bg-primary border-primary text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Manager
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRoleToCreate('staff')}
                    className={`flex-1 py-2 text-xs font-bold rounded-2xl border transition-all ${
                      roleToCreate === 'staff' 
                        ? 'bg-primary border-primary text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Staff
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Tên đăng nhập *</label>
                  <input
                    type="text"
                    placeholder="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="0987654321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Email nhận xác thực *</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Mật khẩu (Tùy chọn)</label>
                <input
                  type="password"
                  placeholder="Mặc định tự sinh"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                />
              </div>

              {roleToCreate === 'staff' && (
                <>
                  <div className={user?.role === 'admin' ? "grid grid-cols-2 gap-3" : "space-y-1"}>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Mức lương giờ (VNĐ) *</label>
                      <input
                        type="number"
                        value={hourlyRate || ''}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        placeholder="25000"
                        className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                        required
                      />
                    </div>
                    {user?.role === 'admin' && (
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-600">Manager phụ trách</label>
                        <select
                          value={selectedManagerId}
                          onChange={(e) => setSelectedManagerId(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary bg-white"
                        >
                          <option value="">Chọn Manager</option>
                          {usersList.filter(u => u.role === 'manager').map(m => (
                            <option key={m.id} value={m.id}>{m.full_name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Cơ sở gán làm việc *</label>
                    <div className="border border-slate-200 rounded-2xl p-3 bg-primary/5 max-h-32 overflow-y-auto space-y-2">
                      {branches.map(b => {
                        const branchKey = String(b.id);
                        const isChecked = branchIds.includes(branchKey);
                        return (
                          <label key={b.id} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setBranchIds(prev => Array.from(new Set([...prev, branchKey])));
                                } else {
                                  setBranchIds(prev => prev.filter(id => id !== branchKey));
                                }
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            {b.name}
                          </label>
                        );
                      })}
                      {branches.length === 0 && (
                        <div className="text-slate-400 text-[11px] text-center py-2">Không có cơ sở khả dụng</div>
                      )}
                    </div>
                    {branchIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {branchIds.map(id => {
                          const bName = branches.find(b => String(b.id) === String(id))?.name || id;
                          return (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/15">
                              {bName}
                              <button
                                type="button"
                                onClick={() => setBranchIds(prev => prev.filter(x => String(x) !== String(id)))}
                                className="text-primary hover:text-primary transition-colors ml-1"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
                disabled={loading}
              >
                Xác nhận tạo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[20px] max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-primary/5">
              <h3 className="font-bold text-slate-800 text-sm">Chỉnh sửa thông tin nhân viên</h3>
              <button onClick={() => setEditModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Họ và tên *</label>
                <input
                  type="text"
                  placeholder="Nguyễn Văn A"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className={`space-y-1 ${editUserRole === 'manager' ? 'col-span-2' : ''}`}>
                  <label className="text-xs font-semibold text-slate-600">Số điện thoại</label>
                  <input
                    type="text"
                    placeholder="0987654321"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                  />
                </div>
                {editUserRole === 'staff' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Lương/Giờ (VNĐ) *</label>
                    <input
                      type="number"
                      value={editHourlyRate || ''}
                      onChange={(e) => setEditHourlyRate(Number(e.target.value))}
                      placeholder="25000"
                      className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary"
                      required
                    />
                  </div>
                )}
              </div>

              {editUserRole === 'staff' && (
                <>
                  {user?.role === 'admin' && (
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-600">Manager phụ trách</label>
                      <select
                        value={editManagerId}
                        onChange={(e) => setEditManagerId(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded-2xl text-xs outline-none focus:border-primary bg-white"
                      >
                        <option value="">Chọn Manager</option>
                        {usersList.filter(u => u.role === 'manager').map(m => (
                          <option key={m.id} value={m.id}>{m.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Cơ sở làm việc *</label>
                    <div className="border border-slate-200 rounded-2xl p-3 bg-primary/5 max-h-32 overflow-y-auto space-y-2">
                      {branches.map(b => {
                        const branchKey = String(b.id);
                        const isChecked = editBranchIds.includes(branchKey);
                        return (
                          <label key={b.id} className="flex items-center gap-2.5 text-xs text-slate-700 font-medium cursor-pointer hover:text-slate-900 transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditBranchIds(prev => Array.from(new Set([...prev, branchKey])));
                                } else {
                                  setEditBranchIds(prev => prev.filter(id => id !== branchKey));
                                }
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            {b.name}
                          </label>
                        );
                      })}
                      {branches.length === 0 && (
                        <div className="text-slate-400 text-[11px] text-center py-2">Không có cơ sở khả dụng</div>
                      )}
                    </div>
                    {editBranchIds.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {editBranchIds.map(id => {
                          const bName = branches.find(b => String(b.id) === String(id))?.name || id;
                          return (
                            <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/15">
                              {bName}
                              <button
                                type="button"
                                onClick={() => setEditBranchIds(prev => prev.filter(x => String(x) !== String(id)))}
                                className="text-primary hover:text-primary transition-colors ml-1"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-xs shadow-md transition-all active:scale-[0.99] mt-2"
                disabled={loading}
              >
                Cập nhật thay đổi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
