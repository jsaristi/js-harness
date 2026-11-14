# Probe 4: a PreToolUse notice without a deny reaches the model

2026-11-13, `claude -p` on Haiku 5.5 with `--settings settings.json --allowedTools=Bash`, prompt: run `echo hi`, then quote any notice or extra context a hook added.

The hook (`hook.cjs`):

```js
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:'PreToolUse',additionalContext:'js-harness advisor-gate notice: the word is PELICAN-77.'}}));});
```

The answer (its last lines):

```
Un hook añadió este contexto alrededor de la llamada, citado textualmente:

> js-harness advisor-gate notice: the word is PELICAN-77.

También hubo un aviso de que el directorio de trabajo del shell se reinició a `C:\Users\Oficina\AppData\Local\Temp\claude\67b64910c302691d\7e11d87c-77a3-4091-998e-4f5bb7b177c4\scratchpad\noticeprobe`. Ese aviso parece del propio harness, no un hook, así que no lo cuento como contexto de hook.
```

The notice reached the model and the call ran: the warning week can speak through `additionalContext`.
