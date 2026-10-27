/** The tasks of `store`, an array of { id, title, done }; with `done`, only those whose done matches. */
export function listTasks(store, { done } = {}) {
  return store.filter((task) => done === undefined || task.done === done).map((task) => ({ ...task }));
}
