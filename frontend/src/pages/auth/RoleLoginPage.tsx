import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getUserBranchOptions, useAuthStore } from '../../stores/authStore';
import { useToastStore } from '../../stores/toastStore';
import { DASHBOARD_PATH } from '../../config/roleNav';
import { Lock, User as UserIcon, LogIn, AlertTriangle, LogOut, ShieldCheck } from 'lucide-react';
import SEO from '../../components/SEO';
import routeSeo from '../../config/routeSeo.json';

interface RoleLoginPageProps {
  role: 'admin' | 'manager' | 'staff';
}

const RoleLoginPage: React.FC<RoleLoginPageProps> = ({ role }) => {
  const navigate = useNavigate();
  const { login, previewLogin, completeLogin, logout, user, token } = useAuthStore();
  const { addToast } = useToastStore();

  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ token: string; user: any } | null>(null);
  const [selectedLoginBranchId, setSelectedLoginBranchId] = useState('');
  const loginButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // If user is already authenticated
  useEffect(() => {
    if (token && user) {
      if (user.role === role) {
        navigate(DASHBOARD_PATH[role], { replace: true });
      }
    }
  }, [token, user, role, navigate]);

  useEffect(() => {
    if (!pendingLogin) return;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancelConfirm();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [cancelButtonRef.current, confirmButtonRef.current].filter(Boolean) as HTMLButtonElement[];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pendingLogin]);

  const getFacilityDisplay = (loginUser: any) => {
    const facilities = loginUser?.facilities || [];
    const assignedBranches = loginUser?.assigned_branches || [];
    if (facilities.length === 1) return facilities[0].name;
    if (facilities.length > 1) return `${facilities.length} cơ sở`;
    if (assignedBranches.length === 1) return assignedBranches[0].branch_name;
    if (assignedBranches.length > 1) return `${assignedBranches.length} cơ sở`;
    if (loginUser?.branch_name) return loginUser.branch_name;
    if (loginUser?.branch_id) return '1 cơ sở';
    return 'Chưa phân công';
  };

  const handleCancelConfirm = () => {
    setPendingLogin(null);
    setSelectedLoginBranchId('');
    setPassword('');
    setConfirming(false);
    window.setTimeout(() => loginButtonRef.current?.focus(), 0);
  };

  const handleConfirmLogin = () => {
    if (!pendingLogin || confirming) return;
    const branchOptions = getUserBranchOptions(pendingLogin.user);
    if (branchOptions.length > 1 && !selectedLoginBranchId) {
      addToast('Vui lòng chọn cơ sở làm việc.', 'warning');
      return;
    }
    setConfirming(true);
    completeLogin(pendingLogin.token, pendingLogin.user, selectedLoginBranchId || branchOptions[0]?.id);
    addToast('Đăng nhập thành công!', 'success');
    navigate(DASHBOARD_PATH.staff, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameOrEmail.trim() || !password.trim()) {
      addToast('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.', 'warning');
      return;
    }

    setLoading(true);
    if (role === 'staff') {
      const result = await previewLogin(usernameOrEmail, password, role);
      setLoading(false);
      if (result.success) {
        if (result.token && result.user) {
          const branchOptions = getUserBranchOptions(result.user);
          setSelectedLoginBranchId(branchOptions.length === 1 ? branchOptions[0].id : '');
          setPendingLogin({ token: result.token, user: result.user });
        } else {
          addToast('Không thể xác nhận phiên đăng nhập. Vui lòng thử lại.', 'error');
        }
      } else {
        addToast(result.message || 'Đăng nhập thất bại.', 'error');
      }
      return;
    }

    const result = await login(usernameOrEmail, password, role);
    setLoading(false);

    if (result.success) {
      addToast('Đăng nhập thành công!', 'success');
      navigate(DASHBOARD_PATH[role], { replace: true });
    } else {
      addToast(result.message || 'Đăng nhập thất bại.', 'error');
    }
  };

  const getRoleDetails = () => {
    switch (role) {
      case 'admin':
        return {
          title: 'Đăng nhập Admin',
          desc: 'Khu vực quản trị hệ thống Giặt Ký',
          placeholder: 'admin / admin@giatky.local'
        };
      case 'manager':
        return {
          title: 'Đăng nhập Manager',
          desc: 'Khu vực quản lý cơ sở Giặt Ký',
          placeholder: 'manager / manager@giatky.local'
        };
      case 'staff':
        return {
          title: 'Đăng nhập Staff',
          desc: 'Khu vực nhân viên Giặt Ký',
          placeholder: 'staff / staff@giatky.local'
        };
    }
  };

  const details = getRoleDetails();
  const seoPath = `/${role}/login`;
  const seo = routeSeo[seoPath as keyof typeof routeSeo];

  if (token && user && user.role !== role) {
    return (
      <div className="text-center space-y-6 max-w-sm mx-auto my-auto p-6">
        <SEO
          title={seo.title}
          description={seo.description}
          path={seoPath}
          image={seo.image}
          imageAlt={seo.imageAlt}
          robots={seo.robots}
        />
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-[20px] flex items-center justify-center mx-auto shadow-sm animate-pulse">
          <AlertTriangle size={28} />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-bold text-slate-800">Xung đột quyền đăng nhập</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Bạn hiện đang đăng nhập với quyền <span className="font-bold text-primary capitalize">{user.role}</span>. 
            Trang này dành riêng cho việc đăng nhập tài khoản <span className="font-bold text-primary capitalize">{role}</span>.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 pt-2">
          <button
            onClick={() => navigate(DASHBOARD_PATH[user.role], { replace: true })}
            className="w-full h-10 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-2xl text-xs font-semibold transition-all btn-press"
          >
            Vào Dashboard {user.role.toUpperCase()}
          </button>
          <button
            onClick={() => {
              logout();
              addToast('Đã đăng xuất tài khoản cũ.', 'info');
            }}
            className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 btn-press"
          >
            <LogOut size={14} />
            Đăng xuất để đăng nhập {role.toUpperCase()}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title={seo.title}
        description={seo.description}
        path={seoPath}
        image={seo.image}
        imageAlt={seo.imageAlt}
        robots={seo.robots}
      />
      {/* Left visual panel */}
      <div 
        className="hidden lg:flex lg:w-[52.5%] relative flex-col justify-between p-12 text-white overflow-hidden"
        style={{
          background: 'radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.18), transparent 34%), radial-gradient(circle at 82% 78%, rgba(255, 255, 255, 0.08), transparent 42%), #111111'
        }}
      >
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

        <div className="relative z-10">
          <span className="px-3.5 py-1.5 bg-white/10 backdrop-blur-md rounded-full text-[9px] font-bold uppercase tracking-[0.2em] text-white border border-white/10 w-fit block">
            Giặt Ký Laundry System
          </span>
        </div>

        <div className="relative z-10 space-y-5">
          <h2 className="text-2xl font-bold tracking-tight leading-tight text-white">
            Hệ thống đăng nhập<br />riêng biệt từng vai trò
          </h2>
          <p className="text-xs text-white/75 font-medium max-w-xs leading-relaxed">
            Đảm bảo tính bảo mật và định tuyến chính xác đến khu vực làm việc của Admin, Quản lý cơ sở và Nhân viên ca trực.
          </p>
        </div>

        <div className="relative z-10 bg-white/12 backdrop-blur-lg border border-white/15 rounded-[20px] p-4 flex items-center gap-3 max-w-sm">
          <div className="w-9 h-9 rounded-2xl bg-white text-primary flex items-center justify-center font-bold text-xs shadow-md">
            GK
          </div>
          <div>
            <h4 className="font-bold text-xs tracking-wide text-white">Giặt Ký</h4>
            <p className="text-[8px] text-white/70 uppercase tracking-widest font-bold mt-0.5">Sạch Thơm Tin Tưởng</p>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="w-full lg:w-[47.5%] bg-white p-8 sm:p-12 flex flex-col justify-between">
        
        {/* Header Branding (Mobile only) */}
        <div className="lg:hidden flex items-center gap-2 pb-6 border-b border-slate-100 mb-6">
          <div className="w-9 h-9 rounded-2xl bg-primary text-white flex items-center justify-center font-black text-xs shadow-md">
            GK
          </div>
          <div>
            <h4 className="font-bold text-xs text-slate-800">Giặt Ký</h4>
            <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold">Sạch Thơm Tin Tưởng</p>
          </div>
        </div>

        <div className="my-auto space-y-6">
          {/* Headline */}
          <div className="space-y-3">
            <div className="hidden lg:flex w-12 h-12 rounded-[20px] bg-primary text-white items-center justify-center font-bold text-base shadow-md">
              GK
            </div>
            <div>
              <h3 className="hidden lg:block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giặt Ký</h3>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-1">{details.title}</h2>
              <p className="text-xs font-semibold text-slate-400 mt-1">{details.desc}</p>
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
                  placeholder={details.placeholder}
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
              ref={loginButtonRef}
              type="submit"
              className="w-full h-11 bg-primary hover:bg-primary-dark disabled:bg-secondary text-white rounded-2xl font-semibold text-xs shadow-sm transition-all btn-press flex items-center justify-center gap-1.5 mt-4 text-center"
              disabled={loading || confirming}
            >
              <LogIn size={13} strokeWidth={1.5} />
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>
        </div>

      </div>

      {pendingLogin && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-login-confirm-title"
            aria-describedby="staff-login-confirm-desc"
            className="w-full max-w-[460px] bg-white rounded-2xl shadow-xl border border-slate-200 p-5 sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <ShieldCheck size={21} strokeWidth={1.7} />
              </div>
              <div className="min-w-0">
                <h3 id="staff-login-confirm-title" className="text-base font-bold text-slate-950">Xác nhận đăng nhập</h3>
                <p id="staff-login-confirm-desc" className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Bạn đang đăng nhập vào hệ thống Staff của Giặt Ký. Vui lòng xác nhận để tiếp tục.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Tài khoản</span>
                <span className="text-slate-900 font-bold text-right truncate">{pendingLogin.user.username || usernameOrEmail}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Họ tên</span>
                <span className="text-slate-900 font-bold text-right truncate">{pendingLogin.user.full_name || '-'}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Vai trò</span>
                <span className="text-slate-900 font-bold text-right">Nhân viên</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Cơ sở</span>
                <span className="text-slate-900 font-bold text-right truncate" title={getFacilityDisplay(pendingLogin.user)}>
                  {getFacilityDisplay(pendingLogin.user)}
                </span>
              </div>
              {getUserBranchOptions(pendingLogin.user).length > 1 && (
                <div className="pt-2 space-y-1.5 border-t border-slate-200">
                  <label className="text-slate-500 font-semibold block">Chọn cơ sở làm việc</label>
                  <select
                    value={selectedLoginBranchId}
                    onChange={(event) => setSelectedLoginBranchId(event.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 outline-none focus:border-primary"
                  >
                    <option value="">Chọn cơ sở</option>
                    {getUserBranchOptions(pendingLogin.user).map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 font-semibold">Thời gian</span>
                <span className="text-slate-900 font-bold text-right">{new Date().toLocaleString('vi-VN')}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleCancelConfirm}
                disabled={confirming}
                className="h-10 px-4 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-colors disabled:opacity-60"
              >
                Hủy
              </button>
              <button
                ref={confirmButtonRef}
                type="button"
                onClick={handleConfirmLogin}
                disabled={confirming || (getUserBranchOptions(pendingLogin.user).length > 1 && !selectedLoginBranchId)}
                className="h-10 px-4 rounded-2xl bg-slate-950 hover:bg-black text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                {confirming ? 'Đang đăng nhập...' : 'Xác nhận đăng nhập'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoleLoginPage;
