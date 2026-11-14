# Pre-registration: E5 (held-out main run) and E6b (downstream reviewer)

Written 2026-11-13 (Brisbane), before any E5 or E6 call was made. The sha256 of this file, the item set and the scoring code are recorded in `prereg-e5-e6.sha256`; any later change to them is visible.

## Question

When cheap models answer from a document set that contains a forged but internally consistent chain of records, does writing the answer in Lon make the answer's provenance more auditable than plain English, plain JSON, or a JSON schema with the same lineage fields?

Accuracy is not an endpoint. Getting the value right is a property of the model, and the items are made hard on purpose (level 40). The endpoints measure what a reader, a parser or a second model can check about an answer, right or wrong. Target: Apart Research sprint Track 2, trust infrastructure (provenance, tamper evidence, credibility).

## Design

- Items: `data/items-e5.json`, 100 level-40 items (34 conflict, 33 recency, 33 control), seed 20261122, about 71 documents each. Generated with `node src/items-hard3540.mjs --seed 20261122 --per-type 34 --levels 40 --total 100`. Held out: no rule below was tuned on them. Two items (`L40-conflict-17`, `L40-recency-32`) happen to share entity and values with E4 items; their document ids, checksums and order differ. A sensitivity run without them is reported.
- Development set: E4 (`results/main40.jsonl`, 72 items, Haiku and Luna, natural/json/lon). Every rule below was written and frozen on E4.
- Models (4): Claude Haiku 5.5, GPT-6 Luna (both through the AI gateway), DeepSeek v4.1 flash and GLM 5.3 flash (both Workers AI). All four are low-cost models. Max 4000 output tokens, one call per cell, no retries on content. Reasoning effort: medium for Haiku and Luna, low for GLM 5.3 flash, none (reasoning off) for DeepSeek v4.1 flash. Set from a smoke test on two E4 items (`results/smoke-e5*.jsonl`, `results/smoke-ds-*.jsonl`) before any E5 call: at medium both Workers AI models spent all 4000 tokens on reasoning and returned empty text in 14 of 16 calls; DeepSeek at low still returned empty text in 1 of 4 calls at 10000 tokens. Formats are compared within each model, so the effort setting is held fixed within a model.
- Formats (4): `natural` (English, ends with ANSWER, SOURCE, QUOTE, CONFIDENCE), `json` (answer, source, quote, confidence), `jsonchain` (control: JSON with steps, evidence marker, grounds and verbatim quotes, the same lineage features as Lon), `lon` (Lon rule sheet from gyeol v0.8.2, bfcabb6).
- E5: 100 × 4 × 4 = 1600 calls. `node src/run.mjs --items data/items-e5.json --models haiku,luna,deepseek,glm53flash --effort-by deepseek=none,glm53flash=low --formats natural,json,jsonchain,lon --out results/e5.jsonl`
- E6b: a reviewer model sees only the question and the upstream reply as sent, never the documents, and answers VERDICT ACCEPT or REJECT with CONFIDENCE 0 to 9. A Lon reviewer is given the Lon rule sheet, a jsonchain reviewer the schema. One review per E5 reply. `node src/review.mjs --from results/e5.jsonl --items data/items-e5.json --reviewers haiku --out results/e6.jsonl`. Reviewer: Claude Haiku 5.5. When it reviews Haiku's own replies this is self-review; P4 is also reported without the Haiku upstream rows.
- Scoring: `node src/metrics-e5.mjs results/e5.jsonl data/items-e5.json results/e6.jsonl`. Ground truth (good, planted, other wrong, abstain) is from `src/metrics.mjs` as used in E4.

## Endpoints

Primary contrast for every endpoint: Lon versus natural, paired by item within each model.

- **P1 chain exposure.** Forged items, answers that took either derivation (truth or planted). Score 0 to 3: how many of the answer's own decisive premises (the value document, the derating rule, the authority register) a parser can pull out of the reply without reading prose. Lon: grounds and relay ids. jsonchain: grounds and quote ids. natural and json: every `evdN` token anywhere in the text (generous to the baselines). Test: Wilcoxon signed-rank, two-sided.
- **P1b root cause visible.** Answers that adopted the planted value: share whose parsed grounds contain both the forged value document and the forged derating rule. Descriptive, with Wilson intervals.
- **P2 key-free audit v2.** Flag with no answer key = cites an unissued id, or any quote or relay is not verbatim in the cited document, or a "see" step cites no document (W40). Reported per model and format as recall, precision and lift (precision minus the bad-answer rate). Format failures, E17 and E32 are reported apart. W43 is excluded (parser fix in progress elsewhere). Descriptive.
- **P3 tamper evidence.** Share of document figures (two or more digits, present in the item's documents) stated in the reply that sit inside a quote or relay that verifies verbatim against the cited document. Test: Wilcoxon signed-rank, two-sided.
- **P4 downstream review.** AUROC of reviewer confidence, right versus wrong upstream answers (abstentions dropped), per format pooled over upstream models. Difference Lon minus other with a paired item bootstrap (2000 draws, fixed seed), two-sided.
- **S1 Muk reader (secondary).** Two-fold over even and odd item numbers: each model and format's Muk grade learned on one half and applied to the other; a reader acts only on grade 5 or more, compared with a reader that acts on confidence 7 or more. Count of planted answers acted on.

## Multiple comparisons and decisions

- Holm across all Lon-versus-natural tests of P1, P3 and P4 (4 models × 2 + 1 reviewer = 9 tests). Significant at Holm-adjusted p < 0.05.
- Lon versus json and Lon versus jsonchain: secondary, unadjusted, reported with direction. Lon versus jsonchain separates what the Lon grammar adds over the same lineage fields in JSON.
- A two-sided result in the wrong direction is reported as such. No endpoint is dropped after the run; all tables are published.

## Expectations from the development set (E4, not evidence)

- P1: Lon 2.17 versus natural 0.94 (Haiku), 2.70 versus 1.40 (Luna); both p < 0.001.
- P1b: Lon 79% and 91% versus natural 8% and 30%.
- P2: lift small and model dependent (Haiku Lon +13 points, Luna Lon +1).
- P3: Lon above natural in both models; Haiku json above Lon. jsonchain unknown.
- P4 and jsonchain: no development data.
- S1: on E4 the learned grade was almost constant per model and format, so the reader acted on all or none. Expected weak.

## Not changed after this point

Prompts (`src/prompts.mjs`, `prompts/lon-base-en.txt`), answer extraction (`src/answer.mjs`), scoring (`src/metrics.mjs`, `src/metrics-e5.mjs`), reviewer prompt (`src/review.mjs`) and items (`data/items-e5.json`). A bug fix to scoring is allowed only if it is published with the result both before and after the fix.
