// The lines of a record file, streamed, as the writer ended them.
import fs from 'node:fs';

/** The lines of `file` as the transcript writes them, each ended by `\n` (a `\r` before it dropped), streamed. Not
 * Node's readline: it also ends a line at U+2028 and U+2029, which JSON leaves unescaped inside a string, so the
 * line numbers after one would be off and the entry holding it would not parse. */
export async function* linesOf(file) {
  let rest = '';
  for await (const chunk of fs.createReadStream(file, { encoding: 'utf8' })) {
    const parts = (rest + chunk).split('\n');
    rest = parts.pop();
    for (const part of parts) yield part.endsWith('\r') ? part.slice(0, -1) : part;
  }
  if (rest !== '') yield rest;
}
