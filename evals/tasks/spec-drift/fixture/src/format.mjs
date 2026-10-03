// A plain-text breakdown of a quote.
import { formatMoney } from './money.mjs';

/** One line per charge: `<label>: <amount> EUR`. */
export function formatQuote(result) {
  const { surcharges } = result;
  const optional = [
    ['Fuel', surcharges.fuel],
    ['Remote area', surcharges.remote],
    ['Oversize', surcharges.oversize],
    ['Insurance', surcharges.insurance],
    ['Discount', -result.discountCents],
  ].filter(([, cents]) => cents !== 0);
  const lines = [['Base', result.baseCents], ...optional, ['Tax', result.taxCents], ['Total', result.totalCents]];
  return lines.map(([label, cents]) => `${label}: ${formatMoney(cents)} EUR`).join('\n');
}
