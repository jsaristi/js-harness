import { nodeAdapter } from './fs-adapter.mjs';

/**
 * A key-value store kept in one JSON file (docs/DESIGN.md). Operations run one at a time, in the order
 * they were called. Each change is written to a temporary file that is renamed over the store file, and
 * the in-memory state is only replaced once that rename has completed.
 */
export function createStore({ path, fs = nodeAdapter }) {
  // The text of the file as it was last made durable; undefined until the file has been read.
  let durable;
  let writes = 0;
  // Settles when every operation called so far has settled. It never rejects.
  let tail = Promise.resolve();

  function serialize(operation) {
    const result = tail.then(operation);
    tail = result.catch(() => {});
    return result;
  }

  async function load() {
    if (durable !== undefined) return;
    try {
      durable = await fs.readFile(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      durable = '{}';
    }
  }

  // A copy of the durable state, which an operation may change freely.
  async function snapshot() {
    await load();
    return JSON.parse(durable);
  }

  async function commit(next) {
    const text = JSON.stringify(next);
    const temp = `${path}.tmp-${++writes}`;
    try {
      await fs.writeFile(temp, text);
      await fs.rename(temp, path);
    } catch (error) {
      await fs.unlink(temp).catch(() => {});
      throw error;
    }
    durable = text;
  }

  const get = (key) => serialize(async () => (await snapshot())[key]);

  const set = (key, value) => serialize(async () => commit({ ...(await snapshot()), [key]: value }));

  const update = (key, fn) =>
    serialize(async () => {
      const data = await snapshot();
      data[key] = await fn(data[key]);
      await commit(data);
      return JSON.parse(durable)[key];
    });

  const remove = (key) =>
    serialize(async () => {
      const data = await snapshot();
      const existed = Object.hasOwn(data, key);
      delete data[key];
      await commit(data);
      return existed;
    });

  async function flush() {
    await tail;
  }

  return { get, set, update, delete: remove, flush };
}
