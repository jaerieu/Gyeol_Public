// 결 검사기 — 두 줄꼴(옛 꼴 v0.2.1, v0.3)이 함께 쓰는 것: 진단 모음, 가리킴, 어절, 표지 별칭, 앞붙이, 물결표.
// 2026-10-14: 한 파일(src/parse.ts)에 있던 검사기를 나눴다. 옛 꼴은 v02.ts, v0.3 줄꼴은 v03.ts, 메시지 단위는 src/parse.ts.
// 두 줄꼴에서 뜻이 같은 것만 여기 둔다. 뜻이 다른 것(가리킴을 번호만 써도 되는지, 둘째 →이름을 덮는지)은 PrefixRules로 받는다.
// 2026-10-15(v0.5): 새 꼴 줄의 내용은 어느 언어의 낱말이든 받는다(parseWord의 anyScript). 옛 꼴은 그대로 읽는다.

import type { Clause, ClauseWritten, Diagnostic, PlaceRel, ProcessKind, Ref, Word } from '../types.ts';
import { PROCESS_ALIASES, PROCESS_ALIAS_RE } from '../tables.ts';
import { HANGUL, stripTrailingPunct } from '../text.ts';

export class Ctx {
  diags: Diagnostic[] = [];
  line = 0;
  /** v0.8(2026-11-11 Jae): 머리 줄이 0.8이거나 parse(..., { v08: true })로 부를 때 true. 옛 E15를 끄고 <절N · ● …>를 허용한다. */
  v08 = false;
  /** v0.3 줄꼴로 쓴 절. 가리킴 확인(절N·점N)과 W05에서 옛 꼴과 다르게 다룬다. */
  newForm = new WeakSet<Clause>();
  /** v0.5: 새 꼴 절마다 글에 쓴 꼴(자신의 자리, '네', 별칭). ParseResult.written으로 나가 rules05가 본다. */
  written = new WeakMap<Clause, ClauseWritten>();
  /** 언급(백틱으로 싼 글)의 원문. 줄을 읽는 동안 자리표로 가려 두고 진단 글에서는 되살린다(maskMentions). */
  mentions: string[] = [];
  err(code: string, message: string) {
    this.diags.push({ code, severity: '오류', line: this.line, message: unmaskMentions(message, this.mentions) });
  }
  warn(code: string, message: string) {
    this.diags.push({ code, severity: '경고', line: this.line, message: unmaskMentions(message, this.mentions) });
  }
}

// ───────── 언급(백틱) ─────────
//
// 2026-11-05 Jae: 결 문법 자체를 이야기하는 대화(감상)에서 참가자가 기호를 '쓰지' 않고 '말하려다'(sup→, ↔, *R3) E19에 걸렸다(판 94번).
// 내용 안에서 백틱으로 싼 글(`sup→`, `*R3`, `<1 · [ack] …>`)은 언급이다: 뼈대로 읽지 않고 쓴 그대로 내용 어절로 둔다(E19 없음).
// 꺾쇠·대괄호·별·화살표를 품어도 절을 나누거나 끝 묶음으로 읽지 않는다. 한 줄 안에서 닫힌 백틱만 언급이고, 닫히지 않은 백틱은 전처럼 글자다.
// 보관 줄에는 백틱이 없어 판정·정규형·먹 이름이 바뀌지 않는다(tests/fixtures/corpus-verdicts.json).

const MENTION_RE = /`[^`\n]*[^`\s][^`\n]*`/gu;
const MENTION_PH = /\uE000(\d+)\uE001/gu;
/** 언급 자리표의 여는 글자(사용자 영역 글자라 글에 나오지 않는다) */
export const MENTION_MARK = '\uE000';

/** 줄의 언급을 자리표로 가린다. 원문은 spans에 덧붙인다(자리표의 수가 spans의 자리). */
export function maskMentions(line: string, spans: string[]): string {
  if (!line.includes('`')) return line;
  return line.replace(MENTION_RE, (m) => {
    spans.push(m);
    return `\uE000${spans.length - 1}\uE001`;
  });
}

/** 줄의 언급 밖에서만 fn을 부른다(판이 끝 묶음·가리킴을 날 글로 훑을 때. 언급 안의 *R3·↓1은 끝 묶음·가리킴이 아니다). */
export function outsideMentions<T>(line: string, fn: (masked: string) => T): T {
  const spans: string[] = [];
  const out = fn(maskMentions(String(line ?? ''), spans));
  return (typeof out === 'string' ? unmaskMentions(out, spans) : out) as T;
}

/** 자리표를 원문으로 되살린다. */
export function unmaskMentions(s: string, spans: string[]): string {
  return s.includes(MENTION_MARK) ? s.replace(MENTION_PH, (_, n) => spans[Number(n)] ?? '') : s;
}

/**
 * 언급을 품은 내용 어절(`sup→`, `↔`로, (`*R3`)). 언급 밖의 글자는 parseWord052처럼 본다(언급 밖의 → 는 여전히 E19).
 * 어절은 쓴 그대로 남기고 어근·꼬리는 나누지 않는다(언급은 낱말이 아니라 글자 그대로다).
 */
export function parseMentionWord(raw: string, ctx: Ctx): Word | null {
  const outside = raw.replace(MENTION_PH, ' ').split(' ').filter((p) => p !== '');
  const probe = new Ctx();
  probe.v08 = ctx.v08;
  for (const p of outside) parseWord052(p, probe);
  const bad = probe.diags.find((d) => d.severity === '오류');
  if (bad) {
    ctx.err(bad.code, unmaskMentions(bad.message, ctx.mentions));
    return null;
  }
  return { text: unmaskMentions(raw, ctx.mentions) };
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

/** 받은대로에서 내용 자리에 쓴 받은 절·점의 이름(점1, 점1~점10, 절1의). v0.2.1(판 상의 1의 2번). */
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
  if (anyScript && ANY_WORD.test(t)) return splitTail(t);
  ctx.err('E19', `어절을 읽을 수 없다: '${raw}'`);
  return null;
}

// ───────── 내용의 부호(v0.5.2) ─────────
//
// 2026-10-17 Jae(reports/v0.5.2-design.md): 0.5.1 꼴 절(●, 색이 있는 채, 끝 근거)의 내용은 문장부호·수 연산 기호·일상 기호를 받아
// 쓴 그대로 남긴다(끝 부호를 떼지 않는다, W10 없음). 막는 것은 문법 기호와 그림 문자뿐이다. 까닭: 10.16~10.17 판 글 219개 중
// E19 35개(괄호·따옴표·나열 가운뎃점·%·줄표), W10 92개(쉼표 125건). E19가 난 낱말은 정규형에서 사라져 뜻을 잃었다.
// 그 밖의 절(보관 줄·v0.5까지)은 위 parseWord 그대로다(판정·정규형·먹 이름이 바뀌지 않게).

/** 내용에 쓰지 않는 문법 기호: 꺾쇠·대괄호와 그 비슷한 꼴, 끝 묶음 *, 앞붙이 화살표, 옛 자신·먹의 |, 모두에게 ●, v0.6 양립 안 됨 ⊗(2026-10-24) */
export const RESERVED_IN_CONTENT = '<>〈〉＜＞⟨⟩《》‹›[]［］【】〔〕*＊→↓↔∥↖⇒⇣⇄‖|｜●⬤⚫⊗';
const RESERVED_SET = new Set(Array.from(RESERVED_IN_CONTENT));
/** 점의 가운뎃점 꼴(v03.ts DOT_CHARS와 같다). 내용에서는 낱말 사이(떨림·불면)에만 쓴다 */
const DOT_SET = new Set(Array.from('·•・ㆍ∙⋅‧'));
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
  // v0.8.2 재검토(2026-11-13 Jae): 이모지(그림 문자)는 대화 내용으로 받는다. 문법 기호(● ⬤ ⚫ 등)만 막는다.
  const bad = cs.find((c, i) => RESERVED_SET.has(c) || (DOT_SET.has(c) && (i === 0 || i === cs.length - 1 || DOT_SET.has(cs[i - 1]) || DOT_SET.has(cs[i + 1]))));
  if (bad !== undefined) {
    const why = DOT_SET.has(bad) ? '가운뎃점은 낱말 사이에만 쓴다(떨림·불면)' : `'${bad}'는 문법 기호라 내용에 쓰지 않는다(< > [ ] * → ↓ ↔ ∥ ↖ ⊗ | ●)`;
    ctx.err('E19', `어절을 읽을 수 없다: '${raw}'. ${why}`);
    return null;
  }
  if (!cs.some((c) => LNM.test(c))) return { text: raw };
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
    ctx.err('E26', `옛 과정 앞붙이 '${t}'다. 낮은 확신·lim과 내용으로 쓴다`);
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
  if (/^∥.+$/u.test(t)) {
    ctx.err('E26', `옛 앞붙이 '∥'다: '${t}'`);
    return true;
  }
  if (/^↓.+$/u.test(t)) {
    ctx.err('E26', `앞 근거 '${t}'는 옛 표기다. 근거는 끝 묶음 뒤에 *5B8↓N으로 쓴다`);
    return true;
  }
  if ((m = /^([↔↖])(.+)$/u.exec(t))) {
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

// ───────── 가변 깊이 외부·보조 근거 스캐너 (v0.8.2) ─────────

export interface ExtBlockSpan {
  start: number;
  end: number;
  innerStart: number;
  innerEnd: number;
  depth: number;
  closed: boolean;
  legacy: boolean;
  rawOpener: string;
  tag: { ext: 'evd' | 'ref'; id: string; tagStart: number } | null;
}

const WS_CHAR_RE = /\s/u;
const isExtDigit = (c: string | undefined): boolean => c !== undefined && ((c >= '0' && c <= '9') || (c >= '０' && c <= '９'));

/**
 * 여는 기호 바로 앞의 이름표(`증1`·`근2`·`evd1.2`·`ref3:`)를 뒤에서 앞으로 읽는다.
 * 정규식 `(?:^|\s)((?:증|근|evd|ref)(D+(?:\.D+)?))\s*[:：]?\s*$`를 `s.slice(prevEnd, openerIdx)`에 건 것과 같되,
 * 구간 전체를 다시 훑지 않고 이름표 길이만큼만 본다(v0.8.2 재검토: 여는 기호가 많은 긴 줄에서 길이의 제곱이던 것을 고침).
 */
function parsePrecedingExtTag(s: string, prevEnd: number, openerIdx: number): ExtBlockSpan['tag'] {
  let j = openerIdx;
  while (j > prevEnd && WS_CHAR_RE.test(s[j - 1])) j--;
  if (j > prevEnd && (s[j - 1] === ':' || s[j - 1] === '：')) {
    j--;
    while (j > prevEnd && WS_CHAR_RE.test(s[j - 1])) j--;
  }
  const numEnd = j;
  while (j > prevEnd && (isExtDigit(s[j - 1]) || s[j - 1] === '.')) j--;
  const num = s.slice(j, numEnd);
  if (!/^[0-9０-９]+(?:\.[0-9０-９]+)?$/u.test(num)) return null;
  let kind: 'evd' | 'ref';
  let tagStart: number;
  const w1 = s[j - 1];
  if (j - 1 >= prevEnd && (w1 === '증' || w1 === '근')) {
    kind = w1 === '증' ? 'evd' : 'ref';
    tagStart = j - 1;
  } else if (j - 3 >= prevEnd) {
    const w3 = s.slice(j - 3, j).toLowerCase();
    if (w3 !== 'evd' && w3 !== 'ref') return null;
    kind = w3 === 'evd' ? 'evd' : 'ref';
    tagStart = j - 3;
  } else {
    return null;
  }
  if (tagStart > prevEnd && !WS_CHAR_RE.test(s[tagStart - 1])) return null;
  const id = num.replace(/[０-９]/gu, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  return { ext: kind, id, tagStart };
}

/** 같은 바늘을 뒤로만 움직이며 거듭 찾을 때 앞 결과를 다시 쓰는 `indexOf`(없음·다음 위치를 기억해 끝까지 다시 훑지 않는다). */
function memoIndexOf(s: string): (needle: string, from: number) => number {
  const memo = new Map<string, { from: number; at: number }>();
  return (needle, from) => {
    const m = memo.get(needle);
    if (m && from >= m.from && (m.at === -1 || from <= m.at)) return m.at;
    const at = s.indexOf(needle, from);
    memo.set(needle, { from, at });
    return at;
  };
}

/**
 * 가변 깊이 `<[ … ]>`·`<[[ … ]]>`·옛 `⟪ … ⟫`·`[< … >]` 외부 근거 블록을 O(n)으로 찾는다.
 * 백틱 언급(`` `…` ``) 밖에서 여는 기호를 찾고, 닫힌 블록 및 태그(`증·근·evd·ref`)가 붙은 미닫힘 블록만 반환한다.
 */
export function scanExtBlocks(s: string): ExtBlockSpan[] {
  const spans: ExtBlockSpan[] = [];
  const find = memoIndexOf(s);
  let prevEnd = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '`') {
      const nl = find('\n', i + 1);
      const limit = nl === -1 ? s.length : nl;
      const closeTick = find('`', i + 1);
      if (closeTick !== -1 && closeTick < limit) i = closeTick;
      continue;
    }
    if (ch === '<' && s[i + 1] === '[') {
      let depth = 0;
      while (s[i + 1 + depth] === '[') depth++;
      const innerStart = i + 1 + depth;
      const closer = ']'.repeat(depth) + '>';
      const tag = parsePrecedingExtTag(s, prevEnd, i);
      if (!tag && depth === 1) continue;
      let closeIdx = find(closer, innerStart);
      if (depth === 1) {
        while (
          closeIdx !== -1 &&
          !/^(?:$|[\s<＜]|(?:증|근|evd|ref)[0-9０-９])/iu.test(s.slice(closeIdx + 2, closeIdx + 16))
        ) {
          closeIdx = s.indexOf(closer, closeIdx + 2);
        }
      }
      if (closeIdx !== -1) {
        const end = closeIdx + closer.length;
        spans.push({
          start: i,
          end,
          innerStart,
          innerEnd: closeIdx,
          depth,
          closed: true,
          legacy: false,
          rawOpener: '<' + '['.repeat(depth),
          tag,
        });
        prevEnd = end;
        i = end - 1;
      } else if (tag) {
        spans.push({
          start: i,
          end: s.length,
          innerStart,
          innerEnd: s.length,
          depth,
          closed: false,
          legacy: false,
          rawOpener: '<' + '['.repeat(depth),
          tag,
        });
        break;
      }
      continue;
    }
    if (ch === '⟪') {
      const innerStart = i + 1;
      const closeIdx = find('⟫', innerStart);
      const tag = parsePrecedingExtTag(s, prevEnd, i);
      if (closeIdx !== -1) {
        const end = closeIdx + 1;
        spans.push({ start: i, end, innerStart, innerEnd: closeIdx, depth: 1, closed: true, legacy: true, rawOpener: '⟪', tag });
        prevEnd = end;
        i = end - 1;
      } else if (tag) {
        spans.push({ start: i, end: s.length, innerStart, innerEnd: s.length, depth: 1, closed: false, legacy: true, rawOpener: '⟪', tag });
        break;
      }
      continue;
    }
    if (ch === '[' && s[i + 1] === '<') {
      const innerStart = i + 2;
      const closeIdx = find('>]', innerStart);
      const tag = parsePrecedingExtTag(s, prevEnd, i);
      if (closeIdx !== -1) {
        const end = closeIdx + 2;
        spans.push({ start: i, end, innerStart, innerEnd: closeIdx, depth: 1, closed: true, legacy: true, rawOpener: '[<', tag });
        prevEnd = end;
        i = end - 1;
      } else if (tag) {
        spans.push({ start: i, end: s.length, innerStart, innerEnd: s.length, depth: 1, closed: false, legacy: true, rawOpener: '[<', tag });
        break;
      }
    }
  }
  return spans;
}

/** 닫힌 외부 근거 블록과 태그가 붙은 미닫힘 블록 안을 공백으로 가린다(줄바꿈·인덱스 유지 옵션). */
export function outsideExtBlocks(s: string, keepNewlines = false): string {
  const spans = scanExtBlocks(s);
  if (!spans.length) return s;
  let out = '';
  let pos = 0;
  for (const sp of spans) {
    out += s.slice(pos, sp.start);
    const chunk = s.slice(sp.start, sp.end);
    out += keepNewlines ? chunk.replace(/[^\r\n]/gu, ' ') : ' '.repeat(chunk.length);
    pos = sp.end;
  }
  out += s.slice(pos);
  return out;
}

/** 여러 줄에 걸쳐 닫힌 외부 근거 블록(`<[[ … ]]>`, `<[ … ]>`, `⟪ … ⟫`, `[< … >]`) 안의 줄바꿈을 한 줄 공백으로 접는다. */
export function flattenExtNewlines(s: string): string {
  if (!s.includes('\n') && !s.includes('\r')) return s;
  const spans = scanExtBlocks(s).filter((sp) => sp.closed);
  if (!spans.length) return s;
  let out = '';
  let pos = 0;
  for (const sp of spans) {
    out += s.slice(pos, sp.start);
    out += s.slice(sp.start, sp.end).replace(/\s*\r?\n\s*/gu, ' ');
    pos = sp.end;
  }
  out += s.slice(pos);
  return out;
}

/** `parse`의 1-based 줄 번호를 지키면서 여러 줄에 걸친 닫힌 외부 근거 블록을 여는 줄에 합친다. */
export function flattenExtLines(rawLines: string[]): string[] {
  const lines = [...rawLines];
  const joined = lines.join('\n');
  const spans = scanExtBlocks(joined).filter((sp) => sp.closed);
  if (!spans.length) return lines;
  const lineStarts: number[] = [];
  let off = 0;
  for (const l of lines) {
    lineStarts.push(off);
    off += l.length + 1;
  }
  const lineOf = (idx: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= idx) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.max(0, hi);
  };
  const merges = new Map<number, number>();
  for (const sp of spans) {
    const startLine = lineOf(sp.start);
    const endLine = lineOf(Math.max(sp.start, sp.end - 1));
    if (startLine >= endLine) continue;
    const head = lines[startLine]?.trimEnd() ?? '';
    if (!head || /^\s*```/u.test(head) || /^덧글(?:\s|$)/u.test(head)) continue;
    const prev = merges.get(startLine) ?? startLine;
    if (endLine > prev) merges.set(startLine, endLine);
  }
  for (let i = 0; i < lines.length; i++) {
    let closeIdx = merges.get(i);
    if (closeIdx === undefined) continue;
    // 연속된 블록들이 겹쳐 이어질 때 최대 닫힘 줄까지 한 번에 합친다
    for (let j = i + 1; j <= closeIdx; j++) {
      const ext = merges.get(j);
      if (ext !== undefined && ext > closeIdx) closeIdx = ext;
    }
    lines[i] = [lines[i].trim(), ...lines.slice(i + 1, closeIdx + 1).map((x) => x.trim())].filter(Boolean).join(' ');
    for (let j = i + 1; j <= closeIdx; j++) lines[j] = '';
    i = closeIdx;
  }
  return lines;
}

/** 본문 안의 `]>` / `]]>` 충돌을 피하는 최소 깊이 `<[+ … ]+>` 펜스를 감싼다. */
export function formatExtFence(body: string): string {
  let k = 1;
  while (body.includes(']'.repeat(k) + '>')) k++;
  if (k === 1 && !body.startsWith('[') && !body.endsWith(']')) return `<[${body}]>`;
  if (body.startsWith('[') || body.endsWith(']')) {
    if (k < 2) k = 2;
    return `<${'['.repeat(k)} ${body} ${']'.repeat(k)}>`;
  }
  return `<${'['.repeat(k)}${body}${']'.repeat(k)}>`;
}
