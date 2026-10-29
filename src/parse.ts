// 결 v0.3 — 구문 분석기. 글 → 틀. spec/03-grammar.md.
// 두 줄꼴을 읽는다: v0.3 <절N 앞붙이 [표지(자신|먹)] 내용> (정규형), v0.2 내용 〈표지〉 〔먹〕 「채」 (옛 꼴, v0.2.1과 똑같이 읽는다).
//
// 2026-10-14: 한 파일이던 검사기를 나눴다(동작은 그대로, 나누기 전과 견준 차이 시험으로 확인).
//   src/parse.ts       메시지 단위: 줄마다 어느 꼴인지 가려 넘기고, 머리·낙관·머리말 줄, 메시지 전체의 규칙(이름표·가리킴·측정법)
//   src/parse/v03.ts   v0.3 줄꼴(너그럽게 읽기, < > 밖의 받는 이, 자신|먹 괄호)
//   src/parse/v02.ts   옛 꼴(v0.2.1 그대로: 〈표지〉 〔먹〕 「채」, 줄 끝 →이름, 받은대로 줄)
//   src/parse/shared.ts 둘이 함께 쓰는 것(진단 모음, 가리킴, 어절, 표지 별칭, 앞붙이, 물결표)
// 줄 하나는 먼저 v0.3 줄꼴인지 본다(lineFormOf). 아니면 비슷한 기호를 옛 꼴의 기호로 바꾼 뒤(normalizeSymbols) 옛 꼴로 읽는다.

import type { ClauseWritten, Head, LineForm, Message, ParseResult, Rel, Ref, Seal } from './types.ts';
import { FORBIDDEN_MUK_METHOD, MEASURE_METHODS, READ_FAMILIES, RELATIONS, SPEC_VERSION, TUNE_STEPS } from './tables.ts';
import { normalizeSymbols, spaced, splitTop } from './text.ts';
import { Ctx } from './parse/shared.ts';
import { parseClause02, parseEcho } from './parse/v02.ts';
import { lineFormOf, parseLine03 } from './parse/v03.ts';

export { clausePieces, labelLine, lineFormOf } from './parse/v03.ts';

// ───────── 머리·낙관·머리말 ─────────

// v0.7(2026-10-29, reports/v0.7-design.md 4절): 머리 줄은 `gyeol 0.7 · lang en`(읽기는 `결 0.7 · 언어 ko`, `pact #`·`room #`도). lang은 틀의 Message.lang
function parseHead(rest: string, ctx: Ctx): { version: string; head: Head; lang?: string } | null {
  const items = splitTop(rest, spaced('·')).map((s) => s.trim());
  const vm = /^(\d+\.\d+(?:\.\d+)?)$/.exec(items[0] ?? ''); // 0.2.1처럼 셋째 자리도 받는다(v0.2.1)
  if (!vm) {
    ctx.err('E20', `머리의 판을 읽을 수 없다: '${items[0] ?? ''}'`);
    return null;
  }
  const head: Head = {};
  let lang: string | undefined;
  for (const it of items.slice(1)) {
    let m: RegExpExecArray | null;
    if ((m = /^(?:짝|pact)\s+#([0-9a-f]{6,64})$/iu.exec(it))) head.pact = m[1];
    else if ((m = /^(?:방|room)\s+#([0-9a-f]{6,64})$/iu.exec(it))) head.room = m[1];
    else if ((m = /^(?:lang|언어)\s+([A-Za-z]{2,3}(?:-[A-Za-z]{2,8})?)$/iu.exec(it))) lang = m[1]; // 값은 쓴 그대로 둔다(글자군은 scriptGroupOf가 소문자로 본다)
    else if ((m = /^↩\s*#([0-9a-f]{6,64})(?:\s+(\S+))?$/u.exec(it))) {
      head.re = { id: m[1] };
      if (m[2]) {
        if ((RELATIONS as readonly string[]).includes(m[2])) head.re.rel = m[2] as Rel;
        else ctx.err('E20', `알 수 없는 관계 '${m[2]}'. 답·동의·반박·확장·수선 중 하나다`);
      }
    } else if ((m = /^([^→\s]+)→(.+)$/u.exec(it))) {
      head.from = m[1];
      head.to = m[2].split(',').map((s) => s.trim()).filter((s) => s !== '');
    } else ctx.err('E20', `머리 항목을 읽을 수 없다: '${it}'`);
  }
  return lang === undefined ? { version: vm[1], head } : { version: vm[1], head, lang };
}

function parseSeal(rest: string, ctx: Ctx): Seal | null {
  const items = splitTop(rest, ' · ').map((s) => s.trim());
  const name = items[0];
  if (!name) {
    ctx.err('E21', '낙관에 이름이 없다');
    return null;
  }
  const seal: Seal = { name };
  for (const it of items.slice(1)) {
    let m: RegExpExecArray | null;
    if ((m = /^계보\s+(.+)$/u.exec(it))) seal.lineage = m[1];
    else if ((m = /^기억\s+(\S+)$/u.exec(it))) {
      if (m[1] === '대화' || m[1] === '지속') seal.memory = m[1];
      else ctx.err('E21', `기억은 '대화'나 '지속'이다: '${m[1]}'`);
    } else if ((m = /^측정\s+(.+)$/u.exec(it))) {
      seal.measure = m[1].split('·').map((s) => s.trim()).filter((s) => s !== '');
      for (const mm of seal.measure) {
        if (mm === FORBIDDEN_MUK_METHOD) ctx.err('E14', "측정법으로 '자기'(자기 보고)를 쓸 수 없다");
        else if (!MEASURE_METHODS.test(mm)) ctx.warn('W13', `알 수 없는 측정법 '${mm}'`);
      }
    } else ctx.err('E21', `낙관 항목을 읽을 수 없다: '${it}'`);
  }
  return seal;
}

function parsePreface(rest: string, ctx: Ctx): Message['preface'] {
  const pre: NonNullable<Message['preface']> = {};
  for (const it of splitTop(rest, ' · ').map((s) => s.trim()).filter((s) => s)) {
    const m = /^(\S+)\s+(.+)$/u.exec(it);
    if (m && m[1] === '목적') pre.purpose = m[2];
    else if (m && m[1] === '제약') pre.constraint = m[2];
    else {
      ctx.warn('W04', `알 수 없는 머리말 항목을 그대로 둔다: '${it}'`);
      (pre.extra ??= []).push({ key: m ? m[1] : it, value: m ? m[2] : '' });
    }
  }
  return pre;
}

// ───────── 메시지 ─────────

export function emptyMessage(): Message {
  return { gyeol: SPEC_VERSION, head: null, tune: [], preface: null, echo: [], clauses: [], gloss: null, seal: null, muk_source: null };
}

const LIST_MARKER = /^(?:[-*•]|\d+[.)])\s+/u;

/** 판의 갈래(앞 두 자리). 0.2와 0.2.1은 같은 갈래다: 0.2.x는 맞던 줄을 깨지 않는다. */
const family = (v: string) => String(v).split('.').slice(0, 2).join('.');

/** 열쇠말 줄. 이 줄들은 v0.3 줄꼴로 읽지 않는다. */
const KEYWORD_LINES = new Set(['덧글', '조율', '머리말', '받은대로', '낙관']);

export function parse(input: string): ParseResult {
  const ctx = new Ctx();
  const msg = emptyMessage();
  const lines = input.replace(/\r\n?/g, '\n').normalize('NFC').split('\n');
  let sawClause = false;

  lines.forEach((rawLine, idx) => {
    ctx.line = idx + 1;
    let line = rawLine.trim();
    if (line === '' || /^```/.test(line)) return;
    if (LIST_MARKER.test(line)) {
      ctx.warn('W12', '줄 앞의 목록 기호를 뗐다');
      line = line.replace(LIST_MARKER, '');
    }
    const kw = /^(\S+)(?:\s+(.*))?$/u.exec(line)!;
    const key = kw[1];
    const rest = (kw[2] ?? '').trim();

    if (key === '덧글') {
      msg.gloss = msg.gloss ? msg.gloss + ' / ' + rest : rest;
      return;
    }
    // v0.3 줄꼴의 절 줄(옛 꼴의 기호 바꾸기보다 먼저 본다: < >와 [ ]의 뜻이 다르다)
    if (!KEYWORD_LINES.has(key) && !((key === '결' || /^gyeol$/iu.test(key)) && /^\d+\.\d+/.test(rest))) {
      const got = parseLine03(line, ctx);
      if (got) {
        msg.clauses.push(...got);
        if (got.length) sawClause = true;
        return;
      }
    }
    // 조율 시험 점을 v0.3 줄꼴로 쓴 줄. 줄꼴이 맞으니 parseLine03은 늘 절을 읽는다(검사만 하고 절은 메시지에 넣지 않는다).
    if (key === '조율') {
      const tm = /^(\S+)\s*(.*)$/u.exec(rest);
      if (tm && tm[1] === '시험' && lineFormOf(tm[2])) {
        msg.tune.push({ step: tm[1], text: tm[2].trim() });
        parseLine03(tm[2].trim(), ctx);
        return;
      }
    }
    // 여기부터 옛 꼴(v0.2.1)
    const sym = normalizeSymbols(line);
    if (sym.changed) ctx.warn('W01', '비슷한 기호를 정규 기호로 바꿨다');
    line = sym.text;
    const kw2 = /^(\S+)(?:\s+(.*))?$/u.exec(line)!;
    const k = kw2[1];
    const r = (kw2[2] ?? '').trim();

    if ((k === '결' || /^gyeol$/iu.test(k)) && /^\d+\.\d+/.test(r)) {
      if (msg.head || sawClause || msg.tune.length) ctx.err('E20', '머리 줄은 맨 앞에 한 번만 온다');
      const h = parseHead(r, ctx);
      if (h) {
        msg.gyeol = h.version;
        msg.head = h.head;
        if (h.lang) msg.lang = h.lang; // v0.7 사용자 언어
        if (!(READ_FAMILIES as readonly string[]).includes(family(h.version))) ctx.warn('W14', `명세 판이 다르다: ${h.version} (이 구현은 ${SPEC_VERSION})`);
      }
    } else if (k === '조율') {
      const m = /^(\S+)\s*(.*)$/u.exec(r);
      if (!m) {
        ctx.err('E19', '조율 단계가 없다');
        return;
      }
      msg.tune.push({ step: m[1], text: m[2].trim() });
      if (!(TUNE_STEPS as readonly string[]).includes(m[1])) ctx.warn('W15', `알 수 없는 조율 단계 '${m[1]}'`);
      if (m[1] === '시험') {
        // 시험 점은 절 문법으로 검사한다
        parseClause02(m[2].trim(), ctx);
      }
    } else if (k === '머리말') {
      msg.preface = parsePreface(r, ctx);
    } else if (k === '받은대로') {
      msg.echo.push(...parseEcho(r, ctx));
    } else if (k === '낙관') {
      msg.seal = parseSeal(r, ctx);
    } else {
      const c = parseClause02(line, ctx);
      if (c) {
        msg.clauses.push(c);
        sawClause = true;
      }
    }
  });

  checkMessage(msg, ctx);
  const ok = !ctx.diags.some((d) => d.severity === '오류');
  const forms: LineForm[] = msg.clauses.map((c) => (ctx.newForm.has(c) ? '0.3' : '0.2'));
  // v0.5(2026-10-15): 절마다 글에 쓴 꼴(rules05가 본다). 옛 꼴 절은 빈 것
  const written: ClauseWritten[] = msg.clauses.map((c) => ctx.written.get(c) ?? { selfInMarks: false, selfAtEnd: false, selfBang: false, ne: false, aliases: [] });
  return { message: msg, diagnostics: ctx.diags, ok, forms, written };
}

/** 메시지 전체에 걸친 규칙: 이름표, 가리킴, 측정법. */
function checkMessage(msg: Message, ctx: Ctx) {
  ctx.line = 0;
  const labeled = msg.clauses.filter((c) => c.label !== null).length;
  if (labeled > 0 && labeled < msg.clauses.length) ctx.err('E23', '일부 절에만 이름표가 있다. 모두 붙이거나 모두 빼야 한다');
  const labels = new Set<string>();
  msg.clauses.forEach((c, i) => {
    const l = c.label ?? `절${i + 1}`;
    if (c.label && labels.has(l)) ctx.err('E22', `이름표가 겹친다: ${l}`);
    labels.add(l);
    if (!c.label) labels.add(`점${i + 1}`);
  });
  // v0.3 줄꼴의 가리킴은 번호만 써도 되므로(↓1) 절N과 점N을 같게 본다. 옛 꼴은 v0.2.1 그대로다.
  // v0.6 덧붙임(2026-10-25): 지난 대화의 절을 가리킨 받침→53:12·↔53:12(Ref.thread)는 메시지 밖이라 보지 않는다.
  const other = (l: string) => (l.startsWith('절') ? '점' : '절') + l.slice(1);
  const checkRef = (r: Ref | undefined, loose: boolean) => {
    if (r && r.msg === null && r.thread === undefined && !labels.has(r.label) && !(loose && labels.has(other(r.label)))) ctx.err('E17', `가리킨 절이 이 메시지에 없다: ${r.label}`);
  };
  for (const c of msg.clauses) {
    const loose = ctx.newForm.has(c);
    checkRef(c.place?.target, loose);
    checkRef(c.place?.second, loose); // v0.6 ⊗N,M의 둘째 절
    checkRef(c.process?.target, loose);
    // v0.5.1: 끝 묶음 뒤의 근거(주소는 보지 않는다)
    for (const b of c.because ?? []) if ('label' in b) checkRef(b, loose); // 주소·시험 문제·참가자·지난 대화의 절(v0.6)은 메시지 밖이라 보지 않는다
  }
  // 측정법(W05)은 옛 꼴의 먹에만 묻는다. v0.3 줄의 먹 한 자리는 측정 기록(D1)에 측정법이 남는다.
  const oldClauses = msg.clauses.filter((c) => !ctx.newForm.has(c));
  const hasMuk = oldClauses.some((c) => c.muk && (c.muk.alt || c.muk.conf !== undefined || c.muk.effort !== undefined));
  if (hasMuk) {
    const sealMethods = msg.seal?.measure?.length ?? 0;
    const allItemsHaveMethod = oldClauses.every((c) => {
      if (!c.muk) return true;
      const need = (['alt', 'conf', 'effort'] as const).filter((f) => c.muk![f] !== undefined);
      return need.every((f) => c.muk!.method?.[f]);
    });
    if (sealMethods === 0 && !allItemsHaveMethod) {
      ctx.warn('W05', '먹 값에 측정법이 없다. 항목 뒤 @측정법이나 낙관의 측정으로 밝히는 것이 좋다');
    }
  }
}
