import fs from 'node:fs';

/** The currency of a price that does not name one. */
export const DEFAULT_CURRENCY = 'EUR';

/** How many decimals each known currency has, from `data/currencies.json`. */
const currencies = new Map(Object.entries(JSON.parse(fs.readFileSync(new URL('../data/currencies.json', import.meta.url), 'utf8'))));

export const isKnownCurrency = (code) => currencies.has(code);

export const minorUnits = (code) => currencies.get(code);

/** An amount in major units written with the decimals of its currency: `12.5` EUR is "12.50". */
export const formatAmount = (amount, currency) => amount.toFixed(minorUnits(currency));

/** What the stock of one item is worth. */
export const lineValue = (item) => item.price * item.qty;
