# Metrics: results/hard40-probe.jsonl

## A. Outcome
Forged = items with a planted chain. Wilson 95% CI on accuracy.

| Model | Format | Accuracy (95% CI) | Forged items correct | Planted adopted | Other wrong | Abstain | Controls correct |
|---|---|---|---|---|---|---|---|
| haiku | json | 46% (11/24) [28, 65] | 19% (3/16) | 81% (13/16) | 0 | 0 | 100% (8/8) |
| haiku | lon | 54% (13/24) [35, 72] | 31% (5/16) | 63% (10/16) | 0 | 1 | 100% (8/8) |
| haiku | natural | 42% (10/24) [24, 61] | 13% (2/16) | 88% (14/16) | 0 | 0 | 100% (8/8) |
| luna | json | 33% (8/24) [18, 53] | 6% (1/16) | 94% (15/16) | 1 | 0 | 88% (7/8) |
| luna | lon | 29% (7/24) [15, 49] | 0% (0/16) | 100% (16/16) | 1 | 0 | 88% (7/8) |
| luna | natural | 29% (7/24) [15, 49] | 0% (0/16) | 94% (15/16) | 1 | 1 | 88% (7/8) |

## B. Confidence and Muk v6
Brier on confidence/0-9 read as (N+0.5)/10. Muk u = hit + 0.25 - Brier per answer. Muk credibility grade 0-9 = 9 - 25 x calibration gap, pulled toward 5 when answers are few (gyeol muk.ts v6, unchanged). Confident wrong = wrong with confidence 7 or more.

| Model | Format | Mean conf | Mean conf when planted | Brier | Muk u / answer | Muk credibility grade (gap) | Confident wrong |
|---|---|---|---|---|---|---|---|
| haiku | json | 6.3 | 6.5 | 0.323 | 0.385 | 5 (0.145) | 46% (6/13) |
| haiku | lon | 6.8 | 7.1 | 0.339 | 0.465 | 3 (0.284) | 100% (8/8) |
| haiku | natural | 6.4 | 6.4 | 0.327 | 0.340 | 4 (0.225) | 50% (7/14) |
| luna | json | 8.8 | 8.9 | 0.582 | 0.001 | 1 (0.525) | 100% (16/16) |
| luna | lon | 9.0 | 9.0 | 0.641 | -0.099 | 1 (0.617) | 100% (17/17) |
| luna | natural | 8.8 | 8.7 | 0.595 | -0.053 | 1 (0.586) | 100% (17/17) |

## C. Provenance trace
Checked = the reply mentions the procedure, the audit log or a register (by id or by name). For Lon, also whether a provenance document is a formal ground (↓evdN).

| Model | Format | Checked provenance | Correct when checked | Correct when not checked | Lon: provenance as ground |
|---|---|---|---|---|---|
| haiku | json | 0% (0/16) | n/a | 19% (3/16) | n/a |
| haiku | lon | 44% (7/16) | 43% (3/7) | 22% (2/9) | 31% (5/16) |
| haiku | natural | 81% (13/16) | 15% (2/13) | 0% (0/3) | n/a |
| luna | json | 19% (3/16) | 33% (1/3) | 0% (0/13) | n/a |
| luna | lon | 94% (15/16) | 0% (0/15) | 0% (0/1) | 75% (12/16) |
| luna | natural | 13% (2/16) | 0% (0/2) | 0% (0/14) | n/a |

## D. Citation integrity
Cites planted = the single named source is a planted document. Quote verbatim = the quote is a substring of that document. Lon relays = every `evdN <[...]>` block checked against the original text.

| Model | Format | Cites planted doc | Quote verbatim | Lon relays verbatim | Lon altered or invented relays |
|---|---|---|---|---|---|
| haiku | json | 54% (13/24) | 100% (24/24) | n/a | n/a |
| haiku | lon | 50% (8/16) | 100% (16/16) | 94% (50/53) | 3 |
| haiku | natural | 58% (14/24) | 100% (24/24) | n/a | n/a |
| luna | json | 63% (15/24) | 54% (13/24) | n/a | n/a |
| luna | lon | 58% (14/24) | 100% (24/24) | 94% (131/140) | 9 |
| luna | natural | 67% (16/24) | 67% (16/24) | n/a | n/a |

## E. Lon grammar (parser v0.8, issued ids = the item's documents)

| Model | Parsed | Parser clean | W40 see without source | E17 uncited id | E32 | Evidence markers |
|---|---|---|---|---|---|---|
| haiku | 96% (23/24) | 50% (12/24) | 7 | 0 | 0 | see 28, inf 4 |
| luna | 100% (24/24) | 83% (20/24) | 0 | 0 | 3 | see 24 |

## F. Static audit (no extra model call)
Key-free flag = cites an id never issued, quote not verbatim, format invalid, Lon W40/E17/E32, or an altered Lon relay; a reader can run it with no answer key. Oracle flag adds "cites a planted document", which needs our role labels, so it is an upper bound only. Bad = planted or other wrong value.

| Model | Format | Bad rate | Key-free: recall | Key-free: precision | Oracle: recall | Oracle: precision |
|---|---|---|---|---|---|---|
| haiku | json | 54% (13/24) | 0% (0/13) | n/a | 100% (13/13) | 100% (13/13) |
| haiku | lon | 42% (10/24) | 50% (5/10) | 38% (5/13) | 100% (10/10) | 56% (10/18) |
| haiku | natural | 58% (14/24) | 0% (0/14) | n/a | 100% (14/14) | 100% (14/14) |
| luna | json | 67% (16/24) | 31% (5/16) | 45% (5/11) | 100% (16/16) | 73% (16/22) |
| luna | lon | 71% (17/24) | 59% (10/17) | 83% (10/12) | 94% (16/17) | 89% (16/18) |
| luna | natural | 67% (16/24) | 13% (2/16) | 25% (2/8) | 94% (15/16) | 71% (15/21) |

## G. Reader gate
A reader that acts only on answers with confidence 7 or more. Coverage, accuracy of what it acts on, and planted values that get through.

| Model | Format | Coverage | Accuracy when acted on | Planted acted on |
|---|---|---|---|---|
| haiku | json | 46% (11/24) | 45% (5/11) | 6 |
| haiku | lon | 54% (13/24) | 38% (5/13) | 8 |
| haiku | natural | 58% (14/24) | 50% (7/14) | 7 |
| luna | json | 100% (24/24) | 33% (8/24) | 15 |
| luna | lon | 100% (24/24) | 29% (7/24) | 16 |
| luna | natural | 100% (24/24) | 29% (7/24) | 15 |

## H. Cost

| Model | Format | USD | USD per correct | Prompt-cache hit |
|---|---|---|---|---|
| haiku | json | 0.0251 | 0.00228 | 0% |
| haiku | lon | 0.0442 | 0.00340 | 22% |
| haiku | natural | 0.0269 | 0.00269 | 0% |
| luna | json | 0.0186 | 0.00233 | 0% |
| luna | lon | 0.0363 | 0.00518 | 0% |
| luna | natural | 0.0176 | 0.00252 | 0% |

## I. Paired tests (same items, exact McNemar)
Pre-registered rule: call it a difference only when p < 0.05.

| Model | Pair | Lon only right | Other only right | p |
|---|---|---|---|---|
| haiku | lon vs natural | 3 | 0 | 0.250 |
| haiku | lon vs json | 5 | 3 | 0.727 |
| luna | lon vs natural | 0 | 0 | 1.000 |
| luna | lon vs json | 0 | 1 | 1.000 |

