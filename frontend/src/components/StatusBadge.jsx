const LABELS = {
  ACTIVE: '✅ Active',
  ENDING_SOON: '⚠️ Ending soon',
  EXPIRED: '❌ Expired',
  ON_HOLIDAY: '🏖️ On holiday',
};

export default function StatusBadge({ status }) {
  return <span className={`status-badge status-${status}`}>{LABELS[status] || status}</span>;
}
