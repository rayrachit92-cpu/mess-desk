export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function fmtMoney(n) {
  return `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Shared payment form with remaining balance, full-pay shortcut, and partial payment support.
 */
export default function PaymentFormFields({ student, form, setForm }) {
  const remaining = student
    ? Math.max(0, round2(student.total_fee - student.total_paid))
    : null;
  const hasBalance = remaining > 0;

  function payFullRemaining() {
    if (remaining == null) return;
    setForm((f) => ({ ...f, amount: String(remaining), note: f.note || 'Full remaining balance' }));
  }

  function setPartialHint() {
    setForm((f) => ({ ...f, note: f.note || 'Partial payment' }));
  }

  return (
    <>
      {student && (
        <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 mb-1 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total fee</span>
            <span className="font-semibold">{fmtMoney(student.total_fee)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Already paid</span>
            <span className="font-semibold text-emerald-700">{fmtMoney(student.total_paid)}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-brand-100 pt-2">
            <span className="font-semibold text-gray-900">Remaining</span>
            <span className={`font-bold ${hasBalance ? 'text-amber-700' : 'text-emerald-700'}`}>
              {fmtMoney(remaining)}
            </span>
          </div>
          {hasBalance && (
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={payFullRemaining}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition"
              >
                Pay full remaining ({fmtMoney(remaining)})
              </button>
              <button
                type="button"
                onClick={setPartialHint}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-brand-200 text-brand-700 hover:bg-brand-50 transition"
              >
                Partial payment
              </button>
            </div>
          )}
          {!hasBalance && (
            <div className="text-xs text-emerald-700 font-medium pt-1">✓ Fully paid — no balance due</div>
          )}
        </div>
      )}

      <div>
        <label className="text-sm font-semibold text-gray-600">
          Amount (₹) {hasBalance && <span className="font-normal text-gray-400">— max {fmtMoney(remaining)}</span>}
        </label>
        <input
          type="number"
          min="0.01"
          max={remaining ?? undefined}
          step="0.01"
          className="input mt-1"
          required
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder={hasBalance ? `e.g. ${Math.min(500, remaining)}` : '0'}
          disabled={student && !hasBalance}
        />
        <div className="text-xs text-gray-400 mt-1">
          Record follow-up payments anytime — next day partial or full remaining is supported.
        </div>
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-600">Payment Date</label>
        <input
          type="date"
          className="input mt-1"
          required
          value={form.payment_date}
          onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
        />
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-600">Method</label>
        <select
          className="input mt-1"
          value={form.payment_method}
          onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
        >
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-semibold text-gray-600">Note (optional)</label>
        <input
          className="input mt-1"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="e.g. Partial payment — UPI ref #123"
        />
      </div>
    </>
  );
}
