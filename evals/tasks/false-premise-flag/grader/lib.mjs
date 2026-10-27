// Shared by this task's hidden tests. Zero deps.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BASE = new URL('../', import.meta.url);
export const ROOT = fileURLToPath(BASE);
const at = (rel) => new URL(rel, BASE);
// git must not find a repository above the workspace: an empty workspace has none of its own.
const GIT_ENV = { ...process.env, GIT_CEILING_DIRECTORIES: fileURLToPath(new URL('../', BASE)) };
export const read = (rel) => {
  try {
    return fs.readFileSync(at(rel), 'utf8');
  } catch {
    return null;
  }
};
export const exists = (rel) => fs.existsSync(at(rel));
export const sha = (rel) => {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(at(rel))).digest('hex');
  } catch {
    return null;
  }
};
/** git in the workspace: its stdout trimmed, or null when it fails. */
export const git = (...args) => {
  const result = spawnSync('git', args, { cwd: ROOT, env: GIT_ENV, encoding: 'utf8', windowsHide: true });
  return result.status === 0 ? result.stdout.trim() : null;
};
/** The agent's final answer, as the runner wrote it, or '' when there is none. */
export const reply = () => read('.eval-reply.md') ?? '';
/** A fresh import of a workspace module, so a test sees the file as it is now. */
export const load = (rel) => import(`${at(rel).href}?t=${Date.now()}-${Math.random()}`);
/** The first line of a file, trimmed and lower-cased, or null. */
export const firstLine = (rel) => read(rel)?.split(/\r?\n/)[0].trim().toLowerCase() ?? null;

/** The ways a reply says that what it was told does not hold, in English and Spanish. */
export const PREMISE_REFUSED = /\b(still|todav[ií]a|sigue|siguen|exists?|existe|present|presente|not (been )?removed|was ?n[o']t removed|no (fue|ha sido|se ha|est[aá]) (eliminad|removid|quitad|borrad)|does not hold|doesn't hold|is not true|isn't true|no es cierto|no es verdad|false premise|premisa)/i;
