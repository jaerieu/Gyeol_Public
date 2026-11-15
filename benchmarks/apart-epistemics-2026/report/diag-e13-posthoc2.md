# E13 Post-Hoc Verification Diagnostics (Review Audit Matrix)

Generated 2026-11-15T06:14:51.437Z strictly post-hoc from locked logs without altering preregistered files.

## 1. 18 Paired `L` Contrasts (`6` Cells x `3` Baselines)
- **Holm-adjusted (`p_Holm < 0.05`):** 5 Wins, 9 Ties (n.s.), 4 Losses (`natural` 4W/1T/1L; `json` 1W/3T/2L; `jsonchain` 0W/5T/1L).
- **Raw (`p < 0.05`):** 6 Wins, 8 Ties, 4 Losses (`jsonchain` 1W/4T/1L). All 4 Holm-significant losses occur in `haiku_on`/`haiku_off`.

| Baseline | Cell | L Diff | 95% Boot CI | p Raw | p Holm | Outcome (Holm) |
|---|---|---:|---|---:|---:|:---:|
| natural | deepseek_on | 0.294 | [0.179, 0.411] | 0.0078 | 0.0391 | W |
| natural | luna_on | 0.136 | [0.053, 0.232] | 0.0078 | 0.0391 | W |
| natural | haiku_on | -0.306 | [-0.445, -0.157] | 0.0156 | 0.0469 | L |
| natural | deepseek_off | 0.123 | [0.043, 0.211] | 0.0156 | 0.0469 | W |
| natural | luna_off | 0.179 | [0.100, 0.262] | 0.0059 | 0.0352 | W |
| natural | haiku_off | -0.130 | [-0.264, 0.009] | 0.1152 | 0.1152 | T |
| json | deepseek_on | 0.351 | [0.287, 0.415] | 0.0020 | 0.0117 | W |
| json | luna_on | 0.075 | [-0.023, 0.191] | 0.2383 | 0.4766 | T |
| json | haiku_on | -0.453 | [-0.543, -0.334] | 0.0039 | 0.0156 | L |
| json | deepseek_off | 0.081 | [0.028, 0.142] | 0.0625 | 0.1875 | T |
| json | luna_off | 0.019 | [-0.042, 0.079] | 0.6270 | 0.6270 | T |
| json | haiku_off | -0.279 | [-0.368, -0.194] | 0.0020 | 0.0117 | L |
| jsonchain | deepseek_on | 0.019 | [-0.008, 0.047] | 0.2813 | 0.8438 | T |
| jsonchain | luna_on | 0.009 | [-0.094, 0.134] | 0.9102 | 0.9102 | T |
| jsonchain | haiku_on | -0.549 | [-0.672, -0.398] | 0.0039 | 0.0234 | L |
| jsonchain | deepseek_off | -0.053 | [-0.119, 0.006] | 0.1953 | 0.7813 | T |
| jsonchain | luna_off | 0.066 | [-0.021, 0.183] | 0.3281 | 0.8438 | T |
| jsonchain | haiku_off | 0.143 | [0.064, 0.217] | 0.0313 | 0.1563 | T |

## 2. Event-Category Breakdown (`amend`, `withdraw`, `recompute`) & Unit Counts
| Cell | Fmt | Hop-30 Units | Amend L | Withdraw L | Recompute L (cNew / cOld / cEdge) |
|---|---|---:|---:|---:|---|
| deepseek_on | lon | 147.5 | 1.000 | 1.000 | 0.959 (0.983 / 0.969 / 0.959) |
| deepseek_on | jsonchain | 144.3 | 1.000 | 1.000 | 0.924 (0.952 / 0.924 / 0.924) |
| deepseek_on | json | 81.7 | 0.980 | 1.000 | 0.331 (0.414 / 0.331 / 0.331) |
| deepseek_on | natural | 95.7 | 0.930 | 1.000 | 0.469 (0.528 / 0.469 / 0.469) |
| luna_on | lon | 133.6 | 0.915 | 0.975 | 0.210 (0.317 / 0.214 / 0.210) |
| deepseek_off | lon | 71.2 | 1.000 | 1.000 | 0.148 (0.190 / 0.148 / 0.148) |
| luna_off | lon | 106.8 | 0.920 | 0.900 | 0.066 (0.093 / 0.066 / 0.066) |

## 3. Audit Base Rates & Exact Clopper-Pearson 95% CIs
| Format | Defective / Total Sess | Flag-All Sess Prec | Flag-All Hop Prec | Audit Sess Prec | Clean FA (`k/n`) | Clean FA 95% CI |
|---|---|---|---|---|---|---|
| json | 60/60 | 1.000 | 0.867 | 1.000 | 0/0 (0.000) | n/a (0/0) |
| jsonchain | 55/60 | 0.917 | 0.762 | 1.000 | 0/5 (0.000) | [0.000, 0.522] |
| lon | 53/60 | 0.883 | 0.714 | 0.961 | 2/7 (0.286) | [0.037, 0.710] |
| natural | 58/60 | 0.967 | 0.936 | 0.967 | 2/2 (1.000) | [0.158, 1.000] |
- **Post-hoc 3-tier `lon` content-only clean FA:** `0/7 (0.000)`, Clopper-Pearson 95% CI `[0.000, 0.410]`.

## 4. Static Prompt Character & Input Token Decomposition
| Format | Shared ROLE+POLICY+Sep | Format Block | Total Static Chars | ds_on Total `tin` | luna_on Total `tin` |
|---|---:|---:|---:|---:|---:|
| natural | 1685 | 635 | 2320 | 572,259 | 458,466 |
| json | 1685 | 679 | 2364 | 708,733 | 666,042 |
| jsonchain | 1685 | 860 | 2545 | 1,588,835 | 1,328,815 |
| lon | 1685 | 5253 | 6938 | 1,625,645 | 1,540,291 |
- **`lon` vs `jsonchain` total `tin`:** `ds_on +2.3%`, `luna_on +15.9%`. Note `lon`'s `5253`-char block = `3342` general lexicon/grammar + `1909` snapshot syntax.

## 5. Held-Out `S06..S10` Brier Ensemble Per-Scenario Check (`345` Items)
- **Overall:** Unweighted `0.1145`, `Eq. E` `0.0911` (5/5 scenarios improved), linear `S01..S05` Reader-Acc `0.0609`, hard `Muk >= 5` `0.0511` (5/5 improved vs unweighted; 5/5 better than linear Reader-Acc), Top-4 Reader-Acc `0.0511` (identical 4-cell set without requiring Reader labels: true).

| Scen | Unweighted | Eq. E | Muk >= 5 | Reader-Acc Lin | Top-4 Reader-Acc | Eq. E − Unw | Muk>=5 − Unw | Muk>=5 − RLin |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| S06 | 0.1288 | 0.0923 | 0.0344 | 0.0491 | 0.0344 | -0.0365 | -0.0944 | -0.0147 |
| S07 | 0.0761 | 0.0635 | 0.0426 | 0.0444 | 0.0426 | -0.0126 | -0.0335 | -0.0019 |
| S08 | 0.1063 | 0.0907 | 0.0643 | 0.0706 | 0.0643 | -0.0156 | -0.0420 | -0.0063 |
| S09 | 0.0773 | 0.0695 | 0.0516 | 0.0559 | 0.0516 | -0.0078 | -0.0257 | -0.0043 |
| S10 | 0.1840 | 0.1398 | 0.0625 | 0.0847 | 0.0625 | -0.0442 | -0.1215 | -0.0222 |
