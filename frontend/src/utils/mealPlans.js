export const MEAL_PLAN_LABELS = {
  ONE_TIME: '🍱 1-Time Mess',
  TWO_TIME: '🍽️ 2-Time Mess',
};

export const MEAL_PLAN_HINTS = {
  ONE_TIME: 'One meal per day (lunch or dinner)',
  TWO_TIME: 'Two meals per day (lunch and dinner)',
};

export function mealPlanFee(messFees, mealPlan) {
  if (!messFees) return null;
  const fee = mealPlan === 'TWO_TIME' ? messFees.fee_two_time : messFees.fee_one_time;
  const num = Number(fee);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function messFeesConfigured(messFees) {
  return mealPlanFee(messFees, 'ONE_TIME') != null || mealPlanFee(messFees, 'TWO_TIME') != null;
}

export function fmtFee(amount) {
  if (amount == null) return '—';
  return `₹${Number(amount).toLocaleString('en-IN')}`;
}
