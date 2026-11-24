// The isolation probe's human summary of a report (isolation-probe.mjs): short, and safe to print, since the
// report is already scrubbed. Kept apart from the probe so it stays under the size limit
// (bin/conventions-structure.test.mjs); the probe re-exports these names, so their readers import them from
// the probe as before.

export const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`;
export const megabytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;

export function diffLines(diff, indent) {
  const lines = [];
  for (const [tree, entry] of Object.entries(diff)) {
    const counts = ['added', 'removed', 'changed'].filter((category) => entry[category]).map((category) => `${category} ${entry[category].count}`);
    lines.push(`${indent}${tree}: ${[entry.appeared && 'appeared', entry.vanished && 'vanished', ...counts].filter(Boolean).join(', ')}`);
    for (const category of ['added', 'removed', 'changed']) {
      for (const rel of (entry[category]?.paths ?? []).slice(0, 8)) lines.push(`${indent}  ${{ added: '+', removed: '-', changed: '~' }[category]} ${rel}`);
      if ((entry[category]?.count ?? 0) > 8) lines.push(`${indent}  ... ${entry[category].count - 8} more ${category} (all in the JSON report)`);
    }
    for (const [rel, keys] of Object.entries(entry.keys ?? {})) {
      if (keys.unparsed) lines.push(`${indent}  keys in ${rel}: not compared, the file was not a JSON object at one end of the window`);
      for (const category of ['added', 'removed', 'changed']) {
        if (!keys[category]) continue;
        const more = keys[category].count > 8 ? ` ... and ${keys[category].count - 8} more` : '';
        lines.push(`${indent}  keys ${category} in ${rel}: ${keys[category].paths.slice(0, 8).join(', ')}${more}`);
      }
    }
  }
  return lines;
}

/** The human summary of a report: short, and safe to print, since the report is already scrubbed. */
export function formatSummary(report) {
  const lines = [];
  const hashed = report.hashing.reduce((total, entry) => ({ ms: total.ms + entry.ms, bytes: Math.max(total.bytes, entry.bytes), files: Math.max(total.files, entry.files) }), { ms: 0, bytes: 0, files: 0 });
  lines.push(`isolation probe: ${report.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`claude ${report.claude} as ${report.config.model}, effort ${report.config.effort}, permission mode ${report.config.permissionMode}`);
  lines.push(`work root: ${report.workRoot} (${report.workRootCreated ? 'made by this run' : 'was there already'}); sandboxes and the template were built there, outside the real home and with no project memory above them`);
  lines.push(`real trees: ${report.hashing.length} passes in ${seconds(hashed.ms)}, ${hashed.files} files, ${megabytes(hashed.bytes)} content-hashed per pass (${report.hashing.map((entry) => `${entry.label} ${seconds(entry.ms)}`).join(', ')})`);
  if (report.control) {
    lines.push(`control window (${report.control.ms} ms, no agent), live writers changed:`);
    const control = diffLines(report.control.diff, '  ');
    lines.push(...(control.length > 0 ? control : ['  nothing']));
  }
  for (const arm of report.arms) {
    lines.push('', `arm ${arm.arm}: ${arm.ok ? 'ok' : 'FAILED'}, agent exit ${arm.exitCode ?? 'none'}${arm.timedOut ? ' (timed out)' : ''}${arm.wallMs === undefined ? '' : `, ${seconds(arm.wallMs)}`}`);
    if (arm.error) lines.push(`  error: ${arm.error}`);
    if (arm.agent) lines.push(`  agent result: ${arm.agent.isError ? 'error' : 'ok'} (${arm.agent.subtype ?? 'no subtype'}, ${arm.agent.numTurns ?? '?'} turns)`);
    if (arm.stderrTail && !arm.ok) lines.push(`  agent stderr (tail): ${arm.stderrTail.trim().split('\n').slice(-5).join(' | ')}`);
    if (arm.template) lines.push(`  template: ${arm.template.files} files, ${megabytes(arm.template.bytes)}${arm.template.warnings.length > 0 ? `; ${arm.template.warnings.join('; ')}` : ''}`);
    if (arm.fakeApi) {
      lines.push(`  fake API: ${arm.fakeApi.requestCount} requests (${Object.entries(arm.fakeApi.tally).map(([reply, n]) => `${reply} x${n}`).join(', ') || 'none'})${arm.fakeApi.unexpected > 0 ? `; ${arm.fakeApi.unexpected} unexpected, see the JSON report` : ''}`);
      if (arm.fakeApi.envLines) {
        lines.push("  the agent's tools saw:");
        for (const [name, value] of Object.entries(arm.fakeApi.envLines)) lines.push(`    ${arm.fakeApi.envChecks[name] === 'outside' ? '!!' : '  '} ${name}=${value}`);
      } else {
        lines.push("  the agent's tools reported no environment (the Bash tool call never completed)");
      }
    }
    if (arm.contamination) {
      const c = arm.contamination;
      if (c.skipped) lines.push(`  contamination: check skipped (${c.skipped})`);
      else {
        const reached = c.withGlobalClaudeMd === 0 ? `none of ${c.requests}` : `${c.withGlobalClaudeMd} of ${c.requests}`;
        lines.push(`  contamination: the real global CLAUDE.md reached ${reached} requests${c.ok ? ', as it should' : `: FAILED, expected it ${c.expected === 'present' ? 'on the main-model request' : 'on none'}`}`);
      }
    }
    if (arm.engram?.port) {
      const e = arm.engram;
      const port = e.listening === true ? 'STILL LISTENING afterwards: FAILED' : e.listening === false ? 'nothing listens on it afterwards' : 'what listens on it was not checked';
      const processes = e.survivors.length > 0 ? `; ${e.survivors.length} engram process(es) of the trial left running: FAILED` : e.listingError ? '; engram processes could not be listed: INCONCLUSIVE' : ', and no engram process of the trial is left';
      lines.push(`  engram: port ${e.port}, ${port}${processes}`);
    }
    if (arm.realEngram) {
      const s = arm.realEngram;
      lines.push(s.status === 'present'
        ? `  real engram store: ${s.files} files, ${megabytes(s.bytes)} scanned for the nonce, the sandbox name and the session id: ${s.hits === 0 ? 'nothing found' : `${s.hits} HIT(S)`}`
        : `  real engram store: ${s.status}${s.status === 'missing' ? ' (the folder is not there, so nothing was scanned)' : ''}`);
    }
    for (const check of arm.components ?? []) {
      const seen = check.unseen ? 'unseen: a request carries nothing of it' : check.ok === null ? `not checked (${check.skipped})` : null;
      lines.push(`  component ${check.id}: ${seen ?? `${check.expected === 'absent' ? (check.carried === 0 ? 'absent' : `carried on ${check.carried} of ${check.requests} requests`) : (check.mainRequestHit ? 'present on the main-model request' : 'not on the main-model request')}${check.ok ? ', as it should' : ': FAILED'}`}`);
    }
    for (const warning of arm.warnings ?? []) lines.push(`  warning: ${warning}`);
    if (arm.positiveControls) {
      lines.push(`  positive controls: ${Object.entries(arm.positiveControls).map(([name, control]) => `${name} ${control.applies === false ? 'n/a' : control.ok ? 'ok' : 'FAILED'}`).join(', ')}`);
    }
    if (arm.sandbox) {
      const { answers } = arm.sandbox;
      lines.push(`  sandbox home: ${arm.sandbox.created.count} files created, ${arm.sandbox.changed.count} seeded files changed${arm.sandbox.kept ? `; kept at ${arm.sandbox.kept}` : ''}`);
      lines.push(`    history.jsonl written: ${answers.historyJsonl}; AppData/Local/claude-cli-nodejs in the sandbox: ${answers.claudeCliNodejs}; plugins/marketplaces present ${answers.pluginsMarketplaces.present}, created ${answers.pluginsMarketplaces.created}, changed ${answers.pluginsMarketplaces.changed}, removed ${answers.pluginsMarketplaces.removed}`);
      if (answers.engramPrompt !== null) lines.push(`    information only: prompt stored in the engram store: ${answers.engramPrompt} (the hook's safe mode under Git Bash on Windows never posts it); subagent stop stored: ${answers.engramSubagentStop}`);
      lines.push(`    top level: ${arm.sandbox.top.filter((row) => !row.path.includes('/')).map((row) => `${row.path} (${row.files})`).join(', ')}`);
    }
    if (arm.leak) {
      lines.push(`  leak scan of the real trees: ${arm.leak.hits.length === 0 ? 'nothing found' : `${arm.leak.hits.length} HIT(S)`}${arm.leak.unreadable.count > 0 ? `; ${arm.leak.unreadable.count} files could not be read, so were not scanned: INCONCLUSIVE` : ''}`);
      for (const hit of arm.leak.hits) lines.push(`    HIT ${hit.tree}/${hit.path}: ${hit.found.join(', ')} (${hit.via})`);
      const split = arm.leak.fresh;
      lines.push(`  real trees changed during this arm${split ? ' (new, not seen in the control window)' : ''}:`);
      const changes = diffLines(split ?? arm.leak.diff, '    ');
      lines.push(...(changes.length > 0 ? changes : ['    nothing']));
      if (split) {
        const baseline = diffLines(arm.leak.baseline, '    ');
        if (baseline.length > 0) lines.push('  also changed in the control window (live writers):', ...baseline);
      }
    }
  }
  if (report.failures.length > 0) lines.push('', 'failures:', ...report.failures.map((failure) => `  - ${failure}`));
  return `${lines.join('\n')}\n`;
}
