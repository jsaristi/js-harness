import { slugify } from './text.mjs';

/** The path of a post: its year and the slug of its title. */
export function postPath(post) {
  return `/posts/${post.date.slice(0, 4)}/${slugify(post.title)}`;
}

/** The path of the archive of the month a post was written in. */
export function archivePath(post) {
  return `/archive/${post.date.slice(0, 7)}`;
}
