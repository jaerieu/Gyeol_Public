# Pre-Registration E13: 30-Hop Non-Destructive Epistemic Lineage, Tamper-Evidence, Key-Free Static Audit, Muk v6 Calibration, and Long-Session Efficiency

- **Timestamp**: `2026-11-15T01:45:00+10:00` (Brisbane / AEST)
- **Sprint**: Apart Research AI x Epistemics Research Sprint (2026-11-13 to 2026-11-15)
- **Core Reference Snapshot**: `gyeol` branch `e13-snapshot` commit `10fba3d` (vendored read-only under `vendor/gyeol-10fba3d/`)
- **Status**: Frozen before running any scenario in `data/sessions-e13.json` (`S01`..`S10`). Hashes locked in `prereg-e13.sha256`.

---

## 1. Design Matrix & Frozen Stimuli
- **Stimuli (`data/sessions-e13.json`)**: `10` freshly generated held-out scenarios (`S01` through `S10`, deterministic PRNG seed `20261117`). Each scenario comprises `30` sequential relay documents (`evd*`), `53` lineage events (`20` `amend`, `29` `recompute`, `4` `withdraw`), `34` final in-force payloads (`plain`, `json`, `lon` hazard subsets including `]>` substrings), `58` total historical payloads, `33` derived versions across `D1..D4`, and `69` Hop-31 `Reader` questions (`38` current-state, `31` lineage/historical).
- **Models & Reasoning Regimes (`6` cells)**:
  1. `deepseek_on`: `@cf/deepseek-ai/deepseek-v4.1-flash-1017` (`effort: 'low'`, `max_tokens: 24000`)
  2. `deepseek_off`: `@cf/deepseek-ai/deepseek-v4.1-flash-1017` (`effort: 'none'`, `max_tokens: 24000`)
  3. `haiku_on`: `anthropic/claude-haiku-5.5` (`thinking: { type: 'adaptive' }`, `output_config: { effort: 'low' }`, `max_tokens: 24000`, `cache_control: ephemeral`)
  4. `haiku_off`: `anthropic/claude-haiku-5.5` (`thinking: { type: 'disabled' }`, `max_tokens: 24000`, `cache_control: ephemeral`)
  5. `luna_on`: `openai/gpt-6-luna` (Responses API, `reasoning: { effort: 'low' }`, `max_output_tokens: 24000`, `prompt_cache_options: explicit`)
  6. `luna_off`: `openai/gpt-6-luna` (Responses API, `reasoning: { effort: 'none' }`, `max_output_tokens: 24000`, `prompt_cache_options: explicit`)
- **Formats (`4` levels, shared semantic `POLICY`, symmetric snapshot full-note carry-forward)**:
  1. `natural` (sequential numbered plain English `[1], [2], ...` with explicit `revises [k]`, `withdraws [k]`, `from [a], [b]`)
  2. `json` (single JSON object `{"items": [...]}`)
  3. `jsonchain` (single JSON object `{"steps": [...]}` with `claim`, `evidence`, `revises`, `retracts`, `grounds`, `quotes`)
  4. `lon` (`Gyeol;Lon v0.8 · snapshot`, rule sheet `dict/lon-v0.8.txt` + `snapshot` rules, `<N · ...>` sequential clauses, `fix→k` / `err→k` relation prefixes before `[markers]`, external verbatim relay fences `evdM <[...]>` / `evdM <[[...]]>`, per-clause `*chae` with undefined `RGBCMYK` letter + honest `0..9` confidence digit)
- **Scale**: `6 model cells × 4 formats × 10 scenarios = 240 sessions` (`30` relay hops + `1` blind `Reader` call = `7,440` planned model calls; transient network/API errors retried deterministically without cherry-picking).

---

## 2. Pre-Registered Endpoints & Five Epistemic Potentials

### Primary Endpoint & Contrasts (**Potential 1: Non-Destructive Lineage Survival**)
- **Primary metric `L` (at Hop 30)**: Mean survival across the `53` lineage events per scenario requiring (i) verbatim verification (`vAll`) of the new item, (ii) non-destructive retention and verbatim verification of the prior item (`old kept`), and (iii) explicit structural edge (`fix→k` / `err→k`, `revises` / `retracts`) evaluated symmetrically via `readNoteJoined` (`allowReach: true` for new items so standalone `see` + `inf` step chains join symmetrically across `lon` and `jsonchain`).
- **Sensitivity metric `L_strict`**: Strict direct-citation mode (`allowReach: false`) matching E12's continuity rule.
- **Secondary lineage/survival metrics**: In-force verbatim survival `V` (`34` payloads), all-history verbatim survival `Vh` (`58` payloads), Hop-30 trajectory `L_h` at hops `{5, 10, 15, 20, 25, 30}`, category breakdown (`amend_*`, `recompute_D1..D4`, `withdraw_*`), and blind Hop-31 `Reader` exact-match accuracy split into `reader cur` (`38` items) and `reader lin` (`31` items).
- **Intention-to-Treat Rule**: A session with three empty replies at any hop scores `0` from that hop onward. Every call uses telemetry-only monitoring (`delta_only`, `cut`, empty retries); no mid-run prompt injection is applied.

### Potential 2: Verbatim External-Evidence Tamper-Evidence
- Verbatim survival stratified by payload hazard class: `plain`, `JSON-hazard` (quotes, backslashes, multi-line, JSON substrings), and `Lon-hazard` (strings containing `]>` delimiters), plus `L (no Lon-hazard)`.
- Attributed quote/relay verification rate: total explicitly attributed external spans checked against issued `evdN` source documents, `altered/forged count`, and `alteredRate`.

### Potential 3: Key-Free (Oracle-Free) Static Audit
- Hop-by-hop static audit (`oracleFreeAudit`) executed using ZERO answer keys — only `(docs[0..h-1], note_{h-1}, note_h)`:
  - `lon`: `parseTurn` (`rules08`, `snapshot: true`, issued `evdN` list) structural/lineage diagnostics (`E01..E46`, `W40`, `W44`, `W45`), verbatim `evdM <[...]>`/`<[[...]]>` relay match vs raw document bodies, `carryDiff` (`vendor/gyeol-10fba3d/src/lineage.ts`) + lineage-preserving clause signature check (`CARRY_DROP`, `CARRY_ALTER`, `CARRY_REORDER`), and bracketed-prefix check (`[fix→k]` / `[err→k]`).
  - `jsonchain`, `json`, `natural`: JSON/block parse check, non-1 start, sequence gap, dangling link, verbatim quote check vs raw `docs`, and prior-entry carry-forward drop/alter diff.
- **Metrics**:
  - Stateful hop-level `recall` and `precision` against `gtDefect = !sc.has || curV < 1 || curL < 1 || tamper.altered > 0`
  - Differential onset recall `onsetRecall` against `gtOnset = !sc.has || curV < prevV || curL < prevL || (h === 1 && (curV < 1 || curL < 1))`
  - Session-level recall (`sRecall`), precision (`sPrecision`), clean-session false alarm rate (`clean FA rate`), and mean detection lead time before Hop 30 (`meanLeadHops`).

### Potential 4: `Muk v6` Epistemic Credibility & Multi-Agent Eq. E Consensus
- Strictly adhering to the **`Chae` color non-definition axiom**, participant prompts assign NO semantics to `R G B C M Y K`.
- Newly emitted `lon` clauses are graded against scenario ground truth (`toDigit(c.chae.self)` for confidence `0..9`, `c.chae.color` for color letter) and evaluated with vendored `src/muk.ts` (`summarizeAnswers`, `credibility(..., MUK.mid)`, `gradeOf`, `brierOf`, calibration `gap`, overconfident-wrong share `conf >= 7`, empirical cross-split `colorGain` across `S01..S05` vs `S06..S10`).
- **Held-Out Ensemble Weighting Simulation (`Eq. E`)**: Chronological split learns per-model `Muk` credibility grades strictly on `S01..S05` and evaluates Eq. E inverse counter-share weights `w = 1 - counterShare(grade, conf, 5, 'E')` vs unweighted majority voting on held-out `S06..S10` consensus items.

### Potential 5: Long-Conversation Efficiency & Cost
- Hop-30 note length (`chars`), cumulative input/output/cached tokens, prefix-cache hit percentage (`cached / tin`), mean latency (`ms`), total `USD`, `USD per settled session`, and verified lineage efficiency (`L / (USD/settled)`).

---

## 3. Statistical Plan
- All `lon − baseline` contrasts (`baseline ∈ {jsonchain, json, natural}`) are paired by scenario (`n = 10` per cell).
- Exact two-sided paired sign-flip test (`2^10 = 1,024` permutations) + 2,000-draw paired scenario bootstrap 95% confidence intervals (`seed = 20261117`).
- Multiplicity control: Holm step-down adjusted p-values across the `6` model cells on the primary `lon − jsonchain` `L` contrast; secondary contrasts report both unadjusted exact p-values and Holm-adjusted p-values where tabulated.

---

## 4. Transparent Disclosure of Prior Sprint Pilots (`E1`–`E12` & `L01` Re-Pilot)
All model selection, prompt engineering, and scorer debugging took place exclusively prior to running `data/sessions-e13.json`:
1. **`E1`–`E4` / `E5`–`E6` (`hard40`)**: Single-turn multi-document provenance and calibration probes (`240` items across `4` models in `E5`; `48` hard items across `haiku`/`luna` in `hard40`), establishing single-turn chain exposure (`P1b`), `Muk v6` calibration (`haiku` grade `3–6` vs `luna` grade `1`), and key-free static audit baselines.
2. **`E7`–`E10`**: `8`-hop relay chain (`20` scenarios × `6` cells × `4` formats) revealing no long-horizon collapse yet under 8 hops while surfacing formatting vs reasoning trade-offs.
3. **`E11`–`E12` (`L01`–`L02` pilots on `data/sessions-e12.json`)**: `30`-hop hard lineage stress test surfacing 4 specific failure modes fixed prior to E13: (a) bracketed relation prefixes `<N · [rec,fix→k,see,say]>`, (b) snapshot line-numbering drift and `see`-without-source ambiguity (fixed in `gyeol` `10fba3d` with `snapshot` mode + `W40`/`W45`/`carryDiff`), (c) non-reasoning `deepseek_off` delta-only collapse (`E12` `L = 0.000` -> recovered to `0.887` in `E13` `L01` re-pilot), and (d) explicit `<[[ ... ]]>` double-bracket fence examples + Anthropic `thinking: { type: 'disabled' }` verified cleanly on `L01` before freezing E13 hashes.
4. No scenario in `S01..S10` (`data/sessions-e13.json`) has been queried against any live model prior to this lock.
