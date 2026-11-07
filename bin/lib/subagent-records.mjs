// The Claude Code records of a project's sessions and their sub-agents: the folders that hold them, the main
// checkout's and each worktree's, and what a count needs of their entries, never the text of a message. `check`'s
// sub-agent row (bin/check.mjs) and the workshop's `subagents` and `audit` read them. Moved out of workshop/bin/subagents.mjs,
// which is the workshop's (odd/tasks/workshop-product-split.md, slice 1+2), so product code imports no workshop
// module. Zero deps.
import fs from 'node:fs';
import path from 'node:path';
import { callsOf, usageOf } from './subagent-count.mjs';
import { linesOf } from './lines.mjs';
import { mainCheckout, parseWorktreeList, projectSlug } from './sessions.mjs';

/** The records folders of this project: the main checkout's and each worktree's, as Claude Code names them
 * under `<config>/projects`, the ones that can be listed. */
export function recordFolders({ cwd, env, homedir, run }) {
  const main = mainCheckout(run, cwd);
  const listed = run('git', ['worktree', 'list', '--porcelain'], { cwd: main, encoding: 'utf8' });
  const trees = listed.error || listed.status !== 0 ? [] : parseWorktreeList(listed.stdout).map((tree) => tree.path);
  const root = path.join(env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude'), 'projects');
  const slugs = [...new Set([main, ...trees].map((folder) => projectSlug(path.resolve(folder))))];
  return slugs.map((slug) => path.join(root, slug)).filter((dir) => {
    try {
      fs.readdirSync(dir);
      return true;
    } catch {
      return false;
    }
  });
}

/** Each line of `file` parsed, handed to `keep`; a line that is not JSON is skipped. Streamed: a session's
 * record can be hundreds of megabytes. */
async function eachEntry(file, keep) {
  for await (const line of linesOf(file)) {
    if (line === '') continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    keep(entry);
  }
}

/** What the count needs of an entry and nothing more: never the content of a message. */
function slim(entry) {
  const kept = { type: entry?.type, timestamp: entry?.timestamp, requestId: entry?.requestId, effort: entry?.effort };
  const message = entry?.message;
  if (entry?.type === 'assistant' && message && typeof message === 'object') {
    kept.message = { id: message.id, model: message.model, usage: message.usage };
  }
  return kept;
}

/** The files of `dir` whose names `test` accepts and that changed at or after `since` (ms). */
function recentFiles(dir, test, since) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter(test)
    .map((name) => path.join(dir, name))
    .filter((file) => {
      try {
        return fs.statSync(file).mtimeMs >= since;
      } catch {
        return false;
      }
    });
}

/** The parent sessions' usage inside the window and their calls, and the sub-agents' records, of every
 * folder. `inWindow(timestamp)` says whether an entry's local day is one asked for. */
export async function readRecords(folders, { since, inWindow }) {
  const sessionEntries = [];
  const calls = new Map();
  const records = [];
  for (const folder of folders) {
    for (const file of recentFiles(folder, (name) => name.endsWith('.jsonl'), since)) {
      await eachEntry(file, (entry) => {
        for (const [id, call] of callsOf([entry])) calls.set(id, call);
        if (entry?.type === 'assistant' && inWindow(entry.timestamp)) sessionEntries.push(slim(entry));
      });
      const session = path.basename(file, '.jsonl');
      const subagents = path.join(folder, session, 'subagents');
      for (const agentFile of recentFiles(subagents, (name) => /^agent-.*\.jsonl$/.test(name), since)) {
        let meta = {};
        try {
          meta = JSON.parse(fs.readFileSync(agentFile.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
        } catch {
          // No meta file: the role falls to the verb and the model, both unknown, so `other`.
        }
        const entries = [];
        await eachEntry(agentFile, (entry) => entries.push(slim(entry)));
        records.push({ session, agentId: path.basename(agentFile, '.jsonl').replace(/^agent-/, ''), meta, entries });
      }
    }
  }
  return { sessions: usageOf(sessionEntries), calls, records };
}
