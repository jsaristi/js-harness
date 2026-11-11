// How the text a host's question tool gives back is read: an option the person tapped, his own typed text, or the
// host's note in the place of an answer when he closed the question. `answerOf` of ./sessions.mjs, the guard that
// takes an answer as his word, reads it here; moved out of that module, which is at its size ceiling, when the note
// came to be known by its shape (audit M22, 2026-11-09). Zero dependencies.

/** What the hosts write in the place of an answer when the person closes a question without answering it: how
 * that text begins. Claude Code writes "[User dismissed — do not proceed, wait for next instruction]", in a
 * result it does not mark an error (four lines of this project's transcripts, 2026-10-12). It is data, like the
 * tools' names: another host, or another version of this one, may say it otherwise; `isHostNote` reads the shape. */
export const QUESTION_DISMISSED = ['[User dismissed'];

const SEVERAL = ', ';

/** Whether `answer` is labels of `options` joined with the separator the host joins several with. A label may
 * hold that separator, so the answer is not split on it: it is matched whole labels at a time, whichever way
 * it divides. Each place of the answer where a label may begin is looked at once: labels that are joins of
 * each other divide an answer in more ways than could be walked, and the labels are what a session wrote. */
function isLabelsJoined(answer, options) {
  const labels = options.filter((label) => label !== '');
  const begun = new Set([0]);
  const toLook = [0];
  while (toLook.length > 0) {
    const from = toLook.pop();
    for (const label of labels) {
      if (!answer.startsWith(label, from)) continue;
      const end = from + label.length;
      if (end === answer.length) return true;
      const next = end + SEVERAL.length;
      if (answer.startsWith(SEVERAL, end) && !begun.has(next)) {
        begun.add(next);
        toLook.push(next);
      }
    }
  }
  return false;
}

/** How the person gave an answer: `tapped` when it is one of the options the question showed, or, for a question
 * that takes several, when it is options joined; `typed` otherwise, which is his own text. */
export function howAnswered(answer, options, several) {
  if (options.includes(answer)) return 'tapped';
  return several && isLabelsJoined(answer, options) ? 'tapped' : 'typed';
}

/** Whether `answer` is the host's note that the person closed the question, not an answer of his: it begins with a
 * string of `QUESTION_DISMISSED`, or it is wholly in square brackets and none of `options`. A host that rewords the
 * note keeps it in brackets, and read by one string alone it was stored as his typed answer (audit M22). A false
 * match refuses the copy of an answer; it never forges one. */
export function isHostNote(answer, options) {
  const text = answer.trim();
  return QUESTION_DISMISSED.some((mark) => text.startsWith(mark)) || (/^\[[^\]]*\]$/.test(text) && !options.includes(text));
}
