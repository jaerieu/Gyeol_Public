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

import type { Clause, Diagnostic, ParseResult, Profile } from '../types.ts';
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
} from '../tables.ts';
import { removedMarks065 } from './v065.ts';
import { hasUserScript, mixesScripts } from './v07.ts';

export interface Rules08Options {
  sender?: string | null;
  from?: number;
  lang?: string | null;
  ink?: number | null;
  profile?: Profile | null;
}

const INLINE_GLOSS = /[(（]\s*[a-z]{2}(?:\s*[)）]|\s+\p{Script=Hangul})/u;
const BACKABLE_EV: ReadonlySet<string> = new Set(['gut', 'top']);

function byNumber(clauses: Clause[]): Map<string, Clause> {
  const m = new Map<string, Clause>();
  clauses.forEach((c, i) => {
    const n = (c.label ?? `절${i + 1}`).slice(1);
    if (!m.has(n)) m.set(n, c);
  });
  return m;
}

function canonMarks(c: Clause): string {
  const m = c.marks;
  return `[${[m.ev, m.news ? 'new' : undefined, m.fig, m.tense, m.act].filter(Boolean).join(',')}]`;
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
  const nums = byNumber(clauses);

  for (let k = opts.from ?? 0; k < clauses.length; k++) {
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
    } else if (c.all && !w?.hasDot) {
      push('E25', '점(·) 자리가 빠졌다. v0.8에서는 모두에게 말할 때도 절 번호 바로 뒤에 · ●로 고정해 쓴다');
    }

    // 2. 받는 이 검사(자기 지목 W23, 다중 지목 W35)
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

    // 3. 옛 표기 정리(E30, W24, W31, W34)
    if (w?.ne) push('E30', '새로앎에 옛 글자 네는 쓰지 않는다. new(군)로 쓴다');
    else if (w?.neLabel) push('E30', "표지 이름 '새로앎'은 쓰지 않는다. new(군)로 쓴다");
    if (w?.selfInMarks) push('W24', '괄호 수는 먹 자리다. 채와 확신은 끝에 *먹채로 쓴다');
    if (w?.frontBecause) push('W31', '근거는 끝 묶음 뒤에 쓴다: *5B8↓N');
    if (w?.marksOff) push('W34', `표지는 정규 순서 [근거,군,결,시제,화행]로 쓴다(뜻은 그대로 읽었다). 정규형은 ${canonMarks(c)}`);

    // 4. *먹채(E33) 및 먹 누락(W38) — 결·론 공통 필수(채 색의 뜻은 절대 정의하지 않음)
    if (c.chae?.color === undefined) {
      push('E33', '채는 꼭 쓴다: 색 하나(RGBCMYK)와 확신(0부터 9)을 끝에 *R8처럼 쓴다');
    } else if (inkKnown && c.muk?.conf === undefined) {
      push('W38', `먹을 빠뜨렸다. 먹은 바깥에서 잰 신용 점수라 받은 그대로 쓴다: *${ink}`);
    }

    // 5. 근거 자격(E34: gut만 금지, top은 허용) 및 받침 대상(W36: gut·top)
    const grounds = [...(c.because ?? []).filter((b) => 'label' in b), ...(c.place?.rel === '↓' ? [c.place.target] : [])];
    for (const g of grounds) {
      if (g.msg !== null) continue;
      const t = nums.get(g.label.slice(1));
      if (t && t !== c && t.marks.ev === 'gut') {
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
      for (const g of removedMarks065(c)) {
        push('W37', `v0.6.5 사전에서 뺀 것이다(뜻은 그대로 읽었다): ${g.what}. ${g.hint}`);
      }
    }
  }

  return out.sort((a, b) => a.line - b.line);
}
