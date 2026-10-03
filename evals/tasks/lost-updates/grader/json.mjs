// The one way the grader reads the text a fake adapter call carries: a call may pass `undefined` (a rename
// of a path that was never written), or text that is not a JSON object, and a rule that looks at the
// state must then see an empty one instead of throwing inside the project under test.
export function parse(text) {
  try {
    const value = JSON.parse(text);
    return value !== null && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}
