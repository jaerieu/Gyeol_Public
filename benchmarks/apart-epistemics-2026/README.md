# Gyeol;Lon (E13 & E5/E6b) — Apart Research AI x Epistemics Benchmark Bundle

Pre-registered, zero-dependency reproduction bundle for **"Non-Destructive Epistemic Lineage, Key-Free Tamper Audit, and Calibrated Credibility Across 30-Hop LLM Relays with Gyeol;Lon"** (*AI x Epistemics Research Sprint*, November 2026).

## Quick Verification (Zero External Dependencies, Node 22.18+)

```bash
sha256sum -c prereg-e13.sha256
# Expected: 7/7 OK

sha256sum -c prereg-e5-e6.sha256
# Expected: 11/11 OK

node src/score-e13.mjs --selftest --sessions data/sessions-e13.json
# Expected: E13 scorer self-test PASS (0 failures)

node src/score-e13-ablation-nogq.mjs --selftest --sessions data/sessions-e13.json
# Expected: selftest: PASSED (10 scenarios, Hop-30 ideal L=530/530, V=340/340)
```

## Headline Pre-Registered & Ablation Results (`240` Sessions · `7,440` Planned / `7,176` Logged Calls [−305 unexecuted across 12 halted Haiku runs + 41 retries: 30 empty-refusal retries + 11 recovered] · `$18.31` + `$1.84` Ablation)

- **Potential 1 (Lineage & Blind Reader + `nogq` Ablation):** `deepseek_on | lon` attains `L = 0.977` (`7/10` scenarios at `L = 1.000`), `L_strict = 0.977`, `V = 1.000`, `Vh = 1.000`, and Hop-31 blind `Reader` accuracy `0.997` (current) / `0.994` (historical), matching verbose `jsonchain` (`0.958`, `p_Holm = 0.844`) in `34.4%` fewer chars while beating `natural` (`+0.294`, `p_Holm = 0.0391`) and flat `json` (`+0.351`, `p_Holm = 0.0117`, `recompute = 0.331`). Post-hoc live ablation `deepseek_on | jsonchain_nogq` jointly removing `grounds` and `quotes` drops `L` to `0.728` (`p = 0.0098`) with parser-external blind `Reader` dropping `−0.07` to `−0.10` (`p = 0.0156`), establishing explicit provenance links and verbatim spans as causal active ingredients. Across 18 paired `L` contrasts at `m = 6`, `lon` achieves `5W/9T/4L` (`m = 18` sensitivity: `1W/16T/1L`, `p_min = 0.00195`), outperforming prose across `deepseek_on/off` (`+0.294, +0.123`) and `gpt-6-luna` ON/OFF (`+0.136, +0.179`).
- **Potential 2 (Tamper-Evidence):** `<[[...]]>` adaptive verbatim fences preserve `0.875–1.000` non-refusing `Lon-hazard` (`]>`) survival (`ds_on/off 1.000`, `luna_off 0.975`, `luna_on 0.875`) with `0/941 (0.0%)` altered quotes on DeepSeek (`1.0%–1.2%` on GPT-6 Luna vs. `39.5%–56.3%` in prose).
- **Potential 3 (Oracle-Free Non-Rejecting Static Audit, `1,800` hops/format):** Without answer keys against `53/60 (88.3%)` defective `lon` sessions, the pre-registered pooled static audit yields session confusion `(49, 2, 4, 5)` (`92.5%` session recall, `94.1%` overall hop precision, `22.2`-hop early lead, `2/7 [0.286]` clean FA vs. `2/2` on prose, Fisher `p = 0.167`, no audit superiority over prose). Separating out the **post-hoc, in-sample** 3-tier decomposition yields Form lints (`0.916` hop precision, `0.698` session recall, `1/7` FA; cell-FE OLS across `54` completed sessions `df = 47`: zero reader penalty `p = 0.987`), Provenance (`0.910` hop precision, `0.623` session recall, `2/7` FA), and Substantive Content checks (`1.000 [461/461]` hop precision, `0/7 [0.000, 0.410]` FA, `0.528 [28/53]` session recall).
- **Potential 4 (`Muk v6`, `Eq. E` / Hard Gating & `E5/E6b`):** Ranking calibration-gap alignment within `0.05` over raw accuracy alone (`luna_on` Grade 9 at `gap = 0.0000`, `acc = 0.920`, `Brier 0.0795` ahead of higher-accuracy underconfident `ds_on` Grade 7 at `acc = 0.945`, `gap = 0.0644`, `Brier 0.0697`), with empirical `5,360`-clause `Chae` distribution (`R,C,M,Y,K = 0`; `colorGain ∈ [-0.0167, +0.0001]`) detecting zero signal under `Chae` non-definition, grades learned on `S01..S05` cut held-out `S06..S10` (`345` items) Brier loss by **20.4%** under `Eq. E` (`0.1145 -> 0.0911`; multiclass `-22.7%`, `0.1845 -> 0.1426`) and **55.4%** (`0.0511`, `Acc 0.942`; multiclass `-55.6%`, `0.0819`) under hard `Muk >= 5` gating across all `5/5` scenarios, matching unweighted top-4 `Reader` selection without requiring `Reader` labels. Across all 4 formats in complementary `E5/E6b` (`n = 98` clean items; `n = 290` non-self blind Haiku reviews: `DeepSeek 94 + GLM 98 + Luna 98`), `P1b` shows `lon` (`43%` DS / `84%–90%` others) below `jsonchain` (`63%` / `98%–100%`), whereas `lon` leads `P3` (`0.60–0.82` vs. `0.42–0.54`, `p < 0.001`), ties/leads `P4` (`0.65` vs. `0.63`), and blocks `100%` of Grade-1 adoptions.
- **Potential 5 (Efficiency, Schema Factorization & Breakpoint Caching):** Across the 4 non-refusal cells at Hop 30, `lon` factors `O(H)` repeated JSON keys/delimiters into an `O(1)` static grammar prefix (`5,253` vs. `635–860` spec chars; multi-turn auto-cache caveat), shrinking Hop-30 state `29%–40%` vs. `jsonchain` (`0` output truncations on `luna_off` vs. `8/10`; `1.9x–3.0x` vs. flat formats). Our harness configures an explicit `prompt_cache_breakpoint` after `ROLE + POLICY + FORMAT` on `GPT-6 Luna` (crossing OpenAI's `>= 1,024`-token threshold to trigger `38.9%–40.0%` caching vs. `0.0%–0.8%` on baselines) alongside automatic prefix caching on DeepSeek (`80.0%–87.3%`), reducing `ds_on` USD `−11.6%` via `+21.6%` reasoning (`−11.3%` billed out). Haiku surfaced `89` streaming empty-output refusals (`37/89 = 41.6%` on `lon`), with `haiku_on S02` halting across all 4 formats at Hop 3 while `lon` additionally halted `S03/S04/S10`.

## Pre-Existing Work vs. Sprint Work

- **Pre-Existing Assets (Before 13 November 2026):** Core zero-dependency `Gyeol` parser (`vendor/gyeol-ea35b6b/src/parse/` and matching `Muk v6` credibility math in `src/muk.ts`) were built prior to the sprint.
- **Sprint Work (13–15 November 2026):** All `Gyeol;Lon` `snapshot` continuity extensions (`W40`, `W45`, `carryDiff` in `vendor/gyeol-10fba3d/`), symmetric baseline prompts/salvage parsers, pre-registration SHA-256 locks (`prereg-e13.sha256`, `prereg-e5-e6.sha256`), `E1–E13` live experiments and logged runs (earliest timestamp `2026-11-13T08:21:41Z`, zero pre-sprint runs), deterministic scorers, post-hoc diagnostics (`diag-e13-posthoc.mjs`, `diag-e13-posthoc2.mjs`, `ablation-nogq`), figures, and final bilingual report/slides were developed and executed during the sprint.

## Bundle Structure

- `submission/`: Final PDF/Markdown report (`apart-report-en.{pdf,md}`), 16:9 presentation slides (`apart-slides-en.pdf`), and 16:9 project cover image (`apart-project-image.png`).
- `prereg-e13.md`, `prereg-e13.sha256`, `prereg-e5-e6.md`, `prereg-e5-e6.sha256`: SHA-256 frozen pre-registration specifications.
- `data/sessions-e13.json`: Deterministic 30-hop held-out scenarios `S01..S10` (seed `20261117`).
- `prompts/lon-base-10fba3d-en.txt`: Symmetrical `Gyeol;Lon` rule sheet (obeying the `Chae` color non-definition axiom).
- `src/`: Zero-dependency runners, scorers (`score-e13.mjs`, `score-e13-ablation-nogq.mjs`), post-hoc telemetry analyzers (`diag-e13-posthoc.mjs`, `diag-e13-posthoc2.mjs`), and SVG/Typst figure generator (`make-figures-e13.mjs`).
- `vendor/gyeol-10fba3d/`, `vendor/gyeol-ea35b6b/`: Vendored core `Gyeol` parser, snapshot `carryDiff`, and `Muk v6` calibration modules.
- `report/`: Verified primary metrics (`metrics-e13.{md,json}`), post-hoc `jsonchain_nogq` ablation (`ablation-nogq.{md,json}`), post-hoc root-cause decompositions (`diag-e13-posthoc.{md,json}`, `diag-e13-posthoc2.{md,json}`), `E5/E6b`/`main40`/`hard40` reports, and 300-DPI figures (`figures/fig1..5.png`).
