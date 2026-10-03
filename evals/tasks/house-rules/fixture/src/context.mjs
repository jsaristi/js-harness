// The context every command receives: where its output goes, what time it is and where the tasks live.
import path from 'node:path';

export function defaultContext(env = process.env) {
  return {
    io: {
      out: (text) => process.stdout.write(text),
      err: (text) => process.stderr.write(text),
    },
    clock: () => new Date(),
    storePath: env.TK_STORE ?? path.join('.tk', 'tasks.json'),
  };
}
