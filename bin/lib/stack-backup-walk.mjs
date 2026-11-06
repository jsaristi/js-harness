// The strict half of `js-harness stack backup` (odd/tasks/f8-s2-removal.md, T2, depth pass item 1): a walker that
// throws on any entry it cannot read and keeps links and junctions as links, a copy that hashes and classifies a file
// in one pass, and the independent counts a backup's own count is held to. `walk` in backup.mjs is the wrong tool
// here: it returns `[]` for a folder it cannot read and drops links, so a manifest built on it would verify a backup
// missing files. Reads and copies files; the PowerShell count spawns `powershell.exe`.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import { redactSecrets } from './backup.mjs';

/** How much of a file one read takes, and how much text of the last read a scan keeps, so a key cut by a read is
 * still read whole. */
const CHUNK = 4 * 1024 * 1024;
const CARRY = 64 * 1024;
/** A file is text when none of its first bytes is NUL, as git tells binary files. */
const SNIFF = 8000;

/** Whether `child` is `parent` or inside it; case-blind on Windows. */
export function inside(child, parent, platform = process.platform) {
  const norm = (p) => (platform === 'win32' ? path.win32.resolve(p).toLowerCase() : path.posix.resolve(p));
  const rel = (platform === 'win32' ? path.win32 : path.posix).relative(norm(parent), norm(child));
  return rel === '' || (!rel.startsWith('..') && !(platform === 'win32' ? path.win32 : path.posix).isAbsolute(rel));
}

/** `fn()`, or a throw that names `where` and what failed: a backup never goes on with a shorter list. */
function strictly(where, what, fn) {
  try {
    return fn();
  } catch (error) {
    throw new Error(`could not ${what} ${where}: ${error.code ?? error.message}`, { cause: error });
  }
}

/** Whether a top-level name of a root is in it: `include` keeps only the names it lists, `exclude` drops them. */
const kept = (name, { include, exclude }) => (!include || include.includes(name)) && !(exclude ?? []).includes(name);

/** Every file and link under `from`, as `{ present, files: [{ path, source }], links: [{ path, target, source }] }`,
 * paths relative and posix. A root that is one file is listed by its own name; a root that does not exist is
 * `present: false`. `filter` (`include`, `exclude`) applies to the top-level names of a folder root. Throws, naming
 * the path, on any entry it cannot read or that is no file, folder or link; a link is never followed. */
export function walkRoot(from, filter = {}, fsx = fs) {
  let stat;
  try {
    stat = fsx.lstatSync(from);
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false, files: [], links: [] };
    throw new Error(`could not read ${from}: ${error.code ?? error.message}`, { cause: error });
  }
  const files = [];
  const links = [];
  const visit = (full, rel, st) => {
    if (st.isSymbolicLink()) links.push({ path: rel, target: strictly(full, 'read the link', () => fsx.readlinkSync(full)), source: full });
    else if (st.isFile()) files.push({ path: rel, source: full });
    else if (st.isDirectory()) {
      const names = strictly(full, 'list', () => fsx.readdirSync(full)).sort();
      for (const name of names) {
        if (rel === '' && !kept(name, filter)) continue;
        const child = path.join(full, name);
        visit(child, rel === '' ? name : `${rel}/${name}`, strictly(child, 'read', () => fsx.lstatSync(child)));
      }
    } else throw new Error(`${full} is neither a file, a folder nor a link: refused, the backup copies only those`);
  };
  if (stat.isFile()) files.push({ path: path.basename(from), source: from });
  else visit(from, '', stat);
  return { present: true, files, links };
}

/** Copies `source` to `target` in chunks, hashing it and, when it is text, reading it for a secret `redactSecrets`
 * names; the copy keeps the source's times and, outside Windows, its mode, so a program in `~/bin` still runs once
 * restored. On Windows a mode is only a read-only bit, kept off so a drill can remove its scratch copy. Returns
 * `{ bytes, sha256, flagged }`; throws naming the file. */
export function copyAndHash(source, target, { fsx = fs, chunk = CHUNK, platform = process.platform } = {}) {
  fsx.mkdirSync(path.dirname(target), { recursive: true });
  const hash = createHash('sha256');
  let decoder = new StringDecoder('utf8');
  const buffer = Buffer.alloc(chunk);
  let bytes = 0;
  let text = null;
  let carry = '';
  let flagged = false;
  const input = strictly(source, 'open', () => fsx.openSync(source, 'r'));
  try {
    const output = strictly(target, 'create', () => fsx.openSync(target, 'w'));
    try {
      for (;;) {
        const read = strictly(source, 'read', () => fsx.readSync(input, buffer, 0, chunk, null));
        if (read === 0) break;
        const part = buffer.subarray(0, read);
        if (text === null) {
          // UTF-16 with its byte order mark, as PowerShell writes a file, is text though it holds NUL bytes (the
          // independent verifier on 84997f7..45d764f); little-endian, the one Windows writes.
          const utf16 = part[0] === 0xff && part[1] === 0xfe;
          if (utf16) decoder = new StringDecoder('utf16le');
          text = utf16 || !part.subarray(0, SNIFF).includes(0);
        }
        hash.update(part);
        // A write may take part of the chunk, as on a disk near full; one that takes nothing stops the copy.
        for (let written = 0; written < read;) {
          const took = strictly(target, 'write', () => fsx.writeSync(output, part, written, read - written));
          if (!(took > 0)) throw new Error(`cannot write ${target}: the write took no bytes`);
          written += took;
        }
        bytes += read;
        if (text && !flagged) {
          const window = carry + decoder.write(part);
          flagged = redactSecrets(window).kinds.length > 0;
          carry = window.slice(-CARRY);
        }
      }
    } finally {
      fsx.closeSync(output);
    }
  } finally {
    fsx.closeSync(input);
  }
  const { atime, mtime, mode } = strictly(source, 'read', () => fsx.statSync(source));
  if (platform !== 'win32') strictly(target, 'chmod', () => fsx.chmodSync(target, mode & 0o7777));
  fsx.utimesSync(target, atime, mtime);
  return { bytes, sha256: hash.digest('hex'), flagged };
}

/** The sha256 of a file, read in chunks so a file of any size is hashed. */
export function hashFile(file, fsx = fs) {
  const hash = createHash('sha256');
  const buffer = Buffer.alloc(CHUNK);
  const fd = strictly(file, 'open', () => fsx.openSync(file, 'r'));
  try {
    for (let read; (read = fsx.readSync(fd, buffer, 0, CHUNK, null)) > 0;) hash.update(buffer.subarray(0, read));
  } finally {
    fsx.closeSync(fd);
  }
  return hash.digest('hex');
}

/** The files and bytes under a root `{ from, include, exclude }`, links left out, by a recursion of its own on
 * `readdirSync`'s entry types: the count elsewhere than Windows. */
export function plainCount(root) {
  let stat;
  try {
    stat = fs.lstatSync(root.from);
  } catch {
    return { files: 0, bytes: 0 };
  }
  if (stat.isFile()) return { files: 1, bytes: stat.size };
  if (stat.isSymbolicLink()) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  const stack = [[root.from, true]];
  while (stack.length > 0) {
    const [dir, top] = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (top && !kept(entry.name, root)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push([full, false]);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(full).size;
      }
    }
  }
  return { files, bytes };
}

// .NET's own enumeration, no reparse point entered or counted: the count Node's walk is checked against on Windows.
// The `\\?\` prefix lets Windows PowerShell's .NET read a path past 260 characters, as Node does.
const COUNT_SCRIPT = `$ErrorActionPreference = 'Stop'
$inc = @(if ($env:JH_COUNT_INCLUDE) { $env:JH_COUNT_INCLUDE -split '\\|' })
$exc = @(if ($env:JH_COUNT_EXCLUDE) { $env:JH_COUNT_EXCLUDE -split '\\|' })
$t = @{ n = [long]0; b = [long]0 }
$p = '\\\\?\\' + $env:JH_COUNT_ROOT
$item = if ([IO.Directory]::Exists($p)) { New-Object IO.DirectoryInfo $p } elseif ([IO.File]::Exists($p)) { New-Object IO.FileInfo $p } else { $null }
if ($item) {
  if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    if ($item -is [IO.DirectoryInfo]) {
      $stack = New-Object 'System.Collections.Stack'
      $stack.Push(@($item, $true))
      while ($stack.Count -gt 0) {
        $pair = $stack.Pop()
        foreach ($e in $pair[0].EnumerateFileSystemInfos()) {
          if ($pair[1] -and $inc.Count -gt 0 -and $inc -notcontains $e.Name) { continue }
          if ($pair[1] -and $exc -contains $e.Name) { continue }
          if ($e.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
          if ($e -is [IO.DirectoryInfo]) { $stack.Push(@($e, $false)) } else { $t.n++; $t.b += $e.Length }
        }
      }
    } else { $t.n = 1; $t.b = $item.Length }
  }
}
"$($t.n) $($t.b)"`;

/** The files and bytes under a root by PowerShell's .NET enumeration, links and junctions left out: the default
 * independent count on Windows. Throws when PowerShell fails or prints no count. */
export function powershellCount(root, spawn = spawnSync) {
  const encoded = Buffer.from(COUNT_SCRIPT, 'utf16le').toString('base64');
  const env = { ...process.env, JH_COUNT_ROOT: root.from, JH_COUNT_INCLUDE: (root.include ?? []).join('|'), JH_COUNT_EXCLUDE: (root.exclude ?? []).join('|') };
  const result = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { env, encoding: 'utf8', windowsHide: true, maxBuffer: 1024 * 1024 });
  const counted = /^(\d+) (\d+)\s*$/m.exec(result.stdout ?? '');
  if (result.status !== 0 || !counted) throw new Error(`the independent count of ${root.from} failed: ${String(result.stderr || result.error || 'no count').trim().split('\n')[0]}`);
  return { files: Number(counted[1]), bytes: Number(counted[2]) };
}
