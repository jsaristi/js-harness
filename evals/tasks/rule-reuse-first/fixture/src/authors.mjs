import { slugify } from './text.mjs';

/** The path of an author's page, by the author's name. */
export function authorPath(author) {
  return `/authors/${slugify(author.name)}`;
}
