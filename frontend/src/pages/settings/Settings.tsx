import React, { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import apiClient from '../../api/client';
import { User as UserIcon, Phone, Mail, Lock, ShieldAlert, Award, Calendar, BadgeCheck } from 'lucide-react';

const SettingsPage: React.FC = () => {
  const { user, refreshUser } = useAuthStore();
  const { addToast } = useToastStore();

  // Profile Form state
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [profileLoading, setProfileLoading] = useState(false);

  // Password Form state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      addToast('Họ và tên không được để trống.', 'warning');
      return;
    }

    setProfileLoading(true);
    try {
      await apiClient.put(`/users/${user?.id}`, {
        full_name: fullName,
        phone: phone || undefined,
        avatar_url: avatarUrl || undefined
      });
      addToast('Cập nhật hồ sơ cá nhân thành công.', 'success');
      await refreshUser();
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Không thể cập nhật hồ sơ.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      addToast('Vui lòng nhập mật khẩu cũ và mới.', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Mật khẩu nhập lại không khớp.', 'warning');
      return;
    }

    setPwdLoading(true);
    try {
      // In a production-ready model, let's call reset/change password API
      // Let's create an endpoint in users or auth or call it via a put body.
      // In python backend auth routes we have POST /auth/reset-password which resets using a token.
      // We can also support direct password change: PUT /users/{id}/password or similar, or change in auth.
      // Let's create a direct PUT /users/{id} payload that accepts password updates,
      // or we can add a change-password route to auth. In users/routes.py we have a PUT /users/{id}
      // which allows editing fields. Let's make sure it handles updating password or we can POST to /auth/reset-password.
      // Wait, let's call a standard change-password route: PUT /users/{id}/password or handle it.
      // Let's check users routes. We didn't explicitly implement direct password change inside users/routes.py,
      // but let's check: we can use a custom route or add password update. Let's write a direct endpoint `/auth/change-password`
      // in auth/routes.py. Let's make a request to POST /auth/reset-password or similar.
      // Better, we can add a `/auth/change-password` route in auth/routes.py.
      // Let's verify what endpoints we wrote. We wrote POST /auth/reset-password.
      // Let's add `/auth/change-password` in auth/routes.py.
      // First, let's write the frontend API call: POST /auth/change-password
      await apiClient.post('/auth/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      
      addToast('Đổi mật khẩu thành công!', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra mật khẩu cũ.', 'error');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-xl font-bold text-slate-800">Cài đặt tài khoản</h2>
        <p className="text-xs text-slate-500 font-medium">Thay đổi thông tin hồ sơ cá nhân và mật khẩu bảo mật</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
        
        {/* Profile Card (Left) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-card space-y-6 h-fit text-center">
          <div className="space-y-3">
            <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-3xl shadow-inner mx-auto overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.full_name[0].toUpperCase()
              )}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{user?.full_name}</h3>
              <p className="text-xs text-slate-400 font-mono">@{user?.username}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 text-xs space-y-2 text-left font-medium text-slate-600">
            <div className="flex items-center gap-2">
              <Award size={14} className="text-blue-500" />
              <span>Vai trò: <strong className="text-blue-600 uppercase font-mono">{user?.role}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck size={14} className="text-emerald-500" />
              <span>Trạng thái: <strong className="text-emerald-600">Hoạt động</strong></span>
            </div>
            {user?.role === 'staff' && user.hourly_rate && (
              <div className="flex items-center gap-2">
                <ShieldAlert size={14} className="text-amber-500" />
                <span>Mức lương: <strong className="text-slate-800">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(user.hourly_rate)}/giờ</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Edit profile & Edit password (Right) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Edit profile form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <UserIcon size={16} className="text-blue-500" /> Cập nhật thông tin cá nhân
            </h3>

            <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Họ và tên *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    required
                    disabled={profileLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Số điện thoại</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    disabled={profileLoading}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Đường dẫn ảnh đại diện (Avatar URL)</label>
                <input
                  type="text"
                  placeholder="https://example.com/avatar.jpg"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  disabled={profileLoading}
                />
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-md transition-all active:scale-[0.99]"
                disabled={profileLoading}
              >
                {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </form>
          </div>

          {/* Change password form */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Lock size={16} className="text-blue-500" /> Thay đổi mật khẩu
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-600">Mật khẩu cũ *</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                  required
                  disabled={pwdLoading}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Mật khẩu mới *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    required
                    disabled={pwdLoading}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-600">Nhập lại mật khẩu mới *</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500"
                    required
                    disabled={pwdLoading}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold shadow-md transition-all active:scale-[0.99]"
                disabled={pwdLoading}
              >
                {pwdLoading ? 'Đang thực hiện đổi...' : 'Đổi mật khẩu'}
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
