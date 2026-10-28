// 결 v0.4 쓰기 규칙(2026-10-15 Jae). 읽기(parse)는 v0.3과 같고, 새로 쓰는 줄에만 더 지킬 것을 본다.
//   - 옛 꼴(v0.2·v0.2.1 '내용 〈표지〉 〔먹〕 「채」')은 쓰지 않는다: E26. 옛 꼴 읽기 코드는 보관된 기록을 읽으려고만 남긴다.
//   - 절 이름 바로 뒤의 점 자리는 빠뜨리지 않는다: '·'(나) 또는 '·→이름'(나→그). 없으면 E25.
//   - 보낸 이를 알면(광장 중계) 받는 이가 자기 자신인 것을 알린다: W23(대화 8에서 kimi→kimi 같은 줄이 셋).
// parse()의 판정·정규형·먹 이름은 바꾸지 않는다(보관 줄 196개의 판정이 그대로다). 광장 중계와 쪽지 시험 채점이 이것을 더해 부른다.

import type { Diagnostic, ParseResult } from '../types.ts';

export function rules04(r: ParseResult, opts: { sender?: string | null; from?: number } = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const clauses = r.message.clauses;
  for (let k = opts.from ?? 0; k < clauses.length; k++) {
    const c = clauses[k];
    const where = c.label ?? `절 ${k + 1}째`;
    if (r.forms[k] !== '0.3') {
      out.push({ code: 'E26', severity: '오류', line: k + 1, message: `옛 꼴은 v0.4에서 쓰지 않는다. <절N · [표지(자신)] 내용>으로 쓴다: ${where}` });
      continue;
    }
    if (!c.me) out.push({ code: 'E25', severity: '오류', line: k + 1, message: `점 자리가 없다. 절 이름 바로 뒤에 ·(나), 받는 이가 있으면 ·→이름: ${where}` });
    if (opts.sender && c.to && c.to.toLowerCase() === String(opts.sender).toLowerCase()) {
      out.push({ code: 'W23', severity: '경고', line: k + 1, message: `받는 이가 자기 자신이다(→${c.to}). 받는 이가 없으면 · 만 쓴다: ${where}` });
    }
  }
  return out;
}
