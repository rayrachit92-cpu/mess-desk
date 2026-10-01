import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, ErrorBanner, Modal, ConfirmDialog } from '../components/Common';
import PaymentFormFields, { todayISO } from '../components/PaymentFormFields';
import HolidayFormFields from '../components/HolidayFormFields';
import MobileInput from '../components/MobileInput';
import { validateMobile } from '../utils/mobile';
import { MEAL_PLAN_LABELS } from '../utils/mealPlans';
import StatusBadge from '../components/StatusBadge';

export default function StudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState(null);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showHoliday, setShowHoliday] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', mobile: '' });
  const [showHolidayEdit, setShowHolidayEdit] = useState(false);
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_date: todayISO(), payment_method: 'CASH', note: '' });
  const [holidayForm, setHolidayForm] = useState({ start_date: '', end_date: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const data = await api.get(`/students/${id}`);
      setStudent(data.student);
      setEditForm({ name: data.student.name, mobile: data.student.mobile });
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleEdit(e) {
    e.preventDefault();
    setFormError('');
    const mobileCheck = validateMobile(editForm.mobile);
    if (!mobileCheck.valid) {
      setFormError(mobileCheck.error);
      return;
    }
    setSaving(true);
    try {
      await api.put(`/students/${id}`, { ...editForm, mobile: mobileCheck.normalized });
      setShowEdit(false);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/students/${id}`);
      navigate('/students');
    } catch (err) {
      setError(err.message);
      setShowDelete(false);
    }
  }

  async function handlePayment(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/payments', {
        student_id: Number(id),
        amount: Number(paymentForm.amount),
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method,
        note: paymentForm.note,
      });
      setShowPayment(false);
      setPaymentForm({ amount: '', payment_date: todayISO(), payment_method: 'CASH', note: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleHoliday(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/holidays', { student_id: Number(id), ...holidayForm });
      setShowHoliday(false);
      setHolidayForm({ start_date: '', end_date: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function voidPayment(paymentId) {
    if (!confirm('Void this payment?')) return;
    try {
      await api.del(`/payments/${paymentId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleHolidayEdit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.put(`/holidays/${editingHolidayId}`, holidayForm);
      setShowHolidayEdit(false);
      setEditingHolidayId(null);
      setHolidayForm({ start_date: '', end_date: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openHolidayEdit(h) {
    setEditingHolidayId(h.id);
    setHolidayForm({ start_date: h.start_date, end_date: h.end_date });
    setFormError('');
    setShowHolidayEdit(true);
  }

  async function removeHoliday(holidayId) {
    if (!confirm('Remove this holiday? The extended days will be reversed.')) return;
    try {
      await api.del(`/holidays/${holidayId}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <ErrorBanner message={error} />;
  if (!student) return <Loading />;

  return (
    <div>
      <Link to="/students" className="text-sm text-brand-600 mb-4 inline-block">← Back to Students</Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{student.name}</h1>
          <div className="text-sm text-gray-500">{student.mobile}</div>
          <div className="text-xs text-brand-600 font-semibold mt-1">
            {MEAL_PLAN_LABELS[student.meal_plan] || student.meal_plan}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={student.status} />
          <button className="btn-secondary text-sm" onClick={() => setShowEdit(true)}>Edit</button>
          <button className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50" onClick={() => setShowDelete(true)}>Left mess</button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="text-xs text-gray-500 mb-2">Mess Information</div>
          <div className="text-sm space-y-1">
            <div>Start: <span className="font-medium">{student.start_date}</span></div>
            <div>Original End: <span className="font-medium">{student.original_end_date}</span></div>
            <div>Current End: <span className="font-medium">{student.current_end_date}</span></div>
            <div>Plan: <span className="font-medium">{student.plan_days} days</span></div>
            <div>Mess type: <span className="font-medium">{MEAL_PLAN_LABELS[student.meal_plan] || student.meal_plan}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-2">Payment Information</div>
          <div className="text-sm space-y-1">
            <div>Total Fee: <span className="font-medium">₹{student.total_fee.toLocaleString('en-IN')}</span></div>
            <div>Total Paid: <span className="font-medium">₹{student.total_paid.toLocaleString('en-IN')}</span></div>
            <div>Remaining: <span className="font-medium">₹{student.remaining_amount.toLocaleString('en-IN')}</span></div>
          </div>
          <button className="btn-primary text-sm mt-3 w-full" onClick={() => { setPaymentForm({ amount: '', payment_date: todayISO(), payment_method: 'CASH', note: '' }); setShowPayment(true); }}>💳 Record Payment</button>
        </div>
        <div className="card">
          <div className="text-xs text-gray-500 mb-2">Holiday Information</div>
          <div className="text-sm space-y-1">
            <div>Total Holiday Days: <span className="font-medium">{student.total_holiday_days}</span></div>
          </div>
          <button className="btn-primary text-sm mt-3 w-full" onClick={() => setShowHoliday(true)}>🏖️ Record Holiday</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card">
          <div className="font-medium text-gray-700 mb-3">Payment History</div>
          {student.payments.length === 0 && <div className="text-sm text-gray-400">No payments yet</div>}
          <div className="space-y-2">
            {student.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <div className="font-medium">₹{p.amount.toLocaleString('en-IN')} · {p.payment_method}</div>
                  <div className="text-gray-400 text-xs">{p.payment_date}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
                <button className="text-red-500 text-xs hover:underline" onClick={() => voidPayment(p.id)}>Void</button>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="font-medium text-gray-700 mb-3">Holiday History</div>
          {student.holidays.length === 0 && <div className="text-sm text-gray-400">No holidays recorded</div>}
          <div className="space-y-2">
            {student.holidays.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                <div>
                  <div className="font-medium">{h.start_date} → {h.end_date}</div>
                  <div className="text-gray-400 text-xs">{h.number_of_days} days added</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button className="text-brand-600 text-xs font-semibold hover:underline" onClick={() => openHolidayEdit(h)}>Edit</button>
                  <button className="text-red-500 text-xs hover:underline" onClick={() => removeHoliday(h.id)}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Student">
        <ErrorBanner message={formError} />
        <form onSubmit={handleEdit} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Name</label>
            <input className="input mt-1" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">📱 Mobile</label>
            <div className="mt-1">
              <MobileInput
                value={editForm.mobile}
                onChange={(v) => setEditForm({ ...editForm, mobile: v })}
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </form>
      </Modal>

      <Modal open={showPayment} onClose={() => setShowPayment(false)} title="💳 Record Payment">
        <ErrorBanner message={formError} />
        <form onSubmit={handlePayment} className="space-y-3">
          <PaymentFormFields student={student} form={paymentForm} setForm={setPaymentForm} />
          <button
            type="submit"
            disabled={saving || student.remaining_amount <= 0}
            className="btn-primary w-full"
          >
            {saving ? 'Saving…' : '💳 Record Payment'}
          </button>
        </form>
      </Modal>

      <Modal open={showHoliday} onClose={() => setShowHoliday(false)} title="🏖️ Record Holiday">
        <ErrorBanner message={formError} />
        <form onSubmit={handleHoliday} className="space-y-3">
          <HolidayFormFields form={holidayForm} setForm={setHolidayForm} />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : '🏖️ Record Holiday'}</button>
        </form>
      </Modal>

      <Modal open={showHolidayEdit} onClose={() => setShowHolidayEdit(false)} title="Edit Holiday Dates">
        <ErrorBanner message={formError} />
        <form onSubmit={handleHolidayEdit} className="space-y-3">
          <HolidayFormFields form={holidayForm} setForm={setHolidayForm} editing />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={showDelete}
        title="Remove student who left mess?"
        message={`Remove ${student.name} from your mess? Their records are kept but they won't appear in your active student list.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
