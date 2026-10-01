import { cleanMobileInput, validateMobile, MOBILE_HINT } from '../utils/mobile';

export default function MobileInput({
  value,
  onChange,
  disabled = false,
  required = false,
  showHint = true,
  id,
}) {
  const check = validateMobile(value);
  const showError = value.length > 0 && !check.valid && check.error !== 'Mobile number is required';

  function handleChange(e) {
    onChange(cleanMobileInput(e.target.value));
  }

  return (
    <div>
      <div className={`flex items-center border rounded overflow-hidden bg-white ${
        showError ? 'border-red-400 ring-1 ring-red-200' : check.valid ? 'border-green-400 ring-1 ring-green-200' : 'border-gray-300'
      }`}>
        <span className="px-3 py-2 text-sm text-gray-500 bg-gray-50 border-r border-gray-200 shrink-0">
          +91
        </span>
        <input
          id={id}
          className="flex-1 px-3 py-2 text-sm focus:outline-none disabled:bg-gray-50"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          maxLength={10}
        />
        {check.valid && (
          <span className="px-2 text-green-600 text-sm" aria-hidden="true">✓</span>
        )}
      </div>
      {showHint && !showError && !check.valid && (
        <p className="text-xs text-gray-400 mt-1">📱 {MOBILE_HINT}</p>
      )}
      {showError && (
        <p className="text-xs text-red-600 mt-1">⚠️ {check.error}</p>
      )}
      {check.valid && showHint && (
        <p className="text-xs text-green-600 mt-1">✓ Valid number: +91 {value}</p>
      )}
    </div>
  );
}

export { validateMobile, MOBILE_HINT };
