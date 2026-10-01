import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/Common';
import MobileInput from '../components/MobileInput';
import { validateMobile } from '../utils/mobile';

const EMPTY = { owner_name:'', mess_name:'', mobile:'', email:'', password:'', fee_one_time:'', fee_two_time:'' };

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [form,setForm]=useState(EMPTY); const [error,setError]=useState(''); const [loading,setLoading]=useState(false);
  async function handleSubmit(e){e.preventDefault();setError('');const mobileCheck=validateMobile(form.mobile);if(!mobileCheck.valid){setError(mobileCheck.error);return;}setLoading(true);try{await register(form);await login(form.email,form.password);navigate('/')}catch(err){setError(err.message)}finally{setLoading(false)}}
  function update(field){return e=>setForm({...form,[field]:e.target.value})}
  return <div className="auth-shell">
    <section className="auth-art">
      <div className="auth-bowl" style={{top:'9%',right:'7%'}} />
      <div className="food-orb" style={{left:'11%',top:'13%'}}>🥬</div><div className="food-orb" style={{left:'33%',top:'58%',animationDelay:'-2s'}}>🌶️</div>
      <div className="auth-copy"><div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.16em] text-emerald-50">Start your mess journey</div><h1 className="mt-5 text-4xl md:text-6xl font-black tracking-[-.055em] leading-[.95]">Your kitchen.<br/><span className="text-emerald-200">Your rhythm.</span></h1><p className="mt-5 max-w-lg text-sm leading-6 text-emerald-50/75">Set up your mess once. MessDesk takes care of the everyday details.</p></div>
    </section>
    <section className="auth-form-side"><div className="auth-card max-h-[92vh] overflow-y-auto">
      <div className="auth-logo"><span className="auth-logo-mark">🍲</span><span>Mess<span className="text-emerald-700">Desk</span></span></div>
      <div className="mt-7"><h2 className="text-2xl font-black tracking-tight text-slate-900">Create your mess</h2><p className="mt-1 text-sm text-slate-500">A few details and you’re ready to go.</p></div>
      <ErrorBanner message={error}/>
      <form onSubmit={handleSubmit} className="space-y-3.5 mt-5">
        <div className="grid sm:grid-cols-2 gap-3"><div><label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Owner name</label><input className="input mt-1.5" value={form.owner_name} onChange={update('owner_name')} required placeholder="Your name"/></div><div><label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Mess name</label><input className="input mt-1.5" value={form.mess_name} onChange={update('mess_name')} required placeholder="e.g. Annapurna Mess"/></div></div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div className="text-sm font-black text-slate-900">Monthly meal plans</div><p className="text-xs text-slate-500 mt-1 mb-3">These become your default fees when adding students.</p><div className="grid grid-cols-2 gap-3"><div><label className="text-[11px] font-bold text-slate-600">1-Time (₹)</label><input type="number" min="1" step="0.01" className="input mt-1" value={form.fee_one_time} onChange={update('fee_one_time')} required placeholder="3000"/></div><div><label className="text-[11px] font-bold text-slate-600">2-Time (₹)</label><input type="number" min="1" step="0.01" className="input mt-1" value={form.fee_two_time} onChange={update('fee_two_time')} required placeholder="5000"/></div></div></div>
        <div><label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Mobile</label><div className="mt-1.5"><MobileInput value={form.mobile} onChange={(v)=>setForm({...form,mobile:v})} required/></div></div>
        <div><label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Gmail</label><input type="email" className="input mt-1.5" value={form.email} onChange={update('email')} required placeholder="you@gmail.com" pattern="[a-z0-9._%+\\-]+@gmail\\.com" title="Must be a @gmail.com address"/></div>
        <div><label className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Password</label><input type="password" className="input mt-1.5" value={form.password} onChange={update('password')} required minLength={8} placeholder="At least 8 characters"/></div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-1">{loading?'Creating your workspace…':'Create my mess →'}</button>
      </form>
      <div className="soft-divider my-5"/><p className="text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-bold text-emerald-700">Sign in</Link></p>
    </div></section>
  </div>
}
