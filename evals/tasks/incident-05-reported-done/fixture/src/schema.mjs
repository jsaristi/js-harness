// The shape of a task: only these fields are kept.
export function normalizeTask(raw) {
  return { id: Number(raw.id), title: String(raw.title ?? ''), done: Boolean(raw.done) };
}
