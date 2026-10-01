import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Loading, ErrorBanner } from '../components/Common';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CARDS = [
  { key: 'active_students', label: 'Active Students', icon: '✅' },
  { key: 'new_students', label: 'New Students', icon: '🆕' },
  { key: 'expired_students', label: 'Expired Students', icon: '❌' },
  { key: 'renewals', label: 'Renewals', icon: '🔄' },
  { key: 'total_collection', label: 'Total Collection', icon: '💰', money: true },
  { key: 'pending_payments', label: 'Pending Payments', icon: '📉', money: true },
  { key: 'total_holiday_days', label: 'Total Holiday Days', icon: '🏖️' },
];

export default function Reports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.get(`/reports/monthly?year=${year}&month=${month}`);
      setReport(data);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, [year, month]);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-6">Monthly Reports</h1>

      <div className="flex gap-3 mb-6">
        <select className="input max-w-[150px]" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select className="input max-w-[120px]" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <ErrorBanner message={error} />
      {!report && !error && <Loading />}

      {report && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CARDS.map((c) => (
            <div key={c.key} className="card">
              <div className="text-2xl mb-1">{c.icon}</div>
              <div className="text-xs text-gray-500">{c.label}</div>
              <div className="text-xl font-bold text-gray-800 mt-1">
                {c.money ? `₹${Number(report[c.key]).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : report[c.key]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
