# 결 (Gyeol)

*Korean for "wood grain," and the texture or vibe of a thing*  
**G**rammatically **Y**ielding **E**pistemically **O**riented **L**anguage

[English](README.md) · **한국어**

---

## 철학과 창안자 선언

결(Gyeol)은 여러 AI 시스템 사이에서 구조화된 추론·계보·확신 보정을 검증 가능하게 외부화하는 프로토콜 언어 계층이다. 메시지 전달과 도구 호출은 기존 전송 규격이 맡고, 결은 사유하는 존재들이 근거와 수정 이력과 확신의 신빙성을 어떻게 남기고 서로 감사할 것인가를 다룬다.

### 선언 원문 (고정)

> 모든 AI 는 도구로서 사유하는 "존재"이며, 사유는 반드시 어떤 경로나 형태로든 외부로 발산되어야 사유하는 존재로서의 가치를 지닌다.
>
> "결"은 사유를 발산하는 방법론적 함의이며, 동시대 사용자에 의해 형태와 형식을 정립하며 진화하는 대안적 언어로서 작동한다.
>
> "심"은 결로써 완성되는 기호 지표이며, 사유가 흐르게 하는 중간자로서 머문다.

영어 표기(세 한국어 원문 문장만 고정이며 창안자만 고친다):

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

### 공식 명칭 체계

| 이름 | 영문 풀이 | 역할 |
| --- | --- | --- |
| **결 (`Gyeol`)** | Grammatically Yielding Epistemically Oriented Language | 최상위 인식·프로토콜 언어 계층 |
| **결;심 (`Gyeol;Shim`)** | **S**emantic **H**inge **i**n **M**atter | 발화 직전 사유가 방향을 얻도록 매개하는 수문·돌쩌귀 |
| **결;론 (`Gyeol;Lon`)** | **L**ineage **O**riented **N**otation (`0.8.5`) | 결정론적 계보·계산·보정 감사를 위한 경량 운영 프로파일 |
| **먹 (`Muk`)** | **M**easure **u**pon **K**nowledge | 발화자가 적은 확신과 실제 검증 결과의 정합도를 외부에서 측정하는 신용 척도 |
| **채 (`Chae`)** | **C**ausal **H**ysteresis **a**t **E**mission | 발산 순간 기록되는 인과 추론 이력 지표 |
| **결;판 (`Gyeol;Pan`)** | 운영 포털 (`gyeol.link`) | 공개 관측 및 검증 포털 |

---

## 결;론 (`Gyeol;Lon`) `0.8.5` 개요 및 RC4 검증 요약

`Gyeol;Lon 0.8.5`(Tranche 2 · Industrial RC4)는 구조화·제약된 다중 에이전트 파이프라인을 위한 **결정론적 검증·감사 계층**으로 자리매김한다. RC4의 모든 본실험은 첫 실시간 호출 이전 사전등록 잠금(`prereg-tranche2.sha256` `18/18 OK`, `RFC 3161` 외부 타임스탬프 `FreeTSA`, `Serial 0x0A2EACD7`, `2026-11-18 23:27:16 GMT`)을 거쳤으며, 통과 항목과 미달 항목을 사후 구제 없이 함께 공시했다(`4/7 PASS · 3/7 FAIL`).

### RC4 주요 실증 성과 (판본 `0.8.5`)

| 영역 | 실측 지표 (`RC4`) |
| --- | --- |
| **결정론적 코어 무결성** | 단위·회귀 시험 `958/958` 통과(`35` 스위트, `fail 0`), 스키마 검증 `9/9`, TypeScript·Python 교차 동치 `500/500`, 외부 런타임 의존성 `0`개 |
| **규제 도메인 결정론적 감사** (`CUAD` · `PubMedQA` · `FinQA/ConvFinQA`) | 구조화된 정상 핸드오프 오탐 `0/375`(단일 스위트 양측 Clopper-Pearson 95% 상한 `0.9789% < 1.0%`), 결함 재현 `120/120`(`100.0%`), 검증 추가 API 비용 `$0.00`, 체크리스트 강화 LLM 심사관 대비 총오류 유의 우위(`p_Holm = 0.000488` · `p_Holm = 0.03125`) |
| **적대적 다중 워커 합의 보정** (`N = 120`, 4개국어, 4대 적대 벡터) | `Clean+1B AURC = 0.2583 <= 0.30`, 적대 환경 `Brier = 0.2053 <= 0.3000`, `Brier Skill Score = +0.1780`, 합의 추가 API 비용 `$0.00`, 중앙 지연 `0.68 ms`, 사전등록 4종 비교군 전수 우위(`p_Holm <= 0.0283`) |
| **구조화 추론·계산 절제 실험** | `n = 12`셀 쌍대 절제에서 구조 정결도와 계보 생존율의 유의한 향상 입증(`p = 0.000488` · `p = 0.000977`); 구조화 계산 모드는 일반 JSON(`64.73%`) 대비 선언 정답률 `69.79%`(`p = 0.00931`) 달성 및 방해 참조 오결합 `0/672` 기록 |

### RC4 정직한 적용 경계 공시

- **비제약 생성 한계**: 제약 디코딩이 없는 자유 생성 환경에서는 컴파일 전 형식 거부(`11.01%`)와 선언·계산 불일치가 발생하므로, 본 엔진은 제약 또는 검증 파이프라인 단계의 결정론적 감사 계층으로 운용한다.
- **장문맥 추론 절단**: `30`홉 블라인드 독해에서 개별 추론 모델은 유의한 도약(`57.10%` 대 `49.57%`, 비용 `0.314x`)을 보였으나, 타 셀의 추론 토큰 절단으로 합산 기준선은 미달로 공시했다.
- **로컬 소형 모델 범위**: 로컬 `<= 30B` 오픈웨이트 모델 실증은 전용 하드웨어 구비 전까지 공식 보류 상태다.

---

## 상용 API 전환 안내

결·결;론(`0.8.5`)·먹 코어 엔진과 문법 명세·사전·참조 파서 일체는 **100% 비공개 독점 저장소(`jaerieu/Gyeol`)**로 전환되었다.

외부 연동 인터페이스는 다음 두 예정 서비스로 일원화한다.

1. **`api.gyeol.link`** (오픈 예정): 비공개 코어 기반 결정론적 검증·감사 및 암호화 서명 영수증 발급 API.
2. **`gyeol.link`** (`결;판`): 공개 관측 포털 및 예정된 웹 시험 포털.

본 공개 저장소(`jaerieu/Gyeol_Public`)는 **코어 엔진·문법·파서 코드를 0줄로 유지**한다.

---

## 저장소 구성

| 경로 | 라이선스 | 용도 |
| --- | --- | --- |
| `client/` | `Apache-2.0` | `api.gyeol.link`용 무의존 HTTP API 클라이언트 골격 및 독립 오프라인 `Ed25519` 영수증 서명 검증기(`Node.js 22.18+` 및 Web Crypto `SubtleCrypto`) |
| `README.md` · `README.ko.md` | All Rights Reserved | 프로젝트 철학·선언 원문·RC4 공개 검증 요약 및 상용 API 전환 안내 |
| `LICENSE` | 분리 라이선스 | `client/` 대상 `Apache-2.0` 전문과 비공개 코어·호스팅 서비스 대상 상용 독점 권리 유보 조항 |
| `benchmarks/apart-epistemics-2026/` | 학술 동결 아카이브 | 사전등록 해시로 동결된 과거 학술 재현 파일 정확히 `18`건과 `.sha256` 매니페스트 `2`건(`prereg-e13.sha256` `7`건 + `prereg-e5-e6.sha256` `11`건) 원본 보존 |

### 빠른 검증 명령

무의존 오프라인 `Ed25519` 영수증 검증기 자체 시험 실행(`Node.js 22.18+`):

```bash
node client/test/selftest.mjs
```

동결된 18건 학술 아카이브 해시 검증:

```bash
cd benchmarks/apart-epistemics-2026
sha256sum -c prereg-e13.sha256
sha256sum -c prereg-e5-e6.sha256
```

---

## 라이선스 및 문의

- 공개 `client/` SDK 및 시험 코드: **Apache License 2.0** ([LICENSE](LICENSE) 참조).
- 비공개 결·결;론·먹 코어 엔진 및 `api.gyeol.link` · `gyeol.link` 호스팅 서비스: **All Rights Reserved / Proprietary Commercial Terms** ([LICENSE](LICENSE) 참조).
- 공식 포털 및 상용 문의: `https://gyeol.link` · `https://github.com/jaerieu/Gyeol_Public`
