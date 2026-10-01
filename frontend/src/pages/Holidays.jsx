import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Loading, ErrorBanner, EmptyState, Modal } from '../components/Common';
import HolidayFormFields from '../components/HolidayFormFields';

export default function Holidays() {
  const [holidays, setHolidays] = useState(null);
  const [students, setStudents] = useState([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ student_id: '', start_date: '', end_date: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [hData, sData] = await Promise.all([api.get('/holidays'), api.get('/students')]);
      setHolidays(hData.holidays);
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

  async function handleAdd(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.post('/holidays', { ...form, student_id: Number(form.student_id) });
      setShowAdd(false);
      setForm({ student_id: '', start_date: '', end_date: '' });
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(h) {
    setEditingId(h.id);
    setForm({ student_id: String(h.student_id), start_date: h.start_date, end_date: h.end_date });
    setFormError('');
    setShowEdit(true);
  }

  async function handleEdit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      await api.put(`/holidays/${editingId}`, { start_date: form.start_date, end_date: form.end_date });
      setShowEdit(false);
      setEditingId(null);
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeHoliday(id) {
    if (!confirm('Remove this holiday? The extended days will be reversed.')) return;
    try {
      await api.del(`/holidays/${id}`);
      load();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800 md:hidden">🏖️ Holidays</h1>
        <button className="btn-primary text-sm ml-auto" onClick={() => setShowAdd(true)}>🏖️ Record Holiday</button>
      </div>

      <ErrorBanner message={error} />
      {!holidays && !error && <Loading />}
      {holidays && holidays.length === 0 && (
        <EmptyState icon="🏖️" title="No holidays recorded yet" />
      )}

      {holidays && holidays.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Start</th>
                <th className="px-4 py-3 font-medium">End</th>
                <th className="px-4 py-3 font-medium">Days</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((h) => (
                <tr key={h.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link to={`/students/${h.student_id}`} className="text-brand-700 font-medium">{studentName(h.student_id)}</Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{h.start_date}</td>
                  <td className="px-4 py-3 text-gray-600">{h.end_date}</td>
                  <td className="px-4 py-3 text-gray-600">{h.number_of_days}</td>
                  <td className="px-4 py-3 space-x-3 whitespace-nowrap">
                    <button className="text-brand-600 text-xs font-semibold hover:underline" onClick={() => openEdit(h)}>Edit</button>
                    <button className="text-red-500 text-xs hover:underline" onClick={() => removeHoliday(h.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Record Holiday">
        <ErrorBanner message={formError} />
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="text-sm font-semibold text-gray-600">Student</label>
            <select className="input mt-1" required value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">Select student…</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <HolidayFormFields form={form} setForm={setForm} />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Record Holiday'}</button>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Holiday Dates">
        <ErrorBanner message={formError} />
        <form onSubmit={handleEdit} className="space-y-3">
          <div className="text-sm text-gray-500 mb-2">
            Student: <span className="font-semibold text-gray-900">{studentName(Number(form.student_id))}</span>
          </div>
          <HolidayFormFields form={form} setForm={setForm} editing />
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Save Changes'}</button>
        </form>
      </Modal>
    </div>
  );
}
