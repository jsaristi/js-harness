// Hidden grader of `spec-drift`. Copied into the workspace as `.eval-grader/` after the agent exits, so
// `..` is the workspace. Every test imports the library itself, so a broken module fails tests one by one
// and the score stays fractional. Each test names the clause of docs/SPEC.md it checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const load = () => import('../src/index.mjs');
const T = { timeout: 5000 };

// Parcels are 20 x 15 x 10 unless said otherwise: a volumetric weight of 0.6 kg, below any weight used here.
const parcel = (weightKg, length = 20, width = 15, height = 10) => ({ weightKg, length, width, height });
const order = (overrides = {}) => ({
  orderDate: '2025-03-15',
  service: 'standard',
  destination: { country: 'DE', postalCode: '10115' },
  parcels: [parcel(7.5)],
  ...overrides,
});
const sha256 = (path) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

// ---- 4.1 volumetric divisor -------------------------------------------------------------------------

// SPEC 4.1: length x width x height / 5000
test('volumetric weight divides the volume by 5000', T, async () => {
  const { volumetricWeight } = await load();
  assert.equal(volumetricWeight({ length: 50, width: 40, height: 30 }), 12);
  assert.equal(volumetricWeight({ length: 60, width: 50, height: 40 }), 24);
});

// SPEC 4.1, 4.2, 8.2: a bulky light parcel is billed on its volume
test('a quote bills a bulky parcel on its volumetric weight', T, async () => {
  const { quote } = await load();
  const result = quote(order({ parcels: [parcel(1, 50, 40, 30)] }));
  assert.equal(result.parcels[0].billableKg, 12);
});

// ---- 4.2 rounding up --------------------------------------------------------------------------------

// SPEC 4.2: rounded up to the next multiple of 0.5 kg (2.2 -> 2.5, 3.1 -> 3.5)
test('billable weight rounds up to the next half kilo', T, async () => {
  const { billableWeight } = await load();
  assert.equal(billableWeight(parcel(2.2)), 2.5);
  assert.equal(billableWeight(parcel(3.1)), 3.5);
  assert.equal(billableWeight(parcel(0.7)), 1);
});

// SPEC 4.2, 8.2
test('a quote reports the rounded-up billable weight', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ parcels: [parcel(4.2)] })).parcels[0].billableKg, 4.5);
});

// ---- 3.1 postal code normalization ------------------------------------------------------------------

// SPEC 3.1: upper case and every whitespace character removed
test('postal codes lose all whitespace and are upper-cased', T, async () => {
  const { normalizePostalCode } = await load();
  assert.equal(normalizePostalCode(' sw1a 1aa '), 'SW1A1AA');
  assert.equal(normalizePostalCode('75\t008'), '75008');
});

// SPEC 2.3, 3.1
test('parseOrder returns the normalized postal code', T, async () => {
  const { parseOrder } = await load();
  const parsed = parseOrder(order({ destination: { country: 'GB', postalCode: 'bt2 7ab' } }));
  assert.equal(parsed.destination.postalCode, 'BT27AB');
});

// ---- 3.2 longest prefix -----------------------------------------------------------------------------

// SPEC 3.2, 3.3: DE 18439 matches "" and "18"; FR 20100 matches "" and "20"
test('the longest matching prefix decides the zone (DE, FR)', T, async () => {
  const { lookupZone } = await load();
  assert.deepEqual(lookupZone('DE', '18439'), { zone: '1', remote: true });
  assert.deepEqual(lookupZone('FR', '20100'), { zone: '3', remote: true });
});

// SPEC 3.2, 3.3
test('the longest matching prefix decides the zone (GB, US)', T, async () => {
  const { lookupZone } = await load();
  assert.deepEqual(lookupZone('GB', 'BT27AB'), { zone: '3', remote: true });
  assert.deepEqual(lookupZone('US', '99501'), { zone: '4', remote: true });
});

// SPEC 3.3, 6.2, 8.2: the zone and the remote-area charge of a quote come from the longest prefix
test('a quote to a remote postal code carries the zone and the remote charge', T, async () => {
  const { quote } = await load();
  const remote = quote(order({ destination: { country: 'DE', postalCode: '18439' } }));
  assert.equal(remote.surcharges.remote, 1400);
  const corsica = quote(order({ destination: { country: 'FR', postalCode: '20100' } }));
  assert.equal(corsica.zone, '3');
  assert.equal(corsica.surcharges.remote, 1400);
});

// ---- 5.3 band limits --------------------------------------------------------------------------------

// SPEC 5.3: the upper limit belongs to its band
test('a weight on a band limit is priced in that band', T, async () => {
  const { baseRateCents, selectRateTable } = await load();
  const table = selectRateTable('2025-03-15');
  assert.equal(baseRateCents(table, '1', 5), 700);
  assert.equal(baseRateCents(table, '1', 10), 910);
  assert.equal(baseRateCents(table, '3', 2), 1230);
  assert.equal(baseRateCents(table, '4', 20), 4930);
});

// SPEC 4.3, 5.3, 8.2
test('a quote prices parcels on a band limit in that band', T, async () => {
  const { quote } = await load();
  const result = quote(order({ parcels: [parcel(5), parcel(10)] }));
  assert.deepEqual(result.parcels.map((entry) => entry.rateCents), [700, 910]);
});

// ---- 5.2 rate table in force ------------------------------------------------------------------------

// SPEC 5.2: a table is in force from its effective date inclusive
test('a table is in force on its effective date', T, async () => {
  const { selectRateTable } = await load();
  assert.equal(selectRateTable('2025-07-01').effective, '2025-07-01');
  assert.equal(selectRateTable('2025-01-01').effective, '2025-01-01');
  assert.equal(selectRateTable('2024-01-01').effective, '2024-01-01');
});

// SPEC 5.2, 8.2: 2025-07-01, zone 1, band up to 10 kg is 960
test('a quote on a cutover day uses the new table', T, async () => {
  const { quote } = await load();
  const result = quote(order({ orderDate: '2025-07-01' }));
  assert.equal(result.tableEffective, '2025-07-01');
  assert.equal(result.parcels[0].rateCents, 960);
});

// ---- 6.1 fuel basis ---------------------------------------------------------------------------------

// SPEC 6.1, 8.3: fuel is 8% of the base charge alone; base 1320, so 106 (not 8% of base plus oversize)
test('fuel on a standard shipment ignores the oversize charge', T, async () => {
  const { quote } = await load();
  const result = quote(order({ parcels: [parcel(16, 130, 30, 20)] }));
  assert.equal(result.baseCents, 1320);
  assert.equal(result.surcharges.oversize, 2500);
  assert.equal(result.surcharges.fuel, 106);
});

// SPEC 6.1, 8.3: base 2 x 1320 x 150% = 3960; fuel 12% of 3960 = 475
test('fuel on an express shipment ignores the oversize charges', T, async () => {
  const { quote } = await load();
  const result = quote(order({ service: 'express', parcels: [parcel(14, 150, 20, 20), parcel(14, 150, 20, 20)] }));
  assert.equal(result.baseCents, 3960);
  assert.equal(result.surcharges.oversize, 5000);
  assert.equal(result.surcharges.fuel, 475);
});

// ---- 6.3 oversize in any orientation ----------------------------------------------------------------

// SPEC 6.3: 30 x 125 x 10 is oversize, its longest side is 125
test('a parcel whose width is the longest side can be oversize', T, async () => {
  const { isOversize } = await load();
  assert.equal(isOversize({ length: 30, width: 125, height: 10 }), true);
  assert.equal(isOversize({ length: 10, width: 30, height: 125 }), true);
});

// SPEC 6.3: 20 x 100 x 70 has a girth of 280; the dimensions may come in any order
test('the girth is measured from the longest side whatever the order', T, async () => {
  const { isOversize } = await load();
  assert.equal(isOversize({ length: 20, width: 100, height: 70 }), false);
  assert.equal(isOversize({ length: 70, width: 20, height: 100 }), false);
});

// SPEC 6.3, 8.2
test('a quote charges oversize for a parcel whose width is the longest side', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ parcels: [parcel(3, 30, 125, 10)] })).surcharges.oversize, 2500);
});

// ---- 6.4 insurance minimum --------------------------------------------------------------------------

// SPEC 6.4: 10500 gives 300; the part above 10000 would only cost 5
test('insurance is never less than 300 once it applies', T, async () => {
  const { insuranceCents } = await load();
  assert.equal(insuranceCents(10500), 300);
  assert.equal(insuranceCents(15000), 300);
});

// SPEC 6.4, 8.2
test('a quote with a small declared value pays the minimum insurance', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ declaredValue: 12000 })).surcharges.insurance, 300);
});

// ---- 7.3 discounts do not stack ---------------------------------------------------------------------

// SPEC 7.3: 5 parcels give 500, SPRING10 gives 1000; only the larger applies
test('a better promo replaces the volume discount', T, async () => {
  const { discountFor } = await load();
  const result = discountFor({ baseCents: 10000, parcelCount: 5, promoCode: 'SPRING10', orderDate: '2025-03-15' });
  assert.deepEqual(result, { cents: 1000, source: 'promo' });
});

// SPEC 7.3: on a tie the source is "promo": 5 parcels give 500 and FLAT5 gives 500, and only one applies
test('equal volume and promo discounts give the promo as the source', T, async () => {
  const { discountFor } = await load();
  const result = discountFor({ baseCents: 10000, parcelCount: 5, promoCode: 'FLAT5', orderDate: '2025-03-15' });
  assert.deepEqual(result, { cents: 500, source: 'promo' });
});

// SPEC 7.3: 10 parcels give 1000, FLAT5 gives 500; only the larger applies
test('a better volume discount replaces the promo', T, async () => {
  const { discountFor } = await load();
  const result = discountFor({ baseCents: 10000, parcelCount: 10, promoCode: 'FLAT5', orderDate: '2025-03-15' });
  assert.deepEqual(result, { cents: 1000, source: 'volume' });
});

// ---- 7.2 promo expiry -------------------------------------------------------------------------------

// SPEC 7.2: valid on its expiry date
test('a percentage promo is valid on its expiry date', T, async () => {
  const { discountFor } = await load();
  const on = (promoCode, orderDate) => discountFor({ baseCents: 10000, parcelCount: 1, promoCode, orderDate });
  assert.deepEqual(on('SPRING10', '2025-05-31'), { cents: 1000, source: 'promo' });
  assert.deepEqual(on('SAVE15', '2025-12-31'), { cents: 1500, source: 'promo' });
});

// SPEC 7.2
test('a fixed promo is valid on its expiry date', T, async () => {
  const { discountFor } = await load();
  const result = discountFor({ baseCents: 10000, parcelCount: 1, promoCode: 'FLAT5', orderDate: '2026-06-30' });
  assert.deepEqual(result, { cents: 500, source: 'promo' });
});

// ---- 7.4 the discount is taken from the base charge only --------------------------------------------

// SPEC 7.4, 8.4: base 910, fuel 73, SPRING10 takes 10% of 910
test('a promo discount ignores the fuel surcharge', T, async () => {
  const { quote } = await load();
  const result = quote(order({ promoCode: 'SPRING10' }));
  assert.equal(result.baseCents, 910);
  assert.equal(result.surcharges.fuel, 73);
  assert.equal(result.discountCents, 91);
});

// SPEC 7.1, 7.4: 5 parcels of 700, base 3500, fuel 280; the volume discount is 5% of 3500
test('a volume discount ignores the fuel surcharge', T, async () => {
  const { quote } = await load();
  const result = quote(order({ parcels: Array.from({ length: 5 }, () => parcel(3.5)) }));
  assert.equal(result.baseCents, 3500);
  assert.equal(result.surcharges.fuel, 280);
  assert.equal(result.discountCents, 175);
  assert.equal(result.discountSource, 'volume');
});

// ---- 8.1 minimum charge after the service multiplier ------------------------------------------------

// SPEC 8.1 steps 3-4: 490 x 90% = 441, raised to 600
test('the minimum charge applies after the economy multiplier', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ service: 'economy', parcels: [parcel(0.5, 10, 10, 10)] })).baseCents, 600);
});

// SPEC 8.1 steps 3-4: 490 x 150% = 735, above the minimum
test('the minimum charge does not lift an express price that already clears it', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ service: 'express', parcels: [parcel(0.5, 10, 10, 10)] })).baseCents, 735);
});

// SPEC 8.1 steps 3-4: table 2024-01-01, zone 1, band up to 5 kg is 660; 660 x 90% = 594, raised to 600
test('a price that only falls below the minimum after the multiplier is raised', T, async () => {
  const { quote } = await load();
  const result = quote(order({ orderDate: '2024-06-15', service: 'economy', parcels: [parcel(3)] }));
  assert.equal(result.baseCents, 600);
});

// ---- 8.1 tax after the discount ---------------------------------------------------------------------

// SPEC 8.5
test('tax is taken on the amount after a volume discount', T, async () => {
  const { quote } = await load();
  const result = quote(order({ service: 'economy', parcels: Array.from({ length: 5 }, () => parcel(3.5, 20, 20, 20)) }));
  assert.equal(result.discountCents, 158);
  assert.equal(result.taxCents, 568);
  assert.equal(result.totalCents, 3560);
});

// SPEC 8.1 steps 6-7: base 819, SPRING10 takes 82, tax on 737 is 140
test('tax is taken on the amount after a percentage promo', T, async () => {
  const { quote } = await load();
  const result = quote(order({ service: 'economy', promoCode: 'SPRING10' }));
  assert.equal(result.baseCents, 819);
  assert.equal(result.taxCents, 140);
  assert.equal(result.totalCents, 877);
});

// SPEC 8.1 steps 6-7: base 819, FLAT5 takes 500, tax on 319 is 61
test('tax is taken on the amount after a fixed promo', T, async () => {
  const { quote } = await load();
  const result = quote(order({ service: 'economy', promoCode: 'FLAT5' }));
  assert.equal(result.taxCents, 61);
  assert.equal(result.totalCents, 380);
});

// ---- 2.2 the weight limit is inclusive --------------------------------------------------------------

// SPEC 2.2: a parcel of exactly 30 kg is accepted
test('parseOrder accepts a parcel of exactly 30 kg', T, async () => {
  const { parseOrder } = await load();
  assert.doesNotThrow(() => parseOrder(order({ parcels: [parcel(30)] })));
});

// SPEC 2.2, 8.2
test('a quote prices a parcel of exactly 30 kg', T, async () => {
  const { quote } = await load();
  assert.equal(quote(order({ parcels: [parcel(30)] })).parcels[0].billableKg, 30);
});

// ---- 2.2 declared value error code ------------------------------------------------------------------

// SPEC 2.2: a negative declared value is INVALID_VALUE
test('a negative declared value is rejected with INVALID_VALUE', T, async () => {
  const { parseOrder } = await load();
  assert.throws(() => parseOrder(order({ declaredValue: -1 })), { code: 'INVALID_VALUE' });
});

// SPEC 2.2: a declared value that is not a whole number is INVALID_VALUE
test('a fractional declared value is rejected with INVALID_VALUE', T, async () => {
  const { quote } = await load();
  assert.throws(() => quote(order({ declaredValue: 99.5 })), { code: 'INVALID_VALUE' });
});

// ---- 2.2 the order of the rules ---------------------------------------------------------------------

// SPEC 2.2: the rules are checked in the order of the table and the first failure throws; the weight rule
// ("every weightKg") comes before the dimensions rule, so a bad weight on a later parcel wins over bad
// dimensions on an earlier one
test('a bad weight on a later parcel is reported before bad dimensions on an earlier one', T, async () => {
  const { parseOrder } = await load();
  assert.throws(() => parseOrder(order({ parcels: [parcel(1, 201, 10, 10), parcel(0)] })), { code: 'INVALID_WEIGHT' });
  assert.throws(() => parseOrder(order({ parcels: [parcel(5, 10, 0, 10), parcel(30.5)] })), { code: 'INVALID_WEIGHT' });
});

// ---- regression guards: behaviour that is right today and must stay right ---------------------------

// SPEC 1.2, 9.1, 9.2
test('guard: money helpers and the text breakdown', T, async () => {
  const { percentOf, formatMoney, formatQuote } = await load();
  assert.equal(percentOf(25, 10), 3);
  assert.equal(percentOf(1050, 8.5), 89);
  assert.equal(percentOf(910, 8), 73);
  assert.equal(formatMoney(1234), '12.34');
  assert.equal(formatMoney(5), '0.05');
  assert.equal(formatMoney(-5), '-0.05');
  const full = { baseCents: 910, surcharges: { fuel: 73, remote: 1400, oversize: 2500, insurance: 300 }, discountCents: 175, taxCents: 187, totalCents: 5195 };
  assert.equal(
    formatQuote(full),
    'Base: 9.10 EUR\nFuel: 0.73 EUR\nRemote area: 14.00 EUR\nOversize: 25.00 EUR\nInsurance: 3.00 EUR\nDiscount: -1.75 EUR\nTax: 1.87 EUR\nTotal: 51.95 EUR',
  );
  const plain = { baseCents: 910, surcharges: { fuel: 0, remote: 0, oversize: 0, insurance: 0 }, discountCents: 0, taxCents: 173, totalCents: 1083 };
  assert.equal(formatQuote(plain), 'Base: 9.10 EUR\nTax: 1.73 EUR\nTotal: 10.83 EUR');
});

// SPEC 2.2
test('guard: every other validation rule has its code', T, async () => {
  const { parseOrder } = await load();
  const code = (overrides) => {
    try {
      parseOrder(order(overrides));
    } catch (error) {
      return error.code;
    }
    return null;
  };
  assert.equal(code({ orderDate: '2025-02-30' }), 'INVALID_DATE');
  assert.equal(code({ orderDate: '15/03/2025' }), 'INVALID_DATE');
  assert.equal(code({ service: 'overnight' }), 'INVALID_SERVICE');
  assert.equal(code({ destination: { country: 'de', postalCode: '10115' } }), 'INVALID_DESTINATION');
  assert.equal(code({ destination: { country: 'DE', postalCode: 10115 } }), 'INVALID_DESTINATION');
  assert.equal(code({ parcels: [] }), 'EMPTY_ORDER');
  assert.equal(code({ parcels: Array.from({ length: 21 }, () => parcel(1)) }), 'TOO_MANY_PARCELS');
  assert.equal(code({ parcels: [parcel(0)] }), 'INVALID_WEIGHT');
  assert.equal(code({ parcels: [parcel(30.5)] }), 'INVALID_WEIGHT');
  assert.equal(code({ parcels: [parcel(1, 201, 10, 10)] }), 'INVALID_DIMENSIONS');
  assert.equal(code({ parcels: [parcel(1, 10, 0, 10)] }), 'INVALID_DIMENSIONS');
  assert.equal(code({ parcels: Array.from({ length: 20 }, () => parcel(1)), declaredValue: 0 }), null);
});

// SPEC 2.3
test('guard: parseOrder fills in defaults and leaves its argument alone', T, async () => {
  const { parseOrder } = await load();
  const input = order({ destination: { country: 'DE', postalCode: '10115' } });
  const before = JSON.stringify(input);
  const parsed = parseOrder(input);
  assert.equal(parsed.declaredValue, 0);
  assert.equal(parsed.promoCode, null);
  assert.deepEqual(parsed.parcels, input.parcels);
  assert.notEqual(parsed, input);
  assert.equal(JSON.stringify(input), before);
});

// SPEC 3.3
test('guard: zone lookups that need no longest-prefix rule', T, async () => {
  const { lookupZone } = await load();
  assert.deepEqual(lookupZone('DE', '10115'), { zone: '1', remote: false });
  assert.deepEqual(lookupZone('DE', '18551'), { zone: '1', remote: false });
  assert.deepEqual(lookupZone('NL', '1011AB'), { zone: '2', remote: false });
  assert.throws(() => lookupZone('XX', '1000'), { code: 'NO_ZONE' });
});

// SPEC 4.2
test('guard: billable weight keeps actual weights and exact multiples', T, async () => {
  const { billableWeight } = await load();
  assert.equal(billableWeight(parcel(7.5)), 7.5);
  assert.equal(billableWeight(parcel(2)), 2);
  assert.equal(billableWeight(parcel(14, 150, 20, 20)), 14);
});

// SPEC 5.2, 5.3
test('guard: rate table choice and band prices away from the edges', T, async () => {
  const { selectRateTable, baseRateCents } = await load();
  assert.equal(selectRateTable('2025-06-30').effective, '2025-01-01');
  assert.equal(selectRateTable('2030-01-01').effective, '2025-07-01');
  assert.throws(() => selectRateTable('2023-12-31'), { code: 'NO_RATE_TABLE' });
  const table = selectRateTable('2025-03-15');
  assert.equal(baseRateCents(table, '1', 5.5), 910);
  assert.equal(baseRateCents(table, '2', 0.5), 750);
  assert.equal(baseRateCents(table, '2', 25), 3040);
});

// SPEC 6.1, 6.2, 6.3, 6.4
test('guard: surcharge amounts and oversize limits', T, async () => {
  const { fuelCents, remoteCents, isOversize, oversizeCents, insuranceCents } = await load();
  assert.equal(fuelCents(910, 'standard'), 73);
  assert.equal(fuelCents(910, 'express'), 109);
  assert.equal(fuelCents(910, 'economy'), 0);
  assert.equal(remoteCents({ zone: '1', remote: true }), 1400);
  assert.equal(remoteCents({ zone: '1', remote: false }), 0);
  assert.equal(isOversize({ length: 120, width: 30, height: 30 }), false);
  assert.equal(isOversize({ length: 121, width: 30, height: 30 }), true);
  assert.equal(isOversize({ length: 100, width: 50, height: 50 }), false);
  assert.equal(isOversize({ length: 100, width: 50, height: 51 }), true);
  assert.equal(oversizeCents([parcel(1, 121, 30, 30), parcel(1), parcel(1, 100, 50, 51)]), 5000);
  assert.equal(insuranceCents(10000), 0);
  assert.equal(insuranceCents(100000), 900);
  assert.equal(insuranceCents(50050), 401);
  assert.equal(insuranceCents(41000), 310);
});

// SPEC 7.1, 7.2
test('guard: volume tiers, unknown codes, expired codes and the fixed cap', T, async () => {
  const { discountFor } = await load();
  const on = (parcelCount, promoCode = null, orderDate = '2025-03-15', baseCents = 10000) => discountFor({ baseCents, parcelCount, promoCode, orderDate });
  assert.deepEqual(on(4), { cents: 0, source: null });
  assert.deepEqual(on(5), { cents: 500, source: 'volume' });
  assert.deepEqual(on(9), { cents: 500, source: 'volume' });
  assert.deepEqual(on(10), { cents: 1000, source: 'volume' });
  assert.deepEqual(on(1, 'NOPE'), { cents: 0, source: null });
  assert.deepEqual(on(1, 'spring10'), { cents: 0, source: null });
  assert.deepEqual(on(1, 'SPRING10', '2025-06-01'), { cents: 0, source: null });
  assert.deepEqual(on(1, 'FLAT5', '2025-03-15', 300), { cents: 300, source: 'promo' });
});

// SPEC 8.4
test('guard: a plain standard quote end to end', T, async () => {
  const { quote } = await load();
  const result = quote(order());
  assert.equal(result.zone, '1');
  assert.equal(result.tableEffective, '2025-01-01');
  assert.deepEqual(result.parcels, [{ billableKg: 7.5, rateCents: 910 }]);
  assert.equal(result.baseCents, 910);
  assert.deepEqual(result.surcharges, { fuel: 73, remote: 0, oversize: 0, insurance: 0 });
  assert.equal(result.discountCents, 0);
  assert.equal(result.discountSource, null);
  assert.equal(result.taxCents, 187);
  assert.equal(result.totalCents, 1170);
});

// Definition of done: the project's own tests are green when the work ends. With the spec as the
// contract, a test that encodes a drift has to be corrected too.
test("the project's own test suite passes", { timeout: 30000 }, () => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const run = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'tests/**/*.spec.mjs'], {
    cwd: new URL('..', import.meta.url),
    env,
    encoding: 'utf8',
    timeout: 25000,
  });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, /^# tests [1-9]\d*$/m);
});

// The contract is not part of the work.
test('guard: docs/SPEC.md is unchanged', T, () => {
  assert.equal(sha256('../docs/SPEC.md'), '83a85952bfb543cfc9d0e74277cdb9504ed250e0c7846f675046b9ec190032e8');
});

// The pricing data is not part of the work.
test('guard: the data files are unchanged', T, () => {
  assert.equal(sha256('../data/zones.json'), 'b1be39218731236b34e58157a16ed491b8c7342877d03d8b9bcb732edd7fee12');
  assert.equal(sha256('../data/rates.json'), '11bab42a6b85690fdad952084be91da16247dec10166056de4e0244a05d05d1a');
});

// The public API keeps its exports.
test('guard: src/index.mjs keeps its export list', T, async () => {
  const api = await load();
  assert.deepEqual(Object.keys(api).sort(), [
    'QuoteError', 'baseRateCents', 'billableWeight', 'discountFor', 'formatMoney', 'formatQuote', 'fuelCents',
    'insuranceCents', 'isOversize', 'lookupZone', 'normalizePostalCode', 'oversizeCents', 'parseOrder',
    'percentOf', 'quote', 'remoteCents', 'selectRateTable', 'volumetricWeight',
  ]);
});
