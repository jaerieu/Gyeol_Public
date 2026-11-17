// 결 v0.8.5 — 틀 → 정규형 글, 접기. spec/03-grammar.md.
// 정규형은 모든 절을 현행 v0.8.5 꼴(<1 · [see,say] 내용 *5B8> / lon <1 · [see,say] 내용 *5:8>)로 쓴다.

import type { Because, CalcBlock, Clause, ExtEvidence, FoldLevel, Message, ParseResult, Ref, Word } from './types.ts';
import { DIGIT_MAX } from './tables.ts';
import { canonDocument } from './text.ts';
import { formatExtFence } from './parse/shared.ts';

export interface FormatOptions {
  /** 호환용 선택 인자(v0.8.5에서는 항상 현행 정규형으로 쓴다). */
  form?: '0.3';
  profile?: 'gyeol' | 'lon';
}

export interface FormatTurnOptions {
  /** 원장 스탬프 직전(undefined) · 스탬프 후(0..9) · 미측정('?') */
  stampInk?: number | '?';
}

export function refText(r: Ref): string {
  return (r.msg ? `#${r.msg}:` : '') + r.label;
}

function wordsText(words: Word[]): string {
  return words.map((w) => w.text).join(' ');
}

/** 0~1 값 → 한 자리(0~9). 십분위로 자른다: .80~.89 → 8, 1.00 → 9. */
export function toDigit(v: number): number {
  return Math.max(0, Math.min(DIGIT_MAX, Math.floor(Math.round(v * 1000) / 100)));
}

/** 가리킴: 번호만(↓1), 다른 메시지는 #해시:번호, 지난 대화는 thread:번호. */
function refNum(r: Ref): string {
  if (r.thread !== undefined) return `${r.thread}:${r.label.replace(/^[절점]/u, '')}`;
  return (r.msg ? `#${r.msg}:` : '') + r.label.replace(/^[절점]/u, '');
}
const labelNum = (label: string) => label.replace(/^[절점]/u, '');

function marksText03(c: Clause): string {
  const m = c.marks;
  const parts: string[] = [];
  if (m.ev) parts.push(m.ev);
  if (m.news) parts.push('new');
  if (m.fig) parts.push(m.fig);
  if (m.tense) parts.push(m.tense);
  if (m.act) parts.push(m.act);
  const self = c.chae?.self;
  const muk = c.muk?.conf;
  let num = '';
  if (isV051(c)) num = c.chae?.color === undefined && c.chae !== null && c.conf === undefined && muk !== undefined ? `(ink${toDigit(muk)})` : '';
  else if (isV05(c)) num = muk !== undefined ? `(ink${toDigit(muk)})` : '';
  else if (self !== undefined && muk !== undefined) num = `(${toDigit(self)}|ink${toDigit(muk)})`;
  else if (self !== undefined) num = `(${toDigit(self)})`;
  else if (muk !== undefined) num = `(|ink${toDigit(muk)})`;
  return `[${parts.join(',')}${num}]`;
}

export function isV05(c: Clause): boolean {
  return c.form === '0.5' || c.marks.tense !== undefined || c.marks.fig !== undefined || isV051(c);
}

export function isV051(c: Clause): boolean {
  return (
    c.form === '0.5.1' ||
    c.form === '0.8' ||
    c.form === '0.8.5' ||
    c.all === true ||
    c.chae === null ||
    c.chae?.color !== undefined ||
    c.conf !== undefined ||
    (c.because?.length ?? 0) > 0 ||
    (c.calcs?.length ?? 0) > 0 ||
    (c.places?.length ?? 0) > 1
  );
}

/** 끝의 근거 하나의 글: 절 번호, 주소, 시험 문제 Q3, 참가자 @kimi, 외부 근거 ref1·evd1, 수식 calc1, 예약 dict */
function becauseText(b: Because): string {
  if ('reserved' in b) return b.reserved;
  if ('calc' in b) return `calc${b.calc}`;
  if ('url' in b) return b.url;
  if ('quiz' in b) return `Q${b.quiz}`;
  if ('ctx' in b) return `T${b.ctx}`;
  if ('agent' in b) return `@${b.agent}`;
  if ('ext' in b) {
    const slice = b.lines ? (b.lines[0] === b.lines[1] ? `[L${b.lines[0]}]` : `[L${b.lines[0]}:L${b.lines[1]}]`) : '';
    return `${b.ext}${b.id}${slice}`;
  }
  if ('thread' in b) return `${b.thread}:${b.clause.replace(/^[절점]/u, '')}`;
  return refNum(b);
}

function extEvidenceText(ev: ExtEvidence): string {
  return `${ev.kind}${ev.id} ${formatExtFence(ev.text)}`;
}

function calcBlockText(cb: CalcBlock): string {
  const inner = cb.declared !== undefined ? `${cb.expr} = ${cb.declared}` : cb.expr;
  return `calc${cb.id} ${formatExtFence(inner)}`;
}

/** 끝 묶음: gyeol *먹채↓근거 / lon 0.8.5 *먹:확신↓근거. 없으면 빈 글. */
function endText051(c: Clause, lon085 = false): string {
  let e = '';
  const mukTok = c.muk?.unmeasured ? '?' : c.muk?.conf !== undefined ? String(toDigit(c.muk.conf)) : '';
  if ((c.chae === null || lon085) && (c.conf !== undefined || c.chae?.self !== undefined)) {
    const d = c.conf !== undefined ? Math.max(0, Math.min(DIGIT_MAX, Math.round(c.conf))) : toDigit(c.chae!.self!);
    e = `*${mukTok}:${d}`;
  } else if (c.chae?.color !== undefined) {
    e = `*${mukTok}${c.chae.color}${toDigit(c.chae.self ?? 0)}`;
  } else if (c.chae?.self !== undefined) {
    e = `*${toDigit(c.chae.self)}`;
  }
  return e + (c.because ?? []).map((b) => `↓${becauseText(b)}`).join('');
}

export function clauseText03(c: Clause, lon085 = false): string {
  const parts: string[] = [];
  if (c.label) parts.push(labelNum(c.label));
  if (c.all) parts.push('· ●');
  else if (c.me) parts.push(c.to ? `·→${c.toList?.length ? c.toList.join(',') : c.to}` : '·');
  if (c.echo) parts.push('받은대로');
  if (c.process) parts.push(c.process.target ? `${c.process.kind}→${refNum(c.process.target)}` : c.process.kind);
  if (c.places && c.places.length > 0) {
    parts.push(c.places.map((p) => `${p.rel}${refNum(p.target)}${p.second ? `,${refNum(p.second)}` : ''}`).join(''));
  } else if (c.place) {
    parts.push(`${c.place.rel}${refNum(c.place.target)}${c.place.second ? `,${refNum(c.place.second)}` : ''}`);
  }
  if (c.to && !c.me) parts.push(`→${c.to}`);
  parts.push(marksText03(c));
  if (c.words.length) parts.push(wordsText(c.words));
  if (isV051(c)) {
    const e = endText051(c, lon085);
    if (e) parts.push(e);
  } else if (isV05(c) && c.chae?.self !== undefined) parts.push(`*${toDigit(c.chae.self)}`);
  const tail = c.evidences?.length ? ' ' + c.evidences.map((ev) => extEvidenceText(ev)).join(' ') : '';
  const calcTail = c.calcs?.length ? ' ' + c.calcs.map((cb) => calcBlockText(cb)).join(' ') : '';
  return `<${parts.join(' ')}>${tail}${calcTail}`;
}

export function clauseText(c: Clause): string {
  return clauseText03(c);
}

/** 정규형 글(3.9절). */
export function format(msg: Message, opts: FormatOptions = {}): string {
  const effProfile = opts.profile ?? msg.profile;
  const lon085 = effProfile === 'lon' && msg.gyeol !== '0.7' && msg.gyeol !== '0.8' && msg.gyeol !== '0.8.2';
  const lines: string[] = [];
  if (msg.head) {
    const headWord = msg.profile === 'lon' ? 'lon' : 'gyeol';
    const items: string[] = [`${headWord} ${msg.gyeol}`];
    const h = msg.head;
    if (msg.profile === 'gyeol') items.push('profile gyeol');
    if (h.mode === 'delta') items.push('delta');
    else if (h.snapshot || h.mode === 'snapshot') items.push('snapshot');
    if (msg.lang) items.push(`lang ${msg.lang}`);
    if (h.pact) items.push(`pact #${h.pact}`);
    if (h.from || (h.to && h.to.length)) items.push(`${h.from ?? ''}→${(h.to ?? []).join(',')}`);
    if (h.re) items.push(`↩#${h.re.id}${h.re.rel ? ' ' + h.re.rel : ''}`);
    if (h.room) items.push(`room #${h.room}`);
    lines.push(items.join(' · '));
  }
  for (const c of msg.clauses) lines.push(clauseText03(c, lon085));
  for (const ev of msg.evidences ?? []) lines.push(extEvidenceText(ev));
  for (const cb of msg.calcs ?? []) lines.push(calcBlockText(cb));
  if (msg.gloss) lines.push(`덧글 ${msg.gloss}`);
  else if (msg.commentary) lines.push(`---\n${msg.commentary}`);
  return canonDocument(lines.join('\n'));
}

/**
 * 차례(또는 Message) 정규 텍스트 직렬화기.
 * 원장 스탬프 전(`stampInk` 미지정 -> `*:8`)과 스탬프 후(`0..9` -> `*5:8`, `'?'` -> `*?:8`)를 단일 정규형으로 고정한다.
 */
export function formatTurn(msgOrResult: Message | ParseResult | { message: Message }, opts: FormatTurnOptions = {}): string {
  const src = 'message' in msgOrResult ? msgOrResult.message : msgOrResult;
  const msg = structuredClone(src);
  if (opts.stampInk !== undefined) {
    for (const c of msg.clauses) {
      if (opts.stampInk === '?') c.muk = { unmeasured: true };
      else c.muk = { conf: Math.max(0, Math.min(DIGIT_MAX, Math.round(opts.stampInk))) / 10 };
    }
  }
  return format(msg);
}

/** 어절에서 어근만 남긴다. 한글 어절은 지운다. */
export function rootsOf(words: Word[]): Word[] {
  return words.filter((w) => w.root).map((w) => ({ text: w.root!, root: w.root }));
}

/** 절을 접는다(3.8절). '펼침'은 그대로 돌려준다. */
export function foldClause(c: Clause, level: FoldLevel): Clause {
  if (level === '펼침') return structuredClone(c);
  const base: Clause = { label: c.label, process: null, place: null, to: null, words: c.words.map((w) => ({ ...w })), marks: { ...c.marks } };
  if (level === '점') base.words = rootsOf(c.words);
  if (c.echo) base.echo = true;
  if (c.form) base.form = c.form;
  return base;
}

/** 메시지를 접는다. 덧글은 빠진다. */
export function foldMessage(msg: Message, level: FoldLevel): Message {
  if (level === '펼침') return structuredClone(msg);
  return {
    ...structuredClone(msg),
    gloss: null,
    clauses: msg.clauses.map((c) => foldClause(c, level)),
  };
}

/** 절이 지금 어느 수준인가. */
export function levelOf(c: Clause): FoldLevel {
  if (c.muk || c.chae || c.process || c.place || c.to || c.echo) return '펼침';
  if (c.words.some((w) => !w.root || w.suffix)) return '절';
  return '점';
}
