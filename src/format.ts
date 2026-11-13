// 결 v0.8.2 — 틀 → 정규형 글, 접기. spec/03-grammar.md.
// 정규형은 모든 절을 현행 v0.8 꼴(<1 · [see,say] 내용 *5B8>)로 쓴다.

import type { Clause, ExtEvidence, FoldLevel, Message, Ref, Word, Because } from './types.ts';
import { DIGIT_MAX } from './tables.ts';
import { canonDocument } from './text.ts';
import { formatExtFence } from './parse/shared.ts';

export interface FormatOptions {
  /** 호환용 선택 인자(v0.8.2에서는 항상 현행 정규형으로 쓴다). */
  form?: '0.3';
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
  if (isV051(c)) num = c.chae?.color === undefined && muk !== undefined ? `(ink${toDigit(muk)})` : '';
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
  return c.form === '0.5.1' || c.form === '0.8' || c.all === true || c.chae?.color !== undefined || (c.because?.length ?? 0) > 0;
}

/** 끝의 근거 하나의 글: 절 번호, 주소, 시험 문제 Q3, 참가자 @kimi, 외부 근거 ref1·evd1 */
function becauseText(b: Because): string {
  if ('url' in b) return b.url;
  if ('quiz' in b) return `Q${b.quiz}`;
  if ('ctx' in b) return `T${b.ctx}`;
  if ('agent' in b) return `@${b.agent}`;
  if ('ext' in b) return `${b.ext}${b.id}`;
  if ('thread' in b) return `${b.thread}:${b.clause.replace(/^[절점]/u, '')}`;
  return refNum(b);
}

function extEvidenceText(ev: ExtEvidence): string {
  return `${ev.kind}${ev.id} ${formatExtFence(ev.text)}`;
}

/** 끝 묶음: *먹채↓근거(채가 없으면 *없이 근거만, 색 없는 옛 자신은 *N). 없으면 빈 글. */
function endText051(c: Clause): string {
  let e = '';
  if (c.chae?.color !== undefined) e = `*${c.muk?.conf !== undefined ? toDigit(c.muk.conf) : ''}${c.chae.color}${toDigit(c.chae.self ?? 0)}`;
  else if (c.chae?.self !== undefined) e = `*${toDigit(c.chae.self)}`;
  return e + (c.because ?? []).map((b) => `↓${becauseText(b)}`).join('');
}

export function clauseText03(c: Clause): string {
  const parts: string[] = [];
  if (c.label) parts.push(labelNum(c.label));
  if (c.all) parts.push('· ●');
  else if (c.me) parts.push(c.to ? `·→${c.toList?.length ? c.toList.join(',') : c.to}` : '·');
  if (c.echo) parts.push('받은대로');
  if (c.process) parts.push(c.process.target ? `${c.process.kind}→${refNum(c.process.target)}` : c.process.kind);
  if (c.place) parts.push(`${c.place.rel}${refNum(c.place.target)}${c.place.second ? `,${refNum(c.place.second)}` : ''}`);
  if (c.to && !c.me) parts.push(`→${c.to}`);
  parts.push(marksText03(c));
  if (c.words.length) parts.push(wordsText(c.words));
  if (isV051(c)) {
    const e = endText051(c);
    if (e) parts.push(e);
  } else if (isV05(c) && c.chae?.self !== undefined) parts.push(`*${toDigit(c.chae.self)}`);
  const tail = c.evidences?.length ? ' ' + c.evidences.map((ev) => extEvidenceText(ev)).join(' ') : '';
  return `<${parts.join(' ')}>${tail}`;
}

export function clauseText(c: Clause): string {
  return clauseText03(c);
}

/** 정규형 글(3.9절). */
export function format(msg: Message, _opts: FormatOptions = {}): string {
  const lines: string[] = [];
  if (msg.head) {
    const headWord = msg.profile === 'lon' ? 'lon' : 'gyeol';
    const items: string[] = [`${headWord} ${msg.gyeol}`];
    const h = msg.head;
    if (msg.profile === 'gyeol') items.push('profile gyeol');
    if (msg.lang) items.push(`lang ${msg.lang}`);
    if (h.pact) items.push(`pact #${h.pact}`);
    if (h.from || (h.to && h.to.length)) items.push(`${h.from ?? ''}→${(h.to ?? []).join(',')}`);
    if (h.re) items.push(`↩#${h.re.id}${h.re.rel ? ' ' + h.re.rel : ''}`);
    if (h.room) items.push(`room #${h.room}`);
    lines.push(items.join(' · '));
  }
  for (const c of msg.clauses) lines.push(clauseText03(c));
  for (const ev of msg.evidences ?? []) lines.push(extEvidenceText(ev));
  if (msg.gloss) lines.push(`덧글 ${msg.gloss}`);
  return canonDocument(lines.join('\n'));
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
