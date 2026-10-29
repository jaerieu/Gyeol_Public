// 결 검사기 — 옛 꼴(v0.2.1): 내용 〈표지〉 〔먹〕 「채」 →이름, 그리고 받은대로 줄. spec/03-grammar.md 3.1~3.12절.
// v0.2.1에서 맞던 줄은 맞고 틀리던 줄은 틀린다(tests/v03.test.ts, tests/corpus.test.ts). 너그러운 읽기는 v03.ts에만 더한다.
// 이 꼴의 글은 src/parse.ts가 normalizeSymbols(text.ts)로 비슷한 기호를 바꾼 뒤에 넘긴다.

import type { Act, Chae, Clause, Echo, Ev, Marks, Muk, PartialMarks, Ref } from '../types.ts';
import { ACTS, EVIDENTIALS, FORBIDDEN_MUK_METHOD, MARK_KO2EN, MEASURE_METHODS, NEWS } from '../tables.ts';
import { inUnit, parseNumber, spaced, splitTop } from '../text.ts';
import { Ctx, ECHO_LABEL, LABEL_RE, markAlias, parseRef, parseWord, putTo, takePrefix, tightenTildes, type PrefixRules } from './shared.ts';

/** 옛 꼴의 앞붙이: 가리킴은 절N·점N만, 둘째 →이름은 E18을 내고 덮는다(v0.2.1 그대로). */
const RULES_02: PrefixRules = { ref: parseRef, to: /^→(.+)$/u, toOverwrites: true };

// ───────── 표지 ─────────

function normalizeMarkToken(tok: string, ctx: Ctx): string {
  const t = tok.replace(/\s+/g, '');
  return markAlias(t, ctx) ?? t;
}

function splitMarkTokens(inner: string): string[] {
  return inner
    .split(/[·,/]/u)
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function parseMarks(inner: string, ctx: Ctx): Marks | null {
  const toks = splitMarkTokens(inner).map((t) => normalizeMarkToken(t, ctx));
  let ev: Ev | undefined;
  let news = false;
  let act: Act | undefined;
  let stage = 0; // 0: 근거 자리, 1: 새로앎 자리, 2: 화행 자리, 3: 끝
  for (const t of toks) {
    if (t in EVIDENTIALS) {
      if (ev) ctx.err('E06', `근거가 둘 이상이다: 〈${inner}〉`);
      else if (stage > 0) ctx.err('E09', `표지 순서가 틀렸다(근거·새로앎·화행): 〈${inner}〉`);
      ev = MARK_KO2EN[t] as Ev; // v0.7: 내부 값은 영어
      stage = Math.max(stage, 1);
    } else if (t === NEWS) {
      if (stage > 1) ctx.err('E09', `표지 순서가 틀렸다(근거·새로앎·화행): 〈${inner}〉`);
      news = true;
      stage = Math.max(stage, 2);
    } else if (t in ACTS) {
      if (act) ctx.err('E04', `화행이 둘 이상이다: 〈${inner}〉`);
      act = MARK_KO2EN[t] as Act; // v0.7: 내부 값은 영어
      stage = 3;
    } else {
      ctx.err('E05', `알 수 없는 표지 '${t}': 〈${inner}〉`);
    }
  }
  if (!act) {
    ctx.err('E03', `화행이 없다: 〈${inner}〉`);
    return null;
  }
  if (MARK_KO2EN[toks[toks.length - 1]] !== act) ctx.err('E04', `화행은 맨 끝에 와야 한다: 〈${inner}〉`);
  if (act === 'say' && !ev) ctx.err('E07', `단언(다)에는 근거가 있어야 한다: 〈${inner}〉`);
  if (news && act !== 'say') ctx.err('E08', `새로앎(네)은 단언(다)과만 쓴다: 〈${inner}〉`);
  const marks: Marks = { act };
  if (ev) marks.ev = ev;
  if (news) marks.news = true;
  return marks;
}

/** 받은대로 줄의 표지: 화행을 빼도 된다. */
function parsePartialMarks(inner: string, ctx: Ctx): PartialMarks | null {
  const toks = splitMarkTokens(inner).map((t) => normalizeMarkToken(t, ctx));
  const pm: PartialMarks = {};
  for (const t of toks) {
    if (t in EVIDENTIALS && !pm.ev) pm.ev = MARK_KO2EN[t] as Ev;
    else if (t === NEWS) pm.news = true;
    else if (t in ACTS && !pm.act) pm.act = MARK_KO2EN[t] as Act;
    else {
      ctx.err('E05', `알 수 없거나 겹친 표지 '${t}': 〈${inner}〉`);
      return null;
    }
  }
  return pm;
}

// ───────── 먹 ─────────

function splitItems(inner: string): string[] {
  return splitTop(inner, spaced('·,;'))
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

const WS = /\s/u;
const LINE_BREAK = /[\n\r\u2028\u2029]/u;

/**
 * 항목 끝의 @측정법을 뗀다. 정규식 /^(.*?)@(\S+)$/u와 같다: 마지막 공백 뒤의 첫 '@'로 나누되, '@' 뒤에 글자가 있고 앞에 줄바꿈 글자가 없어야 한다.
 * 2026-10-14: 그 정규식은 '@'가 많은 항목에서 '@'마다 끝까지 훑어 길이의 제곱이었다. 한 번 훑는다.
 */
function takeMethod(item: string): { body: string; method?: string } {
  let lastWs = -1;
  for (let i = item.length - 1; i >= 0; i--) {
    if (WS.test(item[i])) {
      lastWs = i;
      break;
    }
  }
  const at = item.indexOf('@', lastWs + 1);
  if (at < 0 || at === item.length - 1 || LINE_BREAK.test(item.slice(0, at))) return { body: item };
  return { body: item.slice(0, at).trim(), method: item.slice(at + 1) };
}

function num(raw: string, ctx: Ctx, what: string): number | null {
  const p = parseNumber(raw);
  if (!p.ok) {
    ctx.err('E10', `${what}의 값이 수가 아니다: '${raw}'`);
    return null;
  }
  if (!inUnit(p.value)) {
    ctx.err('E10', `${what}의 값이 0~1 밖이다: '${raw}'`);
    return null;
  }
  if (p.rounded) ctx.warn('W02', `${what}의 값을 소수 둘째 자리로 반올림했다: '${raw}'`);
  return p.value;
}

function parseMuk(inner: string, ctx: Ctx): Muk {
  const muk: Muk = {};
  for (const rawItem of splitItems(inner)) {
    const { body, method } = takeMethod(rawItem);
    const parts = body.split(/\s+/u);
    const key = parts[0];
    const args = parts.slice(1);
    let field: string | null = null;
    if (method === FORBIDDEN_MUK_METHOD) {
      ctx.err('E14', `먹에 자기 보고를 쓸 수 없다. 채의 '자신'으로 옮겨야 한다: '${rawItem}'`);
      continue;
    }
    if (method && !MEASURE_METHODS.test(method)) ctx.warn('W13', `알 수 없는 측정법 '@${method}'`);
    switch (key) {
      case '대안': {
        field = 'alt';
        if (args.length % 2 !== 0 || args.length === 0) {
          ctx.err('E24', `대안은 '어근 확률' 짝이어야 한다: '${rawItem}'`);
          break;
        }
        const alt: { r: string; p: number }[] = [];
        for (let i = 0; i < args.length; i += 2) {
          const p = num(args[i + 1], ctx, '대안');
          if (p === null) continue;
          alt.push({ r: args[i], p });
        }
        if (alt.length < 2) ctx.err('E11', `대안의 후보가 둘보다 적다: '${rawItem}'`);
        const sum = alt.reduce((a, b) => a + b.p, 0);
        if (sum > 1.005) ctx.err('E13', `대안 확률의 합이 1을 넘는다(${sum.toFixed(2)}): '${rawItem}'`);
        for (let i = 2; i < alt.length; i++) {
          if (alt[i].p > alt[i - 1].p) {
            ctx.warn('W06', `대안의 둘째 이후 후보가 확률이 큰 순서가 아니다: '${rawItem}'`);
            break;
          }
        }
        muk.alt = alt;
        break;
      }
      case '확신':
      case '노력': {
        field = key === '확신' ? 'conf' : 'effort';
        if (args.length !== 1) {
          ctx.err('E19', `'${key}'에는 수 하나가 온다: '${rawItem}'`);
          break;
        }
        const v = num(args[0], ctx, key);
        if (v !== null) (muk as Record<string, unknown>)[field] = v;
        break;
      }
      case '주의': {
        field = 'attn';
        const refs: Ref[] = [];
        for (const a of args) {
          const r = parseRef(a.replace(/^↩/u, ''));
          if (r) refs.push(r);
          else ctx.err('E19', `주의의 가리킴을 읽을 수 없다: '${a}'`);
        }
        muk.attn = refs;
        break;
      }
      case '특징': {
        field = 'feat';
        if (args.length !== 2) {
          ctx.err('E19', `'특징'에는 식별자와 수가 온다: '${rawItem}'`);
          break;
        }
        const v = num(args[1], ctx, '특징');
        if (v !== null) (muk.feat ??= []).push({ id: args[0], p: v });
        break;
      }
      default:
        ctx.warn('W04', `알 수 없는 먹 항목을 그대로 둔다: '${rawItem}'`);
        (muk.extra ??= []).push({ key, value: args.join(' ') });
    }
    if (field && method) (muk.method ??= {})[field] = method;
  }
  return muk;
}

// ───────── 채 ─────────

const CHAE_KEYS = ['자신', '전함', '인용'];

/**
 * 채 항목 나누기. 정규형은 ' · '(쉼표·쌍반점도 받는다).
 * v0.2.1(광장 상의 1의 4번): '/'로 나눈 것과 띄어쓰기로 이어 쓴 것(「단호 자신 .75」)도 읽되 경고한다(W17).
 * 띄어쓰기는 수를 받는 항목 이름(자신·전함·인용) 앞에서만 끊는다. 「담담 .70 .3」처럼 이름이 없으면 그대로 둔다.
 */
function splitChaeItems(inner: string, ctx: Ctx): string[] {
  let loose = false;
  const out = splitItems(inner)
    .flatMap((it) => {
      const parts = splitTop(it, spaced('/')).map((x) => x.trim()).filter((x) => x !== '');
      if (parts.length > 1) loose = true;
      return parts;
    })
    .flatMap((it) => {
      const pieces: string[] = [];
      let cur: string[] = [];
      for (const tk of it.split(/\s+/u)) {
        if (CHAE_KEYS.includes(tk) && cur.length) {
          pieces.push(cur.join(' '));
          cur = [];
        }
        cur.push(tk);
      }
      if (cur.length) pieces.push(cur.join(' '));
      if (pieces.length > 1) loose = true;
      return pieces;
    });
  if (loose) ctx.warn('W17', `채 항목을 '/'나 띄어쓰기로 나눈 것을 읽었다. 정규형은 ' · ': 「${inner}」`);
  return out;
}

function parseChae(inner: string, ctx: Ctx): Chae {
  const chae: Chae = {};
  for (const item of splitChaeItems(inner, ctx)) {
    const parts = item.split(/\s+/u);
    const key = parts[0];
    if (key === '자신' || key === '전함') {
      if (parts.length !== 2) {
        ctx.err('E19', `'${key}'에는 수 하나가 온다: '${item}'`);
        continue;
      }
      const v = num(parts[1], ctx, key);
      if (v !== null) {
        if (key === '자신') chae.self = v;
        else chae.want = v;
      }
    } else if (key === '인용') {
      const refs: Ref[] = [];
      for (const a of parts.slice(1)) {
        const r = parseRef(a.replace(/^↩/u, ''));
        if (r) refs.push(r);
        else ctx.err('E19', `인용의 가리킴을 읽을 수 없다: '${a}'`);
      }
      chae.cite = refs;
    } else {
      (chae.words ??= []).push(item);
    }
  }
  return chae;
}

// ───────── 블록 나누기 ─────────

interface Blocks {
  before: string; // 표지 블록 앞
  marks: string | null;
  muk: string | null;
  chae: string | null;
  trailingTo?: string[]; // 표지·먹·채 블록 뒤에 붙은 →이름(v0.2.1: 읽되 경고하고 앞으로 옮긴다)
}

function extractBlocks(text: string, ctx: Ctx, requireMarks: boolean): Blocks | null {
  const open = text.indexOf('〈');
  if (open < 0) {
    if (requireMarks) {
      ctx.err('E01', `표지 블록 〈…〉이 없다: '${text}'`);
      return null;
    }
    // 받은대로: 표지 없이 먹만 있을 수 있다
    const mo = text.indexOf('〔');
    if (mo < 0) return { before: text.trim(), marks: null, muk: null, chae: null };
    const mc = text.indexOf('〕', mo);
    if (mc < 0) {
      ctx.err('E02', `먹 블록이 닫히지 않았다: '${text}'`);
      return null;
    }
    const rest = text.slice(mc + 1).trim();
    if (rest) ctx.err('E19', `먹 블록 뒤에 읽을 수 없는 글이 있다: '${rest}'`);
    return { before: text.slice(0, mo).trim(), marks: null, muk: text.slice(mo + 1, mc), chae: null };
  }
  const close = text.indexOf('〉', open);
  if (close < 0) {
    ctx.err('E02', `표지 블록이 닫히지 않았다: '${text}'`);
    return null;
  }
  const blocks: Blocks = { before: text.slice(0, open).trim(), marks: text.slice(open + 1, close), muk: null, chae: null };
  let rest = text.slice(close + 1).trim();
  while (rest) {
    const ch = rest[0];
    if (ch === '〔' || ch === '「') {
      const end = rest.indexOf(ch === '〔' ? '〕' : '」');
      if (end < 0) {
        ctx.err('E02', `${ch === '〔' ? '먹' : '채'} 블록이 닫히지 않았다`);
        return blocks;
      }
      const inner = rest.slice(1, end);
      if (ch === '〔') {
        if (blocks.muk !== null) ctx.err('E19', '먹 블록이 둘 이상이다');
        else blocks.muk = inner;
      } else {
        if (blocks.chae !== null) ctx.err('E19', '채 블록이 둘 이상이다');
        else blocks.chae = inner;
      }
      rest = rest.slice(end + 1).trim();
    } else if (ch === '→') {
      // v0.2.1(광장 상의 1의 3번): 받는 이를 줄 끝에 붙인 것. 쉼표로 이어 쓴 것도 하나씩 읽는다.
      const m = /^→\s*([^\s,，、〔「〈]+)\s*[,，、]?\s*/u.exec(rest);
      if (!m) {
        ctx.err('E19', `표지 블록 뒤에 읽을 수 없는 글이 있다: '${rest}'`);
        break;
      }
      (blocks.trailingTo ??= []).push(m[1]);
      rest = rest.slice(m[0].length).trim();
    } else {
      ctx.err('E19', `표지 블록 뒤에 읽을 수 없는 글이 있다: '${rest}'`);
      break;
    }
  }
  return blocks;
}

// ───────── 절 ─────────

/** 옛 꼴의 절 한 줄. 표지 블록을 읽을 수 없으면 null. */
export function parseClause02(text: string, ctx: Ctx): Clause | null {
  const blocks = extractBlocks(text, ctx, true);
  if (!blocks || blocks.marks === null) return null;
  const marks = parseMarks(blocks.marks, ctx);
  if (!marks) return null;

  const toks = blocks.before === '' ? [] : blocks.before.split(/\s+/u);
  const clause: Clause = { label: null, process: null, place: null, to: null, words: [], marks };
  let i = 0;
  if (i < toks.length && LABEL_RE.test(toks[i])) {
    clause.label = toks[i];
    i++;
  }
  // 앞붙이
  while (i < toks.length && takePrefix(toks[i], clause, ctx, RULES_02)) i++;
  // 줄 끝의 →이름(v0.2.1): 읽되 경고하고, 앞붙이에 이미 받는 이가 있으면 E18(앞 이름을 둔다)
  for (const name of blocks.trailingTo ?? []) {
    ctx.warn('W16', `줄 끝의 받는 이 →${name}: 읽었지만 정규형에서는 절 앞(내용 앞)에 둔다`);
    putTo(clause, name, `→${name}`, ctx, false);
  }
  const contentTokens = toks.length - i;
  for (; i < toks.length; i++) {
    const w = parseWord(toks[i], ctx);
    if (w) clause.words.push(w);
  }
  // 내용이 비는 경우(3.7절). 어절이 있었는데 읽지 못한 경우는 이미 오류를 냈다.
  if (contentTokens === 0) {
    const repair = marks.act === 'ask' && !marks.ev && !marks.news && (!clause.place || clause.place.rel === '↖');
    const errorNote = clause.process?.kind === 'err';
    if (!repair && !errorNote) ctx.err('E16', `내용이 비었다: '${text}'`);
  }
  if (blocks.muk !== null) clause.muk = parseMuk(blocks.muk, ctx);
  if (blocks.chae !== null) clause.chae = parseChae(blocks.chae, ctx);
  // 대안의 첫 후보는 내용에 있어야 한다
  if (clause.muk?.alt && clause.muk.alt.length > 0) {
    const roots = clause.words.map((w) => w.root ?? '').join('');
    if (!roots.includes(clause.muk.alt[0].r)) {
      ctx.err('E12', `대안의 첫 후보 '${clause.muk.alt[0].r}'가 내용의 어근에 없다`);
    }
  }
  return clause;
}

// ───────── 받은대로 줄 ─────────

/** 받은대로 줄(받은대로 내용 〈표지〉 〔먹〕 · …). v0.3 줄꼴의 앞붙이 '받은대로'는 v03.ts가 읽는다. */
export function parseEcho(rest: string, ctx: Ctx): Echo[] {
  const out: Echo[] = [];
  for (const it of splitTop(rest, spaced('·')).map((s) => s.trim()).filter((s) => s)) {
    const blocks = extractBlocks(it, ctx, false);
    if (!blocks) continue;
    const echo: Echo = { words: [] };
    // v0.2.1(광장 상의 1의 2번): 받은대로 줄에서는 받은 절·점의 이름(점1, 점1~점10, 절1의)을 내용 자리에 써도 된다.
    const before = tightenTildes(blocks.before);
    for (const t of before === '' ? [] : before.split(/\s+/u)) {
      if (ECHO_LABEL.test(t)) {
        echo.words.push({ text: t });
        continue;
      }
      const w = parseWord(t, ctx);
      if (w) echo.words.push(w);
    }
    if (blocks.marks !== null) {
      const pm = parsePartialMarks(blocks.marks, ctx);
      if (pm) echo.marks = pm;
    }
    if (blocks.muk !== null) echo.muk = parseMuk(blocks.muk, ctx);
    out.push(echo);
  }
  return out;
}
