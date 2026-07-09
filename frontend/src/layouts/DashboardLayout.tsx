import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { getNotifications, markNotificationRead, Notification } from '../api/notifications';
import { ROLE_NAV } from '../config/roleNav';
import {
  Bell,
  LogOut,
  Menu,
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
    <div className="flex h-screen bg-slate-50/50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-slate-400 flex flex-col border-r border-slate-800/40 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800/60">
          <Link to={base} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-[0_4px_12px_rgba(37,99,235,0.3)] relative overflow-hidden">
              <span className="relative z-10 font-mono tracking-tighter">GK</span>
            </div>
            <span className="font-semibold text-xs tracking-[0.2em] text-slate-100">GIẶT KÝ</span>
          </Link>
          <button className="md:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-slate-800/60 bg-slate-950/20 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-200 border border-slate-700/50 flex items-center justify-center font-bold overflow-hidden shadow-inner relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs">{user.full_name[0].toUpperCase()}</span>
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-xs truncate text-slate-200 leading-tight">{user.full_name}</h4>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-mono font-medium block mt-1">
              {user.role === 'admin' ? 'CHỦ TIỆM' : user.role === 'manager' ? 'QUẢN LÝ' : 'NHÂN VIÊN'}
            </span>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
          {allowedMenuItems.map(item => {
            const isActive = location.pathname.startsWith(item.fullPath);
            return (
              <Link
                key={item.fullPath}
                to={item.fullPath}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 btn-press border ${isActive ? 'bg-blue-600 text-white border-blue-500 shadow-[0_4px_12px_rgba(37,99,235,0.25)]' : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                onClick={() => setSidebarOpen(false)}
              >
                {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement, { strokeWidth: 1.5, size: 16 }) : item.icon}
                <span className="tracking-tight">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-slate-800/60">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/30 hover:bg-rose-950/20 hover:text-rose-400 text-slate-400 border border-slate-800 hover:border-rose-900/30 transition-all text-xs font-medium btn-press"
          >
            <LogOut size={16} strokeWidth={1.5} />
            <span className="tracking-tight">Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar Header */}
        <header className="h-16 glass flex items-center justify-between px-6 z-30 border-b border-slate-200/60">
          {/* Mobile Sidebar Toggle & Page Title */}
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors btn-press" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} strokeWidth={1.5} />
            </button>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight hidden sm:block">
              {getPageTitle()}
            </h1>
          </div>

          {/* User actions / Notification Bell */}
          <div className="flex items-center gap-4 relative">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifsOpen(!notifsOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl relative transition-colors btn-press"
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
                  <div className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-slate-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-xs tracking-tight">Thông báo</h3>
                      {unreadCount > 0 && (
                        <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full">{unreadCount} chưa đọc</span>
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
                            className={`px-4 py-2.5 border-b border-slate-50 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50/50 flex flex-col gap-0.5 ${!n.is_read ? 'bg-blue-50/30' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className={`text-xs font-semibold ${!n.is_read ? 'text-blue-900 font-bold' : 'text-slate-700'}`}>{n.title}</h4>
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
                        className="text-xs text-blue-600 hover:text-blue-800 font-semibold inline-block pb-0.5"
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
              className="flex items-center gap-2.5 cursor-pointer p-1 rounded-xl hover:bg-slate-100 transition-colors btn-press"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold overflow-hidden shadow-inner relative">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={14} strokeWidth={1.5} />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700 hidden md:inline">{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Main Dashboard Panel Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
