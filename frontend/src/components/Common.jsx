export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2 mb-4">
      ⚠️ {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="bg-green-50 border border-green-200 text-green-800 text-sm rounded px-3 py-2 mb-4">
      ✅ {message}
    </div>
  );
}

export function EmptyState({ icon = '📭', title, subtitle }) {
  return (
    <div className="card text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-medium text-gray-900">{title}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-gray-500 text-sm">
      Loading… ⏳
    </div>
  );
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = true }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-gray-600 mb-4">{message}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button
          className={danger ? 'px-4 py-2 rounded font-medium bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}
          onClick={onConfirm}
        >
          Confirm
        </button>
      </div>
    </Modal>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StudentAvatar({ name }) {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-xs font-medium flex items-center justify-center shrink-0">
      {name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}
