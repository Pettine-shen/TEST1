const budgetKeys = ["damage", "cc", "mobility", "proc", "perf"];

export function zeroBudget() {
  return { damage: 0, cc: 0, mobility: 0, proc: 0, perf: 0 };
}

export function addBudget(a, b) {
  const out = {};
  for (const k of budgetKeys) out[k] = (a[k] || 0) + (b[k] || 0);
  return out;
}

export function sumBudgets(ops, base = zeroBudget()) {
  let total = { ...base };
  for (const op of ops) {
    if (op.budget) total = addBudget(total, op.budget);
  }
  return total;
}

export function assertWithinCaps(total, cap) {
  for (const k of budgetKeys) {
    if ((total[k] || 0) > (cap[k] || 0)) {
      throw new Error(`budget ${k} exceeds cap: ${total[k]} > ${cap[k]}`);
    }
  }
}
