export default function HolidayFormFields({ form, setForm, editing = false }) {
  return (
    <>
      <div>
        <label className="text-sm font-semibold text-gray-600">Holiday Start Date</label>
        <input
          type="date"
          className="input mt-1"
          required
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-600">Holiday End Date</label>
        <input
          type="date"
          className="input mt-1"
          required
          value={form.end_date}
          onChange={(e) => setForm({ ...form, end_date: e.target.value })}
        />
      </div>
      <div className="text-xs text-gray-400">
        {editing
          ? 'Changing dates will automatically adjust the student\'s subscription end date.'
          : 'The subscription end date will be extended automatically.'}
      </div>
    </>
  );
}
