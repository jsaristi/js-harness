import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QuoteError,
  baseRateCents,
  billableWeight,
  discountFor,
  formatMoney,
  formatQuote,
  insuranceCents,
  isOversize,
  lookupZone,
  parseOrder,
  percentOf,
  quote,
  selectRateTable,
} from '../src/index.mjs';

const parcel = { weightKg: 7.5, length: 30, width: 20, height: 15 };
const order = (overrides = {}) => ({
  orderDate: '2025-03-15',
  service: 'standard',
  destination: { country: 'DE', postalCode: '10115' },
  parcels: [parcel],
  ...overrides,
});

test('percentOf rounds half up', () => {
  assert.equal(percentOf(25, 10), 3);
  assert.equal(percentOf(910, 8), 73);
  assert.equal(percentOf(1050, 8.5), 89);
});

test('formatMoney writes two decimals', () => {
  assert.equal(formatMoney(1234), '12.34');
  assert.equal(formatMoney(5), '0.05');
  assert.equal(formatMoney(-5), '-0.05');
});

test('parseOrder fills in the optional fields', () => {
  const parsed = parseOrder(order());
  assert.equal(parsed.declaredValue, 0);
  assert.equal(parsed.promoCode, null);
  assert.equal(parsed.destination.postalCode, '10115');
});

test('parseOrder rejects an unknown service', () => {
  assert.throws(() => parseOrder(order({ service: 'overnight' })), { code: 'INVALID_SERVICE' });
});

test('parseOrder rejects a date that does not exist', () => {
  assert.throws(() => parseOrder(order({ orderDate: '2025-02-30' })), { code: 'INVALID_DATE' });
});

test('parseOrder rejects an order without parcels', () => {
  assert.throws(() => parseOrder(order({ parcels: [] })), { code: 'EMPTY_ORDER' });
});

test('parseOrder rejects a parcel above the maximum weight', () => {
  assert.throws(() => parseOrder(order({ parcels: [{ ...parcel, weightKg: 30 }] })), (error) => {
    return error instanceof QuoteError && error.code === 'INVALID_WEIGHT';
  });
});

test('lookupZone finds a plain destination', () => {
  assert.deepEqual(lookupZone('DE', '10115'), { zone: '1', remote: false });
});

test('lookupZone rejects a country without a zone', () => {
  assert.throws(() => lookupZone('XX', '1000'), { code: 'NO_ZONE' });
});

test('billableWeight rounds to the nearest half kilo', () => {
  assert.equal(billableWeight({ weightKg: 2.2, length: 20, width: 10, height: 10 }), 2);
});

test('billableWeight keeps an exact weight', () => {
  assert.equal(billableWeight(parcel), 7.5);
});

test('baseRateCents picks the band of the weight', () => {
  const table = selectRateTable('2025-03-15');
  assert.equal(baseRateCents(table, '1', 5.5), 910);
  assert.equal(baseRateCents(table, '1', 0.5), 490);
});

test('selectRateTable returns the table in force', () => {
  assert.equal(selectRateTable('2025-03-15').effective, '2025-01-01');
});

test('isOversize tells small parcels from long ones', () => {
  assert.equal(isOversize(parcel), false);
  assert.equal(isOversize({ length: 130, width: 20, height: 20 }), true);
});

test('insuranceCents is free up to the threshold', () => {
  assert.equal(insuranceCents(10000), 0);
  assert.equal(insuranceCents(100000), 900);
});

test('discountFor gives the volume discount by tier', () => {
  const at = (parcelCount) => discountFor({ baseCents: 10000, parcelCount, promoCode: null, orderDate: '2025-03-15' });
  assert.deepEqual(at(4), { cents: 0, source: null });
  assert.deepEqual(at(5), { cents: 500, source: 'volume' });
  assert.deepEqual(at(10), { cents: 1000, source: 'volume' });
});

test('quote prices a standard shipment', () => {
  const result = quote(order());
  assert.equal(result.baseCents, 910);
  assert.deepEqual(result.surcharges, { fuel: 73, remote: 0, oversize: 0, insurance: 0 });
  assert.equal(result.taxCents, 187);
  assert.equal(result.totalCents, 1170);
});

test('formatQuote lists the charges and the total', () => {
  assert.equal(formatQuote(quote(order())), 'Base: 9.10 EUR\nFuel: 0.73 EUR\nTax: 1.87 EUR\nTotal: 11.70 EUR');
});
