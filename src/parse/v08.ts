// 결 v0.8 및 론(Lon: Lineage Oriented Notation) 쓰기 규칙 (2026-11-11 Jae).
// 다단계 사후 패치 사슬(rules04 → 05 → 051 → 06 → 065 → 07)과 분리된 선언형 단일 검사기다.
// 옛 쓰기 규칙(rules04부터 rules07)과 보관 줄 196개 판정은 그대로 보존한다.
//
// 핵심 정리(2026-11-11 Jae 결정):
//   1. <N · 고정 표기(E25): 모든 절 번호 바로 뒤에 화자 점(·)을 괄호처럼 고정한다.
//      혼자 <1 · […]>, 지목 <1 ·→이름 […]>, 모두 <1 · ● […]>(읽기는 ·→●··●도 수용해 정규형 <1 · ● […]>로 모은다).
//      v0.7의 <1 ● […]>처럼 ·을 빠뜨리면 E25로 잡아 E18(점이 둘이다) 오류 원인을 원천 제거한다.
//   2. E34 완화: 새 화두(top·갑)는 뒤따르는 절이 ↓N으로 근거 삼을 수 있다. E34는 직감(gut·촉) 절에만 적용한다.
//      받침(sup→N, W36)은 직감(gut)과 새 화두(top) 모두 받칠 수 있다.
//   3. E15 폐지: 한 어절 안 한글 꼬리 뒤 한자 금지(v0.2 초기 유산)는 parse(..., { v08: true }) 및 0.8 머리 줄에서 해제한다.
//   4. *먹채(E33·W38) 공통 보존: 결(gyeol)과 론(lon) 모두 끝에 *먹채(*5B8 등)를 그대로 쓴다.
//      채의 색(RGBCMYK)은 어떤 외부 의미나 단서도 정의하지 않는 원시 귀납 신호로 보존한다.
//   5. 다언어 어근(W29): 본래 결(profile 'gyeol')에서는 현행 경고(W29) 그대로 유지하고(오류 격상 안 함),
//      산업용 검증·분석·추적 표준 프로파일 론(profile 'lon')에서는 W29·W32를 면제한다.
//   6. 론(Lon) 표지 집합(E39·W26): 근거 5종(see·rec·inf·gut·if), 결 1종(lim), 시제 2종(pst·fut), 화행 7종(say·ask·req·let·vow·nay·ack),
//      앞붙이 ↔·↖·fix→·err→·sup→ 및 끝 근거 ↓만 허용하고 영어 3글자 정본 표지를 쓴다(top·new·met·pdx 등은 E39).

import type { Clause, Diagnostic, ExtEvidence, ParseResult, Profile, Word } from '../types.ts';
import {
  LON_ACT,
  LON_EV,
  LON_FIG,
  LON_PROCESS,
  LON_TENSE,
  SHORT_ALIASES_07,
  TO_MAX,
  markOf07,
  scriptGroupOf,
  scriptGroupOfChar,
  type ScriptGroup,
} from '../tables.ts';

export interface Rules08Options {
  sender?: string | null;
  from?: number;
  lang?: string | null;
  ink?: number | null;
  profile?: Profile | null;
  spec?: '0.7' | '0.8';
  priorClauses?: readonly Clause[];
  priorEvidences?: readonly ExtEvidence[];
  issued?: readonly string[];
}

export function mixesScripts(words: Word[], group: ScriptGroup): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  if (counted.length < 2) return true;
  return counted.some((ls) => ls.some((ch) => scriptGroupOfChar(ch) !== group));
}

export function hasUserScript(words: Word[], group: ScriptGroup): boolean {
  const counted = words.map((w) => [...w.text].filter((ch) => /\p{L}/u.test(ch))).filter((ls) => ls.length > 0);
  if (counted.length < 2) return true;
  return counted.some((ls) => ls.some((ch) => scriptGroupOfChar(ch) === group));
}

const INLINE_GLOSS = /[(（]\s*[a-z]{2}(?:\s*[)）]|\s+\p{Script=Hangul})/u;
const BACKABLE_EV: ReadonlySet<string> = new Set(['gut', 'top']);
const ASCII_ID_RE = /^[A-Za-z0-9_.:-]+$/;
// v0.8.2 재검토(2026-11-13): 한 글자 단위(s·h·b·k·m·g·w·v·a)는 수에 바로 붙었을 때만 단위로 읽는다('3 a test'의 a는 낱말).
const UNIT_MULTI = '%|퍼센트|ms|us|µs|ns|sec|min|hr|kb|mb|gb|tb|khz|mhz|ghz|hz|℃|°c|°f|km|cm|mm|kg|mg|kw|mw|mv|ma|초|분|시간';
const UNIT_SINGLE = 's|h|b|k|m|g|w|v|a';
// 부호 글자 집합 안의 줄표를 이스케이프해 숫자가 부호로 먹히지 않게 한다.
const NUM_UNIT_RE = new RegExp(
  `(?<![A-Za-z0-9_])([+\\-−])?(\\d+(?:[.,]\\d+)?)(?:\\s*(${UNIT_MULTI})|(${UNIT_SINGLE}))(?![A-Za-z0-9_])`,
  'giu',
);
const CODE_ID_RE = /\b[A-Za-z]{1,12}[-_][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*\b/gu;
const TAG_STRIP_RE = /(?:^|\s)(?:(?:evd|ref|Q|T)\d+(?:\.\d+)?|(?:증|근)\d+(?:\.\d+)?)[가-힣]*/giu;

function canonUnit(u: string): string {
  const l = u.toLowerCase();
  if (l === '퍼센트') return '%';
  if (l === 'sec' || l === '초') return 's';
  if (l === '분') return 'min';
  if (l === 'hr' || l === '시간') return 'h';
  if (l === '℃' || l === '°c') return 'c';
  if (l === '°f') return 'f';
  if (l === 'µs') return 'us';
  return l;
}

// v0.8.2 재검토(2026-11-13): 한글 비교어는 수(와 단위) 바로 뒤에 올 때만 비교어로 읽는다('이상하다'·'이하 생략'은 낱말).
const KO_CMP_LOW_RE = new RegExp(`\\d(?:[.,]\\d+)?\\s*(?:(?:${UNIT_MULTI})|(?:${UNIT_SINGLE}))?\\s*(?:이하|미만)`, 'iu');
const KO_CMP_HIGH_RE = new RegExp(`\\d(?:[.,]\\d+)?\\s*(?:(?:${UNIT_MULTI})|(?:${UNIT_SINGLE}))?\\s*(?:이상|초과)`, 'iu');

function cmpDir(s: string): { hasLow: boolean; hasHigh: boolean } {
  const hasLow = /<=|≤/u.test(s) || KO_CMP_LOW_RE.test(s) || /(?:^|[^<=\d])<(?!<|=)/u.test(s);
  const hasHigh = />=|≥/u.test(s) || KO_CMP_HIGH_RE.test(s) || /(?:^|[^>=])>(?!>|=)/u.test(s);
  return { hasLow, hasHigh };
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function checkGhostW43(bodyText: string, evdBlob: string): string | null {
  const clean = bodyText.replace(/`[^`]*`/gu, ' ').replace(TAG_STRIP_RE, ' ');
  NUM_UNIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = NUM_UNIT_RE.exec(clean))) {
    const [, sign, rawNum, unitMulti, unitSingle] = m;
    const rawUnit = unitMulti ?? unitSingle;
    const numNorm = rawNum.replace(/,/g, '');
    const esc = escRe(numNorm);
    const numWithComma = /\d{4,}/.test(numNorm) ? numNorm.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : null;
    const escPat = numWithComma ? `(?:${esc}|${escRe(numWithComma)})` : esc;
    const numRe = new RegExp(`(?<!\\d)${escPat}(?!\\d)`, 'u');
    if (!numRe.test(evdBlob)) return `외부 근거에 없는 수치 '${rawNum}'`;
    if (sign === '+') {
      const hasNeg = new RegExp(`[-−]\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      const hasPos = new RegExp(`\\+\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      if (hasNeg && !hasPos) return `외부 근거와 수치 부호가 다르다('${sign}${rawNum}')`;
    } else if (sign === '-' || sign === '−') {
      const hasPos = new RegExp(`(?:^|[^-−\\d])${escPat}(?!\\d)`, 'u').test(evdBlob);
      const hasNeg = new RegExp(`[-−]\\s*${escPat}(?!\\d)`, 'u').test(evdBlob);
      if (hasPos && !hasNeg) return `외부 근거와 수치 부호가 다르다('${sign}${rawNum}')`;
    }
    const wantUnit = canonUnit(rawUnit);
    const evUnitRe = new RegExp(`(?<!\\d)${escPat}(?:\\s*(${UNIT_MULTI})|(${UNIT_SINGLE}))(?![A-Za-z0-9_])`, 'giu');
    const foundUnits = [...evdBlob.matchAll(evUnitRe)].map((um) => canonUnit(um[1] ?? um[2]));
    if (foundUnits.length > 0 && !foundUnits.includes(wantUnit)) {
      return `외부 근거와 단위가 다르다('${rawNum}${rawUnit}')`;
    }
  }
  const cd = cmpDir(clean);
  const ed = cmpDir(evdBlob);
  if (((cd.hasHigh && !cd.hasLow) && (ed.hasLow && !ed.hasHigh)) || ((cd.hasLow && !cd.hasHigh) && (ed.hasHigh && !ed.hasLow))) {
    return '외부 근거와 비교 방향이 반대다';
  }
  const evLower = evdBlob.toLowerCase();
  for (const idm of clean.matchAll(CODE_ID_RE)) {
    const id = idm[0];
    if (!evLower.includes(id.toLowerCase())) return `외부 근거에 없는 식별자 '${id}'`;
  }
  return null;
}

function byNumber(clauses: readonly Clause[], priorClauses: readonly Clause[] = []): Map<string, Clause> {
  const m = new Map<string, Clause>();
  priorClauses.forEach((c, i) => {
    const n = (c.label ?? `절${i + 1}`).slice(1);
    if (!m.has(n)) m.set(n, c);
  });
  const curr = new Map<string, Clause>();
  clauses.forEach((c, i) => {
    const n = (c.label ?? `절${priorClauses.length + i + 1}`).slice(1);
    if (!curr.has(n)) curr.set(n, c);
  });
  for (const [k, v] of curr) m.set(k, v);
  return m;
}

function canonMarks(c: Clause): string {
  const m = c.marks;
  return `[${[m.ev, m.news ? 'new' : undefined, m.fig, m.tense, m.act].filter(Boolean).join(',')}]`;
}

/**
 * 봄의 닿음(W40, 2026-11-12 Jae, 3.22절): 본 것(see) 절이 근거를 따라가 바깥 출처에 닿는가.
 * - 바로 닿음: 맥락 ↓T, 받은 자료 ↓evd, 가져온 자료 ↓ref, 주소, 참가자 ↓@, 지난 대화 ↓53:12, 옛 ↓Q.
 * - 절을 가리킨 것(끝 ↓N, 앞 ↓N, ↖N, ↔N): 앞 차례의 절이거나 이 글에서 찾지 못한 절이면 남의 말을 본 것으로 닿음,
 *   이 차례 안의 see 절이면 그 절이 닿을 때만 닿음(순환은 막는다), rec·inf·gut·if·top 절은 닿지 않음.
 * 'ok' 닿음, 'none' 근거가 하나도 없음(t1 꼴), 'inferred' 절 근거가 있으나 추론·직감·가정에서 끊김(t3 꼴).
 */
export function seeReach(
  c: Clause,
  clauses: Clause[],
  nums: Map<string, Clause>,
  from: number,
  seen: Set<Clause> = new Set(),
  priorSet?: ReadonlySet<Clause>,
): 'ok' | 'none' | 'inferred' {
  seen.add(c);
  const because = c.because ?? [];
  if (because.some((b) => !('label' in b))) return 'ok';
  const refs = [
    ...because.filter((b): b is Extract<typeof b, { label: string }> => 'label' in b),
    ...(c.place && (c.place.rel === '↓' || c.place.rel === '↖' || c.place.rel === '↔') ? [c.place.target] : []),
  ];
  if (!refs.length) return 'none';
  let sawNone = false;
  for (const g of refs) {
    if (g.msg !== null || g.thread !== undefined) return 'ok';
    const t = nums.get(g.label.slice(1));
    if (!t) return 'ok';
    if (priorSet?.has(t)) return 'ok';
    const at = clauses.indexOf(t);
    if (at !== -1 && at < from) return 'ok';
    if (t === c || seen.has(t)) continue;
    if (t.marks.ev === 'see') {
      const sub = seeReach(t, clauses, nums, from, seen, priorSet);
      if (sub === 'ok') return 'ok';
      if (sub === 'none') sawNone = true;
    }
  }
  return sawNone ? 'none' : 'inferred';
}

export function rules08(r: ParseResult, opts: Rules08Options = {}): Diagnostic[] {
  const out: Diagnostic[] = [];
  const profile: Profile = opts.profile ?? r.message.profile ?? 'gyeol';
  const isLon = profile === 'lon';
  const sender = opts.sender ? String(opts.sender).toLowerCase() : null;
  const ink = opts.ink == null ? NaN : Number(opts.ink);
  const inkKnown = Number.isInteger(ink) && ink >= 0 && ink <= 9;
  const lang = opts.lang ?? r.message.lang ?? null;
  const group = scriptGroupOf(lang);
  const clauses = r.message.clauses;
  const priorClauses = opts.priorClauses ?? [];
  const priorSet = priorClauses.length ? new Set(priorClauses) : undefined;
  const start = priorClauses.length ? 0 : (opts.from ?? 0);
  const nums = byNumber(clauses, priorClauses);

  // W43용 외부 근거 원문 색인 및 W44용 무효·철회 절 집합
  const extTextMap = new Map<string, string[]>();
  const addExtText = (kind: string, id: string, text: string) => {
    const k = `${kind}:${id}`;
    const arr = extTextMap.get(k) ?? [];
    arr.push(text);
    extTextMap.set(k, arr);
  };
  for (const ev of opts.priorEvidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ac of priorClauses) for (const ev of ac.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ev of r.message.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);
  for (const ac of clauses) for (const ev of ac.evidences ?? []) addExtText(ev.kind, ev.id, ev.text);

  const allClauses = priorClauses.length ? [...priorClauses, ...clauses] : clauses;
  const allLabels = new Set<string>();
  allClauses.forEach((ac, idx) => {
    allLabels.add(ac.label ?? `절${idx + 1}`);
    if (!ac.label) allLabels.add(`점${idx + 1}`);
  });
  const allExt = new Set<string>(extTextMap.keys());
  for (const raw of opts.issued ?? []) {
    const im = /^(?:증|evd)([0-9０-９]+(?:\.[0-9０-９]+)?)$/iu.exec(String(raw ?? '').trim());
    if (im) allExt.add(`evd:${im[1].replace(/[０-９]/gu, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))}`);
  }
  const hasLabel = (lbl: string) => {
    const alt = (lbl.startsWith('절') ? '점' : '절') + lbl.slice(1);
    return allLabels.has(lbl) || allLabels.has(alt);
  };
  const badGrounds = new Map<string, number>();
  const markBad = (num: string, idx: number) => {
    const prev = badGrounds.get(num);
    if (prev === undefined || idx < prev) badGrounds.set(num, idx);
  };
  allClauses.forEach((ac, idx) => {
    const acNum = (ac.label ?? `절${idx + 1}`).slice(1);
    if (ac.process?.kind === 'err' && ac.process.target.msg === null && ac.process.target.thread === undefined) {
      markBad(ac.process.target.label.replace(/^[절점]/u, ''), idx);
    }
    const acGrounds = [...(ac.because ?? []).filter((b) => 'label' in b), ...(ac.place?.rel === '↓' ? [ac.place.target] : [])];
    for (const g of acGrounds) {
      if (g.msg !== null || g.thread !== undefined) continue;
      const t = nums.get(g.label.slice(1));
      if (t && t !== ac && (t.marks.ev === 'gut' || (opts.spec === '0.7' && t.marks.ev === 'top'))) {
        markBad(acNum, idx);
      }
    }
    const localRefs = [ac.place?.target, ac.place?.second, ac.process?.target, ...(ac.because ?? []).filter((b) => 'label' in b)];
    for (const ref of localRefs) {
      if (ref && ref.msg === null && ref.thread === undefined && !hasLabel(ref.label)) {
        markBad(acNum, idx);
      }
    }
    for (const b of ac.because ?? []) {
      if ('ext' in b && !allExt.has(`${b.ext}:${b.id}`)) markBad(acNum, idx);
    }
  });

  // 0. 머리 줄 식별자 ASCII 확인(E44, spec 0.7 제외)
  if (opts.spec !== '0.7' && r.message.head && start === 0) {
    const h = r.message.head;
    if (h.from && !ASCII_ID_RE.test(h.from)) {
      out.push({
        code: 'E44',
        severity: '오류',
        line: 1,
        message: `식별자에 비ASCII 문자가 있다('${h.from}'). ASCII 영숫자·기호만 쓴다: 머리`,
      });
    }
    for (const toId of h.to ?? []) {
      if (!ASCII_ID_RE.test(toId)) {
        out.push({
          code: 'E44',
          severity: '오류',
          line: 1,
          message: `식별자에 비ASCII 문자가 있다('${toId}'). ASCII 영숫자·기호만 쓴다: 머리`,
        });
      }
    }
  }

  for (let k = start; k < clauses.length; k++) {
    const c = clauses[k];
    const w = r.written?.[k];
    const where = c.label ?? `절 ${k + 1}째`;
    const push = (code: string, message: string) =>
      out.push({ code, severity: code.startsWith('E') ? '오류' : '경고', line: k + 1, message: `${message}: ${where}` });

    if (r.forms[k] !== '0.3') {
      push('E26', '옛 꼴은 v0.8에서 쓰지 않는다. <1 · [see,say] 내용 *5B8>로 쓴다');
      continue;
    }

    // 1. 모든 절 번호 바로 뒤 점(·) 고정(<1 · …>, <1 ·→이름 …>, <1 · ● …>)
    if (!c.me) {
      push('E25', '점(·) 자리가 없다. 절 번호 바로 뒤에 ·(혼자), ·→이름(지목), · ●(모두)로 고정해 쓴다');
    } else if (c.all && !w?.hasDot && opts.spec !== '0.7') {
      push('E25', '점(·) 자리가 빠졌다. v0.8에서는 모두에게 말할 때도 절 번호 바로 뒤에 · ●로 고정해 쓴다');
    }

    // 2. 받는 이·참가자 식별자 검사(E44 ASCII, 자기 지목 W23, 다중 지목 W35)
    if (opts.spec !== '0.7') {
      const recips = c.toList ?? (c.to ? [c.to] : []);
      for (const id of recips) {
        if (!ASCII_ID_RE.test(id)) push('E44', `식별자에 비ASCII 문자가 있다(→${id}). ASCII 영숫자·기호만 쓴다`);
      }
      for (const b of c.because ?? []) {
        if ('agent' in b && !ASCII_ID_RE.test(b.agent)) {
          push('E44', `식별자에 비ASCII 문자가 있다(↓@${b.agent}). ASCII 영숫자·기호만 쓴다`);
        }
      }
    }
    if (sender && c.to && c.to.toLowerCase() === sender) {
      push('W23', `받는 이가 자기 자신이다(→${c.to}). 받는 이가 없으면 · 만 쓴다`);
    }
    if (c.toList) {
      const seen = new Set<string>();
      const dup = c.toList.filter((n) => (seen.has(n.toLowerCase()) ? true : (seen.add(n.toLowerCase()), false)));
      if (dup.length) push('W35', `다중 지목에 같은 이름이 두 번이다(${[...new Set(dup)].join(', ')})`);
      if (c.toList.length > TO_MAX) push('W35', `다중 지목은 ${TO_MAX}명까지다(${c.toList.length}명). 더 많으면 · ●(모두에게)로 쓴다`);
      if (sender) {
        for (const n of c.toList.slice(1)) {
          if (n.toLowerCase() === sender) push('W23', `받는 이가 자기 자신이다(→${n}). 받는 이가 없으면 · 만 쓴다`);
        }
      }
    }

    // 3. 표지 순서(W34)
    if (w?.marksOff) push('W34', `표지는 정규 순서 [근거,군,결,시제,화행]로 쓴다(뜻은 그대로 읽었다). 정규형은 ${canonMarks(c)}`);

    // 4. *먹채(E33) 및 먹 누락(W38) — 결·론 공통 필수(채 색의 뜻은 절대 정의하지 않음)
    if (c.chae?.color === undefined && !w?.legacyChae) {
      push('E33', '채는 꼭 쓴다: 색 하나(RGBCMYK)와 확신(0부터 9)을 끝에 *R8처럼 쓴다');
    } else if (c.chae?.color !== undefined && inkKnown && c.muk?.conf === undefined) {
      push('W38', `먹을 빠뜨렸다. 먹은 바깥에서 잰 신용 점수라 받은 그대로 쓴다: *${ink}`);
    }

    // 5. 근거 자격(E34: v0.8은 gut만 금지·top 허용, spec '0.7'은 gut·top 금지) 및 받침 대상(W36: gut·top)
    const grounds = [...(c.because ?? []).filter((b) => 'label' in b), ...(c.place?.rel === '↓' ? [c.place.target] : [])];
    for (const g of grounds) {
      if (g.msg !== null) continue;
      const t = nums.get(g.label.slice(1));
      if (t && t !== c && (t.marks.ev === 'gut' || (opts.spec === '0.7' && t.marks.ev === 'top'))) {
        push('E34', `직감(gut·촉) 절은 아직 검증 전이라 근거가 될 수 없다: ↓${g.label.slice(1)}. 먼저 sup→${g.label.slice(1)}로 받치거나 ↔·↖로 가리킨다`);
      }
    }
    const back = c.process?.kind === 'sup' ? c.process.target : undefined;
    if (back && back.msg === null && back.thread === undefined) {
      const t = nums.get(back.label.slice(1));
      if (t && !(t.marks.ev && BACKABLE_EV.has(t.marks.ev))) {
        push('W36', `sup→${back.label.slice(1)}은 직감(gut)·새 화두(top) 절을 뒤늦게 받칠 때 쓴다. 그 밖의 절은 끝에 ↓${back.label.slice(1)}로 근거 삼는다`);
      }
    }

    // 5b. 봄의 닿음(W40): t3형(추론·직감·가정에서 끊김)은 결·론 모두, t1형(근거 없음)은 론에서만 낸다
    if (c.marks.ev === 'see') {
      const reach = seeReach(c, clauses, nums, start, new Set(), priorSet);
      if (reach === 'none' && isLon) {
        push('W40', '본 것(see)이 바깥 출처에 닿지 않는다. ↓T(맥락)·↓evd(받은 자료)·↓ref(가져온 자료)·↖N으로 출처를 달거나, 본 것이 아니면 inf·rec로 쓴다');
      } else if (reach === 'inferred') {
        push('W40', '본 것(see)의 근거가 추론·직감·가정 절뿐이다. 본 출처를 ↓T·↓evd·↓ref·↖N으로 달거나, 본 것이 아니면 inf로 쓴다');
      }
    }

    // 5c. 철회(err→) 또는 의미 오류(E17·E34) 절 인용(W44) — ↓N과 sup→N에만 적용
    const w44Seen = new Set<string>();
    const absIdx = priorClauses.length + k;
    const citeRefs = [...grounds, ...(back ? [back] : [])];
    for (const ref of citeRefs) {
      if (ref.msg !== null || ref.thread !== undefined) continue;
      const n = ref.label.slice(1);
      const t = nums.get(n);
      const badAt = badGrounds.get(n);
      if (t && t !== c && badAt !== undefined && badAt < absIdx && !w44Seen.has(n)) {
        w44Seen.add(n);
        push('W44', `철회되었거나 의미 오류(E17·E34)가 있는 절을 근거·받침으로 인용했다: ${n}`);
      }
    }

    // 5d. 유령 수치·단위·부호·비교어·식별자 대조(W43) — 외부 근거(evd·ref)만 단독 인용하고 원문이 있을 때만
    const extRefs = (c.because ?? []).filter((b): b is Extract<typeof b, { ext: 'evd' | 'ref' }> => 'ext' in b);
    const otherGrounds =
      (c.because ?? []).filter((b) => !('ext' in b)).length + (c.place?.rel === '↓' ? 1 : 0);
    if (extRefs.length > 0 && otherGrounds === 0 && extRefs.every((b) => extTextMap.has(`${b.ext}:${b.id}`))) {
      const evdBlob = extRefs.flatMap((b) => extTextMap.get(`${b.ext}:${b.id}`) ?? []).join('\n');
      const w43Reason = checkGhostW43(c.words.map((wd) => wd.text).join(' '), evdBlob);
      if (w43Reason) push('W43', `${w43Reason}(인용한 외부 근거와 대조 필요)`);
    }

    // 6. 프로파일별 규칙(본래 결 gyeol 대 산업 표준 론 lon)
    if (isLon) {
      const ev = c.marks.ev;
      if (ev && !LON_EV.has(ev)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 근거 표지 '${ev}'다(허용: see, rec, inf, gut, if)`);
      }
      if (c.marks.news) {
        push('E39', '론(Lon) 프로파일에서는 새로앎(new) 표지를 쓰지 않는다');
      }
      if (c.marks.fig && !LON_FIG.has(c.marks.fig)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 결 표지 '${c.marks.fig}'다(허용: lim)`);
      }
      if (c.marks.tense && !LON_TENSE.has(c.marks.tense)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 시제 표지 '${c.marks.tense}'다(허용: pst, fut)`);
      }
      const act = c.marks.act;
      if (act && !LON_ACT.has(act)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 화행 표지 '${act}'다(허용: say, ask, req, let, vow, nay, ack)`);
      }
      if (c.echo) {
        push('E39', '론(Lon) 프로파일에서는 받은대로 앞붙이를 쓰지 않는다(되짚음은 ↖N으로 쓴다)');
      }
      if (c.process && !LON_PROCESS.has(c.process.kind)) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 과정 앞붙이 '${c.process.kind}'다(허용: fix, err, sup)`);
      }
      if (c.place && (c.place.rel === '∥' || c.place.rel === '⊗')) {
        push('E39', `론(Lon) 프로파일에서 쓰지 않는 자리 앞붙이 '${c.place.rel}'다(허용: ↔, ↖, 끝 ↓)`);
      }
      if (w?.nonEnMarks?.length) {
        push('W26', `론(Lon) 프로파일에서는 영어 3글자 정본 표지로 고정해 쓴다(읽은 표지: ${w.nonEnMarks.join(', ')})`);
      }
    } else {
      if (INLINE_GLOSS.test(c.words.map((x) => x.text).join(' '))) {
        push('W32', '줄 안에 번역을 붙이지 않는다. 번역은 풀이에 쓰고, 결 줄에는 그 낱말만 쓴다');
      }
      if (group && !mixesScripts(c.words, group)) {
        push('W29', `어근이 둘 이상이면 적어도 하나는 사용자 언어(${lang})가 아닌 다른 글자군의 낱말로 쓴다(옮기면 뜻이 깎이는 낱말: Schadenfreude, 物の哀れ, 껄끄럽다, saudade)`);
      } else if (lang === 'ko' && group && !hasUserScript(c.words, group)) {
        push('W29', '사용자 언어(ko) 대화에서는 조사·어미·문장 뼈대를 한국어(한글)로 쓰고 다른 글자군 낱말을 섞는다');
      }
      const long = (w?.aliases ?? []).filter((a) => !SHORT_ALIASES_07.has(a) && !SHORT_ALIASES_07.has(a.toLowerCase()));
      if (long.length) {
        push('W26', `긴 별칭 ${long.join(', ')}을 표지로 읽었다(정규형은 ${long.map((a) => markOf07(a) ?? '?').join(', ')})`);
      }
    }
  }

  return out.sort((a, b) => a.line - b.line);
}
