# E13 Post-Hoc Error Decomposition (Non-Modifying Sensitivity & Root-Cause Log)

Generated 2026-11-14T20:15:05.375Z. Pre-registered files in `prereg-e13.sha256` remain untouched; primary tables live in `report/metrics-e13.md`.

## 1. API Refusals & Error Rows Across All 6 Model Cells
| model | rows | errors | empty replies | refusals (empty / mid-stream) | refusal formats | empty refusals by format |
|---|---|---|---|---|---|---|
| deepseek_on | 1245 | 0 | 7 | 0 (0/0) | {} | {} |
| deepseek_off | 1240 | 0 | 0 | 0 (0/0) | {} | {} |
| haiku_on | 1066 | 0 | 29 | 49 (29/20) | {"natural":12,"json":7,"jsonchain":12,"lon":18} | {"natural":3,"json":3,"jsonchain":8,"lon":15} |
| haiku_off | 1140 | 0 | 15 | 40 (15/25) | {"natural":9,"jsonchain":11,"lon":19,"json":1} | {"natural":3,"jsonchain":6,"lon":6} |
| luna_on | 1240 | 0 | 0 | 0 (0/0) | {} | {} |
| luna_off | 1245 | 5 | 0 | 0 (0/0) | {} | {} |

## 2. `haiku_on | lon` Dual Failure Mechanism & Wrapper-Stripped Sensitivity
- **Safety classifier refusals**: `haiku_on | lon` triggered 18 API `finish: "refusal"` responses (15 empty), halting 4/10 sessions at Hop 3 (`S02, S03, S04`) and Hop 4 (`S10`), plus 1 empty refusal each at Hop 31 (`S06, S08`). For comparison, `haiku_off | lon` triggered 19 refusals (6 empty, plus mid-stream truncations across formats). Refusals in `haiku_on` across all formats: `{"natural":12,"json":7,"jsonchain":12,"lon":18}`; `haiku_off`: `{"natural":9,"jsonchain":11,"lon":19,"json":1}`.
- **Prompt-wrapper boundary leak**: On all 6 completed sessions (`S01, S05, S06, S07, S08, S09`), `haiku_on` copied `=== End of document evdN ===` inside `evdN <[ ... ]>` / `<[[ ... ]]>` relays (starting at hops 3 or 5).
- **Stripped sensitivity (`6/10` completed mean)**: `V = 0.995`, `Vh = 0.989`, `L = 0.786` (`S01 = 53/53 = 1.000`), `L_strict = 0.764`, altered spans = `7/377` (`0.019` vs raw `0.451`).
- **Stripped ITT mean (`10/10` sessions including 4 halted at hops 3 to 4)**: `L = 0.472`, `V = 0.597`, `Muk` Grade `5` (credBase `5.491`, gap `0.1389`, Brier `0.0551`, clauses `529`).

| scen | complete | first wrapper hop | raw V | raw L | stripped V | stripped L | stripped L_strict | altered (stripped) |
|---|---|---|---|---|---|---|---|---|
| S01 | true | 3 | 0.000 | 0.000 | 1.000 | 1.000 | 0.962 | 0/116 |
| S02 | false | n/a | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0/0 |
| S03 | false | n/a | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0/0 |
| S04 | false | n/a | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0/0 |
| S05 | true | 5 | 0.059 | 0.000 | 1.000 | 0.830 | 0.811 | 0/34 |
| S06 | true | 5 | 0.029 | 0.000 | 0.971 | 0.830 | 0.811 | 2/33 |
| S07 | true | 3 | 0.029 | 0.000 | 1.000 | 0.679 | 0.642 | 3/40 |
| S08 | true | 3 | 0.029 | 0.000 | 1.000 | 0.642 | 0.642 | 0/35 |
| S09 | true | 3 | 0.059 | 0.000 | 1.000 | 0.736 | 0.717 | 2/119 |
| S10 | false | n/a | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 | 0/0 |

## 3. `deepseek_on | lon` Missed Lineage Events & Static-Audit Decomposition
| scen | clean session | defect hops | Hop-30 missed events | audit flags | unique audit reasons |
|---|---|---|---|---|---|
| S01 | true | 0 | none | 0 | none |
| S02 | false | 10 | D2_v8 | 0 | none |
| S03 | false | 19 | D2_v4 | 0 | none |
| S04 | true | 0 | none | 0 | none |
| S05 | false | 22 | D2_v3, D1_v3, D2_v4, D1_v4, D2_v5, D1_v7, D2_v9, D2_v10, D1_v8, D2_v11 | 0 | none |
| S06 | true | 0 | none | 29 | E19, E33, W40 |
| S07 | true | 0 | none | 0 | none |
| S08 | true | 0 | none | 0 | none |
| S09 | true | 0 | none | 1 | CARRY_ALTER |
| S10 | true | 0 | none | 0 | none |

## 4. `luna_off | lon` S03 Status Trace
Rows in `S03|luna_off|lon`: 35. Settled at Hop 31? true. Error rows: [{"hop":1,"attempt":0,"cache":"rejected","finish":null,"error":"7003: User Input Error","textLen":0,"leaksReasoningPrefix":false},{"hop":3,"attempt":0,"cache":"rejected","finish":null,"error":"7003: User Input Error","textLen":0,"leaksReasoningPrefix":false},{"hop":3,"attempt":0,"cache":"rejected","finish":null,"error":"7003: User Input Error","textLen":0,"leaksReasoningPrefix":false},{"hop":3,"attempt":0,"cache":"rejected","finish":null,"error":"7003: User Input Error","textLen":0,"leaksReasoningPrefix":false}]. Hop 2 leaked scratchpad prefix? true.
