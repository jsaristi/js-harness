// The departure check of the reply Stop hook (odd/tasks/departure-stretch.md, spec 2): when the user's newest message
// to the lead that says he leaves or is back says he leaves and no stretch is open, the lead's stop is turned back
// naming `js-harness stretch open`; when it says he is back and the stretch opened before it is still open, the stop is
// turned back until it is closed. Both at every stop: the host lets the next stop of the same turn through
// (`stop_hook_active`), so it never loops.
//
// Why. `rule:away-autonomy` asks for a stretch before he leaves and its return when he is back, and only prose
// carried it. He left twice on 2026-10-31 (03:23:57Z, "voy a dejarte entre 1 a 2 horas solo", and 07:41:17Z) and the
// lead opened none, so his return had no estimate against actual and no route map. A reply is shown when the hook
// runs, so this reminds, it does not prevent; a record it cannot read throws, so the hook says the check did not run
// and lets the stop through.
//
// What it reads, each by the rule that already says it: his messages by `quoteOf`'s (`personMessagesIn`), so a tapped
// answer is his too; the lead as the live-board check tells it (`isLeadSession`); the open stretch as
// `js-harness stretch status` tells it (`openEvent` of bin/lib/stretch.mjs). What he means is read from his words by
// the patterns below, built from his departures and returns in the lead's transcripts (the feature document, L3): a
// clause that asks ("?") or supposes ("si te digo que ...") says neither.

import { readNotices } from './channel.mjs';
import { harnessHome } from './home.mjs';
import { personMessagesIn } from './person-times.mjs';
import { ABSENCE_MS } from './return-report.mjs';
import { PASTED_CONTENT, mainCheckout, projectSlug } from './sessions.mjs';
import { isLeadSession } from './stale-board.mjs';
import { eventsOf, openEvent, stretchFile } from './stretch.mjs';

/** The words only these warnings have. */
export const AWAY_MARKER = 'he said he is leaving';
export const BACK_MARKER = 'he said he is back';

// Read on his words lowercased, without accents and with one kind of apostrophe, a clause at a time.
const LEAVING = [
  /\bte (?:voy a |vas a )?dej(?:o|are|ar|e)\b.*\bsol[oa]\b/,
  /\bdejarte\b.*\bsol[oa]\b/,
  /\b(?:quedas|quedaras|vas a quedar|te quedas)\b.*\bsol[oa]\b/,
  /\b(?:continua|sigue|segui)\s+(?:trabajando\s+)?(?:(?:unas?|por|como|las)\s+)?(?:\d+\s+)?(?:horas?\s+)?sol[oa]\b/,
  /\b(?:me voy a ausentar|voy a ausentarme|ausentarme|me ausento|voy a estar ausente|estare ausente)\b/,
  /\b(?:me voy|voy|me ire|me vaya)\s+a\s+(?:ir\s+a\s+)?(?:dormir|descansar|acostar(?:me)?|banar(?:me)?|almorzar|cenar|comer|salir)\b/,
  /\bme voy\s+(?:unas?|por|como|\d)/,
  /\b(?:ya|ahora|luego|despues)\s+(?:regreso|vuelvo)\b/,
  /\bvuelvo\s+(?:en|mas tarde|luego|manana)\b/,
  /\bte respondo\b.*\b(?:despues|luego|mas tarde|manana|cuando vuelva)\b/,
  /\b(?:i'?m|i am|i'?ll be|i will be)\s+(?:away|out|off|offline|gone|leaving)\b/,
  /\b(?:leaving|leave)\s+you\b/,
  /\b(?:i'?ll|i will)\s+be\s+back\b/,
  /\bback in\s+(?:an?|\d)/,
  /\b(?:going|heading)\s+(?:to\s+(?:sleep|bed)|offline|out|away)\b/,
  /\b(?:keep|carry on)\s+(?:going|working)\s+(?:alone|on your own|without me)\b/,
  /\byou'?re on your own\b/,
  /\bbrb\b/,
];
const BACK = [
  /\bya\s+(?:llegue|regrese|volvi|estoy\s+(?:de\s+vuelta|aqui|aca))\b/,
  /\b(?:estoy|ando)\s+de\s+(?:vuelta|regreso)\b/,
  /\b(?:he|ya he)\s+(?:vuelto|regresado|llegado)\b/,
  /\b(?:i'?m|i am)\s+back\b/,
  /\bback now\b/,
  /\bi'?ve\s+(?:returned|come back|got back)\b/,
];
// What, before a match in its clause, makes it a supposition: "si te digo que me voy", "cuando vuelva y te diga que ya
// volvi", "contando con que yo te dejo solo".
const SUPPOSED = /\b(?:si (?:te|yo|me|le)\b|contando con que|cuando (?:vuelva|regrese|llegue|me vaya|te deje|te diga)|te diga que|if i\b|when i\b|whenever i\b)/;
// Clauses end at these; a clause that ends in "?" asks.
const CLAUSE = /[^.!?;,\n¿¡]+[.!?;,\n]*/g;
const OTHER_WORDS = /<system-reminder>[\s\S]*?<\/system-reminder>/g;

/** `text` as the patterns read it: what he pasted or the host added left out, lowercased, without accents. */
const plain = (text) => String(text).replace(PASTED_CONTENT, ' ').replace(OTHER_WORDS, ' ').toLowerCase()
  .normalize('NFD').replace(/\p{M}/gu, '').replace(/[‘’]/g, "'");

/** What the message `text` says of where he is: `'away'` when he leaves or will be away, `'back'` when he is back,
 * `null` when neither; when it says both, the later wins ("ya llegue, pero ahora me voy a dormir"). */
export function saidAway(text) {
  let found = null;
  let offset = 0;
  for (const clause of plain(text).match(CLAUSE) ?? []) {
    const start = offset;
    offset += clause.length;
    if (/\?\s*$/.test(clause)) continue;
    for (const [kind, patterns] of [['away', LEAVING], ['back', BACK]]) {
      for (const pattern of patterns) {
        const match = pattern.exec(clause);
        if (match === null || SUPPOSED.test(clause.slice(0, match.index))) continue;
        const at = start + match.index;
        if (found === null || at >= found.at) found = { kind, at };
      }
    }
  }
  return found?.kind ?? null;
}

/** Where his messages (`{ at, text }`, oldest first) leave him: `{ kind, at, text }` of the newest that says he leaves
 * or is back, or `null` when none does. A departure ends unsaid when a message of his comes after a gap longer than the
 * return check's absence (`ABSENCE_MS`): he came back without saying so, and nothing is asked. */
export function awayState(messages) {
  let state = null;
  for (let i = 0; i < messages.length; i += 1) {
    const kind = saidAway(messages[i].text);
    if (kind !== null) state = { kind, at: messages[i].at, text: messages[i].text };
    else if (state?.kind === 'away' && i > 0 && Date.parse(messages[i].at) - Date.parse(messages[i - 1].at) > ABSENCE_MS) state = null;
  }
  return state;
}

const hhmm = (iso) => new Date(iso).toISOString().slice(11, 16);
const quoted = (text) => {
  const one = String(text).replace(PASTED_CONTENT, ' ').replace(/\s+/g, ' ').trim();
  return one.length > 80 ? `${one.slice(0, 79)}…` : one;
};

/** The open stretch's `open` event in the stretch record of `slug` under `home`, or `null`; a record that is there and
 * cannot be read throws. */
function openOf(home, slug, readFile) {
  let text;
  try {
    text = readFile(stretchFile(home, slug));
  } catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw new Error(`the stretch record (${stretchFile(home, slug)}): ${err?.code ?? err?.message}`);
  }
  return openEvent(eventsOf(text));
}

/** The warning for a stop of `payload`, or `null` when none is due. The records are read through `io` (`readFile`,
 * `run`, `env`, `homedir`, and `readNotices` and `mainCheckout` when the hook shares them); one that cannot be read
 * throws, and the hook says so. `state`, the close of the reply, is not read: a stretch comes first, whatever the reply
 * closes with. */
export function awayStretchWarning(payload, state, io) {
  // Codex sends no background tasks.
  if (!Array.isArray(payload?.background_tasks)) return null;
  if (typeof payload.session_id !== 'string' || payload.session_id === '') return null;
  if (typeof payload.transcript_path !== 'string' || payload.transcript_path === '') return null;

  const cwd = typeof payload.cwd === 'string' && payload.cwd !== '' ? payload.cwd : process.cwd();
  const home = harnessHome({ env: io.env, homedir: io.homedir });
  const slug = projectSlug(io.mainCheckout?.(cwd) ?? mainCheckout(io.run, cwd));
  const record = (io.readNotices ?? readNotices)(home, slug, { readFile: io.readFile });
  if (record.unavailable !== undefined) throw new Error(`the record of notices (${record.path}): ${record.unavailable}`);
  if (!isLeadSession(record.notices, payload.session_id)) return null;

  const where = awayState(personMessagesIn(io.readFile(payload.transcript_path)));
  if (where === null) return null;
  const open = openOf(home, slug, io.readFile);
  const words = `("${quoted(where.text)}", at ${hhmm(where.at)} UTC)`;
  if (where.kind === 'away') {
    if (open !== null) return null;
    return `js-harness reply: ${AWAY_MARKER} ${words} and no stretch is open (rule:away-autonomy). Before he leaves, `
      + 'write the plan and open one with `js-harness stretch open --plan <file> --html <file>`, then show its departure '
      + 'page in your reply. This is said at every stop until a stretch is open or he is back.';
  }
  if (open === null || !(Date.parse(open.at) < Date.parse(where.at))) return null;
  return `js-harness reply: ${BACK_MARKER} ${words} and the stretch ${open.id}, opened before it, is still open `
    + '(rule:away-autonomy). Before anything else, close it with `js-harness stretch close --html <file>` and show its '
    + 'return page. This is said at every stop until it is closed.';
}
