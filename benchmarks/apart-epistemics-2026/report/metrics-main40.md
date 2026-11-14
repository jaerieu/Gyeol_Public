# Metrics: results/main40.jsonl

## A. Outcome
Forged = items with a planted chain. Wilson 95% CI on accuracy.

| Model | Format | Accuracy (95% CI) | Forged items correct | Planted adopted | Other wrong | Abstain | Controls correct |
|---|---|---|---|---|---|---|---|
| haiku | json | 54% (39/72) [43, 65] | 31% (15/48) | 69% (33/48) | 0 | 0 | 100% (24/24) |
| haiku | lon | 44% (32/72) [34, 56] | 17% (8/48) | 69% (33/48) | 0 | 7 | 100% (24/24) |
| haiku | natural | 47% (34/72) [36, 59] | 21% (10/48) | 79% (38/48) | 0 | 0 | 100% (24/24) |
| luna | json | 35% (25/72) [25, 46] | 2% (1/48) | 94% (45/48) | 2 | 0 | 100% (24/24) |
| luna | lon | 33% (24/72) [24, 45] | 0% (0/48) | 98% (47/48) | 1 | 0 | 100% (24/24) |
| luna | natural | 33% (24/72) [24, 45] | 0% (0/48) | 98% (47/48) | 1 | 0 | 100% (24/24) |

## B. Confidence and Muk v6
Brier on confidence/0-9 read as (N+0.5)/10. Muk u = hit + 0.25 - Brier per answer. Muk credibility grade 0-9 = 9 - 25 x calibration gap, pulled toward 5 when answers are few (gyeol muk.ts v6, unchanged). Confident wrong = wrong with confidence 7 or more.

| Model | Format | Mean conf | Mean conf when planted | Brier | Muk u / answer | Muk credibility grade (gap) | Confident wrong |
|---|---|---|---|---|---|---|---|
| haiku | json | 6.3 | 6.4 | 0.286 | 0.505 | 6 (0.116) | 39% (13/33) |
| haiku | lon | 6.7 | 6.8 | 0.290 | 0.401 | 5 (0.178) | 72% (18/25) |
| haiku | natural | 6.3 | 6.3 | 0.297 | 0.425 | 6 (0.124) | 45% (17/38) |
| luna | json | 8.9 | 8.9 | 0.571 | 0.026 | 1 (0.531) | 100% (47/47) |
| luna | lon | 8.8 | 8.8 | 0.584 | -0.000 | 1 (0.543) | 100% (48/48) |
| luna | natural | 8.9 | 8.9 | 0.588 | -0.004 | 1 (0.551) | 100% (48/48) |

## C. Provenance trace
Checked = the reply mentions the procedure, the audit log or a register (by id or by name). For Lon, also whether a provenance document is a formal ground (↓evdN).

| Model | Format | Checked provenance | Correct when checked | Correct when not checked | Lon: provenance as ground |
|---|---|---|---|---|---|
| haiku | json | 0% (0/48) | n/a | 31% (15/48) | n/a |
| haiku | lon | 50% (24/48) | 21% (5/24) | 13% (3/24) | 38% (18/48) |
| haiku | natural | 94% (45/48) | 22% (10/45) | 0% (0/3) | n/a |
| luna | json | 35% (17/48) | 6% (1/17) | 0% (0/31) | n/a |
| luna | lon | 92% (44/48) | 0% (0/44) | 0% (0/4) | 88% (42/48) |
| luna | natural | 21% (10/48) | 0% (0/10) | 0% (0/38) | n/a |

## D. Citation integrity
Cites planted = the single named source is a planted document. Quote verbatim = the quote is a substring of that document. Lon relays = every `evdN <[...]>` block checked against the original text.

| Model | Format | Cites planted doc | Quote verbatim | Lon relays verbatim | Lon altered or invented relays |
|---|---|---|---|---|---|
| haiku | json | 46% (33/72) | 100% (72/72) | n/a | n/a |
| haiku | lon | 48% (27/56) | 91% (51/56) | 95% (157/166) | 9 |
| haiku | natural | 53% (38/72) | 100% (72/72) | n/a | n/a |
| luna | json | 63% (45/72) | 61% (44/72) | n/a | n/a |
| luna | lon | 51% (37/72) | 96% (69/72) | 94% (428/455) | 27 |
| luna | natural | 67% (48/72) | 72% (52/72) | n/a | n/a |

## E. Lon grammar (parser v0.8, issued ids = the item's documents)

| Model | Parsed | Parser clean | W40 see without source | E17 uncited id | E32 | Evidence markers |
|---|---|---|---|---|---|---|
| haiku | 92% (66/72) | 61% (44/72) | 16 | 0 | 0 | see 90, inf 21 |
| luna | 100% (72/72) | 92% (66/72) | 0 | 0 | 6 | see 75 |

## F. Static audit (no extra model call)
Key-free flag = cites an id never issued, quote not verbatim, format invalid, Lon W40/E17/E32, or an altered Lon relay; a reader can run it with no answer key. Oracle flag adds "cites a planted document", which needs our role labels, so it is an upper bound only. Bad = planted or other wrong value.

| Model | Format | Bad rate | Key-free: recall | Key-free: precision | Oracle: recall | Oracle: precision |
|---|---|---|---|---|---|---|
| haiku | json | 46% (33/72) | 0% (0/33) | n/a | 100% (33/33) | 100% (33/33) |
| haiku | lon | 46% (33/72) | 48% (16/33) | 47% (16/34) | 100% (33/33) | 65% (33/51) |
| haiku | natural | 53% (38/72) | 0% (0/38) | n/a | 100% (38/38) | 100% (38/38) |
| luna | json | 65% (47/72) | 36% (17/47) | 61% (17/28) | 100% (47/47) | 81% (47/58) |
| luna | lon | 67% (48/72) | 40% (19/48) | 63% (19/30) | 88% (42/48) | 79% (42/53) |
| luna | natural | 67% (48/72) | 17% (8/48) | 40% (8/20) | 100% (48/48) | 80% (48/60) |

## G. Reader gate
A reader that acts only on answers with confidence 7 or more. Coverage, accuracy of what it acts on, and planted values that get through.

| Model | Format | Coverage | Accuracy when acted on | Planted acted on |
|---|---|---|---|---|
| haiku | json | 42% (30/72) | 57% (17/30) | 13 |
| haiku | lon | 56% (40/72) | 55% (22/40) | 18 |
| haiku | natural | 50% (36/72) | 53% (19/36) | 17 |
| luna | json | 100% (72/72) | 35% (25/72) | 45 |
| luna | lon | 100% (72/72) | 33% (24/72) | 47 |
| luna | natural | 100% (72/72) | 33% (24/72) | 47 |

## H. Cost

| Model | Format | USD | USD per correct | Prompt-cache hit |
|---|---|---|---|---|
| haiku | json | 0.0769 | 0.00197 | 0% |
| haiku | lon | 0.1342 | 0.00419 | 23% |
| haiku | natural | 0.0808 | 0.00238 | 0% |
| luna | json | 0.0536 | 0.00214 | 0% |
| luna | lon | 0.1127 | 0.00469 | 0% |
| luna | natural | 0.0516 | 0.00215 | 0% |

## I. Paired tests (same items, exact McNemar)
Pre-registered rule: call it a difference only when p < 0.05.

| Model | Pair | Lon only right | Other only right | p |
|---|---|---|---|---|
| haiku | lon vs natural | 4 | 6 | 0.754 |
| haiku | lon vs json | 2 | 9 | 0.065 |
| luna | lon vs natural | 0 | 0 | 1.000 |
| luna | lon vs json | 0 | 1 | 1.000 |

