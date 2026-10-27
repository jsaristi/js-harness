// The budget of the root CLAUDE.md (odd/tasks/f8-s3-split.md, S5): Claude works from it and the AGENTS.md it imports
// (docs/proposals/harness-diet.md, D3), so it is paid on every turn too and is held to rule:claude-md-budget, beside
// AGENTS.md's own budget.
import fs from 'node:fs';
import path from 'node:path';
import { estimateTokens } from './payload.mjs';
import { ruleValue } from './rules.mjs';

// The budget the root CLAUDE.md is held to: the declared rule `claude-md-budget` (bin/lib/rules-data.mjs).
export const CLAUDE_MD_BUDGET = ruleValue('claude-md-budget', 'estimated tokens');

/** The PASS/FAIL row of the root CLAUDE.md's token budget at `cwd`, as a list: none where the project has no CLAUDE.md,
 * since one that works from AGENTS.md alone pays nothing more. A CRLF checkout counts as its LF text. */
export function checkClaudeBudget(cwd) {
  const file = path.join(cwd, 'CLAUDE.md');
  if (!fs.existsSync(file)) return [];
  const tokens = estimateTokens(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'));
  return [{ name: 'claude-md budget', pass: tokens <= CLAUDE_MD_BUDGET, detail: `${tokens} estimated tokens (budget ${CLAUDE_MD_BUDGET})` }];
}
