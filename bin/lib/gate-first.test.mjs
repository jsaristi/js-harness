import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GateFirstError, GATE_FIRST_MAX_MINUTES, cancelTicket, claimTicket, gateFirstDir, issueTicket, readTickets } from './gate-first.mjs';

const AT = Date.parse('2026-10-16T10:00:00.000Z');
const MINUTE = 60_000;

function withHome(run) {
  return async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'js-harness-gate-first-'));
    try {
      await run(home);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  };
}

/** A clock the test moves. */
function clockAt(start = AT) {
  let at = start;
  return { now: () => at, advance: (ms) => { at += ms; } };
}

/** Ids handed out in order, so a test knows each ticket's name. */
function ids(...names) {
  const left = [...names];
  return () => left.shift();
}

const issue = (home, clock, fields, id) => issueTicket({ home, now: clock.now, id: () => id, reason: 'unblocks the others', ...fields });

test('a ticket is one file under <home>/.js-harness/gate-first, and reading lists it as open with what it says', withHome((home) => {
  const clock = clockAt();
  const { ticket, expired } = issue(home, clock, { session: 'sess-a', tree: 'D:\\work\\a', by: 'sess-orq', minutes: 30 }, '0a0a0a0a');
  assert.deepEqual(expired, []);
  assert.deepEqual(ticket, {
    v: 1,
    id: '0a0a0a0a',
    session: 'sess-a',
    tree: path.resolve('D:\\work\\a'),
    reason: 'unblocks the others',
    by: 'sess-orq',
    issuedAt: '2026-10-16T10:00:00.000Z',
    until: '2026-10-16T10:30:00.000Z',
  });
  assert.deepEqual(fs.readdirSync(gateFirstDir(home)), ['0a0a0a0a.json']);
  assert.deepEqual(readTickets(home, { now: clock.now }), { open: [ticket], expired: [], unreadable: [] });
}));

test('a ticket is for 60 minutes when not told, never longer, and needs a session and a reason', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  assert.equal(ticket.until, new Date(AT + GATE_FIRST_MAX_MINUTES * MINUTE).toISOString());
  assert.equal(ticket.tree, null);
  assert.equal(ticket.by, null);
  for (const [fields, said] of [
    [{ session: 'sess-b', minutes: 61 }, /--minutes takes a number from 1 to 60/],
    [{ session: 'sess-b', minutes: 0 }, /--minutes takes a number from 1 to 60/],
    [{ session: '' }, /a session id/],
    [{ session: 'sess-b', reason: '  ' }, /a reason/],
  ]) {
    assert.throws(() => issue(home, clock, fields, '0b0b0b0b'), (err) => err instanceof GateFirstError && said.test(err.message));
  }
  assert.deepEqual(fs.readdirSync(gateFirstDir(home)), ['0a0a0a0a.json']);
}));

test('two tickets at most are open: a third is refused, naming the two in the order they were issued', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  clock.advance(1000);
  issue(home, clock, { session: 'sess-b' }, '0b0b0b0b');
  assert.throws(
    () => issue(home, clock, { session: 'sess-c' }, '0c0c0c0c'),
    (err) => err instanceof GateFirstError && /two tickets are open already: 0a0a0a0a \(session sess-a.*\), 0b0b0b0b \(session sess-b/.test(err.message),
  );
  assert.deepEqual(readTickets(home, { now: clock.now }).open.map((ticket) => ticket.id), ['0a0a0a0a', '0b0b0b0b']);
}));

// Codex, 2026-10-16 (P2): the count of open tickets was read before the write, so two issuers at once could
// both see one and both write. Each now counts again after its rename, and one that sees three goes, even
// when the other was issued later: that other counted before this write, saw two and kept its ticket.
test('two issues at once leave two tickets open: the one that sees three after its write removes itself and is refused', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  clock.advance(MINUTE);
  const dir = gateFirstDir(home);
  // Another issuer, a moment earlier, writes its ticket between this one's count and its rename.
  const racing = {
    ...fs,
    renameSync: (from, to) => {
      if (to.endsWith('0c0c0c0c.pending')) {
        // Codex's recheck: a ticket that is counted after it is claimable could be claimed in between. It
        // is counted under a name no gate claims, before it is one.
        assert.equal(fs.existsSync(path.join(dir, '0c0c0c0c.json')), false, 'never claimable before the count');
        fs.writeFileSync(path.join(dir, '0b0b0b0b.json'), `${JSON.stringify({ v: 1, id: '0b0b0b0b', session: 'sess-b', tree: null, reason: 'raced', by: null, issuedAt: new Date(clock.now() + 1).toISOString(), until: new Date(clock.now() + 30 * MINUTE).toISOString() })}\n`);
      }
      return fs.renameSync(from, to);
    },
  };
  assert.throws(
    () => issueTicket({ home, now: clock.now, id: () => '0c0c0c0c', session: 'sess-c', reason: 'late', fileSystem: racing }),
    (err) => err instanceof GateFirstError && /^two tickets are open already: 0a0a0a0a .*, 0b0b0b0b /.test(err.message),
  );
  assert.deepEqual(readTickets(home, { now: clock.now }).open.map((ticket) => ticket.id), ['0a0a0a0a', '0b0b0b0b']);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['0a0a0a0a.json', '0b0b0b0b.json'], 'no draft is left');
}));

test('an issue waits in a name no gate claims while it counts, and one left there by an issue that died counts for a minute only', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const dir = gateFirstDir(home);
  const pending = (id, at) => fs.writeFileSync(path.join(dir, `${id}.pending`), `${JSON.stringify({ v: 1, id, session: 'sess-x', tree: null, reason: 'died', by: null, issuedAt: new Date(at).toISOString(), until: new Date(at + 30 * MINUTE).toISOString() })}\n`);
  // One that is still counting holds its place: a second issue now would make three.
  pending('0e0e0e0e', clock.now());
  assert.throws(() => issue(home, clock, { session: 'sess-c' }, '0c0c0c0c'), GateFirstError);
  assert.equal(claimTicket({ home, session: 'sess-x', cwd: home, now: clock.now }).ticket, null, 'a pending ticket is never claimed');
  // A minute on, it is an issue that died, and it is removed.
  clock.advance(MINUTE + 1);
  issue(home, clock, { session: 'sess-c' }, '0c0c0c0c');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['0a0a0a0a.json', '0c0c0c0c.json']);
}));

// Codex, 2026-10-16 (P2): a claim or a cancel removes the folder with its last ticket, which could happen between
// this issue's making of the folder and its write. The write is tried again in a folder made again.
test('an issue whose folder goes between its making and the write makes it again and writes the ticket', withHome((home) => {
  const clock = clockAt();
  const dir = gateFirstDir(home);
  let removed = 0;
  const removing = {
    ...fs,
    writeFileSync: (file, ...rest) => {
      if (removed === 0) {
        removed += 1;
        fs.rmdirSync(dir);
      }
      return fs.writeFileSync(file, ...rest);
    },
  };
  const { ticket } = issueTicket({ home, now: clock.now, id: () => '0d0d0d0d', session: 'sess-d', reason: 'unblocks', fileSystem: removing });
  assert.equal(removed, 1);
  assert.deepEqual(readTickets(home, { now: clock.now }).open, [ticket]);
}));

test('a ticket left in place past its expiry is gone: reading calls it expired, and the next issue removes it and says so', withHome((home) => {
  const clock = clockAt();
  const { ticket: old } = issue(home, clock, { session: 'sess-a', minutes: 5 }, '0a0a0a0a');
  issue(home, clock, { session: 'sess-b', minutes: 30 }, '0b0b0b0b');
  clock.advance(5 * MINUTE);
  const read = readTickets(home, { now: clock.now });
  assert.deepEqual([read.open.map((ticket) => ticket.id), read.expired], [['0b0b0b0b'], [old]]);
  // Reading removes nothing.
  assert.equal(fs.readdirSync(gateFirstDir(home)).length, 2);
  const { expired } = issue(home, clock, { session: 'sess-c' }, '0c0c0c0c');
  assert.deepEqual(expired, [old]);
  assert.deepEqual(fs.readdirSync(gateFirstDir(home)).sort(), ['0b0b0b0b.json', '0c0c0c0c.json']);
}));

test('a file that is no ticket is no ticket: it is named unreadable and counts against nothing', withHome((home) => {
  const clock = clockAt();
  fs.mkdirSync(gateFirstDir(home), { recursive: true });
  fs.writeFileSync(path.join(gateFirstDir(home), '0d0d0d0d.json'), '{"v":1,"id":"0d0d');
  fs.writeFileSync(path.join(gateFirstDir(home), '0e0e0e0e.json'), `${JSON.stringify({ v: 1, id: '0f0f0f0f', session: 's', tree: null, reason: 'r', by: null, issuedAt: new Date(AT).toISOString(), until: new Date(AT + MINUTE).toISOString() })}\n`);
  assert.deepEqual(readTickets(home, { now: clock.now }), { open: [], expired: [], unreadable: ['0d0d0d0d.json', '0e0e0e0e.json'] });
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  issue(home, clock, { session: 'sess-b' }, '0b0b0b0b');
  assert.equal(readTickets(home, { now: clock.now }).open.length, 2);
}));

test('a home with no tickets has none, and an id the folder does not hold cancels nothing', withHome((home) => {
  assert.deepEqual(readTickets(home, { now: () => AT }), { open: [], expired: [], unreadable: [] });
  assert.equal(cancelTicket({ home, id: '0a0a0a0a' }), null);
}));

test('a cancelled ticket is removed and returned, and the folder goes with the last one', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  assert.deepEqual(cancelTicket({ home, id: '0a0a0a0a' }), ticket);
  assert.equal(fs.existsSync(gateFirstDir(home)), false);
  assert.throws(() => cancelTicket({ home, id: '../x' }), GateFirstError);
}));

test('a gate claims the ticket of its session at once, which spends it: a second gate of the session finds none', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  issue(home, clock, { session: 'sess-b' }, '0b0b0b0b');
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\anywhere', now: clock.now }), { ticket, expired: [] });
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\anywhere', now: clock.now }), { ticket: null, expired: [] });
  assert.deepEqual(fs.readdirSync(gateFirstDir(home)), ['0b0b0b0b.json']);
}));

test('a ticket for a tree is claimed only by a gate of that tree, of its session; no session claims nothing', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a', tree: 'D:\\work\\a' }, '0a0a0a0a');
  assert.equal(claimTicket({ home, session: 'sess-a', cwd: 'D:\\work\\b', now: clock.now }).ticket, null);
  assert.equal(claimTicket({ home, session: 'sess-b', cwd: 'D:\\work\\a', now: clock.now }).ticket, null);
  assert.equal(claimTicket({ home, session: null, cwd: 'D:\\work\\a', now: clock.now }).ticket, null);
  const tree = process.platform === 'win32' ? 'd:\\WORK\\a\\' : 'D:\\work\\a';
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: tree, now: clock.now }).ticket, ticket);
}));

test('an expired ticket is not claimed: the claim removes it and says so', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a', minutes: 1 }, '0a0a0a0a');
  clock.advance(MINUTE);
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now }), { ticket: null, expired: [ticket] });
  assert.equal(fs.existsSync(gateFirstDir(home)), false);
}));

test('the claim is the rename of the file: of two gates that read the same ticket, the one whose rename fails has none', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  // The other gate's rename lands between this gate's reading of the folder and its own rename.
  const io = new Proxy(fs, {
    get: (target, name) => (name === 'renameSync'
      ? (from, to) => {
        if (path.basename(from) === '0a0a0a0a.json') target.renameSync(from, path.join(path.dirname(from), '0a0a0a0a.claimed-other'));
        return target.renameSync(from, to);
      }
      : target[name]),
  });
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, fileSystem: io }), { ticket: null, expired: [] });
}));

// A file another process holds open cannot be renamed on Windows for a moment (EPERM, EBUSY): that ticket is
// still there for the session, unlike one another gate claimed (ENOENT), so the claim tries it again, and one
// it still cannot take is said, not taken for no ticket in silence.
const failingRename = (codes) => {
  const left = [...codes];
  return new Proxy(fs, {
    get: (target, name) => (name === 'renameSync'
      ? (from, to) => {
        if (path.basename(from).endsWith('.json') && left.length > 0) throw Object.assign(new Error(left[0]), { code: left.shift() });
        return target.renameSync(from, to);
      }
      : target[name]),
  });
};

test('a claim whose rename meets a held file tries it again, and takes the ticket once the file is free', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const pauses = [];
  const io = failingRename(['EPERM', 'EBUSY']);
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, platform: 'win32', fileSystem: io, pause: (ms) => pauses.push(ms) }), { ticket, expired: [] });
  assert.equal(pauses.length, 2);
  assert.equal(fs.existsSync(gateFirstDir(home)), false, 'spent: the claim removed it');
}));

test('a ticket whose file stays held is not claimed, is said with the code, and stays open for the next check', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const io = failingRename(Array(10).fill('EBUSY'));
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, platform: 'win32', fileSystem: io, pause: () => {} }), { ticket: null, expired: [], unclaimed: [{ ticket, code: 'EBUSY' }] });
  assert.deepEqual(readTickets(home, { now: clock.now }).open, [ticket]);
}));

/** A file system whose rename of a ticket answers `code` every time, counting the tries in `tries`. */
const alwaysHeld = (code) => {
  const tries = [];
  const io = new Proxy(fs, {
    get: (target, name) => (name === 'renameSync'
      ? (from, to) => {
        if (path.basename(from).endsWith('.json')) {
          tries.push(from);
          throw Object.assign(new Error(code), { code });
        }
        return target.renameSync(from, to);
      }
      : target[name]),
  });
  return { io, tries };
};

test('on Windows a held file is tried three times in all, with a pause before each try again, then said with its code (gate-first T8)', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const { io, tries } = alwaysHeld('EPERM');
  const pauses = [];
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, platform: 'win32', fileSystem: io, pause: (ms) => pauses.push(ms) }), { ticket: null, expired: [], unclaimed: [{ ticket, code: 'EPERM' }] });
  assert.equal(tries.length, 3);
  assert.deepEqual(pauses, [25, 25]);
}));

test('on POSIX a refused rename is no hold: it is tried once, with no pause, and said with its code (gate-first T8)', withHome((home) => {
  const clock = clockAt();
  for (const code of ['EACCES', 'EPERM', 'EBUSY']) {
    const { ticket } = issue(home, clock, { session: `sess-${code}` }, '0a0a0a0a');
    const { io, tries } = alwaysHeld(code);
    const pauses = [];
    assert.deepEqual(claimTicket({ home, session: `sess-${code}`, cwd: '/x', now: clock.now, platform: 'linux', fileSystem: io, pause: (ms) => pauses.push(ms) }), { ticket: null, expired: [], unclaimed: [{ ticket, code }] }, code);
    assert.deepEqual([tries.length, pauses.length], [1, 0], code);
    fs.rmSync(gateFirstDir(home), { recursive: true, force: true });
  }
}));

test('a claimed ticket whose file cannot be removed is still spent: the claim returns it, and no reader lists it again', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const io = new Proxy(fs, {
    get: (target, name) => (name === 'rmSync'
      ? (file, options) => {
        if (path.basename(file).includes('.claimed-')) throw Object.assign(new Error('EPERM'), { code: 'EPERM' });
        return target.rmSync(file, options);
      }
      : target[name]),
  });
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, fileSystem: io }), { ticket, expired: [] });
  assert.deepEqual(readTickets(home, { now: clock.now }).open, []);
  assert.equal(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now }).ticket, null);
}));

test('a claimed file that holds no ticket is spent too, and the next ticket of the session is taken', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  clock.advance(1000);
  const { ticket: second } = issue(home, clock, { session: 'sess-a' }, '0b0b0b0b');
  // The first is read as a ticket when the folder is listed, and is garbage by the time it is claimed.
  const io = new Proxy(fs, {
    get: (target, name) => (name === 'renameSync'
      ? (from, to) => {
        const done = target.renameSync(from, to);
        if (path.basename(from) === '0a0a0a0a.json') target.writeFileSync(to, 'not json');
        return done;
      }
      : target[name]),
  });
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now: clock.now, fileSystem: io }), { ticket: second, expired: [] });
  assert.equal(fs.existsSync(gateFirstDir(home)), false);
}));

test('a ticket that expires between the listing and its claim is spent as expired, not claimed', withHome((home) => {
  const clock = clockAt();
  const { ticket } = issue(home, clock, { session: 'sess-a', minutes: 1 }, '0a0a0a0a');
  // The sweep and the listing read the clock before the expiry; the claim, once the file is renamed, after it.
  let renamed = false;
  const io = new Proxy(fs, {
    get: (target, name) => (name === 'renameSync'
      ? (from, to) => {
        renamed = true;
        return target.renameSync(from, to);
      }
      : target[name]),
  });
  const now = () => (renamed ? AT + MINUTE + 1 : AT + MINUTE - 1);
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\x', now, fileSystem: io }), { ticket: null, expired: [ticket] });
  assert.equal(fs.existsSync(gateFirstDir(home)), false);
}));

test('a claim that names its tree takes only a ticket for that tree, never one that names none (odd/tasks/land-unattended.md)', withHome((home) => {
  const clock = clockAt();
  issue(home, clock, { session: 'sess-a' }, '0a0a0a0a');
  const { ticket } = issue(home, clock, { session: 'sess-a', tree: 'D:\\work\\a' }, '0b0b0b0b');
  assert.equal(claimTicket({ home, session: 'sess-a', cwd: 'D:\\work\\b', now: clock.now, named: true }).ticket, null);
  assert.deepEqual(claimTicket({ home, session: 'sess-a', cwd: 'D:\\work\\a', now: clock.now, named: true }), { ticket, expired: [] });
  assert.equal(claimTicket({ home, session: 'sess-a', cwd: 'D:\\work\\a', now: clock.now, named: true }).ticket, null);
  assert.deepEqual(fs.readdirSync(gateFirstDir(home)), ['0a0a0a0a.json']);
}));
