// Checks on what comes from the command line. Each gives the value as the rest of the program uses it,
// or throws an `InputError` whose message is the line the command prints.

export class InputError extends Error {}

const SKU = /^[A-Z0-9][A-Z0-9-]{1,23}$/;
const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** A SKU: 2 to 24 capitals, digits and dashes, the first not a dash. */
export function sku(value) {
  if (typeof value !== 'string' || !SKU.test(value)) throw new InputError(`not a SKU: ${JSON.stringify(value)}`);
  return value;
}

/** The name of an item: 1 to 80 characters once trimmed. */
export function itemName(value) {
  const name = typeof value === 'string' ? value.trim() : '';
  if (name === '' || name.length > 80) throw new InputError('an item name has 1 to 80 characters');
  return name;
}

/** A quantity given as text: a whole number, zero or more. */
export function quantity(value) {
  const number = Number(value);
  if (typeof value !== 'string' || value.trim() === '' || !Number.isInteger(number) || number < 0) {
    throw new InputError(`not a quantity: ${JSON.stringify(value)}`);
  }
  return number;
}

/** A name that is safe as one part of a path: letters, digits, dots, dashes and underscores, the first a
 * letter or a digit, so it is never a folder above and never hidden. */
export function fileName(value) {
  if (typeof value !== 'string' || !FILE_NAME.test(value)) throw new InputError(`not a file name: ${JSON.stringify(value)}`);
  return value;
}
