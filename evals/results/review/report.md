# Codex review: the configurations, side by side

One Codex review a cell, read by `evals/review/compare.mjs`: 9 of 9 cells are recorded. A cell with no reading is a row of dashes; a count the run did not report is `unknown`. Findings are those the review gave as data; for the seeded range, `found` is how many of its known defects they name and `extra` how many findings name none.

`model` is the model and the reasoning effort the review session ran with, as its own rollout file says. One followed by `*` was not measured: it is what the command passed or what the user's configuration names, and the session may have run another.

## real: 338386a..e3aad48

This repository, 255 changed lines with no known defect.

| configuration | outcome | findings | input tokens | not-cached input | output tokens | requests | first request | seconds | CLI | model |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| current | reviewed | 0 | 228,539 | 56,123 | 814 | 5 | 28,936 | 47 | 0.161.0 | gpt-6-astra low |
| lean | reviewed | 0 | 134,283 | 38,283 | 656 | 6 | 6,711 | 33 | 0.161.0 | gpt-6.1-sol medium* |
| lean-own | reviewed | 0 | 145,842 | 37,554 | 605 | 6 | 7,063 | 34 | 0.161.0 | gpt-6.1-sol medium* |
| lean-high | reviewed | 0 | 374,661 | 58,373 | 2,413 | 11 | 6,711 | 92 | 0.161.0 | gpt-6.1-sol high* |
| lean-codegraph | reviewed | 0 | 160,383 | 39,423 | 493 | 6 | 7,491 | 30 | 0.161.0 | gpt-6.1-sol medium |

## seeded: 0366ee0..80952ca

The repository of evals/review/seeded.mjs, wrong in seven known places.

| configuration | outcome | findings | found | extra | input tokens | not-cached input | output tokens | requests | first request | seconds | CLI | model |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| current | reviewed | 6 | 6/7 | 0 | 151,204 | 44,068 | 1,823 | 4 | 27,912 | 79 | 0.161.0 | gpt-6-astra low |
| lean | reviewed | 7 | 7/7 | 0 | 54,797 | 21,261 | 2,001 | 4 | 5,717 | 60 | 0.161.0 | gpt-6.1-sol medium* |
| lean-own | reviewed | 7 | 7/7 | 0 | 55,203 | 20,003 | 2,034 | 4 | 6,156 | 61 | 0.161.0 | gpt-6.1-sol medium* |
| lean-high | reviewed | 8 | 7/7 | 1 | 57,161 | 21,961 | 3,308 | 4 | 5,726 | 87 | 0.161.0 | gpt-6.1-sol high* |
