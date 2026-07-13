import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getNotifications, markNotificationRead, Notification } from '../api/notifications';
import { ROLE_NAV } from '../config/roleNav';
import {
  Bell,
  LogOut,
  Menu,
  Search,
  X,
  User as UserIcon
} from 'lucide-react';

const DashboardLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    // Fetch notifications
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [user]);

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifs(data);
    } catch (_) {}
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (_) {}
  };

  const unreadCount = notifs.filter(n => !n.is_read).length;

  const handleLogout = () => {
    const currentRole = user?.role || 'admin';
    logout();
    navigate(`/${currentRole}/login`);
  };

  if (!user) return null;

  // Base path for this role, e.g. "/admin", "/manager", "/staff"
  const base = `/${user.role}`;

  // Sidebar items for the current role (defined once in config/roleNav.tsx)
  const allowedMenuItems = ROLE_NAV[user.role].map(item => ({
    ...item,
    fullPath: `${base}/${item.path}`,
  }));

  // Breadcrumb generation
  const getPageTitle = () => {
    const activeItem = allowedMenuItems.find(item => location.pathname.startsWith(item.fullPath));
    return activeItem ? activeItem.name : 'Hệ thống';
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F5F5] text-[#171717]">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-72 p-4 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full bg-[#111111] text-neutral-300 flex flex-col rounded-[28px] border border-neutral-800 shadow-[0_20px_50px_rgba(0,0,0,0.16)] overflow-hidden">
        {/* Brand Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
          <Link to={base} className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[20px] bg-white flex items-center justify-center font-bold text-[#111111] text-xs shadow-sm relative overflow-hidden">
              <span className="relative z-10 font-mono tracking-tighter">GK</span>
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight text-white block">Giặt Ký</span>
              <span className="text-[9px] uppercase tracking-[0.18em] text-neutral-500 font-bold">Dashboard</span>
            </div>
          </Link>
          <button className="md:hidden text-neutral-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* User Card */}
        <div className="m-4 p-4 rounded-[20px] bg-white/[0.06] border border-white/10 flex items-center gap-3">
          <div className="w-11 h-11 rounded-[20px] bg-white text-neutral-900 border border-white/10 flex items-center justify-center font-bold overflow-hidden shadow-sm relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs">{user.full_name[0].toUpperCase()}</span>
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-bold text-xs truncate text-white leading-tight">{user.full_name}</h4>
            <span className="text-[9px] text-neutral-400 uppercase tracking-widest font-mono font-bold block mt-1">
              {user.role === 'admin' ? 'CHỦ TIỆM' : user.role === 'manager' ? 'QUẢN LÝ' : 'NHÂN VIÊN'}
            </span>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-4 pb-4 space-y-2 overflow-y-auto">
          {allowedMenuItems.map(item => {
            const isActive = location.pathname.startsWith(item.fullPath);
            return (
              <Link
                key={item.fullPath}
                to={item.fullPath}
                className={`flex items-center gap-3 px-4 py-3 rounded-[20px] text-xs font-bold transition-all duration-200 btn-press border ${isActive ? 'bg-white text-[#111111] border-white shadow-sm' : 'border-transparent text-neutral-400 hover:bg-white/10 hover:text-white'}`}
                onClick={() => setSidebarOpen(false)}
              >
                {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement, { strokeWidth: 1.5, size: 16 }) : item.icon}
                <span className="tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-[20px] bg-white/[0.06] hover:bg-red-600 hover:text-white text-neutral-300 border border-white/10 hover:border-red-600 transition-all text-xs font-bold btn-press"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="tracking-tight">Đăng xuất</span>
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar Header */}
        <header className="h-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-30">
          {/* Mobile Sidebar Toggle & Page Title */}
          <div className="flex items-center gap-4 min-w-0">
            <button className="md:hidden p-2 rounded-2xl text-slate-600 hover:bg-slate-100 transition-colors btn-press" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <div className="hidden sm:block min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Dashboard / {user.role}</p>
              <h1 className="text-lg font-bold text-neutral-900 tracking-tight truncate">
                {getPageTitle()}
              </h1>
            </div>
          </div>

          {/* User actions / Notification Bell */}
          <div className="flex items-center gap-3 relative">
            <div className="hidden lg:flex items-center gap-2 w-72 rounded-[20px] bg-white border border-[#E5E7EB] px-4 py-2.5 shadow-sm">
              <Search size={16} strokeWidth={1.5} className="text-neutral-400" />
              <span className="text-xs font-medium text-neutral-400">Tìm kiếm...</span>
            </div>
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifsOpen(!notifsOpen)}
                className="p-3 text-neutral-700 bg-white hover:bg-neutral-100 hover:text-neutral-950 rounded-[20px] relative transition-colors btn-press border border-[#E5E7EB] shadow-sm"
              >
                <Bell size={18} strokeWidth={1.5} />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Overlay */}
              {notifsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifsOpen(false)} />
                  <div className="absolute right-0 mt-3 w-80 bg-white rounded-[24px] shadow-card border border-[#E5E7EB] py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs tracking-tight">Thông báo</h3>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-neutral-900 font-semibold bg-neutral-100 px-2 py-0.5 rounded-full">{unreadCount} chưa đọc</span>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto my-1">
                      {notifs.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">Không có thông báo mới</div>
                      ) : (
                        notifs.slice(0, 10).map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              handleMarkRead(n.id);
                              setNotifsOpen(false);
                            }}
                            className={`px-4 py-2.5 border-b border-slate-50 last:border-b-0 cursor-pointer transition-colors hover:bg-neutral-100 flex flex-col gap-0.5 ${!n.is_read ? 'bg-neutral-100' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className={`text-xs font-semibold ${!n.is_read ? 'text-neutral-950 font-bold' : 'text-slate-700'}`}>{n.title}</h4>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{n.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-2 text-center">
                      <Link
                        to={`${base}/notifications`}
                        onClick={() => setNotifsOpen(false)}
                        className="text-xs text-neutral-900 hover:text-neutral-600 font-semibold inline-block pb-0.5"
                      >
                        Xem tất cả thông báo
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile trigger */}
            <div
              onClick={() => navigate(`${base}/settings`)}
              className="flex items-center gap-2.5 cursor-pointer p-1.5 pr-3 rounded-[20px] bg-white hover:bg-neutral-100 transition-colors btn-press border border-[#E5E7EB] shadow-sm"
            >
              <div className="w-9 h-9 rounded-[20px] bg-neutral-100 text-neutral-900 border border-neutral-200 flex items-center justify-center font-bold overflow-hidden relative">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} strokeWidth={1.5} />
                )}
              </div>
              <span className="text-xs font-bold text-slate-700 hidden md:inline">{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Main Dashboard Panel Page Content */}
        <main className="flex-1 overflow-y-auto px-4 pb-6 sm:px-6 lg:px-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
