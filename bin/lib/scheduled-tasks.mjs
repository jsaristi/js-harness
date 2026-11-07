// Windows scheduled tasks as js-harness reads and removes them: the task it registers only when asked (the watchdog of
// `remote start --at-login`), looked at and deleted through `schtasks.exe`, and the test guard every runner of a real
// command checks. Moved out of bin/lib/manifest.mjs whole, which re-exports it, when that file reached its size
// ceiling (odd/tasks/f8-s4a-hook-count.md); the records of the tasks stay there.
import path from 'node:path';
import { spawnSync as spawnChildSync } from 'node:child_process';

/** Windows does not tell two task names apart by the case of their letters. */
export const sameTaskName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

/** Whether two tasks run the same thing: the program and its arguments, to the letter. `null` (a task that does
 * not run one command) is the same as nothing. */
export const sameTaskAction = (a, b) => Boolean(a && b) && a.command === b.command && a.arguments === b.arguments;

/** `<SystemRoot>\System32`, from the `SystemRoot` (or `windir`) of `env` and nothing else, or `null` when `env`
 * does not give an absolute one: where Windows keeps `schtasks.exe` and `conhost.exe`. */
export function windowsSystem32(env) {
  const names = Object.keys(env);
  const key = names.find((name) => /^systemroot$/i.test(name)) ?? names.find((name) => /^windir$/i.test(name));
  const root = key === undefined ? '' : String(env[key]).trim();
  return path.win32.isAbsolute(root) ? path.win32.join(root, 'System32') : null;
}

/** Whether this process is a test: a file run by `node --test` (which sets `NODE_TEST_CONTEXT` for it), or a
 * test file run directly. */
export const underTest = () => process.env.NODE_TEST_CONTEXT !== undefined || /\.test\.[cm]?js$/.test(process.argv[1] ?? '');

/** What `schtasks.exe` printed, as text: UTF-16 when it starts with that mark or reads as it, else one character
 * a byte. Only ASCII is ever compared, and that is the same either way. */
function printed(stdout) {
  if (!Buffer.isBuffer(stdout)) return String(stdout ?? '');
  if (stdout.length >= 2 && stdout[0] === 0xff && stdout[1] === 0xfe) return stdout.subarray(2).toString('utf16le');
  return stdout.length >= 2 && stdout[1] === 0 ? stdout.toString('utf16le') : stdout.toString('latin1');
}

/** Runs `schtasks.exe` with `args` and returns `{ status, stdout }`: the seam everything that registers, reads
 * or deletes a scheduled task goes through. The program is the one in the `System32` of the `SystemRoot` of `env`
 * (the environment the command was given), run with no shell; it is never looked for on `PATH`. Throws when `env`
 * names no such folder, and when the program could not run. Its messages come in the system's language, so
 * callers read the exit code and the XML and CSV it prints, never its words.
 *
 * It registers and deletes tasks on the machine it runs on, so a test never runs the real one: with no
 * `spawnSync` injected this refuses in a test process, and that comes first, before the environment is looked
 * at, so the refusal is the same on every host. */
export function runSchtasks(args, { env = process.env, spawnSync: sync } = {}) {
  if (sync === undefined && underTest()) throw new Error('the real schtasks.exe is never run from a test: this one has to hand in a fake');
  const system32 = windowsSystem32(env);
  if (!system32) throw new Error('SystemRoot is not set to an absolute folder in the environment, so schtasks.exe cannot be found: it is never looked for on PATH');
  // Half a minute at most: the command that waits holds its project's lock meanwhile. The list of every task, the
  // longest answer, took about a second and 23 KB on a machine with 217 of them (2026-10-06), far under the 1 MB
  // of output `spawnSync` takes by default, so that limit is left as it is.
  const result = (sync ?? spawnChildSync)(path.win32.join(system32, 'schtasks.exe'), args, { windowsHide: true, timeout: 30000 });
  if (result.error) throw new Error(`schtasks.exe could not run: ${result.error.message}`);
  return { status: result.status, stdout: printed(result.stdout) };
}

const XML_NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const xmlValue = (text) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name) => {
  if (name[0] !== '#') return XML_NAMED[name] ?? whole;
  return String.fromCodePoint(/^#x/i.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
});

/** What the task of the definition `xml` (what `schtasks /Query /TN <name> /XML` prints) runs: `{ command,
 * arguments }`, the two as they were registered, or `null` when it does not run exactly one command (no action,
 * several, or one of another kind): such a task is not one js-harness registered. */
export function scheduledTaskAction(xml) {
  const actions = /<Actions\b[^>]*>(.*?)<\/Actions>/s.exec(String(xml))?.[1];
  if (actions === undefined) return null;
  const commands = actions.match(/<Exec\b[^>]*>.*?<\/Exec>/gs) ?? [];
  if (commands.length !== 1 || actions.replace(commands[0], '').trim() !== '') return null;
  const value = (tag) => new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(commands[0])?.[1];
  const command = value('Command');
  return command === undefined ? null : { command: xmlValue(command), arguments: xmlValue(value('Arguments') ?? '') };
}

/** Whether a task named `name` is registered (at the root of the task folders, where js-harness puts its own),
 * and what it runs: `{ found: 'absent' }`, `{ found: 'present', action }` (see `scheduledTaskAction`), or
 * `{ found: 'unknown', why }`. It only looks.
 *
 * `absent` has to be proven, because it is what lets a caller forget a record or register a task: the list of
 * every task ran (exit 0) and no row of it has that name. Asking for the task by name would not do: `schtasks`
 * fails the same way for a task that is not there and for a look that went wrong, and says which only in the
 * system's language. So the name is read from the list, where it is a literal, and only a task that is listed is
 * then asked for. Whatever else happens (the list failed, the task is listed and cannot be read, `schtasks`
 * could not run) is `unknown`. */
export function lookAtScheduledTask(name, schtasks) {
  try {
    const list = schtasks(['/Query', '/FO', 'CSV']);
    if (list.status !== 0) return { found: 'unknown', why: `the scheduled tasks could not be listed (schtasks /Query /FO CSV exited ${list.status})` };
    const listed = String(list.stdout).split(/\r?\n/).some((row) => sameTaskName(/^"((?:[^"]|"")*)"/.exec(row)?.[1] ?? '', `\\${name}`));
    if (!listed) return { found: 'absent' };
    const read = schtasks(['/Query', '/TN', name, '/XML']);
    if (read.status !== 0) return { found: 'unknown', why: `the task ${name} is listed and could not be read (schtasks /Query /TN ${name} /XML exited ${read.status})` };
    return { found: 'present', action: scheduledTaskAction(read.stdout) };
  } catch (err) {
    return { found: 'unknown', why: err.message };
  }
}

/** Deletes the task of the record `task` while it still runs the recorded command. Returns `{ status }`:
 * `removed`; `absent` when no such task is registered (its record is all there was); or `kept`, with `reason`:
 * `edited` (it runs something else now, so it is the user's), `unknown` (it could not be looked at, and nothing
 * is deleted on a guess) or `unremovable` (the delete failed), the last two with `why`. `look` is what
 * `lookAtScheduledTask` answered, when the caller already asked. */
export function removeScheduledTask(task, schtasks, look = lookAtScheduledTask(task.name, schtasks)) {
  if (look.found === 'unknown') return { status: 'kept', reason: 'unknown', why: look.why };
  if (look.found === 'absent') return { status: 'absent' };
  if (!sameTaskAction(look.action, task)) return { status: 'kept', reason: 'edited' };
  try {
    const deleted = schtasks(['/Delete', '/TN', task.name, '/F']);
    if (deleted.status !== 0) return { status: 'kept', reason: 'unremovable', why: `schtasks /Delete /TN ${task.name} /F exited ${deleted.status}` };
  } catch (err) {
    return { status: 'kept', reason: 'unremovable', why: err.message };
  }
  return { status: 'removed' };
}
