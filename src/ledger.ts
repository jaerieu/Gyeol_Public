// 결 v0.8.5 — IETF RFC 8785 (JCS) 정규 직렬화 및 대역 외 교차 턴 원장(LedgerContext)
import type { CalcBlock, Clause, ExtEvidence, Message } from './types.ts';
import { sha256Hex } from './hash.ts';
import { extractPrimaryNumeric } from './calc.ts';
import { clauseText03, format } from './format.ts';
import { formatExtFence } from './parse/shared.ts';
import { SPEC_VERSION } from './tables.ts';

/**
 * IETF RFC 8785 (JSON Canonicalization Scheme, JCS) 순수 TypeScript 구현.
 * - 객체 키는 UTF-16 코드 유닛 사전순(< / >)으로 재귀 정렬한다.
 * - 숫자 -0은 0으로 직렬화하고 NaN/Infinity는 거부한다.
 * - ECMAScript JSON.stringify의 문자열·수 직렬화 규격을 따른다.
 */
export function jcsStringify(value: unknown): string {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`RFC 8785 JCS는 유한하지 않은 수를 허용하지 않는다: ${value}`);
    return Object.is(value, -0) ? '0' : String(value);
  }
  if (t === 'string') {
    if (!(value as string).isWellFormed()) {
      throw new TypeError('RFC 8785 §3.2.2.2 JCS는 단독 서로게이트(비정형 UTF-16 문자열)를 허용하지 않는다');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => (item === undefined || typeof item === 'function' || typeof item === 'symbol' ? 'null' : jcsStringify(item))).join(',') + ']';
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    if (typeof (obj as { toJSON?: unknown }).toJSON === 'function') {
      return jcsStringify((obj as { toJSON: () => unknown }).toJSON());
    }
    const keys = Object.keys(obj).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      if (!k.isWellFormed()) {
        throw new TypeError('RFC 8785 §3.2.2.2 JCS는 단독 서로게이트 객체 키를 허용하지 않는다');
      }
      const v = obj[k];
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue;
      parts.push(`${JSON.stringify(k)}:${jcsStringify(v)}`);
    }
    return '{' + parts.join(',') + '}';
  }
  throw new TypeError(`RFC 8785 JCS 직렬화 불가 자료형: ${t}`);
}

export async function jcsSha256(value: unknown): Promise<string> {
  return sha256Hex(jcsStringify(value));
}

export interface OpenConflict {
  clauseNum: string;
  targetNum: string;
  evidenceIds: string[];
  turn: number;
  text: string;
  resolvedAtTurn?: number;
  resolvedBy?: string;
}

export interface LedgerChainBlock {
  turn: number;
  prevHash: string;
  turnHash: string;
  chainHash: string;
  edition: string;
  profile: string;
  mode: string;
  dictHash: string;
  clauseCount: number;
}

/**
 * 인식론적 비증폭 격자(Epistemic Non-Amplification Lattice).
 * - tau: 0(철회·gut) | 1(if·lim·미해결 맞섬) | 2(inf·rec·일반 see) | 3(see + 외부 원문 근거)
 * - m: 유효 먹 신뢰 숫자(0부터 9; 미측정 *?는 보수적 상한 4, 미표기는 자체 확신 c)
 * - c: 절 자체 확신 숫자(0부터 9)
 * - chi: 미해결 맞섬(↔) 관여 여부(0 | 1)
 * - calcAnc: 해당 절 또는 fix→ 조상 사슬에 검증 가능한 calcN 수식이 결합되어 있는지 여부
 */
export interface LedgerEpistemicLattice {
  tau: 0 | 1 | 2 | 3;
  m: number;
  c: number;
  chi: 0 | 1;
  calcAnc: boolean;
}

export interface LedgerAliasResolution {
  clauseNum: string;
  writtenTarget: string;
  resolvedTarget: string;
  kind: 'fix' | 'err';
  turn: number;
}

export interface LedgerTurnRecord {
  turn: number;
  clauses: Clause[];
  evidences: ExtEvidence[];
  calcs: CalcBlock[];
  aliasResolutions: LedgerAliasResolution[];
  deltaBlock: string;
}

export interface LedgerEntry {
  num: string;
  clause: Clause;
  turn: number;
  numericValue: number | null;
  active: boolean;
  supersededBy?: string;
  supersededAtTurn?: number;
  retractedBy?: string;
  retractedAtTurn?: number;
  supportedBy?: string[];
  aliasedFrom?: string;
  resolvedTarget?: string;
  epistemic?: LedgerEpistemicLattice;
}

export function computeClauseLattice(
  clause: Clause,
  opts: { retracted?: boolean; inOpenConflict?: boolean; hasCleanExt?: boolean; calcAnc?: boolean } = {},
): LedgerEpistemicLattice {
  const c =
    clause.conf ??
    (clause.chae?.self !== undefined ? Math.max(0, Math.min(9, Math.round(clause.chae.self * 10))) : 5);
  const m =
    clause.muk?.conf !== undefined
      ? Math.max(0, Math.min(9, Math.round(clause.muk.conf * 10)))
      : clause.muk?.unmeasured
        ? 4
        : c;
  const chi: 0 | 1 = opts.inOpenConflict ? 1 : 0;
  const calcAnc = Boolean(opts.calcAnc ?? Boolean(clause.calcs && clause.calcs.length > 0));
  let tau: 0 | 1 | 2 | 3;
  if (opts.retracted || clause.process?.kind === 'err' || clause.marks.ev === 'gut') {
    tau = 0;
  } else if (chi === 1 || clause.marks.ev === 'if' || clause.marks.fig === 'lim') {
    tau = 1;
  } else if (clause.marks.ev === 'see' && opts.hasCleanExt) {
    tau = 3;
  } else {
    tau = 2;
  }
  return { tau, m, c, chi, calcAnc };
}

function hasWellFormedStrings(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || value === undefined) return true;
  const t = typeof value;
  if (t === 'string') return (value as string).isWellFormed();
  if (t === 'number') return Number.isFinite(value as number);
  if (t !== 'object') return true;
  const obj = value as object;
  if (seen.has(obj)) return true;
  seen.add(obj);
  if (Array.isArray(obj)) {
    return obj.every((item) => hasWellFormedStrings(item, seen));
  }
  if (obj instanceof Map) {
    for (const [k, v] of obj.entries()) {
      if (!hasWellFormedStrings(k, seen) || !hasWellFormedStrings(v, seen)) return false;
    }
    return true;
  }
  if (obj instanceof Set) {
    for (const v of obj.values()) {
      if (!hasWellFormedStrings(v, seen)) return false;
    }
    return true;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!k.isWellFormed() || !hasWellFormedStrings(v, seen)) return false;
  }
  return true;
}

/**
 * 대역 외 교차 턴(delta / snapshot) 상태 원장.
 * 이전 턴 확정 절·외부근거·수식·[inf] 의존 그래프·활성 충돌(openConflicts)을 O(1)로 조회한다.
 */
export class LedgerContext {
  readonly clausesByNum = new Map<string, LedgerEntry>();
  readonly evidencesByKey = new Map<string, ExtEvidence>();
  readonly evidenceTurnByKey = new Map<string, number>();
  readonly calcsById = new Map<string, CalcBlock>();
  readonly depsOf = new Map<string, Set<string>>();
  readonly dependentsMap = new Map<string, Set<string>>();
  readonly openConflicts: OpenConflict[] = [];
  readonly aliasResolutions: LedgerAliasResolution[] = [];
  readonly turnRecords: LedgerTurnRecord[] = [];
  readonly chain: LedgerChainBlock[] = [];
  readonly priorClauses: Clause[] = [];
  readonly priorEvidences: ExtEvidence[] = [];
  private readonly epochCheckpointCache = new Map<string, string>();

  get headHash(): string {
    return this.chain.length ? this.chain[this.chain.length - 1].chainHash : '0'.repeat(64);
  }

  /** RFC 8785 §3.2.2.2 문자열 정형성 및 해시 체인 연결 무결성을 검증한다. */
  isWellFormed(): boolean {
    if (
      !hasWellFormedStrings(this.clausesByNum) ||
      !hasWellFormedStrings(this.evidencesByKey) ||
      !hasWellFormedStrings(this.calcsById) ||
      !hasWellFormedStrings(this.openConflicts) ||
      !hasWellFormedStrings(this.chain)
    ) {
      return false;
    }
    for (let i = 0; i < this.chain.length; i++) {
      const expectedPrev = i === 0 ? '0'.repeat(64) : this.chain[i - 1].chainHash;
      if (this.chain[i].prevHash !== expectedPrev) return false;
    }
    return true;
  }

  hasClause(num: string): boolean {
    return this.clausesByNum.has(num);
  }

  getClause(num: string): LedgerEntry | undefined {
    return this.clausesByNum.get(num);
  }

  hasEvidence(kind: string, id: string): boolean {
    return this.evidencesByKey.has(`${kind}:${id}`);
  }

  activeClausesMap(): Map<string, Clause> {
    const out = new Map<string, Clause>();
    for (const [k, ent] of this.clausesByNum) {
      if (ent.active) out.set(k, ent.clause);
    }
    return out;
  }

  supersededSet(): Set<string> {
    const out = new Set<string>();
    for (const [k, ent] of this.clausesByNum) {
      if (!ent.active) out.add(k);
    }
    return out;
  }

  unresolvedConflicts(atTurn?: number): OpenConflict[] {
    return this.openConflicts.filter((oc) => {
      if (atTurn !== undefined && oc.turn > atTurn) return false;
      if (oc.resolvedAtTurn !== undefined && (atTurn === undefined || oc.resolvedAtTurn <= atTurn)) return false;
      const a = this.clausesByNum.get(oc.clauseNum);
      const b = this.clausesByNum.get(oc.targetNum);
      if (atTurn === undefined) {
        return Boolean(a?.active && b?.active);
      }
      const activeAt = (ent: LedgerEntry | undefined) =>
        Boolean(
          ent &&
            ent.turn <= atTurn &&
            (ent.supersededAtTurn === undefined || ent.supersededAtTurn > atTurn) &&
            (ent.retractedAtTurn === undefined || ent.retractedAtTurn > atTurn),
        );
      return activeAt(a) && activeAt(b);
    });
  }

  latestActiveOf(num: string): string {
    let cur = num;
    const seen = new Set<string>([cur]);
    while (true) {
      const ent = this.clausesByNum.get(cur);
      if (!ent || ent.active || !ent.supersededBy || seen.has(ent.supersededBy)) break;
      seen.add(ent.supersededBy);
      cur = ent.supersededBy;
    }
    return cur;
  }

  lineageAncestorsOf(num: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>([num]);
    const queue: string[] = [num];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const ent = this.clausesByNum.get(cur);
      if (!ent) continue;
      const candidates: string[] = [];
      if (ent.resolvedTarget) candidates.push(ent.resolvedTarget);
      const t = ent.clause.process?.target;
      if (t && (ent.clause.process?.kind === 'fix' || ent.clause.process?.kind === 'err')) {
        const pNum = t.label.replace(/^[절점]/u, '');
        if (pNum && !candidates.includes(pNum)) candidates.push(pNum);
      }
      for (const pNum of candidates) {
        if (!pNum || seen.has(pNum)) continue;
        seen.add(pNum);
        out.push(pNum);
        queue.push(pNum);
      }
    }
    return out;
  }

  dependentsOf = (num: string): Clause[] => {
    const queryIds = new Set<string>([num, ...this.lineageAncestorsOf(num)]);
    let fwd = num;
    const seenFwd = new Set<string>([fwd]);
    while (true) {
      const ent = this.clausesByNum.get(fwd);
      if (!ent?.supersededBy || seenFwd.has(ent.supersededBy)) break;
      seenFwd.add(ent.supersededBy);
      fwd = ent.supersededBy;
      queryIds.add(fwd);
    }
    const foundNums = new Set<string>();
    const out: Clause[] = [];
    for (const qId of queryIds) {
      const ids = this.dependentsMap.get(qId);
      if (!ids) continue;
      for (const id of ids) {
        const latestId = this.latestActiveOf(id);
        for (const cand of [id, latestId]) {
          if (foundNums.has(cand) || queryIds.has(cand)) continue;
          const ent = this.clausesByNum.get(cand);
          if (ent && ent.active) {
            foundNums.add(cand);
            out.push(ent.clause);
          }
        }
      }
    }
    return out;
  };

  get priorClauseMap(): Map<string, Clause> {
    const m = new Map<string, Clause>();
    for (const [k, ent] of this.clausesByNum) m.set(k, ent.clause);
    return m;
  }

  async commitTurn(
    turnOrMsg: number | Message,
    msgOrOpts?: Message | { turn?: number; dictHash?: string; canonicalText?: string },
    maybeOpts: { dictHash?: string; canonicalText?: string } = {},
  ): Promise<LedgerChainBlock> {
    if (typeof turnOrMsg === 'number') {
      return commitTurn(this, msgOrOpts as Message, { ...maybeOpts, turn: turnOrMsg });
    }
    return commitTurn(this, turnOrMsg, (msgOrOpts as { turn?: number; dictHash?: string; canonicalText?: string }) ?? {});
  }

  buildEpochView(upToTurnOrOpts?: number | EpochViewOptions, maybeOpts: EpochViewOptions = {}): EpochLedgerView {
    if (typeof upToTurnOrOpts === 'number') {
      return buildEpochView(this, { ...maybeOpts, upToTurn: upToTurnOrOpts });
    }
    return buildEpochView(this, upToTurnOrOpts ?? {});
  }

  formatEpochLedgerView(opts: EpochViewOptions = {}): string {
    return formatEpochLedgerView(this, opts);
  }
}

export function extractOpenConflicts(msg: Message, turn: number): OpenConflict[] {
  const out: OpenConflict[] = [];
  msg.clauses.forEach((c, idx) => {
    const places = c.places?.length ? c.places : c.place ? [c.place] : [];
    const oppose = places.filter((p) => p.rel === '↔');
    if (oppose.length > 0 && c.process?.kind !== 'err') {
      const cNum = (c.label ?? `절${idx + 1}`).replace(/^[절점]/u, '');
      const evIds = (c.because ?? []).filter((b): b is { ext: 'evd' | 'ref'; id: string } => 'ext' in b).map((b) => `${b.ext}${b.id}`);
      for (const p of oppose) {
        out.push({
          clauseNum: cNum,
          targetNum: p.target.label.replace(/^[절점]/u, ''),
          evidenceIds: evIds,
          turn,
          text: c.words.map((w) => w.text).join(' '),
        });
      }
    }
  });
  return out;
}

function formatTurnDeltaBlock(
  turn: number,
  clauses: readonly Clause[],
  evidences: readonly ExtEvidence[],
  calcs: readonly CalcBlock[],
  aliases: readonly LedgerAliasResolution[],
): string {
  const aliasTag = aliases.length
    ? ` · alias ${aliases.map((a) => `${a.kind}→${a.writtenTarget}⇒${a.kind}→${a.resolvedTarget}`).join(',')}`
    : '';
  const lines: string[] = [`[Hop ${turn} · Host-Delta${aliasTag}]`];
  const inlineEvKeys = new Set<string>();
  const inlineCalcIds = new Set<string>();
  for (const c of clauses) {
    lines.push(clauseText03(c, true));
    for (const ev of c.evidences ?? []) inlineEvKeys.add(`${ev.kind}:${ev.id}`);
    for (const cb of c.calcs ?? []) inlineCalcIds.add(cb.id);
  }
  for (const ev of evidences) {
    const k = `${ev.kind}:${ev.id}`;
    if (!inlineEvKeys.has(k)) {
      inlineEvKeys.add(k);
      lines.push(`${ev.kind}${ev.id} ${formatExtFence(ev.text)}`);
    }
  }
  for (const cb of calcs) {
    if (!inlineCalcIds.has(cb.id)) {
      inlineCalcIds.add(cb.id);
      const exprStr = cb.declared !== undefined ? `${cb.expr} = ${cb.declared}` : cb.expr;
      lines.push(`calc${cb.id} ${formatExtFence(exprStr)}`);
    }
  }
  return lines.join('\n');
}

function refreshEpistemicLattices(ledger: LedgerContext): void {
  const conflictNums = new Set<string>();
  for (const oc of ledger.unresolvedConflicts()) {
    conflictNums.add(oc.clauseNum);
    conflictNums.add(oc.targetNum);
  }
  for (const [num, ent] of ledger.clausesByNum) {
    const c = ent.clause;
    const hasDirectCalc =
      Boolean(c.calcs && c.calcs.length > 0) ||
      Boolean((c.because ?? []).some((b) => 'calc' in b && ledger.calcsById.has(b.calc)));
    const hasAncestorCalc =
      hasDirectCalc ||
      ledger.lineageAncestorsOf(num).some((anc) => {
        const aEnt = ledger.clausesByNum.get(anc);
        if (!aEnt) return false;
        return (
          Boolean(aEnt.epistemic?.calcAnc) ||
          Boolean(aEnt.clause.calcs && aEnt.clause.calcs.length > 0) ||
          Boolean((aEnt.clause.because ?? []).some((b) => 'calc' in b && ledger.calcsById.has(b.calc)))
        );
      });
    const hasCleanExt =
      Boolean(c.evidences && c.evidences.length > 0) ||
      Boolean((c.because ?? []).some((b) => 'ext' in b && ledger.evidencesByKey.has(`${b.ext}:${b.id}`)));
    ent.epistemic = computeClauseLattice(c, {
      retracted: Boolean(ent.retractedBy),
      inOpenConflict: conflictNums.has(num),
      hasCleanExt,
      calcAnc: hasAncestorCalc,
    });
  }
}

export async function commitTurn(
  ledger: LedgerContext,
  msg: Message,
  opts: { turn?: number; dictHash?: string; canonicalText?: string } = {},
): Promise<LedgerChainBlock> {
  const turn = opts.turn ?? ledger.chain.length + 1;
  const dictHash = opts.dictHash ?? '0'.repeat(64);
  const turnNewClauses: Clause[] = [];
  const turnNewEvidences: ExtEvidence[] = [];
  const turnNewCalcs: CalcBlock[] = [];
  const turnAliases: LedgerAliasResolution[] = [];

  for (const ev of msg.evidences ?? []) {
    const k = `${ev.kind}:${ev.id}`;
    if (!ledger.evidenceTurnByKey.has(k)) ledger.evidenceTurnByKey.set(k, turn);
    ledger.evidencesByKey.set(k, ev);
    ledger.priorEvidences.push(ev);
    turnNewEvidences.push(ev);
  }
  for (const cb of msg.calcs ?? []) {
    ledger.calcsById.set(cb.id, cb);
    turnNewCalcs.push(cb);
  }

  msg.clauses.forEach((c, idx) => {
    const num = (c.label ?? `절${ledger.priorClauses.length + idx + 1}`).replace(/^[절점]/u, '');
    // snapshot 중복 캐리 절은 기존 원장 항목을 덮어쓰지 않고 유지한다
    const existing = ledger.clausesByNum.get(num);
    let createdEnt: LedgerEntry | undefined;
    if (!existing) {
      ledger.priorClauses.push(c);
      createdEnt = {
        num,
        clause: c,
        turn,
        numericValue: extractPrimaryNumeric(c),
        active: true,
      };
      ledger.clausesByNum.set(num, createdEnt);
      turnNewClauses.push(c);
    }
    for (const ev of c.evidences ?? []) {
      const k = `${ev.kind}:${ev.id}`;
      if (!ledger.evidenceTurnByKey.has(k)) ledger.evidenceTurnByKey.set(k, turn);
      ledger.evidencesByKey.set(k, ev);
      ledger.priorEvidences.push(ev);
      if (!existing) turnNewEvidences.push(ev);
    }
    for (const cb of c.calcs ?? []) {
      ledger.calcsById.set(cb.id, cb);
      if (!existing) turnNewCalcs.push(cb);
    }

    if (!existing && createdEnt) {
      // 과정 포인터 처리 ($0 비활성 별칭 치유 포함)
      if (c.process?.target) {
        const targetNum = c.process.target.label.replace(/^[절점]/u, '');
        const tEnt = ledger.clausesByNum.get(targetNum);
        if (tEnt) {
          if (c.process.kind === 'fix') {
            if (tEnt.active) {
              tEnt.active = false;
              tEnt.supersededBy = num;
              tEnt.supersededAtTurn = turn;
            } else if (!tEnt.retractedBy) {
              const pLat = ledger.latestActiveOf(targetNum);
              const latEnt = ledger.clausesByNum.get(pLat);
              if (latEnt && latEnt.active && pLat !== num) {
                latEnt.active = false;
                latEnt.supersededBy = num;
                latEnt.supersededAtTurn = turn;
                createdEnt.aliasedFrom = targetNum;
                createdEnt.resolvedTarget = pLat;
                const ar: LedgerAliasResolution = {
                  clauseNum: num,
                  writtenTarget: targetNum,
                  resolvedTarget: pLat,
                  kind: 'fix',
                  turn,
                };
                ledger.aliasResolutions.push(ar);
                turnAliases.push(ar);
              }
            }
          } else if (c.process.kind === 'err') {
            if (tEnt.active) {
              tEnt.active = false;
              tEnt.retractedBy = num;
              tEnt.retractedAtTurn = turn;
            } else if (!tEnt.retractedBy) {
              const pLat = ledger.latestActiveOf(targetNum);
              const latEnt = ledger.clausesByNum.get(pLat);
              if (latEnt && latEnt.active && pLat !== num) {
                latEnt.active = false;
                latEnt.retractedBy = num;
                latEnt.retractedAtTurn = turn;
                createdEnt.aliasedFrom = targetNum;
                createdEnt.resolvedTarget = pLat;
                const ar: LedgerAliasResolution = {
                  clauseNum: num,
                  writtenTarget: targetNum,
                  resolvedTarget: pLat,
                  kind: 'err',
                  turn,
                };
                ledger.aliasResolutions.push(ar);
                turnAliases.push(ar);
              }
            }
          } else if (c.process.kind === 'sup') {
            (tEnt.supportedBy ??= []).push(num);
          }

          // fix→ / err→에 의해 해소된 기존 맞섬(↔) 표시
          if (c.process.kind === 'fix' || c.process.kind === 'err') {
            const effTarget = createdEnt.resolvedTarget ?? targetNum;
            for (const oc of ledger.openConflicts) {
              if (
                oc.resolvedAtTurn === undefined &&
                (oc.clauseNum === targetNum ||
                  oc.targetNum === targetNum ||
                  oc.clauseNum === effTarget ||
                  oc.targetNum === effTarget)
              ) {
                oc.resolvedAtTurn = turn;
                oc.resolvedBy = num;
              }
            }
          }
        }
      }

      if (c.marks.act === 'ack') {
        const pls = c.places?.length ? c.places : c.place ? [c.place] : [];
        const citedNums = new Set<string>();
        for (const pl of pls) {
          if (pl.target.msg === null && pl.target.thread === undefined) {
            citedNums.add(pl.target.label.replace(/^[절점]/u, ''));
          }
        }
        for (const b of c.because ?? []) {
          if ('label' in b && b.msg === null && b.thread === undefined) {
            citedNums.add(b.label.replace(/^[절점]/u, ''));
          }
        }
        for (const oc of ledger.openConflicts) {
          if (oc.resolvedAtTurn === undefined && (citedNums.has(oc.clauseNum) || citedNums.has(oc.targetNum))) {
            oc.resolvedAtTurn = turn;
            oc.resolvedBy = num;
          }
        }
      }

      // 의존성 그래프 등록 (↓N, calc @N 및 fix→ 조상 수식 의존성 상속)
      const deps = new Set<string>();
      for (const b of c.because ?? []) {
        if ('label' in b && b.msg === null && b.thread === undefined) {
          deps.add(b.label.replace(/^[절점]/u, ''));
        }
      }
      for (const cb of c.calcs ?? []) {
        for (const m of cb.expr.matchAll(/@(\d+(?:\.\d+)?)/gu)) deps.add(m[1]);
      }
      if ((!c.calcs || c.calcs.length === 0) && c.process?.kind === 'fix') {
        for (const anc of ledger.lineageAncestorsOf(num)) {
          const ancDeps = ledger.depsOf.get(anc);
          if (ancDeps) {
            for (const d of ancDeps) {
              deps.add(d);
              deps.add(ledger.latestActiveOf(d));
            }
          }
        }
      }
      if (deps.size) {
        ledger.depsOf.set(num, deps);
        for (const d of deps) {
          let set = ledger.dependentsMap.get(d);
          if (!set) {
            set = new Set<string>();
            ledger.dependentsMap.set(d, set);
          }
          set.add(num);
        }
      }
    }
  });

  // 충돌 발산(↔k + lim) 추출
  for (const oc of extractOpenConflicts(msg, turn)) {
    if (!ledger.openConflicts.some((x) => x.clauseNum === oc.clauseNum && x.targetNum === oc.targetNum)) {
      ledger.openConflicts.push(oc);
    }
  }

  refreshEpistemicLattices(ledger);

  // 추가 전용(append-only) 턴 델타 기록(같은 turn 번호로 호스트 전파가 연달아 들어오면 마지막 턴 레코드만 병합)
  if (turnNewClauses.length || turnNewEvidences.length || turnNewCalcs.length) {
    const lastRec = ledger.turnRecords[ledger.turnRecords.length - 1];
    if (lastRec && lastRec.turn === turn) {
      lastRec.clauses.push(...turnNewClauses);
      lastRec.evidences.push(...turnNewEvidences);
      lastRec.calcs.push(...turnNewCalcs);
      lastRec.aliasResolutions.push(...turnAliases);
      lastRec.deltaBlock = formatTurnDeltaBlock(
        turn,
        lastRec.clauses,
        lastRec.evidences,
        lastRec.calcs,
        lastRec.aliasResolutions,
      );
    } else {
      ledger.turnRecords.push({
        turn,
        clauses: turnNewClauses,
        evidences: turnNewEvidences,
        calcs: turnNewCalcs,
        aliasResolutions: turnAliases,
        deltaBlock: formatTurnDeltaBlock(turn, turnNewClauses, turnNewEvidences, turnNewCalcs, turnAliases),
      });
    }
  }

  const prevHash = ledger.headHash;
  const edition = msg.gyeol || SPEC_VERSION;
  const profile = msg.profile ?? 'gyeol';
  const mode = msg.head?.mode ?? (msg.head?.snapshot ? 'snapshot' : 'delta');
  const turnHash = await jcsSha256({
    edition,
    profile,
    mode,
    dictHash,
    canonicalText: opts.canonicalText ?? null,
    clauses: msg.clauses,
  });
  const chainHash = await jcsSha256({ prevHash, turn, turnHash });
  const block: LedgerChainBlock = {
    turn,
    prevHash,
    turnHash,
    chainHash,
    edition,
    profile,
    mode,
    dictHash,
    clauseCount: msg.clauses.length,
  };
  ledger.chain.push(block);
  return block;
}

export interface FormatLedgerViewOptions {
  mode?: 'full' | 'compacted';
  lang?: string;
}

function summarizeSupersededStub(ent: LedgerEntry, ledger: LedgerContext, atTurn?: number): string {
  const c = ent.clause;
  let summary = c.words.map((w) => w.text).join(' ').replace(/\s+/gu, ' ').trim();
  const firstExt =
    c.evidences?.[0] ??
    (() => {
      const bExt = (c.because ?? []).find((b): b is { ext: 'evd' | 'ref'; id: string } => 'ext' in b);
      if (!bExt) return undefined;
      const evKey = `${bExt.ext}:${bExt.id}`;
      if (atTurn !== undefined) {
        const evTurn = ledger.evidenceTurnByKey.get(evKey);
        if (evTurn !== undefined && evTurn > atTurn) return undefined;
      }
      return ledger.evidencesByKey.get(evKey);
    })();
  if (firstExt && summary) {
    // 만약 구버전 절 본문에 핵심 라벨만 있고 수치가 evd 원문 줄에만 있었다면 한 줄 요약을 보강한다
    const hasDigitOrCode = /\d|[A-Z]{2,}[-_]\w+/u.test(summary);
    if (!hasDigitOrCode) {
      const lblLower = summary.toLowerCase().replace(/\s*[:=]\s*$/u, '');
      const matchLine = firstExt.text
        .split(/\r?\n/u)
        .map((ln) => ln.trim())
        .find((ln) => ln.toLowerCase().startsWith(lblLower) && ln.includes(':'));
      if (matchLine) {
        const rhs = matchLine.slice(matchLine.indexOf(':') + 1).trim();
        if (rhs) summary = `${summary}=${rhs}`;
      }
    }
  }
  summary = summary.replaceAll('<', '[').replaceAll('>', ']');
  if (summary.length > 96) summary = `${summary.slice(0, 93)}...`;
  const grounds = (c.because ?? [])
    .map((b) => ('ext' in b ? `↓${b.ext}${b.id}` : 'label' in b ? `↓${b.label.replace(/^[절점]/u, '')}` : ''))
    .filter(Boolean)
    .join('');
  const wasRetracted =
    ent.retractedBy !== undefined && (atTurn === undefined || (ent.retractedAtTurn ?? ent.turn) <= atTurn);
  const wasSuperseded =
    ent.supersededBy !== undefined && (atTurn === undefined || (ent.supersededAtTurn ?? ent.turn) <= atTurn);
  const statusTag = wasRetracted
    ? `retracted→${ent.retractedBy}`
    : wasSuperseded
      ? `superseded→${ent.supersededBy}`
      : 'inactive';
  return `<${ent.num} · [${statusTag}] ${summary}${grounds ? ' ' + grounds : ''}>`;
}

function buildCompactedViewAtTurn(ledger: LedgerContext, lang: string, atTurn?: number, headerLine?: string): string {
  const isEntryInScope = (ent: LedgerEntry) => atTurn === undefined || ent.turn <= atTurn;
  const isEntryActiveAt = (ent: LedgerEntry) => {
    if (!isEntryInScope(ent)) return false;
    if (atTurn === undefined) return ent.active;
    return (
      (ent.supersededAtTurn === undefined || ent.supersededAtTurn > atTurn) &&
      (ent.retractedAtTurn === undefined || ent.retractedAtTurn > atTurn)
    );
  };

  const preserveFullNums = new Set<string>();
  for (const [num, ent] of ledger.clausesByNum) {
    if (isEntryActiveAt(ent)) preserveFullNums.add(num);
  }
  const activeConflicts = atTurn === undefined ? ledger.openConflicts : ledger.unresolvedConflicts(atTurn);
  for (const oc of activeConflicts) {
    const aEnt = ledger.clausesByNum.get(oc.clauseNum);
    const bEnt = ledger.clausesByNum.get(oc.targetNum);
    if (aEnt && isEntryInScope(aEnt)) preserveFullNums.add(oc.clauseNum);
    if (bEnt && isEntryInScope(bEnt)) preserveFullNums.add(oc.targetNum);
  }

  // 활성·충돌 절이 직접(1홉) 또는 수정 사슬을 통해 가리키는 대체·철회 절 집합 수집
  const stubNums = new Set<string>();
  const queue: string[] = [];
  const enqueueStub = (targetNum: string | undefined) => {
    if (!targetNum || preserveFullNums.has(targetNum) || stubNums.has(targetNum)) return;
    const tEnt = ledger.clausesByNum.get(targetNum);
    if (tEnt && isEntryInScope(tEnt)) {
      stubNums.add(targetNum);
      queue.push(targetNum);
    }
  };

  for (const num of preserveFullNums) {
    const ent = ledger.clausesByNum.get(num);
    if (!ent) continue;
    const c = ent.clause;
    if (ent.resolvedTarget) enqueueStub(ent.resolvedTarget);
    if (c.process?.target && c.process.target.msg === null && c.process.target.thread === undefined) {
      enqueueStub(c.process.target.label.replace(/^[절점]/u, ''));
    }
    for (const b of c.because ?? []) {
      if ('label' in b && b.msg === null && b.thread === undefined) {
        enqueueStub(b.label.replace(/^[절점]/u, ''));
      }
    }
    const pls = c.places?.length ? c.places : c.place ? [c.place] : [];
    for (const pl of pls) {
      if (pl.target.msg === null && pl.target.thread === undefined) {
        enqueueStub(pl.target.label.replace(/^[절점]/u, ''));
      }
    }
  }

  // 수정·철회 사슬을 따라 선행 이력 스텁도 경량으로 보존(evd 본문은 모두 생략)
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const ent = ledger.clausesByNum.get(cur);
    if (!ent) continue;
    if (ent.resolvedTarget) enqueueStub(ent.resolvedTarget);
    const c = ent.clause;
    if (c.process?.target && c.process.target.msg === null && c.process.target.thread === undefined) {
      enqueueStub(c.process.target.label.replace(/^[절점]/u, ''));
    }
  }

  const lines: string[] = [headerLine ?? `lon ${SPEC_VERSION} · snapshot · lang ${lang}`];
  const emittedEvKeys = new Set<string>();
  const pendingTopEvs: ExtEvidence[] = [];

  for (const c of ledger.priorClauses) {
    const num = (c.label ?? '').replace(/^[절점]/u, '');
    const ent = ledger.clausesByNum.get(num);
    if (ent && !isEntryInScope(ent)) continue;
    if (preserveFullNums.has(num)) {
      lines.push(clauseText03(c, true));
      for (const ev of c.evidences ?? []) {
        emittedEvKeys.add(`${ev.kind}:${ev.id}`);
      }
      for (const b of c.because ?? []) {
        if ('ext' in b) {
          const k = `${b.ext}:${b.id}`;
          if (!emittedEvKeys.has(k)) {
            const evTurn = ledger.evidenceTurnByKey.get(k);
            if (atTurn === undefined || evTurn === undefined || evTurn <= atTurn) {
              const topEv = ledger.evidencesByKey.get(k);
              if (topEv) {
                emittedEvKeys.add(k);
                pendingTopEvs.push(topEv);
              }
            }
          }
        }
      }
    } else if (stubNums.has(num)) {
      if (ent) lines.push(summarizeSupersededStub(ent, ledger, atTurn));
    }
  }

  for (const ev of pendingTopEvs) {
    lines.push(`${ev.kind}${ev.id} ${formatExtFence(ev.text)}`);
  }

  return lines.join('\n');
}

/**
 * 원장 재구성 뷰 직렬화기 (`'full'` | `'compacted'`).
 * - `'full'`: 모든 누적 절과 외부 근거 블록을 온전히 출력한다 (`Full-Lineage-View`).
 * - `'compacted'`: 현재 활성 절과 미해결 충돌 절(`↔k + lim`)은 원문 `evd`와 함께 온전히 유지하고,
 *   활성 절의 `fix→p`, `err→p`, `↓p`가 가리키는 대체·철회 선행 절(및 수정 사슬)은 비대한 `evd` 원문 블록을 생략한 채
 *   `<p · [superseded→p'] 핵심 라벨·이전 수치 요약>` 경량 인과 스텁으로 보존한다 (`Compacted-Lineage-View`).
 */
export function formatLedgerView(ledger: LedgerContext, opts: FormatLedgerViewOptions = {}): string {
  const mode = opts.mode ?? 'full';
  const lang = opts.lang ?? 'en';
  if (mode === 'full') {
    const topEvs = ledger.priorEvidences.filter(
      (ev) => !ledger.priorClauses.some((c) => (c.evidences ?? []).some((e) => `${e.kind}${e.id}` === `${ev.kind}${ev.id}`)),
    );
    const uniqTop: ExtEvidence[] = [];
    const seen = new Set<string>();
    for (const ev of topEvs) {
      const k = `${ev.kind}${ev.id}`;
      if (!seen.has(k)) {
        seen.add(k);
        uniqTop.push(ev);
      }
    }
    return format({
      gyeol: SPEC_VERSION,
      profile: 'lon',
      lang,
      head: { mode: 'snapshot' },
      clauses: ledger.priorClauses,
      evidences: uniqTop,
      calcs: [],
      gloss: null,
      muk_source: null,
      commentary: null,
    });
  }

  return buildCompactedViewAtTurn(ledger, lang);
}

export const DEFAULT_EPOCH_SIZE = 16;

export interface EpochViewOptions {
  /** 에포크 동결 주기(기본 16턴) */
  epochSize?: number;
  /** 기준 완료 턴 번호(생략 시 원장 최신 기록 턴) */
  upToTurn?: number;
  /** 머리 줄 언어 코드(기본 'en') */
  lang?: string;
}

export interface EpochLedgerView {
  epoch: number;
  epochSize: number;
  checkpointTurn: number;
  upToTurn: number;
  /** 에포크 경계(turn <= checkpointTurn)에서 동결된 압축 체크포인트 문자열 */
  frozenCompactedEpoch: string;
  /** checkpointTurn 이후 턴들의 순수 추가 전용(append-only) Host-Delta 로그 문자열 */
  deltaLog: string;
  /** turn 층에 실을 경량 현재 활성·별칭·미해결 맞섬 색인 문자열 */
  activeIndex: string;
}

export function formatActiveStateIndex(ledger: LedgerContext, upToTurn?: number): string {
  const activeNums: string[] = [];
  const latestMap: string[] = [];
  for (const [num, ent] of ledger.clausesByNum) {
    if (upToTurn !== undefined && ent.turn > upToTurn) continue;
    const isActive =
      upToTurn === undefined
        ? ent.active
        : (ent.supersededAtTurn === undefined || ent.supersededAtTurn > upToTurn) &&
          (ent.retractedAtTurn === undefined || ent.retractedAtTurn > upToTurn);
    if (isActive) {
      activeNums.push(num);
    } else if (ent.supersededBy && (upToTurn === undefined || (ent.supersededAtTurn ?? ent.turn) <= upToTurn)) {
      let cur = num;
      const seen = new Set<string>([cur]);
      while (true) {
        const curEnt = ledger.clausesByNum.get(cur);
        if (
          !curEnt?.supersededBy ||
          (upToTurn !== undefined && (curEnt.supersededAtTurn ?? curEnt.turn) > upToTurn) ||
          seen.has(curEnt.supersededBy)
        ) {
          break;
        }
        seen.add(curEnt.supersededBy);
        cur = curEnt.supersededBy;
      }
      if (cur !== num) latestMap.push(`${num}⇒${cur}`);
    }
  }
  const conflicts = ledger.unresolvedConflicts(upToTurn).map((oc) => `${oc.clauseNum}↔${oc.targetNum}`);
  const parts = [`[ActiveIndex @${upToTurn ?? 'head'}]`];
  parts.push(`active=${activeNums.length ? activeNums.join(',') : 'none'}`);
  if (latestMap.length) parts.push(`latest=${latestMap.join(',')}`);
  if (conflicts.length) parts.push(`conflicts=${conflicts.join(',')}`);
  return parts.join(' · ');
}

/**
 * 에포크 동결 압축 체크포인트 + 추가 전용(append-only) Host-Delta 뷰 생성기.
 * - `frozenCompactedEpoch`는 `checkpointTurn = floor(upToTurn / epochSize) * epochSize` 시점의 상태만 참조하므로,
 *   에포크 내부 연속 홉에서 선행 절이 `fix→`·`err→`로 갱신되더라도 1바이트도 변하지 않는다.
 * - `deltaLog`는 `checkpointTurn` 이후 턴 레코드를 시간순으로 뒤에 덧붙이기만 한다.
 */
export function buildEpochView(ledger: LedgerContext, opts: EpochViewOptions = {}): EpochLedgerView {
  const epochSize = Math.max(1, Math.floor(Number(opts.epochSize ?? DEFAULT_EPOCH_SIZE) || DEFAULT_EPOCH_SIZE));
  const lang = opts.lang ?? 'en';
  const latestTurn =
    opts.upToTurn !== undefined
      ? Math.max(0, Math.floor(opts.upToTurn))
      : ledger.turnRecords.length > 0
        ? ledger.turnRecords[ledger.turnRecords.length - 1].turn
        : ledger.chain.length > 0
          ? ledger.chain[ledger.chain.length - 1].turn
          : 0;
  const checkpointTurn = Math.floor(latestTurn / epochSize) * epochSize;
  const epoch = Math.floor(checkpointTurn / epochSize);

  const cacheKey = `${checkpointTurn}:${lang}`;
  const cachedMap = (ledger as unknown as { epochCheckpointCache: Map<string, string> }).epochCheckpointCache;
  let frozenCompactedEpoch = cachedMap.get(cacheKey);
  if (frozenCompactedEpoch === undefined) {
    const header = `lon ${SPEC_VERSION} · epoch-checkpoint ${checkpointTurn} · lang ${lang}`;
    frozenCompactedEpoch =
      checkpointTurn === 0
        ? header
        : buildCompactedViewAtTurn(ledger, lang, checkpointTurn, header);
    cachedMap.set(cacheKey, frozenCompactedEpoch);
  }

  const deltaBlocks: string[] = [];
  for (const rec of ledger.turnRecords) {
    if (rec.turn > checkpointTurn && rec.turn <= latestTurn) {
      deltaBlocks.push(rec.deltaBlock);
    }
  }

  return {
    epoch,
    epochSize,
    checkpointTurn,
    upToTurn: latestTurn,
    frozenCompactedEpoch,
    deltaLog: deltaBlocks.join('\n'),
    activeIndex: formatActiveStateIndex(ledger, latestTurn),
  };
}

export function formatEpochLedgerView(ledger: LedgerContext, opts: EpochViewOptions = {}): string {
  const view = buildEpochView(ledger, opts);
  return [view.frozenCompactedEpoch, view.deltaLog].filter(Boolean).join('\n\n');
}
