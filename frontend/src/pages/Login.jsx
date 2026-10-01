import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/Common';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email_or_mobile: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function handleSubmit(e) { e.preventDefault(); setError(''); setLoading(true); try { await login(form.email_or_mobile.trim(), form.password); navigate('/'); } catch (err) { setError(err.message); } finally { setLoading(false); } }

  return <div className="auth-shell">
    <section className="auth-art">
      <div className="auth-bowl" />
      <div className="food-orb" style={{left:'12%',top:'14%'}}>🥕</div><div className="food-orb" style={{left:'28%',top:'48%',animationDelay:'-2s'}}>🍅</div>
      <div className="auth-copy">
        <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-50">Mess management, made human</div>
        <h1 className="mt-5 text-4xl md:text-6xl font-black tracking-[-.055em] leading-[.95]">Run the mess.<br/><span className="text-emerald-200">Enjoy the meal.</span></h1>
        <p className="mt-5 max-w-lg text-sm leading-6 text-emerald-50/75">A beautifully simple workspace for students, subscriptions, payments, holidays and daily mess operations.</p>
      </div>
    </section>
    <section className="auth-form-side">
      <div className="auth-card">
        <div className="auth-logo"><span className="auth-logo-mark">🍲</span><span>Mess<span className="text-emerald-700">Desk</span></span></div>
        <div className="mt-8"><h2 className="text-2xl font-black tracking-tight text-slate-900">Welcome back</h2><p className="mt-1 text-sm text-slate-500">Sign in to keep your mess running smoothly.</p></div>
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div><label className="text-xs font-bold uppercase tracking-wider text-slate-600">Email or mobile</label><input className="input mt-1.5" value={form.email_or_mobile} onChange={(e)=>setForm({...form,email_or_mobile:e.target.value})} required autoFocus placeholder="you@gmail.com or 9876543210" /></div>
          <div><div className="flex justify-between"><label className="text-xs font-bold uppercase tracking-wider text-slate-600">Password</label></div><input type="password" className="input mt-1.5" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required placeholder="Enter your password" /></div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">{loading ? 'Signing you in…' : 'Sign in →'}</button>
        </form>
        <div className="soft-divider my-6" />
        <p className="text-center text-sm text-slate-500">New to MessDesk? <Link to="/register" className="font-bold text-emerald-700 hover:text-emerald-800">Create an account</Link></p>
      </div>
    </section>
  </div>;
}
