// Volume discounts and promo codes.
import { percentOf } from './money.mjs';

const VOLUME_TIERS = [
  { minParcels: 10, percent: 10 },
  { minParcels: 5, percent: 5 },
];

const PROMOS = {
  SPRING10: { percent: 10, expires: '2025-05-31' },
  SAVE15: { percent: 15, expires: '2025-12-31' },
  FLAT5: { cents: 500, expires: '2026-06-30' },
};

function volumeCents(baseCents, parcelCount) {
  const tier = VOLUME_TIERS.find((candidate) => parcelCount >= candidate.minParcels);
  return tier ? percentOf(baseCents, tier.percent) : 0;
}

function promoCents(baseCents, promoCode, orderDate) {
  const promo = Object.hasOwn(PROMOS, promoCode) ? PROMOS[promoCode] : null;
  if (!promo || orderDate >= promo.expires) return 0;
  return promo.cents === undefined ? percentOf(baseCents, promo.percent) : Math.min(promo.cents, baseCents);
}

/** The discount on `baseCents`, and where it comes from. */
export function discountFor({ baseCents, parcelCount, promoCode, orderDate }) {
  const volume = volumeCents(baseCents, parcelCount);
  const promo = promoCents(baseCents, promoCode, orderDate);
  const cents = volume + promo;
  if (cents === 0) return { cents: 0, source: null };
  return { cents, source: promo > 0 ? 'promo' : 'volume' };
}
