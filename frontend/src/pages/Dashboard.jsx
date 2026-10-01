import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, ErrorBanner } from '../components/Common';

const CARDS = [
  { key: 'total_students', label: 'Total students', icon: '●' },
  { key: 'active_students', label: 'Active today', icon: '✓' },
  { key: 'ending_today', label: 'Ending today', icon: '◷' },
  { key: 'ending_soon', label: 'Ending soon', icon: '!' },
  { key: 'expired', label: 'Expired plans', icon: '×' },
  { key: 'on_holiday', label: 'On holiday', icon: '☀' },
  { key: 'total_fees', label: 'Total fees', icon: '₹', money: true },
  { key: 'total_collected', label: 'Collected', icon: '↗', money: true },
  { key: 'total_remaining', label: 'Remaining', icon: '◌', money: true },
];

function fmt(value, money) {
  if (money) return `₹${Number(value || 0).toLocaleString('en-IN')}`;
  return Number(value || 0).toLocaleString('en-IN');
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/dashboard').then(setData).catch((e) => setError(e.message)); }, []);

  return (
    <div className="space-y-6">
      <section className="dashboard-hero">
        <div className="hero-grid" />
        <div className="food-orb one">🍛</div><div className="food-orb two">🥗</div><div className="food-orb three">🍚</div>
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-emerald-50 mb-5">Today at your mess</div>
          <h1 className="text-3xl md:text-4xl font-black tracking-[-.04em] leading-tight">Good food. Happy students.<br/><span className="text-emerald-200">One simple dashboard.</span></h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/75">See your people, payments and meal plans in one calm place—without the spreadsheet chaos.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link to="/students" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-lg hover:-translate-y-0.5 transition">View students →</Link><Link to="/payments" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15 transition">Check payments</Link></div>
        </div>
      </section>

      <ErrorBanner message={error} />
      {!data && !error && <Loading />}
      {data && <>
        <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">Mess pulse</p><h2 className="mt-1 text-xl font-black tracking-tight text-slate-900">Everything important, at a glance</h2></div><span className="hidden sm:inline text-xs text-slate-400">Live from your mess records</span></div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {CARDS.map((c, i) => <div key={c.key} className="card stat-card" style={{animationDelay:`${i*35}ms`}}><div className="stat-icon text-sm font-black">{c.icon}</div><div className="mt-4 text-xs font-semibold text-slate-500">{c.label}</div><div className="stat-value mt-1 text-slate-900">{fmt(data[c.key], c.money)}</div></div>)}
        </div>
        <div className="grid lg:grid-cols-[1.4fr_.6fr] gap-5">
          <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-5 bg-gradient-to-br from-white to-emerald-50/70">
            <div><div className="text-sm font-black text-slate-900">Keep the mess moving</div><p className="mt-1 text-sm text-slate-500 max-w-md">Add a student, record a payment, or pause a meal plan in just a few clicks.</p></div>
            <div className="flex gap-2 shrink-0"><Link to="/students" className="btn-primary text-xs">+ Student</Link><Link to="/payments" className="btn-secondary text-xs">Payment</Link></div>
          </div>
          <div className="card bg-slate-900 text-white border-slate-900"><div className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">Tip</div><div className="mt-2 text-lg font-black">A little organization tastes good.</div><div className="mt-2 text-xs leading-5 text-slate-300">Keep student plans and payments updated to make reports more useful.</div></div>
        </div>
      </>}
    </div>
  );
}
