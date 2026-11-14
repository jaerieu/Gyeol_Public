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
```

## Headline Pre-Registered Results (`240` Sessions · `7,176` Calls · `$18.31`)

- **Potential 1 (Lineage & Blind Reader):** `deepseek_on | lon` attains `L = 0.977` (`7/10` scenarios `100%`), `L_strict = 0.977`, `V = 1.000`, `Vh = 1.000`, and Hop-31 blind `Reader` accuracy `0.997` (current) / `0.994` (historical), beating `natural` (`+0.294`, `p_Holm = 0.0391`) and flat `json` (`+0.351`, `p_Holm = 0.0117`). `lon` also outperforms prose across `gpt-6-luna` ON/OFF (`+0.136, +0.179`) and `deepseek_off` (`+0.123`).
- **Potential 2 (Tamper-Evidence):** `<[[...]]>` adaptive verbatim fences preserve `1.000` across `plain`, `JSON-hazard`, and `Lon-hazard` (`]>`) on DeepSeek with `0/941 (0.0%)` altered quotes (`1.0%–1.2%` on GPT-6 Luna vs. `39.5%–56.3%` in prose).
- **Potential 3 (Oracle-Free Static Audit, `1,800` hops/format):** Without answer keys, `lon` reaches `92.5%` session defect recall, `94.1%` hop precision, `22.2`-hop early lead, and `0.000` clean false alarms on 5/6 cells (vs. `100%` clean FA on prose).
- **Potential 4 (`Muk v6` & `Eq. E` + `E5/E6b`):** Grades learned strictly on `S01..S05` reduce held-out `S06..S10` (`345` items) ensemble Brier loss by **20.4%** (`0.1145 -> 0.0911`), while `colorGain ∈ [-0.0167, +0.0001]` confirms `Chae` (`RGBCMYK`) neutrality. Complementary `E5/E6b` (`n = 98`) shows `84%–90%` forged premise visibility and `100% (0/98)` Muk `grade >= 5` gating.
- **Potential 5 (Efficiency & Prefix Caching):** Hop-30 `lon` notes are `31%–40%` more compact than `jsonchain` (`0` output truncations on `luna_off` vs. `8/10`) and uniquely trigger GPT-6 Luna prefix caching (`38.9%–40.0%` vs. `0.0%–0.8%`).

## Bundle Structure

- `submission/`: Final PDF/Markdown report (`apart-report-en.{pdf,md}`), 16:9 presentation slides (`apart-slides-en.pdf`), and 16:9 project cover image (`apart-project-image.png`).
- `prereg-e13.md`, `prereg-e13.sha256`, `prereg-e5-e6.md`, `prereg-e5-e6.sha256`: SHA-256 frozen pre-registration specifications.
- `data/sessions-e13.json`: Deterministic 30-hop held-out scenarios `S01..S10` (seed `20261117`).
- `prompts/lon-base-10fba3d-en.txt`: Symmetrical `Gyeol;Lon` rule sheet (obeying the `Chae` color non-definition axiom).
- `src/`: Zero-dependency runner, scorer, post-hoc telemetry analyzer (`diag-e13-posthoc.mjs`), and SVG/Typst figure generator (`make-figures-e13.mjs`).
- `vendor/gyeol-10fba3d/`, `vendor/gyeol-ea35b6b/`: Vendored core `Gyeol` parser, snapshot `carryDiff`, and `Muk v6` calibration modules.
- `report/`: Verified primary metrics (`metrics-e13.{md,json}`), post-hoc root-cause decomposition (`diag-e13-posthoc.{md,json}`), `E5/E6b`/`main40`/`hard40` reports, and 300-DPI figures (`figures/fig1..5.png`).
