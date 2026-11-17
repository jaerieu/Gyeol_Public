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
  if (t === 'string') return JSON.stringify(value);
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

export interface LedgerEntry {
  num: string;
  clause: Clause;
  turn: number;
  numericValue: number | null;
  active: boolean;
  supersededBy?: string;
  retractedBy?: string;
  supportedBy?: string[];
}

/**
 * 대역 외 교차 턴(delta / snapshot) 상태 원장.
 * 이전 턴 확정 절·외부근거·수식·[inf] 의존 그래프·활성 충돌(openConflicts)을 O(1)로 조회한다.
 */
export class LedgerContext {
  readonly clausesByNum = new Map<string, LedgerEntry>();
  readonly evidencesByKey = new Map<string, ExtEvidence>();
  readonly calcsById = new Map<string, CalcBlock>();
  readonly depsOf = new Map<string, Set<string>>();
  readonly dependentsMap = new Map<string, Set<string>>();
  readonly openConflicts: OpenConflict[] = [];
  readonly chain: LedgerChainBlock[] = [];
  readonly priorClauses: Clause[] = [];
  readonly priorEvidences: ExtEvidence[] = [];

  get headHash(): string {
    return this.chain.length ? this.chain[this.chain.length - 1].chainHash : '0'.repeat(64);
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
    let cur = num;
    const seen = new Set<string>([cur]);
    while (true) {
      const ent = this.clausesByNum.get(cur);
      const t = ent?.clause.process?.target;
      if (!t || (ent.clause.process?.kind !== 'fix' && ent.clause.process?.kind !== 'err')) break;
      const pNum = t.label.replace(/^[절점]/u, '');
      if (!pNum || seen.has(pNum)) break;
      seen.add(pNum);
      out.push(pNum);
      cur = pNum;
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
}

export function extractOpenConflicts(msg: Message, turn: number): OpenConflict[] {
  const out: OpenConflict[] = [];
  msg.clauses.forEach((c, idx) => {
    const places = c.places?.length ? c.places : c.place ? [c.place] : [];
    const oppose = places.filter((p) => p.rel === '↔');
    if (oppose.length > 0 && c.marks.fig === 'lim') {
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

export async function commitTurn(
  ledger: LedgerContext,
  msg: Message,
  opts: { turn?: number; dictHash?: string; canonicalText?: string } = {},
): Promise<LedgerChainBlock> {
  const turn = opts.turn ?? ledger.chain.length + 1;
  const dictHash = opts.dictHash ?? '0'.repeat(64);

  for (const ev of msg.evidences ?? []) {
    ledger.evidencesByKey.set(`${ev.kind}:${ev.id}`, ev);
    ledger.priorEvidences.push(ev);
  }
  for (const cb of msg.calcs ?? []) ledger.calcsById.set(cb.id, cb);

  msg.clauses.forEach((c, idx) => {
    const num = (c.label ?? `절${ledger.priorClauses.length + idx + 1}`).replace(/^[절점]/u, '');
    // snapshot 중복 캐리 절은 기존 원장 항목을 덮어쓰지 않고 유지한다
    const existing = ledger.clausesByNum.get(num);
    if (!existing) {
      ledger.priorClauses.push(c);
      ledger.clausesByNum.set(num, {
        num,
        clause: c,
        turn,
        numericValue: extractPrimaryNumeric(c),
        active: true,
      });
    }
    for (const ev of c.evidences ?? []) {
      ledger.evidencesByKey.set(`${ev.kind}:${ev.id}`, ev);
      ledger.priorEvidences.push(ev);
    }
    for (const cb of c.calcs ?? []) ledger.calcsById.set(cb.id, cb);

    if (!existing) {
      // 과정 포인터 처리
      if (c.process?.target) {
        const targetNum = c.process.target.label.replace(/^[절점]/u, '');
        const tEnt = ledger.clausesByNum.get(targetNum);
        if (tEnt) {
          if (c.process.kind === 'fix') {
            tEnt.active = false;
            tEnt.supersededBy = num;
          } else if (c.process.kind === 'err') {
            tEnt.active = false;
            tEnt.retractedBy = num;
          } else if (c.process.kind === 'sup') {
            (tEnt.supportedBy ??= []).push(num);
          }
        }
      }

      // 의존성 그래프 등록 (↓N 및 calc @N)
      const deps = new Set<string>();
      for (const b of c.because ?? []) {
        if ('label' in b && b.msg === null && b.thread === undefined) {
          deps.add(b.label.replace(/^[절점]/u, ''));
        }
      }
      for (const cb of c.calcs ?? []) {
        for (const m of cb.expr.matchAll(/@(\d+(?:\.\d+)?)/gu)) deps.add(m[1]);
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

function summarizeSupersededStub(ent: LedgerEntry, ledger: LedgerContext): string {
  const c = ent.clause;
  let summary = c.words.map((w) => w.text).join(' ').replace(/\s+/gu, ' ').trim();
  const firstExt =
    c.evidences?.[0] ??
    (() => {
      const bExt = (c.because ?? []).find((b): b is { ext: 'evd' | 'ref'; id: string } => 'ext' in b);
      return bExt ? ledger.evidencesByKey.get(`${bExt.ext}:${bExt.id}`) : undefined;
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
  const statusTag = ent.retractedBy
    ? `retracted→${ent.retractedBy}`
    : ent.supersededBy
      ? `superseded→${ent.supersededBy}`
      : 'inactive';
  return `<${ent.num} · [${statusTag}] ${summary}${grounds ? ' ' + grounds : ''}>`;
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

  // mode === 'compacted'
  const preserveFullNums = new Set<string>();
  for (const [num, ent] of ledger.clausesByNum) {
    if (ent.active) preserveFullNums.add(num);
  }
  for (const oc of ledger.openConflicts) {
    preserveFullNums.add(oc.clauseNum);
    preserveFullNums.add(oc.targetNum);
  }

  // 활성·충돌 절이 직접(1홉) 또는 수정 사슬을 통해 가리키는 대체·철회 절 집합 수집
  const stubNums = new Set<string>();
  const queue: string[] = [];
  const enqueueStub = (targetNum: string) => {
    if (!targetNum || preserveFullNums.has(targetNum) || stubNums.has(targetNum)) return;
    if (ledger.clausesByNum.has(targetNum)) {
      stubNums.add(targetNum);
      queue.push(targetNum);
    }
  };

  for (const num of preserveFullNums) {
    const ent = ledger.clausesByNum.get(num);
    if (!ent) continue;
    const c = ent.clause;
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
    const c = ent.clause;
    if (c.process?.target && c.process.target.msg === null && c.process.target.thread === undefined) {
      enqueueStub(c.process.target.label.replace(/^[절점]/u, ''));
    }
  }

  const lines: string[] = [`lon ${SPEC_VERSION} · snapshot · lang ${lang}`];
  const emittedEvKeys = new Set<string>();
  const pendingTopEvs: ExtEvidence[] = [];

  for (const c of ledger.priorClauses) {
    const num = (c.label ?? '').replace(/^[절점]/u, '');
    if (preserveFullNums.has(num)) {
      lines.push(clauseText03(c, true));
      for (const ev of c.evidences ?? []) {
        emittedEvKeys.add(`${ev.kind}:${ev.id}`);
      }
      for (const b of c.because ?? []) {
        if ('ext' in b) {
          const k = `${b.ext}:${b.id}`;
          if (!emittedEvKeys.has(k)) {
            const topEv = ledger.evidencesByKey.get(k);
            if (topEv) {
              emittedEvKeys.add(k);
              pendingTopEvs.push(topEv);
            }
          }
        }
      }
    } else if (stubNums.has(num)) {
      const ent = ledger.clausesByNum.get(num);
      if (ent) lines.push(summarizeSupersededStub(ent, ledger));
    }
  }

  for (const ev of pendingTopEvs) {
    lines.push(`${ev.kind}${ev.id} ${formatExtFence(ev.text)}`);
  }

  return lines.join('\n');
}
