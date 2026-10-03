// Validation and normalization of an incoming order.

export class QuoteError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'QuoteError';
    this.code = code;
  }
}

const SERVICES = ['economy', 'standard', 'express'];
const MAX_PARCELS = 20;
const MAX_WEIGHT_KG = 30;
const MAX_SIDE_CM = 200;

/** Postal codes are compared in upper case and without any whitespace. */
export function normalizePostalCode(text) {
  return String(text).replace(/\s+/g, '').toUpperCase();
}

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function checkWeight(parcel) {
  const weightKg = parcel?.weightKg;
  if (!isNumber(weightKg) || weightKg <= 0 || weightKg > MAX_WEIGHT_KG) {
    throw new QuoteError('INVALID_WEIGHT', `weightKg must be above 0 and at most ${MAX_WEIGHT_KG}`);
  }
}

function checkDimensions(parcel) {
  for (const side of ['length', 'width', 'height']) {
    if (!isNumber(parcel[side]) || parcel[side] <= 0 || parcel[side] > MAX_SIDE_CM) {
      throw new QuoteError('INVALID_DIMENSIONS', `${side} must be above 0 and at most ${MAX_SIDE_CM}`);
    }
  }
}

/** Checks an order and returns a normalized copy; throws a QuoteError on the first problem. */
export function parseOrder(input) {
  const { orderDate, service, destination, declaredValue = 0, promoCode = null, parcels } = input ?? {};
  if (!isCalendarDate(orderDate)) throw new QuoteError('INVALID_DATE');
  if (!SERVICES.includes(service)) throw new QuoteError('INVALID_SERVICE');
  if (!/^[A-Z]{2}$/.test(destination?.country) || typeof destination.postalCode !== 'string') {
    throw new QuoteError('INVALID_DESTINATION');
  }
  if (!Number.isInteger(declaredValue) || declaredValue < 0) throw new QuoteError('INVALID_VALUE');
  if (!Array.isArray(parcels) || parcels.length === 0) throw new QuoteError('EMPTY_ORDER');
  if (parcels.length > MAX_PARCELS) throw new QuoteError('TOO_MANY_PARCELS');
  parcels.forEach(checkWeight);
  parcels.forEach(checkDimensions);
  return {
    orderDate,
    service,
    destination: { country: destination.country, postalCode: normalizePostalCode(destination.postalCode) },
    declaredValue,
    promoCode,
    parcels: parcels.map(({ weightKg, length, width, height }) => ({ weightKg, length, width, height })),
  };
}
