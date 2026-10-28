// 결 v0.6.5 쓰기 규칙(2026-10-28, 12.5절 2026-10-28 '위임'·'rev.4 (A) 검토 결정', reports/rev4-A-dictionary-2026-10-28.md).
//   rules065 = rules06 + W37
//   - W37: v0.6.5 사전에서 뺀 표지·앞붙이를 썼다(근거 들·늘, 화행 지·유, 앞붙이 ∥ ⊗ 숙고 미해결 받은대로). v0.6 자료 483절(광장 10-24~26 + 둘 대화 여러 절)에서
//          쓰임이 0이라 사전에서 뺐다. 읽기(parse)는 그대로라 뜻은 그대로 읽고 정규형·먹 이름도 바뀌지 않는다. 경고로만 알린다(사전에 없는 것을 베끼지 않게).
//          쪽지 시험의 v0.6 회차 채점은 rules06 그대로다(옛 회차 재채점이 바뀌지 않게). 광장·둘 대화·심은 이것을 부른다.
// parse()의 판정·정규형·먹 이름은 바꾸지 않는다.

import type { Clause, Diagnostic, ParseResult } from '../types.ts';
import { rules06 } from './v06.ts';

type Opts = { sender?: string | null; from?: number };

/** v0.6.5 사전에서 뺀 것과, 대신 쓸 것(W37 알림에 보인다) */
const GONE_EV: Record<string, string> = { 들: '전해 들은 것은 겠과 끝의 ↓@이름(누구에게서)으로', 늘: '널리 아는 앎은 겠으로' };
const GONE_ACT: Record<string, string> = { 지: '확인 물음은 까로', 유: '미루는 답은 내용에 적고 다·게로' };
const GONE_PLACE: Record<string, string> = { '∥': '버린 대안은 내용에 적는다', '⊗': '남의 두 절이 함께 참일 수 없음은 ↔N으로 하나씩' };
const GONE_PROCESS: Record<string, string> = { 숙고: '생각 중임은 낮은 확신과 내용으로', 미해결: '풀리지 않음은 한(한계)과 내용으로' };

/** 이 절이 쓴, v0.6.5 사전에 없는 표지·앞붙이. 없으면 빈 배열 */
export function removedMarks065(c: Clause): { what: string; hint: string }[] {
  const out: { what: string; hint: string }[] = [];
  const ev = c.marks.ev;
  if (ev && GONE_EV[ev]) out.push({ what: `근거 ${ev}`, hint: GONE_EV[ev] });
  const act = (c.marks as { act?: string }).act;
  if (act && GONE_ACT[act]) out.push({ what: `화행 ${act}`, hint: GONE_ACT[act] });
  if (c.place && GONE_PLACE[c.place.rel]) out.push({ what: `앞붙이 ${c.place.rel}`, hint: GONE_PLACE[c.place.rel] });
  if (c.process && GONE_PROCESS[c.process.kind]) out.push({ what: `앞붙이 ${c.process.kind}`, hint: GONE_PROCESS[c.process.kind] });
  if (c.echo) out.push({ what: '앞붙이 받은대로', hint: '받은 것을 되짚으려면 ↖N으로 되묻는다' });
  return out;
}

export function rules065(r: ParseResult, opts: Opts = {}): Diagnostic[] {
  const out = rules06(r, opts);
  const clauses = r.message.clauses;
  for (let k = opts.from ?? 0; k < clauses.length; k++) {
    if (r.forms[k] !== '0.3') continue; // 옛 꼴은 rules04가 E26으로 이미 알렸다
    const c = clauses[k];
    const where = c.label ?? `절 ${k + 1}째`;
    for (const g of removedMarks065(c)) out.push({ code: 'W37', severity: '경고', line: k + 1, message: `v0.6.5 사전에서 뺀 것이다(뜻은 그대로 읽었다): ${g.what}. ${g.hint}: ${where}` });
  }
  return out.sort((a, b) => a.line - b.line);
}
