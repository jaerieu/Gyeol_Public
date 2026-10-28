// 보관된 결 줄 하나하나를 따로 읽은 판정. 스냅숏(corpus-verdicts.json)과 견주는 시험(tests/corpus.test.ts)과 만드는 도구(tools/corpus-snapshot.ts)가 함께 쓴다.

import { parse, format } from '../../src/index.ts';
import { PLAZA, QUIZ } from './corpus-2026-10-14.ts';

export interface Verdict {
  src: 'plaza' | 'quiz';
  line: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
  canon: string | null;
}

export function verdictOf(line: string, src: Verdict['src']): Verdict {
  const r = parse(line);
  const codes = (sev: string) => r.diagnostics.filter((d) => d.severity === sev).map((d) => d.code).sort();
  let canon: string | null = null;
  if (r.ok) {
    try {
      canon = format(r.message);
    } catch (e) {
      canon = `!${(e as Error).message}`;
    }
  }
  return { src, line: line.length > 200 ? `${line.slice(0, 200)}…(${line.length}자)` : line, ok: r.ok, errors: codes('오류'), warnings: codes('경고'), canon };
}

export function verdicts(): Verdict[] {
  return [...PLAZA.map((l) => verdictOf(l, 'plaza')), ...QUIZ.map((l) => verdictOf(l, 'quiz'))];
}
