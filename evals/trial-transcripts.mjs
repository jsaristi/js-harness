// What the runner does with a config's `transcripts` (`transcriptsOf`): the check of its shape, the copy of a trial's
// session files before its home is removed, and the last reply they hold. Apart from runner.mjs, which the gate holds
// under its size limit.
import fs from 'node:fs';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
/** What a config that keeps its agent's session transcripts carries as `transcripts`, or `null` for a config that
 * keeps none, which is every config that does not ask. The transcripts are in the trial home, which is removed when
 * the trial ends, and they hold what the agent's printed result does not (which request a subagent made, on which
 * model); so a config whose measurement needs them says how to keep them and what to record of them:
 *
 *   keep({ home, workspace, prepared, dest })   copies the session's files into `dest`, a directory of the trial's raw
 *                                               logs, and returns `{ files, errors }`: how many it copied, and a line
 *                                               for each it could not.
 *   summarize({ dir, usage })                   what the record holds of the kept copy in `dir`, as its `listCost`:
 *                                               raw logs are not committed, so a report reads the record alone.
 *                                               `usage` is the reading's. `dir` is `null` when no directory holds
 *                                               this trial's own copy (`keepTranscripts`): there is nothing to read.
 *   reply({ dir })                              optional: the last reply the session in `dir` wrote, or `null`, which
 *                                               a reply task is graded on when the agent printed no answer (a trial
 *                                               cut by its timeout prints none). Not asked when `dir` is `null`.
 *
 * All may be asynchronous. The runner knows neither where a CLI keeps its transcripts nor what they mean: that is
 * the config's, as the reading of the output is its reader's. A `transcripts` of another shape throws, before
 * anything is made: found after the agent ran, it would have cost a session whose transcripts are gone. */
export function transcriptsOf(config) {
  const keeper = config.transcripts ?? null;
  if (keeper !== null && (!isObject(keeper) || typeof keeper.keep !== 'function' || typeof keeper.summarize !== 'function')) {
    throw new Error(`config ${config.name}: "transcripts" must be an object with a keep and a summarize function, got ${JSON.stringify(keeper)}`);
  }
  if (keeper !== null && keeper.reply !== undefined && typeof keeper.reply !== 'function') {
    throw new Error(`config ${config.name}: "transcripts" reply, when given, must be a function, got ${JSON.stringify(keeper.reply)}`);
  }
  return keeper;
}

/** Has `keeper` copy the trial's transcripts into `context.dest` and returns `{ kept, dir }`: `kept`, the
 * `{ files, errors }` of the record, and `dir`, the directory a summary may read as this trial's, `context.dest` or
 * `null`. It never throws: whatever went wrong is logged and is a line of `errors`, because a trial that was paid for
 * is worth more than its transcripts. A failure of the file system is recorded by its code alone (the message holds a
 * path of this machine, and the record is committed); the log has it whole.
 *
 * What an earlier attempt at the same trial kept is removed first, as its raw output is overwritten: a trial that
 * stopped and is run again is another session, and two sessions in one directory would be summed as one. When it
 * cannot be removed (Windows answers EBUSY or EPERM while something holds a file there, and the removal is retried
 * for a second or so first) the directory is still the earlier session's, whole or in part. So nothing is copied
 * into it and `dir` is `null`: the summary then has no transcript to read and says what it can without one, where
 * reading that directory would record another session's cost as this trial's. The transcripts of this attempt are
 * lost with its home, which is the price of never recording a cost that is not the trial's own. */
export async function keepTranscripts(keeper, context, { trial, log }) {
  const kept = { files: 0, errors: [] };
  const failed = (detail, recorded = detail) => {
    log(`could not keep the transcripts of ${trial}: ${detail}`);
    kept.errors.push(recorded);
  };
  try {
    fs.rmSync(context.dest, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  } catch (err) {
    failed(`what an earlier attempt kept could not be removed (${err.message})`, `earlier attempt not removed: ${err.code ?? err.message}`);
    return { kept, dir: null };
  }
  try {
    const result = await keeper.keep(context);
    if (!isObject(result) || !Number.isInteger(result.files) || !Array.isArray(result.errors)) throw new Error('its keep returned no { files, errors }');
    kept.files = result.files;
    for (const error of result.errors) failed(String(error));
  } catch (err) {
    failed(err.message, err.code ?? err.message);
  }
  return { kept, dir: context.dest };
}

/** The last reply the transcripts kept in `dir` hold, by `keeper`'s `reply`, or `null`: none when the config asks for
 * none or no directory holds this trial's own copy. It never throws: a reply that cannot be read is logged and a line
 * of `kept.errors`, by its code alone as `keepTranscripts` records one, and the trial is graded on no reply. */
export async function keptReply(keeper, dir, { trial, log, kept }) {
  if (!keeper?.reply || dir === null) return null;
  try {
    return await keeper.reply({ dir });
  } catch (err) {
    log(`could not read the last reply in the transcripts of ${trial}: ${err.message}`);
    kept.errors.push(`reply: ${err.code ?? err.message}`);
    return null;
  }
}

