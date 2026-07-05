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
    logout();
    navigate('/login');
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
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar for Desktop */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-blue-50 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Logo */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <Link to={base} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-lg shadow-md">L</div>
            <span className="font-bold text-lg tracking-wider text-blue-100">LÀNH SẠCH</span>
          </Link>
          <button className="md:hidden text-blue-200 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-b border-white/10 bg-sidebar-dark flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold overflow-hidden shadow-inner">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              user.full_name[0].toUpperCase()
            )}
          </div>
          <div className="overflow-hidden">
            <h4 className="font-semibold text-sm truncate text-white">{user.full_name}</h4>
            <span className="text-xs text-blue-200 uppercase tracking-widest font-mono">
              {user.role === 'admin' ? 'CHỦ TIỆM' : user.role === 'manager' ? 'QUẢN LÝ' : 'NHÂN VIÊN'}
            </span>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {allowedMenuItems.map(item => {
            const isActive = location.pathname.startsWith(item.fullPath);
            return (
              <Link
                key={item.fullPath}
                to={item.fullPath}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-blue-100/80 hover:bg-white/10 hover:text-white'}`}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer info & Logout */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-red-600 text-blue-100 hover:text-white transition-colors text-sm font-medium"
          >
            <LogOut size={18} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Topbar Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shadow-sm">
          {/* Mobile Sidebar Toggle & Page Title */}
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">
              {getPageTitle()}
            </h1>
          </div>

          {/* User actions / Notification Bell */}
          <div className="flex items-center gap-4 relative">
            {/* Notification Bell Dropdown */}
            <div className="relative">
              <button
                onClick={() => setNotifsOpen(!notifsOpen)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-full relative transition-colors"
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Overlay */}
              {notifsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 text-sm">Thông báo gần đây</h3>
                      {unreadCount > 0 && (
                        <span className="text-xs text-blue-600 font-medium">{unreadCount} tin chưa đọc</span>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-400">Không có thông báo mới nào</div>
                      ) : (
                        notifs.slice(0, 10).map(n => (
                          <div
                            key={n.id}
                            onClick={() => {
                              handleMarkRead(n.id);
                              setNotifsOpen(false);
                            }}
                            className={`px-4 py-3 border-b border-slate-50 last:border-b-0 cursor-pointer transition-colors hover:bg-slate-50 flex flex-col gap-0.5 ${!n.is_read ? 'bg-blue-50/50' : ''}`}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className={`text-xs font-semibold ${!n.is_read ? 'text-blue-800' : 'text-slate-700'}`}>{n.title}</h4>
                              <span className="text-[10px] text-slate-400">
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="border-t border-slate-100 pt-2 text-center">
                      <Link
                        to={`${base}/notifications`}
                        onClick={() => setNotifsOpen(false)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-block pb-1"
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
              className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold overflow-hidden shadow-inner">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="profile" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={16} />
                )}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden md:inline">{user.full_name}</span>
            </div>
          </div>
        </header>

        {/* Main Dashboard Panel Page Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
