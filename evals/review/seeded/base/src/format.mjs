// The text the command prints.

/** One item on one line: its SKU, its quantity and its name. */
export function formatItem({ sku, name, quantity }) {
  return `${sku.padEnd(24)} ${String(quantity).padStart(7)}  ${name}`;
}

/** Every item, one a line, or a line that says there is none. */
export function formatItems(items) {
  return items.length === 0 ? 'no items' : items.map(formatItem).join('\n');
}
