// 결 v0.8 및 론(Lon: Lineage Oriented Notation) 쓰기 규칙 (2026-11-11 Jae).
// 다단계 사후 패치 사슬(rules04 → 05 → 051 → 06 → 065 → 07)과 분리된 선언형 단일 검사기다.
// 옛 쓰기 규칙(rules04부터 rules07)과 보관 줄 196개 판정은 그대로 보존한다.
//
// 핵심 정리(2026-11-11 Jae 결정):
//   1. <N · 고정 표기(E25): 모든 절 번호 바로 뒤에 화자 점(·)을 괄호처럼 고정한다.
//      혼자 <1 · […]>, 지목 <1 ·→이름 […]>, 모두 <1 · ● […]>(읽기는 ·→●··●도 수용해 정규형 <1 · ● […]>로 모은다).
//      v0.7의 <1 ● […]>처럼 ·을 빠뜨리면 E25로 잡아 E18(점이 둘이다) 오류 원인을 원천 제거한다.
//   2. E34 완화: 새 화두(top·갑)는 뒤따르는 절이 ↓N으로 근거 삼을 수 있다. E34는 직감(gut·촉) 절에만 적용한다.
//      받침(sup→N, W36)은 직감(gut)과 새 화두(top) 모두 받칠 수 있다.
//   3. E15 폐지: 한 어절 안 한글 꼬리 뒤 한자 금지(v0.2 초기 유산)는 parse(..., { v08: true }) 및 0.8 머리 줄에서 해제한다.
//   4. *먹채(E33·W38) 공통 보존: 결(gyeol)과 론(lon) 모두 끝에 *먹채(*5B8 등)를 그대로 쓴다.
//      채의 색(RGBCMYK)은 어떤 외부 의미나 단서도 정의하지 않는 원시 귀납 신호로 보존한다.
//   5. 다언어 어근(W29): 본래 결(profile 'gyeol')에서는 현행 경고(W29) 그대로 유지하고(오류 격상 안 함),
//      산업용 검증·분석·추적 표준 프로파일 론(profile 'lon')에서는 W29·W32를 면제한다.
//   6. 론(Lon) 표지 집합(E39·W26): 근거 5종(see·rec·inf·gut·if), 결 1종(lim), 시제 2종(pst·fut), 화행 7종(say·ask·req·let·vow·nay·ack),
//      앞붙이 ↔·↖·fix→·err→·sup→ 및 끝 근거 ↓만 허용하고 영어 3글자 정본 표지를 쓴다(top·new·met·pdx 등은 E39).

import type { CalcBlock, Clause, Diagnostic, ExtEvidence, ParseResult, Profile, Word } from '../types.ts';
import {
  evaluateCalcExpression,
  extractNumbersFromClause,
  extractNumbersFromText,
  extractPrimaryNumeric,
  numbersMatch,
  splitCalcExpression,
} from '../calc.ts';
import { computeClauseLattice, type LedgerContext, type LedgerEpistemicLattice } from '../ledger.ts';
import {
  LON_ACT,
  LON_EV,
  LON_FIG,
  LON_PROCESS,
  LON_TENSE,
  SHORT_ALIASES_07,
  TO_MAX,
  markOf07,
  scriptGroupOf,
  scriptGroupOfChar,
  tierOfCode,
  type ScriptGroup,
} from '../tables.ts';

export interface Rules08Options {
  sender?: string | null;
  from?: number;
  lang?: string | null;
  ink?: number | null;
  profile?: Profile | null;
  spec?: '0.7' | '0.8' | '0.8.2' | '0.8.5';
  mode?: 'delta' | 'snapshot';
  priorClauses?: readonly Clause[];
  priorEvidences?: readonly ExtEvidence[];
  /** 선택적 원장 컨텍스트(미전달 시에도 priorClauses로부터 계보·충돌·격자 상태를 결정론적으로 복원) */
  ledger?: LedgerContext;
  issued?: readonly string[];
  /** 게이트웨이 참조 복사(ref_copy)가 이미 해당 줄 범위만 잘라 주입했으면 true */
  preSlicedExt?: boolean;
  /** 통째(snapshot) 이어쓰기 검사: <1부터 연번 확인(W45) 및 see 근거 없음 경고(W40) 활성화 */
  snapshot?: boolean;
}

export function mixesScripts(words: Word[], group: ScriptGroup): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  if (counted.length < 2) return true;
  return counted.some((ls) => ls.some((ch) => scriptGroupOfChar(ch) !== group));
}

export function hasUserScript(words: Word[], group: ScriptGroup): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  if (counted.length < 2) return true;
  return counted.some((ls) => ls.some((ch) => scriptGroupOfChar(ch) === group));
}

const INLINE_GLOSS = /[(（]\s*[a-z]{2}(?:\s*[)）]|\s+\p{Script=Hangul})/u;
const BACKABLE_EV: ReadonlySet<string> = new Set(['gut', 'top']);
const ASCII_ID_RE = /^[A-Za-z0-9_.:-]+$/;
// v0.8.2 · v0.8.5: 한 글자 단위(s·h·b·k·m·g·w·v·a·l)는 수에 바로 붙었을 때만 단위로 읽는다('3 a test'의 a는 낱말).
const UNIT_MULTI =
  'l/min|l/hr|l/h|l/s|ml/min|units/h|units/hr|percent|퍼센트|%|samples|sample|minutes|seconds|hours|hrs|hr|min|sec|ms|us|µs|ns|mbar|bar|mpa|kpa|pa|psi|gwh|mwh|kwh|gw|mw|kw|wh|kv|mv|ma|ghz|mhz|khz|hz|tb|gb|mb|kb|km|cm|mm|ml|kg|mg|ug|µg|℃|°c|°f|ppm|ppb|bps|slots|lines|units|초|분|시간';
const UNIT_SINGLE = 's|h|b|k|m|g|w|v|a|l';
// 부호 글자 집합 안의 줄표를 이스케이프해 숫자가 부호로 먹히지 않게 한다.
const NUM_UNIT_RE = new RegExp(
  `(?<![A-Za-z0-9_])([+\\-−])?(\\d+(?:[.,]\\d+)?)(?:\\s*(${UNIT_MULTI})|(${UNIT_SINGLE}))(?![A-Za-z0-9_])`,
  'giu',
);
const CODE_ID_RE = /\b[A-Za-z]{1,12}[-_][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\b/gu;
const TAG_STRIP_RE = /(?:^|\s)(?:(?:evd|ref|calc|Q|T)\d+(?:\.\d+)?|(?:증|근|식)\d+(?:\.\d+)?)[가-힣]*/giu;

function canonUnit(u: string): string {
  const l = u.toLowerCase();
  if (l === '퍼센트' || l === 'percent') return '%';
  if (l === 'sec' || l === 'seconds' || l === '초') return 's';
  if (l === 'minutes' || l === '분') return 'min';
  if (l === 'hr' || l === 'hrs' || l === 'hours' || l === '시간') return 'h';
  if (l === 'l/hr') return 'l/h';
  if (l === 'units/hr') return 'units/h';
  if (l === 'sample') return 'samples';
  if (l === '℃' || l === '°c') return 'c';
  if (l === '°f') return 'f';
  if (l === 'µs') return 'us';
  if (l === 'µg') return 'ug';
  return l;
}

// v0.8.2 재검토(2026-11-13): 한글 비교어는 수(와 단위) 바로 뒤에 올 때만 비교어로 읽는다('이상하다'·'이하 생략'은 낱말).
const KO_CMP_LOW_RE = new RegExp(`\\d(?:[.,]\\d+)?\\s*(?:(?:${UNIT_MULTI})|(?:${UNIT_SINGLE}))?\\s*(?:이하|미만)`, 'iu');
const KO_CMP_HIGH_RE = new RegExp(`\\d(?:[.,]\\d+)?\\s*(?:(?:${UNIT_MULTI})|(?:${UNIT_SINGLE}))?\\s*(?:이상|초과)`, 'iu');

function cmpDir(s: string): { hasLow: boolean; hasHigh: boolean } {
  const hasLow = /<=|≤/u.test(s) || KO_CMP_LOW_RE.test(s) || /(?:^|[^<=\d])<(?!<|=)/u.test(s);
  const hasHigh = />=|≥/u.test(s) || KO_CMP_HIGH_RE.test(s) || /(?:^|[^>=])>(?!>|=)/u.test(s);
  return { hasLow, hasHigh };
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

interface ProvenGroundContext {
  nums: number[];
  blob: string;
  hasOpaqueGround: boolean;
}

function numberPatternOf(numNorm: string): RegExp {
  const esc = escRe(numNorm);
  const numWithComma = /\d{4,}/.test(numNorm) ? numNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : null;
  const escPat = numWithComma ? `(?:${esc}|${escRe(numWithComma)})` : esc;
  return new RegExp(`(?<!\\d)${escPat}(?!\\d)`, 'u');
}

function checkGhostW43(bodyText: string, evdBlob: string, provenCtx?: ProvenGroundContext): string | null {
  const clean = bodyText.replace(/`[^`]*`/gu, ' ').replace(TAG_STRIP_RE, ' ');
  NUM_UNIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUM_UNIT_RE.exec(clean))) {
    const [, sign, rawNum, unitMulti, unitSingle] = m;
    const rawUnit = unitMulti ?? unitSingle;
    const numNorm = rawNum.replace(/,/g, '');
    const esc = escRe(numNorm);
    const numWithComma = /\d{4,}/.test(numNorm) ? numNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : null;
    const escPat = numWithComma ? `(?:${esc}|${escRe(numWithComma)})` : esc;
    const numRe = new RegExp(`(?<!\\d)${escPat}(?!\\d)`, 'u');

    if (provenCtx) {
      const absVal = Number(numNorm);
      const signedVal = (sign === '-' || sign === '−' ? -1 : 1) * absVal;
      const alreadyProven =
        (Number.isFinite(absVal) &&
          provenCtx.nums.some((p) => numbersMatch(p, absVal) || numbersMatch(p, signedVal))) ||
        (provenCtx.blob !== '' && numRe.test(provenCtx.blob));
      if (alreadyProven || provenCtx.hasOpaqueGround) continue;
    }

    if (!numRe.test(evdBlob)) return `외부 근거에 없는 수치 '${rawNum}'`;
    if (sign === '+') {
      const hasNeg = new RegExp(`[-−]\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      const hasPos = new RegExp(`\\+\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      if (hasNeg && !hasPos) return `외부 근거와 수치 부호가 다르다('${sign}${rawNum}')`;
    } else if (sign === '-' || sign === '−') {
      const hasPos = new RegExp(`(?:^|[^-−\\d])${escPat}(?!\\d)`, 'u').test(evdBlob);
      const hasNeg = new RegExp(`[-−]\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      if (hasPos && !hasNeg) return `외부 근거와 수치 부호가 다르다('${sign}${rawNum}')`;
    }
    const wantUnit = canonUnit(rawUnit);
    const evUnitRe = new RegExp(`(?<!\\d)${escPat}(?:\\s*(${UNIT_MULTI})|(${UNIT_SINGLE}))(?![A-Za-z0-9_])`, 'giu');
    const foundUnits = [...evdBlob.matchAll(evUnitRe)].map((um) => canonUnit(um[1] ?? um[2]));
    if (foundUnits.length > 0 && !foundUnits.includes(wantUnit)) {
      return `외부 근거와 단위가 다르다('${rawNum}${rawUnit}')`;
    }
  }
  if (!provenCtx || (!provenCtx.hasOpaqueGround && provenCtx.blob === '')) {
    const cd = cmpDir(clean);
    const ed = cmpDir(evdBlob);
    if (((cd.hasHigh && !cd.hasLow) && (ed.hasLow && !ed.hasHigh)) || ((cd.hasLow && !cd.hasHigh) && (ed.hasHigh && !ed.hasLow))) {
      return '외부 근거와 비교 방향이 반대다';
    }
  }
  const evLower = evdBlob.toLowerCase();
  const provenLower = provenCtx?.blob.toLowerCase() ?? '';
  for (const idm of clean.matchAll(CODE_ID_RE)) {
    const id = idm[0];
    if (provenCtx) {
      if (provenCtx.hasOpaqueGround || provenLower.includes(id.toLowerCase())) continue;
    }
    if (!evLower.includes(id.toLowerCase())) return `외부 근거에 없는 식별자 '${id}'`;
  }
  return null;
}

function byNumber(clauses: readonly Clause[], priorClauses: readonly Clause[] = []): Map<string, Clause> {
  const m = new Map<string, Clause>();
  priorClauses.forEach((c, i) => {
    const n = (c.label ?? `절${i + 1}`).slice(1);
    if (!m.has(n)) m.set(n, c);
  });
  const curr = new Map<string, Clause>();
  clauses.forEach((c, i) => {
    const n = (c.label ?? `절${priorClauses.length + i + 1}`).slice(1);
    if (!curr.has(n)) curr.set(n, c);
  });
  for (const [k, v] of curr) m.set(k, v);
  return m;
}

function canonMarks(c: Clause): string {
  const m = c.marks;
  return `[${[m.ev, m.news ? 'new' : undefined, m.fig, m.tense, m.act].filter(Boolean).join(',')}]`;
}

/**
 * 봄의 닿음(W40, 2026-11-12 Jae, 3.22절): 본 것(see) 절이 근거를 따라가 바깥 출처에 닿는가.
 * - 바로 닿음: 맥락 ↓T, 받은 자료 ↓evd, 가져온 자료 ↓ref, 주소, 참가자 ↓@, 지난 대화 ↓53:12, 옛 ↓Q.
 * - 절을 가리킨 것(끝 ↓N, 앞 ↓N, ↖N, ↔N): 앞 차례의 절이거나 이 글에서 찾지 못한 절이면 남의 말을 본 것으로 닿음,
 *   이 차례 안의 see 절이면 그 절이 닿을 때만 닿음(순환은 막는다), rec·inf·gut·if·top 절은 닿지 않음.
 * 'ok' 닿음, 'none' 근거가 하나도 없음(t1 꼴), 'inferred' 절 근거가 있으나 추론·직감·가정에서 끊김(t3 꼴).
 */
export function seeReach(
  c: Clause,
  clauses: Clause[],
  nums: Map<string, Clause>,
  from: number,
  seen: Set<Clause> = new Set(),
  priorSet?: ReadonlySet<Clause>,
): 'ok' | 'none' | 'inferred' {
  seen.add(c);
  const because = c.because ?? [];
  if (because.some((b) => !('label' in b))) return 'ok';
  const refs = [
    ...because.filter((b): b is Extract<typeof b, { label: string }> => 'label' in b),
    ...(c.places?.length ? c.places : c.place ? [c.place] : [])
      .filter((p) => p.rel === '↓' || p.rel === '↖' || p.rel === '↔')
      .map((p) => p.target),
  ];
  if (!refs.length) return 'none';
  let sawNone = false;
  for (const g of refs) {
    if (g.msg !== null || g.thread !== undefined) return 'ok';
    const t = nums.get(g.label.slice(1));
    if (!t) return 'ok';
    if (priorSet?.has(t)) return 'ok';
    const at = clauses.indexOf(t);
    if (at !== -1 && at < from) return 'ok';
    if (t === c || seen.has(t)) continue;
    if (t.marks.ev === 'see') {
      const sub = seeReach(t, clauses, nums, from, seen, priorSet);
      if (sub === 'ok') return 'ok';
      if (sub === 'none') sawNone = true;
    }
  }
  return sawNone ? 'none' : 'inferred';
}

export function rules08(r: ParseResult, opts: Rules08Options = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const profile: Profile = opts.profile ?? r.message.profile ?? 'gyeol';
  const isLon = profile === 'lon';
  const isSnapshot = Boolean(opts.snapshot ?? (opts.mode === 'snapshot' || r.message.head?.snapshot || r.message.head?.mode === 'snapshot'));
  const sender = opts.sender ? String(opts.sender).toLowerCase() : null;
  const ink = opts.ink == null ? NaN : Number(opts.ink);
  const inkKnown = Number.isInteger(ink) && ink >= 0 && ink <= 9;
  const lang = opts.lang ?? r.message.lang ?? null;
  const group = scriptGroupOf(lang);
  const clauses = r.message.clauses;
  const priorClauses = opts.priorClauses ?? [];
  const priorSet = priorClauses.length ? new Set(priorClauses) : undefined;
  const start = priorClauses.length ? 0 : (opts.from ?? 0);
  const nums = byNumber(clauses, priorClauses);

  // W43용 외부 근거 원문 색인 및 W44용 무효·철회 절 집합
  const extTextMap = new Map<string, string[]>();
  const addExtText = (kind: string, id: string, text: string) => {
    const k = `${kind}:${id}`;
    const arr = extTextMap.get(k) ?? [];
    arr.push(text);
    extTextMap.set(k, arr);
  };
  for (const ev of opts.priorEvidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ac of priorClauses) for (const ev of ac.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ev of r.message.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ac of clauses) for (const ev of ac.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  if (opts.ledger) {
    for (const [k, ev] of opts.ledger.evidencesByKey) {
      if (!extTextMap.has(k)) extTextMap.set(k, [ev.text]);
    }
  }

  const allClauses = priorClauses.length ? [...priorClauses, ...clauses] : clauses;
  const allLabels = new Set<string>();
  allClauses.forEach((ac, idx) => {
    allLabels.add(ac.label ?? `절${idx + 1}`);
    if (!ac.label) allLabels.add(`점${idx + 1}`);
  });
  const allExt = new Set<string>(extTextMap.keys());
  for (const raw of opts.issued ?? []) {
    const im = /^(?:증|evd)([0-9０-９]+(?:\.[0-9０-９]+)?)$/iu.exec(String(raw ?? '').trim());
    if (im) allExt.add(`evd:${im[1].replace(/[０-９]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))}`);
  }
  const hasLabel = (lbl: string) => {
    const alt = (lbl.startsWith('절') ? '점' : '절') + lbl.slice(1);
    return allLabels.has(lbl) || allLabels.has(alt);
  };

  // calcN 색인 및 O(1) 재귀 평가 도우미 (priorClauses + 현재 메시지 + 선택적 ledger 통합)
  const calcById = new Map<string, CalcBlock>();
  if (opts.ledger) {
    for (const [id, cb] of opts.ledger.calcsById) calcById.set(id, cb);
  }
  for (const ac of priorClauses) for (const cb of ac.calcs ?? []) calcById.set(cb.id, cb);
  for (const cb of r.message.calcs ?? []) calcById.set(cb.id, cb);
  for (const ac of clauses) for (const cb of ac.calcs ?? []) calcById.set(cb.id, cb);

  // 계보·대체·철회·미해결 맞섬(↔) 시점별 상태 복원 (opts.ledger 없이 priorClauses만으로도 100% 동일 복원)
  interface ReconstructedNodeState {
    num: string;
    clause: Clause;
    createdAt: number;
    supersededAt?: number;
    supersededBy?: string;
    retractedAt?: number;
    retractedBy?: string;
    fixTargetAtWrite?: { targetNum: string; status: 'active' | 'superseded' | 'retracted'; latestActive: string };
  }
  interface ReconstructedConflict {
    clauseNum: string;
    targetNum: string;
    createdAt: number;
    resolvedAt?: number;
  }

  const nodeStateByNum = new Map<string, ReconstructedNodeState>();
  const conflictsTimeline: ReconstructedConflict[] = [];
  if (opts.ledger && priorClauses.length === 0) {
    for (const [num, ent] of opts.ledger.clausesByNum) {
      nodeStateByNum.set(num, {
        num,
        clause: ent.clause,
        createdAt: -2,
        ...(ent.supersededBy ? { supersededAt: -1, supersededBy: ent.supersededBy } : {}),
        ...(ent.retractedBy ? { retractedAt: -1, retractedBy: ent.retractedBy } : {}),
      });
      if (!nums.has(num)) nums.set(num, ent.clause);
    }
    for (const oc of opts.ledger.unresolvedConflicts()) {
      conflictsTimeline.push({ clauseNum: oc.clauseNum, targetNum: oc.targetNum, createdAt: -1 });
    }
  }

  const latestActiveInTimeline = (rawNum: string, beforeIdx: number): string => {
    let cur = rawNum;
    const seen = new Set<string>([cur]);
    while (true) {
      const st = nodeStateByNum.get(cur);
      if (
        !st ||
        st.supersededAt === undefined ||
        st.supersededAt >= beforeIdx ||
        !st.supersededBy ||
        seen.has(st.supersededBy)
      ) {
        break;
      }
      seen.add(st.supersededBy);
      cur = st.supersededBy;
    }
    return cur;
  };

  const isNodeActiveBefore = (num: string, beforeIdx: number): boolean => {
    const st = nodeStateByNum.get(num);
    if (!st || st.createdAt >= beforeIdx) return false;
    if (st.retractedAt !== undefined && st.retractedAt < beforeIdx) return false;
    if (st.supersededAt !== undefined && st.supersededAt < beforeIdx) return false;
    return true;
  };

  allClauses.forEach((ac, idx) => {
    const acNum = (ac.label ?? `절${idx + 1}`).replace(/^[절점]/u, '');
    let node = nodeStateByNum.get(acNum);
    const isDuplicateCarry = node !== undefined;
    if (!node) {
      node = { num: acNum, clause: ac, createdAt: idx };
      nodeStateByNum.set(acNum, node);
    }
    if (!isDuplicateCarry && ac.process?.target && ac.process.target.msg === null && ac.process.target.thread === undefined) {
      const tNum = ac.process.target.label.replace(/^[절점]/u, '');
      const tNode = nodeStateByNum.get(tNum);
      if (tNode && tNode.createdAt < idx) {
        if (ac.process.kind === 'fix') {
          if (tNode.retractedAt !== undefined && tNode.retractedAt < idx) {
            node.fixTargetAtWrite = { targetNum: tNum, status: 'retracted', latestActive: tNum };
          } else if (tNode.supersededAt !== undefined && tNode.supersededAt < idx) {
            const pLat = latestActiveInTimeline(tNum, idx);
            node.fixTargetAtWrite = { targetNum: tNum, status: 'superseded', latestActive: pLat };
            const latNode = nodeStateByNum.get(pLat);
            if (latNode && latNode.retractedAt === undefined && latNode.supersededAt === undefined && pLat !== acNum) {
              latNode.supersededAt = idx;
              latNode.supersededBy = acNum;
            }
          } else {
            node.fixTargetAtWrite = { targetNum: tNum, status: 'active', latestActive: tNum };
            tNode.supersededAt = idx;
            tNode.supersededBy = acNum;
          }
          const resolvedLat = node.fixTargetAtWrite.latestActive;
          for (const cf of conflictsTimeline) {
            if (
              cf.resolvedAt === undefined &&
              (cf.clauseNum === tNum || cf.targetNum === tNum || cf.clauseNum === resolvedLat || cf.targetNum === resolvedLat)
            ) {
              cf.resolvedAt = idx;
            }
          }
        } else if (ac.process.kind === 'err') {
          if (tNode.supersededAt !== undefined && tNode.supersededAt < idx && tNode.retractedAt === undefined) {
            const pLat = latestActiveInTimeline(tNum, idx);
            const latNode = nodeStateByNum.get(pLat);
            if (latNode && latNode.retractedAt === undefined && pLat !== acNum) {
              latNode.retractedAt = idx;
              latNode.retractedBy = acNum;
            }
          } else if (tNode.retractedAt === undefined) {
            tNode.retractedAt = idx;
            tNode.retractedBy = acNum;
          }
          for (const cf of conflictsTimeline) {
            if (cf.resolvedAt === undefined && (cf.clauseNum === tNum || cf.targetNum === tNum)) {
              cf.resolvedAt = idx;
            }
          }
        }
      }
    }

    if (!isDuplicateCarry) {
      const pls = ac.places?.length ? ac.places : ac.place ? [ac.place] : [];
      if (ac.marks.act === 'ack') {
        const ackTargets = new Set<string>();
        for (const pl of pls) {
          if (pl.target.msg === null && pl.target.thread === undefined) {
            ackTargets.add(pl.target.label.replace(/^[절점]/u, ''));
          }
        }
        for (const b of ac.because ?? []) {
          if ('label' in b && b.msg === null && b.thread === undefined) {
            ackTargets.add(b.label.replace(/^[절점]/u, ''));
          }
        }
        for (const cf of conflictsTimeline) {
          if (cf.resolvedAt === undefined && (ackTargets.has(cf.clauseNum) || ackTargets.has(cf.targetNum))) {
            cf.resolvedAt = idx;
          }
        }
      }
      for (const pl of pls) {
        if (pl.rel === '↔' && pl.target.msg === null && pl.target.thread === undefined) {
          const tNum = pl.target.label.replace(/^[절점]/u, '');
          if (tNum && tNum !== acNum && nodeStateByNum.has(tNum)) {
            if (!conflictsTimeline.some((cf) => cf.clauseNum === acNum && cf.targetNum === tNum && cf.resolvedAt === undefined)) {
              conflictsTimeline.push({ clauseNum: acNum, targetNum: tNum, createdAt: idx });
            }
          }
        }
      }
    }
  });

  const isInUnresolvedConflictAt = (num: string, beforeIdx: number): boolean => {
    for (const cf of conflictsTimeline) {
      if (cf.createdAt >= beforeIdx) continue;
      if (cf.resolvedAt !== undefined && cf.resolvedAt < beforeIdx) continue;
      if (cf.clauseNum !== num && cf.targetNum !== num) continue;
      if (isNodeActiveBefore(cf.clauseNum, beforeIdx) && isNodeActiveBefore(cf.targetNum, beforeIdx)) return true;
    }
    return false;
  };

  // 절별 수식 평가 캐시
  const calcValueCache = new Map<string, number | null>();
  const calcVisiting = new Set<string>();
  const findDirectCalcOfClause = (c: Clause | undefined): CalcBlock | undefined => {
    if (!c) return undefined;
    if (c.calcs?.length) return c.calcs[0];
    for (const b of c.because ?? []) {
      if ('calc' in b) {
        const found = calcById.get(b.calc);
        if (found) return found;
      }
    }
    return undefined;
  };
  const findCalcOfClause = (c: Clause | undefined): CalcBlock | undefined => {
    if (!c) return undefined;
    const direct = findDirectCalcOfClause(c);
    if (direct) return direct;
    if (c.process?.kind !== 'fix' || !c.process.target) return undefined;
    const seen = new Set<string>();
    const queue: string[] = [c.process.target.label.replace(/^[절점]/u, '')];
    const startNum = (c.label ?? '').replace(/^[절점]/u, '');
    if (startNum && opts.ledger) {
      for (const anc of opts.ledger.lineageAncestorsOf(startNum)) {
        if (!queue.includes(anc)) queue.push(anc);
      }
    }
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (!cur || seen.has(cur)) continue;
      seen.add(cur);
      const ancClause = nums.get(cur) ?? opts.ledger?.getClause(cur)?.clause;
      const hit = findDirectCalcOfClause(ancClause);
      if (hit) return { id: hit.id, expr: splitCalcExpression(hit.expr).expr };
      if (ancClause?.process?.kind === 'fix' && ancClause.process.target) {
        const nxt = ancClause.process.target.label.replace(/^[절점]/u, '');
        if (nxt && !seen.has(nxt)) queue.push(nxt);
      }
    }
    return undefined;
  };
  const resolveClauseNumericAt = (rawNum: string, beforeIdx: number): number | null => {
    const num = latestActiveInTimeline(rawNum, beforeIdx);
    const cacheKey = `${num}@${beforeIdx}`;
    if (calcValueCache.has(cacheKey)) return calcValueCache.get(cacheKey)!;
    if (calcVisiting.has(num)) return null;
    const cTarget = nums.get(num) ?? nums.get(rawNum);
    if (!cTarget) return null;
    calcVisiting.add(num);
    let val: number | null = null;
    const cb = findCalcOfClause(cTarget);
    if (cb) {
      const ev = evaluateCalcExpression(cb.expr, (ref) => resolveClauseNumericAt(ref, beforeIdx));
      if (ev.ok && ev.value !== undefined) val = ev.value;
    }
    if (val === null) val = extractPrimaryNumeric(cTarget);
    calcVisiting.delete(num);
    calcValueCache.set(cacheKey, val);
    return val;
  };

  const clauseProvenBlob = (target: Clause): { nums: number[]; blob: string } => {
    const body = target.words.map((wd) => wd.text).join(' ');
    const blobs: string[] = [body];
    for (const ev of target.evidences ?? []) blobs.push(ev.text);
    for (const b of target.because ?? []) {
      if ('ext' in b) {
        const texts = extTextMap.get(`${b.ext}:${b.id}`);
        if (texts) blobs.push(...texts);
      }
    }
    const combined = blobs.join('\n');
    const extracted = [...extractNumbersFromClause(target), ...extractNumbersFromText(combined)];
    return { nums: extracted, blob: combined };
  };

  const badGrounds = new Map<string, number>();
  const markBad = (num: string, idx: number) => {
    const prev = badGrounds.get(num);
    if (prev === undefined || idx < prev) badGrounds.set(num, idx);
  };
  allClauses.forEach((ac, idx) => {
    const acNum = (ac.label ?? `절${idx + 1}`).slice(1);
    if (ac.process?.kind === 'err' && ac.process.target.msg === null && ac.process.target.thread === undefined) {
      markBad(ac.process.target.label.replace(/^[절점]/u, ''), idx);
    }
    const acGrounds = [...(ac.because ?? []).filter((b) => 'label' in b), ...(ac.place?.rel === '↓' ? [ac.place.target] : [])];
    for (const g of acGrounds) {
      if (g.msg !== null || g.thread !== undefined) continue;
      const t = nums.get(g.label.slice(1));
      if (t && t !== ac && (t.marks.ev === 'gut' || (opts.spec === '0.7' && t.marks.ev === 'top'))) {
        markBad(acNum, idx);
      }
    }
    const pls = ac.places?.length ? ac.places : ac.place ? [ac.place] : [];
    const localRefs = [ac.process?.target, ...pls.flatMap((p) => [p.target, p.second]), ...(ac.because ?? []).filter((b) => 'label' in b)];
    for (const ref of localRefs) {
      if (ref && ref.msg === null && ref.thread === undefined && !hasLabel(ref.label)) {
        markBad(acNum, idx);
      }
    }
    for (const b of ac.because ?? []) {
      if ('ext' in b && !allExt.has(`${b.ext}:${b.id}`)) markBad(acNum, idx);
    }
  });

  // 0. 머리 줄 식별자 ASCII 확인(E44, spec 0.7 제외)
  if (opts.spec !== '0.7' && r.message.head && start === 0) {
    const h = r.message.head;
    if (h.from && !ASCII_ID_RE.test(h.from)) {
      out.push({
        code: 'E44',
        severity: '오류',
        tier: tierOfCode('E44'),
        line: 1,
        message: `식별자에 비ASCII 문자가 있다('${h.from}'). ASCII 영숫자·기호만 쓴다: 머리`,
      });
    }
    for (const toId of h.to ?? []) {
      if (!ASCII_ID_RE.test(toId)) {
        out.push({
          code: 'E44',
          severity: '오류',
          tier: tierOfCode('E44'),
          line: 1,
          message: `식별자에 비ASCII 문자가 있다('${toId}'). ASCII 영숫자·기호만 쓴다: 머리`,
        });
      }
    }
  }

  for (let k = start; k < clauses.length; k++) {
    const c = clauses[k];
    const w = r.written?.[k];
    const where = c.label ?? `절 ${k + 1}째`;
    const absIdx = priorClauses.length + k;
    const cNum = (c.label ?? `절${absIdx + 1}`).replace(/^[절점]/u, '');
    const push = (code: string, message: string) =>
      out.push({ code, severity: code.startsWith('E') ? '오류' : '경고', tier: tierOfCode(code), line: k + 1, message: `${message}: ${where}` });

    if (r.forms[k] !== '0.3') {
      push('E26', '옛 꼴은 v0.8에서 쓰지 않는다. <1 · [see,say] 내용 *5B8>로 쓴다');
      continue;
    }

    // 1. 모든 절 번호 바로 뒤 점(·) 고정(<1 · …>, <1 ·→이름 …>, <1 · ● …>)
    if (!c.me) {
      push('E25', '점(·) 자리가 없다. 절 번호 바로 뒤에 ·(혼자), ·→이름(지목), · ●(모두)로 고정해 쓴다');
    } else if (c.all && !w?.hasDot && opts.spec !== '0.7') {
      push('E25', '점(·) 자리가 빠졌다. v0.8에서는 모두에게 말할 때도 절 번호 바로 뒤에 · ●로 고정해 쓴다');
    }

    // 2. 받는 이·참가자 식별자 검사(E44 ASCII, 자기 지목 W23, 다중 지목 W35)
    if (opts.spec !== '0.7') {
      const recips = c.toList ?? (c.to ? [c.to] : []);
      for (const id of recips) {
        if (!ASCII_ID_RE.test(id)) push('E44', `식별자에 비ASCII 문자가 있다(→${id}). ASCII 영숫자·기호만 쓴다`);
      }
      for (const b of c.because ?? []) {
        if ('agent' in b && !ASCII_ID_RE.test(b.agent)) {
          push('E44', `식별자에 비ASCII 문자가 있다(↓@${b.agent}). ASCII 영숫자·기호만 쓴다`);
        }
      }
    }
    if (sender && c.to && c.to.toLowerCase() === sender) {
      push('W23', `받는 이가 자기 자신이다(→${c.to}). 받는 이가 없으면 · 만 쓴다`);
    }
    if (c.toList) {
      const seen = new Set<string>();
      const dup = c.toList.filter((n) => (seen.has(n.toLowerCase()) ? true : (seen.add(n.toLowerCase()), false)));
      if (dup.length) push('W35', `다중 지목에 같은 이름이 두 번이다(${[...new Set(dup)].join(', ')})`);
      if (c.toList.length > TO_MAX) push('W35', `다중 지목은 ${TO_MAX}명까지다(${c.toList.length}명). 더 많으면 · ●(모두에게)로 쓴다`);
      if (sender) {
        for (const n of c.toList.slice(1)) {
          if (n.toLowerCase() === sender) push('W23', `받는 이가 자기 자신이다(→${n}). 받는 이가 없으면 · 만 쓴다`);
        }
      }
    }

    // 3. 표지 순서(W34)
    if (w?.marksOff) push('W34', `표지는 정규 순서 [근거,군,결,시제,화행]로 쓴다(뜻은 그대로 읽었다). 정규형은 ${canonMarks(c)}`);

    // 4. *먹채(E33) 및 먹 누락(W38) — lon 0.8.5에서는 Chae를 면제하고 확신 숫자(:N)만 검사한다 (W46은 예약 유지, 신규 안내는 W47~W49)
    const effSpec = opts.spec ?? r.message.gyeol;
    const is085Spec = effSpec !== '0.7' && effSpec !== '0.8' && effSpec !== '0.8.2';
    const isLon085Clause = c.chae === null || (isLon && is085Spec);
    const effConf = c.conf ?? (c.chae?.self !== undefined ? Math.max(0, Math.min(9, Math.round(c.chae.self * 10))) : undefined);
    if (isLon085Clause) {
      const hadLegacyChae = Boolean(w?.lonLegacyChae || c.chae?.color !== undefined);
      if (effConf === undefined && !w?.legacyChae) {
        push('E33', '확신 수(0부터 9)는 꼭 쓴다: 끝에 *:8처럼 쓴다');
      } else if (effConf !== undefined && inkKnown && c.muk?.conf === undefined && !c.muk?.unmeasured) {
        push('W38', `먹을 빠뜨렸다. 먹은 바깥에서 잰 신용 점수라 받은 그대로 쓴다: *${ink}:${effConf}`);
      }
      if (hadLegacyChae) {
        push('W47', 'lon 0.8.5에서는 채 색을 쓰지 않는다. *5:8 또는 *:8 콜론 꼬리로 정규화했다');
      }
    } else {
      if (c.chae?.color === undefined && !w?.legacyChae) {
        push('E33', '채는 꼭 쓴다: 색 하나(RGBCMYK)와 확신(0부터 9)을 끝에 *R8처럼 쓴다');
      } else if (c.chae?.color !== undefined && inkKnown && c.muk?.conf === undefined && !c.muk?.unmeasured) {
        push('W38', `먹을 빠뜨렸다. 먹은 바깥에서 잰 신용 점수라 받은 그대로 쓴다: *${ink}`);
      }
    }
    if (w?.dupTail) push('W48', '중복된 끝 묶음을 마지막 유효 꼬리로 복구했다');
    if (w?.autoAct) push('W49', 'lon 0.8.5에서 화행이 빠진 결 표지에 say를 자동 복원했다');
    if (w?.conflictFixDropped) {
      push('W51', `동일 절에 맞섬(↔)과 확정 대체·철회(${w.conflictFixDropped})를 함께 쓸 수 없어 ${w.conflictFixDropped}를 제거하고 맞섬(↔)으로 정규화했다`);
    }

    // 절에 결합된 calcN 블록 평가 결과 수집(조상 fix→ 상속 포함; W43·W50·W54 증인 판정에 공유)
    const cCalcs: CalcBlock[] = [...(c.calcs ?? [])];
    for (const b of c.because ?? []) {
      if ('calc' in b) {
        const found = calcById.get(b.calc);
        if (found && !cCalcs.includes(found)) cCalcs.push(found);
      }
    }
    if (cCalcs.length === 0 && c.process?.kind === 'fix' && c.marks.ev === 'inf') {
      const inheritedCb = findCalcOfClause(c);
      if (inheritedCb) cCalcs.push(inheritedCb);
    }
    const evaluatedCalcValues: number[] = [];
    const calcInputClauseNums = new Set<string>();
    let hasVerifiedCalc = false;
    const cExtractedNums = extractNumbersFromClause(c);
    if (cCalcs.length > 0) {
      let allCalcsClean = true;
      for (const cb of cCalcs) {
        const ev = evaluateCalcExpression(cb.expr, (ref) => resolveClauseNumericAt(ref, absIdx + 1));
        for (const depRef of ev.deps) calcInputClauseNums.add(depRef);
        if (!ev.ok || ev.value === undefined) {
          allCalcsClean = false;
          continue;
        }
        if (ev.declared !== undefined && !numbersMatch(ev.declared, ev.value)) {
          allCalcsClean = false;
          continue;
        }
        if (cExtractedNums.length > 0 && !cExtractedNums.some((n) => numbersMatch(n, ev.value!))) {
          allCalcsClean = false;
          continue;
        }
        evaluatedCalcValues.push(ev.value);
      }
      hasVerifiedCalc = allCalcsClean && evaluatedCalcValues.length > 0;
    }

    const grounds = [...(c.because ?? []).filter((b) => 'label' in b), ...(c.place?.rel === '↓' ? [c.place.target] : [])];
    const cPlaces = c.places?.length ? c.places : c.place ? [c.place] : [];
    const hasOppose = cPlaces.some((pl) => pl.rel === '↔');
    const hasAskBack = cPlaces.some((pl) => pl.rel === '↖');

    // 5. 근거 자격(E34: v0.8은 gut만 금지·top 허용, spec '0.7'은 gut·top 금지) 및 받침 대상(W36: gut·top)
    for (const g of grounds) {
      if (g.msg !== null) continue;
      const t = nums.get(g.label.slice(1));
      if (t && t !== c && (t.marks.ev === 'gut' || (opts.spec === '0.7' && t.marks.ev === 'top'))) {
        push('E34', `직감(gut·촉) 절은 아직 검증 전이라 근거가 될 수 없다: ↓${g.label.slice(1)}. 먼저 sup→${g.label.slice(1)}로 받치거나 ↔·↖로 가리킨다`);
      }
    }
    const back = c.process?.kind === 'sup' ? c.process.target : undefined;
    if (back && back.msg === null && back.thread === undefined) {
      const t = nums.get(back.label.slice(1));
      if (t && !(t.marks.ev && BACKABLE_EV.has(t.marks.ev))) {
        push('W36', `sup→${back.label.slice(1)}은 직감(gut)·새 화두(top) 절을 뒤늦게 받칠 때 쓴다. 그 밖의 절은 끝에 ↓${back.label.slice(1)}로 근거 삼는다`);
      }
    }

    // 5b. 봄의 닿음(W40): t3형(추론·직감·가정에서 끊김)은 결·론 모두, t1형(근거 없음)은 론·snapshot에서 낸다
    if (c.marks.ev === 'see') {
      const reach = seeReach(c, clauses, nums, start, new Set(), priorSet);
      if (reach === 'none' && (isLon || isSnapshot)) {
        push('W40', '본 것(see)이 바깥 출처에 닿지 않는다. ↓T(맥락)·↓evd(받은 자료)·↓ref(가져온 자료)·↖N으로 출처를 달거나, 본 것이 아니면 inf·rec로 쓴다');
      } else if (reach === 'inferred') {
        push('W40', '본 것(see)의 근거가 추론·직감·가정 절뿐이다. 본 출처를 ↓T·↓evd·↓ref·↖N으로 달거나, 본 것이 아니면 inf로 쓴다');
      }
    }

    // 5c. 철회(err→) 또는 의미 오류(E17·E34) 절 인용(W44) — ↓N과 sup→N에만 적용
    const w44Seen = new Set<string>();
    const citeRefs = [...grounds, ...(back ? [back] : [])];
    for (const ref of citeRefs) {
      if (ref.msg !== null || ref.thread !== undefined) continue;
      const n = ref.label.slice(1);
      const t = nums.get(n);
      const badAt = badGrounds.get(n);
      if (t && t !== c && badAt !== undefined && badAt < absIdx && !w44Seen.has(n)) {
        w44Seen.add(n);
        push('W44', `철회되었거나 의미 오류(E17·E34)가 있는 절을 근거·받침으로 인용했다: ${n}`);
      }
    }

    // 5d. 유령 수치·단위·부호·비교어·식별자 대조(W43) — 복합 근거(otherGrounds > 0) 시에도 선행 절·calcN으로 입증되지 않은 수치는 원문 대조 수행
    const extRefs = (c.because ?? []).filter((b): b is Extract<typeof b, { ext: 'evd' | 'ref' }> => 'ext' in b);
    const nonExtBecause = (c.because ?? []).filter((b) => !('ext' in b));
    const otherGrounds = nonExtBecause.length + (c.place?.rel === '↓' ? 1 : 0);

    const hasOpaqueGround = nonExtBecause.some(
      (b) =>
        'ctx' in b ||
        'url' in b ||
        'agent' in b ||
        'thread' in b ||
        'quiz' in b ||
        'reserved' in b ||
        ('label' in b && (b.msg !== null || b.thread !== undefined)),
    ) || extRefs.some((b) => !extTextMap.has(`${b.ext}:${b.id}`));

    const provenNums: number[] = [...evaluatedCalcValues];
    const provenBlobs: string[] = [];
    for (const g of grounds) {
      if (g.msg !== null || g.thread !== undefined) continue;
      const gNum = g.label.replace(/^[절점]/u, '');
      const t = nums.get(gNum);
      if (t && t !== c) {
        const pb = clauseProvenBlob(t);
        provenNums.push(...pb.nums);
        if (pb.blob) provenBlobs.push(pb.blob);
      }
    }
    if (c.process?.kind === 'fix' && c.process.target && c.process.target.msg === null && c.process.target.thread === undefined) {
      // fix→ 대상 자체 수치가 아닌 다른 근거만 포함(개정 절 본문에는 새 수치를 적음)
    }

    let w43Fired = false;
    const citedEvdBlobs: string[] = [];
    if (extRefs.length > 0 && extRefs.every((b) => extTextMap.has(`${b.ext}:${b.id}`))) {
      let sliceOutOfRange: string | null = null;
      for (const b of extRefs) {
        const blocks = extTextMap.get(`${b.ext}:${b.id}`) ?? [];
        if (!b.lines) {
          citedEvdBlobs.push(...blocks);
          continue;
        }
        const [startLine, endLine] = b.lines;
        const needCount = endLine - startLine + 1;
        let maxLines = 0;
        const matchedSlices: string[] = [];
        for (const blk of blocks) {
          const linesArr = blk.split(/\r?\n/u);
          if (linesArr.length > maxLines) maxLines = linesArr.length;
          if (linesArr.length >= endLine) {
            matchedSlices.push(linesArr.slice(startLine - 1, endLine).join('\n'));
          } else if (opts.preSlicedExt && linesArr.length === needCount) {
            matchedSlices.push(linesArr.join('\n'));
          }
        }
        if (matchedSlices.length === 0) {
          const tagRange = startLine === endLine ? `[L${startLine}]` : `[L${startLine}:L${endLine}]`;
          sliceOutOfRange = `외부 근거 ${b.ext}${b.id}의 줄 범위 ${tagRange}가 원문 줄 수(${maxLines})를 벗어난다(인용한 외부 근거와 대조 필요)`;
          break;
        }
        citedEvdBlobs.push(...matchedSlices);
      }
      if (sliceOutOfRange) {
        w43Fired = true;
        push('W43', sliceOutOfRange);
      } else {
        const evdBlob = citedEvdBlobs.join('\n');
        const provenCtx: ProvenGroundContext | undefined =
          otherGrounds > 0
            ? { nums: provenNums, blob: provenBlobs.join('\n'), hasOpaqueGround }
            : undefined;
        const w43Reason = checkGhostW43(c.words.map((wd) => wd.text).join(' '), evdBlob, provenCtx);
        if (w43Reason) {
          w43Fired = true;
          push('W43', `${w43Reason}(인용한 외부 근거와 대조 필요)`);
        }
      }
    }

    // 5e. W50: lon 0.8.5 delta 파생 수식 누락 및 [see|rec,say] · [inf,lim,say] 수치 단언 우회 차단
    const isDelta085 = isLon085Clause && !isSnapshot && (opts.mode === 'delta' || r.message.head?.mode === 'delta');
    const hasAnyCalcRef = cCalcs.length > 0 || (c.because ?? []).some((b) => 'calc' in b);
    if (isDelta085 && c.marks.act === 'say' && c.process?.kind !== 'err' && !hasAnyCalcRef && !hasOppose) {
      const bodyJoined = c.words.map((wd) => wd.text).join(' ');
      if (c.marks.ev === 'inf' && (!c.marks.fig || c.marks.fig === 'lim')) {
        if ((!c.marks.fig && bodyJoined.includes('=')) || cExtractedNums.length > 0) {
          push('W50', 'lon 0.8.5 delta에서 수치를 단언하는 추론([inf,say]·[inf,lim,say]) 절에 파생 수식 블록(calcN <[...]>)이 빠졌다');
        }
      } else if ((c.marks.ev === 'see' || c.marks.ev === 'rec') && cExtractedNums.length > 0 && !hasOpaqueGround) {
        const evdCombined = citedEvdBlobs.join('\n');
        const evdExtracted = evdCombined ? extractNumbersFromText(evdCombined) : [];
        const allVerbatimOrProven = cExtractedNums.every((num) => {
          const absStr = String(Math.abs(num));
          const pat = numberPatternOf(absStr);
          if (evdCombined && pat.test(evdCombined)) return true;
          if (evdExtracted.some((v) => numbersMatch(v, num))) return true;
          if (provenNums.some((v) => numbersMatch(v, num))) return true;
          if (provenBlobs.some((b) => pat.test(b))) return true;
          return false;
        });
        if (!allVerbatimOrProven) {
          push(
            'W50',
            `lon 0.8.5 delta에서 인용 원문·선행 절에 없는 수치를 [${c.marks.ev},say]로 단언했다(파생 계산이면 [inf,say]와 calcN <[...]>을 쓴다)`,
          );
        }
      }
    }

    // 5f. W52 (provenance): 비활성(대체·철회) 절 대상 fix→ 및 미해결 맞섬(↔) 절 무유보 직접 인용
    if (is085Spec) {
      const curState = nodeStateByNum.get(cNum);
      const fixInfo = curState?.fixTargetAtWrite;
      if (fixInfo && c.process?.kind === 'fix') {
        if (fixInfo.status === 'retracted') {
          push('W52', `이미 err→로 철회된 절(${fixInfo.targetNum})을 fix→${fixInfo.targetNum}로 수정할 수 없다`);
        } else if (fixInfo.status === 'superseded') {
          push(
            'W52',
            `이미 대체된 비활성 절(${fixInfo.targetNum})을 fix→${fixInfo.targetNum}로 가리켰다(최신 활성 절은 ${fixInfo.latestActive}이며 호스트 별칭으로 이어 붙인다)`,
          );
        }
      }
      if (isLon085Clause && c.marks.fig !== 'lim' && c.process?.kind !== 'err' && c.marks.act !== 'ack' && !hasOppose && !hasAskBack) {
        const w52ConflictSeen = new Set<string>();
        for (const g of grounds) {
          if (g.msg !== null || g.thread !== undefined) continue;
          const gNum = g.label.replace(/^[절점]/u, '');
          if (gNum && gNum !== cNum && !w52ConflictSeen.has(gNum) && isInUnresolvedConflictAt(gNum, absIdx)) {
            w52ConflictSeen.add(gNum);
            push('W52', `미해결 맞섬(↔) 상태인 절(${gNum})을 한계 유보(lim) 없이 직접 근거(↓${gNum})로 단언했다`);
          }
        }
      }
    }

    // 5g. W54 (content): 상위 [if|gut|lim]·미측정(*?)·저신뢰 절 무증거 고확신 세탁(합모 세탁) 차단
    if (
      isLon085Clause &&
      c.marks.act === 'say' &&
      (c.marks.ev === 'see' || c.marks.ev === 'rec' || c.marks.ev === 'inf') &&
      c.marks.fig !== 'lim' &&
      c.process?.kind !== 'err' &&
      !hasOppose &&
      !hasAskBack &&
      effConf !== undefined
    ) {
      const upstreamNums = new Set<string>();
      for (const g of grounds) {
        if (g.msg !== null || g.thread !== undefined) continue;
        const gNum = g.label.replace(/^[절점]/u, '');
        if (gNum && gNum !== cNum && !w44Seen.has(gNum)) upstreamNums.add(gNum);
      }
      if (upstreamNums.size > 0) {
        const latticeOfUpstream = (uNum: string): { clause: Clause; lat: LedgerEpistemicLattice; unmeasured: boolean; extKeys: Set<string> } | null => {
          const uClause = nums.get(uNum);
          if (!uClause || uClause === c) return null;
          const uNode = nodeStateByNum.get(uNum);
          const retracted = Boolean(
            (uNode?.retractedAt !== undefined && uNode.retractedAt < absIdx) ||
              opts.ledger?.getClause(uNum)?.retractedBy,
          );
          const inConflict = isInUnresolvedConflictAt(uNum, absIdx);
          const extKeys = new Set<string>();
          for (const ev of uClause.evidences ?? []) extKeys.add(`${ev.kind}:${ev.id}`);
          for (const b of uClause.because ?? []) {
            if ('ext' in b && allExt.has(`${b.ext}:${b.id}`)) extKeys.add(`${b.ext}:${b.id}`);
          }
          const ledgerLat = opts.ledger?.getClause(uNum)?.epistemic;
          const calcAnc = Boolean(ledgerLat?.calcAnc || findCalcOfClause(uClause));
          const lat = computeClauseLattice(uClause, {
            retracted,
            inOpenConflict: inConflict,
            hasCleanExt: extKeys.size > 0,
            calcAnc,
          });
          return { clause: uClause, lat, unmeasured: Boolean(uClause.muk?.unmeasured), extKeys };
        };

        const upInfos = [...upstreamNums].map(latticeOfUpstream).filter((x): x is NonNullable<typeof x> => x !== null);
        const laundered = upInfos.filter(({ lat, unmeasured }) => {
          const minTrust = Math.min(lat.m, lat.c);
          const isWeak = lat.tau <= 1 || unmeasured || minTrust <= 4;
          const inflates = effConf >= 8 || effConf >= minTrust + 2;
          return isWeak && inflates;
        });

        if (laundered.length > 0) {
          const ownExtKeys = new Set<string>();
          for (const ev of c.evidences ?? []) ownExtKeys.add(`${ev.kind}:${ev.id}`);
          for (const b of extRefs) {
            if (extTextMap.has(`${b.ext}:${b.id}`) || allExt.has(`${b.ext}:${b.id}`)) {
              ownExtKeys.add(`${b.ext}:${b.id}`);
            }
          }
          const hasNewCleanEvd =
            !w43Fired &&
            ownExtKeys.size > 0 &&
            (Boolean(c.evidences && c.evidences.length > 0) ||
              [...ownExtKeys].some((ek) => !laundered.every((u) => u.extKeys.has(ek))));

          // calcN 증인은 참조된 모든 상위 절(↓ 및 @)의 tau_up >= 2일 때만 고확신 승격을 허용한다
          const allCalcRefNums = new Set<string>([...upstreamNums, ...calcInputClauseNums]);
          const allTauGe2 =
            allCalcRefNums.size > 0 &&
            [...allCalcRefNums].every((refNum) => {
              const info = latticeOfUpstream(refNum);
              return info !== null && info.lat.tau >= 2;
            });
          const hasValidCalcWitness = hasVerifiedCalc && allTauGe2;

          if (!hasNewCleanEvd && !hasValidCalcWitness) {
            const firstWeak = laundered[0];
            const weakNum = (firstWeak.clause.label ?? '').replace(/^[절점]/u, '') || '?';
            push(
              'W54',
              `상위 절(${weakNum}, tau=${firstWeak.lat.tau}, min=${Math.min(firstWeak.lat.m, firstWeak.lat.c)})을 새 외부 원문 근거(<[...]>)나 검증된 calcN 없이 고확신(:${effConf}) 단언으로 격상했다`,
            );
          }
        }
      }
    }

    // 6. 프로파일별 규칙(본래 결 gyeol 대 산업 표준 론 lon)
    if (isLon) {
      const ev = c.marks.ev;
      if (ev && !LON_EV.has(ev)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 근거 표지 '${ev}'다(허용: see, rec, inf, gut, if)`);
      }
      if (c.marks.news) {
        push('E39', '론(Lon) 프로파일에서는 새로앎(new) 표지를 쓰지 않는다');
      }
      if (c.marks.fig && !LON_FIG.has(c.marks.fig)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 결 표지 '${c.marks.fig}'다(허용: lim)`);
      }
      if (c.marks.tense && !LON_TENSE.has(c.marks.tense)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 시제 표지 '${c.marks.tense}'다(허용: pst, fut)`);
      }
      const act = c.marks.act;
      if (act && !LON_ACT.has(act)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 화행 표지 '${act}'다(허용: say, ask, req, let, vow, nay, ack)`);
      }
      if (c.echo) {
        push('E39', '론(Lon) 프로파일에서는 받은대로 앞붙이를 쓰지 않는다(되짚음은 ↖N으로 쓴다)');
      }
      if (c.process && !LON_PROCESS.has(c.process.kind)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 과정 앞붙이 '${c.process.kind}'다(허용: fix, err, sup)`);
      }
      const pls = c.places?.length ? c.places : c.place ? [c.place] : [];
      for (const pl of pls) {
        if (pl.rel === '∥' || pl.rel === '⊗') {
          push('E39', `론(Lon) 프로파일에서 쓰지 않는 자리 앞붙이 '${pl.rel}'다(허용: ↔, ↖, 끝 ↓)`);
        }
      }
      if (w?.nonEnMarks?.length) {
        push('W26', `론(Lon) 프로파일에서는 영어 3글자 정본 표지로 고정해 쓴다(읽은 표지: ${w.nonEnMarks.join(', ')})`);
      }
    } else {
      if (INLINE_GLOSS.test(c.words.map((x) => x.text).join(' '))) {
        push('W32', '줄 안에 번역을 붙이지 않는다. 번역은 풀이에 쓰고, 결 줄에는 그 낱말만 쓴다');
      }
      if (group && !mixesScripts(c.words, group)) {
        push('W29', `어근이 둘 이상이면 적어도 하나는 사용자 언어(${lang})가 아닌 다른 글자군의 낱말로 쓴다(옮기면 뜻이 깎이는 낱말: Schadenfreude, 物の哀れ, 껄끄럽다, saudade)`);
      } else if (lang === 'ko' && group && !hasUserScript(c.words, group)) {
        push('W29', '사용자 언어(ko) 대화에서는 조사·어미·문장 뼈대를 한국어(한글)로 쓰고 다른 글자군 낱말을 섞는다');
      }
      const long = (w?.aliases ?? []).filter((a) => !SHORT_ALIASES_07.has(a) && !SHORT_ALIASES_07.has(a.toLowerCase()));
      if (long.length) {
        push('W26', `긴 별칭 ${long.join(', ')}을 표지로 읽었다(정규형은 ${long.map((a) => markOf07(a) ?? '?').join(', ')})`);
      }
    }
  }

  if (isSnapshot && clauses.length > 0) {
    let expected = 1;
    for (let k = start; k < clauses.length; k++) {
      const c = clauses[k];
      if (!c.label) continue;
      const m = /^[절점](\d+)$/u.exec(c.label);
      if (!m) continue;
      const n = Number(m[1]);
      if (n > expected) {
        out.push({
          code: 'W45',
          severity: '경고',
          tier: tierOfCode('W45'),
          line: k + 1,
          message: `snapshot 계보 빈틈: 통째 차례에서 본절 번호는 <1부터 하나씩 이어져야 한다(기대 <${expected}, 읽은 <${n}): ${c.label}`,
        });
        expected = n + 1;
      } else if (n === expected) {
        expected = n + 1;
      }
    }
  }

  return out.sort((a, b) => a.line - b.line);
}
