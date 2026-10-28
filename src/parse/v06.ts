// 결 v0.6 쓰기 규칙(2026-10-24, 실험적, reports/v0.6-design.md 3). 읽기(parse)는 v0.6 꼴도 읽고, 새로 쓰는 줄에만 더 지킬 것을 본다.
//   rules06 = rules051 − W27 + E34 + W34 + W35 (+ W23을 다중 지목의 모든 이름에)
//   - W27(절 하나 24어절)은 없앤다(2026-10-24 Jae). rules05·rules051의 W27은 옛 회차 채점용으로 그대로 둔다.
//   - E34: 근거 ↓N이 근거가 될 수 없는 절(근거 자리가 촉·갑)을 가리킨다. 옛 줄에도 [촉,…] 절을 ↓로 가리킨 것이 있을 수 있어
//          검사기(parse)가 아니라 여기에 둔다(옛 판정이 바뀌지 않게). 광장 중계 checkLine은 앞 글 줄과 새 줄을 한 메시지로 읽으므로
//          같은 메시지 안과 앞 차례의 절을 한 길로 본다. 지난 대화의 절(↓53:12)은 그 대화를 읽지 않아 보지 않는다.
//   - W34: 표지 블록을 정규 순서 [근거,군,결,시제,화행]에서 벗어나게 썼다(written.marksOff). 뜻은 그대로 읽는다.
//          근거: D1 site_posts 10-18~10-23 표지 둘 이상 블록 약 715개 가운데 벗어난 것 7개. E09로 올리는 것은 계측(H-261024-8) 뒤에.
//   - W35: 다중 지목 ·→A,B에 같은 이름이 두 번이거나 이름이 TO_MAX(3)를 넘는다.
//   - W36(2026-10-25 덧붙임, H-261025-8, reports/hunch-design.md 3.2): 받침→N의 대상 절(같은 메시지, 광장은 앞 차례 포함)이 촉·갑 절이 아니다.
//          촉·갑이 아닌 절은 ↓로 근거 삼으면 된다. 대상의 표지를 읽어야 해서 E34처럼 여기에 둔다. 지난 대화 받침→53:12는 보지 않는다.
//          받침 절 자체의 규칙(근거 자리가 촉·갑, ↓근거 없음)은 검사기 E37이 본다.
// parse()의 판정·정규형·먹 이름은 바꾸지 않는다. 부르는 쪽(광장·쪽지 시험)은 reports/v0.6-design.md 8절 몫 A·C에서 rules051 대신 이것을 부른다.

import type { Clause, Diagnostic, ParseResult } from '../types.ts';
import { TO_MAX } from '../tables.ts';
import { rules051 } from './v05.ts';

type Opts = { sender?: string | null; from?: number };

/** 근거가 될 수 없는 절의 근거 자리(E34). 받침→N이 받치는 절이기도 하다(W36). 2026-10-25: 촉의 풀이를 직관에서 직감으로 바로잡았다(H-261025-8) */
const NOT_GROUND: Record<string, string> = { 촉: '직감(촉)', 갑: '새 화두(갑)' };

/** 절 번호(이름표 절N·점N의 N, 이름표가 없으면 차례 번호)로 찾는다. 새 꼴의 가리킴은 절N과 점N을 같게 본다(parse.ts checkMessage와 같다) */
function byNumber(clauses: Clause[]): Map<string, Clause> {
  const m = new Map<string, Clause>();
  clauses.forEach((c, i) => {
    const n = (c.label ?? `절${i + 1}`).slice(1);
    if (!m.has(n)) m.set(n, c);
  });
  return m;
}

/** 표지 블록의 정규 순서 글(W34 알림에 보인다) */
function canonMarks(c: Clause): string {
  const m = c.marks;
  return `[${[m.ev, m.news ? '군' : undefined, m.fig, m.tense, m.act].filter(Boolean).join(',')}]`;
}

export function rules06(r: ParseResult, opts: Opts = {}): Diagnostic[] {
  const out = rules051(r, opts).filter((d) => d.code !== 'W27');
  const clauses = r.message.clauses;
  const nums = byNumber(clauses);
  const sender = opts.sender ? String(opts.sender).toLowerCase() : null;
  for (let k = opts.from ?? 0; k < clauses.length; k++) {
    if (r.forms[k] !== '0.3') continue; // 옛 꼴은 rules04가 E26으로 이미 알렸다
    const c = clauses[k];
    const where = c.label ?? `절 ${k + 1}째`;
    const push = (code: string, message: string) => out.push({ code, severity: code.startsWith('E') ? '오류' : '경고', line: k + 1, message: `${message}: ${where}` });
    // E34: 끝의 근거(0.5.1 꼴에서 끝으로 옮긴 앞의 ↓N 포함)와 옛 앞붙이 ↓N
    const grounds = [...(c.because ?? []).filter((b) => 'label' in b), ...(c.place?.rel === '↓' ? [c.place.target] : [])];
    for (const g of grounds) {
      if (g.msg !== null) continue; // 다른 메시지(#해시:)는 보지 않는다
      const t = nums.get(g.label.slice(1));
      const ev = t?.marks.ev;
      if (t && t !== c && ev && NOT_GROUND[ev]) push('E34', `${NOT_GROUND[ev]} 절은 근거가 될 수 없다: ↓${g.label.slice(1)}. 그 절에 답하려면 ↔·↖로 가리킨다`);
    }
    // W36: 받침→N은 직감(촉)·새 화두(갑)를 받친다. 대상이 이 메시지에 없으면 검사기가 E17을 이미 냈다
    const back = c.process?.kind === '받침' ? c.process.target : undefined;
    if (back && back.msg === null && back.thread === undefined) {
      const t = nums.get(back.label.slice(1));
      if (t && !(t.marks.ev && NOT_GROUND[t.marks.ev])) push('W36', `받침→${back.label.slice(1)}은 직감(촉)·새 화두(갑) 절을 받친다. 그 밖의 절은 끝에 ↓${back.label.slice(1)}로 근거 삼는다`);
    }
    if (r.written?.[k]?.marksOff) push('W34', `표지는 정규 순서 [근거,군,결,시제,화행]로 쓴다(뜻은 그대로 읽었다). 정규형은 ${canonMarks(c)}`);
    if (c.toList) {
      const seen = new Set<string>();
      const dup = c.toList.filter((n) => (seen.has(n.toLowerCase()) ? true : (seen.add(n.toLowerCase()), false)));
      if (dup.length) push('W35', `다중 지목에 같은 이름이 두 번이다(${[...new Set(dup)].join(', ')})`);
      if (c.toList.length > TO_MAX) push('W35', `다중 지목은 ${TO_MAX}명까지다(${c.toList.length}명). 더 많으면 ●(모두에게)로 쓴다`);
      // rules04의 W23은 첫 이름(to)만 본다. 나머지 이름도 본다
      if (sender) for (const n of c.toList.slice(1)) if (n.toLowerCase() === sender) push('W23', `받는 이가 자기 자신이다(→${n}). 받는 이가 없으면 · 만 쓴다`);
    }
  }
  // rules051과 같은 차례(절 차례, 한 절 안에서는 오류·경고 차례)로 둔다
  return out.sort((a, b) => a.line - b.line);
}
