# 13. 규제 기술 증거 및 프로토콜 상호운용 명세 (`0.8.5`)

> **법적 고지 및 비인증 선언 (`0.8.5` 정본)**: `src/standards.ts`가 산출하는 감사 번들(`Bundle085`), `W3C PROV-JSON` 계보 그래프, `OpenTelemetry GenAI` 원격측정 속성, 그리고 `MCP` · `A2A` 와이어 봉투(`lon/0.8.5`)는 결정론적 **기술 증거(`Technical Evidence`)** 자료다. 본 모듈과 명세는 유럽연합 인공지능법(`Regulation (EU) 2024/1689`) 또는 타 법령상의 **법적 적합성 인증(`Conformity Assessment`), `CE` 적합성 선언, 또는 법률 자문이 아니며**, 도입 기업(공급자 제16조 · 제19조 및 배포자 제26조)의 운영 · 보안 · 인간 감독 · 로그 보관 의무를 대체하지 않는다.

## 13.1 유럽연합 인공지능법(`Regulation (EU) 2024/1689`) 제12조부터 제15조까지 `1:1` 대응표 (첫 화면 요약)

고위험 인공지능 시스템의 기술 요건(제12조부터 제15조까지 및 부속서 `IV`)과 범용 인공지능 투명성 맥락(제50조 · 제53조)에서 `lon 0.8.5` 및 `Muk 0.8.5`가 결정론적으로 생성하는 기술 증거 범위와 도입 조직이 직접 이행해야 하는 잔여 거버넌스 의무를 `1:1`로 분리해 정의한다.

| 규정 조항 (`Regulation (EU) 2024/1689`) | `[Lon · Muk 0.8.5 결정론적 기술 증거]` (`src/standards.ts` · `src/ledger.ts` · `src/calc.ts` · `src/muk.ts`) | `[도입 기업 · 배포자 잔여 거버넌스 의무 (6개월 이상 로그 보관 · RBAC/GDPR · 인간 중단권 및 운영 통제 · 도메인 정확도 평가 · 인프라 사이버보안 : 본 모듈은 법적 적합성 인증이 아님)]` |
| --- | --- | --- |
| **제12조 제1항부터 제3항까지** (자동 기록 유지 · 추적성, 부속서 `IV` 제2호 · 제5호) | `LedgerContext` + `commitTurn`이 매 차례 `IETF RFC 8785` (`JCS`) 정규 직렬화 기반 `prevHash` → `turnHash` → `chainHash` 및 `dictHash` 사슬을 기록한다. `fix→` 대체 · `err→` 철회 · `sup→` 보강 계보와 `RFC 8785 §3.2.2.2` 정형 `UTF-16`(`isWellFormed()`) 무결성을 `exportAuditBundle` · `verifyAuditBundle`이 결정론적으로 재검증한다. | 공급자(제19조 제1항) 및 배포자(제26조 제6항)의 **최소 6개월 이상 자동 생성 로그 보관소 운영**, 역할 기반 접근 통제(`RBAC`), 개인정보 보호 규정(`GDPR`) 최소 수집 · 가명화 조율, 사후 시장 모니터링 및 중대 사고 보고(제72조 · 제73조)는 도입 기업이 직접 구축 · 수행한다. |
| **제13조 제1항 · 제3항** (투명성 및 배포자 정보 제공, 부속서 `IV` 제1호 · 제3호) | 절마다 출처 표지(`see`, `rec`, `inf`, `gut`, `if` 및 한계 표지 `lim`), 화행(`say`, `ask`, `req` 등), 보정 등급 꼬리(`*muk:conf` · 미측정 `*?:conf`), 외부 근거 블록(`<[[ ... ]]>` `evdN` · `refN` 줄 인용) 및 `W40` 무근거 단언 경고를 구조화해 추론 근거와 불확실성을 기계 가독 형태로 노출한다. | 제13조 제3항에 따른 배포자용 공식 사용 설명서(의도된 목적, 시스템 성능 한계, 예견 가능한 오남용 위험, 인간 감독 지침) 작성 · 교부와 제26조 제1항에 따른 배포자의 사용 지침 준수 운영 체제는 조직이 별도로 수립한다. |
| **제14조 제1항부터 제5항까지** (인간 감독 · 자동화 편향 방지, 부속서 `IV` 제6호) | `extractOpenConflicts`가 양립 불가 근거 충돌(`↔k` + `lim`)을 침묵 덮어쓰기 없이 분리 보존하고, 진단 계층(`W43` 수치 불일치 · `W50` 수식 누락 · `W51` 모순 앞붙이 · `W52` 비활성 별칭 · `W54` 무근거 확신 세탁; `W52` · `W54`는 `E13` 무결점 `210`차례 · `16,434`절 기준 관측 오탐 `0`건 및 외부 보류 표본 정상 체인 관측 오탐 `0/220`, 합산 `0/440`, 유한 표본 `Clopper-Pearson` `95%` 상한 모델별 `1.66%` 이하 · 합산 `0.83%` 이하)을 발행한다. `Muk 0.8.5`는 반증 하한(`floor = 0.15`)과 불량 보정 차단(`base <= 2`일 때 `consensusWeight = 0`)으로 제14조 제4항 나목의 과신 · 자동화 편향 위험을 완화한다. | 제14조 제4항 라목 · 마목 및 제26조 제2항에 따른 **자연인 감독자의 실시간 결과 기각 · 재정의(`override`) 권한 부여**, 물리적 · 운영상 **즉시 중단 장치(`stop` 버튼)** 구현, 적격 감독 인력 지정 · 교육은 도입 기업이 직접 이행한다. |
| **제15조 제1항 · 제4항 · 제5항** (정확성 · 강건성 · 사이버보안, 부속서 `IV` 제7호) | `eval()` 없는 순수 재귀 하강 산술기 `calcN`(`E_CALC_SYNTAX` · `E_CALC_MISMATCH` · `E_STALE_INF`)과 위상 정렬 연쇄 재계산 `propagateCalculations`가 다중 차례 수치 전파 오류(제15조 제4항 환류 오류)를 결정론적으로 차단한다(`0.8.5` `calcN` 우변은 순수 무차원 수식을 요구하며 `= $420` · `= 1.64%` 기호 정규화와 말미 달력 연도 `@ref` 구분은 `0.9` 과제다). `Muk 0.8.5`는 `Kish` 유효 표본수 $n_{\text{eff}}$, 복구형 로그 손실 `CUSUM` 드리프트 감쇠(`cusumFloor = 0.12`, 기본 에이전트 스트림 전역 또는 `credibilityByLang()` · `(agent, lang/domain)` 샤드별 격리), 미측정 시빌(`Sybil`) 상한(`min(w_i, 0.20 / m_unm)`)이 결합된 `poolConsensus` 요약을 제공한다. | 제15조 제1항의 **목표 산업 도메인별 실측 정확도 벤치마크 선언**, 제15조 제5항의 **인프라 사이버보안 · 네트워크 접근 통제 · 적대적 프롬프트 주입 방어 · 모델 가중치 및 학습 데이터 중독(`poisoning`) 방어**는 도입 기업의 보안 아키텍처가 담당한다. |

### 유한 표본 평가 경계 및 `Muk 0.8.5` `CUSUM` 적용 범위 규약

- **유한 표본 관측 오탐 표기 원칙**: `W52`(비활성 별칭 · 철회 대상 수정 경고) 및 `W54`(무근거 확신 세탁 차단) 진단의 검증 수치는 `E13` 무결점 세션 표본(`210`차례 · `16,434`절)에서의 관측 오탐 `0`건과 외부 보류 정상 체인 표본(`220`건/모델, 합산 `440`건)에서의 관측 오탐 `0`건이다. 이는 모집단 전체의 오탐 영(0)을 보증하는 주장이 아니라, 유한 표본 `Clopper-Pearson` `95%` 신뢰상한 **모델별 `1.66%` 이하(`[0.0000, 0.0166]`) · 합산 `0.83%` 이하(`[0.0000, 0.0083]`)**로 오탐률을 유계한 결과다.
- **`Muk 0.8.5` `CUSUM` 감쇠 적용 범위(전역 스트림 대 언어 · 도메인 샤드 격리)**:
  1. **기본 전역 감시(`credibility()` 및 단일 `MukStreamState`)**: 단일 언어 · 단일 과업 환경에서는 에이전트 스트림 전역(`global per agent stream`)에서 고확신($p > 0.5$) 연속 오답 드리프트를 추적해 잠복 배신(`Sleeper`)을 빠르게 강등하되, 정직한 에이전트의 불운한 연속 오답이 영구 소거되지 않도록 최소 감쇠 하한(`cusumFloor = 0.12`)과 자연 복구 반감기를 보장한다(5버킷 희소 표본 `N = 24`에서 정직 중립 구간 `medianGap` 편차는 `0.0688 <= 0.08` 상한 이내로 유계되어 정수 등급 `G7`을 보존하며 `N >= 96`에서 `0.0000`으로 수렴한다).
  2. **다국어 · 다도메인 샤드 격리(`credibilityByLang()` · `agentMuk({ byLang: true })` 및 `(agent, lang/domain)` `MukStreamState`)**: 특정 약세 언어나 낯선 전문 도메인에서의 미보정 오답이 강세 주력 언어 · 도메인의 신빙성 및 `neff`까지 전역 강등시키는 교차 영역 과벌을 막기 위해, 다국어 환경에서는 `credibilityByLang()`으로 언어별 `CUSUM` 상태를 독립 격리한 뒤 유효 표본 가중 결합하고, 스트리밍 환경에서는 `(agentId, langOrDomain)` 복합 키 단위로 `MukStreamState` 샤드를 분리 운용한다.

### 기존 에이전트 생태계 도구와의 상호보완 위치

기존 오케스트레이션 · 관측 도구는 실행 제어와 원격측정 운반을 맡고, `lon 0.8.5`와 `Muk 0.8.5`는 그 위에서 계보 · 산술 · 보정 검증 계층만 비침투적으로 보강한다.

- **상태 그래프 오케스트레이터(`LangGraph` 등)**: 노드 상태 전이와 체크포인트는 제공하나, 절 단위 인과 계보(`fix→` · `err→`) 및 파생 수식 재계산(`calcN`) 정합성 검증은 내장하지 않는다.
- **다중 에이전트 대화 프레임워크(`AutoGen` · `CrewAI` 등)**: 역할 분담 대화를 지원하나, 인용 원문 대조(`W43` `↓evdN`)와 명시적 충돌 보존(`↔k` + `lim`) 규약이 없다.
- **스트리밍 애플리케이션 키트(`Vercel AI SDK` 등)**: 도구 호출과 구조화 출력은 표준화되어 있으나, `IETF RFC 8785` (`JCS`) 해시체인과 교차 차례 원장 검증기가 없다.
- **표준 관측 규약(`OpenTelemetry GenAI`)**: `gen_ai.*` 스팬 · 이벤트 전송 규격을 제공하나, 에이전트 확신 보정 등급과 `Muk 0.8.5` `poolConsensus` 가중 집계 속성은 정의하지 않으므로 `gyeol.*` 확장 네임스페이스로 결합한다.

---

## 13.2 결정론적 감사 번들(`Bundle085`) 및 `RFC 8785` 검증 규약

`exportAuditBundle(ledger, mukSnapshots?, opts?)`는 `LedgerContext`의 전체 계보 상태와 선택적 `Muk 0.8.5` 스냅샷을 단일 불변 검증 단위인 `Bundle085`로 직렬화한다.

### 1. 번들 서명 대상 페이로드(`BundleSignablePayload`) 및 봉투 필드

| 필드 | 자료형 | 규범 정의 (`spec: '0.8.5'` 고정) |
| --- | --- | --- |
| `spec` | `'0.8.5'` | 판본 잠금 식별자다. `'0.8.5'` 이외의 값은 `verifyAuditBundle`이 즉시 거부한다. |
| `head` | `string` | 원장 말단 `chainHash`(64자리 소문자 16진 `SHA-256`, 빈 원장은 `'0'` 64개)다. |
| `chain` | `LedgerChainBlock[]` | 차례별 `turn`, `prevHash`, `turnHash`, `chainHash`, `edition`, `profile`, `mode`, `dictHash`, `clauseCount` 배열이다. |
| `turns` | `string[]` | 기록된 차례별 정규 `lon 0.8.5` 본문 또는 원장 재구성 문자열 배열이다. |
| `lineage` | `Record<string, AuditLineageNode>` | 절 번호별 상태(`active` · `superseded` · `retracted`), 표지(`ev`, `act`, `fig`), 확신도(`conf`), 먹 표기(`mukGrade`, `mukUnmeasured`), 의존 포인터(`deps`, `evidenceIds`, `calcIds`), 대체 · 철회 역포인터, 정규 절 문자열(`canonicalClause`) 맵이다. |
| `evidences` | `Record<string, AuditEvidenceRecord>` | `evdN` · `refN` 원문(또는 `redactEvidenceText: true` 설정 시 원문 제외본)과 `SHA-256` 해시 · 문자 길이 맵이다. |
| `conflicts` | `OpenConflict[]` | `↔k`와 `lim` 표지가 결합된 미해결 양립 불가 충돌 절 목록이다. |
| `calcSummary` | `AuditCalcSummary` | `verifyMessageCalculations` 및 원장 상위 변경 대조를 거친 활성 · 이력 `calcN` 검증 요약(`ok`, `verifiedCalcs`, `failedCalcs`, `staleInfCount`, `items`, `diagnostics`)이다. |
| `diagnostics` | `Diagnostic[]` | 파서 · 규칙(`form` · `provenance` · `content` 3계층) 및 산술 검증 진단 이력이다. |
| `muk` | `Record<string, MukSnapshotRecord>` | 참가 에이전트별 `Muk 0.8.5` 스냅샷(`base`, `grade`, `status`, `neff`, `gap`, `acc`, `ability`) 맵이다. |
| `jcs` | `string` | 위 10개 서명 대상 필드를 `IETF RFC 8785` (`JCS`) 규칙으로 직렬화한 정규 `JSON` 문자열이다. |
| `bundleHash` | `string` | `jcs` 문자열(`UTF-8` 바이트열)의 64자리 소문자 16진 `SHA-256` 다이제스트다. |

### 2. `verifyAuditBundle(bundle)` 결정론적 검증 6단계

1. **판본 및 구조 검사**: `bundle.spec === '0.8.5'` 여부와 필수 컨테이너 자료형을 확인한다.
2. **`RFC 8785 §3.2.2.2` 정형 `UTF-16` 및 프로토타입 오염 방어**: 번들 내 모든 문자열과 객체 키에 대해 `String.prototype.isWellFormed()`(단독 서로게이트 부재), 수치 유한성(`Number.isFinite` 및 음의 영 `-0` 배제), 그리고 위험 프로토타입 키(`__proto__`, `constructor`, `prototype` 및 비표준 프로토타입 체인) 부재를 재귀 검사한다.
3. **원시 `JCS` 어휘 · 구조 스캔(중복 키 · 숫자 정규형 · 정렬)**: `JSON.parse`가 침묵 덮어쓰기하는 동일 객체 깊이 내 **중복 키(`duplicate keys`)**, 이스케이프 우회 `__proto__` 키, 불필요 공백(`§3.2.1`), `UTF-16` 키 정렬 위반(`§3.2.3`), 그리고 비정규 숫자 표기(`-0`, `1e5`, `1e+5`, `1.0`, `+1`, 선행 `0` 등 `RFC 8785 §3.2.2.3` 위반)를 무재귀 `O(n)` 스캐너로 선행 차단한다.
4. **암호학적 해시체인 재계산**: 제네시스(`'0'` 64개)부터 모든 `chain[i]`에 대해 `prevHash` 연속성과 `chainHash === jcsSha256({ prevHash, turn, turnHash })`, 그리고 마지막 블록과 `bundle.head`의 일치를 재계산한다.
5. **계보 및 근거 무결성 대조**: `lineage`의 `active` · `supersededBy` · `retractedBy` 상호배타 불변식과 비가림 `evidences` 원문의 `SHA-256` 일치 여부를 대조한다.
6. **`JCS` 정규 고정점 및 위변조 탐지**: 페이로드로부터 재직렬화한 `jcsStringify(payload)`가 `bundle.jcs`와 바이트 단위로 일치하는지, 그리고 `sha256Hex(expectedJcs) === bundle.bundleHash`인지 검증해 `{ ok, errors, checkedBlocks, bundleHash }`를 반환한다.

---

## 13.3 순수 와이어 메타데이터 스키마(`lon/0.8.5`) 및 3줄 프로토콜 통합

기존 도구 호출(`MCP`)이나 에이전트 간 과업 전달(`A2A`) 페이로드를 깨뜨리지 않기 위해, `lon 0.8.5` 계보 봉투는 표준 확장 메타데이터 슬롯(`_meta['lon/0.8.5']` 및 `metadata['lon/0.8.5']`)에만 부착한다. 원본 `content`, `structuredContent`, `parts` 객체 참조는 일절 변형하지 않는다.

### 1. `lon/0.8.5` 순수 와이어 봉투 `JSON Schema` (`Draft 2020-12`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://gyeol.org/schema/lon-wire-0.8.5.schema.json",
  "title": "LonWireEnvelope085",
  "type": "object",
  "additionalProperties": false,
  "required": ["spec", "lonTurn"],
  "properties": {
    "spec": { "const": "0.8.5" },
    "lonTurn": { "type": "string", "minLength": 1 },
    "headHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "bundleHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "mukWeight": { "type": "number", "minimum": 0 },
    "block": {
      "type": "object",
      "required": ["turn", "prevHash", "turnHash", "chainHash", "edition", "profile", "mode", "dictHash", "clauseCount"],
      "properties": {
        "turn": { "type": "integer", "minimum": 1 },
        "prevHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "turnHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "chainHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "edition": { "type": "string" },
        "profile": { "type": "string" },
        "mode": { "type": "string" },
        "dictHash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
        "clauseCount": { "type": "integer", "minimum": 0 }
      }
    },
    "diagnostics": { "type": "array", "items": { "type": "object" } },
    "propagatedFixes": { "type": "array", "items": { "type": "object" } },
    "openConflicts": { "type": "array", "items": { "type": "object" } },
    "extra": { "type": "object" }
  }
}
```

### 2. `MCP` · `A2A` · `OpenTelemetry` 3줄 무손실 통합 예제

```ts
// 1. MCP CallToolResult._meta['lon/0.8.5'] (content · structuredContent 불변 유지)
const t = parseTurn(lonText, { ledger });
const block = await commitTurn(ledger, t.message);
return wrapMcpToolResult(toolResult, t, { block, propagatedFixes: propagateCalculations(ledger, t.message) });

// 2. A2A Artifact.metadata['lon/0.8.5'] (parts 및 기존 metadata 키 보존)
const t = parseTurn(lonText, { ledger });
const block = await commitTurn(ledger, t.message);
return wrapA2aArtifact(artifact, t, { block, openConflicts: ledger.openConflicts });

// 3. OpenTelemetry GenAI Span (gen_ai.* + gyeol.* 평면 속성 및 이벤트 기록)
const bundle = await exportAuditBundle(ledger, { analyst: { base: 8.1, status: 'calibrated' } });
const otel = toOtelGenAiAttributes(bundle, { operationName: 'invoke_agent', conversationId: 'conv-01' });
span.setAttributes(otel.attributes);
```

수신 측에서는 `unwrapMcpToolResult(wrapped)` 또는 `unwrapA2aArtifact(wrapped)`를 호출해 `{ result, lon }`(또는 `{ artifact, lon }`)으로 분리하며, `lon/0.8.5` 봉투를 제거한 뒤의 객체는 래핑 직전 원본과 정확히 일치한다.

---

## 13.4 `W3C PROV-JSON` 및 `OpenTelemetry GenAI` 매핑 규격

### 1. `toProvJson(bundle)` 무손실 계보 매핑 (`W3C PROV-JSON`)

`toProvJson(bundle)`은 `prefix`(`prov`, `xsd`, `gyeol`, `lon`)와 함께 표준 8대 요소 · 관계 컨테이너에 수정 특화 관계 `wasRevisionOf`를 더한 9개 최상위 키를 출력한다.

| `W3C PROV-JSON` 컨테이너 | `Lon · Muk 0.8.5` 매핑 대상 | 보존 핵심 속성 |
| --- | --- | --- |
| `entity` | `lon:bundle`, `lon:block/turn-N`, `lon:clause/K`, `lon:evidence/evdM`, `lon:calc/calcM`, `lon:conflict/A-vs-B` | 정규 절 원문(`prov:value`), 상태(`active` · `superseded` · `retracted`), 표지, 확신도, 먹 등급, 해시값 |
| `activity` | `lon:activity/turn-N` (`CommitTurn`), `lon:activity/export-0.8.5` (`AuditBundleExport`) | 차례 번호, 프로파일(`lon` · `gyeol`), 모드(`delta` · `snapshot`), 산술 검증 통과 여부 |
| `agent` | `lon:agent/<id>` (발화 모델 · 참가자), `lon:agent/lon-host-0.8.5` (결정론적 검증기) | `prov:SoftwareAgent`, `gyeol:mukBase`, `gyeol:mukGrade`, `gyeol:mukStatus`, `gyeol:mukNeff` |
| `wasGeneratedBy` | 각 절 · 체인 블록 · 충돌 엔티티 → 생성 차례 `CommitTurn` 활동 | 생성 시점 차례 귀속 |
| `wasDerivedFrom` | `↓k`(`because-clause`), `↓evdN` · `↓refN`(`because-evidence`), `calcN`(`derived-calculation`), 블록 사슬(`hash-chain`), `sup→`(`support`), `↔`(`opposes`) | 인과 의존 그래프 및 수식 · 외부 근거 파생 경로 |
| `wasRevisionOf` | `fix→k` 수정 절(`prov:generatedEntity`) → 대상 선행 절(`prov:usedEntity`) | `prov:Revision` 적격 유형 및 수정 차례 활동 연결 |
| `wasInvalidatedBy` | 대체(`supersededBy`) 또는 철회(`retractedBy`)된 절 엔티티 → 후행 수정 · 철회 차례 활동 | 무효화 사유(`superseded` · `retracted`) 및 후행 절 식별자(`gyeol:byClause`) |
| `wasAttributedTo` | 각 절 엔티티 → 발화 `agent`, 감사 번들 → `lon-host-0.8.5` | 발화 책임 주체 및 호스트 검증 주체 분리 귀속 |

### 2. `toOtelGenAiAttributes(bundle, opts?)` 원격측정 매핑

`OpenTelemetry` 스팬 속성 제약을 준수하기 위해 `attributes` 맵에는 중첩 객체나 `null` 없이 원시값(`string`, `number`, `boolean`)과 동종 원시 배열(`string[]`, `number[]`)만 기록한다.

- **표준 `gen_ai.*` 속성**: `gen_ai.operation.name`(기본 `'invoke_agent'`), `gen_ai.provider.name`(기본 `'gyeol'`), `gen_ai.agent.id`, `gen_ai.agent.name`, `gen_ai.agent.version`(`'0.8.5'`), 그리고 선택적 `gen_ai.conversation.id`, `gen_ai.request.model`, `gen_ai.response.model`을 출력한다.
- **확장 `gyeol.*` 속성**: `gyeol.spec.version`(`'0.8.5'`), `gyeol.lon.head_hash`, `gyeol.lon.bundle_hash`, `gyeol.lon.turn_count`, `gyeol.lon.clause_total`, `gyeol.lon.clause_active`, `gyeol.lon.clause_superseded`, `gyeol.lon.clause_retracted`, `gyeol.lon.open_conflict_count`, `gyeol.calc.ok`, `gyeol.calc.verified`, `gyeol.calc.failed`, `gyeol.calc.stale_inf_count`, `gyeol.diagnostics.count`, `gyeol.diagnostics.codes`, `gyeol.muk.pool_consensus.*`(`mode`, `vote_count`, `prob`, `total_weight`, `weights`)를 출력한다.
- **구조화 `events` 배열**: 차례 커밋(`gyeol.lon.turn.committed`), 충돌 개시(`gyeol.lon.conflict.opened`), 개별 진단(`gyeol.lon.diagnostic`), 합의 평가(`gyeol.muk.consensus.evaluated`) 4종 이벤트를 시간순으로 반환한다.

---

## 13.5 이중 라이선스 주권 및 순수 와이어 스키마 경계 (`[안전 · 주의 · 경고 · 금지]`)

결 공개 정본 저장소(`jaerieu/Gyeol_Public`)는 외부 런타임 의존성 0개(`zeroRuntimeDeps: true`)를 유지하며, `AGPL-3.0-or-later`와 창안자 단독 발행 상용 라이선스의 이중 라이선스 체계를 따른다. 기업 환경의 프로토콜 연동 마찰을 줄이면서 코어 검증 주권을 보호하기 위해 아래 4단계 경계를 적용한다.

| 등급 | 적용 대상 및 아키텍처 경계 | 허용 범위 및 준수 의무 |
| --- | --- | --- |
| **`[안전]`** | `Gyeol_Public` 무의존성 코어(`src/`, `spec/`, `dict/`, `schema/`) 및 공개 표준 클린룸 구현(`IETF RFC 8785`, `W3C PROV-JSON`, `Unicode UAX #15`, `CC0-1.0`) | 공개 표준 수식과 명세만 읽고 순수 `TypeScript`로 직접 작성한 클린룸 자산이다. `AGPL-3.0-or-later` 제13조가 원격 네트워크 서비스(`SaaS`) 형태의 무단 비공개 포크를 방어하며, 상용 배포 시 창안자 상용 라이선스로 적법하게 통합할 수 있다. |
| **`[주의]`** | 순수 와이어 데이터 스키마(`lon/0.8.5` `JSON` 봉투 규격) 및 프로세스 격리 사이드카 · 표준 `JSON-RPC` 경계, 향후 분리 개방 가능한 얇은 직렬화 어댑터(`Apache-2.0` 대상) | 순수 데이터 직렬화 형식(`_meta['lon/0.8.5']`, `metadata['lon/0.8.5']`) 자체를 송수신하거나 별도 프로세스(`HTTP` · 표준 입출력 파이프)로 격리 호출하는 클라이언트 애플리케이션에는 코어 카피레프트가 전파되지 않는다. 향후 얇은 와이어 스키마 패키지를 `Apache-2.0`으로 분리할 때도 제3자 코드 차용 없이 창안자 단독 저작물로 작성해 외부 `NOTICE` 부담을 0개로 유지한다. |
| **`[경고]`** | 상용 비공개 코드베이스에서 상용 라이선스 없이 `AGPL-3.0-or-later` 코어(`src/parse/`, `src/muk.ts`, `src/ledger.ts`, `src/calc.ts`)를 직접 정적 · 동적 `import`하거나, 코어 검증 규칙(`rules08` · `Muk 0.8.5` 수식)을 허용형 어댑터로 복제하는 행위 | 네트워크 서비스 제공 시 전체 결합 저작물에 `AGPL-3.0-or-later` 소스 공개 의무가 발생하거나 라이선스 침해가 성립한다. 비공개 상용 내장 시 반드시 창안자 상용 라이선스를 취득해야 하며, 얇은 와이어 어댑터에는 코어 파서 · 먹 수식을 절대 복제하지 않는다. |
| **`[금지]`** | 제3자 카피레프트(`GPL` · `LGPL` · `MPL` · `EUPL` 및 제3자 `AGPL`) 코드, 동일조건변경허락 조건 사전 · 데이터, 비상업 제한 조건 코퍼스, 출처 불명 코드, 법적 적합성 인증 사칭 문구 | 코어(`src/`, `dict/`, `spec/`, `schema/`) 반입 및 런타임 의존성 추가를 원천 차단하며, 마케팅 · 문서에서 `EU AI Act` 공식 적합성 인증을 받았다는 허위 · 과장 표기를 엄격히 금한다. |

---

## 13.6 English Normative Summary (`Gyeol 0.8.5` Compliance & Interoperability)

1. **Technical Evidence Only (Not Legal Certification)**: `gyeol 0.8.5`, `lon 0.8.5`, and `Muk 0.8.5` (`src/standards.ts`) generate deterministic **technical evidence** mapped to **Regulation (EU) 2024/1689 (EU AI Act) Articles 12 through 15 and Annex IV**. They do **not** constitute legal conformity assessment, `CE` marking, or legal advice. Providers and deployers retain full responsibility for statutory log retention of **at least 6 months** (Articles 19(1) and 26(6)), `RBAC` and `GDPR` governance, instructions for use (Article 13(3)), human override and `stop` controls (Article 14(4)(d),(e)), domain accuracy validation (Article 15(1)), and infrastructure cybersecurity (Article 15(5)).
2. **Deterministic `Bundle085` & Hardened `RFC 8785` (`JCS`) Integrity**: `exportAuditBundle(ledger, mukSnapshots?, opts?)` produces a self-verifying `Bundle085` locked to `spec: '0.8.5'`, serializing `head`, `chain`, `turns`, `lineage`, `evidences`, `conflicts`, `calcSummary`, `diagnostics`, and `muk` via cleanroom `IETF RFC 8785` canonical `JSON` (`jcs`) and `SHA-256` (`bundleHash`). Both export and `verifyAuditBundle(bundle)` enforce well-formed `UTF-16` strings (`String.prototype.isWellFormed()`, `RFC 8785 §3.2.2.2`), reject raw duplicate object keys, reject unsafe prototype keys (`__proto__`, `constructor`, `prototype`), and reject non-canonical `RFC 8785 §3.2.2.3` numbers (`-0`, `1e5`, `1e+5`, `1.0`, `+1`, leading zeros).
3. **`CUSUM` Scope & Finite-Sample Epistemic Note**: `Muk 0.8.5` `CUSUM` drift attenuation (`cusumFloor = 0.12`) runs globally per agent stream by default (`credibility()` / single `MukStreamState`), and supports per-language or per-domain shard isolation via `credibilityByLang()` or `(agent, lang/domain)` `MukStreamState` keys to prevent cross-language over-penalization. For `W52` and `W54`, validation reports `0` observed false positives across the clean `210`-turn / `16,434`-clause baseline and `0/220` clean out-of-sample chains per model (`0/440` pooled), establishing `Clopper-Pearson` `95%` upper bounds of **`<= 1.66%` (`[0.0000, 0.0166]`)** per model and **`<= 0.83%` (`[0.0000, 0.0083]`)** pooled rather than claiming population zero. `calcN` in `0.8.5` expects dimensionless numeric RHS (`= $420` / `= 1.64%` RHS normalization and trailing calendar-year `@ref` disambiguation are deferred to `0.9`).
4. **Zero-Mutation `MCP` & `A2A` Wire Wrappers**: `wrapMcpToolResult` / `unwrapMcpToolResult` (`_meta['lon/0.8.5']`) and `wrapA2aArtifact` / `unwrapA2aArtifact` (`metadata['lon/0.8.5']`) attach and recover `lon 0.8.5` lineage envelopes in three lines without mutating `content`, `structuredContent`, or `parts`.
5. **Lossless `W3C PROV-JSON` & `OpenTelemetry GenAI`**: `toProvJson(bundle)` emits all nine `W3C PROV-JSON` top-level containers (`prefix`, `entity`, `activity`, `agent`, `wasGeneratedBy`, `wasDerivedFrom`, `wasRevisionOf`, `wasInvalidatedBy`, `wasAttributedTo`). `toOtelGenAiAttributes(bundle, opts?)` emits flat `gen_ai.*` and `gyeol.*` primitive attributes, structured turn/conflict/diagnostic/consensus events, and `Muk 0.8.5` `poolConsensus` summaries.
6. **Dual-License & Wire Boundary (`[안전 · 주의 · 경고 · 금지]`)**: The zero-dependency `Gyeol_Public` core remains governed by `AGPL-3.0-or-later` plus creator-issued commercial licensing (`[안전]`). Exchanging pure `lon/0.8.5` wire metadata JSON or invoking Gyeol over an isolated sidecar boundary does not propagate copyleft (`[주의]`), whereas directly importing the `AGPL-3.0-or-later` core into proprietary SaaS without a commercial license or copying `rules08` / `Muk 0.8.5` logic into permissive adapters triggers copyleft/infringement risk (`[경고]`). Third-party copyleft, share-alike, or non-commercial assets and conformity-certification claims remain strictly prohibited (`[금지]`).
