import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, ErrorBanner, EmptyState, Modal, ConfirmDialog, StudentAvatar } from '../components/Common';
import MobileInput from '../components/MobileInput';
import StatusBadge from '../components/StatusBadge';
import { MEAL_PLAN_LABELS, MEAL_PLAN_HINTS, mealPlanFee, messFeesConfigured, fmtFee } from '../utils/mealPlans';
import { validateMobile } from '../utils/mobile';

const EMPTY_FORM = {
  name: '',
  mobile: '',
  start_date: '',
  plan_days: 30,
  meal_plan: 'ONE_TIME',
  total_fee: '',
  amount_paid: '0',
};

function parseMessFees(profile) {
  return {
    fee_one_time: Number(profile.fee_one_time) || 0,
    fee_two_time: Number(profile.fee_two_time) || 0,
  };
}

export default function Students() {
  const [students, setStudents] = useState(null);
  const [messFees, setMessFees] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadMessFees() {
    try {
      const p = await api.get('/profile');
      return parseMessFees(p.profile);
    } catch {
      return null;
    }
  }

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get(`/students?${params.toString()}`);
      setStudents(data.students);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadMessFees().then(setMessFees);
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  async function openAdd() {
    setFormError('');
    const fees = await loadMessFees();
    setMessFees(fees);
    const oneTime = mealPlanFee(fees, 'ONE_TIME');
    setForm({
      ...EMPTY_FORM,
      meal_plan: 'ONE_TIME',
      total_fee: oneTime != null ? String(oneTime) : '',
    });
    setShowAdd(true);
  }

  function setMealPlan(plan) {
    const fee = mealPlanFee(messFees, plan);
    setForm((f) => ({
      ...f,
      meal_plan: plan,
      total_fee: fee != null ? String(fee) : f.total_fee,
    }));
  }

  async function handleAdd(e) {
    e.preventDefault();
    const mobileCheck = validateMobile(form.mobile);
    if (!mobileCheck.valid) {
      setFormError(mobileCheck.error);
      return;
    }
    if (!form.total_fee || Number(form.total_fee) <= 0) {
      setFormError('Set a valid mess fee, or update your default fees in Settings.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await api.post('/students', {
        ...form,
        mobile: mobileCheck.normalized,
        plan_days: Number(form.plan_days),
        total_fee: Number(form.total_fee),
        amount_paid: Number(form.amount_paid || 0),
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.del(`/students/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e) {
      setError(e.message);
      setDeleteTarget(null);
    }
  }

  const feesMissing = messFees && !messFeesConfigured(messFees);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="md:hidden">
          <h2 className="text-lg font-semibold text-gray-900">👥 Students</h2>
          <p className="text-xs text-gray-500">{students?.length ?? 0} enrolled</p>
        </div>
        <button className="btn-primary text-sm ml-auto" onClick={openAdd}>
          ➕ Add Student
        </button>
      </div>

      {feesMissing && (
        <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-900">
          ⚠️ Your mess fees are not set yet (showing ₹0).{' '}
          <Link to="/profile" className="font-semibold underline">
            Go to Settings
          </Link>{' '}
          to set 1-Time and 2-Time monthly fees — they auto-fill when adding students.
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <input
          className="input sm:max-w-xs !bg-white"
          placeholder="🔍  Search by name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:max-w-[180px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ENDING_SOON">Ending soon</option>
          <option value="EXPIRED">Expired</option>
          <option value="ON_HOLIDAY">On holiday</option>
        </select>
      </div>

      <ErrorBanner message={error} />
      {!students && !error && <Loading />}
      {students && students.length === 0 && (
        <EmptyState icon="🎓" title="No students yet" subtitle="Add your first student to get started" />
      )}

      {students && students.length > 0 && (
        <div className="table-shell">
          <table className="w-full">
            <thead>
              <tr>
                <th>Student</th>
                <th>Plan</th>
                <th>Mobile</th>
                <th>Ends</th>
                <th>Due</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <StudentAvatar name={s.name} />
                      <Link to={`/students/${s.id}`} className="font-medium text-gray-900 hover:text-brand-600">
                        {s.name}
                      </Link>
                    </div>
                  </td>
                  <td>
                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 text-xs font-bold">
                      {MEAL_PLAN_LABELS[s.meal_plan] || s.meal_plan}
                    </span>
                  </td>
                  <td className="text-slate-600 font-medium">{s.mobile}</td>
                  <td className="text-slate-600">{s.current_end_date}</td>
                  <td className="font-bold text-gray-900">₹{s.remaining_amount.toLocaleString('en-IN')}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <button
                      className="text-rose-500 text-xs font-bold hover:underline whitespace-nowrap"
                      onClick={() => setDeleteTarget(s)}
                    >
                      👋 Left mess
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="➕ Add Student">
        <ErrorBanner message={formError} />
        {feesMissing && (
          <div className="mb-4 p-3 rounded border border-amber-200 bg-amber-50 text-sm text-amber-900">
            Set your default mess fees in{' '}
            <Link to="/profile" className="font-semibold underline" onClick={() => setShowAdd(false)}>
              Settings
            </Link>{' '}
            first, or enter the fee manually below.
          </div>
        )}
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-600">Name</label>
            <input className="input mt-1" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">📱 Mobile Number</label>
            <div className="mt-1">
              <MobileInput
                value={form.mobile}
                onChange={(v) => setForm({ ...form, mobile: v })}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Mess type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {['ONE_TIME', 'TWO_TIME'].map((plan) => {
                const fee = mealPlanFee(messFees, plan);
                return (
                  <button
                    key={plan}
                    type="button"
                    onClick={() => setMealPlan(plan)}
                    className={`rounded-xl border p-3 text-left transition ${
                      form.meal_plan === plan
                        ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-500/30'
                        : 'border-slate-200 hover:border-brand-200'
                    }`}
                  >
                    <div className="text-sm font-bold text-gray-900">{MEAL_PLAN_LABELS[plan]}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{MEAL_PLAN_HINTS[plan]}</div>
                    <div className="text-xs font-semibold text-brand-700 mt-1">
                      {fee != null ? fmtFee(fee) : 'Not set — update in Settings'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Mess Start Date</label>
            <input type="date" className="input mt-1" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Plan Duration (days)</label>
            <input type="number" min="1" className="input mt-1" required value={form.plan_days} onChange={(e) => setForm({ ...form, plan_days: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Total Mess Fee (₹)</label>
            <input type="number" min="0" step="0.01" className="input mt-1" required value={form.total_fee} onChange={(e) => setForm({ ...form, total_fee: e.target.value })} />
            <div className="text-xs text-gray-400 mt-1">Auto-filled from your Settings fees — you can adjust for this student.</div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-600">Amount Paid Now (₹)</label>
            <input type="number" min="0" step="0.01" className="input mt-1" value={form.amount_paid} onChange={(e) => setForm({ ...form, amount_paid: e.target.value })} />
          </div>
          <div className="text-xs text-gray-400">End date is calculated automatically from start date + plan duration.</div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Saving…' : 'Add Student'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove student who left mess?"
        message={`Remove ${deleteTarget?.name} from your mess? Their payment and holiday history is kept for records but they won't appear in your active list.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
