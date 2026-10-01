import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, ErrorBanner, EmptyState, Modal } from '../components/Common';
import PaymentFormFields, { todayISO, fmtMoney } from '../components/PaymentFormFields';

const EMPTY_FORM = { student_id: '', amount: '', payment_date: todayISO(), payment_method: 'CASH', note: '' };

export default function Payments() {
  const [payments, setPayments] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [pData, sData] = await Promise.all([api.get('/payments'), api.get('/students')]);
      setPayments(pData.payments);
      setStudents(sData.students);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function studentName(id) {
    const s = students.find((s) => s.id === id);
    return s ? s.name : `#${id}`;
  }

  const selectedStudent = students.find((s) => String(s.id) === String(form.student_id));

  function openAdd() {
    setForm({ ...EMPTY_FORM, payment_date: todayISO() });
    setFormError('');
    setShowAdd(true);
  }

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/payments', {
        ...form,
        student_id: Number(form.student_id),
        amount: Number(form.amount),
      });
      setShowAdd(false);
      setForm({ ...EMPTY_FORM, payment_date: todayISO() });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800 md:hidden">💰 Payments</h1>
        <button className="btn-primary text-sm ml-auto" onClick={openAdd}>💳 Record Payment</button>
      </div>

      <ErrorBanner message={error} />
      {!payments && !error && <Loading />}
      {payments && payments.length === 0 && (
        <EmptyState icon="💳" title="No payments recorded yet" subtitle="Record full or partial payments anytime" />
      )}

      {payments && payments.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/students/${p.student_id}`} className="text-brand-700 font-medium">{studentName(p.student_id)}</Link>
                  </td>
                  <td className="px-4 py-3 font-semibold">{fmtMoney(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.payment_method}</td>
                  <td className="px-4 py-3 text-gray-600">{p.payment_date}</td>
                  <td className="px-4 py-3 text-gray-400">{p.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Payment">
        <ErrorBanner message={formError} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-600">Student</label>
            <select
              className="input mt-1"
              required
              value={form.student_id}
              onChange={(e) => setForm({ ...form, student_id: e.target.value, amount: '' })}
            >
              <option value="">Select student…</option>
              {students.map((s) => {
                const rem = Math.max(0, s.total_fee - s.total_paid);
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} — {rem > 0 ? `${fmtMoney(rem)} due` : 'paid'}
                  </option>
                );
              })}
            </select>
          </div>
          <PaymentFormFields student={selectedStudent} form={form} setForm={setForm} />
          <button
            type="submit"
            disabled={saving || (selectedStudent && selectedStudent.total_fee <= selectedStudent.total_paid)}
            className="btn-primary w-full"
          >
            {saving ? 'Saving…' : 'Record Payment'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
