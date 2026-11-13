// 결 v0.3 — 구문 분석기. 글 → 틀. spec/03-grammar.md.
// 두 줄꼴을 읽는다: v0.3 <절N 앞붙이 [표지(자신|먹)] 내용> (정규형), v0.2 내용 〈표지〉 〔먹〕 「채」 (옛 꼴, v0.2.1과 똑같이 읽는다).
//
// 2026-10-14: 한 파일이던 검사기를 나눴다(동작은 그대로, 나누기 전과 견준 차이 시험으로 확인).
//   src/parse.ts       메시지 단위: 줄마다 어느 꼴인지 가려 넘기고, 머리·낙관·머리말 줄, 메시지 전체의 규칙(이름표·가리킴·측정법)
//   src/parse/v03.ts   v0.3 줄꼴(너그럽게 읽기, < > 밖의 받는 이, 자신|먹 괄호)
//   src/parse/v02.ts   옛 꼴(v0.2.1 그대로: 〈표지〉 〔먹〕 「채」, 줄 끝 →이름, 받은대로 줄)
//   src/parse/shared.ts 둘이 함께 쓰는 것(진단 모음, 가리킴, 어절, 표지 별칭, 앞붙이, 물결표)
// 줄 하나는 먼저 v0.3 줄꼴인지 본다(lineFormOf). 아니면 비슷한 기호를 옛 꼴의 기호로 바꾼 뒤(normalizeSymbols) 옛 꼴로 읽는다.

import type { Clause, ClauseWritten, ExtEvidence, Head, LineForm, Message, ParseResult, Profile, Rel, Ref } from './types.ts';
import { READ_FAMILIES, RELATIONS, SPEC_VERSION } from './tables.ts';
import { spaced, splitTop } from './text.ts';
import { Ctx, flattenExtLines, scanExtBlocks } from './parse/shared.ts';
import { extractTrailingEvidences, lineFormOf, parseExtTag, parseLine03 } from './parse/v03.ts';

export { clausePieces, extractTrailingEvidences, labelLine, lineFormOf, parseExtTag } from './parse/v03.ts';

// ───────── 머리·낙관·머리말 ─────────

// v0.7(2026-10-29, reports/v0.7-design.md 4절): 머리 줄은 `gyeol 0.7 · lang en`(읽기는 `결 0.7 · 언어 ko`, `pact #`·`room #`도). lang은 틀의 Message.lang
// v0.8(2026-11-11 Jae): `lon 0.8`(`론 0.8`) 또는 `gyeol 0.8 · profile lon`으로 프로파일(`gyeol`·`lon`)을 적을 수 있다.
function parseHead(rest: string, ctx: Ctx): { version: string; head: Head; lang?: string; profile?: Profile } | null {
  const items = splitTop(rest, spaced('·')).map((s) => s.trim());
  const vm = /^(\d+\.\d+(?:\.\d+)?)$/.exec(items[0] ?? ''); // 0.2.1처럼 셋째 자리도 받는다(v0.2.1)
  if (!vm) {
    ctx.err('E20', `머리의 판을 읽을 수 없다: '${items[0] ?? ''}'`);
    return null;
  }
  const head: Head = {};
  let lang: string | undefined;
  let profile: Profile | undefined;
  for (const it of items.slice(1)) {
    let m: RegExpExecArray | null;
    if ((m = /^(?:짝|pact)\s+#([0-9a-f]{6,64})$/iu.exec(it))) head.pact = m[1];
    else if ((m = /^(?:방|room)\s+#([0-9a-f]{6,64})$/iu.exec(it))) head.room = m[1];
    else if ((m = /^(?:lang|언어)\s+([A-Za-z]{2,3}(?:-[A-Za-z]{2,8})?)$/iu.exec(it))) lang = m[1]; // 값은 쓴 그대로 둔다(글자군은 scriptGroupOf가 소문자로 본다)
    else if ((m = /^(?:profile|프로파일)\s+(gyeol|결|lon|론)$/iu.exec(it))) profile = /^(?:lon|론)$/iu.test(m[1]) ? 'lon' : 'gyeol';
    else if ((m = /^↩\s*#([0-9a-f]{6,64})(?:\s+(\S+))?$/u.exec(it))) {
      head.re = { id: m[1] };
      if (m[2]) {
        if ((RELATIONS as readonly string[]).includes(m[2])) head.re.rel = m[2] as Rel;
        else ctx.err('E20', `알 수 없는 관계 '${m[2]}'. 답·동의·반박·확장·수선 중 하나다`);
      }
    } else if ((m = /^([^→\s]+?)(?:→|->)(.+)$/u.exec(it))) {
      if (it.includes('->')) ctx.warn('W01', `머리 항목의 '->'를 '→'로 고쳐 읽었다: '${it}'`);
      head.from = m[1];
      head.to = m[2].split(',').map((s) => s.trim()).filter((s) => s !== '');
    } else ctx.err('E20', `머리 항목을 읽을 수 없다: '${it}'`);
  }
  const out: { version: string; head: Head; lang?: string; profile?: Profile } = { version: vm[1], head };
  if (lang !== undefined) out.lang = lang;
  if (profile !== undefined) out.profile = profile;
  return out;
}

// ───────── 메시지 ─────────

export function emptyMessage(): Message {
  return { gyeol: SPEC_VERSION, head: null, clauses: [], gloss: null, muk_source: null };
}

const LIST_MARKER = /^(?:[-*•]|\d+[.)])\s+/u;

/** 판의 갈래(앞 두 자리). */
const family = (v: string) => String(v).split('.').slice(0, 2).join('.');

const isHeadKey = (k: string) => k === '결' || k === '론' || /^(?:gyeol|lon)$/iu.test(k);
const isLonKey = (k: string) => k === '론' || /^lon$/iu.test(k);

export interface ParseOptions {
  /** v0.8 문맥에서 머리 줄 없이 단절을 읽을 때 true(E15 폐지 및 <절N · ● …> 허용) */
  v08?: boolean;
  /**
   * v0.8.1(2026-11-12 Jae, 3.22절): 호출부가 미리 준 받은 자료 번호(`evd103`, `증201`).
   * 받은 자료는 원문을 호출부가 쥐고 있으므로 메시지 안에 선언하지 않고 ↓evd103으로 가리켜도 E17을 내지 않는다.
   * 가져온 자료(ref)는 여기에 넣어도 받지 않는다(말하는 이가 메시지 안에 원문을 함께 써야 한다).
   */
  issued?: readonly string[];
  /** 앞 차례 절 목록(E17 가리킴 해소용, E22·E23에는 섞지 않음) */
  priorClauses?: readonly Clause[];
  /** 앞 차례 외부 근거 목록(E17 가리킴 해소용, E45에는 섞지 않음) */
  priorEvidences?: readonly ExtEvidence[];
  /** 현재 차례 번호(지정 시 다른 차례 번호를 쓴 절에 E46) */
  turnNo?: number;
}

// v0.8.2 재검토(2026-11-13 Jae): 이모지는 대화 내용이라 이모지 사이를 잇는 0폭 결합자(ZWJ, U+200D, 👨‍👩‍👧)는 E41에서 뺀다.
// 이모지 사이가 아닌 ZWJ와 그 밖의 0폭·양방향·사용자 영역 문자는 그대로 막는다.
const FORBIDDEN_CTRL_RE =
  /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2060-\u206F\uFEFF\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]|(?<!\p{Extended_Pictographic}[\u{FE0F}\u{1F3FB}-\u{1F3FF}]?)\u200D|\u200D(?!\p{Extended_Pictographic})/gu;

export function parse(input: string, opts: ParseOptions = {}): ParseResult {
  const ctx = new Ctx();
  if (opts.v08) ctx.v08 = true;
  const issued = new Set<string>();
  for (const raw of opts.issued ?? []) {
    const tag = parseExtTag(String(raw ?? '').trim());
    if (tag && tag.ext === 'evd') issued.add(`${tag.ext}:${tag.id}`);
  }
  const msg = emptyMessage();
  const norm = input.replace(/\r\n?/g, '\n').normalize('NFC');
  const extSpans = scanExtBlocks(norm);
  let maskedForCtrl = '';
  let ctrlPos = 0;
  for (const sp of extSpans) {
    maskedForCtrl += norm.slice(ctrlPos, sp.innerStart);
    maskedForCtrl += norm.slice(sp.innerStart, sp.innerEnd).replace(/[^\n]/gu, ' ');
    ctrlPos = sp.innerEnd;
  }
  maskedForCtrl += norm.slice(ctrlPos);
  maskedForCtrl.split('\n').forEach((ln, lineIdx) => {
    FORBIDDEN_CTRL_RE.lastIndex = 0;
    const m = FORBIDDEN_CTRL_RE.exec(ln);
    if (m) {
      const cp = m[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0');
      ctx.line = lineIdx + 1;
      ctx.err('E41', `외부 근거 블록 밖에 제어·숨김·사용자 영역 문자가 있다(U+${cp}): 줄 ${lineIdx + 1}`);
    }
  });
  let cleaned = '';
  let cleanPos = 0;
  for (const sp of extSpans) {
    cleaned += norm.slice(cleanPos, sp.innerStart).replace(FORBIDDEN_CTRL_RE, '');
    cleaned += norm.slice(sp.innerStart, sp.innerEnd);
    cleanPos = sp.innerEnd;
  }
  cleaned += norm.slice(cleanPos).replace(FORBIDDEN_CTRL_RE, '');
  const rawLines = cleaned.split('\n');
  const lines = flattenExtLines(rawLines);
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
    // v0.8(2026-11-11 Jae): 단독 줄로 적은 전용 괄호꺽쇠 외부 근거(`ref1 <[ … ]>`, `증1 <[ … ]>`)
    const standaloneEv = extractTrailingEvidences(line);
    if (standaloneEv.unclosed && standaloneEv.head === '') {
      ctx.err('E02', '외부 근거 블록이 닫히지 않았다');
      if (standaloneEv.legacyExt?.length) ctx.err('E26', `옛 외부 근거 괄호 '${standaloneEv.legacyExt[0]}'다. <[ ... ]>로 쓴다`);
      (msg.evidences ??= []).push(...standaloneEv.evidences);
      return;
    }
    if (standaloneEv.evidences.length > 0 && standaloneEv.head === '') {
      if (standaloneEv.legacyExt?.length) ctx.err('E26', `옛 외부 근거 괄호 '${standaloneEv.legacyExt[0]}'다. <[ ... ]>로 쓴다`);
      (msg.evidences ??= []).push(...standaloneEv.evidences);
      return;
    }
    if (isHeadKey(key) && /^\d+\.\d+/.test(rest)) {
      if (msg.head || sawClause) ctx.err('E20', '머리 줄은 맨 앞에 한 번만 온다');
      const h = parseHead(rest, ctx);
      if (h) {
        msg.gyeol = h.version;
        msg.head = h.head;
        if (h.lang) msg.lang = h.lang; // v0.7 사용자 언어
        const prof = h.profile ?? (isLonKey(key) ? 'lon' : undefined);
        if (prof) msg.profile = prof;
        if (Number(family(h.version)) >= 0.8 || prof === 'lon') ctx.v08 = true;
        if (!(READ_FAMILIES as readonly string[]).includes(family(h.version))) ctx.warn('W14', `명세 판이 다르다: ${h.version} (이 구현은 ${SPEC_VERSION})`);
      }
      return;
    }
    const got = parseLine03(line, ctx);
    if (got) {
      msg.clauses.push(...got);
      if (got.length) sawClause = true;
      return;
    }
    ctx.err('E19', `줄을 읽을 수 없다: '${line}'`);
  });

  // 여러 줄에 걸친 닫힌 외부 근거 블록의 원문 줄바꿈을 복원한다([L시작:L끝] 줄 범위 대조용).
  const rawExtQueue = scanExtBlocks(cleaned)
    .filter((sp) => sp.closed && sp.tag)
    .map((sp) => ({
      kind: sp.tag!.ext,
      id: sp.tag!.id,
      text: cleaned.slice(sp.innerStart, sp.innerEnd).trim(),
    }));
  if (rawExtQueue.some((e) => e.text.includes('\n'))) {
    let qPos = 0;
    const restoreEv = (ev: ExtEvidence) => {
      for (let i = qPos; i < rawExtQueue.length; i++) {
        if (rawExtQueue[i].kind === ev.kind && rawExtQueue[i].id === ev.id) {
          if (rawExtQueue[i].text.includes('\n')) ev.text = rawExtQueue[i].text;
          qPos = i + 1;
          break;
        }
      }
    };
    for (const c of msg.clauses) for (const ev of c.evidences ?? []) restoreEv(ev);
    for (const ev of msg.evidences ?? []) restoreEv(ev);
  }

  checkMessage(msg, ctx, issued, opts);
  const ok = !ctx.diags.some((d) => d.severity === '오류');
  const forms: LineForm[] = msg.clauses.map(() => '0.3');
  const written: ClauseWritten[] = msg.clauses.map((c) => ctx.written.get(c) ?? { aliases: [] });
  return { message: msg, diagnostics: ctx.diags, ok, forms, written };
}

/** 메시지 전체에 걸친 규칙: 이름표, 가리킴, 측정법. */
function checkMessage(msg: Message, ctx: Ctx, issued: ReadonlySet<string> = new Set(), opts: ParseOptions = {}) {
  ctx.line = 0;
  const labeled = msg.clauses.filter((c) => c.label !== null).length;
  if (labeled > 0 && labeled < msg.clauses.length) ctx.err('E23', '일부 절에만 이름표가 있다. 모두 붙이거나 모두 빼야 한다');
  if (opts.turnNo != null) {
    const tStr = String(opts.turnNo);
    for (const c of msg.clauses) {
      if (c.label != null) {
        const mNo = String(c.label).replace(/^[절점]/u, '');
        if (mNo !== tStr && !mNo.startsWith(`${tStr}.`)) {
          ctx.err('E46', `차례 번호 불일치(다른 차례 번호 사용): 절${mNo}`);
        }
      }
    }
  }
  const priorLabels = new Set<string>();
  (opts.priorClauses ?? []).forEach((c, i) => {
    priorLabels.add(c.label ?? `절${i + 1}`);
    if (!c.label) priorLabels.add(`점${i + 1}`);
  });
  const labels = new Set<string>();
  msg.clauses.forEach((c, i) => {
    const l = c.label ?? `절${i + 1}`;
    if (c.label && (labels.has(l) || (opts.turnNo == null && priorLabels.has(l)))) ctx.err('E22', `이름표가 겹친다: ${l}`);
    labels.add(l);
    if (!c.label) labels.add(`점${i + 1}`);
  });
  const extLabels = new Set<string>();
  const recordExt = (ev: { kind: string; id: string }) => {
    const key = `${ev.kind}:${ev.id}`;
    if (extLabels.has(key)) ctx.err('E45', `외부 근거 이름표가 겹친다: ${ev.kind}${ev.id}`);
    extLabels.add(key);
  };
  for (const c of msg.clauses) for (const ev of c.evidences ?? []) recordExt(ev);
  for (const ev of msg.evidences ?? []) recordExt(ev);

  const knownLabels = new Set<string>([...priorLabels, ...labels]);
  const knownExt = new Set<string>(extLabels);
  for (const ev of opts.priorEvidences ?? []) knownExt.add(`${ev.kind}:${ev.id}`);

  // v0.3 줄꼴의 가리킴은 번호만 써도 되므로(↓1) 절N과 점N을 같게 본다. 옛 꼴은 v0.2.1 그대로다.
  // v0.6 덧붙임(2026-10-25): 지난 대화의 절을 가리킨 받침→53:12·↔53:12(Ref.thread)는 메시지 밖이라 보지 않는다.
  const other = (l: string) => (l.startsWith('절') ? '점' : '절') + l.slice(1);
  const checkRef = (r: Ref | undefined, loose: boolean) => {
    if (r && r.msg === null && r.thread === undefined && !knownLabels.has(r.label) && !(loose && knownLabels.has(other(r.label)))) ctx.err('E17', `가리킨 절이 이 메시지에 없다: ${r.label}`);
  };
  for (const c of msg.clauses) {
    checkRef(c.place?.target, true);
    checkRef(c.place?.second, true); // v0.6 ⊗N,M의 둘째 절
    checkRef(c.process?.target, true);
    // v0.5.1: 끝 묶음 뒤의 근거(주소는 보지 않는다). v0.8: 선언되지 않은 외부 근거 인용은 E17로 잡는다.
    // v0.8.1(3.22절): 호출부가 준 받은 자료 번호(issued)는 선언으로 본다. 맥락 ↓T는 메시지 밖이라 보지 않는다.
    for (const b of c.because ?? []) {
      if ('label' in b) checkRef(b, true); // 주소·맥락·시험 문제·참가자·지난 대화의 절(v0.6)은 메시지 밖이라 보지 않는다
      else if ('ext' in b && !knownExt.has(`${b.ext}:${b.id}`) && !issued.has(`${b.ext}:${b.id}`)) ctx.err('E17', `가리킨 외부 근거가 이 메시지에 없다: ${b.ext}${b.id}`);
    }
  }
}
