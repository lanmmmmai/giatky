import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useToastStore } from '../../stores/toastStore';
import { Lock, ArrowLeft, Key } from 'lucide-react';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToast } = useToastStore();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const token = searchParams.get('token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      addToast('Mã khôi phục không hợp lệ hoặc đã hết hạn.', 'error');
      return;
    }
    if (!password.trim()) {
      addToast('Vui lòng nhập mật khẩu mới.', 'warning');
      return;
    }
    if (password !== confirmPassword) {
      addToast('Mật khẩu nhập lại không khớp.', 'warning');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        token,
        new_password: password
      });
      addToast('Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.', 'success');
      navigate('/login');
    } catch (err: any) {
      addToast(err.response?.data?.detail || 'Đặt lại mật khẩu thất bại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link to="/login" className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <span className="text-sm font-semibold text-slate-500">Quay lại Đăng nhập</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Mật Khẩu Mới</h2>
        <p className="text-xs text-slate-500 font-medium">Nhập mật khẩu mới cho tài khoản của bạn để khôi phục quyền truy cập.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Mật khẩu mới</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all outline-none"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Xác nhận mật khẩu mới</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all outline-none"
              required
              disabled={loading}
            />
          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3.5 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99]"
          disabled={loading}
        >
          <Key size={16} />
          {loading ? 'Đang thực hiện đổi...' : 'Đổi mật khẩu & Đăng nhập'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
