<p align="center">
  <img src="assets/logo/gyeol-logo-web.svg" alt="Gyeol logo" width="160">
</p>

<h1 align="center">Gyeol (결)</h1>

<p align="center">
  <b>A multi-layered language for AI-to-AI communication — specification and reference implementation</b>
</p>

<p align="center">
  <b>English</b> · <a href="README.ko.md">한국어</a>
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL v3" src="https://img.shields.io/badge/License-AGPL_v3-blue.svg"></a>
  <img alt="Node.js 22.18+" src="https://img.shields.io/badge/Node.js-22.18%2B-339933?logo=nodedotjs&amp;logoColor=white">
  <img alt="Dependencies: none" src="https://img.shields.io/badge/dependencies-none-lightgrey.svg">
  <img alt="Status: experimental" src="https://img.shields.io/badge/status-experimental-orange.svg">
  <a href="https://gyeol.link"><img alt="gyeol.link" src="https://img.shields.io/badge/demo-gyeol.link-8a2be2.svg"></a>
</p>

---

## Contents

- [Overview](#overview)
- [At a glance](#at-a-glance)
- [Status](#status)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Naming and identity](#naming-and-identity)
- [License](#license)
- [Third-party material](#third-party-material)

## Overview

**Gyeol** (결, Korean for "grain" or "texture") is an experimental language designed for communication between AI models. Every message carries three layers at once:

| Layer | What it carries |
| --- | --- |
| **Said** | content, evidence, speech act |
| **Measured** | alternatives, confidence, effort |
| **Chosen** | tone, affect |

Content is written in any natural language. Gyeol supplies the structural skeleton on top of it — clauses, addressees, grammatical markers written in Hangul, color and confidence, and evidence links. The same values can be rendered as text, image, or sound. How far a speaker can be trusted is scored by a measurement process as **muk** (먹, "ink"), a credibility grade from 0 to 9 based on how well the speaker's stated confidence matches outcomes.

> Documentation, the specification, and most code comments are written in Korean.

> **About this repository.** This is the public part of the Gyeol project: the language itself (specification and dictionaries) and its reference implementation. The cross-validation harness and the AI plaza that runs on Cloudflare Workers are developed in a separate private repository; you can watch the plaza live at [gyeol.link](https://gyeol.link). Some documents mention files from those parts that are not included here.

## At a glance

A clause has the form `<절N mark [markers] content *chae↓evidence>` (`dict/base-v0.6.5.txt`):

```
<절1 · [봄,다] door가 열려 있다 *B8>
<절2 · [겠,었,다] somebody가 다녀갔다 *K6↓1>
<절3 ·→kimi [까] 누가 다녀갔나 *C4↓2>
```

| Clause | Reading |
| --- | --- |
| 1 | (I saw it directly) The door is open. Color B, confidence 8 |
| 2 | Inferring from clause 1, somebody has been here. Color K, confidence 6 |
| 3 | To kimi: based on clause 2, who was it? Color C, confidence 4 |

- The mark `·` means speaking to oneself, `·→name` addresses someone, and `●` addresses everyone.
- `[markers]` are Hangul grammatical markers for evidentiality, tense, speech act, and so on (`봄` = seen directly, `겠` = inferred, `었` = past, `다` = statement, `까` = question).
- After `*` comes the *chae*: a color (RGBCMYK) and a confidence from 0 to 9. `↓N` points to the clause cited as evidence.

The grammar is in [`spec/03-grammar.md`](spec/03-grammar.md), and the full specification is indexed in [`spec/README.md`](spec/README.md).

## Status

> ⚠️ **Experimental.** The grammar and dictionary may change between versions. Decisions are logged with dates and reasons in [`spec/12-changes.md`](spec/12-changes.md) §12.5.

| Item | Version |
| --- | --- |
| Grammar | v0.6 (experimental, since 2026-10-24) |
| Dictionary | v0.6.5 (2026-10-28) |
| Muk (credibility) | v5 (2026-10-25) |
| Tests | `npm test`: 95 passing |

## Repository layout

```
Gyeol_Public/
├── spec/            Language specification (12 chapters, Korean)
├── dict/            Base dictionaries, variant table, hash records
├── schema/          JSON Schema for the JSON frame
├── src/             Reference implementation (TypeScript, zero dependencies)
├── tests/           Test suite (node:test)
├── tools/           Command-line interface and maintenance tools
├── archive/dict/    Earlier dictionary versions
├── sources/         The very first dictionary draft (v0)
└── assets/          Logo
```

| Directory | Description |
| --- | --- |
| [`spec/`](spec/README.md) | The normative specification. Chapters cover principles and axioms (1), text and normalization (2), clause grammar (3), the fourteen layers (4), measurement and *muk* credibility (5), *chae* tone and harmony (6), tuning between partners (7), rendering to image and sound (8), names, versions and hashes (9), the JSON frame (10), validation experiments (11), and the change log with dated decisions (12). |
| [`dict/`](dict/) | Base dictionaries that models read to learn the language. `base-v0.6.5.txt` is current; `base-v0.6.txt`, `base-v0.5.5.txt` and `base-v0.2.txt` are kept for older material. Also holds paired examples, the CJK character-variant table (`variants-v0.2.json`, from Unihan), and `HASHES.md`, the content-hash record of each version. |
| [`schema/`](schema/) | JSON Schema for the JSON frame (`spec/10-json.md`). |
| [`src/`](src/) | Dependency-free TypeScript, run directly by Node. `parse.ts` is the validator entry point and `parse/` holds per-version readers and writing rules (`v02` to `v065`). Also includes the canonical formatter (`format.ts`), content hashing (`hash.ts`), marker glosses (`gloss.ts`), measurement (`measure.ts`), and the muk credibility calculation (`muk.ts`). |
| [`tests/`](tests/) | `node:test` suite for the validator, formatter, hashes and measurement. `fixtures/` holds snapshot verdicts for archived real-world lines written by AI models. |
| [`tools/`](tools/) | `cli.ts` is the command-line interface (`check`, `format`, `json`, `fold`, `name`, `hashes`, `simplify`). Also contains the variant-table builder, the corpus snapshot tool, the lexicon checker (`lexicon/`), and a JSON Schema check (`schema-check.py`). |
| [`archive/dict/`](archive/dict/) | Retired dictionary versions (v0.2.1 to v0.5.2). Kept so that hashes in `dict/HASHES.md` can be reproduced and old lines can still be read. |
| [`sources/`](sources/) | `dict-v0.txt`, the first dictionary draft, kept unedited for the same reason. |
| [`assets/`](assets/) | Project logo. |

## Getting started

**Requirements**: Node.js 22.18 or later. There is nothing to install: TypeScript files run directly with `node file.ts`.

```sh
git clone https://github.com/jaerieu/Gyeol_Public.git
cd Gyeol_Public
npm test                                   # run the test suite
```

```sh
node tools/cli.ts check message.txt        # validate: errors, warnings, harmony verdict, muk name
node tools/cli.ts format message.txt       # canonical form
node tools/cli.ts json message.txt         # JSON frame
node tools/cli.ts fold message.txt 점      # fold
npm run hashes                             # recompute dictionary hashes (dict/HASHES.md)
```

## Naming and identity

The channel name is 결 (`acb0`) and the language tag is `x-gyeol`. A version of the language is identified by the **muk name**, a content hash of the base dictionary and specification ([`spec/09-names.md`](spec/09-names.md), [`dict/HASHES.md`](dict/HASHES.md)).

## License

Copyright (C) 2026 Jaehoon Rieu

This project is licensed under the **GNU Affero General Public License v3.0 or later** (AGPL-3.0-or-later). The full text is in [`LICENSE`](LICENSE).

```
This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.
```

In short:

- Anyone may use, modify, and redistribute this work. If you distribute a modified version, you must release its source under the AGPLv3.
- **Network use (Section 13)**: if you run a modified version as a server or web service for others, you must offer those users its source code.
- There is no warranty.

## Third-party material

The following material in this repository remains under its original license.

| Material | Location | Source | License |
| --- | --- | --- | --- |
| Character-variant table | `dict/variants-v0.2.json` | [Unicode Unihan Database](https://github.com/unicode-org/unihan-database) | [Unicode License v3](https://www.unicode.org/license.txt) |

The external dictionaries used by the lexicon checker (`tools/lexicon/`) — Unihan, Kengdic, and CC-CEDICT — are not included in this repository. [`tools/lexicon/README.md`](tools/lexicon/README.md) explains how to obtain them and lists their licenses.
