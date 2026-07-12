import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { DASHBOARD_PATH } from '../../config/roleNav';
import { Lock, User as UserIcon, LogIn, Chrome } from 'lucide-react';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuthStore();
  const { addToast } = useToastStore();
  
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      addToast('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.', 'warning');
      return;
    }

    setLoading(true);
    const result = await login(usernameOrEmail, password, 'admin');
    setLoading(false);

    if (result.success) {
      addToast('Đăng nhập thành công!', 'success');
      const role = useAuthStore.getState().user?.role;
      navigate(role ? DASHBOARD_PATH[role] : '/');
    } else {
      addToast(result.message || 'Đăng nhập thất bại.', 'error');
    }
  };

  const handleMockGoogleLogin = async () => {
    const email = prompt("Vui lòng nhập Email Google để kiểm thử:");
    if (!email) return;
    
    setLoading(true);
    const result = await loginWithGoogle(email);
    setLoading(false);
    
    if (result.success) {
      addToast('Đăng nhập bằng Google thành công!', 'success');
      const role = useAuthStore.getState().user?.role;
      navigate(role ? DASHBOARD_PATH[role] : '/');
    } else {
      addToast(result.message || 'Đăng nhập Google thất bại.', 'error');
    }
  };

  return (
    <>
      {/* Left visual panel */}
      <div 
        className="hidden lg:flex lg:w-[52.5%] relative flex-col justify-between p-12 text-white overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.24), transparent 34%), radial-gradient(circle at 82% 78%, rgba(155, 140, 255, 0.34), transparent 42%), #6C63FF'
        }}
      >
        {/* Soft abstract decorative lines */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Top: Branding Tag */}
        <div className="relative z-10">
          <span className="px-3.5 py-1.5 bg-white/5 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-secondary border border-white/5 w-fit block">
            Laundry Management System
          </span>
        </div>

        {/* Center/Middle: Intro Text and Badges */}
        <div className="relative z-10 space-y-5">
          <h2 className="text-3xl font-bold tracking-tight leading-tight text-white">
            Quản lý tiệm giặt<br />thông minh & tối ưu
          </h2>
          <p className="text-xs text-white/75 font-medium max-w-xs leading-relaxed">
            Theo dõi đơn hàng, quản lý nhân viên, chấm công ca trực và phân tích báo cáo doanh thu trong một nền tảng hợp nhất.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-bold text-white border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Đơn hàng realtime
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-bold text-white border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Chấm công chính xác
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-[9px] font-bold text-white border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Báo cáo doanh thu
            </span>
          </div>
        </div>

        {/* Bottom: Slogan Card */}
        <div className="relative z-10 bg-white/12 backdrop-blur-lg border border-white/15 rounded-[20px] p-4 flex items-center gap-3 max-w-sm">
          <div className="w-9 h-9 rounded-2xl bg-white text-primary flex items-center justify-center font-bold text-xs shadow-md">
            L
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-wide text-white">Giặt Ký</h4>
            <p className="text-[8px] text-white/70 uppercase tracking-widest font-bold mt-0.5">Sạch Thơm Tin Tưởng</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-[47.5%] bg-white p-8 sm:p-12 flex flex-col justify-between">
        
        {/* Header Branding (Visible on Mobile only) */}
        <div className="lg:hidden flex items-center gap-2 pb-6 border-b border-slate-100 mb-6">
          <div className="w-9 h-9 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-md">
            L
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">Giặt Ký</h4>
            <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Sạch Thơm Tin Tưởng</p>
          </div>
        </div>

        <div className="my-auto space-y-6">
          {/* Logo & Headline */}
          <div className="space-y-3">
            <div className="hidden lg:flex w-12 h-12 rounded-[20px] bg-primary text-white items-center justify-center font-bold text-base shadow-md shadow-primary/20">
              L
            </div>
            <div>
              <h3 className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giặt Ký</h3>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">Đăng nhập hệ thống</h2>
              <p className="text-xs font-semibold text-slate-400 mt-1">Hệ thống quản lý chuyên nghiệp, tinh gọn</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tên đăng nhập hoặc Email
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} strokeWidth={1.5} />
                <input
                  type="text"
                  placeholder="admin / admin@lanhsach.com"
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-xs transition-all outline-none"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Mật khẩu
                </label>
                <Link to="/forgot-password" className="text-[10px] text-primary hover:underline font-semibold">
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} strokeWidth={1.5} />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-2xl text-xs transition-all outline-none"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-semibold text-xs shadow-[0_12px_26px_rgba(108,99,255,0.24)] transition-all btn-press flex items-center justify-center gap-1.5 mt-2"
              disabled={loading}
            >
              <LogIn size={13} strokeWidth={1.5} />
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="border-t border-slate-100 w-full"></div>
            <span className="absolute bg-white px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hoặc</span>
          </div>

          {/* Google Button */}
          <button
            onClick={handleMockGoogleLogin}
            type="button"
            className="w-full h-11 border border-slate-200 hover:bg-primary/5 text-slate-600 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all btn-press"
            disabled={loading}
          >
            <Chrome size={14} className="text-red-500" strokeWidth={1.5} />
            Tiếp tục với Google
          </button>
        </div>

        {/* Footnote */}
        <div className="text-center pt-6 lg:pt-0">
          <p className="text-[11px] text-slate-400 font-medium">
            Nhân viên mới?{' '}
            <Link to="/register" className="text-primary hover:underline font-semibold">
              Gửi yêu cầu đăng ký ca
            </Link>
          </p>
        </div>

      </div>
    </>
  );
};

export default Login;
