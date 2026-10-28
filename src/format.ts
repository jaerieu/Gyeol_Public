// 결 v0.3 — 틀 → 정규형 글, 접기. spec/03-grammar.md 3.8~3.9절, 3.13절.
// 정규형은 v0.3 줄꼴(<절N 앞붙이 [표지(자신|먹)] 내용>, v0.3.1부터 먹 자리는 (7|먹4))이다. 옛 꼴(v0.2)은 form: '0.2'로 쓴다.
// v0.5(2026-10-15): v0.5 꼴로 쓴 절(form '0.5')만 <절N · 앞붙이 [근거,군,시제,화행(먹N)] 내용 *N>으로 쓴다(isV05).
// v0.6(2026-10-24, reports/v0.6-design.md 5): 결 표지(군 뒤 시제 앞), 다중 지목 ·→A,B, ⊗N,M, 지난 대화 근거 ↓53:12. 옛 줄에 없던 꼴에만 걸린다.
// v0.3 줄꼴에는 채의 어조·전함·인용과 먹의 대안·노력·주의·특징·측정법이 없다(먹은 숫자 하나, 나머지는 측정 기록에 남긴다).
// 그래서 틀 → 글 → 틀을 잃지 않고 하려면 form: '0.2'를 쓴다.

import type { Chae, Clause, Echo, FoldLevel, LineForm, Marks, Message, Muk, PartialMarks, Ref, Word, Because } from './types.ts';
import { DIGIT_MAX, NEWS_05 } from './tables.ts';
import { canonDocument, formatNumber } from './text.ts';

export interface FormatOptions {
  /** 절을 쓸 줄꼴. 기본 '0.3'(정규형). */
  form?: LineForm;
}

export function refText(r: Ref): string {
  return (r.msg ? `#${r.msg}:` : '') + r.label;
}

function marksText(m: Marks | PartialMarks): string {
  const parts: string[] = [];
  if (m.ev) parts.push(m.ev);
  if (m.news) parts.push('네');
  if (m.act) parts.push(m.act);
  return `〈${parts.join('·')}〉`;
}

function withMethod(text: string, muk: Muk, field: string): string {
  const m = muk.method?.[field];
  return m ? `${text}@${m}` : text;
}

function mukText(muk: Muk): string | null {
  const items: string[] = [];
  if (muk.alt && muk.alt.length) items.push(withMethod('대안 ' + muk.alt.map((a) => `${a.r} ${formatNumber(a.p)}`).join(' '), muk, 'alt'));
  if (muk.conf !== undefined) items.push(withMethod(`확신 ${formatNumber(muk.conf)}`, muk, 'conf'));
  if (muk.effort !== undefined) items.push(withMethod(`노력 ${formatNumber(muk.effort)}`, muk, 'effort'));
  if (muk.attn && muk.attn.length) items.push(withMethod('주의 ' + muk.attn.map(refText).join(' '), muk, 'attn'));
  if (muk.feat) for (const f of muk.feat) items.push(withMethod(`특징 ${f.id} ${formatNumber(f.p)}`, muk, 'feat'));
  if (muk.extra) for (const e of muk.extra) items.push(e.value ? `${e.key} ${e.value}` : e.key);
  return items.length ? `〔${items.join(' · ')}〕` : null;
}

function chaeText(chae: Chae): string | null {
  const items: string[] = [...(chae.words ?? [])];
  if (chae.self !== undefined) items.push(`자신 ${formatNumber(chae.self)}`);
  if (chae.want !== undefined) items.push(`전함 ${formatNumber(chae.want)}`);
  if (chae.cite && chae.cite.length) items.push('인용 ' + chae.cite.map(refText).join(' '));
  return items.length ? `「${items.join(' · ')}」` : null;
}

function wordsText(words: Word[]): string {
  return words.map((w) => w.text).join(' ');
}

/** 0~1 값 → v0.3 줄꼴의 한 자리(0~9). 십분위로 자른다: .80~.89 → 8, 1.00 → 9. */
export function toDigit(v: number): number {
  return Math.max(0, Math.min(DIGIT_MAX, Math.floor(Math.round(v * 1000) / 100)));
}

/** v0.3 줄꼴의 가리킴: 번호만(↓1), 다른 메시지는 #해시:번호. */
function refNum(r: Ref): string {
  if (r.thread !== undefined) return `${r.thread}:${r.label.replace(/^[절점]/u, '')}`; // v0.6 덧붙임(2026-10-25): 받침→53:12, ↔53:12
  return (r.msg ? `#${r.msg}:` : '') + r.label.replace(/^[절점]/u, '');
}

/**
 * v0.3 표지 블록: [근거,네,화행(자신|먹N)]. 괄호는 마지막 표지에 붙인다.
 * v0.3.1(2026-10-14): 먹 자리의 수에 이름표 '먹'을 붙인다 — (7|먹4), (|먹4). 자신만 있으면 (7) 그대로다.
 * 까닭: 검증 회차 2026-10-14v2 mc3-2에서 32개 중 9개가 (6|9)의 9를 자신으로 읽었다(v1 mc-2를 맞힌 모델 다섯 포함).
 * 이름표는 측정기가 붙이는 쪽에만 두므로 참가자가 쓰는 줄(자신만)의 정규형과 먹 이름은 바뀌지 않는다(3.13절, 12.5절).
 */
function marksText03(c: Clause): string {
  const m = c.marks;
  const parts: string[] = [];
  const v05 = isV05(c);
  if (m.ev) parts.push(m.ev);
  if (m.news) parts.push(v05 ? NEWS_05 : '네');
  if (m.fig) parts.push(m.fig); // v0.6 결 표지는 v0.5 꼴 절에만 있다(isV05)
  if (v05 && m.tense) parts.push(m.tense);
  if (m.act) parts.push(m.act);
  const self = c.chae?.self;
  const muk = c.muk?.conf;
  let num = '';
  // v0.5.1: 표지 칸은 표지만. 먹은 끝 묶음(*먹채)으로 가되, 색 있는 채가 없으면 옛 (먹N) 그대로 둔다(*6만 쓰면 옛 자신 6과 글자가 같다)
  if (isV051(c)) num = c.chae?.color === undefined && muk !== undefined ? `(먹${toDigit(muk)})` : '';
  else if (v05) num = muk !== undefined ? `(먹${toDigit(muk)})` : ''; // v0.5: 괄호는 먹 자리, 자신은 끝의 *N
  else if (self !== undefined && muk !== undefined) num = `(${toDigit(self)}|먹${toDigit(muk)})`;
  else if (self !== undefined) num = `(${toDigit(self)})`;
  else if (muk !== undefined) num = `(|먹${toDigit(muk)})`;
  return `[${parts.join(',')}${num}]`;
}

/**
 * v0.5(2026-10-15, reports/v0.5-design.md 3): v0.5 꼴로 쓴 절(form '0.5')은 v0.5 정규형으로 쓴다. 시제는 v0.5 꼴에만 있으므로
 * form 없이 시제만 있는 틀(코드로 만든 틀)도 v0.5 꼴로 쓴다. 그 밖의 절은 v0.4까지의 정규형 그대로다(옛 먹 이름이 바뀌지 않게).
 */
export function isV05(c: Clause): boolean {
  return c.form === '0.5' || c.marks.tense !== undefined || c.marks.fig !== undefined || isV051(c);
}

/**
 * v0.5.1(2026-10-16, reports/v0.5.1-design.md 5): ●, 색이 있는 채, 끝의 근거 가운데 하나라도 쓴 절. 정규형은
 * <이름 ● 앞붙이 [근거,군,시제,화행] 내용 *먹채↓근거>: 끝 묶음은 붙여 쓰고, 표지 칸에는 괄호가 없다.
 */
export function isV051(c: Clause): boolean {
  return c.form === '0.5.1' || c.all === true || c.chae?.color !== undefined || (c.because?.length ?? 0) > 0;
}

/** 끝의 근거 하나의 글: 절 번호, 주소, 시험 문제 Q3, 참가자 @kimi */
function becauseText(b: Because): string {
  if ('url' in b) return b.url;
  if ('quiz' in b) return `Q${b.quiz}`;
  if ('agent' in b) return `@${b.agent}`;
  if ('thread' in b) return `${b.thread}:${b.clause.replace(/^[절점]/u, '')}`; // v0.6 지난 대화의 절
  return refNum(b);
}

/** v0.5.1 끝 묶음: *먹채↓근거(채가 없으면 *없이 근거만, 색 없는 옛 자신은 *N). 없으면 빈 글. */
function endText051(c: Clause): string {
  let e = '';
  if (c.chae?.color !== undefined) e = `*${c.muk?.conf !== undefined ? toDigit(c.muk.conf) : ''}${c.chae.color}${toDigit(c.chae.self ?? 0)}`;
  else if (c.chae?.self !== undefined) e = `*${toDigit(c.chae.self)}`;
  return e + (c.because ?? []).map((b) => `↓${becauseText(b)}`).join('');
}

/**
 * v0.3 정규형의 절 한 줄: <이름 받은대로 과정 자리 향함 [표지(자신|먹)] 내용>.
 * v0.4(2026-10-15): 점을 쓴 절은 <이름 ·→향함 받은대로 과정 자리 [표지(자신|먹)] 내용>. 점이 없는 절은 v0.3 그대로(먹 이름이 바뀌지 않게).
 * v0.5(2026-10-15): v0.5 꼴 절은 <이름 ·→향함 받은대로 과정 자리 [근거,군,시제,화행(먹N)] 내용 *N>. 별칭은 한글로, 괄호는 먹이 있을 때만,
 * 자신은 맨 끝 *N이다. 옛 꼴(네, (8), (7|먹4))만 쓴 절은 위의 정규형 그대로다.
 */
export function clauseText03(c: Clause): string {
  const parts: string[] = [];
  if (c.label) parts.push(c.label);
  if (c.all) parts.push('●');
  else if (c.me) parts.push(c.to ? `·→${c.toList?.length ? c.toList.join(',') : c.to}` : '·'); // v0.6 다중 지목은 쉼표로
  if (c.echo) parts.push('받은대로');
  if (c.process) parts.push(c.process.target ? `${c.process.kind}→${refNum(c.process.target)}` : c.process.kind);
  if (c.place) parts.push(`${c.place.rel}${refNum(c.place.target)}${c.place.second ? `,${refNum(c.place.second)}` : ''}`); // v0.6 ⊗N,M
  if (c.to && !c.me) parts.push(`→${c.to}`);
  parts.push(marksText03(c));
  if (c.words.length) parts.push(wordsText(c.words));
  if (isV051(c)) {
    const e = endText051(c);
    if (e) parts.push(e);
  } else if (isV05(c) && c.chae?.self !== undefined) parts.push(`*${toDigit(c.chae.self)}`);
  return `<${parts.join(' ')}>`;
}

/** 절 한 줄. 기본은 v0.3 정규형. 받은대로 절과 v0.5 꼴 절(시제·끝의 자신)은 옛 꼴로 쓸 수 없어 늘 꺾쇠 줄꼴로 쓴다. */
export function clauseText(c: Clause, form: LineForm = '0.3'): string {
  if (form === '0.3' || c.echo || isV05(c)) return clauseText03(c);
  return clauseText02(c);
}

function clauseText02(c: Clause): string {
  const parts: string[] = [];
  if (c.label) parts.push(c.label);
  if (c.process) parts.push(c.process.target ? `${c.process.kind}→${refText(c.process.target)}` : c.process.kind);
  if (c.place) parts.push(`${c.place.rel}${refText(c.place.target)}`);
  if (c.to) parts.push(`→${c.to}`);
  if (c.words.length) parts.push(wordsText(c.words));
  parts.push(marksText(c.marks));
  if (c.muk) {
    const t = mukText(c.muk);
    if (t) parts.push(t);
  }
  if (c.chae) {
    const t = chaeText(c.chae);
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

function echoText(e: Echo): string {
  const parts: string[] = [];
  if (e.words.length) parts.push(wordsText(e.words));
  if (e.marks && (e.marks.ev || e.marks.news || e.marks.act)) parts.push(marksText(e.marks));
  if (e.muk) {
    const t = mukText(e.muk);
    if (t) parts.push(t);
  }
  return parts.join(' ');
}

/** 정규형 글(3.9절). form '0.2'는 옛 꼴로 잃는 것 없이 쓴다. */
export function format(msg: Message, opts: FormatOptions = {}): string {
  const form = opts.form ?? '0.3';
  const lines: string[] = [];
  if (msg.head) {
    const items: string[] = [`결 ${msg.gyeol}`];
    const h = msg.head;
    if (h.pact) items.push(`짝 #${h.pact}`);
    if (h.from || (h.to && h.to.length)) items.push(`${h.from ?? ''}→${(h.to ?? []).join(',')}`);
    if (h.re) items.push(`↩#${h.re.id}${h.re.rel ? ' ' + h.re.rel : ''}`);
    if (h.room) items.push(`방 #${h.room}`);
    lines.push(items.join(' · '));
  }
  for (const t of msg.tune) lines.push(t.text ? `조율 ${t.step} ${t.text}` : `조율 ${t.step}`);
  if (msg.preface) {
    const items: string[] = [];
    if (msg.preface.purpose) items.push(`목적 ${msg.preface.purpose}`);
    if (msg.preface.constraint) items.push(`제약 ${msg.preface.constraint}`);
    for (const e of msg.preface.extra ?? []) items.push(e.value ? `${e.key} ${e.value}` : e.key);
    if (items.length) lines.push(`머리말 ${items.join(' · ')}`);
  }
  if (msg.echo.length) lines.push(`받은대로 ${msg.echo.map(echoText).join(' · ')}`);
  for (const c of msg.clauses) lines.push(clauseText(c, form));
  if (msg.gloss) lines.push(`덧글 ${msg.gloss}`);
  if (msg.seal) {
    const s = msg.seal;
    const items: string[] = [s.name];
    if (s.lineage) items.push(`계보 ${s.lineage}`);
    if (s.memory) items.push(`기억 ${s.memory}`);
    if (s.measure && s.measure.length) items.push(`측정 ${s.measure.join('·')}`);
    lines.push(`낙관 ${items.join(' · ')}`);
  }
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
  if (c.echo) base.echo = true; // 접어도 받은대로 절은 받은대로 절이다
  if (c.form) base.form = c.form; // v0.5 꼴 절은 접어도 v0.5 꼴(군)로 쓴다(2026-10-15)
  return base;
}

/** 메시지를 접는다. 머리말·덧글·낙관은 빠진다. */
export function foldMessage(msg: Message, level: FoldLevel): Message {
  if (level === '펼침') return structuredClone(msg);
  return {
    ...structuredClone(msg),
    preface: null,
    gloss: null,
    seal: null,
    clauses: msg.clauses.map((c) => foldClause(c, level)),
  };
}

/** 절이 지금 어느 수준인가. */
export function levelOf(c: Clause): FoldLevel {
  if (c.muk || c.chae || c.process || c.place || c.to || c.echo) return '펼침';
  if (c.words.some((w) => !w.root || w.suffix)) return '절';
  return '점';
}
