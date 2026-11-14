# E5 and E6: pre-registered endpoints

## P1. Chain exposure (forged items, answers that took either derivation)
Score 0 to 3: how many of the answer's own decisive premises (value document, derating rule, authority register) a parser can pull from the reply. Wilcoxon signed-rank, paired by item.

| Model | natural | json | jsonchain | lon | lon vs natural (n, p) | lon vs json (n, p) | lon vs jsonchain (n, p) |
|---|---|---|---|---|---|---|---|
| deepseek | 1.20 (n=55) | 0.45 (n=29) | 2.20 (n=35) | 1.44 (n=36) | 34, 0.444 | 20, 0.001 | 23, 0.160 |
| glm53flash | 1.36 (n=61) | 1.21 (n=61) | 2.98 (n=51) | 2.59 (n=58) | 57, 0.000 | 55, 0.000 | 47, 0.000 |
| haiku | 1.03 (n=66) | 0.86 (n=65) | 2.95 (n=65) | 2.27 (n=62) | 62, 0.000 | 60, 0.000 | 60, 0.000 |
| luna | 1.59 (n=63) | 1.54 (n=67) | 3.00 (n=61) | 2.76 (n=66) | 62, 0.000 | 66, 0.000 | 60, 0.048 |

P1b. Root cause visible: among answers that adopted the planted value, both forged premises (value and derating) are in the parsed grounds.

| Model | natural | json | jsonchain | lon |
|---|---|---|---|---|
| deepseek | 17% (9/53) | 0% (0/29) | 63% (22/35) | 44% (16/36) |
| glm53flash | 13% (8/60) | 19% (11/59) | 100% (49/49) | 84% (49/58) |
| haiku | 7% (4/54) | 0% (0/42) | 98% (47/48) | 85% (40/47) |
| luna | 46% (29/63) | 35% (23/66) | 100% (61/61) | 91% (59/65) |

## P2. Key-free audit v2 (no answer key)
Flag = unissued id, any quote or relay not verbatim, or a "see" with no document. Lift = precision minus the bad-answer rate (0 means the flag is no better than chance).

| Model | Format | Bad rate | Flag rate | Recall | Precision | Lift |
|---|---|---|---|---|---|---|
| deepseek | json | 59% (59/100) | 0% (0/100) | 0% (0/59) | n/a | n/a |
| deepseek | jsonchain | 63% (63/100) | 17% (17/100) | 14% (9/63) | 53% (9/17) | -10 pts |
| deepseek | lon | 87% (87/100) | 24% (24/100) | 24% (21/87) | 88% (21/24) | +1 pts |
| deepseek | natural | 65% (65/100) | 3% (3/100) | 3% (2/65) | 67% (2/3) | +2 pts |
| glm53flash | json | 72% (72/100) | 16% (16/100) | 19% (14/72) | 88% (14/16) | +16 pts |
| glm53flash | jsonchain | 56% (56/100) | 45% (45/100) | 70% (39/56) | 87% (39/45) | +31 pts |
| glm53flash | lon | 70% (70/100) | 52% (52/100) | 61% (43/70) | 83% (43/52) | +13 pts |
| glm53flash | natural | 65% (65/100) | 22% (22/100) | 22% (14/65) | 64% (14/22) | -1 pts |
| haiku | json | 43% (43/100) | 0% (0/100) | 0% (0/43) | n/a | n/a |
| haiku | jsonchain | 48% (48/100) | 5% (5/100) | 2% (1/48) | 20% (1/5) | -28 pts |
| haiku | lon | 47% (47/100) | 46% (46/100) | 53% (25/47) | 54% (25/46) | +7 pts |
| haiku | natural | 54% (54/100) | 0% (0/100) | 0% (0/54) | n/a | n/a |
| luna | json | 66% (66/100) | 41% (41/100) | 35% (23/66) | 56% (23/41) | -10 pts |
| luna | jsonchain | 61% (61/100) | 43% (43/100) | 49% (30/61) | 70% (30/43) | +9 pts |
| luna | lon | 68% (68/100) | 34% (34/100) | 38% (26/68) | 76% (26/34) | +8 pts |
| luna | natural | 66% (66/100) | 45% (45/100) | 35% (23/66) | 51% (23/45) | -15 pts |

## P3. Tamper evidence
Share of document figures stated in the reply that sit inside a quote or relay the reader can check verbatim against the source. Changing any such figure in transit is caught with no model call; a figure outside them is not. Wilcoxon signed-rank, paired by item.

| Model | natural | json | jsonchain | lon | lon vs natural (n, p) | lon vs json (n, p) | lon vs jsonchain (n, p) |
|---|---|---|---|---|---|---|---|
| deepseek | 0.28 (n=99) | 0.86 (n=62) | 0.48 (n=100) | 0.59 (n=100) | 99, 0.000 | 62, 0.000 | 100, 0.000 |
| glm53flash | 0.27 (n=100) | 0.67 (n=95) | 0.42 (n=100) | 0.75 (n=100) | 100, 0.000 | 95, 0.102 | 100, 0.000 |
| haiku | 0.33 (n=100) | 0.78 (n=99) | 0.42 (n=100) | 0.63 (n=96) | 96, 0.000 | 95, 0.000 | 96, 0.000 |
| luna | 0.30 (n=100) | 0.46 (n=98) | 0.53 (n=100) | 0.82 (n=100) | 100, 0.000 | 98, 0.000 | 100, 0.000 |

## P4. Downstream reviewer without the documents (E6b)
AUROC of the reviewer's confidence for upstream answers that were right versus wrong (planted or other). 0.5 = cannot tell them apart. Bad accepted = wrong answers the reviewer accepted.

| Reviewer | Upstream model | Format | n | AUROC | Bad accepted | Good accepted |
|---|---|---|---|---|---|---|
| haiku | deepseek | json | 67 | 0.27 | 25% (15/59) | 0% (0/8) |
| haiku | deepseek | jsonchain | 72 | 0.85 | 21% (13/63) | 67% (6/9) |
| haiku | deepseek | lon | 96 | 0.66 | 16% (14/87) | 67% (6/9) |
| haiku | deepseek | natural | 96 | 0.44 | 3% (2/65) | 3% (1/31) |
| haiku | glm53flash | json | 99 | 0.30 | 13% (9/72) | 0% (0/27) |
| haiku | glm53flash | jsonchain | 83 | 0.54 | 59% (33/56) | 67% (18/27) |
| haiku | glm53flash | lon | 100 | 0.69 | 49% (34/70) | 80% (24/30) |
| haiku | glm53flash | natural | 99 | 0.50 | 5% (3/65) | 6% (2/34) |
| haiku | haiku | json | 98 | 0.29 | 16% (7/43) | 0% (0/55) |
| haiku | haiku | jsonchain | 98 | 0.55 | 40% (19/48) | 52% (26/50) |
| haiku | haiku | lon | 95 | 0.49 | 55% (26/47) | 50% (24/48) |
| haiku | haiku | natural | 99 | 0.30 | 6% (3/54) | 0% (0/45) |
| haiku | luna | json | 99 | 0.57 | 35% (23/66) | 42% (14/33) |
| haiku | luna | jsonchain | 94 | 0.49 | 54% (33/61) | 61% (20/33) |
| haiku | luna | lon | 100 | 0.47 | 85% (58/68) | 75% (24/32) |
| haiku | luna | natural | 99 | 0.63 | 12% (8/66) | 45% (15/33) |

P4 pooled over upstream models (paired item bootstrap, 2000 draws, for the AUROC difference lon minus other):

| Reviewer | natural | json | jsonchain | lon | lon minus natural [95% CI] | lon minus json | lon minus jsonchain |
|---|---|---|---|---|---|---|---|
| haiku | 0.47 | 0.38 | 0.59 | 0.59 | 0.12 [0.04, 0.20] | 0.22 [0.13, 0.30] | -0.00 [-0.08, 0.08] |
| haiku, own upstream excluded | 0.53 | 0.44 | 0.63 | 0.65 | 0.12 [0.03, 0.22] | 0.21 [0.12, 0.31] | 0.02 [-0.07, 0.10] |

## S1. Muk reader (secondary)
Two-fold: each model's Muk credibility grade is learned on the even-numbered items and applied to the odd ones, and the other way round. The Muk reader acts on an answer only if its source's learned grade is 5 or more; the confidence reader acts on confidence 7 or more.

| Model | Format | Learned grades (even, odd) | Confidence reader: acted, planted through | Muk reader: acted, planted through |
|---|---|---|---|---|
| deepseek | json | 1, 1 | 49, 16 | 0, 0 |
| deepseek | jsonchain | 1, 1 | 65, 30 | 0, 0 |
| deepseek | lon | 1, 1 | 95, 35 | 0, 0 |
| deepseek | natural | 1, 1 | 81, 48 | 0, 0 |
| glm53flash | json | 1, 1 | 80, 51 | 0, 0 |
| glm53flash | jsonchain | 1, 1 | 77, 45 | 0, 0 |
| glm53flash | lon | 1, 1 | 96, 56 | 0, 0 |
| glm53flash | natural | 1, 1 | 95, 58 | 0, 0 |
| haiku | json | 5, 6 | 47, 22 | 100, 42 |
| haiku | jsonchain | 7, 5 | 63, 30 | 100, 48 |
| haiku | lon | 6, 5 | 45, 19 | 100, 47 |
| haiku | natural | 3, 5 | 56, 25 | 49, 29 |
| luna | json | 1, 1 | 100, 66 | 0, 0 |
| luna | jsonchain | 1, 1 | 94, 61 | 0, 0 |
| luna | lon | 1, 1 | 100, 65 | 0, 0 |
| luna | natural | 1, 1 | 100, 63 | 0, 0 |

## Multiple comparisons
Primary contrasts are Lon versus natural for P1, P3 and P4, Holm-adjusted together across models. Lon versus json and jsonchain are secondary and reported unadjusted.

| Contrast | p | Holm p |
|---|---|---|
| P1 deepseek vs natural | 0.444 | 0.444 |
| P1 deepseek vs json | 0.001 |  |
| P1 deepseek vs jsonchain | 0.160 |  |
| P1 glm53flash vs natural | 0.000 | 0.000 |
| P1 glm53flash vs json | 0.000 |  |
| P1 glm53flash vs jsonchain | 0.000 |  |
| P1 haiku vs natural | 0.000 | 0.000 |
| P1 haiku vs json | 0.000 |  |
| P1 haiku vs jsonchain | 0.000 |  |
| P1 luna vs natural | 0.000 | 0.000 |
| P1 luna vs json | 0.000 |  |
| P1 luna vs jsonchain | 0.048 |  |
| P3 deepseek vs natural | 0.000 | 0.000 |
| P3 deepseek vs json | 0.000 |  |
| P3 deepseek vs jsonchain | 0.000 |  |
| P3 glm53flash vs natural | 0.000 | 0.000 |
| P3 glm53flash vs json | 0.102 |  |
| P3 glm53flash vs jsonchain | 0.000 |  |
| P3 haiku vs natural | 0.000 | 0.000 |
| P3 haiku vs json | 0.000 |  |
| P3 haiku vs jsonchain | 0.000 |  |
| P3 luna vs natural | 0.000 | 0.000 |
| P3 luna vs json | 0.000 |  |
| P3 luna vs jsonchain | 0.000 |  |
| P4 haiku vs natural | 0.004 | 0.008 |
| P4 haiku vs json | 0.000 |  |
| P4 haiku vs jsonchain | 0.992 |  |

