// The rows that say what a gate's sensors left and what they did not run: the row of a gate that ran no sensor
// because the tree is one an earlier gate passed, the row of a commit that holds documents alone, and the rows
// that name the untracked paths and the WSL2 mirror a sensor left behind. They are built from what `check` already
// found and fail nothing, so they live apart from the gate's own rows (bin/check.mjs), which kept growing past its
// size ceiling (bin/conventions-structure.test.mjs). A module under bin/lib does not import a command.

/** `iso` as a row says it: the local day and time, to the minute. */
export function rowTime(iso) {
  const at = new Date(iso);
  const two = (number) => String(number).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** The one row of a gate that ran no sensor because another gate ran them on the same tree and all
 * passed: which `sensors` did not run, and the gate that is the proof (`provenBy`), by the id of its
 * lines in the gate log, when it ended and, where the log still says it, in which folder. */
export function sameTreeRow(sensors, proof) {
  const where = proof.cwd ? ` in ${proof.cwd}` : '';
  return {
    name: 'sensors',
    pass: true,
    info: true,
    detail: `no sensor ran (${sensors.map((sensor) => sensor.name).join(', ')}): this tree is the one gate ${proof.id.slice(0, 8)} passed on ${rowTime(proof.at)}${where}, file for file (harness.json "sameTree")`,
  };
}

// How many paths a row that lists paths of the repository names (the staged documents of a gate that ran
// no sensor, the untracked paths that appeared while the sensors ran); the rest are counted.
const PATHS_NAMED = 10;

/** `paths` as the lines under a row: the first `PATHS_NAMED` of them, and how many more there are. A name
 * with a control character in it is shown as JSON: it comes from the repository, and a line break in it
 * would read as another row of the report. */
function namedPaths(paths) {
  const named = paths.slice(0, PATHS_NAMED).map((file) => (/\p{Cc}/u.test(file) ? JSON.stringify(file) : file));
  const more = paths.length - named.length;
  return [...named, ...(more > 0 ? [`and ${more} more`] : [])];
}

/** The first row of a gate that ran none of the project's `sensors` because the commit holds documents
 * alone: which did not run, and for which staged `paths` (`namedPaths`). With `quick`, the sensors of
 * documents that ran in their place (`discoverDocumentSensors`), it names those as well, and says that
 * no gate lock was taken for them; their own rows follow this one. */
export function documentsRow(sensors, { paths, side }, quick = []) {
  const staged = side
    ? (paths.length === 1 ? `the one path this commit changes against ${side} is a document` : `all ${paths.length} paths this commit changes against ${side} are documents`)
    : (paths.length === 1 ? 'the one staged path is a document' : `all ${paths.length} staged paths are documents`);
  const declared = `${staged} declared in harness.json "documents"`;
  const names = (list) => list.map((sensor) => sensor.name).join(', ');
  let detail = `no sensor ran (${names(sensors)}): ${declared}`;
  if (quick.length > 0) {
    detail = sensors.length > 0
      ? `the sensors did not run (${names(sensors)}): ${declared}; its "documentSensors" ran in their place (${names(quick)}), with no gate lock taken`
      : `${declared}: its "documentSensors" ran (${names(quick)}), with no gate lock taken`;
  }
  return { name: 'sensors', pass: true, info: true, detail, lines: namedPaths(paths) };
}

/** The row named `tree` of a gate whose sensors left something in the working tree: the untracked paths
 * that are in `after` and were not in `before` (`untrackedPaths`, asked before the first sensor and after
 * the last). No row when none appeared, or when git did not say either time: a tree that could not be
 * looked at is not one that is clean, and is not said to be.
 *
 * It informs and fails nothing. A test that writes into the folder it runs in leaves a file the next
 * commit finds untracked, with nothing to say where it came from: a gate once left
 * `Microsoft/Windows/PowerShell/ModuleAnalysisCache` in its tree. A gate that prints no such row is the
 * proof that its sensors left nothing. */
export function treeRows(before, after) {
  if (!before || !after) return [];
  const appeared = [...after].filter((file) => !before.has(file));
  if (appeared.length === 0) return [];
  const [paths, them] = appeared.length === 1 ? ['1 untracked path', 'it'] : [`${appeared.length} untracked paths`, 'them'];
  return [{ name: 'tree', pass: true, info: true, detail: `${paths} appeared in the working tree while the sensors ran (a test may have written ${them})`, lines: namedPaths(appeared) }];
}

/** The row that names what the sensors left in their WSL2 mirror (`leftPaths` of `./lib/gate-wsl.mjs`),
 * as `treeRows` names what appeared in the Windows tree: the suite writes into the mirror, so a test that
 * litters the tree is seen there. None when nothing was left or nothing ran there. */
export function mirrorRows(ran) {
  const left = ran.flatMap((row) => row.left ?? []);
  if (left.length === 0) return [];
  const [paths, them] = left.length === 1 ? ['1 path', 'it'] : [`${left.length} paths`, 'them'];
  return [{ name: 'tree', pass: true, info: true, detail: `${paths} appeared in the WSL2 mirror while the sensors ran (a test may have written ${them})`, lines: namedPaths(left) }];
}
