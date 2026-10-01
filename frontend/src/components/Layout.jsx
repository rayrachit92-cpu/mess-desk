import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import ToastStack, { PushPermissionBanner } from './ToastStack';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: '◈' },
  { to: '/students', label: 'Students', icon: '●' },
  { to: '/payments', label: 'Payments', icon: '₹' },
  { to: '/holidays', label: 'Holidays', icon: '☀' },
  { to: '/notifications', label: 'Alerts', icon: '!' , badge: true },
  { to: '/reports', label: 'Reports', icon: '↗' },
  { to: '/profile', label: 'Settings', icon: '⚙' },
];

function NavItem({ item, mobile = false }) {
  const { unreadCount } = useNotifications();
  const showBadge = item.badge && unreadCount > 0;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) => mobile
        ? `relative flex min-w-[64px] flex-col items-center gap-1 px-2 py-1 text-[10px] font-semibold ${isActive ? 'text-brand-700' : 'text-slate-500'}`
        : `group flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-all ${isActive ? 'bg-white/12 text-white shadow-inner' : 'text-emerald-100/70 hover:bg-white/10 hover:text-white'}`}
    >
      <span className={mobile ? 'text-base leading-none' : 'grid h-8 w-8 place-items-center rounded-lg bg-white/8 text-sm'}>{item.icon}</span>
      <span>{item.label}</span>
      {showBadge && <span className={mobile ? 'absolute right-1 top-0 rounded-full bg-amber-400 px-1 text-[9px] text-slate-900' : 'ml-auto rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] text-emerald-950'}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { owner, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const pageTitles = {
    '/': { label: 'Good day', sub: 'Your mess at a glance', icon: '◈' },
    '/students': { label: 'Students', sub: 'Manage your mess community', icon: '●' },
    '/payments': { label: 'Payments', sub: 'Track collections and dues', icon: '₹' },
    '/holidays': { label: 'Holidays', sub: 'Manage meal plan pauses', icon: '☀' },
    '/notifications': { label: 'Alerts', sub: 'Stay on top of important updates', icon: '!' },
    '/reports': { label: 'Reports', sub: 'Understand your mess performance', icon: '↗' },
    '/profile': { label: 'Settings', sub: 'Configure your mess', icon: '⚙' },
  };
  const page = pageTitles[location.pathname] || { label: 'MessDesk', sub: 'Simple mess management', icon: '🍽' };

  return (
    <div className="app-shell min-h-screen flex">
      <ToastStack />
      <aside className="hidden md:flex md:w-[250px] shrink-0 flex-col min-h-screen p-4 sticky top-0 h-screen" style={{background:'linear-gradient(180deg,#0d4e31,#115f3b)'}}>
        <div className="px-3 py-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-xl shadow-lg">🍲</div>
            <div>
              <div className="text-lg font-black tracking-tight text-white">Mess<span className="text-emerald-300">Desk</span></div>
              <div className="text-[11px] text-emerald-100/60 truncate max-w-[155px]">{owner?.mess_name || 'Food made simple'}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1.5">{NAV_ITEMS.map((item) => <NavItem key={item.to} item={item} />)}</nav>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/10 p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-300/15 text-emerald-200 font-bold">{owner?.owner_name?.charAt(0)?.toUpperCase() || 'M'}</div>
            <div className="min-w-0"><div className="text-sm font-semibold text-white truncate">{owner?.owner_name || 'Mess owner'}</div><div className="text-[11px] text-emerald-100/60 truncate">{owner?.email}</div></div>
          </div>
          <button onClick={handleLogout} className="w-full rounded-xl border border-white/10 bg-white/10 py-2 text-xs font-bold text-emerald-50 hover:bg-white/12 transition">↪ Sign out</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-screen pb-16 md:pb-0">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7f8f3]/85 backdrop-blur-xl px-4 md:px-8 py-3.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="md:hidden grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white">🍲</div>
              <div><div className="font-black tracking-tight text-slate-900">{page.label}</div><div className="hidden sm:block text-[11px] text-slate-500">{page.sub}</div></div>
            </div>
            {location.pathname !== '/students' && <button onClick={() => navigate('/students')} className="btn-primary text-xs sm:text-sm">＋ Add student</button>}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-7 lg:p-9 max-w-7xl w-full mx-auto page-enter">
          <PushPermissionBanner />
          {children}
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/92 backdrop-blur-xl border-t border-slate-200 z-50">
        <div className="flex justify-around py-2">{NAV_ITEMS.filter((i) => !['/reports','/profile'].includes(i.to)).map((item) => <NavItem key={item.to} item={item} mobile />)}</div>
      </nav>
    </div>
  );
}
