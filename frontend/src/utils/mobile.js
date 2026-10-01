/** Indian mobile helpers — 10 digits starting with 6–9. */

export const MOBILE_HINT = 'Enter 10-digit Indian mobile (starts with 6, 7, 8, or 9)';

/** Keep only digits, max 10 (strips +91 / 91 if user pastes full number). */
export function cleanMobileInput(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

export function validateMobile(value) {
  const normalized = cleanMobileInput(value);
  if (!normalized) {
    return { valid: false, error: 'Mobile number is required', normalized: '' };
  }
  if (normalized.length < 10) {
    const left = 10 - normalized.length;
    return { valid: false, error: `Enter ${left} more digit${left === 1 ? '' : 's'}`, normalized };
  }
  if (!/^[6-9]/.test(normalized)) {
    return { valid: false, error: 'Indian mobile must start with 6, 7, 8, or 9', normalized };
  }
  return { valid: true, error: '', normalized };
}

export function formatMobileDisplay(value) {
  const d = cleanMobileInput(value);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}
