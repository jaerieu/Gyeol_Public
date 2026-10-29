// 결 검사기 — 두 줄꼴(옛 꼴 v0.2.1, v0.3)이 함께 쓰는 것: 진단 모음, 가리킴, 어절, 표지 별칭, 앞붙이, 물결표.
// 2026-10-14: 한 파일(src/parse.ts)에 있던 검사기를 나눴다. 옛 꼴은 v02.ts, v0.3 줄꼴은 v03.ts, 메시지 단위는 src/parse.ts.
// 두 줄꼴에서 뜻이 같은 것만 여기 둔다. 뜻이 다른 것(가리킴을 번호만 써도 되는지, 둘째 →이름을 덮는지)은 PrefixRules로 받는다.
// 2026-10-15(v0.5): 새 꼴 줄의 내용은 어느 언어의 낱말이든 받는다(parseWord의 anyScript). 옛 꼴은 그대로 읽는다.

import type { Clause, ClauseWritten, Diagnostic, PlaceRel, ProcessKind, Ref, Word } from '../types.ts';
import { MARK_ALIASES, PROCESS_ALIASES, PROCESS_ALIAS_RE } from '../tables.ts';
import { HAN, HANGUL, stripTrailingPunct } from '../text.ts';

export class Ctx {
  diags: Diagnostic[] = [];
  line = 0;
  /** v0.3 줄꼴로 쓴 절. 가리킴 확인(절N·점N)과 W05에서 옛 꼴과 다르게 다룬다. */
  newForm = new WeakSet<Clause>();
  /** v0.5: 새 꼴 절마다 글에 쓴 꼴(자신의 자리, '네', 별칭). ParseResult.written으로 나가 rules05가 본다. */
  written = new WeakMap<Clause, ClauseWritten>();
  err(code: string, message: string) {
    this.diags.push({ code, severity: '오류', line: this.line, message });
  }
  warn(code: string, message: string) {
    this.diags.push({ code, severity: '경고', line: this.line, message });
  }
}

// ───────── 가리킴·이름표 ─────────

const REF_RE = /^(?:#([0-9a-f]{6,64}):)?([절점]\d+)$/u;
/** 이름표 절N·점N. 두 줄꼴이 같다. */
export const LABEL_RE = /^[절점]\d+$/u;

/** 가리킴(옛 꼴): 절2, 점3, #해시:절2. 번호만 쓴 것(2)은 v0.3 줄꼴에서만 읽는다(v03.ts parseRefLoose). */
export function parseRef(s: string): Ref | null {
  const m = REF_RE.exec(s);
  if (!m) return null;
  return { msg: m[1] ?? null, label: m[2] };
}

/** 받은대로에서 내용 자리에 쓴 받은 절·점의 이름(점1, 점1~점10, 절1의). v0.2.1(광장 상의 1의 2번). */
export const ECHO_LABEL = /^(?:#[0-9a-f]{6,64}:)?[절점]\d+(?:~[절점]?\d+)?\p{Script=Hangul}*$/u;

// ───────── 어절 ─────────

const ROOT_WORD = /^(\p{Script=Han}+)(\p{Script=Hangul}*)$/u;
const LATIN_WORD = /^([A-Za-z0-9][A-Za-z0-9_\-'.]*?)(\p{Script=Hangul}*)$/u;
const HANGUL_WORD = /^\p{Script=Hangul}+$/u;
/**
 * v0.5(2026-10-15, 설계 0·1.3·4): 새 꼴 줄의 내용은 세상의 말(어느 언어든)이다. 글자(\p{L})·결합 부호(\p{M})·숫자(\p{N})와
 * 낱말 안의 붙임표·밑줄·작은따옴표·마침표로 된 어절을 받는다(가나, 움라우트가 든 독일어, 키릴 문자 …). 검사기는 뜻을 판정하지 않는다.
 * 기호(이모지·%·따옴표 등)만은 전처럼 E19다. 끝의 한글은 꼬리로 나눈다(Fingerspitzengefühl이 = 어근 + 이).
 */
const ANY_WORD = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}_\-'.’]*$/u;

/** 한글 뒤에 한자가 오는가. 정규식 /한글.*한자/는 긴 어절에서 길이의 제곱이라 한 번 훑는다. */
function hangulThenHan(t: string): boolean {
  let seen = false;
  for (const ch of t) {
    if (!seen) seen = HANGUL.test(ch);
    else if (HAN.test(ch)) return true;
  }
  return false;
}

/** 끝의 한글 꼬리를 나눈다(한글은 모두 BMP라 낱자로 훑는다). 꼬리가 없거나 어절이 모두 한글이면 어절 전체가 어근이다. */
function splitTail(t: string): Word {
  let k = t.length;
  while (k > 0 && HANGUL.test(t[k - 1])) k--;
  return k > 0 && k < t.length ? { text: t, root: t.slice(0, k), suffix: t.slice(k) } : { text: t, root: t };
}

/**
 * 어절 하나를 읽는다. anyScript는 새 꼴(v0.3 꺾쇠 꼴, v0.4·v0.5 줄 포함)만 켠다: 옛 꼴(v0.2.1)은 v0.2.1에서 맞던 줄은 맞고
 * 틀리던 줄은 틀리게 그대로 읽는다(tests/v03.test.ts). 한자·한글·로마자 어절의 틀(root·suffix)과 E15는 두 꼴이 같다.
 */
export function parseWord(raw: string, ctx: Ctx, anyScript = false): Word | null {
  let t = raw;
  // 2026-10-14: 끝 부호는 한 번 훑어 뗀다(stripTrailingPunct). 전의 정규식은 부호가 길게 이어진 어절에서 길이의 제곱이었다. 뜻은 같다.
  const stripped = stripTrailingPunct(t);
  if (stripped !== t && !/^\d+(\.\d+)?$/.test(t)) {
    if (stripped !== '') {
      ctx.warn('W10', `어절 끝의 문장 부호를 뗐다: '${raw}'`);
      t = stripped;
    }
  }
  let m = ROOT_WORD.exec(t);
  if (m) return m[2] ? { text: t, root: m[1], suffix: m[2] } : { text: t, root: m[1] };
  if (HANGUL_WORD.test(t)) return { text: t };
  m = LATIN_WORD.exec(t);
  if (m && m[1]) return m[2] ? { text: t, root: m[1], suffix: m[2] } : { text: t, root: m[1] };
  // 한글 꼬리 뒤에 한자가 다시 오는 경우. 새 꼴은 글자 그대로 '한글 뒤에 한자'일 때만 본다(AI感情이처럼 한자가 앞에만 있으면 받는다)
  if (anyScript ? hangulThenHan(t) : HAN.test(t) && HANGUL.test(t)) {
    ctx.err('E15', `한 어절 안에서 한글 꼬리 뒤에 한자가 온다. 띄어 써야 한다: '${raw}'`);
    return null;
  }
  if (anyScript && ANY_WORD.test(t)) return splitTail(t);
  ctx.err('E19', `어절을 읽을 수 없다: '${raw}'`);
  return null;
}

// ───────── 내용의 부호(v0.5.2) ─────────
//
// 2026-10-17 Jae(reports/v0.5.2-design.md): 0.5.1 꼴 절(●, 색이 있는 채, 끝 근거)의 내용은 문장부호·수 연산 기호·일상 기호를 받아
// 쓴 그대로 남긴다(끝 부호를 떼지 않는다, W10 없음). 막는 것은 문법 기호와 그림 문자뿐이다. 까닭: 10.16~10.17 광장 글 219개 중
// E19 35개(괄호·따옴표·나열 가운뎃점·%·줄표), W10 92개(쉼표 125건). E19가 난 낱말은 정규형에서 사라져 뜻을 잃었다.
// 그 밖의 절(보관 줄·v0.5까지)은 위 parseWord 그대로다(판정·정규형·먹 이름이 바뀌지 않게).

/** 내용에 쓰지 않는 문법 기호: 꺾쇠·대괄호와 그 비슷한 꼴, 끝 묶음 *, 앞붙이 화살표, 옛 자신·먹의 |, 모두에게 ●, v0.6 양립 안 됨 ⊗(2026-10-24) */
export const RESERVED_IN_CONTENT = '<>〈〉＜＞⟨⟩《》‹›[]［］【】〔〕*＊→↓↔∥↖⇒⇣⇄‖|｜●⬤⚫⊗';
const RESERVED_SET = new Set(Array.from(RESERVED_IN_CONTENT));
/** 점의 가운뎃점 꼴(v03.ts DOT_CHARS와 같다). 내용에서는 낱말 사이(떨림·불면)에만 쓴다 */
const DOT_SET = new Set(Array.from('·•・ㆍ∙⋅‧'));
/** 그림 문자(이모지). 감정·어조는 채가 맡는다. 글에서 흔한 ©®™‼⁉는 받는다 */
const PICTO = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/u;
const PICTO_OK = new Set(Array.from('©®™‼⁉'));
const LNM = /[\p{L}\p{M}\p{N}]/u;
/** 어근 앞뒤에서 뗄 부호: 여는·닫는 괄호와 따옴표, 문장 끝 부호, 쉼표·쌍점, 줄표(—). 붙임표 -(-3)와 %·@·#·$ 같은 기호는 어근에 남긴다 */
const EDGE = /[\p{Ps}\p{Pe}\p{Pi}\p{Pf}"'.,;:!?…、。，．！？；：¿¡—–‑‒―]/u;

function stripEdges(s: string): string {
  const cs = Array.from(s);
  let a = 0;
  let b = cs.length;
  while (a < b && EDGE.test(cs[a])) a++;
  while (b > a && EDGE.test(cs[b - 1])) b--;
  return cs.slice(a, b).join('');
}

/**
 * 0.5.1 꼴 절의 내용 어절 하나(v0.5.2). 쓴 글(text)은 그대로 두고, 어근·꼬리는 부호를 뗀 글에서 나눈다:
 * '"door"가' = door + 가, '24%가' = 24% + 가, '있지만,' = 한글 어절. 부호만인 어절(+, =, —)은 어근이 없다.
 * 막는 것: 문법 기호(RESERVED_IN_CONTENT), 그림 문자, 낱말 사이가 아닌 가운뎃점. E15는 부호로 나뉜 글자 덩이마다 본다(雪이·雨는 받는다).
 */
export function parseWord052(raw: string, ctx: Ctx): Word | null {
  const cs = Array.from(raw);
  const bad = cs.find((c, i) => RESERVED_SET.has(c) || (PICTO.test(c) && !PICTO_OK.has(c)) || (DOT_SET.has(c) && (i === 0 || i === cs.length - 1 || DOT_SET.has(cs[i - 1]) || DOT_SET.has(cs[i + 1]))));
  if (bad !== undefined) {
    const why = DOT_SET.has(bad) ? '가운뎃점은 낱말 사이에만 쓴다(떨림·불면)' : PICTO.test(bad) ? '그림 문자(이모지)는 쓰지 않는다. 감정·어조는 채가 맡는다' : `'${bad}'는 문법 기호라 내용에 쓰지 않는다(< > [ ] * → ↓ ↔ ∥ ↖ ⊗ | ●)`;
    ctx.err('E19', `어절을 읽을 수 없다: '${raw}'. ${why}`);
    return null;
  }
  if (!cs.some((c) => LNM.test(c))) return { text: raw };
  // E15: 부호로 나뉜 글자 덩이마다 '한글 뒤에 한자'를 본다
  for (const run of raw.split(/[^\p{L}\p{M}\p{N}]+/u)) {
    if (run && hangulThenHan(run)) {
      ctx.err('E15', `한 어절 안에서 한글 꼬리 뒤에 한자가 온다. 띄어 써야 한다: '${raw}'`);
      return null;
    }
  }
  // 끝의 닫는 부호를 빼고 한글 꼬리를 나눈다. 꼬리 앞(어근)에 한글 아닌 글자·숫자가 있을 때만 꼬리다
  let end = cs.length;
  while (end > 0 && !LNM.test(cs[end - 1])) end--;
  let k = end;
  while (k > 0 && HANGUL.test(cs[k - 1])) k--;
  const head = stripEdges(cs.slice(0, k).join(''));
  const letters = Array.from(head).filter((c) => LNM.test(c));
  if (k < end && letters.some((c) => !HANGUL.test(c))) return { text: raw, root: head, suffix: cs.slice(k, end).join('') };
  const whole = stripEdges(raw);
  const all = Array.from(whole).filter((c) => LNM.test(c));
  if (all.every((c) => HANGUL.test(c))) return { text: raw };
  return { text: raw, root: whole };
}

// ───────── 표지 별칭 ─────────

/**
 * 표지 이름(추론·단언 …)이면 W11을 내고 표지 글자를, 아니면 undefined. 두 줄꼴의 표지 블록이 함께 쓴다.
 * v0.6(2026-10-24): 새 꼴은 table로 MARK_ALIASES_06(새 표지 이름 거절·한계 …)을 넘긴다. 옛 꼴은 MARK_ALIASES 그대로다.
 */
export function markAlias(t: string, ctx: Ctx, table: Record<string, string> = MARK_ALIASES): string | undefined {
  if (!Object.hasOwn(table, t)) return undefined;
  ctx.warn('W11', `표지 이름 '${t}'을 표지 글자 '${table[t]}'로 바꿨다`);
  return table[t];
}

// ───────── 앞붙이 ─────────

/** 두 줄꼴에서 앞붙이를 읽는 법이 다른 곳. */
export interface PrefixRules {
  /** 가리킴 읽기: 옛 꼴은 절2·점3만, v0.3은 번호만 쓴 2도 */
  ref: (s: string) => Ref | null;
  /** 받는 이 앞붙이의 꼴. 이름은 m[1] */
  to: RegExp;
  /** 둘째 →이름: 옛 꼴은 E18을 내고 뒤 이름으로 덮는다(v0.2.1 그대로), v0.3은 E18만 내고 앞 이름을 둔다 */
  toOverwrites: boolean;
}

/**
 * 받는 이를 절에 둔다. 이미 있으면 E18(shown = 글에 쓴 꼴)이고, overwrite면 뒤 이름으로 덮는다.
 * 옛 꼴의 앞붙이·줄 끝 →이름(v0.2.1), v0.3의 앞붙이·내용 뒤 →이름이 모두 이것을 거친다.
 */
export function putTo(clause: Clause, name: string, shown: string, ctx: Ctx, overwrite: boolean) {
  if (clause.to) {
    ctx.err('E18', `향함 앞붙이가 둘 이상이다: '${shown}'`);
    if (overwrite) clause.to = name;
  } else clause.to = name;
}

/**
 * 앞붙이 하나(숙고·미해결, 고침→N·오류→N, ↓↔∥↖N, →이름)를 읽어 절에 넣는다. 앞붙이 꼴이 아니면 false.
 * 가리킴을 읽을 수 없으면 E19를 내고 앞붙이로 친다(true). v0.3의 '받은대로'는 v03.ts가 따로 본다.
 */
/** 과정 앞붙이 별칭 → 내부 값(fix·err·sup). 라틴은 큰·작은 글자를 가리지 않는다 */
export function processKindOf(word: string): ProcessKind {
  const w = String(word);
  return (PROCESS_ALIASES[w] ?? PROCESS_ALIASES[w.toLowerCase()] ?? w.toLowerCase()) as ProcessKind;
}
const PROCESS_FIX_ERR = new RegExp(`^(${PROCESS_ALIAS_RE})→(.+)$`, 'iu');
/** 받침(sup) 별칭만: 받침|sup|stu|app|sos|apo|под|撑|撐|支 */
export const PROCESS_SUP_RE = new RegExp(`^(?:${['sup', ...Object.entries(PROCESS_ALIASES).filter(([, k]) => k === 'sup').map(([a]) => a)].join('|')})→(.+)$`, 'iu');

export function takePrefix(t: string, clause: Clause, ctx: Ctx, rules: PrefixRules): boolean {
  let m: RegExpExecArray | null;
  if (t === '숙고' || t === '미해결') {
    if (clause.process) ctx.err('E18', `과정 앞붙이가 둘 이상이다: '${t}'`);
    clause.process = { kind: t as ProcessKind };
    return true;
  }
  // v0.7(2026-10-29): 과정 앞붙이의 내부 값은 영어(fix 고침, err 오류). 한글은 첫째 별칭으로 그대로 읽는다. 라틴은 큰·작은 글자를 가리지 않는다
  // 2026-10-29: 열 언어 별칭(PROCESS_ALIASES, kor→·cor→·исп→·改→ …)도 같은 내부 값으로 읽는다. sup 별칭은 v03.ts의 받침 갈래가 받는다(지난 대화의 절도 가리킬 수 있어 따로)
  if ((m = PROCESS_FIX_ERR.exec(t)) && processKindOf(m[1]) !== 'sup') {
    const r = rules.ref(m[2]);
    if (!r) ctx.err('E19', `가리킴을 읽을 수 없다: '${t}'`);
    else {
      if (clause.process) ctx.err('E18', `과정 앞붙이가 둘 이상이다: '${t}'`);
      clause.process = { kind: processKindOf(m[1]), target: r };
    }
    return true;
  }
  if ((m = /^([↓↔∥↖])(.+)$/u.exec(t))) {
    const r = rules.ref(m[2]);
    if (!r) ctx.err('E19', `가리킴을 읽을 수 없다: '${t}'`);
    else {
      if (clause.place) ctx.err('E18', `자리 앞붙이가 둘 이상이다: '${t}'`);
      clause.place = { rel: m[1] as PlaceRel, target: r };
    }
    return true;
  }
  if ((m = rules.to.exec(t))) {
    putTo(clause, m[1], t, ctx, rules.toOverwrites);
    return true;
  }
  return false;
}

// ───────── 물결표 ─────────

const TILDE = /[~∼～]/u;

/**
 * 물결표 둘레의 띄어쓰기를 붙인다: '점1 ~ 점10' → '점1~점10'. 물결표(~∼～)는 '~'로.
 * 전의 전역 바꾸기(공백* 물결표 공백* → '~')와 같다: 공백·물결표가 이어진 덩어리마다 물결표 수만큼 '~'가 남고 공백은 빠진다.
 * 2026-10-14: 그 정규식은 긴 공백에서 자리마다 공백을 다시 훑어 길이의 제곱이었다. 덩어리를 한 번에 본다.
 */
export function tightenTildes(s: string): string {
  if (!TILDE.test(s)) return s; // 물결표가 없으면 바꿀 것이 없다(거의 모든 줄)
  return s.replace(/[\s~∼～]+/gu, (run) => (TILDE.test(run) ? '~'.repeat(run.replace(/[^~∼～]/gu, '').length) : run));
}
