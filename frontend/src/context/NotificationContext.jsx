import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const ICONS = {
  ENDING_TODAY: '⏰',
  ENDING_SOON: '⚠️',
  EXPIRED: '❌',
  PAYMENT_PENDING: '💰',
  HOLIDAY: '🏖️',
};

const POLL_INTERVAL_MS = 30_000;
const SEEN_KEY = 'messdesk_seen_notifications';

function loadSeenIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveSeenIds(ids) {
  sessionStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

function showSystemNotification(notification) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const icon = ICONS[notification.type] || '🔔';
  const n = new Notification('MessDesk', {
    body: notification.message,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: `messdesk-${notification.id}`,
    renotify: true,
    requireInteraction: notification.type === 'ENDING_TODAY' || notification.type === 'EXPIRED',
  });

  n.onclick = () => {
    window.focus();
    n.close();
  };
}

export function NotificationProvider({ children }) {
  const { owner } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const seenRef = useRef(loadSeenIds());
  const isFirstPoll = useRef(true);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== id));
  }, []);

  const addToast = useCallback((notification) => {
    const toastId = `${notification.id}-${Date.now()}`;
    setToasts((prev) => [...prev, { ...notification, toastId }].slice(-4));
    setTimeout(() => dismissToast(toastId), 6000);
  }, [dismissToast]);

  const requestPushPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    const result = await Notification.requestPermission();
    const granted = result === 'granted';
    setPushEnabled(granted);
    if (granted) {
      showSystemNotification({
        id: 'welcome',
        type: 'INFO',
        message: 'Push alerts enabled! You will get pop-ups even when MessDesk is in the background.',
      });
    }
    return granted;
  }, []);

  useEffect(() => {
    if (!owner) return;

    async function poll() {
      try {
        const data = await api.get('/notifications');
        const notifications = data.notifications || [];
        const unread = notifications.filter((n) => !n.is_read);
        setUnreadCount(unread.length);

        if (isFirstPoll.current) {
          unread.forEach((n) => seenRef.current.add(n.id));
          saveSeenIds(seenRef.current);
          isFirstPoll.current = false;
          return;
        }

        const fresh = unread.filter((n) => !seenRef.current.has(n.id));
        for (const n of fresh) {
          seenRef.current.add(n.id);
          if (document.visibilityState === 'visible') {
            addToast(n);
          }
          showSystemNotification(n);
        }
        if (fresh.length) saveSeenIds(seenRef.current);
      } catch {
        // ignore polling errors silently
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [owner, addToast]);

  return (
    <NotificationContext.Provider
      value={{ toasts, dismissToast, unreadCount, pushEnabled, requestPushPermission }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

export { ICONS as NOTIFICATION_ICONS };
