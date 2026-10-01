import { parseLocation } from './model.mjs';

/** `WH1` holds every item of that warehouse; `WH1/B12` holds that bin only. */
const isIn = (item, { warehouse, bin }) => item.location.warehouse === warehouse && (bin === null || item.location.bin === bin);

/**
 * The items that carry `tag` (in lower case) and sit in `location`; a filter that is not given lets every item through.
 * @param {{ items: any[] }} state
 * @param {{ tag?: string, location?: string }} [filter]
 */
export function filterItems(state, filter = {}) {
  const tag = filter.tag?.toLowerCase();
  const location = filter.location === undefined ? undefined : parseLocation(filter.location);
  return state.items.filter((item) => (tag === undefined || item.tags.includes(tag)) && (location === undefined || isIn(item, location)));
}
