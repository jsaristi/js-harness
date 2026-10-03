// The quote itself: parcels in, a priced breakdown out.
import { percentOf } from './money.mjs';
import { parseOrder } from './parse.mjs';
import { billableWeight } from './weight.mjs';
import { lookupZone } from './zones.mjs';
import { baseRateCents, selectRateTable } from './rates.mjs';
import { fuelCents, insuranceCents, oversizeCents, remoteCents } from './surcharges.mjs';
import { discountFor } from './discounts.mjs';

const SERVICE_PERCENT = { economy: 90, standard: 100, express: 150 };
const MINIMUM_CHARGE_CENTS = 600;
const TAX_PERCENT = 19;

const sum = (numbers) => numbers.reduce((total, value) => total + value, 0);

export function quote(input) {
  const order = parseOrder(input);
  const zone = lookupZone(order.destination.country, order.destination.postalCode);
  const table = selectRateTable(order.orderDate);

  const parcels = order.parcels.map((parcel) => {
    const billableKg = billableWeight(parcel);
    return { billableKg, rateCents: baseRateCents(table, zone.zone, billableKg) };
  });
  const rated = Math.max(sum(parcels.map((parcel) => parcel.rateCents)), MINIMUM_CHARGE_CENTS);
  const baseCents = percentOf(rated, SERVICE_PERCENT[order.service]);

  const oversize = oversizeCents(order.parcels);
  const surcharges = {
    fuel: fuelCents(baseCents + oversize, order.service),
    remote: remoteCents(zone),
    oversize,
    insurance: insuranceCents(order.declaredValue),
  };

  const subtotalCents = baseCents + sum(Object.values(surcharges));
  const discount = discountFor({
    baseCents: subtotalCents,
    parcelCount: parcels.length,
    promoCode: order.promoCode,
    orderDate: order.orderDate,
  });
  const taxCents = percentOf(subtotalCents, TAX_PERCENT);

  return {
    zone: zone.zone,
    tableEffective: table.effective,
    parcels,
    baseCents,
    surcharges,
    discountCents: discount.cents,
    discountSource: discount.source,
    taxCents,
    totalCents: subtotalCents - discount.cents + taxCents,
  };
}
