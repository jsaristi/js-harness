import { nodeAdapter } from './fs-adapter.mjs';

/**
 * A key-value store kept in one JSON file. The file is read the first time it is needed, and the whole
 * state is written back after every change.
 */
export function createStore({ path, fs = nodeAdapter }) {
  let cache;
  const inflight = new Set();

  async function read() {
    try {
      return JSON.parse(await fs.readFile(path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return {};
    }
  }

  async function load() {
    if (cache === undefined) cache = await read();
    return cache;
  }

  // Writes are tracked so that flush() can wait for them.
  function persist(data) {
    const write = fs.writeFile(path, JSON.stringify(data));
    const tracked = write.finally(() => inflight.delete(tracked));
    inflight.add(tracked);
    return write;
  }

  async function get(key) {
    const data = await load();
    return data[key];
  }

  async function set(key, value) {
    const data = await load();
    data[key] = value;
    await persist(data);
  }

  async function update(key, fn) {
    const data = await load();
    data[key] = await fn(data[key]);
    await persist(data);
    return data[key];
  }

  async function remove(key) {
    const data = await load();
    const existed = Object.hasOwn(data, key);
    delete data[key];
    await persist(data);
    return existed;
  }

  async function flush() {
    await Promise.all(inflight);
  }

  return { get, set, update, delete: remove, flush };
}
