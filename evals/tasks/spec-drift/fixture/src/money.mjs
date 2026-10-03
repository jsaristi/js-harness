// Money helpers. Every amount in this library is a whole number of cents.

/** `percent` percent of `amountCents`, rounded half up to a whole cent. */
export function percentOf(amountCents, percent) {
  const hundredths = Math.round(percent * 100);
  return Math.floor((amountCents * hundredths + 5000) / 10000);
}

/** Cents as a decimal string with two places: 1234 -> "12.34". */
export function formatMoney(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
