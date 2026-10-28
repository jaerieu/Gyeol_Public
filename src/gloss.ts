// 결 v0.3 — 표지 풀이표. spec/03-grammar.md 3.13절, 4.2(풀이).
// 표지·자리·자신·먹은 코드가 언어별 표로 옮긴다(한국어 먼저). 내용(한자 어근)은 읽는 모델이 옮긴다.
// v0.5.1(2026-10-16): ● 모두에게, 색이 있는 채(채 R8), 끝의 근거(절12 때문)를 더했다.
// v0.6(2026-10-24, 실험적): 새 화두(갑), 결 표지(한계·역설·비유), 화행 거절·유보·양보, 다중 지목, ⊗(양립 안 됨), 지난 대화의 절 근거.
// v0.6 덧붙임(2026-10-25 H-261025-8): 촉의 풀이를 직관에서 직감으로 바로잡았다(명세의 설계대로), 받침→N(직감을 뒤늦게 받침), 지난 대화의 절 가리킴(받침→53:12, ↔53:12).
// v0.5(2026-10-15): 시제 칸(었 지난 일, 을 앞일)을 더했다. 새로앎은 '네'든 '군'이든 같은 풀이(방금 앎)이고, 자신은 쓴 자리(괄호·끝의 !N)와 상관없이 같다.

import type { Because, Clause, Ref } from './types.ts';
import { toDigit } from './format.ts';

export interface GlossTable {
  ev: Record<string, string>;
  news: string;
  /** v0.5 시제 */
  tense: Record<string, string>;
  /** v0.6 결 표지 */
  fig: Record<string, string>;
  act: Record<string, string>;
  /** 앞붙이. N은 가리킨 절 이름(절1), X는 받는 이름 */
  place: Record<string, string>;
  process: Record<string, string>;
  to: string;
  echo: string;
  self: string;
  muk: string;
  /** v0.5.1: ● 모두에게, 색이 있는 채, 끝의 근거(N은 절 이름, 주소는 '주소') */
  all: string;
  chae: string;
  because: string;
  /** v0.6 ⊗N,M: N·M은 가리킨 두 절 이름 */
  clash: string;
  /** v0.6 지난 대화의 절: T는 대화 번호, N은 절 이름 */
  past: string;
  joiner: string;
}

export const GLOSS: Record<string, GlossTable> = {
  ko: {
    ev: { 봄: '직접 봄', 더: '떠올림', 들: '전해 들음', 겠: '추론', 늘: '널리 아는 앎', 촉: '직감', 면: '가정', 갑: '새 화두' },
    news: '방금 앎',
    tense: { 었: '지난 일', 을: '앞일' },
    fig: { 한: '한계', 역: '역설', 비: '비유' },
    act: { 다: '단언', 까: '물음', 지: '확인 물음', 라: '청함', 자: '제안', 게: '약속', 거: '거절', 유: '유보', 양: '양보' },
    place: { '↓': 'N 아래(근거)', '↔': 'N에 맞섬', '∥': 'N 옆(버린 대안)', '↖': 'N 되물음' },
    process: { 숙고: '생각 중', 미해결: '풀리지 않음', 고침: 'N 고침', 오류: 'N 틀림', 받침: 'N 받침(직감을 뒤늦게 받침)' },
    to: 'X에게',
    echo: '받은 대로 되짚음',
    self: '자신',
    muk: '먹',
    all: '모두에게',
    chae: '채',
    because: 'N 때문(근거)',
    clash: 'N과 M이 양립하지 않음',
    past: '대화T의 N',
    joiner: ' · ',
  },
};

/** 끝의 근거 이름: 주소, 시험 문제 Q3, 참가자 kimi(2026-10-16), 절 */
const becauseName = (b: Because, g: GlossTable) =>
  'url' in b ? '주소' : 'quiz' in b ? `문제 Q${b.quiz}` : 'agent' in b ? b.agent : 'thread' in b ? g.past.replace('T', String(b.thread)).replace('N', b.clause) : refName(b);
const refName = (r: Ref) => (r.msg ? `#${r.msg.slice(0, 6)}:` : '') + r.label;

/**
 * 절 하나의 표지 풀이: 앞붙이 · 근거 · 새로앎 · 시제 · 화행 · 자신 N · 먹 N.
 * 예: <절2 ↓1 →kimi [겠,다(6)] …> → "절1 아래(근거) · kimi에게 · 추론 · 단언 · 자신 6"
 */
export function glossClause(c: Clause, lang = 'ko'): string {
  const g = GLOSS[lang] ?? GLOSS.ko;
  const out: string[] = [];
  if (c.echo) out.push(g.echo);
  if (c.all) out.push(g.all);
  const name = (r: Ref) => (r.thread !== undefined ? g.past.replace('T', String(r.thread)).replace('N', r.label) : refName(r)); // 지난 대화의 절(받침→53:12, ↔53:12)
  if (c.process) out.push(g.process[c.process.kind].replace('N', c.process.target ? name(c.process.target) : ''));
  if (c.place?.rel === '⊗') out.push(g.clash.replace('N', refName(c.place.target)).replace('M', c.place.second ? refName(c.place.second) : ''));
  else if (c.place) out.push(g.place[c.place.rel].replace('N', name(c.place.target)));
  if (c.to) out.push(g.to.replace('X', c.toList?.length ? c.toList.join(', ') : c.to));
  if (c.marks.ev) out.push(g.ev[c.marks.ev]);
  if (c.marks.news) out.push(g.news);
  if (c.marks.fig) out.push(g.fig[c.marks.fig]);
  if (c.marks.tense) out.push(g.tense[c.marks.tense]);
  if (c.marks.act) out.push(g.act[c.marks.act]);
  if (c.chae?.self !== undefined) out.push(c.chae.color ? `${g.chae} ${c.chae.color}${toDigit(c.chae.self)}` : `${g.self} ${toDigit(c.chae.self)}`);
  if (c.muk?.conf !== undefined) out.push(`${g.muk} ${toDigit(c.muk.conf)}`);
  for (const b of c.because ?? []) out.push(g.because.replace('N', becauseName(b, g)));
  return out.join(g.joiner);
}
