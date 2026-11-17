// 결 v0.8.5 — 결정론적 파생 수식 블록(calcN / 식N) 재귀 하강 평가기, 검증기 및 연쇄 재계산 전파기
// eval() / new Function()을 전혀 사용하지 않는 순수 TypeScript 산술 평가기다.

import type { CalcBlock, Clause, Diagnostic, Message } from './types.ts';
import { tierOfCode } from './tables.ts';
import { formatExtFence } from './parse/shared.ts';

type Tok =
  | { k: 'num'; v: number }
  | { k: 'ref'; label: string }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'lp' }
  | { k: 'rp' }
  | { k: 'comma' };

const ALLOWED_FUNCS = new Set(['round', 'floor', 'ceil', 'abs', 'min', 'max']);

function tokenize(expr: string): Tok[] {
  const s = String(expr ?? '').trim();
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/u.test(ch)) {
      i++;
      continue;
    }
    if (ch === '(') { out.push({ k: 'lp' }); i++; continue; }
    if (ch === ')') { out.push({ k: 'rp' }); i++; continue; }
    if (ch === ',') { out.push({ k: 'comma' }); i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      out.push({ k: 'op', v: ch });
      i++;
      continue;
    }
    if (ch === '×') { out.push({ k: 'op', v: '*' }); i++; continue; }
    if (ch === '÷') { out.push({ k: 'op', v: '/' }); i++; continue; }
    if (ch === '−') { out.push({ k: 'op', v: '-' }); i++; continue; }
    if (ch === '@') {
      const m = /^@([0-9]+(?:\.[0-9]+)?)/u.exec(s.slice(i));
      if (!m) throw new Error(`잘못된 절 참조: '${s.slice(i, i + 8)}'`);
      out.push({ k: 'ref', label: m[1] });
      i += m[0].length;
      continue;
    }
    if (/[0-9.]/u.test(ch)) {
      const m = /^(?:\d+(?:_\d{3})*(?:\.\d+)?|\.\d+)/u.exec(s.slice(i));
      if (!m) throw new Error(`잘못된 숫자 표기: '${s.slice(i, i + 10)}'`);
      const num = Number(m[0].replaceAll('_', ''));
      if (!Number.isFinite(num)) throw new Error(`유한하지 않은 수: '${m[0]}'`);
      out.push({ k: 'num', v: num });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_]/u.test(ch)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/u.exec(s.slice(i))!;
      out.push({ k: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    throw new Error(`허용되지 않은 문자 '${ch}'`);
  }
  return out;
}

export interface EvalResult {
  ok: boolean;
  value?: number;
  deps: string[];
  declared?: number;
  error?: string;
}

/** `calcN <[ expr (= declared)? ]>` 문자열을 식과 선택적 선언값으로 분리한다. */
export function splitCalcExpression(rawText: string): { expr: string; declared?: number } {
  const s = String(rawText ?? '').trim();
  // 우변 선언(`@1 * @2 = 960`) 지원
  const eqIdx = s.lastIndexOf('=');
  if (eqIdx > 0 && s[eqIdx - 1] !== '<' && s[eqIdx - 1] !== '>' && s[eqIdx - 1] !== '!' && s[eqIdx + 1] !== '=') {
    const rhs = s.slice(eqIdx + 1).trim();
    const numM = /^([+\-−]?\d+(?:,\d{3})*(?:\.\d+)?)$/u.exec(rhs);
    if (numM) {
      const declared = Number(numM[1].replaceAll(',', '').replace('−', '-'));
      if (Number.isFinite(declared)) {
        return { expr: s.slice(0, eqIdx).trim(), declared };
      }
    }
  }
  return { expr: s };
}

/**
 * 순수 재귀 하강 산술 평가기.
 * @param rawExpr 수식 문자열 (예: "@1 * 0.8 + round(@2 / 3, 2)")
 * @param resolveRef 절 번호('1', '3.1') → 숫자 해석 콜백
 */
export function evaluateCalcExpression(
  rawExpr: string,
  resolveRef: (clauseNum: string) => number | null | undefined,
): EvalResult {
  const { expr, declared } = splitCalcExpression(rawExpr);
  if (!expr) return { ok: false, deps: [], error: '빈 수식이다' };
  let toks: Tok[];
  try {
    toks = tokenize(expr);
  } catch (e) {
    return { ok: false, deps: [], error: (e as Error).message };
  }
  if (!toks.length) return { ok: false, deps: [], error: '빈 수식이다' };

  const deps = new Set<string>();
  let pos = 0;
  const peek = () => toks[pos];
  const take = () => toks[pos++];

  function parseExpr(): number {
    let left = parseTerm();
    while (peek()?.k === 'op' && (peek() as { k: 'op'; v: string }).v.match(/^[+\-]$/)) {
      const op = (take() as { k: 'op'; v: string }).v;
      const right = parseTerm();
      left = op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number {
    let left = parseUnary();
    while (peek()?.k === 'op' && (peek() as { k: 'op'; v: string }).v.match(/^[*\/%]$/)) {
      const op = (take() as { k: 'op'; v: string }).v;
      const right = parseUnary();
      if ((op === '/' || op === '%') && right === 0) throw new Error('0으로 나눌 수 없다');
      left = op === '*' ? left * right : op === '/' ? left / right : left % right;
    }
    return left;
  }

  function parseUnary(): number {
    const t = peek();
    if (t?.k === 'op' && (t.v === '+' || t.v === '-')) {
      take();
      const v = parseUnary();
      return t.v === '-' ? -v : v;
    }
    return parsePrimary();
  }

  function parsePrimary(): number {
    const t = peek();
    if (!t) throw new Error('수식이 예기치 않게 끝났다');
    if (t.k === 'num') {
      take();
      return t.v;
    }
    if (t.k === 'ref') {
      take();
      deps.add(t.label);
      const val = resolveRef(t.label);
      if (val == null || !Number.isFinite(val)) {
        throw new Error(`절 @${t.label}의 수치를 찾을 수 없다`);
      }
      return val;
    }
    if (t.k === 'lp') {
      take();
      const v = parseExpr();
      if (peek()?.k !== 'rp') throw new Error("닫는 괄호 ')'가 없다");
      take();
      return v;
    }
    if (t.k === 'id') {
      take();
      if (!ALLOWED_FUNCS.has(t.v)) throw new Error(`허용되지 않은 함수·식별자 '${t.v}'`);
      if (peek()?.k !== 'lp') throw new Error(`함수 '${t.v}' 뒤에 '('가 필요하다`);
      take();
      const args: number[] = [];
      if (peek()?.k !== 'rp') {
        args.push(parseExpr());
        while (peek()?.k === 'comma') {
          take();
          args.push(parseExpr());
        }
      }
      if (peek()?.k !== 'rp') throw new Error(`함수 '${t.v}'의 닫는 ')'가 없다`);
      take();
      if (!args.length) throw new Error(`함수 '${t.v}'에 인자가 필요하다`);
      switch (t.v) {
        case 'round': {
          const digits = args[1] != null ? Math.max(0, Math.min(10, Math.trunc(args[1]))) : 0;
          const factor = 10 ** digits;
          return Math.round(args[0] * factor) / factor;
        }
        case 'floor': return Math.floor(args[0]);
        case 'ceil': return Math.ceil(args[0]);
        case 'abs': return Math.abs(args[0]);
        case 'min': return Math.min(...args);
        case 'max': return Math.max(...args);
        default: throw new Error(`알 수 없는 함수 '${t.v}'`);
      }
    }
    throw new Error('수식 구문 오류');
  }

  try {
    const value = parseExpr();
    if (pos < toks.length) throw new Error('수식 뒤에 남은 토큰이 있다');
    if (!Number.isFinite(value)) throw new Error('계산 결과가 유한하지 않다');
    return {
      ok: true,
      value: Math.round(value * 1e10) / 1e10,
      deps: [...deps],
      ...(declared !== undefined ? { declared } : {}),
    };
  } catch (e) {
    return { ok: false, deps: [...deps], error: (e as Error).message };
  }
}

const DATE_OR_TIME_RE = /\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/gu;
const TAG_OR_CODE_RE = /\b(?:evd|ref|calc|Q|T)\d+(?:\.\d+)?\b|[A-Za-z]+[-_/]\d+[A-Za-z0-9\-_/]*|[A-Za-z]\d+/giu;

/** 절 본문 텍스트에서 식별자·날짜·태그가 아닌 독립 정량 수치 목록을 추출한다. */
export function extractNumbersFromClause(clause: Clause): number[] {
  const raw = clause.words.map((w) => w.text).join(' ');
  const cleaned = raw
    .replace(/`[^`]*`/gu, ' ')
    .replace(DATE_OR_TIME_RE, ' ')
    .replace(TAG_OR_CODE_RE, ' ');
  const out: number[] = [];
  for (const m of cleaned.matchAll(/(?<![A-Za-z0-9_])[+\-−]?\d+(?:,\d{3})*(?:\.\d+)?(?![A-Za-z0-9_])/gu)) {
    const num = Number(m[0].replaceAll(',', '').replace('−', '-'));
    if (Number.isFinite(num)) out.push(num);
  }
  return out;
}

export function extractPrimaryNumeric(clause: Clause): number | null {
  if (clause.calcs?.length && clause.calcs[0].declared !== undefined) {
    return clause.calcs[0].declared;
  }
  const nums = extractNumbersFromClause(clause);
  return nums.length ? nums[nums.length - 1] : null;
}

export interface CalcVerifyContext {
  /** 기존 원장·앞 차례의 유효 절 번호 -> Clause 맵 */
  priorClauseByNum?: ReadonlyMap<string, Clause>;
  /** 기존 원장·앞 차례에서 이미 다른 fix→로 대체되거나 err→로 철회된 절 집합 */
  alreadySuperseded?: ReadonlySet<string>;
  /** 상위 절 k -> 이를 참조하는 기존 활성 [inf] 절 목록 */
  dependentsOf?: (num: string) => readonly Clause[];
}

export function numbersMatch(a: number, b: number): boolean {
  const tol = Math.max(1e-4, 1e-5 * Math.max(Math.abs(a), Math.abs(b)));
  return Math.abs(a - b) <= tol;
}

function buildLatestFixAliases(clausesByNum: ReadonlyMap<string, Clause>): Map<string, string> {
  const direct = new Map<string, string>();
  for (const [k, c] of clausesByNum) {
    if (c.process?.kind === 'fix' && c.process.target) {
      const targetNum = c.process.target.label.replace(/^[절점]/u, '');
      if (targetNum && targetNum !== k) direct.set(targetNum, k);
    }
  }
  const resolved = new Map<string, string>();
  for (const orig of direct.keys()) {
    let cur = orig;
    const seen = new Set<string>([cur]);
    while (direct.has(cur)) {
      const next = direct.get(cur)!;
      if (seen.has(next)) break;
      seen.add(next);
      cur = next;
    }
    resolved.set(orig, cur);
  }
  return resolved;
}

/** 메시지 안의 모든 calcN 블록을 평가·대조하고, 상위 fix→/err→ 변경 시 미갱신 하위 [inf] 절에 E_STALE_INF를 발행한다. */
export function verifyMessageCalculations(
  msg: Message,
  ctx: CalcVerifyContext = {},
): { diagnostics: Diagnostic[]; evaluated: Map<string, number> } {
  const diagnostics: Diagnostic[] = [];
  const evaluated = new Map<string, number>();

  const clauseByNum = new Map<string, Clause>();
  if (ctx.priorClauseByNum) {
    for (const [k, v] of ctx.priorClauseByNum) clauseByNum.set(k, v);
  }
  const currentClauseNums = new Set<string>();
  msg.clauses.forEach((c, idx) => {
    const num = (c.label ?? `절${idx + 1}`).replace(/^[절점]/u, '');
    clauseByNum.set(num, c);
    currentClauseNums.add(num);
  });
  const fixAliases = buildLatestFixAliases(clauseByNum);

  // calcN 인덱스(메시지 전체 또는 절 부착)
  const calcById = new Map<string, CalcBlock>();
  for (const cb of msg.calcs ?? []) calcById.set(cb.id, cb);
  for (const c of msg.clauses) for (const cb of c.calcs ?? []) calcById.set(cb.id, cb);

  const visiting = new Set<string>();
  const resolveValue = (rawNum: string): number | null => {
    const num = fixAliases.get(rawNum) ?? rawNum;
    if (evaluated.has(num)) return evaluated.get(num)!;
    if (visiting.has(num)) return null; // 순환 참조 방지
    const c = clauseByNum.get(num);
    if (!c) return null;
    visiting.add(num);
    const attachedCalc = c.calcs?.[0] ?? (() => {
      const refCalc = (c.because ?? []).find((b): b is { calc: string } => 'calc' in b);
      return refCalc ? calcById.get(refCalc.calc) : undefined;
    })();
    let val: number | null = null;
    if (attachedCalc) {
      const ev = evaluateCalcExpression(attachedCalc.expr, resolveValue);
      if (ev.ok && ev.value !== undefined) {
        val = ev.value;
        evaluated.set(num, val);
      }
    }
    if (val === null) val = extractPrimaryNumeric(c);
    visiting.delete(num);
    if (val !== null) evaluated.set(num, val);
    return val;
  };

  msg.clauses.forEach((c, idx) => {
    const line = idx + 1;
    const num = (c.label ?? `절${idx + 1}`).replace(/^[절점]/u, '');
    const calcBlocks: CalcBlock[] = [...(c.calcs ?? [])];
    for (const b of c.because ?? []) {
      if ('calc' in b) {
        const found = calcById.get(b.calc);
        if (found && !calcBlocks.includes(found)) calcBlocks.push(found);
      }
    }
    for (const cb of calcBlocks) {
      const ev = evaluateCalcExpression(cb.expr, resolveValue);
      if (!ev.ok || ev.value === undefined) {
        diagnostics.push({
          code: 'E_CALC_SYNTAX',
          severity: '오류',
          tier: tierOfCode('E_CALC_SYNTAX'),
          line,
          message: `파생 수식 ${cb.id} 구문·바인딩 오류: ${ev.error ?? '알 수 없는 오류'}`,
        });
        continue;
      }
      evaluated.set(num, ev.value);
      if (ev.declared !== undefined && !numbersMatch(ev.declared, ev.value)) {
        diagnostics.push({
          code: 'E_CALC_MISMATCH',
          severity: '오류',
          tier: tierOfCode('E_CALC_MISMATCH'),
          line,
          message: `파생 수식 ${cb.id} 계산 불일치: 선언값 ${ev.declared}, 실제 계산값 ${ev.value}`,
        });
      }
      const clauseNums = extractNumbersFromClause(c);
      if (clauseNums.length > 0 && !clauseNums.some((n) => numbersMatch(n, ev.value!))) {
        diagnostics.push({
          code: 'E_CALC_MISMATCH',
          severity: '오류',
          tier: tierOfCode('E_CALC_MISMATCH'),
          line,
          message: `절 <${num}> 본문 수치(${clauseNums.join(', ')})가 파생 수식 ${cb.id} 결과(${ev.value})와 다르다(기대값 ${ev.value})`,
        });
      }
    }
  });

  // 상위 절 변경 시 하위 [inf] 미갱신(E_STALE_INF) 검사
  const modifiedTargets = new Set<string>();
  const fixedOrErredInTurn = new Set<string>();
  for (const c of msg.clauses) {
    if ((c.process?.kind === 'fix' || c.process?.kind === 'err') && c.process.target) {
      const tNum = c.process.target.label.replace(/^[절점]/u, '');
      modifiedTargets.add(tNum);
      fixedOrErredInTurn.add(tNum);
    }
  }

  if (modifiedTargets.size > 0 && ctx.dependentsOf) {
    const queue = [...modifiedTargets];
    const visited = new Set<string>(modifiedTargets);
    while (queue.length) {
      const up = queue.shift()!;
      for (const dep of ctx.dependentsOf(up)) {
        const depNum = (dep.label ?? '').replace(/^[절점]/u, '');
        if (!depNum || visited.has(depNum)) continue;
        visited.add(depNum);
        if (ctx.alreadySuperseded?.has(depNum)) continue;
        if (dep.marks.ev === 'inf' && !fixedOrErredInTurn.has(depNum)) {
          diagnostics.push({
            code: 'E_STALE_INF',
            severity: '오류',
            tier: tierOfCode('E_STALE_INF'),
            line: msg.clauses.length || 1,
            message: `상위 절 <${up}>이 변경되었으나 의존 추론 절 <${depNum}>이 fix→${depNum} 또는 err→${depNum}으로 갱신되지 않았다`,
          });
        }
        queue.push(depNum);
      }
    }
  }

  return { diagnostics, evaluated };
}

export interface PropagatedFix {
  targetNum: string;
  newNum: string;
  oldValue: number | null;
  newValue: number;
  line: string;
}

export interface PropagateOptions {
  activeClauses: ReadonlyMap<string, Clause>;
  /** 전체 누적 절 맵(다중 홉 체인 1 -> 15 -> 28 최신 별칭 추적용). 생략 시 activeClauses 사용 */
  allClauses?: ReadonlyMap<string, Clause>;
  dependentsOf: (num: string) => readonly Clause[];
  changedTargets: readonly string[];
  nextClauseNumStart: number;
  profile?: 'gyeol' | 'lon';
  defaultTail?: string;
}

export interface PropagateLedgerSource {
  activeClausesMap(): Map<string, Clause>;
  readonly priorClauseMap: Map<string, Clause>;
  readonly priorClauses: readonly Clause[];
  dependentsOf: (num: string) => readonly Clause[];
}

function formatRecomputedBody(dep: Clause, oldVal: number | null, newVal: number): string {
  const oldWords = dep.words.map((w) => w.text).join(' ').trim();
  const numTokRe = /(?<![A-Za-z0-9_])[+\-−]?\d+(?:,\d{3})*(?:\.\d+)?(?![A-Za-z0-9_])/gu;
  const matches = [...oldWords.matchAll(numTokRe)];
  let chosen: RegExpExecArray | undefined;
  if (oldVal !== null) {
    for (let i = matches.length - 1; i >= 0; i--) {
      const parsed = Number(matches[i][0].replaceAll(',', '').replace('−', '-'));
      if (Number.isFinite(parsed) && numbersMatch(parsed, oldVal)) {
        chosen = matches[i];
        break;
      }
    }
  }
  if (!chosen && matches.length > 0) chosen = matches[matches.length - 1];
  if (!chosen || chosen.index === undefined) {
    const cleanLabel = oldWords.replace(/\s*[:=]\s*$/u, '').trim();
    return cleanLabel ? `${cleanLabel}=${newVal}` : String(newVal);
  }
  const before = oldWords
    .slice(0, chosen.index)
    .replace(/\s*(?:=|is|recomputed(?:\s+to)?|revised(?:\s+to)?|updated(?:\s+to)?|:)\s*$/iu, '')
    .trim();
  const after = oldWords.slice(chosen.index + chosen[0].length).trim();
  if (!before) return `${newVal}${after ? ' ' + after : ''}`;
  return `${before}=${newVal}${after ? ' ' + after : ''}`;
}

function inferTailForDerived(dep: Clause, profile: 'gyeol' | 'lon', defaultTail?: string): string {
  if (defaultTail) return defaultTail;
  if (profile === 'lon') {
    const conf = dep.conf ?? (dep.chae?.self !== undefined ? Math.max(0, Math.min(9, Math.round(dep.chae.self * 10))) : 9);
    const mukTok = dep.muk?.unmeasured ? '?' : dep.muk?.conf !== undefined ? String(Math.max(0, Math.min(9, Math.round(dep.muk.conf * 10)))) : '';
    return `*${mukTok}:${conf}`;
  }
  const conf = dep.chae?.self !== undefined ? Math.max(0, Math.min(9, Math.round(dep.chae.self * 10))) : 8;
  const col = dep.chae?.color ?? 'B';
  return `*${col}${conf}`;
}

/**
 * 상위 절이 fix→k로 바뀌었을 때, calcN 수식이 결합된 하위 활성 [inf] 절들을 위상 정렬 순서대로 자동 재계산해
 * 비파괴 추가(`append`) 방식의 결정론적 `fix→q` 갱신 절 목록을 생성한다.
 * - `propagateCalculations(ledger, turnAst?, extraOpts?)` 및 `propagateCalculations(opts)` 두 호출 형식을 모두 지원한다.
 * - 기존 절을 제자리 덮어쓰지 않고 새 절 번호 `q'`를 부여하며, `↓` 근거와 `@` 참조를 모두 최신 활성 절 번호로 갱신한다.
 */
export function propagateCalculations(
  ledgerOrOpts: PropagateOptions | PropagateLedgerSource,
  turnAst?: Message | null,
  extraOpts: { nextClauseNumStart?: number; profile?: 'gyeol' | 'lon'; defaultTail?: string } = {},
): PropagatedFix[] {
  let opts: PropagateOptions;
  const alreadyUpdatedInTurn = new Map<string, Clause>();
  if ('activeClausesMap' in ledgerOrOpts) {
    const activeMap = ledgerOrOpts.activeClausesMap();
    const allMap = ledgerOrOpts.priorClauseMap;
    for (const c of turnAst?.clauses ?? []) {
      const cNum = (c.label ?? '').replace(/^[절점]/u, '');
      if (cNum && !allMap.has(cNum)) {
        allMap.set(cNum, c);
        activeMap.set(cNum, c);
        if (c.process?.kind === 'fix' && c.process.target) {
          activeMap.delete(c.process.target.label.replace(/^[절점]/u, ''));
        } else if (c.process?.kind === 'err' && c.process.target) {
          activeMap.delete(c.process.target.label.replace(/^[절점]/u, ''));
        }
      }
      if (c.process?.kind === 'fix' && c.process.target && c.marks.ev === 'inf') {
        alreadyUpdatedInTurn.set(c.process.target.label.replace(/^[절점]/u, ''), c);
      }
    }
    const changedTargets: string[] = [];
    for (const c of turnAst?.clauses ?? []) {
      if (c.process?.kind === 'fix' && c.process.target) {
        const tNum = c.process.target.label.replace(/^[절점]/u, '');
        if (tNum) changedTargets.push(tNum);
      }
    }
    let maxExisting = 0;
    for (const k of allMap.keys()) {
      const n = Math.floor(Number(k) || 0);
      if (n > maxExisting) maxExisting = n;
    }
    for (const c of turnAst?.clauses ?? []) {
      const n = Math.floor(Number((c.label ?? '').replace(/^[절점]/u, '')) || 0);
      if (n > maxExisting) maxExisting = n;
    }
    opts = {
      activeClauses: activeMap,
      allClauses: allMap,
      dependentsOf: ledgerOrOpts.dependentsOf,
      changedTargets,
      nextClauseNumStart: extraOpts.nextClauseNumStart ?? (maxExisting + 1),
      profile: extraOpts.profile ?? (turnAst?.profile === 'lon' ? 'lon' : 'lon'),
      defaultTail: extraOpts.defaultTail,
    };
  } else {
    opts = ledgerOrOpts;
  }

  const profile = opts.profile ?? 'gyeol';
  const fixes: PropagatedFix[] = [];
  const fullClauses = opts.allClauses ?? opts.activeClauses;
  const fixAliases = buildLatestFixAliases(fullClauses);

  const resolveLatest = (rawNum: string): string => {
    let cur = rawNum;
    const seen = new Set<string>([cur]);
    while (fixAliases.has(cur)) {
      const nxt = fixAliases.get(cur)!;
      if (seen.has(nxt)) break;
      seen.add(nxt);
      cur = nxt;
    }
    return cur;
  };

  const tempValues = new Map<string, number>();
  for (const [k, c] of fullClauses) {
    const n = extractPrimaryNumeric(c);
    if (n !== null) tempValues.set(k, n);
  }
  for (const [k, c] of opts.activeClauses) {
    const n = extractPrimaryNumeric(c);
    if (n !== null) tempValues.set(k, n);
  }
  for (const [origNum] of fixAliases) {
    const latestNum = resolveLatest(origNum);
    const v = tempValues.get(latestNum);
    if (v !== undefined) tempValues.set(origNum, v);
  }

  const visited = new Set<string>();
  const queue = [...opts.changedTargets];
  let nextNum = opts.nextClauseNumStart;

  while (queue.length) {
    const up = queue.shift()!;
    for (const dep of opts.dependentsOf(up)) {
      const rawDepNum = (dep.label ?? '').replace(/^[절점]/u, '');
      if (!rawDepNum) continue;
      // 만약 이 턴에서 LLM이 이미 rawDepNum을 fix→로 갱신했다면, 그 새 절이 정확한지 확인한다
      const turnUpd = alreadyUpdatedInTurn.get(rawDepNum);
      const effectiveDep = turnUpd ?? dep;
      const depNum = (effectiveDep.label ?? rawDepNum).replace(/^[절점]/u, '');
      if (!depNum || visited.has(depNum)) continue;
      visited.add(depNum);
      visited.add(rawDepNum);

      const cb = effectiveDep.calcs?.[0] ?? dep.calcs?.[0];
      if (!cb) continue;
      const ev = evaluateCalcExpression(cb.expr, (ref) => {
        const latestRef = resolveLatest(ref);
        return tempValues.get(latestRef) ?? tempValues.get(ref) ?? null;
      });
      if (!ev.ok || ev.value === undefined) continue;
      const curVal = extractPrimaryNumeric(effectiveDep);
      if (curVal !== null && numbersMatch(curVal, ev.value)) {
        // 이미 최신 값과 일치하면(예: 턴 안에서 정확히 갱신됨) 연쇄 하위 전파만 이어간다
        tempValues.set(depNum, ev.value);
        tempValues.set(rawDepNum, ev.value);
        queue.push(depNum);
        continue;
      }

      const oldVal = curVal ?? tempValues.get(depNum) ?? null;
      const newIdNum = String(nextNum++);
      fixAliases.set(depNum, newIdNum);
      fixAliases.set(rawDepNum, newIdNum);
      tempValues.set(depNum, ev.value);
      tempValues.set(rawDepNum, ev.value);
      tempValues.set(newIdNum, ev.value);

      const updatedWords = formatRecomputedBody(effectiveDep, oldVal, ev.value);
      const exprBase = splitCalcExpression(cb.expr).expr;
      const rewrittenExpr = exprBase.replace(/@(\d+(?:\.\d+)?)/gu, (_, refId: string) => `@${resolveLatest(refId)}`);

      // 최신 활성 근거 절 포인터 수집 (calc 참조 @k + 기존 ↓절번호/↓evd 중복 제거, calc보다 절·외부근거를 앞에 배치)
      const latestClauseRefs: string[] = [];
      const extRefs: string[] = [];
      const addClauseRef = (r: string) => {
        const latest = resolveLatest(r);
        if (latest && latest !== newIdNum && latest !== depNum && !latestClauseRefs.includes(latest)) {
          latestClauseRefs.push(latest);
        }
      };
      for (const b of effectiveDep.because ?? dep.because ?? []) {
        if ('label' in b && b.msg === null && b.thread === undefined) {
          addClauseRef(b.label.replace(/^[절점]/u, ''));
        } else if ('ext' in b) {
          const tag = `${b.ext}${b.id}`;
          if (!extRefs.includes(tag)) extRefs.push(tag);
        }
      }
      for (const m of exprBase.matchAll(/@(\d+(?:\.\d+)?)/gu)) {
        addClauseRef(m[1]);
      }

      const tail = inferTailForDerived(effectiveDep, profile, opts.defaultTail);
      const refsStr = [...latestClauseRefs.map((r) => `↓${r}`), ...extRefs.map((e) => `↓${e}`)].join('');
      const calcId = `calc${newIdNum}`;
      const line = `<${newIdNum} · fix→${depNum} [inf,say] ${updatedWords} ${tail}${refsStr}> ${calcId} ${formatExtFence(rewrittenExpr)}`;
      fixes.push({ targetNum: depNum, newNum: newIdNum, oldValue: oldVal, newValue: ev.value, line });
      queue.push(depNum);
      queue.push(newIdNum);
    }
  }
  return fixes;
}
