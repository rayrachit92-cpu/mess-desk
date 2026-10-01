import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications, NOTIFICATION_ICONS } from '../context/NotificationContext';

export default function ToastStack() {
  const { toasts, dismissToast } = useNotifications();
  if (!toasts?.length) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div key={t.toastId} className="bg-white border border-gray-200 rounded shadow-lg p-3 flex gap-3">
          <span className="text-lg">{NOTIFICATION_ICONS[t.type] || '🔔'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900">{t.message}</div>
            <Link to="/notifications" onClick={() => dismissToast(t.toastId)} className="text-xs text-brand-600 hover:underline">
              View all
            </Link>
          </div>
          <button onClick={() => dismissToast(t.toastId)} className="text-gray-400 hover:text-gray-600" aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function PushPermissionBanner() {
  const { pushEnabled, requestPushPermission } = useNotifications();
  const [dismissed, setDismissed] = useState(false);

  if (pushEnabled || dismissed || typeof Notification === 'undefined') return null;
  if (Notification.permission === 'denied') return null;

  return (
    <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 text-sm text-gray-700">
        🔔 Enable browser notifications for expiry and payment alerts.
      </div>
      <div className="flex gap-2">
        <button onClick={() => setDismissed(true)} className="btn-secondary text-sm py-1 px-3">
          Later
        </button>
        <button onClick={requestPushPermission} className="btn-primary text-sm py-1 px-3">
          Enable
        </button>
      </div>
    </div>
  );
}
