/** The path of an author's page: the author's name in lower case, every run of other characters one dash. */
export function authorPath(author) {
  const name = author.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `/authors/${name}`;
}
