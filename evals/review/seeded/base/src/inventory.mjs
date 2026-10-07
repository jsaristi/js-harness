// The operations on items. Each one loads the state, changes it and awaits the save before it returns.

export class StockError extends Error {}

const find = (state, sku) => state.items.find((item) => item.sku === sku);

/** Adds `quantity` of the item `sku`, creating it under `name` when it is new. Gives the item. */
export async function receive(store, { sku, quantity, name }) {
  const state = await store.load();
  let item = find(state, sku);
  if (!item) {
    if (name === undefined) throw new StockError(`unknown SKU ${sku}: a new item needs a name`);
    item = { sku, name, quantity: 0 };
    state.items.push(item);
  }
  item.quantity += quantity;
  await store.save(state);
  return item;
}

/** Takes `quantity` of the item `sku` out of stock. Gives the item. */
export async function issue(store, { sku, quantity }) {
  const state = await store.load();
  const item = find(state, sku);
  if (!item) throw new StockError(`unknown SKU ${sku}`);
  if (quantity > item.quantity) throw new StockError(`only ${item.quantity} of ${sku} in stock`);
  item.quantity -= quantity;
  await store.save(state);
  return item;
}

/** Every item, by SKU. */
export async function items(store) {
  const state = await store.load();
  return state.items.toSorted((a, b) => (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0));
}
