// Fuel, remote area, oversize and insurance charges.
import { percentOf } from './money.mjs';

const FUEL_PERCENT = { economy: 0, standard: 8, express: 12 };
const REMOTE_FEE_CENTS = 1400;
const OVERSIZE_FEE_CENTS = 2500;
const OVERSIZE_LENGTH_CM = 120;
const OVERSIZE_GIRTH_CM = 300;
const INSURANCE_THRESHOLD_CENTS = 10000;
const INSURANCE_PERCENT = 1;

export function fuelCents(baseCents, service) {
  return percentOf(baseCents, FUEL_PERCENT[service]);
}

export function remoteCents(zone) {
  return zone.remote ? REMOTE_FEE_CENTS : 0;
}

export function isOversize({ length, width, height }) {
  const girth = length + 2 * (width + height);
  return length > OVERSIZE_LENGTH_CM || girth > OVERSIZE_GIRTH_CM;
}

export function oversizeCents(parcels) {
  return parcels.filter(isOversize).length * OVERSIZE_FEE_CENTS;
}

export function insuranceCents(declaredValue) {
  if (declaredValue <= INSURANCE_THRESHOLD_CENTS) return 0;
  return percentOf(declaredValue - INSURANCE_THRESHOLD_CENTS, INSURANCE_PERCENT);
}
