import { nonStandardChars } from './script.ts';
// 결 v0.2 — 핵 추출과 비교, 이체자, 접는 수준, 맥놀이. spec/07-tuning.md, spec/02-text.md 2.6절.

import type { Clause, FoldLevel } from './types.ts';
import { FOLD_BANDS } from './tables.ts';

/** 이체자 대응표: 글자 → 같은 글자로 보는 정자들. dict/variants-v0.2.json 의 "map". */
export type VariantTable = Record<string, string[]>;

export interface Core {
  roots: string; // 어근을 글자 단위로 이어 붙인 것
  ev?: string;
  act: string;
}

export function coreOf(c: Clause): Core {
  const roots = c.words
    .filter((w) => w.root)
    .map((w) => w.root!)
    .join('');
  const core: Core = { roots, act: c.marks.act ?? '' }; // 받은대로 절은 화행이 없을 수 있다
  if (c.marks.ev) core.ev = c.marks.ev;
  return core;
}

/** 글자 하나가 가리키는 정자 집합: 자기 자신 + 대응표의 정자들. */
function anchors(ch: string, table?: VariantTable): Set<string> {
  const s = new Set<string>([ch]);
  for (const t of table?.[ch] ?? []) s.add(t);
  return s;
}

export function sameChar(a: string, b: string, table?: VariantTable): boolean {
  if (a === b) return true;
  const A = anchors(a, table);
  for (const x of anchors(b, table)) if (A.has(x)) return true;
  return false;
}

/** 두 어근 글자열이 이체자를 같게 보았을 때 같은가. 로마자는 그대로 비교한다. */
export function sameRoots(a: string, b: string, table?: VariantTable): boolean {
  const A = Array.from(a);
  const B = Array.from(b);
  if (A.length !== B.length) return false;
  return A.every((ch, i) => sameChar(ch, B[i], table));
}

/** 기계적 핵 비교(7.3절 끝). 뜻으로 하는 판정을 대신하지 않는다. */
export function sameCore(a: Core, b: Core, table?: VariantTable): boolean {
  return (a.ev ?? '') === (b.ev ?? '') && a.act === b.act && sameRoots(a.roots, b.roots, table);
}

/** 핵 일치율 → 접는 수준(7.4절). */
export function foldLevelFor(agreement: number): FoldLevel {
  if (agreement >= FOLD_BANDS.점) return '점';
  if (agreement >= FOLD_BANDS.절) return '절';
  return '펼침';
}

/** 조율음의 맥놀이(Hz) = 8 × (1 − 일치율)(7.6절). */
export function beatHz(agreement: number): number {
  return Math.round(8 * (1 - agreement) * 100) / 100;
}

/** 절과 받은대로의 어근에서 기준 글꼴(간체)이 아닌 글자를 찾아 경고(W03)로 돌려준다. map: "to_simplified". */
export function variantWarnings(msg: import('./types.ts').Message, map: Record<string, string>): import('./types.ts').Diagnostic[] {
  const out: import('./types.ts').Diagnostic[] = [];
  const scan = (words: { root?: string }[], where: string) => {
    for (const w of words) {
      if (!w.root) continue;
      for (const ch of nonStandardChars(w.root, map)) {
        out.push({ code: 'W03', severity: '경고', line: 0, message: `${where}의 '${ch}'는 기준 글꼴(간체)이 아니다. 간체: ${map[ch]}` });
      }
    }
  };
  msg.clauses.forEach((c, i) => scan(c.words, c.label ?? `절${i + 1}`));
  msg.echo.forEach((e) => scan(e.words, '받은대로'));
  return out;
}
