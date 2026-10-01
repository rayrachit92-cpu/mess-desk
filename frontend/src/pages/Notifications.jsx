import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Loading, ErrorBanner, EmptyState } from '../components/Common';
import { NOTIFICATION_ICONS, useNotifications } from '../context/NotificationContext';

const TYPE_STYLES = {
  ENDING_TODAY: 'border-l-orange-500 bg-orange-50/50',
  ENDING_SOON: 'border-l-amber-500 bg-amber-50/50',
  EXPIRED: 'border-l-red-500 bg-red-50/50',
  PAYMENT_PENDING: 'border-l-brand-500 bg-brand-50/50',
  HOLIDAY: 'border-l-sky-500 bg-sky-50/50',
};

export default function Notifications() {
  const [notifications, setNotifications] = useState(null);
  const [error, setError] = useState('');
  const { pushEnabled, requestPushPermission } = useNotifications();

  async function load() {
    try {
      const data = await api.get('/notifications');
      setNotifications(data.notifications);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function markRead(id) {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {
      setError(e.message);
    }
  }

  const unreadCount = notifications ? notifications.filter((n) => !n.is_read).length : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4 md:hidden">
        <div />
        {unreadCount > 0 && (
          <button className="btn-secondary text-sm" onClick={markAllRead}>✅ Mark all read</button>
        )}
      </div>

      {!pushEnabled && typeof Notification !== 'undefined' && Notification.permission !== 'denied' && (
        <div className="mb-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-brand-800">
            <span className="font-bold">📱 Phone alerts off.</span> Enable pop-ups to get notified when the app is in the background.
          </div>
          <button onClick={requestPushPermission} className="btn-primary text-xs shrink-0 py-2 px-3">
            Enable
          </button>
        </div>
      )}

      <div className="hidden md:flex items-center justify-end mb-4">
        {unreadCount > 0 && (
          <button className="btn-secondary text-sm" onClick={markAllRead}>✅ Mark all read ({unreadCount})</button>
        )}
      </div>

      <ErrorBanner message={error} />
      {!notifications && !error && <Loading />}
      {notifications && notifications.length === 0 && (
        <EmptyState icon="🔔" title="No notifications" subtitle="You're all caught up!" />
      )}

      <div className="space-y-3">
        {notifications && notifications.map((n) => (
          <div
            key={n.id}
            className={`card border-l-4 ${TYPE_STYLES[n.type] || 'border-l-brand-400'} ${
              n.is_read ? 'opacity-55' : 'shadow-card-hover'
            } transition-all`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-lg shadow-sm shrink-0">
                {NOTIFICATION_ICONS[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 leading-snug">{n.message}</div>
                <div className="text-xs text-gray-400 mt-1.5">{n.created_at}</div>
              </div>
              {!n.is_read && (
                <button
                  className="text-xs text-brand-600 font-bold hover:underline whitespace-nowrap shrink-0"
                  onClick={() => markRead(n.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
