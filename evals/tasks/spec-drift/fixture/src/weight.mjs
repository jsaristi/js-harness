// Volumetric and billable weight of a parcel.

const VOLUMETRIC_DIVISOR = 6000;
const STEP_KG = 0.5;

/** Weight in kg that the parcel's volume stands for. */
export function volumetricWeight({ length, width, height }) {
  return (length * width * height) / VOLUMETRIC_DIVISOR;
}

/** The weight a parcel is priced on: the larger of actual and volumetric, in half-kilo steps. */
export function billableWeight(parcel) {
  const chargeable = Math.max(parcel.weightKg, volumetricWeight(parcel));
  return Math.round(chargeable / STEP_KG) * STEP_KG;
}
