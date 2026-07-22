function safeNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export function formatCurrency(value: any): string {
  return `₹${safeNumber(value).toLocaleString("en-IN")}`;
}

export function formatCurrencyFixed(value: any, digits: number = 2): string {
  const n = safeNumber(value);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatNumber(value: any): string {
  return safeNumber(value).toLocaleString("en-IN");
}
