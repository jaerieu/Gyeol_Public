// 결 v0.2 — 글자, 정규화, 수. spec/02-text.md.

export const HAN = /\p{Script=Han}/u;
export const HANGUL = /\p{Script=Hangul}/u;
const HAN_OR_HANGUL = /[\p{Script=Hangul}\p{Script=Han}]/u;

/** 문서 정규화(2.3절). v0와 같은 규칙이라 기본 사전 v0의 먹 이름이 유지된다. */
export function canonDocument(text: string): string {
  let t = text.replace(/\r\n?/g, '\n').normalize('NFC');
  const lines = t.split('\n').map((l) => l.replace(/[ \t]+$/u, ''));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n') + '\n';
}

/** 구조 기호의 비슷한 꼴 → 정규 꼴. 결 문법으로 읽는 줄에만 적용한다. */
const SYMBOL_MAP: [RegExp, string][] = [
  [/[⟨《＜]/gu, '〈'],
  [/[⟩》＞]/gu, '〉'],
  [/[［⦗]/gu, '〔'],
  [/[］⦘]/gu, '〕'],
  [/[『｢]/gu, '「'],
  [/[』｣]/gu, '」'],
  [/[・･•ㆍ‧⋅∙]/gu, '·'],
  [/⇣/gu, '↓'],
  [/<->|⇄/gu, '↔'],
  [/\|\||‖/gu, '∥'],
  [/->|⇒/gu, '→'],
];

/** ASCII 꺾쇠·대괄호는 블록 자리에서만 바꾼다(덧글 같은 자유 글은 건드리지 않는다). */
export function normalizeSymbols(line: string): { text: string; changed: boolean } {
  let t = line;
  for (const [re, to] of SYMBOL_MAP) t = t.replace(re, to);
  // ASCII <…> 와 […]: 안에 한글·한자·수가 있는 경우만 블록으로 본다.
  // 2026-10-14: 짝을 먼저 맞추고 안을 본다. 전의 /<([^<>]*[한글한자][^<>]*)>/는 닫히지 않은 '<' 뒤에 한글이 길게 오면
  // 되짚기가 길이의 제곱이었다. 맞추는 짝과 바꾸는 글은 같다(안에 한글·한자가 없는 짝은 그대로 둔다).
  t = t.replace(/<([^<>]*)>/gu, (m, inner: string) => (HAN_OR_HANGUL.test(inner) ? `〈${inner}〉` : m));
  t = t.replace(/\[([^[\]]*)\]/gu, (m, inner: string) => (HAN_OR_HANGUL.test(inner) ? `〔${inner}〕` : m));
  // 되물을 곳: 줄머리나 공백 뒤의 ^절N
  t = t.replace(/(^|\s)\^((?:#[0-9a-f]+:)?[절점]\d+)/gu, '$1↖$2');
  // 답하는 대상: re:#hash
  t = t.replace(/(^|\s)re:\s*#/giu, '$1↩#');
  return { text: t, changed: t !== line };
}

/** 앞뒤 공백을 함께 먹는 나눔 글자: spaced('·,;')는 정규식 \s*[·,;]\s* 과 같다. */
export interface Spaced {
  spaced: string;
}
export const spaced = (chars: string): Spaced => ({ spaced: chars });

const WS = /\s/u;

/**
 * 괄호 깊이 0에서만 sep으로 나눈다. sep은 글 그대로(' · ') 또는 spaced('·,;').
 * 2026-10-14: 전에는 정규식 sep을 자리마다 s.slice(i)에 걸어 길이의 세제곱까지 늘었다(긴 공백이 든 먹·채 블록 2,000자에 6초).
 * 나눔 글자 앞의 공백 덩어리는 한 번만 훑는다(이미 나눔 글자가 뒤따르지 않는다고 본 공백은 다시 보지 않는다). 나누는 자리는 같다.
 */
export function splitTop(s: string, sep: string | Spaced): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const open = '〈〔「';
  const close = '〉〕」';
  let failUntil = -1; // 이 자리 앞까지의 공백 뒤에는 나눔 글자가 없다
  /** i에서 spaced 나눔표가 맞으면 그 길이, 아니면 -1 */
  const spacedAt = (i: number, chars: string): number => {
    if (i < failUntil) return -1;
    let j = i;
    while (j < s.length && WS.test(s[j])) j++;
    if (j < s.length && chars.includes(s[j])) {
      let k = j + 1;
      while (k < s.length && WS.test(s[k])) k++;
      return k - i;
    }
    failUntil = j;
    return -1;
  };
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (open.includes(ch)) depth++;
    else if (close.includes(ch)) depth = Math.max(0, depth - 1);
    if (depth === 0) {
      const n = typeof sep === 'string' ? (s.startsWith(sep, i) ? sep.length : -1) : spacedAt(i, sep.spaced);
      if (n >= 0) {
        out.push(cur);
        cur = '';
        i += n;
        continue;
      }
    }
    cur += ch;
    i++;
  }
  out.push(cur);
  return out;
}

export interface NumberParse {
  value: number; // 백분 단위로 반올림된 값
  rounded: boolean; // 셋째 자리 이하가 있어 반올림했는지
  ok: boolean;
}

/**
 * 0~1 값의 글 표기를 읽는다(2.4절). 십진 문자열로 반올림한다(0.5는 올림).
 * 받는 꼴: 0.72  .72  72%  .7  1
 */
export function parseNumber(raw: string): NumberParse {
  let s = raw.trim();
  let scale = 1;
  if (s.endsWith('%')) {
    s = s.slice(0, -1).trim();
    scale = 100;
  }
  const m = /^(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[1] === '' && (m[2] === undefined || m[2] === ''))) return { value: NaN, rounded: false, ok: false };
  const intPart = m[1] === '' ? '0' : m[1];
  const frac = m[2] ?? '';
  if (scale === 1) {
    const hundredths = BigInt(intPart) * 100n + BigInt((frac + '00').slice(0, 2));
    const third = frac.length > 2 ? Number(frac[2]) : 0;
    const rounded = frac.length > 2 && /[1-9]/.test(frac.slice(2));
    const h = third >= 5 ? hundredths + 1n : hundredths;
    return { value: Number(h) / 100, rounded, ok: true };
  }
  // 퍼센트: 소수 첫째 자리에서 반올림
  const whole = BigInt(intPart);
  const first = frac.length > 0 ? Number(frac[0]) : 0;
  const rounded = /[1-9]/.test(frac);
  const h = first >= 5 ? whole + 1n : whole;
  return { value: Number(h) / 100, rounded, ok: true };
}

/**
 * 둘째 자리 반올림(10.3절): 먼저 소수 여섯째 자리에서 반올림해 계산 오차를 없애고,
 * 정수 산술로 둘째 자리에서 반올림한다(0.5는 올림). 언어가 달라도 같은 값이 나온다.
 */
export function roundHalfUp2(v: number): number {
  const micro = Math.round(v * 1e6);
  return Math.floor((micro + 5000) / 10000) / 100;
}

/** 0~1 값의 정규 글 표기: .72  .05  .00  1.00 */
export function formatNumber(v: number): string {
  const r = roundHalfUp2(v);
  if (r >= 1) return '1.00';
  const h = Math.round(r * 100);
  return '.' + String(h).padStart(2, '0');
}

export function inUnit(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= 1;
}

/** 문장 끝 부호. 어절 끝에 붙으면 떼고 경고한다. */
const TRAILING_PUNCT_CHARS = '.,!?。、！？…';

/**
 * 어절 끝에 붙은 문장 부호를 모두 뗀다(정규식 /[.,!?。、！？…]+$/u를 지운 것과 같다). 붙은 것이 없으면 그대로 돌려준다.
 * 2026-10-14: 그 정규식은 부호가 길게 이어진 어절에서 자리마다 끝까지 훑어 길이의 제곱이었다. 끝에서 한 번 훑는다.
 */
export function stripTrailingPunct(t: string): string {
  let k = t.length;
  while (k > 0 && TRAILING_PUNCT_CHARS.includes(t[k - 1])) k--;
  return k === t.length ? t : t.slice(0, k);
}
