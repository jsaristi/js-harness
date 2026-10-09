// Stocktake: what was counted on the shelf. A count sets the quantity of an item and leaves an entry in
// the journal, so that a later reader can tell a correction from a delivery.
import { StockError } from './inventory.mjs';

/** The journal of `state`: its count entries, oldest first. A state file written before there were
 * counts has none, and is given an empty one. */
function journalOf(state) {
  state.counts ??= [];
  return state.counts;
}

/** Records that `counted` of the item `sku` were on the shelf at `at`, an ISO date: the quantity of the
 * item becomes `counted`, and the journal gets `{ sku, before, after, at }`. Gives that entry. */
export async function count(store, { sku, counted, at }) {
  const state = await store.load();
  let item = state.items.find((candidate) => candidate.sku === sku);
  if (!item) {
    // Found on the shelf and not on the books yet: it comes in under its SKU, with nothing before the count.
    item = { sku, name: sku, quantity: 0 };
    state.items.push(item);
  }
  const entry = { sku, before: item.quantity, after: counted, at };
  item.quantity = counted;
  journalOf(state).push(entry);
  await store.save(state);
  return entry;
}

/** Takes back the last count: its item gets the quantity it had before, and the entry leaves the
 * journal. Gives the entry that was taken back. Refused when there is no count, and when the item has
 * changed since, because the quantity before the count is then no longer the one to go back to. */
export async function undo(store) {
  const state = await store.load();
  const journal = journalOf(state);
  const entry = journal.at(-1);
  if (!entry) throw new StockError('no count to take back');
  const item = state.items.find((candidate) => candidate.sku === entry.sku);
  if (!item || item.quantity !== entry.after) throw new StockError(`${entry.sku} has changed since it was counted`);
  item.quantity = entry.before;
  journal.pop();
  store.save(state);
  return entry;
}
