// The slug of a text: the part of a path a title or a name becomes.

/** `text` in lower case, every run of characters that are not a letter or a digit one dash, no dash at either end. */
export function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
