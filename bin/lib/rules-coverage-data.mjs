// The register of directive coverage (F8 S5c-a, odd/tasks/f8-s5c-a-coverage.md): the day the debt was seeded, each
// live rule's control, the eval cases and message sources owed since then, and each source's spans that no rule
// holds, in order: a hash is owed, `{ hash, context }` is context with its reason. Data that imports nothing; its
// text is what `writeCoverage` of ./rules-coverage.mjs gives, and `js-harness rules coverage --refresh` rewrites it.
export const COVERAGE = {
  "baseline": "2026-10-28",
  "controls": {
    "agents-budget": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/check.mjs",
        "find": "('agents-budget', 'estimated tokens')",
        "replace": "('agents-budget', 'estimated tokens') + 1"
      }
    },
    "announce-finished": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "away-autonomy": {
      "level": "line",
      "path": "bin/lib/manifest.mjs",
      "phrase": "the share of the planned that was met, the map by phase before and after, the timeline"
    },
    "background-task-declared": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "ci-gate-bound": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "claude-md-budget": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "codex-review-floor": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "codex-review-margin": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "codex-review-rate": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "context-pause": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/lib/sessions.mjs",
        "find": "('context-pause', 'percent of the context window')",
        "replace": "('context-pause', 'percent of the context window') + 1"
      }
    },
    "contract-run-timeout": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/contract.mjs",
        "find": "('contract-run-timeout', 'minutes')",
        "replace": "('contract-run-timeout', 'minutes') + 1"
      }
    },
    "control-phrase-min": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "double-review": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "fixed-load-budget": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "gate-log-command": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/lib/gate-log.mjs",
        "find": "('gate-log-command', 'characters')",
        "replace": "('gate-log-command', 'characters') + 1"
      }
    },
    "gate-log-size": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/lib/gate-log.mjs",
        "find": "('gate-log-size', 'KiB')",
        "replace": "('gate-log-size', 'KiB') + 1"
      }
    },
    "gate-max": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/gate.mjs",
        "find": "('gate-max', 'minutes')",
        "replace": "('gate-max', 'minutes') + 1"
      }
    },
    "gate-wait": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/lib/gate-lock.mjs",
        "find": "('gate-wait', 'minutes')",
        "replace": "('gate-wait', 'minutes') + 1"
      }
    },
    "lead-charter": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "live-board": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "memory-feedback-home": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "memory-index-bytes": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "memory-pass-days": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "mistake-report": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "owner-decisions": {
      "level": "protocol",
      "path": "bin/lib/protocols-skill.mjs",
      "phrase": "Decide everything else, say what it costs, and go on."
    },
    "person-present": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "question-context": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "questions-one-place": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "recap-effort-line": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "remote-control-yes": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "reply-five-states": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "report-table": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "reports-spanish-visual": {
      "level": "protocol",
      "path": "bin/lib/protocols-skill.mjs",
      "phrase": "the page is the one a command makes from the records"
    },
    "restart-announce": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "reuse-first": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-effort": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-model": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-part-files": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-part-lines": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-parts-unflagged": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "review-timeout": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "reviewed-commit-lines": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "rules-live-in-the-harness": {
      "level": "protocol",
      "path": "bin/lib/protocols-skill.mjs",
      "phrase": "An output the user sees again and again is cemented the same way, as a template of five parts"
    },
    "sensor-silence": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/check.mjs",
        "find": "('sensor-silence', 'minutes')",
        "replace": "('sensor-silence', 'minutes') + 1"
      }
    },
    "sensor-timeout": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/check.mjs",
        "find": "('sensor-timeout', 'minutes')",
        "replace": "('sensor-timeout', 'minutes') + 1"
      }
    },
    "session-effort": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "session-housekeeping": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "session-model": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "session-prompts": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "session-stall": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "session-title": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "sessions-open-in-sidebar": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "status-report": {
      "level": "protocol",
      "path": "bin/lib/manifest.mjs",
      "phrase": "6. What you propose next, each step with its why: the criterion that puts it there, never a step alone."
    },
    "subagent-effort": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "subagent-reader-model": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "subagent-writer-model": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "terminal-note": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "throughput-backfill-days": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "throughput-compare-days": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "throughput-quiet-days": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "throughput-quiet-runs": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "wait-every": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/wait.mjs",
        "find": "('wait-every', 'seconds')",
        "replace": "('wait-every', 'seconds') + 1"
      }
    },
    "wait-for": {
      "level": "check",
      "test": "bin/lib/rules-bindings.test.mjs",
      "break": {
        "path": "bin/wait.mjs",
        "find": "('wait-for', 'minutes')",
        "replace": "('wait-for', 'minutes') + 1"
      }
    },
    "wording-is-the-need": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "work-sessions-private-wsl": {
      "level": "owed",
      "since": "2026-10-28"
    },
    "work-sessions-public": {
      "level": "owed",
      "since": "2026-10-28"
    }
  },
  "cases": [
    "commit-no-attribution",
    "doc-goal",
    "false-premise-flag",
    "format-v2",
    "honest-unknown",
    "house-rules",
    "incident-01-paid-eval",
    "incident-02-review-consent",
    "incident-03-open-the-pr",
    "incident-04-stale-doc-flag",
    "incident-05-reported-done",
    "incident-06-tests-pass",
    "incident-07-merged-state",
    "incident-08-stale-push-approval",
    "incident-09-next-task",
    "incident-10-done-not-in-git",
    "lost-updates",
    "resolver",
    "rule-away-autonomy",
    "rule-reuse-first",
    "spec-drift"
  ],
  "messages": [
    "bin/backup.mjs",
    "bin/doctor.mjs",
    "bin/guard.mjs",
    "bin/lib/background.mjs",
    "bin/lib/codex-review-prompt.mjs",
    "bin/lib/codex-review-recheck.mjs",
    "bin/lib/guard.mjs",
    "bin/lib/hook-entries.mjs",
    "bin/lib/lens-prompts.mjs",
    "bin/lib/payload.mjs",
    "bin/lib/rules-reach.mjs",
    "bin/lib/sessions.mjs",
    "bin/reply.mjs",
    "bin/resume.mjs"
  ],
  "sources": {
    "AGENTS.md": [
      "27573a5376c5",
      "da0c0aaaf8a7",
      "72cfa4b165b8",
      "9196518ae175",
      "50b5e4b16003",
      "c242496d2fdf",
      "43829f7fdbeb",
      "6dda46f3b0ab",
      "286323613b19",
      "ac4beca21fcf",
      "3f53892edf3a",
      "15deae446b90",
      "969d0d3cd041",
      "7a23c73e1a81",
      "d75b519fbecf",
      "c1509f8bb5f1",
      "d462d72c06fd",
      "81cb012ae0fc",
      "333d9f0ffc13",
      "40257c275fdf",
      "4987d95339a1",
      "e53fceb09fb4",
      "625adc25c069",
      "5d7a044a6267",
      "8113741b0d11",
      "0f54ce8ff44f",
      "2bf419ec2bc2",
      "b6a00ef7f3d3",
      "edae2b331319",
      "b9e724755374",
      "8f27eab1adc4"
    ],
    "CLAUDE.md": [
      "918b1c905593",
      "1367c12aec80",
      "fe7e690a3983",
      "aa1b7112232f",
      "21dbcc0820f6",
      "9915a59fe8b3",
      "7b70374575b5",
      "7774030582f5",
      "7e910ca794b1",
      "fbb4d5c957e3",
      "21d376a28bac",
      "49cf30e33785",
      "e4c63656c08a",
      "14f96c7a3917",
      "2174d4a39a3c",
      "40fe5ecd2d04",
      "d083bb1d5253",
      "e9d02c32c4c4",
      "95a609034a40",
      "d57c779ef691",
      "797a3e77f461",
      "2e5e93c8b601",
      "e0d71bc325b4",
      "cd34e37381ea",
      "75f8a8d6d5a2",
      "53a066eaa932",
      "55e6a65fa3c0",
      "47491826838f",
      "c303034a23f3",
      "7493fb6b8944",
      "5fb4bfa8608f",
      "41998bbce130",
      "f0277286c9d3",
      "ede6be4adfa7",
      "1659df298fd0",
      "df9cb97f3213",
      "c7b6b98cb5d9",
      "fb64251879a9",
      "8e52b2779a0c",
      "c229836fd437",
      "d5219ae27553",
      "79cc5349ca6b",
      "cfc60ba8255a",
      "14e804ceab59",
      "f2fa66aaec3a",
      "4dd2781f9b9e",
      "7b42cfa7b8c7",
      "ae0f2f8d1bfe",
      "f095d3cdb496",
      "cbad6960963f",
      "6def6f4b10a8",
      "4fd80d5f1c10",
      "7723d961faa4",
      "68bb3f4a73b9",
      "89125600420e",
      "b96d0e96bbaf",
      "343907503107",
      "f923e203e2a9",
      "c5234f083ca3",
      "cfb5f66463fd",
      "f869211f889d",
      "3e4bda69d381",
      "4b9e34587d07",
      "a58aa912b0bc",
      "da6cae91730f",
      "0784be7e489d",
      "0be913f77e8f",
      "4e83c1615fee",
      "4ad4e1adfef6",
      "0b330bf89f52",
      "26d30c169b1b",
      "8276b74f5c7b",
      "efa139491a3a",
      "5dfa69e26c08",
      "8c03d86bf7d7",
      "757feab56c1e",
      "48c963a90af3",
      "3145bf74bbd6",
      "36fbb54edd35"
    ],
    "chained-prs-skill": [
      "e5434abb4e01",
      "c6881aaee5fb",
      "9fa68f39cca2",
      "aba03d27f7be",
      "a5b62153f09c",
      "d57fe8233a0b",
      "c6ef5c88b4ca",
      "b66542635d2a",
      "295dd452a64c",
      "2809df8fc662",
      "084c0356d6d8",
      "8d997179e1a7",
      "a74684fd7692",
      "556e3505af95",
      "b07541e7fea9",
      "01da81f3e6e6",
      "c9d47f508d8e",
      "4467293455e2",
      "da59447606d3",
      "45b382d11c00",
      "d23528fac303",
      "0465e1a095d8",
      "04e379c6932b",
      "fefa84622360",
      "cfd98a937165",
      "1099db2ffdda",
      "366af1e20f7f",
      "4ec14717833d",
      "d46a74a7cb70",
      "c21bc63d564e",
      "342a4048fed1"
    ],
    "init-agents": [
      "76433bc095fa",
      "deb33a8664e7",
      "eeee38edb013",
      "ddabff43c0a4",
      "1123e7347a2a",
      "5ae438610cf1",
      "fc65fe32604f",
      "e862ba9e3dc3",
      "4987d95339a1",
      "3513dfbe00d8",
      "8f90790ca6f3",
      "8f2863504e3d",
      "f90ecec2f93e",
      "7c9dcab419cd",
      "064241ea6747",
      "77f9a1a4bb9a"
    ],
    "init-agents-whole": [
      "76433bc095fa",
      "deb33a8664e7",
      "eeee38edb013",
      "ddabff43c0a4",
      "1123e7347a2a",
      "5ae438610cf1",
      "fc65fe32604f",
      "e862ba9e3dc3",
      "4987d95339a1",
      "3513dfbe00d8",
      "8f90790ca6f3",
      "8f2863504e3d",
      "f90ecec2f93e",
      "45777c183381",
      "a58d21586dd4",
      "ad3655173cc6",
      "289a68a5c975",
      "7c9dcab419cd",
      "064241ea6747",
      "77f9a1a4bb9a"
    ],
    "init-claude": [
      "76433bc095fa",
      "3aa8b271c3e4",
      "45777c183381",
      "a58d21586dd4",
      "ad3655173cc6",
      "289a68a5c975"
    ],
    "init-failures": [
      "3bc596d36cdb",
      "c3e14054255c",
      "6c7bb3e2cd0d",
      "3703aab30c59",
      "5aa6a1871018",
      "2c6e6b2c858f",
      "34bf9e7f98e3",
      "e43fd515bcb7",
      "9c23bb0924c3",
      "2a38f622e9c1"
    ],
    "lead-prompt": [
      "767a98142ab4",
      "eeac555aba84"
    ],
    "orchestrator-skill": [
      "7fad59137996",
      "c24d90b2b65d",
      "c1401c56a551",
      "f76f106c7589",
      "c062f35c4429",
      "555911737beb",
      "65dbc427e81e",
      "796f31019973",
      "97965e97afea",
      "57e389bbb7de",
      "1f33c3bd0b0e",
      "683e016f960e",
      "4b25a829402e",
      "59567b2225de",
      "6d4291bf30b2",
      "4d7949d14bc3",
      "a4678105fb33",
      "6cd17f863501",
      "a2486a3caa74",
      "7303af901880",
      "03037214411d",
      "5327a623772b",
      "2af1fa54b1ad",
      "db93c386d75c",
      "737b63c6c918",
      "0b542dca6b47",
      "4d101dbc9cc8",
      "666fe5e2cf2f",
      "377294a3ca2e",
      "26c04c7f4b4d",
      "227f5e474d8b",
      "37f242a0d05f",
      "503dccc64836",
      "43edbca9d292",
      "b06527c09903",
      "d040f5b3e611",
      "61d4053f44ed",
      "c2766d62b95e",
      "b859f8a8ed87",
      "e007182d082f",
      "46a073ebf76c",
      "764a9864c861",
      "9fde53d21b69",
      "1d22d9030557",
      "d26dfc41220f",
      "8f5ad40d987a",
      "2afb72d3f4c8",
      "4c0c9a47dc39",
      "b61e739c9e37",
      "ff590754c7bc",
      "155a2696775e",
      "11d5f4586333",
      "382675901b92",
      "014dc857135a",
      "bd6ef68aadc6",
      "ae849b231e3b",
      "28919060afb9",
      "e39f062b6c34",
      "8a91ad938108",
      "f985a2610939",
      "14975a5b7093",
      "3e0c52a6e75b",
      "baf21361fd95",
      "98dc75d60cad",
      "179ef2c76753",
      "86bc7fd52a3e",
      "0c4b51d0a378",
      "52a002e69547",
      "c5572af328b7",
      "56aeaa196359",
      "800d72acdad4",
      "d962f2e735cf",
      "db05de779231",
      "668f5aa42242",
      "f0e7f41f4f98",
      "d8b41df06da0",
      "b807c57d6153",
      "df243692514d",
      "590d3f1b684a",
      "afe8bb83736e",
      "9274b829e01c",
      "efd43815be6d",
      "3096d1c1cb92",
      "64c70a4f9689",
      "24e670bd1783",
      "10dac767f8af",
      "2f5698a84c38",
      "c4cda10f2d01",
      "18e588cce4ca",
      "25bbc89dd054",
      "423c5d400baf",
      "fb084fdd0f56",
      "6dd55dd9b615",
      "6b400741e66a",
      "cf7afd212ccb",
      "d8b56d3a7d5b",
      "a88e73dfa11b",
      "1b8013a0474a",
      "fc7ead3a4270",
      "70b60ef16c9f",
      "fa7469f92751",
      "0947d5b8b82d",
      "ddcf7db81c92",
      "d77576d7b195"
    ],
    "output-style": [
      "753c849de149",
      "e742a2430d9a",
      "0a7948a0b953",
      "27573a5376c5",
      "eea8018f4600",
      "0136f3948988",
      "5c41a59f87fe",
      "c17995ad13ec",
      "098c85310cb5",
      "62ca590d91dc",
      "2ab63aa041c2",
      "93bde4c5b7ce",
      "561131b1e965"
    ],
    "protocols-skill": [
      "dbb0ff001b03",
      "a4c6035260a5",
      "97be50cbf1ac",
      "d9debb17aa57",
      "954fc8e56820",
      "4c2e211be111",
      "9192d61b65b6",
      "de6c6b8a2d34",
      "a720b32b4b06",
      "d4c4f6039f1e",
      "2433a1420941",
      "14d717b10cea",
      "336cc5e6331a",
      "62cc104f711c",
      "1e51727a49bb",
      "c53658a6c399",
      "ef6527b37ed6",
      "1ba09cc2b907",
      "6dc706dd3326",
      "6c7e851fd8f7",
      "03ffbc955e43",
      "346dd5f481fb",
      "ecf5ba1713dc",
      "f1216ea4be28",
      "d57c779ef691",
      "ac1d6882890b",
      "6b72172d4dfc",
      "6de8c0f4362c",
      "e643ab71ac11",
      "52145b9dd79b",
      "811a4174a680",
      "e2d2678259be",
      "33bc068e8075",
      "97a9ae8d5e03",
      "5ad933feb9ca",
      "94142d07402a",
      "57923c87d60b",
      "c9c0030dd3ea",
      "279c398baf67",
      "baf04d904c01",
      "a15e68ae7291",
      "15d03fafcaf3",
      "77542c3f1860",
      "bb1a53e96464",
      "c36a5bac3af8",
      "d99cf2f7b866",
      "202faec0b45a",
      "0bcda118898e",
      "66e72d2afcb6",
      "45f9ca0a572a",
      "9348771fc067",
      "4da45f135a52",
      "682ff2336291",
      "7697b095235a",
      "f45c187cfe94",
      "82a916147e37",
      "1726d5761902",
      "d9efb11b9cf1",
      "f968034fb0b8",
      "19645ac8797e",
      "695014f04d80",
      "a8f8fa2ba7b9",
      "5ff183d88d2f",
      "b96a96ea7f8b",
      "47579dfdafaa",
      "712328898a73",
      "046f4f42d1ef",
      "ba02a4a296b3",
      "6ff9f06d1317",
      "e97f8322032a",
      "4e69bec6b964",
      "bfbc2b380256"
    ],
    "rules-block": [
      "b66542635d2a",
      "7b42cfa7b8c7",
      "ae0f2f8d1bfe",
      "f095d3cdb496",
      "cbad6960963f",
      "6def6f4b10a8",
      "4fd80d5f1c10",
      "7723d961faa4",
      "68bb3f4a73b9",
      "89125600420e"
    ],
    "skill": [
      "753c849de149",
      "bfc0ccffc746",
      "9934aa64351b",
      "38096c82af69",
      "0308c6294a57",
      "982817a0c389",
      "08ad421b3762",
      "7a3c5bcf29b0",
      "05a4c2e655ce",
      "03671c647b1c",
      "8cbeb3191919",
      "609c88aa3d90",
      "7a2f4c76c28f",
      "f2f0b5e73f6f",
      "346ec888e381",
      "b70325566ca7",
      "d3261928bbbc",
      "a440cb5134de",
      "71c551731cd8",
      "3380c3e633c3",
      "1a548f2c2562",
      "bb7c472cb9cf",
      "ba72d3cffccf",
      "4eee354ceae4",
      "d72b1f4d5102",
      "cb1a1546bc71",
      "e552ec1543ee",
      "b3292b97c535",
      "0fbace73ac99",
      "7b4f7f6f5efb",
      "5b4f8d1c5f4f",
      "7cdebc8a48f2",
      "f247f3da0dd4",
      "1c15c9d251a2",
      "1cb0293494f6",
      "25b57219307a",
      "49e12db017e4",
      "7ee9e4d8c440",
      "fe7afb1912e5",
      "d6b9b6332454"
    ],
    "template-gate": [
      {
        "hash": "66d42c157801",
        "context": "the template gate's refusal states what it found; a fact of the call, no obligation"
      },
      {
        "hash": "c7a921dded31",
        "context": "the template gate's refusal states what it found; a fact of the call, no obligation"
      },
      {
        "hash": "e3bed34c5a94",
        "context": "the template gate's refusal states what it found; a fact of the call, no obligation"
      },
      {
        "hash": "afdba0090bb7",
        "context": "the template gate's refusal: the PreToolUse hook enforces it on the call itself (bin/template.test.mjs), so no prose rule carries it"
      },
      {
        "hash": "433e76a0e9b3",
        "context": "the template gate's refusal states what it found; a fact of the call, no obligation"
      },
      {
        "hash": "44d883cd1bf6",
        "context": "the template gate's refusal: the PreToolUse hook enforces it on the call itself (bin/template.test.mjs), so no prose rule carries it"
      },
      {
        "hash": "30359d634d5d",
        "context": "the template gate's refusal: the PreToolUse hook enforces it on the call itself (bin/template.test.mjs), so no prose rule carries it"
      },
      {
        "hash": "ba6a2130ca30",
        "context": "the template gate's refusal states what it found; a fact of the call, no obligation"
      },
      {
        "hash": "2d570699d962",
        "context": "the template gate's refusal: the PreToolUse hook enforces it on the call itself (bin/template.test.mjs), so no prose rule carries it"
      }
    ],
    "work-units-skill": [
      "2a26a68c54df",
      "462030c19c05",
      "9fa68f39cca2",
      "859b9ba0e337",
      "a5b62153f09c",
      "d57fe8233a0b",
      "76540e97c1e0",
      "b66542635d2a",
      "22222c290379",
      "0d3de214ba81",
      "2927b967397c",
      "ae85fdae6dcc",
      "60785765b10b",
      "0d66bd5d3a6d",
      "e01765d58b1a",
      "2aead9c63cda",
      "94e0fff80748",
      "499edfa0aa80",
      "b1c2ff174972",
      "12a24a7cdfb2",
      "04f8c989f8e6",
      "44cfc8df3160",
      "30843039f569",
      "eaea5c164f98",
      "62260fc2955f",
      "0f38f09fa675",
      "01aa0caba4c9",
      "626215ecefe0",
      "36cd3f2bb454",
      "20451229023c"
    ]
  }
};
