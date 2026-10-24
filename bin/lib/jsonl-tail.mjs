// The end of a JSON-lines file that js-harness appends to and that its hooks read: how much of the end a read
// may take, and whether a write that was cut short left the last line unterminated. Shared by the writers of
// channel, codex reviews and the gate log, and by the hooks that read a transcript's end.
import fs from 'node:fs';

/** The most of a transcript's end that a hook reads, in bytes. The hooks run after every tool call, so a file of
 * megabytes costs what this many bytes cost: the end is all they may look at. */
export const END_BYTES = 262144;

/** Whether `file` is there, is not empty and does not end with a line break: what a write that was cut short
 * leaves. `false` for a file that cannot be looked at, since the line is appended all the same. `io` is the file
 * system the look goes through (`fs` by default). */
export function endsUnterminated(file, io = fs) {
  let fd;
  try {
    fd = io.openSync(file, 'r');
    const { size } = io.fstatSync(fd);
    if (size === 0) return false;
    const last = Buffer.alloc(1);
    io.readSync(fd, last, 0, 1, size - 1);
    return last[0] !== 0x0a;
  } catch {
    return false;
  } finally {
    try {
      if (fd !== undefined) io.closeSync(fd);
    } catch {
      // the look is over either way, and it must not cost the caller its line
    }
  }
}
