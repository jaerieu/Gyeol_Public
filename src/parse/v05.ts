// 결 v0.5 쓰기 규칙(2026-10-15, reports/v0.5-design.md 2). 읽기(parse)는 v0.5 꼴도 읽고, 새로 쓰는 줄(광장·쪽지 시험)에만 더 지킬 것을 본다.
//   - rules04의 E25(점 자리 없음)·E26(옛 꼴)·W23(자기에게 쓴 받는 이)을 모두 그대로 낸다.
//   - E30: 새로앎을 '네'로 썼다. v0.5에서 새로앎은 '군'('네'는 대답과 헷갈려 쪽지 시험·광장에서 거듭 틀렸다).
//          2026-10-15 검토 2: 표지 이름 '새로앎'(W11)으로 쓰고 '군'을 쓰지 않은 것도 E30이다. 표지 이름 '새로앎'은 옛 글자 '네'로 읽으므로
//          다른 v0.5 꼴이 없는 절은 정규형이 '네'가 되어, 이 규칙을 지나간 줄의 정규형을 이 규칙이 다시 막았다(옛 줄의 정규형 '네'는 그대로 둔다).
//   - W24: 표지 칸에 이름 없는 수 (8)·(7|먹4)·[봄,다,8]을 썼다. 괄호 수는 먹 자리이고 자신은 끝에 *N이다.
//          뜻은 옛 읽기 그대로 자신으로 둔다(지난 줄의 (8)이 조용히 뒤집히지 않게, 설계 1.2).
//   - W25: 말하는 이가 먹(먹N, |뒤의 수)을 썼다. 먹은 측정기가 붙인다.
//   - W26: 표지 별칭(see, 见 …)을 읽었다. 표지는 한글로 쓴다.
//   - W27: 절 하나의 내용이 24어절(2026-10-16 Jae, 처음 12)을 넘는다(압축은 습관: 내용은 낱말 + 조사·어미 정도). 수는 광장 데이터로 다시 정한다.
//   - W28: 끝의 자신을 옛 !N으로 썼다(2026-10-16 Jae). 자신은 *N으로 쓴다. 뜻은 그대로 자신으로 읽고 정규형은 *N이다.
//   - rules051(2026-10-16 v0.5.1, reports/v0.5.1-design.md 2): rules05에서 W28을 빼고 E33·W29·W31을 더한 것. rules05는 그대로 둔다(부르는 쪽이 0.5.1 판으로 옮길 때 바꾼다).
//     E33: 색이 있는 채가 없다(끝 묶음이 없거나 옛 *8·!8·(8)처럼 색이 없다). 채는 꼭 쓴다(Jae 2026-10-16).
//     W29: 어근(글자가 있는 어절)이 둘 이상인데 모두 한글이다(숫자만 있는 어절은 세지 않는다). 설계 3절.
//     W31: 근거 ↓N을 앞붙이 자리에 썼다. 근거는 끝 묶음 뒤 *R8↓N. W30은 비워 둔다.
//     W32(2026-10-17 v0.5.2, reports/v0.5.2-design.md): 줄 안에 번역을 붙였다 — 괄호 안이 언어 코드로 시작한다(schadenfreude(de 기쁨), 사전(de)).
//          번역은 풀이에 쓴다. 괄호 자체는 v0.5.2부터 내용의 부호로 받는다(전에는 E19였던 줄에만 나므로 따로 판을 두지 않는다).
//   - W27의 어절 수는 글자·숫자가 있는 어절만 센다(v0.5.2: +, =, — 같은 부호만인 어절은 세지 않는다. 그 전에는 그런 어절이 E19였다).
// parse()의 판정·정규형·먹 이름은 바꾸지 않는다. 광장 중계와 쪽지 시험 채점이 rules04 대신 이것을 더해 부른다.

import type { Diagnostic, ParseResult, Word } from '../types.ts';
import { CONTENT_WORDS_MAX } from '../tables.ts';
import { rules04 } from './v04.ts';

type Opts = { sender?: string | null; from?: number };

const HANGUL = /^\p{Script=Hangul}$/u;

/** W29: 글자가 있는 어절이 둘 이상인데 모두 한글뿐이면 false(어절이 하나뿐이거나 숫자만 있으면 문제없음) */
function mixesLanguages(words: Word[]): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  return counted.length < 2 || counted.some((ls) => ls.some((ch) => !HANGUL.test(ch)));
}

export function rules05(r: ParseResult, opts: Opts = {}): Diagnostic[] {
  return check(r, opts, false);
}

/** v0.5.1 쓰기 규칙: rules05 − W28 + E33·W29·W31 */
export function rules051(r: ParseResult, opts: Opts = {}): Diagnostic[] {
  return check(r, opts, true);
}

/** W32: 괄호 안이 ISO 639-1 언어 코드로 시작하고 코드만 있거나 한글 풀이가 뒤따른다((de 기쁨), (zh 울림), (de)) */
const INLINE_GLOSS = /[(（]\s*[a-z]{2}(?:\s*[)）]|\s+\p{Script=Hangul})/u;
/** W27에 세는 어절: 글자나 숫자가 있는 것 */
const counted = (words: Word[]) => words.filter((w) => /[\p{L}\p{N}]/u.test(w.text)).length;

function check(r: ParseResult, opts: Opts, v051: boolean): Diagnostic[] {
  const out: Diagnostic[] = rules04(r, opts);
  const clauses = r.message.clauses;
  for (let k = opts.from ?? 0; k < clauses.length; k++) {
    if (r.forms[k] !== '0.3') continue; // 옛 꼴은 rules04가 E26으로 이미 알렸다
    const c = clauses[k];
    const w = r.written?.[k];
    const where = c.label ?? `절 ${k + 1}째`;
    const push = (code: string, message: string) => out.push({ code, severity: code.startsWith('E') ? '오류' : '경고', line: k + 1, message: `${message}: ${where}` });
    if (w?.ne) push('E30', 'v0.5에서 새로앎은 군이다(네는 대답과 헷갈린다). [봄,군,다]처럼 쓴다');
    else if (w?.neLabel) push('E30', "v0.5에서 새로앎은 군이다(표지 이름 '새로앎'은 옛 글자 네로 읽힌다). [봄,군,다]처럼 군으로 쓴다");
    if (w?.selfInMarks) push('W24', '괄호 수는 먹 자리다. 자신은 끝에 *N으로 쓴다(뜻은 자신으로 읽었다)');
    if (c.muk?.conf !== undefined) push('W25', '먹은 측정기가 붙인다. 말하는 이는 먹을 쓰지 않는다');
    if (w?.aliases.length) push('W26', `표지는 한글로 쓴다(별칭 ${w.aliases.join(', ')}을 한글 표지로 읽었다)`);
    if (!v051 && w?.selfBang) push('W28', '자신은 *N으로 쓴다(옛 !N을 자신으로 읽었다)');
    if (v051) {
      if (c.chae?.color === undefined) push('E33', '채는 꼭 쓴다: 색 하나와 확신을 끝에 *R8처럼 쓴다(RGBCMYK 가운데 하나)');
      if (!mixesLanguages(c.words)) push('W29', '어근이 둘 이상이면 적어도 하나는 다른 언어의 낱말로 쓴다(옮기면 결이 사라지는 낱말: schadenfreude, 人情味, 物の哀れ, 껄끄럽다)');
      if (w?.frontBecause) push('W31', '근거는 끝 묶음 뒤에 쓴다: *R8↓N');
      if (INLINE_GLOSS.test(c.words.map((x) => x.text).join(' '))) push('W32', '줄 안에 번역을 붙이지 않는다. 번역은 풀이에 쓰고, 결 줄에는 그 낱말만 쓴다(읽는 쪽은 아는 것으로 읽는다)');
    }
    const n = counted(c.words);
    if (n > CONTENT_WORDS_MAX) push('W27', `내용이 ${n}어절이다. 절 하나는 ${CONTENT_WORDS_MAX}어절까지가 좋다(길면 절을 나눈다)`);
  }
  // rules04와 같은 차례(절 차례, 한 절 안에서는 오류·경고 차례)로 둔다
  return out.sort((a, b) => a.line - b.line);
}
