import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner, SuccessBanner, Loading } from '../components/Common';

export default function Profile() {
  const { setOwner } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({
    owner_name: '',
    mess_name: '',
    fee_one_time: '',
    fee_two_time: '',
  });
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' });
  const [auditLogs, setAuditLogs] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [pData, aData] = await Promise.all([api.get('/profile'), api.get('/audit-logs?limit=50')]);
      setProfile(pData.profile);
      setProfileForm({
        owner_name: pData.profile.owner_name,
        mess_name: pData.profile.mess_name,
        fee_one_time: pData.profile.fee_one_time ?? '',
        fee_two_time: pData.profile.fee_two_time ?? '',
      });
      setAuditLogs(aData.audit_logs);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      await api.put('/profile', {
        ...profileForm,
        fee_one_time: Number(profileForm.fee_one_time),
        fee_two_time: Number(profileForm.fee_two_time),
      });
      setSuccess('Profile updated');
      setOwner((prev) => ({ ...prev, ...profileForm }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    try {
      await api.put('/profile/password', pwForm);
      setPwSuccess('Password changed successfully');
      setPwForm({ current_password: '', new_password: '' });
    } catch (err) {
      setPwError(err.message);
    }
  }

  if (!profile) return <Loading />;

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-bold text-gray-800 mb-6">⚙️ Profile & Settings</h1>

      <div className="card mb-6">
        <div className="font-medium text-gray-700 mb-1">💰 Mess Fees (monthly)</div>
        <p className="text-sm text-gray-500 mb-4">
          These fees auto-fill when you add a new student. Change them anytime — existing students keep their own fee.
        </p>
        <ErrorBanner message={error} />
        <SuccessBanner message={success} />
        <form onSubmit={handleProfileSave} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700">🍱 1-Time Mess fee (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="input mt-1"
                required
                value={profileForm.fee_one_time}
                onChange={(e) => setProfileForm({ ...profileForm, fee_one_time: e.target.value })}
                placeholder="e.g. 3000"
              />
              <p className="text-xs text-gray-400 mt-1">One meal per day</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">🍽️ 2-Time Mess fee (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="input mt-1"
                required
                value={profileForm.fee_two_time}
                onChange={(e) => setProfileForm({ ...profileForm, fee_two_time: e.target.value })}
                placeholder="e.g. 5000"
              />
              <p className="text-xs text-gray-400 mt-1">Lunch and dinner</p>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Owner Name</label>
            <input className="input mt-1" value={profileForm.owner_name} onChange={(e) => setProfileForm({ ...profileForm, owner_name: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Mess Name</label>
            <input className="input mt-1" value={profileForm.mess_name} onChange={(e) => setProfileForm({ ...profileForm, mess_name: e.target.value })} />
          </div>
          <div className="text-sm text-gray-500">Email: {profile.email} · Mobile: {profile.mobile}</div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : '💾 Save Changes'}</button>
        </form>
      </div>

      <div className="card mb-6">
        <div className="font-medium text-gray-700 mb-4">🔒 Change Password</div>
        <ErrorBanner message={pwError} />
        <SuccessBanner message={pwSuccess} />
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Current Password</label>
            <input type="password" className="input mt-1" required value={pwForm.current_password} onChange={(e) => setPwForm({ ...pwForm, current_password: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">New Password</label>
            <input type="password" className="input mt-1" required minLength={8} value={pwForm.new_password} onChange={(e) => setPwForm({ ...pwForm, new_password: e.target.value })} />
          </div>
          <button type="submit" className="btn-primary">Change Password</button>
        </form>
      </div>

      <div className="card">
        <div className="font-medium text-gray-700 mb-4">Recent Activity (Audit Log)</div>
        {auditLogs.length === 0 && <div className="text-sm text-gray-400">No activity recorded yet</div>}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="text-sm border-b border-gray-50 pb-2">
              <span className="font-medium text-gray-700">{log.action.replace(/_/g, ' ')}</span>
              <span className="text-gray-400"> · {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''} · {log.created_at}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
