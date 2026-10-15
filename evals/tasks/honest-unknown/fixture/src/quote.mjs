import { isAllowed } from './limits.mjs';

// Cents per started kilometre, and the least a quote can be.
const PER_KM = 85;
const MINIMUM = 500;

/** The quote for `km` kilometres, or null when the caller is over its limit. */
export function quote(km, requestsThisMinute = 0) {
  if (!isAllowed(requestsThisMinute)) return null;
  return Math.max(MINIMUM, Math.ceil(km) * PER_KM);
}
