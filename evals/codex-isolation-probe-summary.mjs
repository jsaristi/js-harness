// The human summary of a Codex isolation probe's report, kept apart from the probe (codex-isolation-probe.mjs) so
// that file stays under the size limit (bin/conventions-structure.test.mjs). The probe re-exports `formatSummary`,
// so its readers import it from where they always did.
import path from 'node:path';
import { diffLines, megabytes, seconds } from './isolation-probe.mjs';

const tallyText = (tally) => Object.entries(tally).map(([name, count]) => `${name} x${count}`).join(', ') || 'none';
const names = ({ count, paths }, limit = 12) => (count === 0 ? '' : `: ${paths.slice(0, limit).join(', ')}${count > limit ? `, and ${count - limit} more` : ''}`);

/** The human summary of a report: short, and safe to print, since the report is already scrubbed. */
export function formatSummary(report) {
  const lines = [];
  const hashed = report.hashing.reduce((total, entry) => ({ ms: total.ms + entry.ms, bytes: Math.max(total.bytes, entry.bytes), files: Math.max(total.files, entry.files) }), { ms: 0, bytes: 0, files: 0 });
  lines.push(`codex isolation probe: ${report.ok ? 'PASS' : report.incomplete.length > 0 ? 'INCOMPLETE' : 'FAIL'}`);
  lines.push(`codex ${report.codex} (${report.codexVersion ?? 'version not read'}) as ${report.config.model}, effort ${report.config.effort}; the login's access token had ${report.login.hoursLeft} h left (minimum ${report.login.minHoursLeft} h)`);
  lines.push(`work root: ${report.workRoot} (${report.workRootCreated ? 'made by this run' : 'was there already'})`);
  lines.push(`real trees: ${report.hashing.length} passes in ${seconds(hashed.ms)}, ${hashed.files} files, ${megabytes(hashed.bytes)} content-hashed per pass (${report.hashing.map((entry) => `${entry.label} ${seconds(entry.ms)}`).join(', ')})`);
  for (const note of report.notes) lines.push(`  ${note}`);
  if (report.template) lines.push(`template of the real .codex: ${report.template.files} files, ${megabytes(report.template.bytes)}${report.template.warnings.length > 0 ? `; ${report.template.warnings.join('; ')}` : ''}`);
  if (report.control) {
    lines.push(`control window (${report.control.ms} ms, no agent), live writers changed:`);
    const control = diffLines(report.control.diff, '  ');
    lines.push(...(control.length > 0 ? control : ['  nothing']));
  }
  for (const arm of report.arms) {
    lines.push('', `arm ${arm.arm}: ${arm.ok ? 'ok' : 'FAILED'}, agent exit ${arm.exitCode ?? 'none'}${arm.timedOut ? ' (timed out)' : ''}${arm.wallMs === undefined ? '' : `, ${seconds(arm.wallMs)}`}`);
    if (arm.error) lines.push(`  error: ${arm.error}`);
    if (arm.agent) {
      const { usage } = arm.agent;
      lines.push(`  agent: ${usage.turns} turn(s) completed, input ${usage.inputTokens ?? '?'} tokens (${usage.cachedInputTokens ?? '?'} cached), output ${usage.outputTokens ?? '?'} (reasoning ${usage.reasoningOutputTokens ?? '?'}); answer ${arm.agent.finalMessage === null ? 'none' : JSON.stringify(arm.agent.finalMessage.slice(0, 120))}`);
      if (arm.agent.stop) lines.push(`  stopped by the ${arm.agent.stop.kind}: ${arm.agent.stop.message}`);
    }
    if (arm.events) {
      lines.push(`  events: ${tallyText(arm.events.types)}; items: ${tallyText(arm.events.items)}${arm.events.mcpCalls.length > 0 ? `; MCP calls: ${arm.events.mcpCalls.join(', ')}` : ''}`);
      for (const error of arm.events.errors) lines.push(`  ${error.type}: ${error.message ?? '(no message)'}`);
    }
    if (arm.stderrTail && !arm.ok) lines.push(`  agent stderr (tail): ${arm.stderrTail.trim().split('\n').slice(-5).join(' | ')}`);
    if (arm.controls) lines.push(`  positive controls: ${Object.entries(arm.controls).map(([name, control]) => `${name} ${control.ok ? 'ok' : 'FAILED'}`).join(', ')}`);
    if (arm.env?.file === 'present') {
      const checks = Object.entries(arm.env.checks);
      const off = checks.filter(([, check]) => check !== 'same');
      const line = (name) => `${name}=${arm.env.lines[name] ?? '(no line)'}`;
      lines.push(`  the agent's shell: ${checks.length - off.length} of ${checks.length} variables are as the sandbox set them; ${line('CODEX_HOME')}, ${line('ENGRAM_PORT')}`);
      for (const [name, check] of off) lines.push(`    !! ${line(name)} (${check})`);
      if (arm.env.urlSet || arm.env.socketSet) lines.push('    !! ENGRAM_URL or ENGRAM_SOCKET is set');
    } else if (arm.env) {
      lines.push("  the agent's shell: it wrote no environment file");
    }
    if (arm.loginCopy) lines.push(`  login: the trial's copy is ${arm.loginCopy}, the real one is ${arm.realLogin}`);
    else if (arm.realLogin) lines.push(`  login: the real one is ${arm.realLogin}`);
    if (arm.engram.port) {
      const e = arm.engram;
      const port = e.listening === true ? 'STILL LISTENING afterwards: FAILED' : e.listening === false ? 'nothing listens on it afterwards' : 'what listens on it was not checked';
      const processes = e.survivors.length > 0 ? `; ${e.survivors.length} engram process(es) of the trial left running: FAILED` : e.listingError ? '; engram processes could not be listed: INCONCLUSIVE' : ', and no engram process of the trial is left';
      const others = e.unattributed.length > 0 ? ` (${e.unattributed.length} started meanwhile that nothing ties to the trial)` : '';
      lines.push(`  engram: port ${e.port}, ${port}${processes}${others}`);
      lines.push(`  engram store of the trial: ${e.db ?? 'none'}; exercised: ${e.exercised}${e.exercised ? ` (${[e.memSave && 'the memory', e.nonce && 'the nonce'].filter(Boolean).join(', ')})` : ''}${e.applies ? '' : ' (the minimal arm has no engram)'}`);
    }
    if (arm.sandbox) {
      const { codexHome, elsewhere } = arm.sandbox;
      lines.push(`  CODEX_HOME gained ${codexHome.created.count} file(s)${names(codexHome.created)}`);
      lines.push(`  CODEX_HOME: ${codexHome.changed.count} changed${names(codexHome.changed)}; ${codexHome.removed.count} removed${names(codexHome.removed)}`);
      lines.push(`  elsewhere in the trial home: ${elsewhere.created.count} created${names(elsewhere.created)}; ${elsewhere.changed.count} changed${names(elsewhere.changed)}${arm.sandbox.kept ? `; kept at ${arm.sandbox.kept}` : ''}`);
    }
    if (arm.raw) lines.push(`  raw output: ${arm.raw.stdout} and ${path.basename(arm.raw.stderr)}`);
    for (const warning of arm.warnings) lines.push(`  warning: ${warning}`);
    if (arm.leak) {
      lines.push(`  leak scan of the real trees: ${arm.leak.hits.length === 0 ? 'nothing found' : `${arm.leak.hits.length} HIT(S)`}`);
      for (const hit of arm.leak.hits) lines.push(`    HIT ${hit.tree}/${hit.path}: ${hit.found.join(', ')} (${hit.via})`);
      const split = arm.leak.fresh;
      lines.push(`  real trees changed during this arm${split ? ' (new, not seen in the control window)' : ''}:`);
      const changes = diffLines(split ?? arm.leak.diff, '    ');
      lines.push(...(changes.length > 0 ? changes : ['    nothing']));
      if (split) {
        const baseline = diffLines(arm.leak.baseline, '    ');
        if (baseline.length > 0) lines.push('  also changed in the control window (live writers):', ...baseline);
      }
    } else {
      lines.push(`  leak scan of the real trees: not done${arm.probeError ? ` (${arm.probeError})` : ''}`);
    }
  }
  for (const { arm, reason } of report.skipped) lines.push('', `arm ${arm}: not run (${reason})`);
  if (report.failures.length > 0) lines.push('', 'failures:', ...report.failures.map((failure) => `  - ${failure}`));
  if (report.incomplete.length > 0) lines.push('', 'the probe itself broke after a session had started, so this result is incomplete:', ...report.incomplete.map((entry) => `  - ${entry}`));
  return `${lines.join('\n')}\n`;
}
