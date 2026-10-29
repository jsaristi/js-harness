import { slug } from './lib/slug.mjs';

/** The path of a tag's page, by the tag's name. */
export function tagPath(tag) {
  return `/tags/${slug(tag.name)}`;
}
