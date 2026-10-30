/** The path of a post: its year and its title in lower case, every run of other characters one dash. */
export function postPath(post) {
  const title = post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `/posts/${post.date.slice(0, 4)}/${title}`;
}

/** The path of the archive of the month a post was written in. */
export function archivePath(post) {
  return `/archive/${post.date.slice(0, 7)}`;
}
