// 결 검사기 — v0.3 줄꼴: <절N 앞붙이 [표지(자신|먹)] 내용>. spec/03-grammar.md 3.13절.
//
// 너그럽게 읽는다(2026-10-14 물음 1: 오류 난 결 줄 22개 가운데 19개가 표지 블록 문제였다).
//   - 표지 블록 안: 쉼표·가운뎃점·띄어쓰기·붙여 쓰기(겠다)를 경고 없이 나누고 순서를 가리지 않는다.
//   - 자리를 옮긴 것(내용 뒤의 표지 블록, 표지 블록 뒤의 앞붙이, ] 밖의 괄호, < 밖의 이름표)은 읽되 W19.
//   - < >로 싸지 않았거나 닫지 않은 절은 읽되 W18. 0~9 한 자리가 아닌 수는 한 자리로 바꿔 읽되 W20.
// 오류로 남는 것: 화행 없음, 화행 둘, 근거 둘, 근거 없는 단언, 다 아닌 화행의 네, 모르는 표지, 수가 아닌 괄호, 내용 없음(물음·받은대로·오류→ 제외).
//
// 이 꼴인지(lineFormOf)는 src/parse.ts가 옛 꼴의 기호 바꾸기(normalizeSymbols)보다 먼저 본다: 두 꼴에서 < >와 [ ]의 뜻이 다르다.
//
// v0.5(2026-10-15, reports/v0.5-design.md): 같은 꺾쇠 꼴에 v0.5 꼴을 더 읽는다 — <절N · 앞붙이 [표지(먹N)] 내용 !N>.
//   - 표지: 새로앎 '군', 시제 '었'·'을'(하나까지, E28), 표지 별칭(see, 见 … 진단 없이 한글로). E08은 '군'에도 같다.
//   - 자신: 꺾쇠 안 맨 끝 !N(0~9 한 자리). 맨 끝이 아니면 E29, 표지 칸의 자신(괄호 (8)·괄호 없는 수)과 함께 쓰면 E27.
//     2026-10-15 검토 3: 어절에 붙인 것(雪!6 雨)·표지 블록 안의 것([봄,다,!6])도 E19·E05가 아니라 E29, 맨 끝 !6。은 부호를 떼고(W10) 자신으로 읽는다.
//   - 내용: 어느 언어의 낱말이든(가나 포함) 읽는다. 옛 꼴(v0.2.1)은 그대로다.
//   군·시제·끝의 자신(!N)을 쓴 절은 form '0.5'이고 정규형이 v0.5 꼴이다. 옛 줄(v0.4까지)에 없던 꼴이라 옛 줄의 판정·정규형·먹 이름은 그대로다.
//   (먹N)만 쓴 줄은 v0.3.1부터 (|먹N)으로 읽던 옛 줄과 글자가 같으므로 form을 정하지 않는다.
//   2026-10-15 검토 1: 별칭(see, 见 …)만으로는 form을 정하지 않는다. 별칭은 정규형에서 한글로 바뀌어 남지 않으므로, 정하면
//   정규형을 다시 읽은 것이 다른 정규형이 되고(<[see,다(먹4)] 雪> → (먹4) → 다시 읽으면 (|먹4)) 별칭을 썼는지에 따라 먹 이름이 갈린다.
//   form은 정규형에 남는 꼴(군·시제·읽힌 !N)로만 정한다. 별칭은 written.aliases로 남아 rules05가 W26을 낸다.
//   새로 쓰는 줄의 쓰기 규칙(네, 괄호 수, 먹, 별칭, 길이)은 src/parse/v05.ts rules05가 본다.
//
// v0.5.1(2026-10-16 Jae, reports/v0.5.1-design.md): <절N ● 앞붙이 [표지] 내용 *먹채↓근거>.
//   - 점 대신 채운 원 '●' = 나 → 모두(⬤ ⚫는 W01). ●→이름은 E31. 틀에는 me·all.
//   - 끝 묶음: '*' + 먹(검은 수, 측정기만) + 채(색 RGBCMYK 하나 + 확신 0~9) + '↓근거'(절 번호나 주소, 여럿). 읽지 못하면 E32.
//     색 있는 채·근거가 붙은 끝 묶음·● 절의 근거만 새 꼴로 읽는다. 색도 근거도 없는 *N은 옛 자신 그대로다(옛 판정이 바뀌지 않게).
//   - 0.5.1 꼴 절(●, 색 있는 채, 끝 근거)은 form '0.5.1'이고, 앞에 쓴 ↓N은 끝의 근거(because)로 옮긴다.
//
// v0.6(2026-10-24, 실험적, reports/v0.6-design.md 1): 옛 줄에 없던 글자에만 걸리게 더 읽는다(보관 줄 판정·정규형 그대로).
//   - 표지: 근거 '갑'(새 화두), 결 표지 '한'·'역'·'비'(하나까지, E36), 화행 '거'·'유'·'양'. '유'는 내용을 비워도 된다(E16 아님).
//     표지 블록을 쓴 차례가 정규 순서 [근거,군,결,시제,화행]를 벗어나면 written.marksOff(rules06 W34). 읽기는 그대로다.
//   - 갑 절은 다른 절을 가리키지 않는다: 앞붙이 ↔ ∥ ↖ ⊗ ↓, 고침→·오류→, 받은대로, 끝 근거 ↓…를 쓰면 E35.
//   - 다중 지목 ·→A,B(쉼표로 이름 여럿): to = 첫 이름, toList = 모두. 쉼표 뒤를 띄운 ·→A, B는 이어 읽고 W33.
//   - 가리킴 ⊗N,M(남의 두 절이 양립하지 않음): 자리 하나(E18). 서로 다른 두 절이 아니면 E19.
//   - 끝 근거 ↓53:12(대화 53의 절12): 메시지 밖이라 E17을 보지 않는다.
// v0.6 덧붙임(2026-10-25 H-261025-8 직감1, reports/hunch-design.md 3): 옛 줄에서는 E19였던 글자에만 걸린다(보관 줄에 없다).
//   - 과정 앞붙이 받침→N = 절N의 직감(촉)·새 화두(갑)를 뒤늦게 찾은 근거로 받친다. N·N.M과 지난 대화 T:N(받침→53:12)을 받는다.
//     지난 대화의 가리킴은 Ref.thread에 두고 메시지 밖이라 E17을 보지 않는다. 옛 꼴(공용 takePrefix)에는 넣지 않는다.
//   - ↔도 지난 대화 T:N을 받는다(↔53:12, 직감이 착각이었다고 맞설 때). ∥ ↖ ⊗ 고침→ 오류→는 이 메시지의 절만 그대로.
//   - E37: 받침 절의 근거 자리가 촉·갑이거나 ↓근거(끝·옛 앞붙이)가 없다. 직감을 직감으로 받칠 수 없다.

import type { Act, Clause, ClauseWritten, Ev, Fig, Marks, PartialMarks, Ref, Tense, Word, Because } from '../types.ts';
import { ACT_07, DIGIT_MAX, EV_07, FIG_07, MARK_ALIASES_06, MARK_CHARS, MARK_KO2EN, MARK_RANK, NEWS, NEWS_05, NEWS_07, TENSE_07, markAlias05, markOf07, PROCESS_ALIAS_RE } from '../tables.ts';
import { stripTrailingPunct } from '../text.ts';
import { Ctx, ECHO_LABEL, markAlias, parseWord, parseWord052, takePrefix, tightenTildes, type PrefixRules, PROCESS_SUP_RE } from './shared.ts';

const NF_OPEN = '<〈＜⟨《‹';
const NF_CLOSE = '>〉＞⟩》›';
const NF_ALL = NF_OPEN + NF_CLOSE;
const SQ_OPEN = '[［【〔';
const SQ_CLOSE = ']］】〕';
const codeSet = (chars: string): ReadonlySet<number> => new Set(Array.from(chars, (c) => c.charCodeAt(0)));
const OPEN_CODES = codeSet(NF_OPEN);
const CLOSE_CODES = codeSet(NF_CLOSE);
const BRACKET_CODES = codeSet(NF_ALL);
const SQ_OPEN_CODES = codeSet(SQ_OPEN);
const SQ_CLOSE_CODES = codeSet(SQ_CLOSE);
// 2026-10-17 Jae: 한 차례의 절은 절N·절N.1·절N.2(차례 번호 N, 그 차례의 몇째 절). 이름표와 가리킴에 '.M'을 받는다(옛 정수 번호도 그대로).
const NUM = '\\d+(?:\\.\\d+)?';
// v0.7(2026-10-29, reports/v0.7-design.md 2절): 절 머리는 수만 쓴다(<1 · …>). 읽기는 절N·점N·cN도 같은 뜻으로 받고 틀의 label은 그대로 '절N'이다(옛 꼴의 절·점 구분을 지키려고)
const LEAD_LABEL = new RegExp(`^([절점]|[cC])\\s*(${NUM})\\s*`, 'u');
const REF_LOOSE = new RegExp(`^(?:#([0-9a-f]{6,64}):)?([절점]|[cC])?(${NUM})$`, 'u');
/** v0.3 꼴 이름표(절12, 절12.1, v0.7 c12). 옛 꼴(v0.2.1)은 shared.ts LABEL_RE 그대로 정수만 */
const LABEL_N = new RegExp(`^(?:[절점]|[cC])${NUM}$`, 'u');
/** v0.7 수만 쓴 머리(1, 12.1). 점(·)·●이 바로 뒤따를 때만 이름표로 읽는다(내용을 표지 블록 앞에 쓴 옛 줄과 가르려고) */
const BARE_NUM = new RegExp(`^${NUM}$`, 'u');
/** 절N·점N·cN·N → 틀의 이름표 '절N'·'점N' */
const normLabel = (kind: string | undefined, num: string) => (kind === '점' ? '점' : '절') + num;
const WS = /\s/u;

/** 가리킴: v0.3은 번호만 써도 된다(↓1 = ↓절1). 절·점과 다른 메시지(#해시:)도 받는다. */
function parseRefLoose(s: string): Ref | null {
  const m = REF_LOOSE.exec(s);
  if (!m) return null;
  return { msg: m[1] ?? null, label: normLabel(m[2], m[3]) };
}

/**
 * v0.3의 앞붙이: 가리킴은 번호만 써도 되고, →이름 끝의 쌍점·쉼표는 뗀다. 둘째 →이름은 E18만 내고 앞 이름을 둔다.
 * 꺾쇠 없이 쓴 줄 끝의 닫는 꺾쇠(→kimi＞)도 이름에 넣지 않는다: 넣으면 정규형 <→kimi＞ …>를 다시 읽을 수 없다(2026-10-14 반례 검토).
 */
const RULES_03: PrefixRules = { ref: parseRefLoose, to: /^→(.+?)[:：,，>〉＞⟩》›]*$/u, toOverwrites: false };

/**
 * v0.6 덧붙임(2026-10-25 H-261025-8, reports/hunch-design.md 3.1): 받침→·↔의 가리킴. 이 메시지의 절(parseRefLoose)이나 지난 대화의 절 T:N.
 * 지난 대화는 { msg: null, label: '절12', thread: 53 }으로 두고, 끝의 근거(↓53:12)와 같은 꼴(THREAD_REF)을 읽는다.
 */
function refOrThread(s: string): Ref | null {
  const r = parseRefLoose(s);
  if (r) return r;
  const t = threadRef(s);
  return t && /^\d+:[절점]?\d+(?:\.\d+)?$/u.test(s) ? { msg: null, label: t.clause, thread: t.thread } : null;
}

/** 받은대로 절의 내용 자리에 쓴 받은 절·점의 이름: 옛 꼴의 받은대로 줄과 같고, 번호만 쓴 1~3도 받는다. */
const echoName = (t: string) => ECHO_LABEL.test(t) || /^\d+~\d+$/u.test(t);

/** 화살표의 비슷한 꼴. '<->'와 '->'는 < >를 나누기 전에 바꾼다(꺾쇠로 읽히지 않게). 옛 꼴은 text.ts normalizeSymbols가 따로 바꾼다. */
function normalizeArrows(s: string): string {
  return s
    .replace(/<->|⇄/gu, '↔')
    .replace(/->|⇒/gu, '→')
    .replace(/⇣/gu, '↓')
    .replace(/‖/gu, '∥')
    .replace(/(^|\s)\^((?:#[0-9a-f]+:)?[절점]?\d+)/gu, '$1↖$2');
}

/** 앞붙이 사이의 띄어쓰기를 붙인다: '↓ 1' → '↓1', '고침 → 절 2' → '고침→절2', '→ kimi' → '→kimi'. */
const PROCESS_TIGHTEN = new RegExp(`(${PROCESS_ALIAS_RE})\\s*→\\s*`, 'giu');
function tightenPrefixes(s: string): string {
  return tightenTildes(
    s
      .replace(PROCESS_TIGHTEN, '$1→') // v0.6 덧붙임(2026-10-25): 받침 → 3도. v0.7: fix·err·sup
      .replace(/([↓↔∥↖→⊗])\s+(?=\S)/gu, '$1')
      .replace(/([↓↔∥↖→⊗])([절점])\s+(\d)/gu, '$1$2$3')
      // v0.6: ⊗12, 15 → ⊗12,15(⊗ 둘레의 띄어쓰기는 ↓ 1처럼 붙여 읽는다)
      .replace(/(⊗[^\s,，、]+[,，、])\s+(?=[절점]?\d)/gu, '$1'),
  );
}

/** from부터 set의 글자(꺾쇠·대괄호, 모두 BMP)가 처음 나오는 자리. 2026-10-14: 글자마다 한 글자 글을 만들어 견주던 것을 낱자 값으로. */
const firstOf = (s: string, set: ReadonlySet<number>, from = 0) => {
  for (let i = from; i < s.length; i++) if (set.has(s.charCodeAt(i))) return i;
  return -1;
};

// ───────── 괄호 (…) ─────────
//
// 표지 블록 안의 괄호는 정규식 /[(（][^)）]*[)）]/gu로 찾는다. 2026-10-14: 마지막 닫는 괄호 뒤는 맞출 것이 없으니 훑지 않는다.
// 닫히지 않은 '('가 길게 이어지면 '('마다 끝까지 훑어 길이의 제곱이었다. 찾는 괄호는 같다(맞는 괄호는 모두 마지막 닫는 괄호 앞에서 끝난다).

const PAREN = /[(（]([^)）]*)[)）]/gu;
const closedPart = (s: string) => s.slice(0, Math.max(s.lastIndexOf(')'), s.lastIndexOf('）')) + 1);

/** 괄호 (…)를 공백 하나로 바꾼다. */
function blankParens(s: string): string {
  const head = closedPart(s);
  return head.replace(PAREN, ' ') + s.slice(head.length);
}

/** 괄호 (…) 안의 글들. */
function parenContents(s: string): string[] {
  return [...closedPart(s).matchAll(PAREN)].map((m) => m[1]);
}

/** 표지 블록 안에서 괄호를 뺀 나머지가 표지(글자·이름)와 수뿐인가. 꺾쇠 없이 쓴 v0.3 절을 알아볼 때 쓴다. */
function markOnly(inner: string): boolean {
  const rest = blankParens(inner);
  const pieces = rest.split(/[,，、·・･;；/|｜]+/u).map((x) => x.trim()).filter(Boolean);
  if (!pieces.length) return false;
  return pieces.every((p) => {
    if (Object.hasOwn(MARK_ALIASES_06, p.replace(/\s+/gu, ''))) return true;
    // v0.5: 표지 별칭(see, 见 …)도 표지다. v0.7: 영어 내부 값·열 언어 별칭도
    return p.split(/\s+/u).every((t) => Object.hasOwn(MARK_ALIASES_06, t) || markAlias05(t) || markOf07(t) !== undefined || /^[\d０-９.%]+$/u.test(t) || t === '자신' || Array.from(t).every((c) => MARK_CHARS.has(c)));
  });
}

// ───────── < > 밖의 받는 이 ─────────
//
// 줄 앞(→kimi, →gemma <…>)과 줄 끝(<…> →kimi)에 쓴 받는 이 목록. 2026-10-14v2 쓰기의 주된 오답이라 읽되 W16을 낸다.
// 전에는 정규식 둘로 찾았다.
//   앞: /^((?:→\s*[^\s,，、<〈＜⟨《‹]+\s*[,，、]?\s*)+)(?=[<〈＜⟨《‹])/u
//   끝: /(?<=[>〉＞⟩》›])((?:\s*→\s*[^\s,，、<〈＜⟨《‹>〉＞⟩》›]+\s*[,，、]?)+)\s*$/u
// 이름 글자에 →도 들어가 '→a→b'를 이름 하나로도 둘로도 나눌 수 있어서, 맞지 않는 줄(→a→a…→a b)에서 되짚기가 →의 수에 지수로 늘었다
// (2026-10-14에 잰 것: → 스물에 60ms쯤, →가 둘 늘 때마다 네 배라 서른이면 1분 남짓). 같은 말(언어)을 받는 작은 상태 기계로 한 번 훑는다.
// 찾는 자리와 이름은 정규식과 같다.
//   앞 목록: 이름에 여는 꺾쇠가 못 오므로 목록은 첫 여는 꺾쇠에서 끝난다. 그 앞이 목록 꼴인지만 보면 된다.
//   끝 목록: 목록에 꺾쇠가 못 오므로 목록은 마지막 꺾쇠 바로 뒤에서 비롯한다. 그 꺾쇠가 닫는 꺾쇠이고 뒤가 목록 꼴인지만 보면 된다.

const COMMA_CODES = codeSet(',，、');
const ARROW_CODE = '→'.charCodeAt(0);

/** 공백인가(정규식 \s와 같다). 글자마다 정규식을 부르지 않게 낱자 값마다 한 번만 재어 둔다. \s의 글자는 모두 BMP다. */
const wsMemo = new Uint8Array(0x10000); // 0 모름, 1 공백, 2 아님
function isWsCode(c: number): boolean {
  let v = wsMemo[c];
  if (v === 0) wsMemo[c] = v = WS.test(String.fromCharCode(c)) ? 1 : 2;
  return v === 1;
}

// 상태(비트): →를 기다림 · → 뒤 공백 · 이름 안 · 이름 뒤 공백 · 쉼표 뒤 · 목록 끝 공백(끝 목록만)
const S_WAIT = 1;
const S_ARROW = 2;
const S_NAME = 4;
const S_GAP = 8;
const S_COMMA = 16;
const S_TAIL = 32;
const S_ITEM_END = S_NAME | S_GAP | S_COMMA;

/**
 * s 전체가 받는 이 목록 꼴인가.
 * lead: 줄 앞 목록, 항목 = →\s*이름+\s*쉼표?\s* (이름에 여는 꺾쇠가 못 온다)
 * 아니면 줄 끝 목록, 항목 = \s*→\s*이름+\s*쉼표? 이고 끝에 \s* (이름에 꺾쇠가 못 온다)
 * UTF-16 낱자로 훑는다. 정규식은 BMP 밖 글자를 한 글자로 보지만, 그 두 낱자는 모두 이름 글자이고 '이름 글자 둘'은 '하나'와
 * 같은 상태로 간다(이름 안 → 이름 안, 그 밖은 막힘). 공백·쉼표·꺾쇠·→는 모두 BMP다.
 */
function isToList(s: string, lead: boolean): boolean {
  const stop = lead ? OPEN_CODES : BRACKET_CODES;
  let st = S_WAIT;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const ws = isWsCode(c);
    const comma = COMMA_CODES.has(c);
    const name = !ws && !comma && !stop.has(c);
    // 항목이 끝날 수 있으면 다음 항목의 처음에도(끝 목록이면 목록 끝 공백에도) 있다
    const cur = st & S_ITEM_END ? st | S_WAIT | (lead ? 0 : S_TAIL) : st;
    let nx = 0;
    if (cur & S_WAIT) {
      if (c === ARROW_CODE) nx |= S_ARROW;
      if (ws && !lead) nx |= S_WAIT;
    }
    if (cur & S_ARROW) {
      if (ws) nx |= S_ARROW;
      if (name) nx |= S_NAME;
    }
    if (cur & S_NAME) {
      if (name) nx |= S_NAME;
      if (ws) nx |= S_GAP;
      if (comma) nx |= S_COMMA;
    }
    if (cur & S_GAP) {
      if (ws) nx |= S_GAP;
      if (comma) nx |= S_COMMA;
    }
    if (cur & S_COMMA && ws && lead) nx |= S_COMMA;
    if (cur & S_TAIL && ws) nx |= S_TAIL;
    if (!nx) return false;
    st = nx;
  }
  return (st & (S_ITEM_END | S_TAIL)) !== 0;
}

/** 줄 앞 받는 이 목록이 끝나는 자리(첫 여는 꺾쇠). 목록이 없으면 -1. */
function leadToEnd(s: string): number {
  const o = firstOf(s, OPEN_CODES);
  return o > 0 && isToList(s.slice(0, o), true) ? o : -1;
}

/** 줄 끝 받는 이 목록이 비롯하는 자리(마지막 닫는 꺾쇠 바로 뒤). 목록이 없으면 -1. */
function tailToStart(s: string): number {
  let last = s.length - 1;
  while (last >= 0 && !BRACKET_CODES.has(s.charCodeAt(last))) last--;
  return last >= 0 && CLOSE_CODES.has(s.charCodeAt(last)) && isToList(s.slice(last + 1), false) ? last + 1 : -1;
}

/** 줄 앞 받는 이 목록을 뗀다(없으면 그대로). */
function stripLeadTo(s: string): string {
  const e = leadToEnd(s);
  return e < 0 ? s : s.slice(e);
}

/** 목록 글에서 받는 이 이름들. 이름에는 →도 들어갈 수 있다(→a→b는 이름 a→b 하나). */
const namesOf = (txt: string) => [...txt.matchAll(/→\s*([^\s,，、]+)/gu)].map((m) => m[1]);

/**
 * < > 밖의 받는 이를 떼어, 첫 절(줄 앞에 쓴 것)이나 마지막 절(줄 끝에 쓴 것)의 [ 앞에 넣는다.
 * 그 절 안에서는 정규 자리의 앞붙이로 읽히므로 경고는 여기서 이름마다 한 번(W16)이다. 여럿이면 절 안에서 E18.
 */
function moveOutsideTo(s: string, line: string, ctx: Ctx): string {
  const insertAt = (str: string, from: number, names: string[]) => {
    const sq = firstOf(str, SQ_OPEN_CODES, from);
    return sq < 0 ? str : `${str.slice(0, sq)}${names.map((n) => `→${n} `).join('')}${str.slice(sq)}`;
  };
  let out = s;
  const leadEnd = leadToEnd(out);
  if (leadEnd >= 0) {
    const names = namesOf(out.slice(0, leadEnd));
    out = insertAt(out.slice(leadEnd), 0, names);
    for (const n of names) ctx.warn('W16', `받는 이 →${n}: < > 앞에서 읽었다. 정규형은 [ 앞: '${line}'`);
  }
  const tailStart = tailToStart(out);
  if (tailStart >= 0) {
    const names = namesOf(out.slice(tailStart));
    const body = out.slice(0, tailStart);
    let lastOpen = -1;
    for (let i = body.length - 1; i >= 0 && lastOpen < 0; i--) if (OPEN_CODES.has(body.charCodeAt(i))) lastOpen = i;
    out = insertAt(body, Math.max(lastOpen, 0), names);
    for (const n of names) ctx.warn('W16', `받는 이 →${n}: < > 뒤에서 읽었다. 정규형은 [ 앞: '${line}'`);
  }
  return out;
}

// ───────── 줄꼴 알아보기·절 조각 ─────────

/**
 * 이 줄이 v0.3 줄꼴인가.
 * 'wrapped' = (이름표) < … [ … ] … > 꼴. 첫 꺾쇠 묶음 안에 표지 블록이 있어야 한다(옛 꼴의 〈까〉·〈봄·다〉와 가른다).
 * 'bare' = 꺾쇠가 하나도 없고, 표지만 든 [ ]가 있는 줄(옛 꼴로는 E01이던 줄이라 맞던 줄을 건드리지 않는다).
 */
export function lineFormOf(line: string): 'wrapped' | 'bare' | null {
  const s = stripLeadTo(normalizeArrows(String(line ?? '').trim()).replace(LEAD_LABEL, ''));
  if (s && NF_OPEN.includes(s[0])) {
    const close = firstOf(s, CLOSE_CODES, 1);
    const inner = close < 0 ? s.slice(1) : s.slice(1, close);
    // 표지 블록이 있거나, 꺾쇠 바로 안에 이름표가 있으면(옛 꼴의 〈 〉 안에는 이름표가 오지 않는다) 새 꼴이다
    return firstOf(inner, SQ_OPEN_CODES) >= 0 || /^\s*(?:[절점]|[cC])\s*\d+(?:\.\d+)?(?:\s|$)/u.test(inner) ? 'wrapped' : null;
  }
  if (firstOf(s, OPEN_CODES) >= 0) return null;
  const o = firstOf(s, SQ_OPEN_CODES);
  if (o < 0) return null;
  const c = firstOf(s, SQ_CLOSE_CODES, o + 1);
  if (c < 0) return null;
  return markOnly(s.slice(o + 1, c)) ? 'bare' : null;
}

interface RawClause {
  inner: string;
  closed: boolean;
  /** 원문에서 꺾쇠까지 포함한 조각(광장에서 첫 절만 실을 때 쓴다) */
  text: string;
}

/** 꺾쇠로 싼 줄을 절 조각으로 나눈다. */
function splitWrapped(line: string): { lead: string | null; parts: RawClause[]; stray: string; odd: boolean } {
  let s = line;
  let lead: string | null = null;
  const lm = LEAD_LABEL.exec(s);
  if (lm && NF_OPEN.includes(s[lm[0].length] ?? '')) {
    lead = normLabel(lm[1], lm[2]);
    s = s.slice(lm[0].length);
  }
  // 꺾쇠 자리만 보고 그 사이를 잘라 낸다(2026-10-14: 한 글자씩 이어 붙이던 것을 자르기로. 꺾쇠는 모두 BMP라 자른 글은 같다).
  const parts: RawClause[] = [];
  let open = -1; // 지금 절을 연 꺾쇠의 자리, 절 밖이면 -1
  const stray: string[] = [];
  let strayFrom = 0;
  let odd = false;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (!BRACKET_CODES.has(c)) continue;
    const isOpen = OPEN_CODES.has(c);
    if (open < 0) {
      if (isOpen) {
        stray.push(s.slice(strayFrom, i));
        open = i;
        if (s[i] !== '<') odd = true;
      }
      continue;
    }
    if (!isOpen) {
      if (s[i] !== '>') odd = true;
      parts.push({ inner: s.slice(open + 1, i), closed: true, text: s.slice(open, i + 1) });
      open = -1;
      strayFrom = i + 1;
    } else {
      // 닫지 않고 새 절을 열었다. 이 자리의 비슷한 꺾쇠(〈 등)는 전부터 odd(W01)에 넣지 않았다. 그대로 둔다.
      parts.push({ inner: s.slice(open + 1, i), closed: false, text: s.slice(open, i).trimEnd() });
      open = i;
    }
  }
  if (open >= 0) parts.push({ inner: s.slice(open + 1), closed: false, text: s.slice(open).trimEnd() });
  else stray.push(s.slice(strayFrom));
  return { lead, parts, stray: stray.join('').trim(), odd };
}

/**
 * v0.3 줄꼴로 쓴 줄의 절 조각들(원문 그대로). v0.3 줄꼴이 아니면 줄 전체 하나.
 * 광장은 한 차례에 절 하나만 싣는다(뒤의 절은 다음 참가자의 번호와 겹친다).
 */
export function clausePieces(line: string): string[] {
  const s = String(line ?? '').trim();
  if (lineFormOf(s) !== 'wrapped') return [s];
  const sp = splitWrapped(normalizeArrows(s));
  const out = sp.parts.map((p) => p.text);
  if (sp.lead && out.length) out[0] = `${sp.lead} ${out[0]}`;
  return out.length ? out : [s];
}

/** 결 줄 하나에 이름표를 매긴다(광장·쪽지 시험의 채점 쪽이 번호를 붙일 때). 원래 이름표는 갈아 끼운다. */
export function labelLine(line: string, label: string): string {
  const s = String(line ?? '').trim();
  const form = lineFormOf(s);
  if (form === 'wrapped') {
    // v0.7: 수만 쓴 머리(<1 · …>)와 cN도 갈아 끼운다(점·● 앞의 수만)
    const m = /^(?:(?:[절점]|[cC])\s*\d+(?:\.\d+)?\s*)?([<〈＜⟨《‹])\s*(?:(?:(?:[절점]|[cC])\s*\d+(?:\.\d+)?(?=[\s[［【〔·•・ㆍ∙⋅‧●⬤⚫→↓↔∥↖⊗]|$)|\d+(?:\.\d+)?(?=\s*[·•・ㆍ∙⋅‧●⬤⚫]))\s*)?/u.exec(s);
    if (m) return `${m[1]}${label} ${s.slice(m[0].length)}`;
  }
  if (form === 'bare') return `${label} ${s.replace(LEAD_LABEL, '')}`;
  return `${label} ${s.replace(/^(?:절|c)\s*\d+\s*/u, '')}`;
}

// ───────── 앞붙이·자신·먹·표지 블록 ─────────

/** 앞붙이 하나를 읽어 절에 넣는다. 앞붙이가 아니면 false. '받은대로'는 v0.3에만 있다. */
function takePrefix03(t: string, clause: Clause, ctx: Ctx, st: { echo: boolean }): boolean {
  if (t === '받은대로') {
    if (st.echo) ctx.err('E18', "앞붙이 '받은대로'가 둘이다");
    st.echo = true;
    return true;
  }
  // v0.6(2026-10-24): ⊗N,M = 남의 두 절이 양립하지 않음. 자리 하나로 센다(E18). 옛 꼴(v02.ts)의 앞붙이는 그대로라 여기서만 읽는다
  const x = /^⊗(.*)$/u.exec(t);
  if (x) {
    const refs = x[1].split(/[,，、]/u).map(parseRefLoose);
    const [a, b] = refs;
    if (refs.length !== 2 || !a || !b || (a.msg === b.msg && a.label.slice(1) === b.label.slice(1))) ctx.err('E19', `⊗는 서로 다른 두 절을 쉼표로 가리킨다(⊗12,15): '${t}'`);
    else {
      if (clause.place) ctx.err('E18', `자리 앞붙이가 둘 이상이다: '${t}'`);
      clause.place = { rel: '⊗', target: a, second: b };
    }
    return true;
  }
  // v0.6 덧붙임(2026-10-25): 받침→N(과정 자리 하나, E18), ↔T:N(지난 대화의 절에 맞섬)
  const b = PROCESS_SUP_RE.exec(t); // v0.7: 내부 값 sup(support). 2026-10-29: 열 언어 별칭(stu·app·под·撑 …)도
  if (b) {
    const r = refOrThread(b[1]);
    if (!r) ctx.err('E19', `가리킴을 읽을 수 없다: '${t}'`);
    else {
      if (clause.process) ctx.err('E18', `과정 앞붙이가 둘 이상이다: '${t}'`);
      clause.process = { kind: 'sup', target: r };
    }
    return true;
  }
  const o = /^↔(\d+:.+)$/u.exec(t);
  if (o) {
    const r = refOrThread(o[1]);
    if (!r) ctx.err('E19', `가리킴을 읽을 수 없다: '${t}'`);
    else {
      if (clause.place) ctx.err('E18', `자리 앞붙이가 둘 이상이다: '${t}'`);
      clause.place = { rel: '↔', target: r };
    }
    return true;
  }
  return takePrefix(t, clause, ctx, RULES_03);
}

/**
 * v0.6 다중 지목(2026-10-24, reports/v0.6-design.md 1.1): 점 뒤 화살표의 이름을 쉼표로 나눠 읽는다. 이름이 둘 이상이면 to = 첫 이름,
 * toList = 모두(적힌 차례)를 두고 true, 하나면 false(전처럼 takePrefix03이 읽는다. 옛 읽기의 '·→A,B'는 이름 하나 'A,B'였고 정규형은 같은 글자다).
 * 쉼표 뒤를 띄운 이름(·→A, B)은 bt에서 이어 읽고 W33. 이어 읽는 낱말은 이름 꼴(글자·숫자와 _ . -)일 때만이다.
 */
const TO_NAME_TOKEN = /^[\p{L}\p{N}][\p{L}\p{N}_.\-]*[,，、]?$/u;
function takeToList(rest: string, bt: string[], at: number, clause: Clause, ctx: Ctx, shown: string): { ok: boolean; next: number } {
  let body = rest.slice(1);
  let k = at;
  let spaced = false;
  while (/[,，、]$/u.test(body) && k + 1 < bt.length && TO_NAME_TOKEN.test(bt[k + 1]) && !['숙고', '미해결', '받은대로'].includes(bt[k + 1].replace(/[,，、]$/u, ''))) {
    body += bt[++k];
    spaced = true;
  }
  const names = body
    .replace(/[:：,，、>〉＞⟩》›]+$/u, '')
    .split(/[,，、]/u)
    .map((n) => n.trim())
    .filter(Boolean);
  if (names.length < 2) return { ok: false, next: at };
  if (spaced) ctx.warn('W33', `다중 지목의 쉼표 뒤를 띄운 것을 이어 읽었다. 정규형은 '·→${names.join(',')}': '${shown}'`);
  if (clause.to) ctx.err('E18', `향함 앞붙이가 둘 이상이다: '→${names.join(',')}'`);
  else {
    clause.to = names[0];
    clause.toList = names;
  }
  return { ok: true, next: k };
}

/** 괄호 안의 수 하나를 0~9 한 자리로. 한 자리가 아니면 바꿔 읽고 W20, 수가 아니면 E10. */
function oneDigit(raw: string, ctx: Ctx, what: string, shown: string): number | null {
  if (/^\d$/u.test(raw)) return Number(raw);
  let v: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+(?:\.\d+)?)\s*%$/u.exec(raw))) v = Number(m[1]) / 100;
  else if (/^(?:\d*\.\d+|\d+\.)$/u.test(raw)) {
    const x = Number(raw);
    v = x <= 1 ? x : x < 10 ? x / 10 : null; // .8·0.8 → 8, 7.5 → 7
  } else if (raw === '10') v = 1; // 0~10 척도의 맨 위로 본다
  else if (/^\d{2,3}$/u.test(raw)) v = Number(raw) / 100; // 80 → 80%
  if (v === null || !Number.isFinite(v) || v < 0 || v > 1) {
    ctx.err('E10', `${what}의 값이 수가 아니거나 0~9 밖이다: '${raw}' ${shown}`);
    return null;
  }
  const d = Math.min(DIGIT_MAX, Math.floor(Math.round(v * 1000) / 100));
  ctx.warn('W20', `${what} '${raw}'를 한 자리 ${d}로 읽었다(정규형은 0~9 한 자리): ${shown}`);
  return d;
}

/**
 * 괄호 안: 자신, 또는 자신|먹. 먹은 측정기가 | 뒤에 붙인다.
 * 정규형(v0.3.1, 2026-10-14)은 (7), (7|먹4), (|먹4)다. 이름표 없는 (7|4)·(|4)와 (자신7|먹4)도 같은 뜻으로 진단 없이 읽는다
 * (v0.3에서 맞던 줄은 그대로 맞다). 이름표 '먹'만 쓴 (먹4)는 (|먹4)로 읽는다.
 * 이름표가 제자리가 아니면((먹4|7), (7|자신4)) 자리대로 읽으면 뜻이 뒤바뀌므로 어느 수도 틀에 두지 않고 E10을 낸다.
 */
function parseDigits(raw: string, ctx: Ctx, shown: string): { self?: number; muk?: number } {
  const t = raw
    .replace(/[０-９]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48))
    .replace(/｜/gu, '|')
    .trim();
  if (t === '') return {};
  let parts = t.split('|');
  if (parts.length === 1 && t.includes('/')) {
    parts = t.split('/');
    ctx.warn('W20', `자신과 먹은 '|'로 나눈다: ${shown}`);
  }
  // (먹4) = (|먹4). '먹' 뒤에 무엇이 있어야 한다: 빈 '(먹)'은 전처럼 E10이다. v0.7(2026-10-29): 이름표 ink도 같다((ink4), 정규형)
  if (parts.length === 1 && /^(?:먹|ink)\s*\S/iu.test(parts[0])) parts = ['', parts[0]];
  if (parts.length > 2) {
    ctx.err('E10', `괄호 안을 읽을 수 없다: ${shown}`);
    return {};
  }
  // '|' 둘레의 띄어쓰기는 이름표를 떼기 전에 지운다: (7 | 먹4) = (7|먹4) (2026-10-14 반례 검토)
  parts = parts.map((p) => p.trim());
  if (/^(?:먹|ink)/iu.test(parts[0]) || /^자신/u.test(parts[1] ?? '')) {
    ctx.err('E10', `이름표가 제자리가 아니다: 자신은 '|' 앞, 먹은 '|' 뒤다(먹은 측정기가 붙인다): ${shown}`);
    return {};
  }
  // v0.3.1: 가르치는 말은 '괄호 안의 이름 없는 수는 자신'이다. | 뒤의 이름 없는 수는 v0.3 꼴이라 먹으로 읽되,
  // 그 말과 어긋나 보이므로 W21로 알린다(2026-10-14v2 mc3-2에서 (6|9)의 9를 자신으로 읽은 모델 9).
  if (parts.length === 2 && parts[1] !== '' && !/^(?:먹|ink)/iu.test(parts[1])) ctx.warn('W21', `이름표 없는 먹을 읽었다. 정규형은 (자신|inkN): ${shown}`);
  const out: { self?: number; muk?: number } = {};
  const s = parts[0].replace(/^자신\s*/u, '').trim();
  const m = (parts[1] ?? '').replace(/^(?:먹|ink)\s*/iu, '').trim();
  if (s !== '') {
    const d = oneDigit(s, ctx, '자신', shown);
    if (d !== null) out.self = d / 10;
  }
  if (m !== '') {
    const d = oneDigit(m, ctx, '먹', shown);
    if (d !== null) out.muk = d / 10;
  }
  return out;
}

/** 표지 블록을 읽은 것. v05·ne·neLabel·aliases는 v0.5(2026-10-15) 꼴을 가리려고 둔다(정규형과 rules05). */
interface MarkBlock {
  marks: Marks | PartialMarks;
  self?: number;
  muk?: number;
  /**
   * 정규형에 남는 v0.5 꼴(군·시제, 별칭 new·past …로 쓴 것 포함)을 썼다.
   * 2026-10-15 검토 1: 근거·화행 별칭(see, assert …)은 넣지 않는다. 정규형에서 한글로 바뀌어 사라지므로(정규형이 제자리 꼴이 되게).
   */
  v05: boolean;
  /** 새로앎을 글자 '네'로 썼다 */
  ne: boolean;
  /** 새로앎을 표지 이름 '새로앎'(W11)으로 쓰고 '군'은 쓰지 않았다(2026-10-15 검토 2: rules05가 E30) */
  neLabel: boolean;
  /** 읽은 v0.5 별칭(쓴 그대로) */
  aliases: string[];
  /** v0.6: 쓴 차례가 정규 순서 [근거,군,결,시제,화행]를 벗어났다(rules06 W34) */
  marksOff: boolean;
}

/**
 * 표지 블록 [ ] 안을 너그럽게 읽는다. 화행이 없으면 null(받은대로 절은 화행을 빼도 된다).
 * v0.5(2026-10-15, reports/v0.5-design.md 1.1): 새로앎 '군'(뜻은 '네'와 같다), 시제 '었'·'을'(하나까지, 둘이면 E28),
 * 표지 별칭(see, 见 … 진단 없이 읽고 rules05가 W26)을 더 읽는다. 옛 줄에 없던 글자라 옛 판정은 그대로다.
 */
function parseMarkBlock(text: string, outerParen: string | null, ctx: Ctx, echo: boolean): MarkBlock | null {
  const shown = `[${text}]`;
  const parens = parenContents(text);
  if (outerParen !== null) parens.push(outerParen);
  const rest = blankParens(text);
  const evs: Ev[] = [];
  const acts: Act[] = [];
  const tenses: Tense[] = [];
  const figs: Fig[] = [];
  const aliases: string[] = [];
  const ranks: number[] = []; // v0.6: 읽은 표지의 정규 자리(쓴 차례)
  let news = false;
  let gun = false;
  let newEn = false; // v0.7: 영어 new(네·군을 가르지 않는다)
  let ne = false;
  let neLabel = false;
  let bare: string | null = null;
  const take = (raw: string) => {
    let t = raw;
    let named = false; // 표지 이름·별칭으로 쓴 것(글자 '네'를 쓴 것이 아니다)
    const alias = markAlias(t, ctx, MARK_ALIASES_06);
    const alias05 = alias === undefined ? markAlias05(t) : undefined;
    if (alias !== undefined) {
      t = alias;
      named = true;
    } else if (alias05 !== undefined) {
      aliases.push(raw);
      t = alias05;
      named = true;
    } else if (t === '자신') return;
    else if (/^[\d０-９.%]+$/u.test(t)) {
      // 괄호 없는 수는 하나만 자신으로 읽는다. 둘째 수([겠,다,7|9]의 9)를 말없이 버리지 않는다(2026-10-14 반례 검토)
      if (bare !== null) ctx.err('E19', `괄호 없이 쓴 수가 둘 이상이다: ${shown}`);
      bare ??= t;
      return;
    } else if (SELF_END.test(t) || STRAY051.test(t)) {
      // 2026-10-15 검토 3: 표지 블록 안의 자신 !N([봄,다,!6])은 모르는 표지(E05)가 아니라 자리 오류(E29)다. 틀에는 두지 않는다
      // v0.5.1: 끝 묶음([봄,다,*R8])도 같다
      ctx.err('E29', `자신 ${t}는 표지 블록이 아니라 절의 맨 끝(> 바로 앞)에 쓴다: ${shown}`);
      return;
    } else {
      // 표지에 붙여 쓴 것([봄,다!6])은 표지를 읽고 !6은 E29
      const g = SELF_GLUED.exec(t);
      if (g) {
        take(g[1]);
        take(g[2]);
        return;
      }
    }
    // v0.7(2026-10-29): 한글 글자(붙여 쓴 겠다 포함)는 글자마다, 영어 내부 값·열 언어 별칭(see·inf·say, seh·見·вид …)은 낱말 하나가 표지 하나다. 내부 값은 영어(MARK_KO2EN)
    const chs = Array.from(t);
    let pairs: [string, string][]; // [내부 영어, 쓴 글자]
    if (chs.every((c) => MARK_CHARS.has(c))) pairs = chs.map((c) => [MARK_KO2EN[c], c]);
    else {
      const en = markOf07(t);
      if (en === undefined) {
        ctx.err('E05', `알 수 없는 표지 '${raw}': ${shown}`);
        return;
      }
      pairs = [[en, t]];
      named = true;
    }
    for (const [e, c] of pairs) {
      if (e in EV_07) {
        ranks.push(MARK_RANK.ev);
        if (!evs.includes(e as Ev)) evs.push(e as Ev);
      } else if (e === NEWS_07) {
        ranks.push(MARK_RANK.news);
        news = true;
        if (c === NEWS) {
          if (!named) ne = true; // 글자 '네'를 그대로 썼다(E30)
          else neLabel = true; // 표지 이름 '새로앎'(v0.5 별칭 new·新은 군이라 여기 오지 않는다)
        } else if (raw.toLowerCase() === 'new' || !MARK_CHARS.has(c)) newEn = true; // v0.7 영어 new(v0.5 별칭이기도 하다)·열 언어 별칭: 네·군을 가르지 않는다. 괄호 자신이 있는 옛 절의 정규형(…(7))을 다시 읽어도 옛 꼴로 남게 아래에서 가른다
        else gun = true; // 한글 군(v0.5 별칭 新도 군으로 읽혀 여기 온다)
      } else if (e in FIG_07) {
        ranks.push(MARK_RANK.fig);
        if (!figs.includes(e as Fig)) figs.push(e as Fig);
      } else if (e in TENSE_07) {
        ranks.push(MARK_RANK.tense);
        if (!tenses.includes(e as Tense)) tenses.push(e as Tense);
      } else if (e in ACT_07) {
        ranks.push(MARK_RANK.act);
        if (!acts.includes(e as Act)) acts.push(e as Act);
      }
    }
  };
  for (const piece of rest.split(/[,，、·・･;；/|｜]+/u).map((x) => x.trim()).filter(Boolean)) {
    const compact = piece.replace(/\s+/gu, '');
    if (Object.hasOwn(MARK_ALIASES_06, compact)) take(compact);
    else piece.split(/\s+/u).forEach(take);
  }
  if (bare !== null) {
    if (parens.length) ctx.err('E19', `자신을 두 번 썼다: ${shown}`);
    else {
      parens.push(bare);
      ctx.warn('W19', `괄호 없이 쓴 자신을 읽었다. 정규형은 화행 뒤 괄호: ${shown}`);
    }
  }
  if (parens.length > 1) ctx.err('E19', `자신 괄호가 둘 이상이다: ${shown}`);
  if (evs.length > 1) ctx.err('E06', `근거가 둘 이상이다: ${shown}`);
  if (tenses.length > 1) ctx.err('E28', `시제가 둘 이상이다(었·을은 하나까지): ${shown}`);
  if (figs.length > 1) ctx.err('E36', `결 표지가 둘 이상이다(한·역·비는 하나까지): ${shown}`);
  if (acts.length > 1) ctx.err('E04', `화행이 둘 이상이다: ${shown}`);
  if (acts.length === 0 && !echo) {
    ctx.err('E03', `화행이 없다: ${shown}`);
    return null;
  }
  const [act] = acts;
  const [ev] = evs;
  const [tense] = tenses;
  const [fig] = figs;
  if (act === 'say' && !ev) ctx.err('E07', `단언(say·다)에는 근거가 있어야 한다: ${shown}`);
  if (news && act && act !== 'say') ctx.err('E08', `새로앎(${gun ? 'new·군' : '네'})은 단언(say·다)과만 쓴다: ${shown}`);
  const marks: PartialMarks = {};
  if (act) marks.act = act;
  if (ev) marks.ev = ev;
  if (news) marks.news = true;
  if (tense) marks.tense = tense;
  if (fig) marks.fig = fig;
  // 2026-10-15 검토 1: 정규형에 남는 꼴(군·시제)만 v0.5 꼴로 친다. 근거·화행 별칭만 쓴 절은 정규형이 옛 꼴과 같다
  // v0.6: 결 표지도 정규형에 남고(군 뒤 시제 앞) 옛 꼴로 쓸 수 없어 v0.5 꼴로 친다
  const pd = parens.length ? parseDigits(parens[0], ctx, shown) : {};
  // v0.7: 영어 new는 괄호 자신((7))이 없을 때만 v0.5 꼴로 친다(옛 절의 정규형 <9 [gut,new,say(7)] …>를 다시 읽으면 같은 정규형이게)
  const v05 = gun || tenses.length > 0 || figs.length > 0 || (newEn && pd.self === undefined);
  const marksOff = ranks.some((r, k) => k > 0 && r < ranks[k - 1]);
  return { marks, v05, ne, neLabel: neLabel && !gun && !newEn, aliases, marksOff, ...pd };
}

// ───────── 절·줄 ─────────

/** 내용 가운데·끝에 둔 화살표 앞붙이 꼴(v0.6 ⊗ 포함) */
const PREFIX_LIKE = new RegExp(`^(?:→|[↓↔∥↖⊗]|(?:${PROCESS_ALIAS_RE})→)\\S`, 'iu');

/** v0.5.2: 표지 블록 바로 뒤 괄호가 옛 자신·먹 자리인가(수와 이름표 자신·먹, |, /, %만). 아니면 0.5.1 꼴 절에서는 내용이다 */
const PAREN_NUMLIKE = /^(?:\s|자신|먹|ink|[\d０-９.%|｜/])*$/iu; // v0.7: 먹 이름표는 ink

/**
 * v0.5 자신 !N(2026-10-15, reports/v0.5-design.md 1.2): 꺾쇠 안 맨 끝(> 바로 앞)의 한 자리. 전각 느낌표(！)와 전각 숫자는 W01로 읽는다.
 * 한 자리가 아닌 수(!10, !.8)는 괄호의 자신처럼 한 자리로 바꿔 읽고 W20이다. 맨 끝이 아닌 자리(내용 가운데, 표지 블록 앞·안, > 밖)는 E29.
 */
// 수에는 숫자가 하나 이상 있어야 한다: '雪!.'·'雪!!'은 전처럼 끝 부호를 떼는 어절(W10)이다(맞던 줄이 깨지지 않게)
const SELF_NUM = '(?=[.%]*[\\d０-９])[\\d０-９.%]+';
const SELF_MARK = '[!！*＊]';
const SELF_END = new RegExp(`^${SELF_MARK}(${SELF_NUM})$`, 'u');
/** 내용 끝 어절에 붙여 쓴 자신(雪*6). 앞 글자가 하나 이상 있어야 한다 */
const SELF_GLUED = new RegExp(`^(.+?)(${SELF_MARK}${SELF_NUM})$`, 'u');
/** 띄워 쓴 자신의 수('* 6'의 6) */
const SELF_NUM_ONLY = new RegExp(`^${SELF_NUM}$`, 'u');
const SELF_STRAY = new RegExp(`^(?:${SELF_MARK}\\s*${SELF_NUM}\\s*)+$`, 'u');
/**
 * 어절 안에 붙여 쓴 자신(雪*6 雨의 雪*6, 雪*6雨). 2026-10-15 검토 3: 전에는 어절을 읽을 수 없다(E19)로 자신을 잃었다. 자리 오류 E29로 알린다.
 * 'g'라서 test()로 쓰지 않는다(lastIndex가 남는다). match·split만 쓴다. 새 꼴의 어절에는 '*'가 올 수 없어(E19) 맞던 줄은 그대로다.
 */
const SELF_IN = new RegExp(`${SELF_MARK}${SELF_NUM}`, 'gu');

/**
 * v0.5.1 끝 묶음(2026-10-16 Jae, reports/v0.5.1-design.md 1.2): 내용 뒤 '*먹채↓근거'. 채 = 색(RGBCMYK) + 확신 0~9, 먹 = 그 앞의 검은 수(측정기만).
 * 새 꼴로 읽는 것: 색 글자가 있는 끝 묶음(*R8, *6R8↓12), 근거가 붙은 옛 자신(*8↓12), ● 절의 근거만 쓴 끝(↓12).
 * 색도 근거도 없는 *N은 옛 자신(2026-10-16 하루 쓴 꼴)으로 gatherEndSelf가 읽는다. ● 아닌 절의 근거만 쓴 끝(↓12)은 전처럼 앞붙이(W19)다.
 */
export const CHAE_COLORS = 'RGBCMYK';
const END_D = '[0-9０-９]';
const END_L = '[A-Za-zＡ-Ｚａ-ｚ]';
const END_REFS = '(?:↓[^\\s↓]+)';
const END051 = new RegExp(`^${SELF_MARK}(${END_D}?)(${END_L})(${END_D}?)(${END_REFS}*)$`, 'u');
/** 별 뒤를 띄운 끝 묶음의 뒷부분(* R8의 R8) */
const END051_BODY = new RegExp(`^${END_D}?${END_L}${END_D}?${END_REFS}*$`, 'u');
const END051_GLUED = new RegExp(`^(.*[^*＊!！\\s])(${SELF_MARK}${END_D}?${END_L}${END_D}?${END_REFS}*)$`, 'u');
const SELF_REFS = new RegExp(`^${SELF_MARK}(${SELF_NUM})(${END_REFS}+)$`, 'u');
const SELF_REFS_GLUED = new RegExp(`^(.*[^*＊!！\\s])(${SELF_MARK}${SELF_NUM}${END_REFS}+)$`, 'u');
/** 대화 밖의 근거(2026-10-16 Jae): 시험 문제 ↓Q3, 다른 참가자 ↓@kimi(전각 ＠도 읽는다) */
const QUIZ_REF = /^[QqＱｑ][0-9０-９]+$/u;
const AGENT_REF = /^[@＠][^\s↓@＠<>〈〉＜＞*＊]+$/u;
/** v0.6(2026-10-24): 지난 대화의 절 ↓53:12, ↓53:12.1, ↓53:절12(대화 번호:절 번호) */
const THREAD_REF = /^([0-9０-９]+)[:：]([절점]?)([0-9０-９]+(?:\.[0-9０-９]+)?)$/u;
function threadRef(r: string): { thread: number; clause: string } | null {
  const m = THREAD_REF.exec(r);
  return m ? { thread: Number(fullToHalf(m[1])), clause: (m[2] || '절') + fullToHalf(m[3]) } : null;
}
const REFS_ONLY = new RegExp(`^${END_REFS}+$`, 'u');
/** 끝 묶음처럼 보이지만 읽을 수 없는 것(*67R8, *R8G3): 내용 어절(E19)이 아니라 E32로 알린다 */
const END_BAD = new RegExp(`^${SELF_MARK}[0-9０-９A-Za-zＡ-Ｚａ-ｚ]*${END_L}[0-9０-９A-Za-zＡ-Ｚａ-ｚ↓/:.]*$`, 'u');
/** > 밖에 쓴 끝 묶음(<…> *R8↓12)은 E29 */
const STRAY051 = new RegExp(`^${SELF_MARK}${END_D}?${END_L}${END_D}?${END_REFS}*$`, 'u');
const fullToHalf = (s: string) => s.replace(/[０-９Ａ-Ｚａ-ｚ]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

interface End051 {
  self?: number;
  color?: string;
  muk?: number;
  because: Because[];
  /** 쓴 그대로(진단에 보인다) */
  tok: string;
}

/** 끝 묶음이 될 낱말인가(끝의 문장 부호를 떼어 볼 때 쓴다) */
const isEnd051 = (t: string, allDot: boolean) => END051.test(t) || SELF_REFS.test(t) || END051_GLUED.test(t) || SELF_REFS_GLUED.test(t) || (allDot && REFS_ONLY.test(t));

/**
 * 내용 쪽 낱말들(at)의 맨 끝에서 v0.5.1 끝 묶음을 떼어 읽는다. 새 꼴이 아니면 at을 건드리지 않고 null.
 * 끝 묶음 뒤에 띄어 쓴 근거(*R8 ↓12)와 내용 끝 어절에 붙여 쓴 것(많다*R8↓12)도 읽는다(진단 없음, v0.5 끝 자신과 같다).
 */
function gatherEnd051(at: string[], allDot: boolean, ctx: Ctx, shown: string, odd: { v: boolean }): End051 | null {
  let k = at.length;
  while (k > 0 && REFS_ONLY.test(at[k - 1])) k--;
  // v0.5.2(2026-10-17 Jae, 띄어쓰기): 별 뒤를 띄운 끝 묶음(* R8, * 6R8↓12)은 붙여 읽고 W33(전에는 E19·E33이고 R8이 내용으로 샜다)
  if (k >= 2 && /^[*＊]$/u.test(at[k - 2]) && END051_BODY.test(at[k - 1])) {
    ctx.warn('W33', `별 뒤를 띄운 끝 묶음을 붙여 읽었다. 정규형은 '*${at[k - 1]}': ${shown}`);
    at.splice(k - 2, 2, at[k - 2] + at[k - 1]);
    k--;
  }
  const tail = at.slice(k);
  let head: string | null = null;
  let tok: string | null = null;
  if (k > 0) {
    const t = at[k - 1];
    if (END051.test(t) || SELF_REFS.test(t)) tok = t;
    else {
      const g = END051_GLUED.exec(t) ?? SELF_REFS_GLUED.exec(t);
      if (g) {
        head = g[1];
        tok = g[2];
      } else if (END_BAD.test(t)) {
        ctx.err('E32', `끝 묶음을 읽을 수 없다(*먹채↓근거: 먹 한 자리, 색 RGBCMYK 하나, 확신 0~9 한 자리): '${t}' ${shown}`);
        at.splice(k - 1, at.length);
        return { because: [], tok: t };
      }
    }
  }
  if (tok === null && !(allDot && tail.length)) return null;
  at.splice(tok === null ? k : k - 1, at.length, ...(head ? [head] : []));
  const end: End051 = { because: [], tok: [tok ?? '', ...tail].join(' ').trim() };
  let refs = tail.join('');
  if (tok !== null) {
    if (tok[0] !== '*') odd.v = true; // 정규형은 *(＊·!·！도 읽는다)
    const m = END051.exec(tok);
    if (m) {
      if (fullToHalf(tok) !== tok) odd.v = true;
      if (m[1]) end.muk = Number(fullToHalf(m[1])) / 10;
      const letter = fullToHalf(m[2]);
      if (letter !== letter.toUpperCase()) odd.v = true;
      const color = letter.toUpperCase();
      if (!CHAE_COLORS.includes(color)) ctx.err('E32', `채의 색은 R·G·B·C·M·Y·K 가운데 하나다: '${m[2]}' ${shown}`);
      else if (!m[3]) ctx.err('E32', `채의 색 뒤에 확신 수(0~9)가 없다: '${tok}' ${shown}`);
      else {
        end.color = color;
        end.self = Number(fullToHalf(m[3])) / 10;
      }
      refs = m[4] + refs;
    } else {
      // 근거가 붙은 옛 자신(*8↓12): 수는 옛 자신 그대로 읽는다(색이 없으니 rules05 E33)
      const sr = SELF_REFS.exec(tok)!;
      const raw = sr[1].replace(/[０-９]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48));
      if (raw !== sr[1]) odd.v = true;
      const d = oneDigit(raw, ctx, '자신', shown);
      if (d !== null) end.self = d / 10;
      refs = sr[2] + refs;
    }
  }
  for (const r of refs.split('↓').slice(1)) {
    let ref = parseRefLoose(r);
    // 끝의 문장 부호(*R8↓12。)는 내용 어절처럼 떼어 읽고 W10(주소는 그대로 둔다)
    const cut = stripTrailingPunct(r);
    if (!ref && cut !== r && (ref = parseRefLoose(cut))) ctx.warn('W10', `어절 끝의 문장 부호를 뗐다: '↓${r}'`);
    let past: { thread: number; clause: string } | null = null;
    if (ref) end.because.push(ref);
    else if (/^https?:\/\/\S+$/iu.test(r)) end.because.push({ url: r });
    // v0.6: 지난 대화의 절(↓53:12). 끝의 문장 부호는 절 번호처럼 떼어 읽고 W10
    else if ((past = threadRef(r) ?? threadRef(cut))) {
      if (!threadRef(r)) ctx.warn('W10', `어절 끝의 문장 부호를 뗐다: '↓${r}'`);
      if (!/^\d+:[절점]?\d+(?:\.\d+)?$/u.test(threadRef(r) ? r : cut)) ctx.warn('W01', `지난 대화의 절은 ↓대화:절 번호로 쓴다(↓53:12): '↓${r}'`);
      end.because.push(past);
    }
    // 2026-10-16 Jae: 대화 밖의 근거 — 시험 문제 ↓Q3(q·Ｑ도 읽고 W01), 다른 참가자 ↓@kimi
    else if (QUIZ_REF.test(r)) {
      if (!/^Q\d+$/u.test(r)) ctx.warn('W01', `시험 문제 근거는 ↓Q와 번호로 쓴다: '↓${r}'`);
      end.because.push({ quiz: Number(fullToHalf(r.slice(1))) });
    } else if (AGENT_REF.test(r)) {
      if (r[0] !== '@') ctx.warn('W01', `참가자 근거는 ↓@이름으로 쓴다: '↓${r}'`);
      end.because.push({ agent: stripTrailingPunct(r.slice(1)) });
    } else ctx.err('E32', `근거 ↓를 읽을 수 없다(절 번호, 지난 대화의 절 53:12, 시험 문제 Q3, 참가자 @이름, 주소): '↓${r}' ${shown}`);
  }
  return end;
}

/**
 * 내용 쪽 낱말들(at)의 맨 끝을 끝의 자신 한 낱말로 모은다. 맨 끝이 자신이면 true.
 * 띄운 '! 6'과 내용에 붙인 '雪!6'도 끝의 자신으로 읽는다(진단 없음. 앞붙이의 '↓ 1'처럼 띄어쓰기만 다르다. 둘 다 전에는 E19였다).
 */
function gatherEndSelf(at: string[]): boolean {
  const n = at.length;
  if (n >= 2 && /^[!！*＊]$/u.test(at[n - 2]) && SELF_NUM_ONLY.test(at[n - 1])) {
    at.splice(-2, 2, at[n - 2] + at[n - 1]);
    return true;
  }
  if (n === 0) return false;
  if (SELF_END.test(at[n - 1])) return true;
  const g = SELF_GLUED.exec(at[n - 1]);
  if (g) at.splice(-1, 1, g[1], g[2]);
  return g !== null;
}

/**
 * v0.4 점 자리(2026-10-15 Jae, 천지인의 하늘 점): '·' = 나, '·→kimi' = 나→kimi. 가운뎃점 꼴은 모두 같은 점으로 읽는다
 * (· U+00B7, • U+2022, ・ U+30FB, ㆍ U+318D 아래아, ∙ U+2219, ⋅ U+22C5, ‧ U+2027). 정규형은 '·'.
 */
export const DOT_CHARS = '·•・ㆍ∙⋅‧';
const DOT_RE = new RegExp(`^[${DOT_CHARS}](→.*)?$`, 'u');
/** v0.5.1 채운 원 '●' = 나 → 모두. ⬤(U+2B24)·⚫(U+26AB, 뒤의 U+FE0F 포함)도 같은 원으로 읽고 W01 */
export const ALL_CHARS = '●⬤⚫';
const ALL_RE = new RegExp(`^([${ALL_CHARS}])\\uFE0F?(→.*)?$`, 'u');
/** v0.5.2: 점(·, ●)에 붙여 쓴 앞붙이. 받는 이(·→kimi)는 점 자리 그대로라 넣지 않는다 */
const GLUED_DOT_PREFIX = new RegExp(`^([${DOT_CHARS}]|[${ALL_CHARS}]\\uFE0F?)((?:[↓↔∥↖⊗]|(?:${PROCESS_ALIAS_RE})→|숙고|미해결|받은대로).*)$`, 'iu');
const LABEL_BEFORE_DOT = new RegExp(`((?:[절점]|[cC])\\s*\\d+(?:\\.\\d+)?)(?=[${DOT_CHARS}${ALL_CHARS}→↓↔∥↖⊗])`, 'u');
/** v0.7: 수만 쓴 머리에 붙여 쓴 점(<1·→kimi …>)도 띄어 읽는다(맨 앞에서만) */
const BARE_BEFORE_DOT = new RegExp(`^(\\s*\\d+(?:\\.\\d+)?)(?=[${DOT_CHARS}${ALL_CHARS}])`, 'u');

/** v0.3 절 하나(꺾쇠 안). lead는 꺾쇠 밖에 쓴 이름표. */
function parseClause03(rawInner: string, ctx: Ctx, lead: string | null, odd: { v: boolean }): Clause | null {
  const raw = tightenPrefixes(rawInner);
  const shown = `<${rawInner.trim()}>`;
  const open = firstOf(raw, SQ_OPEN_CODES);
  if (open < 0) {
    ctx.err('E01', `표지 블록 [ ]이 없다: '${shown}'`);
    return null;
  }
  const close = firstOf(raw, SQ_CLOSE_CODES, open + 1);
  if (close < 0) {
    ctx.err('E02', `표지 블록이 닫히지 않았다: '${shown}'`);
    return null;
  }
  if (raw[open] !== '[' || raw[close] !== ']') odd.v = true;
  // 이름표에 붙여 쓴 점·앞붙이(<절5·→kimi …>)는 띄어 읽는다(v0.4)
  const before = raw.slice(0, open).replace(LABEL_BEFORE_DOT, '$1 ').replace(BARE_BEFORE_DOT, '$1 ');
  let after = raw.slice(close + 1);
  const markText = raw.slice(open + 1, close);
  let outerParen: string | null = null;
  const pm = /^\s*[(（]([^)）]*)[)）]/u.exec(after);
  // v0.5.2: 0.5.1 꼴 절에서 수가 아닌 괄호(〔봄,다〕 (de Tür)…)는 내용으로 돌려놓는다(아래 rich). 붙여 쓴 꼬리((x)가)를 알려고 둔다
  const parenGlued = pm !== null && after.length > pm[0].length && !WS.test(after[pm[0].length]);
  if (pm) {
    outerParen = pm[1];
    after = after.slice(pm[0].length);
  }
  const second = firstOf(after, SQ_OPEN_CODES);
  if (second >= 0) {
    ctx.err('E19', `표지 블록이 둘 이상이다: '${shown}'`);
    const end = firstOf(after, SQ_CLOSE_CODES, second + 1);
    after = after.slice(0, second) + ' ' + (end < 0 ? '' : after.slice(end + 1)); // 같은 까닭으로 오류를 두 번 내지 않게 뗀다
  }

  const clause: Clause = { label: null, process: null, place: null, to: null, words: [], marks: {} };
  const st = { echo: false };
  // v0.5.2(2026-10-17 Jae, 띄어쓰기): 점에 붙여 쓴 앞붙이(·↔6, ·↓1, ●↖2)는 띄어 읽는다(광장 10.16~17에 7번, 전에는 E25·E19).
  // 내용의 띄어쓰기는 자율이지만 줄꼴(뼈대)을 벗어난 것은 경고를 남긴다(Jae): W33
  const bt = before.trim() ? before.trim().split(/\s+/u).flatMap((t) => {
    const g = GLUED_DOT_PREFIX.exec(t);
    if (g) ctx.warn('W33', `점과 앞붙이를 붙여 쓴 것을 띄어 읽었다. 정규형은 '${g[1]} ${g[2]}': '${shown}'`);
    return g ? [g[1], g[2]] : [t];
  }) : [];
  const at = after.trim() ? after.trim().split(/\s+/u) : [];
  // v0.5.1: 맨 끝의 끝 묶음(*먹채↓근거). 끝 묶음 뒤 문장 부호(*R8↓12。)는 내용 어절처럼 떼어 읽고 W10이다
  const allDot = bt.some((t) => ALL_RE.test(t));
  if (at.length && !isEnd051(at[at.length - 1], allDot)) {
    const last = at[at.length - 1];
    const cut = stripTrailingPunct(last);
    if (cut !== '' && cut !== last && isEnd051(cut, allDot)) {
      ctx.warn('W10', `어절 끝의 문장 부호를 뗐다: '${last}'`);
      at[at.length - 1] = cut;
    }
  }
  const end = gatherEnd051(at, allDot, ctx, shown, odd);
  // v0.5.2(2026-10-17 Jae): 0.5.1 꼴 절(●, 색이 있는 채, 끝 근거)의 내용은 부호를 받아 쓴 그대로 둔다(parseWord052).
  // 아래 is051과 같은 조건이다(색 있는 채가 다른 자리의 자신과 겹친 E27 절은 is051이 아니어도 여기서는 부호를 받는다. 오류 줄이다)
  const rich = allDot || end?.color !== undefined || (end?.because.length ?? 0) > 0;
  if (rich && outerParen !== null && !PAREN_NUMLIKE.test(outerParen)) {
    // 수가 아닌 괄호는 옛 자신·먹 자리가 아니라 내용이다(전에는 E10)
    const back = pm![0].trim().split(/\s+/u);
    if (parenGlued && at.length) at[0] = back.pop()! + at[0];
    at.unshift(...back);
    outerParen = null;
  }
  // v0.5: 꺾쇠 안 맨 끝의 자신 !N. 다른 자리의 !N은 아래 내용 읽기와 표지 블록 읽기에서 E29.
  if (!gatherEndSelf(at) && at.length) {
    // 2026-10-15 검토 3: 맨 끝 자신 뒤의 문장 부호(!6。, 雪!6。, ! 6。)는 내용 어절처럼 떼어 읽고 W10이다.
    // 전에는 부호를 뗀 뒤 '!6'을 어절로 읽어 E19였고 자신을 잃었다. 부호를 떼도 자신이 아니면(雪。) 전처럼 아래 parseWord가 본다.
    // 부호를 떼지 않고 읽히는 것('!6.'은 W20으로 6)은 그대로 먼저 읽는다(판정이 바뀌지 않게)
    const last = at[at.length - 1];
    const cut = stripTrailingPunct(last);
    const trial = [...at.slice(0, -1), cut];
    if (cut !== '' && cut !== last && gatherEndSelf(trial)) {
      ctx.warn('W10', `어절 끝의 문장 부호를 뗐다: '${last}'`);
      at.splice(0, at.length, ...trial);
    }
  }
  const selfTok = at.length && SELF_END.test(at[at.length - 1]) ? at.pop()! : null;
  let moved = outerParen !== null;
  let i = 0;
  if (bt.length && LABEL_N.test(bt[0])) {
    clause.label = normLabel(bt[0][0] === '점' ? '점' : '절', bt[0].replace(/^(?:[절점]|[cC])/u, ''));
    i = 1;
  } else if (bt.length && BARE_NUM.test(bt[0]) && (bt.length === 1 || DOT_RE.test(bt[1]) || ALL_RE.test(bt[1]) || PREFIX_LIKE.test(bt[1]) || bt[1] === '받은대로' || bt[1] === '숙고' || bt[1] === '미해결')) {
    clause.label = normLabel('절', bt[0]); // v0.7 수만 쓴 머리(<1 · …>, 옛 절의 정규형 <1 ↓2 [...] …>)
    i = 1;
  }
  if (lead) {
    if (clause.label && clause.label !== lead) ctx.err('E19', `이름표가 둘이다: ${lead}, ${clause.label}`);
    clause.label ??= lead;
    moved = true;
  }
  const content: string[] = [];
  const first = i;
  for (; i < bt.length; i++) {
    // v0.5.1: 채운 원 ● = 나 → 모두. 받는 이를 붙이면 E31(받는 이는 두지 않는다)
    const a = ALL_RE.exec(bt[i]);
    if (a) {
      if (clause.me) ctx.err('E18', `점(·)이 둘이다: '${shown}'`);
      else if (i > first) ctx.warn('W22', `점(●)을 다른 앞붙이 뒤에서 읽었다. 정규형은 절 이름 바로 뒤: '${shown}'`);
      if (a[1] !== '●' || bt[i].includes('️')) odd.v = true;
      clause.me = true;
      clause.all = true;
      let rest = a[2] ?? '';
      if (!rest && bt[i + 1]?.startsWith('→')) rest = bt[++i]; // '● →kimi'
      if (rest) ctx.err('E31', `모두에게 하는 말(●)에는 받는 이를 두지 않는다: '${bt[i]}' ${shown}`);
      continue;
    }
    const d = DOT_RE.exec(bt[i]);
    if (d) {
      if (clause.me) ctx.err('E18', `점(·)이 둘이다: '${shown}'`);
      else if (i > first) ctx.warn('W22', `점(·)을 다른 앞붙이 뒤에서 읽었다. 정규형은 절 이름 바로 뒤: '${shown}'`);
      clause.me = true;
      let rest = d[1] ?? '';
      if (!rest && bt[i + 1]?.startsWith('→')) rest = bt[++i]; // '· →kimi'
      // v0.6: 다중 지목 ·→A,B(이름이 하나면 전처럼 아래 takePrefix03)
      const many = rest ? takeToList(rest, bt, i, clause, ctx, shown) : { ok: false, next: i };
      if (many.ok) i = many.next;
      else if (rest && !takePrefix03(rest, clause, ctx, st)) ctx.err('E19', `점 뒤의 받는 이를 읽을 수 없다: '${bt[i]}'`);
      continue;
    }
    if (takePrefix03(bt[i], clause, ctx, st)) continue;
    content.push(...bt.slice(i)); // 내용을 표지 블록 앞에 썼다
    moved = true;
    break;
  }
  let j = 0;
  if (content.length === 0) {
    for (; j < at.length && takePrefix03(at[j], clause, ctx, st); j++) moved = true;
  }
  content.push(...at.slice(j));
  // 내용 가운데·끝에 둔 화살표 앞붙이(<[봄,다] 雪 →kimi>, 2026-10-14v2 쓰기에서 다섯): v0.2.1의 줄 끝 →이름처럼 읽되 경고한다.
  // 뒤에서부터 읽는다(둘이면 뒤의 것이 받는 이). 2026-10-14: 읽은 것을 그 자리에서 빼던(splice) 것을 한 번에 걸러 낸다.
  const kept: string[] = [];
  for (let k = content.length - 1; k >= 0; k--) {
    const t = content[k];
    if (SELF_END.test(t) || STRAY051.test(t)) {
      ctx.err('E29', `자신 ${t}는 절의 맨 끝(> 바로 앞)에 쓴다: '${shown}'`);
      continue;
    }
    if (PREFIX_LIKE.test(t) && takePrefix03(t, clause, ctx, st)) {
      if (t.startsWith('→')) ctx.warn('W16', `받는 이 ${t}: 내용 뒤에서 읽었다. 정규형은 [ 앞: '${shown}'`);
      else moved = true;
      continue;
    }
    // 2026-10-15 검토 3: 어절에 붙여 쓴 자신(雪!6 雨, 雪!6雨)도 E29다. !N을 뺀 나머지는 내용으로 읽는다(E19를 겹쳐 내지 않게)
    const glued = t.match(SELF_IN);
    if (glued) {
      for (const g of glued) ctx.err('E29', `자신 ${g}는 절의 맨 끝(> 바로 앞)에 쓴다. 어절에 붙여 쓴 것은 맨 끝이 아니다: '${shown}'`);
      kept.push(...t.split(SELF_IN).filter(Boolean).reverse());
    } else kept.push(t);
  }
  kept.reverse();
  if (moved) ctx.warn('W19', `자리를 옮겨 읽었다. 정규형은 <이름 앞붙이 [표지(자신)] 내용>: '${shown}'`);

  const mk = parseMarkBlock(markText, outerParen, ctx, st.echo);
  if (!mk) return null;
  const words: Word[] = [];
  for (const t of kept) {
    if (st.echo && echoName(t)) {
      words.push({ text: t });
      continue;
    }
    // v0.5(설계 0·4): 새 꼴 줄의 내용은 어느 언어의 낱말이든 읽는다(가나 포함). v0.5.2: 0.5.1 꼴 절은 부호도 쓴 그대로
    const w = rich ? parseWord052(t, ctx) : parseWord(t, ctx, true);
    if (w) words.push(w);
  }
  // v0.6: 유(유보)도 내용을 비워도 된다(미루는 것 자체가 말이다). 거·양은 비울 수 없다(reports/v0.6-design.md 1.2)
  if (kept.length === 0 && !(mk.marks.act === 'ask' || mk.marks.act === 'dfr' || clause.process?.kind === 'err' || st.echo)) ctx.err('E16', `내용이 비었다: '${shown}'`);
  // 자신: 표지 칸(괄호·괄호 없는 수)의 옛 자리, 또는 맨 끝 !N(v0.5). 둘 다 쓰면 E27이고 어느 수도 틀에 두지 않는다(어느 쪽이 뜻인지 모른다)
  let self = mk.self;
  if (selfTok !== null) {
    const written = SELF_END.exec(selfTok)![1];
    const raw = written.replace(/[０-９]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 48));
    if (raw !== written || !['!', '*', '！', '＊'].includes(selfTok[0])) odd.v = true; // 전각 ！·＊·숫자는 W01
    const d = oneDigit(raw, ctx, '자신', shown);
    if (mk.self !== undefined) {
      ctx.err('E27', `자신이 둘이다: 끝의 ${selfTok}와 표지 칸의 자신. 자신은 끝의 *N 하나만 쓴다: '${shown}'`);
      self = undefined;
    } else if (d !== null) self = d / 10;
  }
  // v0.5.1: 끝 묶음의 채(색 + 수)·먹. 채가 다른 자리의 자신(끝의 *N, 표지 칸의 수)과 함께 오면 E27, 먹이 둘이면 E32(어느 수도 틀에 두지 않는다)
  let color: string | undefined;
  if (end && end.self !== undefined) {
    if (selfTok !== null || mk.self !== undefined) {
      ctx.err('E27', `자신(채)이 둘이다: 끝 묶음 ${end.tok}와 다른 자리의 자신. 채는 끝 묶음 하나만 쓴다: '${shown}'`);
      self = undefined;
    } else {
      self = end.self;
      color = end.color;
    }
  }
  let muk = mk.muk;
  if (end?.muk !== undefined) {
    if (muk !== undefined) {
      ctx.err('E32', `먹이 둘이다(표지 칸의 (먹N)과 끝 묶음): '${shown}'`);
      muk = undefined;
    } else muk = end.muk;
  }
  const out: Clause = { label: clause.label, process: clause.process, place: clause.place, to: clause.to, words, marks: mk.marks };
  if (muk !== undefined) out.muk = { conf: muk };
  if (self !== undefined) out.chae = color ? { self, color } : { self };
  if (clause.toList) out.toList = clause.toList;
  if (st.echo) out.echo = true;
  if (clause.me) out.me = true;
  if (clause.all) {
    out.all = true;
    out.to = null; // E31: ●에는 받는 이를 두지 않는다
    delete out.toList;
  }
  // v0.5.1: 0.5.1 꼴 절(●, 색 있는 채, 끝 근거)이면 앞에 쓴 근거 ↓N도 끝의 근거로 옮긴다(정규형은 끝). 그 밖의 절은 옛 앞붙이 그대로
  const because = [...(end?.because ?? [])];
  const is051 = clause.all === true || color !== undefined || because.length > 0;
  const frontBecause = clause.place?.rel === '↓';
  if (is051 && clause.place?.rel === '↓') {
    because.unshift(clause.place.target);
    out.place = null;
  }
  if (because.length) out.because = because;
  // v0.6: 갑 절은 앞의 어떤 절에도 기대지 않는다. 가리킴(앞붙이 자리·고침→·오류→·받은대로·끝 근거)을 쓰면 E35(reports/v0.6-design.md 1.2)
  if (mk.marks.ev === 'top' && (out.place || out.process?.target || st.echo || because.length)) {
    ctx.err('E35', `갑(새 화두) 절은 다른 절을 가리키지 않는다(↔ ∥ ↖ ⊗ ↓, 고침→, 오류→, 받침→, 받은대로, 끝 근거). 바탕이 있으면 그에 맞는 근거(봄·들·겠 …)를 쓴다: '${shown}'`);
  }
  // v0.6 덧붙임(2026-10-25 H-261025-8, reports/hunch-design.md 3.2): 받침 절은 직감이 아닌 근거로, ↓근거와 함께 받친다(E37)
  if (out.process?.kind === 'sup') {
    const ev = mk.marks.ev;
    if (ev === 'gut' || ev === 'top') ctx.err('E37', `받침 절의 근거는 촉·갑이 아니다(직감을 직감으로 받칠 수 없다). 뒤늦게 찾은 근거(봄·들·겠 …)와 ↓근거로 쓴다: '${shown}'`);
    else if (!because.length && out.place?.rel !== '↓') ctx.err('E37', `받침 절에는 끝에 ↓근거가 있어야 한다(무엇으로 받치는지): '${shown}'`);
  }
  // 2026-10-15 검토 1: form은 정규형에 남는 꼴로만 정한다(군·시제, 자신으로 읽힌 끝의 !N). 별칭은 written.aliases로만 남는다(rules05 W26).
  // 읽지 못한 !N(E27·E10)은 정규형에 나오지 않으므로 form을 정하지 않는다
  if (is051) out.form = '0.5.1';
  else if (mk.v05 || (selfTok !== null && self !== undefined)) out.form = '0.5';
  ctx.newForm.add(out);
  const wr: ClauseWritten = { selfInMarks: mk.self !== undefined, selfAtEnd: selfTok !== null || end?.self !== undefined, selfBang: selfTok !== null && /^[!！]/u.test(selfTok), ne: mk.ne, aliases: mk.aliases };
  if (frontBecause) wr.frontBecause = true;
  if (mk.marksOff) wr.marksOff = true;
  if (mk.neLabel) wr.neLabel = true;
  ctx.written.set(out, wr);
  return out;
}

/** v0.3 줄꼴의 줄을 읽는다. v0.3 줄꼴이 아니면 null. */
export function parseLine03(line: string, ctx: Ctx): Clause[] | null {
  const form = lineFormOf(line);
  if (!form) return null;
  let s = normalizeArrows(line);
  const odd = { v: s !== line };
  // < > 밖에 붙인 받는 이(→kimi <…>, <…> →kimi, <…> → kimi, →gemma)는 그 절의 [ 앞으로 옮겨 읽는다(W16)
  if (form === 'wrapped') s = moveOutsideTo(s, line, ctx);
  const out: Clause[] = [];
  if (form === 'bare') {
    ctx.warn('W18', `< >로 싸지 않은 절을 읽었다. 정규형은 <절N [표지] 내용>: '${line}'`);
    const c = parseClause03(s, ctx, null, odd);
    if (c) out.push(c);
  } else {
    const sp = splitWrapped(s);
    if (sp.odd) odd.v = true;
    // v0.5: > 밖에 쓴 자신(<…> !8)은 절 밖의 글(E19) 대신 자리 오류 E29로 알린다(설계 1·2: 자신은 꺾쇠 안 맨 끝)
    if (sp.stray && (SELF_STRAY.test(sp.stray) || STRAY051.test(sp.stray))) ctx.err('E29', `자신 *N은 > 밖이 아니라 꺾쇠 안 맨 끝(> 바로 앞)에 쓴다: '${sp.stray}'`);
    else if (sp.stray) ctx.err('E19', `절 < > 밖에 읽을 수 없는 글이 있다: '${sp.stray}'`);
    sp.parts.forEach((p, k) => {
      if (!p.closed) ctx.warn('W18', `닫는 >가 없어 ${k + 1 < sp.parts.length ? '다음 <' : '줄 끝'}까지를 한 절로 읽었다: '${p.text}'`);
      const c = parseClause03(p.inner, ctx, k === 0 ? sp.lead : null, odd);
      if (c) out.push(c);
    });
  }
  if (odd.v) ctx.warn('W01', '비슷한 기호를 정규 기호로 바꿨다');
  return out;
}
