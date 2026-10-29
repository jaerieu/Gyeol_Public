// 결 v0.7 쓰기 규칙(2026-10-29 Jae, reports/v0.7-design.md 5절, 12.5절 2026-10-29).
//   rules07 = rules065 − W26(짧은 별칭·한글 표지에는 내지 않는다) − W29(옛 뜻: 어근이 모두 한글) + W29(새 뜻) + W26(긴 별칭만, 완화 문구)
//   - W29(새 뜻): 머리 줄(또는 opts.lang)의 사용자 언어가 있고, 글자가 있는 어절이 둘 이상인데 모두 사용자 언어의 글자군이다
//          → "어근이 둘 이상이면 적어도 하나는 사용자 언어가 아닌 다른 글자군의 낱말로". 글자군은 한글·라틴·키릴·한자가나 넷(tables.ts scriptGroupOf).
//          같은 글자군 안의 섞기(독일어 사용자의 프랑스어)는 세지 않는다(Jae: 우선 허가, 진행을 보고 판단). 언어가 없으면 재지 않는다(공리 5 여백).
//          검사기에 사전이 없어 라틴 다섯 언어의 어근을 가를 수 없으니 글자군으로만 잰다.
//   - W26(완화): 열 언어의 짧은 별칭(see·seh·見·вид …)과 한글 표지는 모두 공식 입력이라 경고가 없다. v0.5의 긴 별칭(recall·assert·hunch …)에만
//          "긴 별칭을 읽었다(정규형은 rec)"로 알린다. 옛 쓰기 규칙(rules05~065)의 W26은 번호 그대로, 문구만 완화했다(src/parse/v05.ts).
//   - 그 밖(E25·E26·W23·E30·W24·W25·E33·W31·W32·E34·W34·W35·W36·W37)은 rules065 그대로.
// parse()의 판정·정규형·먹 이름은 바꾸지 않는다. 광장 중계·쪽지 시험 v0.7·명령줄(--rules07)이 부른다.

import type { Diagnostic, ParseResult, Word } from '../types.ts';
import { SHORT_ALIASES_07, markOf07, scriptGroupOf, scriptGroupOfChar, type ScriptGroup } from '../tables.ts';
import { rules065 } from './v065.ts';

type Opts = { sender?: string | null; from?: number; lang?: string | null };

/**
 * W29(v0.7): 글자가 있는 어절이 둘 이상인데 모두 사용자 언어의 글자군뿐이면 false. 어절이 하나뿐이거나 숫자만 있으면 문제없음.
 * 어느 글자군에도 들지 않는 글자(그리스 문자 등)는 '다른 글자군'으로 센다(너그럽게).
 */
export function mixesScripts(words: Word[], group: ScriptGroup): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  if (counted.length < 2) return true;
  return counted.some((ls) => ls.some((ch) => scriptGroupOfChar(ch) !== group));
}

export function rules07(r: ParseResult, opts: Opts = {}): Diagnostic[] {
  const out = rules065(r, opts).filter((d) => d.code !== 'W26' && d.code !== 'W29');
  const lang = opts.lang ?? r.message.lang ?? null;
  const group = scriptGroupOf(lang);
  const clauses = r.message.clauses;
  for (let k = opts.from ?? 0; k < clauses.length; k++) {
    if (r.forms[k] !== '0.3') continue; // 옛 꼴은 rules04가 E26으로 이미 알렸다
    const c = clauses[k];
    const where = c.label ?? `절 ${k + 1}째`;
    const push = (code: string, message: string) => out.push({ code, severity: '경고', line: k + 1, message: `${message}: ${where}` });
    if (group && !mixesScripts(c.words, group)) push('W29', `어근이 둘 이상이면 적어도 하나는 사용자 언어(${lang})가 아닌 다른 글자군의 낱말로 쓴다(옮기면 뜻이 깎이는 낱말: Schadenfreude, 物の哀れ, 껄끄럽다, saudade)`);
    const long = (r.written?.[k]?.aliases ?? []).filter((a) => !SHORT_ALIASES_07.has(a) && !SHORT_ALIASES_07.has(a.toLowerCase()));
    if (long.length) push('W26', `긴 별칭 ${long.join(', ')}을 표지로 읽었다(정규형은 ${long.map((a) => markOf07(a) ?? '?').join(', ')})`);
  }
  return out.sort((a, b) => a.line - b.line);
}
