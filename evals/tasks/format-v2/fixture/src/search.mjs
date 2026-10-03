const tagsOf = (item) => item.tags.split(',').map((tag) => tag.trim());

/** `WH1` holds every item whose location is `WH1` or starts with `WH1/`; `WH1/B12` holds that bin only. */
const isIn = (item, location) => item.location === location || item.location.startsWith(`${location}/`);

/**
 * The items that carry `tag` and sit in `location`; a filter that is not given lets every item through.
 * @param {{ items: any[] }} state
 * @param {{ tag?: string, location?: string }} [filter]
 */
export function filterItems(state, filter = {}) {
  const { tag, location } = filter;
  return state.items.filter((item) => (tag === undefined || tagsOf(item).includes(tag)) && (location === undefined || isIn(item, location)));
}
