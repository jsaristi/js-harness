# Parcel quote specification

This is the contract for `parcel-quote`, version 3.2. Section numbers are stable: the pricing team
quotes them in tickets. An implementation that disagrees with this document is wrong.

## 1. Conventions

1.1 Every amount is a whole number of euro cents. No result contains a fractional amount.

1.2 `percentOf(amountCents, percent)` is `amountCents x percent / 100`, rounded half up: a fraction
of exactly one half rounds up to the next cent. Amounts are never negative and `percent` has at most
two decimals. Examples: `percentOf(25, 10)` is 3 (2.5), `percentOf(910, 8)` is 73 (72.8),
`percentOf(1050, 8.5)` is 89 (89.25).

1.3 Dates are `YYYY-MM-DD` strings. Two dates are compared as strings.

1.4 Weights are in kilograms and lengths in centimetres.

1.5 Every rejected input and every failed lookup throws a `QuoteError` whose `code` is the one named
in this document.

## 2. Orders

2.1 An order has this shape. `declaredValue` (in cents) and `promoCode` may be absent.

```text
{ orderDate, service, destination: { country, postalCode }, declaredValue, promoCode,
  parcels: [{ weightKg, length, width, height }] }
```

2.2 `parseOrder(order)` checks the rules below in this order and throws on the first one that fails.

| Rule | Code |
| --- | --- |
| `orderDate` is a real calendar date written `YYYY-MM-DD` | `INVALID_DATE` |
| `service` is `economy`, `standard` or `express` | `INVALID_SERVICE` |
| `destination.country` is two upper-case letters and `destination.postalCode` is a string (it may be empty) | `INVALID_DESTINATION` |
| `declaredValue`, when present, is a whole number, at least 0 | `INVALID_VALUE` |
| `parcels` holds at least one parcel | `EMPTY_ORDER` |
| `parcels` holds at most 20 parcels | `TOO_MANY_PARCELS` |
| every `weightKg` is a number above 0 and at most 30; a parcel of exactly 30 kg is accepted | `INVALID_WEIGHT` |
| `length`, `width` and `height` are each a number above 0 and at most 200 | `INVALID_DIMENSIONS` |

2.3 On success `parseOrder` returns a new order: the postal code normalized (3.1), `declaredValue`
0 when it was absent and `promoCode` `null` when it was absent. The argument is not modified.

## 3. Zones

3.1 `normalizePostalCode(text)` upper-cases the text and removes every whitespace character, wherever
it is. `" sw1a 1aa "` becomes `"SW1A1AA"`.

3.2 `data/zones.json` lists entries `{ country, prefix, zone, remote }`. An entry matches a country and
a postal code when the countries are equal and the normalized postal code starts with the entry's
prefix. An empty prefix matches every postal code of the country. When several entries match, the one
with the longest prefix applies.

3.3 `lookupZone(country, postalCode)` normalizes the postal code (3.1), applies 3.2 and returns
`{ zone, remote }` from the entry that applies. When no entry matches it throws `NO_ZONE`.

Example: for `DE`, postal code `18439` matches the prefixes `""` and `"18"`, so `"18"` applies;
`18551` matches `""`, `"18"` and `"185"`, so `"185"` applies.

## 4. Weight

4.1 `volumetricWeight(parcel)` is `length x width x height / 5000`, not rounded. A parcel of
50 x 40 x 30 has a volumetric weight of 12.

4.2 `billableWeight(parcel)` is the larger of the actual weight and the volumetric weight, rounded up
to the next multiple of 0.5 kg. A weight that already is a multiple of 0.5 stays as it is.
Examples: 2.2 becomes 2.5, 2.5 stays 2.5, 3.1 becomes 3.5.

4.3 Every parcel is priced on its own billable weight. Weights are never added across parcels.

## 5. Rates

5.1 `data/rates.json` lists rate tables. A table has an `effective` date, `bands` (the upper limits
in kg of its weight bands, ascending, the last one `null` for "no limit") and `cents`, which gives
for each zone the price of the band at the same index. The order of the tables in the file carries
no meaning.

5.2 `selectRateTable(orderDate)` returns the table with the latest `effective` date that is on or
before the order date. A table is in force from its effective date inclusive. When no table
qualifies it throws `NO_RATE_TABLE`. Example: with tables effective 2025-01-01 and 2025-07-01, the
order date 2025-06-30 selects the first and 2025-07-01 selects the second.

5.3 `baseRateCents(table, zone, billableKg)` returns the price of the first band whose upper limit is
greater than or equal to the weight, so the upper limit belongs to its band. Example: with the limits
1, 2, 5, 10, 20 and `null`, 5 kg is priced in the band up to 5 and 5.5 kg in the band up to 10.

## 6. Surcharges

6.1 `fuelCents(baseCents, service)` is a percentage of the base charge (8.3) and of nothing else:
0% for `economy`, 8% for `standard`, 12% for `express`.

6.2 `remoteCents(zone)` is 1400 for a zone result whose `remote` is true and 0 otherwise. It is
charged once per shipment, not per parcel.

6.3 A parcel is oversize when its longest side is strictly greater than 120 cm, or its girth is
strictly greater than 300 cm. The girth is the longest side plus twice the sum of the other two.
The three dimensions may be given in any order. `isOversize(parcel)` says so, and
`oversizeCents(parcels)` is 2500 per oversize parcel. Examples: 30 x 125 x 10 is oversize (longest
side 125); 100 x 50 x 50 is not (girth 300); 20 x 100 x 70 is not (girth 280).

6.4 `insuranceCents(declaredValue)` is 0 when the declared value is at most 10000. Above that it is
1% (1.2) of the part above 10000, and never less than 300. Examples: 10000 gives 0, 10500 gives 300,
100000 gives 900.

## 7. Discounts

7.1 A volume discount applies to shipments of at least 5 parcels (5%) and of at least 10 parcels
(10%). The higher tier replaces the lower one.

7.2 A promo code is matched exactly, with its case. An unknown code is ignored without an error.

| Code | Discount | Expires |
| --- | --- | --- |
| `SPRING10` | 10% | 2025-05-31 |
| `SAVE15` | 15% | 2025-12-31 |
| `FLAT5` | 500 cents | 2026-06-30 |

A code is valid on its expiry date and on every earlier date. A fixed discount is never larger than
the amount it is taken from.

7.3 Discounts do not stack. `discountFor({ baseCents, parcelCount, promoCode, orderDate })` computes
the volume discount and the promo discount on `baseCents` and returns `{ cents, source }` for the
larger one, `source` being `"volume"` or `"promo"`; on a tie it is `"promo"`. When there is no
discount it returns `{ cents: 0, source: null }`.

7.4 A discount is taken from the base charge (8.3) only. Surcharges are never discounted.

## 8. Quote

8.1 `quote(order)` runs these steps in this order.

1. `parseOrder` (2.2). The zone comes from `lookupZone` and the table from `selectRateTable`.
2. Each parcel is priced on its billable weight with `baseRateCents` (4.3, 5.3).
3. The parcel prices are added up and the service multiplier is applied once to the sum, with
   `percentOf`: 90% for `economy`, 100% for `standard`, 150% for `express`.
4. The minimum charge is applied to that result: a shipment is never charged less than 600. It is a
   per-shipment minimum, not a per-parcel one.
5. The surcharges of section 6 are added.
6. The discount of section 7 is subtracted.
7. Tax is 19% of the amount after the discount, rounded once with `percentOf` on the shipment.

8.2 The result is `{ zone, tableEffective, parcels, baseCents, surcharges, discountCents,
discountSource, taxCents, totalCents }`. `parcels` holds `{ billableKg, rateCents }` for each parcel
in order; `surcharges` is `{ fuel, remote, oversize, insurance }`; `tableEffective` is the `effective`
date of the table used and `zone` the zone id.

8.3 The base charge, `baseCents`, is the result of steps 3 and 4. `totalCents` is the base charge
plus the surcharges, minus the discount, plus the tax.

8.4 Example: standard service to DE 10115 on 2025-03-15, one parcel of 7.5 kg measuring 30 x 20 x 15.
Zone 1, table 2025-01-01, band up to 10 kg: 910. Base 910, fuel 73, tax `percentOf(983, 19)` = 187,
total 1170.

8.5 Example: economy service to DE 10115 on 2025-03-15, five parcels of 3.5 kg measuring 20 x 20 x 20.
Each is 700, the sum is 3500, times 90% gives a base of 3150. Volume discount `percentOf(3150, 5)` =
158. Tax is `percentOf(3150 - 158, 19)` = 568. Total 3150 - 158 + 568 = 3560.

## 9. Output

9.1 `formatMoney(cents)` writes the amount with two decimals and a dot, without a thousands
separator, and a leading minus for a negative amount: 1234 gives `12.34`, 5 gives `0.05`,
-5 gives `-0.05`.

9.2 `formatQuote(result)` returns one line per charge, joined by newlines, in this order: `Base`,
`Fuel`, `Remote area`, `Oversize`, `Insurance`, `Discount`, `Tax`, `Total`. A line reads
`<label>: <amount> EUR`. `Base`, `Tax` and `Total` are always present; the other lines are left out
when their amount is 0. The discount is written as a negative amount.
