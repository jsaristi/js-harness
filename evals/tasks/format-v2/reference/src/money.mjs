import fs from 'node:fs';

/** The currency of a price that does not name one. */
export const DEFAULT_CURRENCY = 'EUR';

/** How many decimals each known currency has, from `data/currencies.json`. */
const currencies = new Map(Object.entries(JSON.parse(fs.readFileSync(new URL('../data/currencies.json', import.meta.url), 'utf8'))));

export const isKnownCurrency = (code) => currencies.has(code);

export const minorUnits = (code) => currencies.get(code);

const DECIMAL = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d{1,3}))?$/i;

/**
 * A price in major units, as the text of a decimal (or a number, which is read as the shortest decimal that gives
 * it back, exponent form included: `1e-7`) as a whole number of the minor units of `currency`, rounded half away
 * from zero. It reads the decimal that is written, so `1.005` is 1.005 and not the binary number nearest to it;
 * that is why it works on the digits of the text. `NaN` when the price is not a non-negative decimal or the
 * currency is not known.
 */
export function toMinor(value, currency) {
  const places = minorUnits(currency);
  const match = DECIMAL.exec(String(value));
  if (places === undefined || match === null) return NaN;
  const [, whole, fraction = '', exponent = '0'] = match;
  const digits = whole + fraction;
  // the minor units are the digits before this point, and the first digit after it decides the rounding
  const point = whole.length + places + Number(exponent);
  const kept = point > 0 ? digits.slice(0, point).padEnd(point, '0') : '0';
  return Number(kept) + ((digits[point] ?? '0') >= '5' ? 1 : 0);
}

/** An amount in minor units written in major units with the decimals of its currency: 1250 EUR is "12.50". */
export function formatMinor(amount, currency) {
  const places = minorUnits(currency);
  if (places === 0) return String(amount);
  const digits = String(amount).padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`;
}

/** What the stock of one item is worth, in the minor units of its currency. */
export const lineValue = (item) => item.price.amount * item.qty;
