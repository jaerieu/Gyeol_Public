// 결 v0.8.5 — 규제 증거 번들(EU AI Act 제12조부터 제15조까지 기술 증거), W3C PROV-JSON,
// OpenTelemetry GenAI 속성·이벤트 변환기 및 MCP·A2A 무손실 프로토콜 래퍼.
// 외부 런타임 의존성 0개(Zero-dependency) 순수 TypeScript 클린룸 구현이다.

import type { CalcBlock, Clause, Diagnostic, Message } from './types.ts';
import { sha256Hex } from './hash.ts';
import { clauseText03, format } from './format.ts';
import { evaluateCalcExpression, extractNumbersFromClause, numbersMatch, verifyMessageCalculations } from './calc.ts';
import type { PropagatedFix } from './calc.ts';
import { jcsSha256, jcsStringify, LedgerContext } from './ledger.ts';
import type { LedgerChainBlock, OpenConflict } from './ledger.ts';
import { formatMukToken, MUK_SPEC_VERSION, poolConsensus, probOf } from './muk.ts';
import type { ConsensusVote, MukProfileInput, MukStatus } from './muk.ts';
import { LON_VERSION, SPEC_VERSION, tierOfCode } from './tables.ts';

export const STANDARDS_SPEC_VERSION = '0.8.5' as const;
export const LON_WIRE_KEY = 'lon/0.8.5' as const;

const HEX64_RE = /^[0-9a-f]{64}$/u;
const LONE_SURROGATE_RE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u;
const JSON_NUMBER_SYNTAX_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u;
const UNSAFE_OBJECT_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

function setSafeOwnProp<V>(target: Record<string, V>, key: string, value: V): void {
  if (UNSAFE_OBJECT_KEYS.has(key)) {
    throw new TypeError(`허용되지 않은 프로토타입 오염 위험 객체 키('${key}')다`);
  }
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

function normalizeNegativeZeroDeep<T>(value: T): T {
  if (typeof value === 'number') {
    return (Object.is(value, -0) ? 0 : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeNegativeZeroDeep(item)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>)) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) {
        setSafeOwnProp(out, k, normalizeNegativeZeroDeep(v));
      }
    }
    return out as T;
  }
  return value;
}

/**
 * IETF RFC 8785 §3.2.2.2 준수 UTF-16 정형 문자열 검사.
 * 단독 서로게이트(lone surrogate, 예: U+DEAD)가 포함되면 false를 반환한다.
 */
export function isWellFormedString(value: string): boolean {
  if (typeof value !== 'string') return false;
  if (typeof (value as { isWellFormed?: () => boolean }).isWellFormed === 'function') {
    return value.isWellFormed();
  }
  return !LONE_SURROGATE_RE.test(value);
}

function collectWellFormedErrors(
  value: unknown,
  path = '$',
  errors: string[] = [],
  seen = new Set<object>(),
  rejectNegativeZero = false,
): string[] {
  if (value === null || value === undefined || typeof value === 'boolean') return errors;
  if (typeof value === 'string') {
    if (!isWellFormedString(value)) {
      errors.push(`${path}: RFC 8785 §3.2.2.2 위반 비정형 UTF-16 단독 서로게이트가 검출되었다`);
    }
    return errors;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      errors.push(`${path}: RFC 8785 JCS는 유한하지 않은 수(${String(value)})를 허용하지 않는다`);
    } else if (rejectNegativeZero && Object.is(value, -0)) {
      errors.push(`${path}: RFC 8785 §3.2.2.3 위반 음의 영(-0) 수치가 검출되었다`);
    }
    return errors;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectWellFormedErrors(value[i], `${path}[${i}]`, errors, seen, rejectNegativeZero);
    }
    return errors;
  }
  if (typeof value === 'object') {
    const obj = value as object;
    if (seen.has(obj)) return errors;
    seen.add(obj);
    if (obj instanceof Map) {
      let idx = 0;
      for (const [k, v] of obj.entries()) {
        if (typeof k === 'string' && UNSAFE_OBJECT_KEYS.has(k)) {
          errors.push(`${path}.mapKey[${idx}]: 허용되지 않은 프로토타입 오염 위험 키('${k}')가 검출되었다`);
        }
        collectWellFormedErrors(k, `${path}.mapKey[${idx}]`, errors, seen, rejectNegativeZero);
        collectWellFormedErrors(v, `${path}.mapVal[${idx}]`, errors, seen, rejectNegativeZero);
        idx++;
      }
      return errors;
    }
    if (obj instanceof Set) {
      let idx = 0;
      for (const v of obj.values()) {
        collectWellFormedErrors(v, `${path}.setVal[${idx}]`, errors, seen, rejectNegativeZero);
        idx++;
      }
      return errors;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null && !(obj instanceof LedgerContext)) {
      errors.push(`${path}: 허용되지 않은 비표준 프로토타입 체인(__proto__ 변조 의심)이 검출되었다`);
    }
    for (const k of Object.getOwnPropertyNames(obj)) {
      if (UNSAFE_OBJECT_KEYS.has(k)) {
        errors.push(`${path}: 허용되지 않은 프로토타입 오염 위험 키('${k}')가 검출되었다`);
      }
      if (!isWellFormedString(k)) {
        errors.push(`${path}[key]: RFC 8785 §3.2.2.2 위반 비정형 UTF-16 객체 키가 검출되었다`);
      }
      const desc = Object.getOwnPropertyDescriptor(obj, k);
      if (desc && 'value' in desc && desc.value !== undefined) {
        collectWellFormedErrors(desc.value, `${path}.${k}`, errors, seen, rejectNegativeZero);
      }
    }
  }
  return errors;
}

/**
 * 원시 JSON 문자열(`bundle.jcs`)에 대한 무재귀 O(n) IETF RFC 8785 (JCS) 어휘·구조 검증기.
 * JSON.parse가 침묵 덮어쓰기하거나 수용해 버리는 다음 4종 위변조를 원천 차단한다:
 * 1. 동일 객체 깊이 내 중복 키(duplicate object keys)
 * 2. 프로토타입 오염 위험 키(`__proto__`, `constructor`, `prototype`, 유니코드 이스케이프 포함)
 * 3. 비정규 숫자 표기(`-0`, `1e5`, `1e+5`, `1.0`, `+1`, 선행 0 등 RFC 8785 §3.2.2.3 위반)
 * 4. 불필요한 공백(RFC 8785 §3.2.1), 객체 키 UTF-16 비정렬(§3.2.3), 비정규 문자열 이스케이프(§3.2.2.2)
 */
function validateStrictRfc8785Jcs(raw: string): string[] {
  const errors: string[] = [];
  if (typeof raw !== 'string' || raw.length === 0) {
    errors.push('jcs: 빈 문자열은 유효한 RFC 8785 JSON이 아니다');
    return errors;
  }
  if (!isWellFormedString(raw)) {
    errors.push('jcs: RFC 8785 §3.2.2.2 위반 원문 내 단독 서로게이트가 검출되었다');
  }

  type StackFrame =
    | { kind: 'obj'; keys: Set<string>; prevKey: string | null; state: 'keyOrEnd' | 'key' | 'colon' | 'val' | 'commaOrEnd' }
    | { kind: 'arr'; state: 'valOrEnd' | 'val' | 'commaOrEnd' };

  const stack: StackFrame[] = [];
  let rootState: 'val' | 'done' = 'val';
  let pos = 0;

  const isWs = (ch: string) => ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';

  const readCanonicalString = (start: number): { ok: boolean; end: number; decoded: string } => {
    let i = start + 1;
    while (i < raw.length) {
      const code = raw.charCodeAt(i);
      if (code < 0x20) {
        errors.push(`jcs: RFC 8785 §3.2.2.2 위반 이스케이프되지 않은 제어 문자(위치 ${i})`);
        return { ok: false, end: raw.length, decoded: '' };
      }
      const ch = raw[i];
      if (ch === '\\') {
        if (i + 1 >= raw.length) {
          errors.push('jcs: 문자열 끝에서 잘린 이스케이프 시퀀스다');
          return { ok: false, end: raw.length, decoded: '' };
        }
        i += raw[i + 1] === 'u' ? 6 : 2;
        continue;
      }
      if (ch === '"') {
        const token = raw.slice(start, i + 1);
        let decoded: string;
        try {
          decoded = JSON.parse(token) as string;
        } catch (e) {
          errors.push(`jcs: 잘못된 문자열 토큰(${(e as Error).message})`);
          return { ok: false, end: i + 1, decoded: '' };
        }
        if (!isWellFormedString(decoded)) {
          errors.push('jcs: RFC 8785 §3.2.2.2 위반 이스케이프 단독 서로게이트가 검출되었다');
        } else if (JSON.stringify(decoded) !== token) {
          errors.push(`jcs: RFC 8785 §3.2.2.2 위반 비정규 문자열 이스케이프 표기(${token.slice(0, 24)})`);
        }
        return { ok: true, end: i + 1, decoded };
      }
      i++;
    }
    errors.push('jcs: 닫히지 않은 문자열 리터럴이다');
    return { ok: false, end: raw.length, decoded: '' };
  };

  const readPrimitiveOrNumber = (start: number): { ok: boolean; end: number } => {
    if (raw.startsWith('true', start)) return { ok: true, end: start + 4 };
    if (raw.startsWith('false', start)) return { ok: true, end: start + 5 };
    if (raw.startsWith('null', start)) return { ok: true, end: start + 4 };

    let end = start;
    while (end < raw.length) {
      const c = raw[end];
      if (c === ',' || c === '}' || c === ']' || c === ':' || c === '"' || c === '{' || c === '[' || isWs(c)) {
        break;
      }
      end++;
    }
    const token = raw.slice(start, end);
    if (!token) {
      errors.push(`jcs: 위치 ${start}에서 예기치 않은 구분자 '${raw[start]}'가 발견되었다`);
      return { ok: false, end: start + 1 };
    }
    if (!JSON_NUMBER_SYNTAX_RE.test(token)) {
      errors.push(`jcs: RFC 8785 §3.2.2.3 위반 비정규·비유효 숫자 토큰('${token}')이 검출되었다`);
      return { ok: false, end };
    }
    const num = Number(token);
    if (!Number.isFinite(num)) {
      errors.push(`jcs: RFC 8785 §3.2.2.3 위반 유한하지 않은 수('${token}')가 검출되었다`);
      return { ok: false, end };
    }
    const canonical = jcsStringify(num);
    if (token !== canonical) {
      errors.push(`jcs: RFC 8785 §3.2.2.3 위반 비정규 숫자 표기('${token}', 기대 정규형 '${canonical}')가 검출되었다`);
    }
    return { ok: true, end };
  };

  while (pos < raw.length) {
    if (isWs(raw[pos])) {
      errors.push(`jcs: RFC 8785 §3.2.1 위반 허용되지 않은 공백 문자가 위치 ${pos}에 포함되었다`);
      while (pos < raw.length && isWs(raw[pos])) pos++;
      if (pos >= raw.length) break;
    }

    const top = stack[stack.length - 1];
    if (!top) {
      if (rootState === 'done') {
        errors.push(`jcs: 최상위 JSON 값 뒤에 잉여 토큰이 위치 ${pos}에 존재한다`);
        break;
      }
      rootState = 'done';
    } else if (top.kind === 'obj') {
      if (top.state === 'keyOrEnd') {
        if (raw[pos] === '}') {
          stack.pop();
          pos++;
          continue;
        }
        top.state = 'key';
      }
      if (top.state === 'key') {
        if (raw[pos] !== '"') {
          errors.push(`jcs: 위치 ${pos}에서 객체 키 문자열('"')이 필요하다`);
          break;
        }
        const s = readCanonicalString(pos);
        pos = s.end;
        if (!s.ok) break;
        if (UNSAFE_OBJECT_KEYS.has(s.decoded)) {
          errors.push(`jcs: 허용되지 않은 프로토타입 오염 위험 키('${s.decoded}')가 검출되었다`);
        }
        if (top.keys.has(s.decoded)) {
          errors.push(`jcs: RFC 8785 위반 동일 객체 내 중복 키('${s.decoded}')가 검출되었다`);
        } else {
          top.keys.add(s.decoded);
        }
        if (top.prevKey !== null && !(top.prevKey < s.decoded)) {
          errors.push(`jcs: RFC 8785 §3.2.3 위반 객체 키 UTF-16 정렬 순서 불일치('${top.prevKey}' 뒤에 '${s.decoded}')`);
        }
        top.prevKey = s.decoded;
        top.state = 'colon';
        continue;
      }
      if (top.state === 'colon') {
        if (raw[pos] !== ':') {
          errors.push(`jcs: 위치 ${pos}에서 객체 키 뒤 ':'가 필요하다`);
          break;
        }
        top.state = 'val';
        pos++;
        continue;
      }
      if (top.state === 'commaOrEnd') {
        if (raw[pos] === ',') {
          top.state = 'key';
          pos++;
          continue;
        }
        if (raw[pos] === '}') {
          stack.pop();
          pos++;
          continue;
        }
        errors.push(`jcs: 위치 ${pos}에서 ',' 또는 '}'가 필요하다`);
        break;
      }
      // top.state === 'val'
      top.state = 'commaOrEnd';
    } else {
      // top.kind === 'arr'
      if (top.state === 'valOrEnd') {
        if (raw[pos] === ']') {
          stack.pop();
          pos++;
          continue;
        }
        top.state = 'val';
      } else if (top.state === 'commaOrEnd') {
        if (raw[pos] === ',') {
          top.state = 'val';
          pos++;
          continue;
        }
        if (raw[pos] === ']') {
          stack.pop();
          pos++;
          continue;
        }
        errors.push(`jcs: 위치 ${pos}에서 ',' 또는 ']'가 필요하다`);
        break;
      }
      // top.state === 'val'
      top.state = 'commaOrEnd';
    }

    // 값(value) 파싱 위치
    const ch = raw[pos];
    if (ch === '{') {
      stack.push({ kind: 'obj', keys: new Set(), prevKey: null, state: 'keyOrEnd' });
      pos++;
    } else if (ch === '[') {
      stack.push({ kind: 'arr', state: 'valOrEnd' });
      pos++;
    } else if (ch === '"') {
      const s = readCanonicalString(pos);
      pos = s.end;
      if (!s.ok) break;
    } else {
      const p = readPrimitiveOrNumber(pos);
      pos = p.end;
      if (!p.ok) break;
    }
  }

  if (errors.length === 0 && (stack.length > 0 || rootState !== 'done')) {
    errors.push('jcs: 닫히지 않은 JSON 컨테이너 구조다');
  }
  return errors;
}

export interface MukSnapshotRecord {
  base?: number;
  grade?: string;
  status?: MukStatus | string;
  acc?: number | null;
  neff?: number;
  gap?: number | null;
  ability?: number | { grade?: number; score?: number; point?: number } | null;
}

export type MukSnapshotInput =
  | MukProfileInput
  | (MukSnapshotRecord & { grade?: number | string; status?: MukStatus | string });

export interface AuditLineageLattice {
  tau: number;
  m: number;
  c: number;
  chi: number;
  calcAnc: boolean;
}

export interface AuditLineageNode {
  num: string;
  turn: number;
  status: 'active' | 'superseded' | 'retracted';
  active: boolean;
  ev: string | null;
  act: string | null;
  fig?: string;
  conf: number | null;
  mukGrade: string;
  mukUnmeasured: boolean;
  numericValue: number | null;
  process?: { kind: string; target?: string };
  deps: string[];
  evidenceIds: string[];
  calcIds: string[];
  supersededBy?: string;
  retractedBy?: string;
  supportedBy?: string[];
  agent?: string;
  lattice?: AuditLineageLattice;
  canonicalClause: string;
}

export interface AuditEvidenceRecord {
  kind: 'evd' | 'ref';
  id: string;
  sha256: string;
  length: number;
  text?: string;
}

export interface CalcSummaryItem {
  calcId: string;
  clauseNum: string | null;
  expr: string;
  declared?: number;
  evaluated: number | null;
  ok: boolean;
  active: boolean;
  error?: string;
}

export interface AuditCalcSummary {
  ok: boolean;
  totalCalcs: number;
  activeCalcs: number;
  verifiedCalcs: number;
  failedCalcs: number;
  staleInfCount: number;
  evaluatedByClause: Record<string, number>;
  items: CalcSummaryItem[];
  diagnostics: Diagnostic[];
}

export interface BundleSignablePayload {
  spec: '0.8.5';
  head: string;
  chain: LedgerChainBlock[];
  turns: string[];
  lineage: Record<string, AuditLineageNode>;
  evidences: Record<string, AuditEvidenceRecord>;
  conflicts: OpenConflict[];
  calcSummary: AuditCalcSummary;
  diagnostics: Diagnostic[];
  muk: Record<string, MukSnapshotRecord>;
}

export interface Bundle085 extends BundleSignablePayload {
  /** BundleSignablePayload 전체의 IETF RFC 8785 (JCS) 정규 직렬화 문자열 */
  jcs: string;
  /** jcs 문자열(UTF-8)의 SHA-256 16진 해시 */
  bundleHash: string;
}

export interface ExportAuditBundleOptions {
  /** 기록된 턴별 정규 원문 또는 요약 문자열 목록 (생략 시 원장 절을 턴 순서대로 정규 재구성) */
  turns?: readonly string[];
  /** 파서·규칙 진단 이력 (수식 검증 진단과 중복 없이 병합 기록) */
  diagnostics?: readonly Diagnostic[];
  /** 절 번호별 발화 에이전트 ID 매핑 */
  clauseAgents?: Readonly<Record<string, string>>;
  /** 기본 발화 에이전트 식별자 */
  defaultAgent?: string;
  /** 외부 근거 본문을 생략하고 SHA-256 해시·길이만 남길지 여부 (기본 false: 무손실 보존) */
  redactEvidenceText?: boolean;
}

export interface AuditVerifyResult {
  ok: boolean;
  errors: string[];
  checkedBlocks: number;
  bundleHash?: string;
}

function extractClauseConf(c: Clause): number | null {
  if (typeof c.conf === 'number' && Number.isFinite(c.conf)) {
    return Math.max(0, Math.min(9, Math.round(c.conf)));
  }
  if (c.chae?.self !== undefined && Number.isFinite(c.chae.self)) {
    return Math.max(0, Math.min(9, Math.round(c.chae.self * 10)));
  }
  return null;
}

function extractClauseMukGrade(c: Clause): string {
  if (c.muk?.unmeasured) return '?';
  if (c.muk?.conf !== undefined && Number.isFinite(c.muk.conf)) {
    return String(Math.max(0, Math.min(9, Math.round(c.muk.conf * 10))));
  }
  return '';
}

function normalizeMukSnapshots(
  mukSnapshots?: Readonly<Record<string, MukSnapshotInput>>,
): Record<string, MukSnapshotRecord> {
  const out: Record<string, MukSnapshotRecord> = {};
  if (!mukSnapshots) return out;
  const keys = Object.getOwnPropertyNames(mukSnapshots).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const agentId of keys) {
    if (UNSAFE_OBJECT_KEYS.has(agentId)) {
      throw new TypeError(`mukSnapshots: 허용되지 않은 프로토타입 오염 위험 키('${agentId}')다`);
    }
    const raw = mukSnapshots[agentId];
    if (raw == null) {
      setSafeOwnProp(out, agentId, { status: 'unmeasured', grade: '?' });
      continue;
    }
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw)) {
        throw new TypeError(`mukSnapshots['${agentId}']: 유한하지 않은 먹 수치(${String(raw)})다`);
      }
      const cleanBase = Object.is(raw, -0) ? 0 : raw;
      setSafeOwnProp(out, agentId, {
        base: cleanBase,
        grade: formatMukToken(cleanBase, 'calibrated'),
        status: 'calibrated',
      });
      continue;
    }
    const statusStr = raw.status ?? (raw.base === undefined && raw.grade === '?' ? 'unmeasured' : 'calibrated');
    const gradeStr =
      typeof raw.grade === 'string'
        ? raw.grade
        : typeof raw.grade === 'number'
          ? formatMukToken(raw.grade, statusStr === 'unmeasured' ? 'unmeasured' : undefined)
          : raw.base !== undefined
            ? formatMukToken(raw.base, statusStr === 'unmeasured' ? 'unmeasured' : undefined)
            : statusStr === 'unmeasured'
              ? '?'
              : undefined;
    const rec: MukSnapshotRecord = {};
    if (raw.base !== undefined) rec.base = Object.is(raw.base, -0) ? 0 : raw.base;
    if (gradeStr !== undefined) rec.grade = gradeStr;
    if (statusStr !== undefined) rec.status = statusStr;
    if ('acc' in raw && raw.acc !== undefined) rec.acc = raw.acc;
    if ('neff' in raw && raw.neff !== undefined) rec.neff = raw.neff;
    if ('gap' in raw && raw.gap !== undefined) rec.gap = raw.gap;
    if ('ability' in raw && raw.ability !== undefined) rec.ability = raw.ability;
    setSafeOwnProp(out, agentId, rec);
  }
  return out;
}

function toMukProfileInput(snap: MukSnapshotRecord | undefined): MukProfileInput {
  if (!snap) return null;
  const status: MukStatus | undefined =
    snap.status === 'unmeasured' || snap.status === 'provisional' || snap.status === 'calibrated'
      ? snap.status
      : snap.grade === '?'
        ? 'unmeasured'
        : undefined;
  const numericGrade =
    typeof snap.grade === 'string' && snap.grade !== '?' && snap.grade.trim() !== '' && Number.isFinite(Number(snap.grade))
      ? Number(snap.grade)
      : undefined;
  return {
    ...(snap.base !== undefined ? { base: snap.base } : {}),
    ...(numericGrade !== undefined ? { grade: numericGrade } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(snap.acc !== undefined ? { acc: snap.acc } : {}),
    ...(snap.ability !== undefined ? { ability: snap.ability } : {}),
  };
}

function buildCalcSummary(ledger: LedgerContext): AuditCalcSummary {
  const activeClausesForVerify: Clause[] = [];
  for (const [, ent] of ledger.clausesByNum) {
    if (ent.active) {
      // 이미 커밋된 원장 위의 활성 절 산술 정합성을 검증할 때 자기 차례의 과거 fix→ 포인터가
      // 신규 미커밋 수정으로 중복 해석되지 않도록 process 사본만 비운다.
      activeClausesForVerify.push({ ...ent.clause, process: null });
    }
  }

  const activeMsg: Message = {
    gyeol: SPEC_VERSION,
    profile: 'lon',
    head: { mode: 'snapshot' },
    clauses: activeClausesForVerify,
    evidences: [...ledger.priorEvidences],
    calcs: [...ledger.calcsById.values()],
    gloss: null,
    muk_source: null,
  };

  const { diagnostics: verifyDiags, evaluated } = verifyMessageCalculations(activeMsg, {
    priorClauseByNum: ledger.priorClauseMap,
    alreadySuperseded: ledger.supersededSet(),
  });

  const diagnostics: Diagnostic[] = [...verifyDiags];
  let staleInfCount = 0;

  // 원장 상태 기준 상위 절 대체·철회 이후 미갱신된 활성 [inf] 하위 절(E_STALE_INF) 정밀 탐지
  for (const [num, ent] of ledger.clausesByNum) {
    if (!ent.active || ent.clause.marks.ev !== 'inf') continue;
    const deps = ledger.depsOf.get(num);
    if (!deps) continue;
    for (const depNum of deps) {
      const depEnt = ledger.clausesByNum.get(depNum);
      if (!depEnt || depEnt.active) continue;
      const latestNum = ledger.latestActiveOf(depNum);
      const latestEnt = ledger.clausesByNum.get(latestNum);
      const isRetractedDead = Boolean(depEnt.retractedBy) && (!latestEnt || !latestEnt.active);
      const isUpdatedAfterDependent = Boolean(latestEnt && latestEnt.active && latestEnt.turn > ent.turn);
      if (isRetractedDead || isUpdatedAfterDependent) {
        staleInfCount++;
        diagnostics.push({
          code: 'E_STALE_INF',
          severity: '오류',
          tier: tierOfCode('E_STALE_INF'),
          line: ent.turn,
          message: `상위 절 <${depNum}>이 변경·철회되었으나 의존 추론 절 <${num}>이 갱신되지 않았다`,
        });
        break;
      }
    }
  }

  const evaluatedByClause: Record<string, number> = {};
  for (const [k, v] of [...evaluated.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    evaluatedByClause[k] = v;
  }

  // 절별 소유 calc 매핑
  const ownerClauseByCalcId = new Map<string, { num: string; active: boolean; clause: Clause }>();
  for (const [num, ent] of ledger.clausesByNum) {
    for (const cb of ent.clause.calcs ?? []) {
      ownerClauseByCalcId.set(cb.id, { num, active: ent.active, clause: ent.clause });
    }
    for (const b of ent.clause.because ?? []) {
      if ('calc' in b && !ownerClauseByCalcId.has(b.calc)) {
        ownerClauseByCalcId.set(b.calc, { num, active: ent.active, clause: ent.clause });
      }
    }
  }

  const resolveLatestVal = (refNum: string): number | null => {
    const latest = ledger.latestActiveOf(refNum);
    if (evaluated.has(latest)) return evaluated.get(latest)!;
    if (evaluated.has(refNum)) return evaluated.get(refNum)!;
    return ledger.clausesByNum.get(latest)?.numericValue ?? ledger.clausesByNum.get(refNum)?.numericValue ?? null;
  };

  const resolveHistoricalVal = (refNum: string): number | null => {
    return ledger.clausesByNum.get(refNum)?.numericValue ?? resolveLatestVal(refNum);
  };

  const items: CalcSummaryItem[] = [];
  let activeCalcs = 0;
  let verifiedCalcs = 0;
  let failedCalcs = 0;

  const sortedCalcIds = [...ledger.calcsById.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const calcId of sortedCalcIds) {
    const cb: CalcBlock = ledger.calcsById.get(calcId)!;
    const owner = ownerClauseByCalcId.get(calcId);
    const isActive = owner ? owner.active : true;
    if (isActive) activeCalcs++;

    const ev = evaluateCalcExpression(cb.expr, isActive ? resolveLatestVal : resolveHistoricalVal);
    let itemOk = ev.ok && ev.value !== undefined;
    let errMsg = ev.error;

    if (itemOk && ev.declared !== undefined && !numbersMatch(ev.declared, ev.value!)) {
      itemOk = false;
      errMsg = `선언값 ${ev.declared} != 계산값 ${ev.value}`;
    }
    if (itemOk && isActive && owner) {
      const cNums = extractNumbersFromClause(owner.clause);
      if (cNums.length > 0 && !cNums.some((n) => numbersMatch(n, ev.value!))) {
        itemOk = false;
        errMsg = `절 <${owner.num}> 수치(${cNums.join(', ')}) != 계산값 ${ev.value}`;
      }
    }

    if (itemOk) {
      verifiedCalcs++;
    } else if (isActive) {
      failedCalcs++;
    }

    items.push({
      calcId: cb.id,
      clauseNum: owner?.num ?? null,
      expr: cb.expr,
      ...(ev.declared !== undefined ? { declared: ev.declared } : cb.declared !== undefined ? { declared: cb.declared } : {}),
      evaluated: ev.ok && ev.value !== undefined ? ev.value : null,
      ok: itemOk,
      active: isActive,
      ...(errMsg ? { error: errMsg } : {}),
    });
  }

  return {
    ok: diagnostics.filter((d) => d.severity === '오류').length === 0 && failedCalcs === 0 && staleInfCount === 0,
    totalCalcs: items.length,
    activeCalcs,
    verifiedCalcs,
    failedCalcs,
    staleInfCount,
    evaluatedByClause,
    items,
    diagnostics,
  };
}

function reconstructTurnsFromLedger(ledger: LedgerContext): string[] {
  const byTurn = new Map<number, Clause[]>();
  for (const [, ent] of ledger.clausesByNum) {
    let list = byTurn.get(ent.turn);
    if (!list) {
      list = [];
      byTurn.set(ent.turn, list);
    }
    list.push(ent.clause);
  }
  if (ledger.chain.length > 0) {
    return ledger.chain.map((b) => {
      const clauses = byTurn.get(b.turn) ?? [];
      const header = `${b.profile} ${b.edition} · ${b.mode}`;
      if (!clauses.length) return header;
      return [header, ...clauses.map((c) => clauseText03(c, true))].join('\n');
    });
  }
  return [...byTurn.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, clauses]) => [`lon ${LON_VERSION} · delta`, ...clauses.map((c) => clauseText03(c, true))].join('\n'));
}

function dedupeDiagnostics(lists: readonly (readonly Diagnostic[])[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const d of list) {
      const key = `${d.code}:${d.severity}:${d.line}:${d.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({
          code: d.code,
          severity: d.severity,
          ...(d.tier ? { tier: d.tier } : {}),
          line: d.line,
          message: d.message,
        });
      }
    }
  }
  return out;
}

/**
 * LedgerContext와 선택적 Muk 0.8.5 스냅샷으로부터 EU AI Act 제12조부터 제15조까지 대응하는
 * 결정론적 기술 감사 번들(`Bundle085`)을 생성한다.
 * - 본 출력은 결정론적 기술 증거 자료이며 법적 적합성 인증을 대체하지 않는다.
 * - 비정형 UTF-16 단독 서로게이트(RFC 8785 §3.2.2.2)가 포함되면 즉시 TypeError를 던진다.
 */
export async function exportAuditBundle(
  ledger: LedgerContext,
  mukSnapshots?: Readonly<Record<string, MukSnapshotInput>>,
  opts: ExportAuditBundleOptions = {},
): Promise<Bundle085> {
  const ledgerWellFormed =
    typeof (ledger as { isWellFormed?: () => boolean }).isWellFormed === 'function'
      ? (ledger as unknown as { isWellFormed: () => boolean }).isWellFormed()
      : true;
  if (!ledgerWellFormed) {
    throw new TypeError('RFC 8785 §3.2.2.2: LedgerContext 내부에 비정형 UTF-16 단독 서로게이트가 포함되어 있다');
  }

  const preCheckErrors = [
    ...collectWellFormedErrors(ledger.chain, '$.ledger.chain'),
    ...collectWellFormedErrors(ledger.clausesByNum, '$.ledger.clausesByNum'),
    ...collectWellFormedErrors(ledger.evidencesByKey, '$.ledger.evidencesByKey'),
    ...collectWellFormedErrors(ledger.calcsById, '$.ledger.calcsById'),
    ...collectWellFormedErrors(ledger.openConflicts, '$.ledger.openConflicts'),
    ...collectWellFormedErrors(mukSnapshots, '$.mukSnapshots'),
    ...collectWellFormedErrors(opts, '$.opts'),
  ];
  if (preCheckErrors.length > 0) {
    throw new TypeError(preCheckErrors[0]);
  }

  const muk = normalizeMukSnapshots(mukSnapshots);
  const soleMukAgent = Object.keys(muk).length === 1 ? Object.keys(muk)[0] : undefined;

  const chain: LedgerChainBlock[] = ledger.chain.map((b) => ({
    turn: b.turn,
    prevHash: b.prevHash,
    turnHash: b.turnHash,
    chainHash: b.chainHash,
    edition: b.edition,
    profile: b.profile,
    mode: b.mode,
    dictHash: b.dictHash,
    clauseCount: b.clauseCount,
  }));

  const lineage: Record<string, AuditLineageNode> = {};
  for (const [num, ent] of ledger.clausesByNum) {
    const c = ent.clause;
    const status: AuditLineageNode['status'] = ent.retractedBy
      ? 'retracted'
      : ent.supersededBy || !ent.active
        ? 'superseded'
        : 'active';

    const evIds = new Set<string>();
    for (const ev of c.evidences ?? []) evIds.add(`${ev.kind}${ev.id}`);
    for (const b of c.because ?? []) {
      if ('ext' in b) evIds.add(`${b.ext}${b.id}`);
    }

    const calcIds = new Set<string>();
    for (const cb of c.calcs ?? []) calcIds.add(cb.id);
    for (const b of c.because ?? []) {
      if ('calc' in b) calcIds.add(b.calc);
    }

    const deps = [...(ledger.depsOf.get(num) ?? [])];
    const agent = opts.clauseAgents?.[num] ?? opts.defaultAgent ?? soleMukAgent;
    const maybeLattice = (ent as { lattice?: AuditLineageLattice }).lattice;

    const node: AuditLineageNode = {
      num,
      turn: ent.turn,
      status,
      active: Boolean(ent.active),
      ev: c.marks.ev ?? null,
      act: c.marks.act ?? null,
      ...(c.marks.fig ? { fig: c.marks.fig } : {}),
      conf: extractClauseConf(c),
      mukGrade: extractClauseMukGrade(c),
      mukUnmeasured: Boolean(c.muk?.unmeasured),
      numericValue: ent.numericValue,
      ...(c.process
        ? {
            process: {
              kind: c.process.kind,
              ...(c.process.target ? { target: c.process.target.label.replace(/^[절점]/u, '') } : {}),
            },
          }
        : {}),
      deps,
      evidenceIds: [...evIds],
      calcIds: [...calcIds],
      ...(ent.supersededBy ? { supersededBy: ent.supersededBy } : {}),
      ...(ent.retractedBy ? { retractedBy: ent.retractedBy } : {}),
      ...(ent.supportedBy?.length ? { supportedBy: [...ent.supportedBy] } : {}),
      ...(agent ? { agent } : {}),
      ...(maybeLattice
        ? {
            lattice: {
              tau: maybeLattice.tau,
              m: maybeLattice.m,
              c: maybeLattice.c,
              chi: maybeLattice.chi,
              calcAnc: Boolean(maybeLattice.calcAnc),
            },
          }
        : {}),
      canonicalClause: clauseText03(c, true),
    };
    lineage[num] = node;
  }

  const evidences: Record<string, AuditEvidenceRecord> = {};
  const sortedEvKeys = [...ledger.evidencesByKey.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of sortedEvKeys) {
    const ev = ledger.evidencesByKey.get(key)!;
    const evHash = await sha256Hex(ev.text);
    const idKey = `${ev.kind}${ev.id}`;
    evidences[idKey] = {
      kind: ev.kind,
      id: ev.id,
      sha256: evHash,
      length: ev.text.length,
      ...(opts.redactEvidenceText ? {} : { text: ev.text }),
    };
  }

  const turns = opts.turns ? [...opts.turns] : reconstructTurnsFromLedger(ledger);
  const conflicts: OpenConflict[] = ledger.openConflicts.map((oc) => ({
    clauseNum: oc.clauseNum,
    targetNum: oc.targetNum,
    evidenceIds: [...oc.evidenceIds],
    turn: oc.turn,
    text: oc.text,
  }));

  const calcSummary = buildCalcSummary(ledger);
  const diagnostics = dedupeDiagnostics([opts.diagnostics ?? [], calcSummary.diagnostics]);

  const signablePayload: BundleSignablePayload = normalizeNegativeZeroDeep({
    spec: STANDARDS_SPEC_VERSION,
    head: ledger.headHash,
    chain,
    turns,
    lineage,
    evidences,
    conflicts,
    calcSummary,
    diagnostics,
    muk,
  });

  const payloadErrors = collectWellFormedErrors(signablePayload, '$.bundle', [], new Set(), true);
  if (payloadErrors.length > 0) {
    throw new TypeError(payloadErrors[0]);
  }

  const jcs = jcsStringify(signablePayload);
  if (!isWellFormedString(jcs)) {
    throw new TypeError('RFC 8785 §3.2.2.2: 직렬화된 JCS 문자열이 정형 UTF-16이 아니다');
  }
  const strictJcsErrors = validateStrictRfc8785Jcs(jcs);
  if (strictJcsErrors.length > 0) {
    throw new TypeError(strictJcsErrors[0]);
  }
  const bundleHash = await sha256Hex(jcs);

  return {
    ...signablePayload,
    jcs,
    bundleHash,
  };
}

/**
 * Bundle085의 해시 체인(prevHash / chainHash / head), 외부 근거 해시, 계보 상태 일관성,
 * UTF-16 정형성(RFC 8785 §3.2.2.2), 프로토타입 오염 방지 키(__proto__ 등), 중복 키 부재,
 * 숫자 정규형(§3.2.2.3), 그리고 JCS 정규 동치성·무변조 무결성을 결정론적으로 재검증한다.
 */
export async function verifyAuditBundle(bundle: unknown): Promise<AuditVerifyResult> {
  const errors: string[] = [];
  let checkedBlocks = 0;

  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return { ok: false, errors: ['감사 번들이 유효한 객체가 아니다'], checkedBlocks: 0 };
  }

  const b = bundle as Partial<Bundle085>;
  if (b.spec !== STANDARDS_SPEC_VERSION) {
    errors.push(`판본 잠금 위반: 기대 판본 '${STANDARDS_SPEC_VERSION}', 실제 '${String(b.spec)}'`);
  }

  collectWellFormedErrors(bundle, '$', errors, new Set(), true);

  if (typeof b.head !== 'string' || !HEX64_RE.test(b.head)) {
    errors.push(`head 필드가 64자리 소문자 16진 SHA-256 형식이 아니다: '${String(b.head)}'`);
  }

  if (!Array.isArray(b.chain)) {
    errors.push('chain 필드가 배열이 아니다');
  } else {
    let expectedPrev = '0'.repeat(64);
    for (let i = 0; i < b.chain.length; i++) {
      const blk = b.chain[i];
      checkedBlocks++;
      if (!blk || typeof blk !== 'object') {
        errors.push(`chain[${i}]: 유효한 블록 객체가 아니다`);
        continue;
      }
      if (!Number.isInteger(blk.turn) || blk.turn < 1) {
        errors.push(`chain[${i}]: turn(${String(blk.turn)})이 양의 정수가 아니다`);
      }
      if (blk.prevHash !== expectedPrev) {
        errors.push(`chain[${i}] (turn ${String(blk.turn)}): prevHash 연결 불일치 (기대 ${expectedPrev}, 실제 ${String(blk.prevHash)})`);
      }
      if (typeof blk.turnHash !== 'string' || !HEX64_RE.test(blk.turnHash)) {
        errors.push(`chain[${i}] (turn ${String(blk.turn)}): turnHash가 64자리 16진수가 아니다`);
      }
      if (typeof blk.dictHash !== 'string' || !HEX64_RE.test(blk.dictHash)) {
        errors.push(`chain[${i}] (turn ${String(blk.turn)}): dictHash가 64자리 16진수가 아니다`);
      }
      if (typeof blk.prevHash === 'string' && typeof blk.turn === 'number' && Number.isFinite(blk.turn) && typeof blk.turnHash === 'string') {
        const expectedChainHash = await jcsSha256({
          prevHash: blk.prevHash,
          turn: blk.turn,
          turnHash: blk.turnHash,
        });
        if (blk.chainHash !== expectedChainHash) {
          errors.push(
            `chain[${i}] (turn ${blk.turn}): chainHash 위변조 검출 (기대 ${expectedChainHash}, 실제 ${String(blk.chainHash)})`,
          );
        }
      } else {
        errors.push(`chain[${i}]: chainHash 재계산에 필요한 필드가 누락되었다`);
      }
      if (typeof blk.chainHash === 'string') {
        expectedPrev = blk.chainHash;
      }
    }
    if (typeof b.head === 'string' && b.head !== expectedPrev) {
      errors.push(`head 해시가 체인 말단과 일치하지 않는다 (기대 ${expectedPrev}, 실제 ${b.head})`);
    }
  }

  if (!Array.isArray(b.turns)) errors.push('turns 필드가 배열이 아니다');
  if (!b.lineage || typeof b.lineage !== 'object' || Array.isArray(b.lineage)) {
    errors.push('lineage 필드가 객체 맵이 아니다');
  } else {
    for (const [k, node] of Object.entries(b.lineage)) {
      if (!node || typeof node !== 'object') {
        errors.push(`lineage['${k}']: 유효한 노드가 아니다`);
        continue;
      }
      if (node.num !== k) {
        errors.push(`lineage['${k}']: num('${String(node.num)}') 키 불일치`);
      }
      const expectedActive = node.status === 'active';
      if (node.active !== expectedActive) {
        errors.push(`lineage['${k}']: status('${String(node.status)}')와 active(${String(node.active)}) 불일치`);
      }
      if (node.status === 'superseded' && !node.supersededBy) {
        errors.push(`lineage['${k}']: superseded 상태이나 supersededBy 포인터가 없다`);
      }
      if (node.status === 'retracted' && !node.retractedBy) {
        errors.push(`lineage['${k}']: retracted 상태이나 retractedBy 포인터가 없다`);
      }
      if (node.status === 'active' && (node.supersededBy || node.retractedBy)) {
        errors.push(`lineage['${k}']: active 상태이나 대체·철회 포인터가 동시에 존재한다`);
      }
    }
  }

  if (!b.evidences || typeof b.evidences !== 'object' || Array.isArray(b.evidences)) {
    errors.push('evidences 필드가 객체 맵이 아니다');
  } else {
    for (const [evKey, ev] of Object.entries(b.evidences)) {
      if (!ev || typeof ev !== 'object') {
        errors.push(`evidences['${evKey}']: 유효한 근거 레코드가 아니다`);
        continue;
      }
      if (ev.text !== undefined) {
        if (typeof ev.text !== 'string') {
          errors.push(`evidences['${evKey}']: text가 문자열이 아니다`);
        } else {
          const actualSha = await sha256Hex(ev.text);
          if (actualSha !== ev.sha256) {
            errors.push(`evidences['${evKey}']: 원문 SHA-256 불일치 (기대 ${ev.sha256}, 실제 ${actualSha})`);
          }
          if (ev.text.length !== ev.length) {
            errors.push(`evidences['${evKey}']: 원문 길이 불일치 (기대 ${String(ev.length)}, 실제 ${ev.text.length})`);
          }
        }
      }
    }
  }

  if (!Array.isArray(b.conflicts)) errors.push('conflicts 필드가 배열이 아니다');
  if (!b.calcSummary || typeof b.calcSummary !== 'object' || Array.isArray(b.calcSummary)) {
    errors.push('calcSummary 필드가 객체가 아니다');
  }
  if (!Array.isArray(b.diagnostics)) errors.push('diagnostics 필드가 배열이 아니다');
  if (!b.muk || typeof b.muk !== 'object' || Array.isArray(b.muk)) {
    errors.push('muk 필드가 객체 맵이 아니다');
  }

  let computedBundleHash: string | undefined;
  if (typeof b.jcs !== 'string') {
    errors.push('jcs 필드가 문자열이 아니다');
  } else {
    for (const rawJcsErr of validateStrictRfc8785Jcs(b.jcs)) {
      errors.push(rawJcsErr);
    }
    try {
      const signablePayload: BundleSignablePayload = {
        spec: b.spec as '0.8.5',
        head: b.head as string,
        chain: b.chain as LedgerChainBlock[],
        turns: b.turns as string[],
        lineage: b.lineage as Record<string, AuditLineageNode>,
        evidences: b.evidences as Record<string, AuditEvidenceRecord>,
        conflicts: b.conflicts as OpenConflict[],
        calcSummary: b.calcSummary as AuditCalcSummary,
        diagnostics: b.diagnostics as Diagnostic[],
        muk: b.muk as Record<string, MukSnapshotRecord>,
      };
      const expectedJcs = jcsStringify(signablePayload);
      if (b.jcs !== expectedJcs) {
        errors.push('jcs 정규 직렬화 불일치: 번들 본문이 변조되었거나 비정규 JSON 형식이다');
      }
      const parsedJcs = JSON.parse(b.jcs) as unknown;
      collectWellFormedErrors(parsedJcs, '$.parsedJcs', errors, new Set(), true);
      if (jcsStringify(parsedJcs) !== b.jcs) {
        errors.push('jcs 문자열이 IETF RFC 8785 정규 고정점을 만족하지 않는다');
      }
      computedBundleHash = await sha256Hex(expectedJcs);
      if (typeof b.bundleHash !== 'string' || !HEX64_RE.test(b.bundleHash)) {
        errors.push(`bundleHash 필드가 유효한 64자리 SHA-256 해시가 아니다: '${String(b.bundleHash)}'`);
      } else if (b.bundleHash !== computedBundleHash) {
        errors.push(`bundleHash 불일치: 기대 ${computedBundleHash}, 실제 ${b.bundleHash}`);
      }
    } catch (e) {
      errors.push(`jcs 재직렬화·파싱 검증 실패: ${(e as Error).message}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedBlocks,
    ...(computedBundleHash ? { bundleHash: computedBundleHash } : {}),
  };
}

// ───────── W3C PROV-JSON 무손실 계보 변환기 ─────────

export interface ProvJsonDocument {
  prefix: Record<string, string>;
  entity: Record<string, Record<string, unknown>>;
  activity: Record<string, Record<string, unknown>>;
  agent: Record<string, Record<string, unknown>>;
  wasGeneratedBy: Record<string, Record<string, unknown>>;
  wasDerivedFrom: Record<string, Record<string, unknown>>;
  wasRevisionOf: Record<string, Record<string, unknown>>;
  wasInvalidatedBy: Record<string, Record<string, unknown>>;
  wasAttributedTo: Record<string, Record<string, unknown>>;
}

/**
 * Bundle085를 W3C PROV-JSON 표준 문서 구조로 무손실 변환한다.
 * prefix, entity, activity, agent, wasGeneratedBy, wasDerivedFrom,
 * wasRevisionOf, wasInvalidatedBy, wasAttributedTo 9개 최상위 컨테이너를 모두 생성한다.
 */
export function toProvJson(bundle: Bundle085): ProvJsonDocument {
  const prefix: Record<string, string> = {
    prov: 'http://www.w3.org/ns/prov#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    gyeol: 'https://gyeol.org/ns/0.8.5#',
    lon: 'https://gyeol.org/ns/lon/0.8.5#',
  };

  const entity: Record<string, Record<string, unknown>> = {};
  const activity: Record<string, Record<string, unknown>> = {};
  const agent: Record<string, Record<string, unknown>> = {};
  const wasGeneratedBy: Record<string, Record<string, unknown>> = {};
  const wasDerivedFrom: Record<string, Record<string, unknown>> = {};
  const wasRevisionOf: Record<string, Record<string, unknown>> = {};
  const wasInvalidatedBy: Record<string, Record<string, unknown>> = {};
  const wasAttributedTo: Record<string, Record<string, unknown>> = {};

  const hostAgentId = 'lon:agent/lon-host-0.8.5';
  agent[hostAgentId] = {
    'prov:type': 'prov:SoftwareAgent',
    'gyeol:role': 'deterministic-verifier',
    'gyeol:spec': STANDARDS_SPEC_VERSION,
  };

  for (const [agentKey, snap] of Object.entries(bundle.muk)) {
    agent[`lon:agent/${agentKey}`] = {
      'prov:type': 'prov:SoftwareAgent',
      'gyeol:agentId': agentKey,
      ...(snap.base !== undefined ? { 'gyeol:mukBase': snap.base } : {}),
      ...(snap.grade !== undefined ? { 'gyeol:mukGrade': snap.grade } : {}),
      ...(snap.status !== undefined ? { 'gyeol:mukStatus': snap.status } : {}),
      ...(snap.neff !== undefined ? { 'gyeol:mukNeff': snap.neff } : {}),
    };
  }

  const exportActId = 'lon:activity/export-0.8.5';
  activity[exportActId] = {
    'prov:type': 'gyeol:AuditBundleExport',
    'gyeol:spec': bundle.spec,
    'gyeol:calcOk': bundle.calcSummary.ok,
    'gyeol:diagnosticCount': bundle.diagnostics.length,
  };

  entity['lon:bundle'] = {
    'prov:type': 'gyeol:AuditBundle',
    'gyeol:spec': bundle.spec,
    'gyeol:head': bundle.head,
    'gyeol:bundleHash': bundle.bundleHash,
    'gyeol:turnCount': bundle.chain.length,
  };
  wasGeneratedBy['_:wgb_bundle'] = {
    'prov:entity': 'lon:bundle',
    'prov:activity': exportActId,
  };
  wasAttributedTo['_:wat_bundle'] = {
    'prov:entity': 'lon:bundle',
    'prov:agent': hostAgentId,
  };

  const ensureTurnActivity = (turn: number, mode = 'delta', profile = 'lon') => {
    const actId = `lon:activity/turn-${turn}`;
    if (!activity[actId]) {
      activity[actId] = {
        'prov:type': 'gyeol:CommitTurn',
        'gyeol:turn': turn,
        'gyeol:mode': mode,
        'gyeol:profile': profile,
      };
    }
    return actId;
  };

  for (let i = 0; i < bundle.chain.length; i++) {
    const blk = bundle.chain[i];
    const actId = ensureTurnActivity(blk.turn, blk.mode, blk.profile);
    const blkEntId = `lon:block/turn-${blk.turn}`;
    entity[blkEntId] = {
      'prov:type': 'gyeol:LedgerChainBlock',
      'gyeol:turn': blk.turn,
      'gyeol:prevHash': blk.prevHash,
      'gyeol:turnHash': blk.turnHash,
      'gyeol:chainHash': blk.chainHash,
      'gyeol:edition': blk.edition,
      'gyeol:profile': blk.profile,
      'gyeol:mode': blk.mode,
      'gyeol:dictHash': blk.dictHash,
      'gyeol:clauseCount': blk.clauseCount,
      ...(bundle.turns[i] !== undefined ? { 'prov:value': bundle.turns[i] } : {}),
    };
    wasGeneratedBy[`_:wgb_block_${blk.turn}`] = {
      'prov:entity': blkEntId,
      'prov:activity': actId,
    };
    if (i > 0) {
      wasDerivedFrom[`_:wdf_chain_${blk.turn}`] = {
        'prov:generatedEntity': blkEntId,
        'prov:usedEntity': `lon:block/turn-${bundle.chain[i - 1].turn}`,
        'gyeol:rel': 'hash-chain',
      };
    }
  }

  for (const [evKey, ev] of Object.entries(bundle.evidences)) {
    const evEntId = `lon:evidence/${evKey}`;
    entity[evEntId] = {
      'prov:type': ev.kind === 'evd' ? 'gyeol:EmpiricalEvidence' : 'gyeol:ReferenceSource',
      'gyeol:kind': ev.kind,
      'gyeol:id': ev.id,
      'gyeol:sha256': ev.sha256,
      'gyeol:length': ev.length,
      ...(ev.text !== undefined ? { 'prov:value': ev.text } : {}),
    };
  }

  for (const ci of bundle.calcSummary.items) {
    const calcEntId = `lon:calc/${ci.calcId}`;
    entity[calcEntId] = {
      'prov:type': 'gyeol:CalcBlock',
      'gyeol:calcId': ci.calcId,
      'gyeol:expr': ci.expr,
      'gyeol:ok': ci.ok,
      'gyeol:active': ci.active,
      ...(ci.clauseNum !== null ? { 'gyeol:clauseNum': ci.clauseNum } : {}),
      ...(ci.declared !== undefined ? { 'gyeol:declared': ci.declared } : {}),
      ...(ci.evaluated !== null ? { 'gyeol:evaluated': ci.evaluated } : {}),
      ...(ci.error ? { 'gyeol:error': ci.error } : {}),
    };
  }

  const defaultMukAgent = Object.keys(bundle.muk)[0];
  const emittedRevisions = new Set<string>();

  for (const [num, node] of Object.entries(bundle.lineage)) {
    const clauseEntId = `lon:clause/${num}`;
    const actId = ensureTurnActivity(node.turn);

    entity[clauseEntId] = {
      'prov:type': 'gyeol:Clause',
      'gyeol:num': node.num,
      'gyeol:turn': node.turn,
      'gyeol:status': node.status,
      'gyeol:active': node.active,
      'gyeol:ev': node.ev ?? 'none',
      'gyeol:act': node.act ?? 'none',
      ...(node.fig ? { 'gyeol:fig': node.fig } : {}),
      ...(node.conf !== null ? { 'gyeol:conf': node.conf } : {}),
      'gyeol:mukGrade': node.mukGrade,
      'gyeol:mukUnmeasured': node.mukUnmeasured,
      ...(node.numericValue !== null ? { 'gyeol:numericValue': node.numericValue } : {}),
      ...(node.supportedBy?.length ? { 'gyeol:supportedBy': node.supportedBy } : {}),
      'prov:value': node.canonicalClause,
    };

    wasGeneratedBy[`_:wgb_clause_${num}`] = {
      'prov:entity': clauseEntId,
      'prov:activity': actId,
    };

    const speakerKey = node.agent ?? defaultMukAgent;
    if (speakerKey) {
      const agId = `lon:agent/${speakerKey}`;
      if (!agent[agId]) {
        agent[agId] = {
          'prov:type': 'prov:SoftwareAgent',
          'gyeol:agentId': speakerKey,
        };
      }
      wasAttributedTo[`_:wat_clause_${num}`] = {
        'prov:entity': clauseEntId,
        'prov:agent': agId,
      };
    } else {
      wasAttributedTo[`_:wat_clause_${num}`] = {
        'prov:entity': clauseEntId,
        'prov:agent': hostAgentId,
      };
    }

    for (const dep of node.deps) {
      wasDerivedFrom[`_:wdf_clause_${num}_dep_${dep}`] = {
        'prov:generatedEntity': clauseEntId,
        'prov:usedEntity': `lon:clause/${dep}`,
        'gyeol:rel': 'because-clause',
      };
    }

    for (const evId of node.evidenceIds) {
      wasDerivedFrom[`_:wdf_clause_${num}_ev_${evId}`] = {
        'prov:generatedEntity': clauseEntId,
        'prov:usedEntity': `lon:evidence/${evId}`,
        'gyeol:rel': 'because-evidence',
      };
    }

    for (const calcId of node.calcIds) {
      wasDerivedFrom[`_:wdf_clause_${num}_calc_${calcId}`] = {
        'prov:generatedEntity': clauseEntId,
        'prov:usedEntity': `lon:calc/${calcId}`,
        'gyeol:rel': 'derived-calculation',
      };
    }

    if (node.process?.kind === 'fix' && node.process.target) {
      const target = node.process.target;
      const revKey = `${num}->${target}`;
      emittedRevisions.add(revKey);
      wasRevisionOf[`_:wro_${num}_${target}`] = {
        'prov:generatedEntity': clauseEntId,
        'prov:usedEntity': `lon:clause/${target}`,
        'prov:activity': actId,
        'prov:type': { $: 'prov:Revision', type: 'prov:QUALIFIED_NAME' },
      };
      wasDerivedFrom[`_:wdf_rev_${num}_${target}`] = {
        'prov:generatedEntity': clauseEntId,
        'prov:usedEntity': `lon:clause/${target}`,
        'gyeol:rel': 'fix-revision',
      };
    } else if (node.process?.kind === 'sup' && node.process.target) {
      const target = node.process.target;
      wasDerivedFrom[`_:wdf_sup_${num}_${target}`] = {
        'prov:generatedEntity': `lon:clause/${target}`,
        'prov:usedEntity': clauseEntId,
        'gyeol:rel': 'support',
      };
    }

    if (node.status === 'superseded' && node.supersededBy) {
      const revTurn = bundle.lineage[node.supersededBy]?.turn ?? node.turn;
      const revActId = ensureTurnActivity(revTurn);
      wasInvalidatedBy[`_:wib_sup_${num}`] = {
        'prov:entity': clauseEntId,
        'prov:activity': revActId,
        'gyeol:reason': 'superseded',
        'gyeol:byClause': `lon:clause/${node.supersededBy}`,
      };
      const revKey = `${node.supersededBy}->${num}`;
      if (!emittedRevisions.has(revKey)) {
        emittedRevisions.add(revKey);
        wasRevisionOf[`_:wro_${node.supersededBy}_${num}`] = {
          'prov:generatedEntity': `lon:clause/${node.supersededBy}`,
          'prov:usedEntity': clauseEntId,
          'prov:activity': revActId,
          'prov:type': { $: 'prov:Revision', type: 'prov:QUALIFIED_NAME' },
        };
      }
    } else if (node.status === 'retracted' && node.retractedBy) {
      const retTurn = bundle.lineage[node.retractedBy]?.turn ?? node.turn;
      const retActId = ensureTurnActivity(retTurn);
      wasInvalidatedBy[`_:wib_ret_${num}`] = {
        'prov:entity': clauseEntId,
        'prov:activity': retActId,
        'gyeol:reason': 'retracted',
        'gyeol:byClause': `lon:clause/${node.retractedBy}`,
      };
    }
  }

  for (const oc of bundle.conflicts) {
    const confEntId = `lon:conflict/${oc.clauseNum}-vs-${oc.targetNum}`;
    const actId = ensureTurnActivity(oc.turn);
    entity[confEntId] = {
      'prov:type': 'gyeol:OpenConflict',
      'gyeol:clauseNum': oc.clauseNum,
      'gyeol:targetNum': oc.targetNum,
      'gyeol:turn': oc.turn,
      'gyeol:evidenceIds': oc.evidenceIds,
      'prov:value': oc.text,
    };
    wasGeneratedBy[`_:wgb_conflict_${oc.clauseNum}_${oc.targetNum}`] = {
      'prov:entity': confEntId,
      'prov:activity': actId,
    };
    wasDerivedFrom[`_:wdf_conflict_${oc.clauseNum}_${oc.targetNum}`] = {
      'prov:generatedEntity': confEntId,
      'prov:usedEntity': `lon:clause/${oc.targetNum}`,
      'gyeol:rel': 'opposes',
    };
  }

  return {
    prefix,
    entity,
    activity,
    agent,
    wasGeneratedBy,
    wasDerivedFrom,
    wasRevisionOf,
    wasInvalidatedBy,
    wasAttributedTo,
  };
}

// ───────── OpenTelemetry GenAI Semantic Conventions + Gyeol 변환기 ─────────

export type OtelPrimitiveAttributeValue = string | number | boolean | string[] | number[] | boolean[];

export interface OtelGenAiEvent {
  name: string;
  attributes: Record<string, OtelPrimitiveAttributeValue>;
}

export interface OtelPoolConsensusSummary {
  voteCount: number;
  mode: 'linear' | 'log-odds';
  prob: number;
  weights: number[];
  totalWeight: number;
}

export interface OtelGenAiOptions {
  operationName?: 'chat' | 'invoke_agent' | 'invoke_workflow' | 'execute_tool' | string;
  providerName?: string;
  requestModel?: string;
  responseModel?: string;
  agentId?: string;
  agentName?: string;
  conversationId?: string;
  consensusMode?: 'linear' | 'log-odds';
  abilityMix?: number;
  votes?: readonly ConsensusVote[];
}

export interface OtelGenAiTelemetry {
  /** OpenTelemetry Span.setAttributes 호환 평면 속성 맵 */
  attributes: Record<string, OtelPrimitiveAttributeValue>;
  /** OpenTelemetry Span.addEvent 호환 구조화 이벤트 목록 */
  events: OtelGenAiEvent[];
  /** Muk 0.8.5 다중 에이전트 합의 가중치 집계 요약 */
  poolConsensus: OtelPoolConsensusSummary;
}

function deriveVotesFromBundle(bundle: Bundle085): ConsensusVote[] {
  const votes: ConsensusVote[] = [];
  const defaultAgentKey = Object.keys(bundle.muk)[0];
  for (const node of Object.values(bundle.lineage)) {
    if (!node.active || node.conf === null) continue;
    let mukInput: MukProfileInput = null;
    const agentKey = node.agent ?? defaultAgentKey;
    if (agentKey && bundle.muk[agentKey]) {
      mukInput = toMukProfileInput(bundle.muk[agentKey]);
    } else if (node.mukUnmeasured || node.mukGrade === '?') {
      mukInput = { status: 'unmeasured' };
    } else if (node.mukGrade !== '' && Number.isFinite(Number(node.mukGrade))) {
      mukInput = Number(node.mukGrade);
    }
    votes.push({
      prob: probOf(node.conf),
      muk: mukInput,
      conf: node.conf,
    });
  }
  return votes;
}

/**
 * Bundle085를 OpenTelemetry GenAI Semantic Conventions(`gen_ai.*`) 및
 * 결·론 확장 네임스페이스(`gyeol.*`) 평면 속성·구조화 이벤트·`poolConsensus` 요약으로 변환한다.
 */
export function toOtelGenAiAttributes(
  bundle: Bundle085,
  opts: OtelGenAiOptions = {},
): OtelGenAiTelemetry {
  const lineageNodes = Object.values(bundle.lineage);
  let activeCount = 0;
  let supersededCount = 0;
  let retractedCount = 0;
  for (const n of lineageNodes) {
    if (n.status === 'active') activeCount++;
    else if (n.status === 'superseded') supersededCount++;
    else if (n.status === 'retracted') retractedCount++;
  }

  const mode = opts.consensusMode ?? 'log-odds';
  const votes = opts.votes ? [...opts.votes] : deriveVotesFromBundle(bundle);
  const pooled = poolConsensus(votes, {
    mode,
    ...(opts.abilityMix !== undefined ? { abilityMix: opts.abilityMix } : {}),
  });

  const consensusSummary: OtelPoolConsensusSummary = {
    voteCount: votes.length,
    mode,
    prob: pooled.prob,
    weights: pooled.weights,
    totalWeight: pooled.totalWeight,
  };

  const mukAgents = Object.keys(bundle.muk);
  const primaryAgentId = opts.agentId ?? mukAgents[0] ?? 'lon-host-0.8.5';
  const primaryAgentName = opts.agentName ?? primaryAgentId;
  const diagCodes = [...new Set(bundle.diagnostics.map((d) => d.code))];

  const attributes: Record<string, OtelPrimitiveAttributeValue> = {
    'gen_ai.operation.name': opts.operationName ?? 'invoke_agent',
    'gen_ai.provider.name': opts.providerName ?? 'gyeol',
    'gen_ai.agent.id': primaryAgentId,
    'gen_ai.agent.name': primaryAgentName,
    'gen_ai.agent.version': STANDARDS_SPEC_VERSION,
    ...(opts.conversationId ? { 'gen_ai.conversation.id': opts.conversationId } : {}),
    ...(opts.requestModel ? { 'gen_ai.request.model': opts.requestModel } : {}),
    ...(opts.responseModel ? { 'gen_ai.response.model': opts.responseModel } : {}),
    'gyeol.spec.version': bundle.spec,
    'gyeol.lon.head_hash': bundle.head,
    'gyeol.lon.bundle_hash': bundle.bundleHash,
    'gyeol.lon.turn_count': bundle.chain.length,
    'gyeol.lon.clause_total': lineageNodes.length,
    'gyeol.lon.clause_active': activeCount,
    'gyeol.lon.clause_superseded': supersededCount,
    'gyeol.lon.clause_retracted': retractedCount,
    'gyeol.lon.open_conflict_count': bundle.conflicts.length,
    'gyeol.lon.evidence_count': Object.keys(bundle.evidences).length,
    'gyeol.calc.ok': bundle.calcSummary.ok,
    'gyeol.calc.total': bundle.calcSummary.totalCalcs,
    'gyeol.calc.verified': bundle.calcSummary.verifiedCalcs,
    'gyeol.calc.failed': bundle.calcSummary.failedCalcs,
    'gyeol.calc.stale_inf_count': bundle.calcSummary.staleInfCount,
    'gyeol.diagnostics.count': bundle.diagnostics.length,
    'gyeol.diagnostics.codes': diagCodes,
    'gyeol.muk.spec_version': MUK_SPEC_VERSION,
    'gyeol.muk.agent_ids': mukAgents,
    'gyeol.muk.pool_consensus.mode': consensusSummary.mode,
    'gyeol.muk.pool_consensus.vote_count': consensusSummary.voteCount,
    'gyeol.muk.pool_consensus.prob': consensusSummary.prob,
    'gyeol.muk.pool_consensus.total_weight': consensusSummary.totalWeight,
    'gyeol.muk.pool_consensus.weights': consensusSummary.weights,
  };

  const events: OtelGenAiEvent[] = [];

  for (const blk of bundle.chain) {
    events.push({
      name: 'gyeol.lon.turn.committed',
      attributes: {
        'gyeol.turn': blk.turn,
        'gyeol.chain_hash': blk.chainHash,
        'gyeol.turn_hash': blk.turnHash,
        'gyeol.prev_hash': blk.prevHash,
        'gyeol.edition': blk.edition,
        'gyeol.profile': blk.profile,
        'gyeol.mode': blk.mode,
        'gyeol.clause_count': blk.clauseCount,
      },
    });
  }

  for (const oc of bundle.conflicts) {
    events.push({
      name: 'gyeol.lon.conflict.opened',
      attributes: {
        'gyeol.clause_num': oc.clauseNum,
        'gyeol.target_num': oc.targetNum,
        'gyeol.turn': oc.turn,
        'gyeol.evidence_ids': oc.evidenceIds,
        'gyeol.text': oc.text,
      },
    });
  }

  for (const d of bundle.diagnostics) {
    events.push({
      name: 'gyeol.lon.diagnostic',
      attributes: {
        'gyeol.code': d.code,
        'gyeol.severity': d.severity,
        'gyeol.tier': d.tier ?? 'unspecified',
        'gyeol.line': d.line,
        'gyeol.message': d.message,
      },
    });
  }

  events.push({
    name: 'gyeol.muk.consensus.evaluated',
    attributes: {
      'gyeol.mode': consensusSummary.mode,
      'gyeol.vote_count': consensusSummary.voteCount,
      'gyeol.prob': consensusSummary.prob,
      'gyeol.total_weight': consensusSummary.totalWeight,
    },
  });

  return {
    attributes,
    events,
    poolConsensus: consensusSummary,
  };
}

// ───────── MCP CallToolResult & A2A Artifact 3줄 무손실 프로토콜 래퍼 ─────────

export type LonTurnInput =
  | string
  | Message
  | { message: Message; diagnostics?: readonly Diagnostic[] };

export interface LonWireMetaInput {
  headHash?: string;
  block?: LedgerChainBlock;
  diagnostics?: readonly Diagnostic[];
  propagatedFixes?: readonly PropagatedFix[];
  openConflicts?: readonly OpenConflict[];
  mukWeight?: number;
  bundleHash?: string;
  extra?: Record<string, unknown>;
}

export interface LonWireEnvelope085 {
  spec: '0.8.5';
  lonTurn: string;
  headHash?: string;
  block?: LedgerChainBlock;
  diagnostics?: Diagnostic[];
  propagatedFixes?: PropagatedFix[];
  openConflicts?: OpenConflict[];
  mukWeight?: number;
  bundleHash?: string;
  extra?: Record<string, unknown>;
}

export interface McpToolResultLike {
  content?: unknown[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WrappedMcpToolResult<T extends McpToolResultLike = McpToolResultLike> = Omit<T, '_meta'> & {
  _meta: Record<string, unknown> & { [LON_WIRE_KEY]: LonWireEnvelope085 };
};

export interface UnwrappedMcpToolResult<T extends McpToolResultLike = McpToolResultLike> {
  result: T;
  lon: LonWireEnvelope085 | null;
}

export interface A2aArtifactLike {
  artifactId?: string;
  name?: string;
  description?: string;
  parts?: unknown[];
  index?: number;
  append?: boolean;
  lastChunk?: boolean;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type WrappedA2aArtifact<T extends A2aArtifactLike = A2aArtifactLike> = Omit<T, 'metadata'> & {
  metadata: Record<string, unknown> & { [LON_WIRE_KEY]: LonWireEnvelope085 };
};

export interface UnwrappedA2aArtifact<T extends A2aArtifactLike = A2aArtifactLike> {
  artifact: T;
  lon: LonWireEnvelope085 | null;
}

function buildLonWireEnvelope(
  lonTurn: LonTurnInput,
  bundleMeta: LonWireMetaInput = {},
): LonWireEnvelope085 {
  let turnText: string;
  let inferredDiags: readonly Diagnostic[] | undefined;

  if (typeof lonTurn === 'string') {
    turnText = lonTurn;
  } else if ('message' in lonTurn && lonTurn.message && typeof lonTurn.message === 'object') {
    turnText = format(lonTurn.message);
    inferredDiags = lonTurn.diagnostics;
  } else {
    turnText = format(lonTurn as Message);
  }

  const diags = bundleMeta.diagnostics ?? inferredDiags;
  const headHash = bundleMeta.headHash ?? bundleMeta.block?.chainHash;

  const envelope: LonWireEnvelope085 = {
    spec: STANDARDS_SPEC_VERSION,
    lonTurn: turnText,
    ...(headHash !== undefined ? { headHash } : {}),
    ...(bundleMeta.block ? { block: { ...bundleMeta.block } } : {}),
    ...(diags ? { diagnostics: diags.map((d) => ({ ...d })) } : {}),
    ...(bundleMeta.propagatedFixes ? { propagatedFixes: bundleMeta.propagatedFixes.map((f) => ({ ...f })) } : {}),
    ...(bundleMeta.openConflicts
      ? { openConflicts: bundleMeta.openConflicts.map((c) => ({ ...c, evidenceIds: [...c.evidenceIds] })) }
      : {}),
    ...(bundleMeta.mukWeight !== undefined ? { mukWeight: bundleMeta.mukWeight } : {}),
    ...(bundleMeta.bundleHash !== undefined ? { bundleHash: bundleMeta.bundleHash } : {}),
    ...(bundleMeta.extra ? { extra: { ...bundleMeta.extra } } : {}),
  };

  const wfErrors = collectWellFormedErrors(envelope, '$.lonWireEnvelope');
  if (wfErrors.length > 0) {
    throw new TypeError(wfErrors[0]);
  }
  return envelope;
}

function parseLonWireEnvelope(raw: unknown): LonWireEnvelope085 | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const cand = raw as Partial<LonWireEnvelope085>;
  if (cand.spec !== STANDARDS_SPEC_VERSION || typeof cand.lonTurn !== 'string') return null;
  if (collectWellFormedErrors(cand).length > 0) return null;
  return {
    spec: STANDARDS_SPEC_VERSION,
    lonTurn: cand.lonTurn,
    ...(typeof cand.headHash === 'string' ? { headHash: cand.headHash } : {}),
    ...(cand.block ? { block: { ...cand.block } } : {}),
    ...(Array.isArray(cand.diagnostics) ? { diagnostics: cand.diagnostics.map((d) => ({ ...d })) } : {}),
    ...(Array.isArray(cand.propagatedFixes) ? { propagatedFixes: cand.propagatedFixes.map((f) => ({ ...f })) } : {}),
    ...(Array.isArray(cand.openConflicts)
      ? { openConflicts: cand.openConflicts.map((c) => ({ ...c, evidenceIds: [...c.evidenceIds] })) }
      : {}),
    ...(typeof cand.mukWeight === 'number' && Number.isFinite(cand.mukWeight) ? { mukWeight: cand.mukWeight } : {}),
    ...(typeof cand.bundleHash === 'string' ? { bundleHash: cand.bundleHash } : {}),
    ...(cand.extra && typeof cand.extra === 'object' && !Array.isArray(cand.extra) ? { extra: { ...cand.extra } } : {}),
  };
}

/**
 * MCP `CallToolResult`의 `content`와 `structuredContent`를 일절 변형하지 않고
 * `_meta['lon/0.8.5']` 슬롯에만 결정론적 `lon 0.8.5` 계보·검증 메타데이터를 부착한다.
 */
export function wrapMcpToolResult<T extends McpToolResultLike>(
  result: T,
  lonTurn: LonTurnInput,
  bundleMeta: LonWireMetaInput = {},
): WrappedMcpToolResult<T> {
  const envelope = buildLonWireEnvelope(lonTurn, bundleMeta);
  const nextMeta: Record<string, unknown> & { [LON_WIRE_KEY]: LonWireEnvelope085 } = {
    ...(result._meta ?? {}),
    [LON_WIRE_KEY]: envelope,
  };
  return {
    ...result,
    _meta: nextMeta,
  } as WrappedMcpToolResult<T>;
}

/**
 * MCP `CallToolResult`에서 `_meta['lon/0.8.5']` 봉투를 분리하고,
 * 원본 `content`·`structuredContent` 및 타 프로토콜 `_meta` 키를 손실 없이 복원한다.
 */
export function unwrapMcpToolResult<T extends McpToolResultLike>(
  wrapped: T,
): UnwrappedMcpToolResult<T> {
  const rawMeta = wrapped._meta;
  if (!rawMeta || typeof rawMeta !== 'object' || !(LON_WIRE_KEY in rawMeta)) {
    return { result: { ...wrapped }, lon: null };
  }
  const lon = parseLonWireEnvelope(rawMeta[LON_WIRE_KEY]);
  const restMeta: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawMeta)) {
    if (k !== LON_WIRE_KEY && !UNSAFE_OBJECT_KEYS.has(k)) {
      setSafeOwnProp(restMeta, k, v);
    }
  }
  const clone: Record<string, unknown> = { ...wrapped };
  if (Object.keys(restMeta).length > 0) {
    clone._meta = restMeta;
  } else {
    delete clone._meta;
  }
  return {
    result: clone as T,
    lon,
  };
}

/**
 * A2A `Artifact`의 `parts` 등 페이로드를 변형하지 않고
 * `metadata['lon/0.8.5']` 슬롯에만 결정론적 `lon 0.8.5` 계보·검증 메타데이터를 부착한다.
 */
export function wrapA2aArtifact<T extends A2aArtifactLike>(
  artifact: T,
  lonTurn: LonTurnInput,
  bundleMeta: LonWireMetaInput = {},
): WrappedA2aArtifact<T> {
  const envelope = buildLonWireEnvelope(lonTurn, bundleMeta);
  const nextMetadata: Record<string, unknown> & { [LON_WIRE_KEY]: LonWireEnvelope085 } = {
    ...(artifact.metadata ?? {}),
    [LON_WIRE_KEY]: envelope,
  };
  return {
    ...artifact,
    metadata: nextMetadata,
  } as WrappedA2aArtifact<T>;
}

/**
 * A2A `Artifact`에서 `metadata['lon/0.8.5']` 봉투를 분리하고,
 * 원본 `parts` 및 타 프로토콜 `metadata` 키를 손실 없이 복원한다.
 */
export function unwrapA2aArtifact<T extends A2aArtifactLike>(
  wrapped: T,
): UnwrappedA2aArtifact<T> {
  const rawMetadata = wrapped.metadata;
  if (!rawMetadata || typeof rawMetadata !== 'object' || !(LON_WIRE_KEY in rawMetadata)) {
    return { artifact: { ...wrapped }, lon: null };
  }
  const lon = parseLonWireEnvelope(rawMetadata[LON_WIRE_KEY]);
  const restMetadata: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rawMetadata)) {
    if (k !== LON_WIRE_KEY && !UNSAFE_OBJECT_KEYS.has(k)) {
      setSafeOwnProp(restMetadata, k, v);
    }
  }
  const clone: Record<string, unknown> = { ...wrapped };
  if (Object.keys(restMetadata).length > 0) {
    clone.metadata = restMetadata;
  } else {
    delete clone.metadata;
  }
  return {
    artifact: clone as T,
    lon,
  };
}
