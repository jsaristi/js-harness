import { slugify } from './text.mjs';

/** The path of a tag's page, by the tag's name. */
export function tagPath(tag) {
  return `/tags/${slugify(tag.name)}`;
}
