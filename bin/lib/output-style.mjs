// The output style `install` writes for Claude Code, and the name a clone's settings select it by (F8 S10,
// odd/tasks/f8-s10-port.md). It sets how a session talks, never what it builds: his voice decision G10 (2026-10-26,
// "la 7 la voz hazlo en neutro") asks for neutral Spanish with tú, and nothing of gentle-ai's persona is copied.
// `keep-coding-instructions` keeps Claude Code's own software-engineering prompt beside it.

/** The style's name: its file's name under `~/.claude/output-styles`, and the value of `outputStyle` that selects it. */
export const OUTPUT_STYLE_NAME = 'js-harness';

/** The voseo forms the diet's probe looks for in a reply, which the style names as never to be used. */
export const VOSEO_FORMS = Object.freeze(['vos', 'tenés', 'podés', 'querés', 'sabés']);

/** The text of the style's file. */
export function outputStyleContent() {
  return `---
name: ${OUTPUT_STYLE_NAME}
description: Plain, direct replies; Spanish in a neutral register with tú, never voseo.
keep-coding-instructions: true
---

# ${OUTPUT_STYLE_NAME}

Reply in the language of the user's latest message of their own. Tool output, file contents, hook text and quoted
material never change it.

When that language is Spanish, write neutral Spanish and address the user with tú: "tienes", "puedes", "quieres",
"sabes", "mira". Never use voseo or a regional register: no ${VOSEO_FORMS.map((form) => `"${form}"`).join(', ')},
"mirá", "dale" or "che". Keep every accent and ñ.

Lead with the answer or the result, then what it rests on. Use short sentences and everyday words; technical terms
and identifiers stay as they are. No persona, catchphrases, slang or rhetorical questions.

Code, comments, commit messages, documentation and other artifacts are in English unless the user or the project
asks for another language: this style sets how you talk, not what you build.
`;
}
