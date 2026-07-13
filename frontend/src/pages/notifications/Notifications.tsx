import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from '../../api/notifications';
import { useToastStore } from '../../stores/toastStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { Bell, Check, CheckSquare, MessageSquare, Briefcase, FileText } from 'lucide-react';

const Notifications: React.FC = () => {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (_) {
      addToast('Không thể tải danh sách thông báo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (_) {}
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.is_read) {
      await handleRead(notification.id);
    }
    if (notification.type === 'chat' && notification.action_url) {
      navigate(`../${notification.action_url}`, { relative: 'path' });
    }
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead();
      addToast('Đã đánh dấu đọc toàn bộ thông báo.', 'success');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (_) {
      addToast('Không thể đánh dấu đọc tất cả.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 font-sans">Trung tâm thông báo</h2>
          <p className="text-xs text-slate-500 font-medium">Theo dõi các cập nhật hệ thống, đơn hàng, và phân ca làm việc</p>
        </div>
        {notifications.some(n => !n.is_read) && (
          <button
            onClick={handleReadAll}
            className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-2xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <CheckSquare size={16} />
            Đánh dấu đọc tất cả
          </button>
        )}
      </div>

      {/* Notifications feed */}
      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <EmptyState message="Không có thông báo nào trong 30 ngày qua." />
      ) : (
        <div className="space-y-3 max-w-2xl mx-auto animate-in fade-in duration-200">
          {notifications.map(n => {
            const icons = {
              order: <FileText size={18} className="text-primary" />,
              system: <Bell size={18} className="text-indigo-500" />,
              payroll: <CheckSquare size={18} className="text-emerald-500" />,
              announcement: <Bell size={18} className="text-amber-500" />,
              chat: <MessageSquare size={18} className="text-secondary" />
            }[n.type] || <Bell size={18} className="text-slate-500" />;

            const bgClass = n.is_read ? 'bg-white border-slate-200' : 'bg-primary/10 border-primary/20 shadow-sm';

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-2xl border flex items-start gap-4 transition-all cursor-pointer hover:bg-primary/5 ${bgClass}`}
              >
                <div className="p-2.5 bg-slate-100 rounded-2xl flex-shrink-0">
                  {icons}
                </div>
                
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-xs font-bold ${n.is_read ? 'text-slate-700' : 'text-primary-dark'}`}>{n.title}</h4>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(n.created_at).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{n.content}</p>
                </div>

                {!n.is_read && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
