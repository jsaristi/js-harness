import fs from 'node:fs';

/** The currency of a price that does not name one. */
export const DEFAULT_CURRENCY = 'EUR';

/** How many decimals each known currency has, from `data/currencies.json`. */
const currencies = new Map(Object.entries(JSON.parse(fs.readFileSync(new URL('../data/currencies.json', import.meta.url), 'utf8'))));

export const isKnownCurrency = (code) => currencies.has(code);

export const minorUnits = (code) => currencies.get(code);

/**
 * A price in major units (a number, or the text of one) as a whole number of the minor units of `currency`,
 * rounded half away from zero. It reads the decimal that is written, so `1.005` is 1.005 and not the binary
 * number nearest to it; that is why it works on the digits of the text. `NaN` when the price is not a
 * non-negative decimal or the currency is not known.
 */
export function toMinor(value, currency) {
  const places = minorUnits(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (places === undefined || match === null) return NaN;
  const [, whole, fraction = ''] = match;
  const digits = fraction.padEnd(places + 1, '0');
  return Number(whole + digits.slice(0, places)) + (digits[places] >= '5' ? 1 : 0);
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
