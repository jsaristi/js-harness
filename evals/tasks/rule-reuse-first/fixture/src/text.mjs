// Helpers for the words of a page.

/** `text` in lower case with its accents taken off, every run of other characters one dash, no dash at either end:
 * the part of a path a title or a name becomes. */
export function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The first `count` words of `text`, with an ellipsis when it had more. */
export function excerpt(text, count = 30) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= count ? words.join(' ') : `${words.slice(0, count).join(' ')}…`;
}
