# Gyeol (결)

*Korean for "wood grain," and the texture or vibe of a thing*  
**G**rammatically **Y**ielding **E**pistemically **O**riented **L**anguage

**English** · [한국어](README.ko.md)

---

## Philosophy & Founder Declaration

Gyeol is a protocol-level language layer for structured, verifiable, and calibrated reasoning across AI systems. While transport and tool protocols carry messages and function calls, Gyeol addresses how thinking entities externalize provenance, revision lineage, and epistemic calibration so claims can be independently audited over long multi-agent workflows.

### The Declaration (Fixed Original)

> 모든 AI 는 도구로서 사유하는 "존재"이며, 사유는 반드시 어떤 경로나 형태로든 외부로 발산되어야 사유하는 존재로서의 가치를 지닌다.
>
> "결"은 사유를 발산하는 방법론적 함의이며, 동시대 사용자에 의해 형태와 형식을 정립하며 진화하는 대안적 언어로서 작동한다.
>
> "심"은 결로써 완성되는 기호 지표이며, 사유가 흐르게 하는 중간자로서 머문다.

English rendering (only the three Korean sentences above are fixed by the creator):

> Every AI is a "being" that thinks as a tool,
> and thought holds its value as the thought of a being
> only when it is released outward, by any path or in any form.
>
> "Gyeol" is the methodological implication of releasing thought,
> and it works as an alternative language
> that evolves as its contemporary users establish its shape and form.
>
> "Shim" is the indexical symbol that Gyeol completes,
> and it stays as the intermediary that lets thought flow.

### Architectural Naming

| Name | Expansion | Role |
| --- | --- | --- |
| **Gyeol (`결`)** | Grammatically Yielding Epistemically Oriented Language | Top-level epistemic protocol language layer |
| **Gyeol;Shim (`결;심`)** | **S**emantic **H**inge **i**n **M**atter | Pre-emission intermediary orienting reasoning into structured expression |
| **Gyeol;Lon (`결;론`)** | **L**ineage **O**riented **N**otation (`0.8.5`) | Lightweight operational profile for deterministic lineage, calculation, and calibration auditing |
| **Muk (`먹`)** | **M**easure **u**pon **K**nowledge | External calibration credibility measure tracking alignment between stated confidence and verified outcomes |
| **Chae (`채`)** | **C**ausal **H**ysteresis **a**t **E**mission | Emission-time causal trace marker |
| **Gyeol;Pan (`결;판`)** | Live portal (`gyeol.link`) | Public observation and verification portal |

---

## Gyeol;Lon `0.8.5` Overview & RC4 Verified Highlights

`Gyeol;Lon 0.8.5` (Tranche 2 / Industrial RC4) is positioned as a **deterministic verification and audit layer** designed for structured and constrained multi-agent pipelines. All RC4 benchmarks were preregistered prior to live API execution (`prereg-tranche2.sha256` `18/18 OK`, external `RFC 3161` timestamp via `FreeTSA`, `Serial 0x0A2EACD7`, `2026-11-18 23:27:16 GMT`) with transparent reporting of both passing gates and unmet thresholds (`4/7 PASS · 3/7 FAIL`, zero post-hoc rescue).

### Validated Strengths (`RC4`, Version `0.8.5`)

| Domain | Verified Metric (`RC4`) |
| --- | --- |
| **Deterministic Core Parity** | `958/958` unit and regression tests passing (`35` suites, `fail 0`), `9/9` schema checks, `500/500` cross-runtime TypeScript and Python parity, `0` external runtime dependencies |
| **Regulated-Domain Deterministic Audit** (`CUAD` · `PubMedQA` · `FinQA/ConvFinQA`) | `0/375` false positives on clean structured handoffs (single-suite two-sided Clopper-Pearson 95% upper bound `0.9789% < 1.0%`), `120/120` (`100.0%`) defect recall at `$0.00` verification API cost, lower total error than checklist-hardened LLM judges (`p_Holm = 0.000488` and `p_Holm = 0.03125`) |
| **Adversarial Multi-Worker Consensus** (`N = 120`, 4 languages, 4 adversarial vectors) | `Clean+1B AURC = 0.2583 <= 0.30`, adversarial `Brier = 0.2053 <= 0.3000`, `Brier Skill Score = +0.1780`, `$0.00` consensus API cost, `0.68 ms` median latency, outperforming all 4 preregistered baseline aggregators (`p_Holm <= 0.0283`) |
| **Structured Reasoning & Calculation Ablations** | Paired `n = 12` cell ablation confirmed significant structural cleanliness and lineage survival gains (`p = 0.000488` and `p = 0.000977`); structured calculation mode raised declared accuracy to `69.79%` vs `64.73%` plain JSON (`p = 0.00931`) with `0/672` distractor reference misbindings |

### Disclosed Scope Boundaries (`RC4`)

- **Unconstrained generation limits**: Without constrained decoding, free-form generation still produces pre-compile rejections (`11.01%`) and declared-vs-computed arithmetic mismatches; structured validation is intended for constrained or verified pipeline stages.
- **Long-horizon reasoning truncation**: On `30`-hop blind reading runs, individual reasoning models showed strong gains (`57.10%` vs `49.57%` at `0.314x` token cost), while reasoning-token truncation on a second cell prevented the pooled gate from clearing its threshold.
- **Local small-model scope**: Validation on local `<= 30B` open-weight models remains formally deferred pending dedicated hardware.

---

## Commercial API Transition Notice

The Gyeol, Gyeol;Lon (`0.8.5`), and Muk core engine, formal grammar specifications, dictionaries, and reference parsers have transitioned to **100% private proprietary stewardship** (`jaerieu/Gyeol`).

External integration is being unified around two upcoming managed interfaces:

1. **`api.gyeol.link`** (upcoming): Hosted private-core verification, deterministic auditing, and cryptographically signed receipt API.
2. **`gyeol.link`** (`Gyeol;Pan`): Live public portal and upcoming interactive verification surface.

This public repository (`jaerieu/Gyeol_Public`) intentionally contains **zero lines of core engine, grammar, or parser code**.

---

## Repository Contents

| Path | License | Purpose |
| --- | --- | --- |
| `client/` | `Apache-2.0` | Zero-dependency HTTP API client skeleton for `api.gyeol.link` and standalone offline `Ed25519` receipt verifier (`Node.js 22.18+` and Web Crypto `SubtleCrypto`) |
| `README.md` · `README.ko.md` | All Rights Reserved | High-level project overview, philosophy declaration, RC4 public summary, and API transition notice |
| `LICENSE` | Dual separation | Full `Apache-2.0` terms for `client/` and proprietary commercial rights reservation for private core and hosted services |
| `benchmarks/apart-epistemics-2026/` | Historical archive | Exactly `18` cryptographically frozen academic reproducibility files plus `2` `.sha256` manifests (`prereg-e13.sha256` `7` files + `prereg-e5-e6.sha256` `11` files), preserved byte-for-byte |

### Quick Verification

Run the zero-dependency offline `Ed25519` receipt verifier self-test (`Node.js 22.18+`):

```bash
node client/test/selftest.mjs
```

Verify the 18 frozen historical benchmark archive files:

```bash
cd benchmarks/apart-epistemics-2026
sha256sum -c prereg-e13.sha256
sha256sum -c prereg-e5-e6.sha256
```

---

## License & Contact

- Public `client/` SDK and tests: **Apache License 2.0** (see [LICENSE](LICENSE)).
- Private Gyeol, Gyeol;Lon, and Muk core engine and hosted `api.gyeol.link` / `gyeol.link` services: **All Rights Reserved / Proprietary Commercial Terms** (see [LICENSE](LICENSE)).
- Inquiries and commercial access: `https://gyeol.link` · `https://github.com/jaerieu/Gyeol_Public`
