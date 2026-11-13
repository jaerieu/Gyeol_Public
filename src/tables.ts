// 결 v0.8.2 — 표지, 별칭, 프로파일 기준값. spec/03-grammar.md.
// v0.8.2(2026-11-13): v0.2 한자 핵·조율·어조 테이블 제거, 현행 표지·열 언어 별칭·진단 전용 옛 표지(LEGACY_FULLNAME_MARKS·REMOVED_065_MARKS)로 정리.

import type { Act, Ev, Fig, ProcessKind, Tense } from './types.ts';

export const SPEC_VERSION = '0.8.2';

/** 이 구현이 경고 없이 읽는 판의 갈래(앞 두 자리). 그 밖의 판을 머리에 적으면 W14로 알린다. */
export const READ_FAMILIES = ['0.7', '0.8'] as const;

export const NEWS = '네';
export const NEWS_05 = '군';

/** 현행 표지 글자(한글 1음절, 붙여 쓴 겠다 나눌 때 사용). 들·늘·지·유·네는 진단 전용(E26)으로 분리했다. */
export const MARK_CHARS = new Set(['봄', '더', '겠', '촉', '면', '갑', '군', '한', '역', '비', '었', '을', '다', '까', '라', '자', '게', '거', '양']);

/** 정규 순서: 근거 0, 새로앎 1, 결 2, 시제 3, 화행 4. 벗어나면 W34. */
export const MARK_RANK = { ev: 0, news: 1, fig: 2, tense: 3, act: 4 } as const;

/** 다중 지목 ·→A,B의 이름 상한. 넘으면 W35. */
export const TO_MAX = 3;

/** 진단 전용(E26): 한글 풀네임 표지 + '네' + '자신'. */
export const LEGACY_FULLNAME_MARKS: ReadonlySet<string> = new Set([
  '관찰', '직접관찰', '회상', '전언', '추론', '관습', '직관', '가정', '상상',
  '새로앎', '단언', '물음', '확인물음', '청함', '제안', '약속',
  '새화두', '직감', '한계', '역설', '비유', '거절', '유보', '양보',
  '네', '자신',
]);

/** 진단 전용(E26): v0.6.5 사전에서 뺀 표지(한글·영어). */
export const REMOVED_065_MARKS: ReadonlySet<string> = new Set(['hrd', 'com', 'chk', 'dfr', '들', '늘', '지', '유']);

/**
 * 긴 표지 별칭(W26: 읽되 경고).
 * hear/heard/闻/聞/known/常/check은 v0.6.5에서 뺀 표지라 REMOVED_065_MARKS로 옮겼다.
 */
export const MARK_ALIASES_05: Record<string, string> = {
  see: '봄',
  见: '봄',
  見: '봄',
  recall: '더',
  忆: '더',
  憶: '더',
  infer: '겠',
  推: '겠',
  hunch: '촉',
  感: '촉',
  if: '면',
  若: '면',
  new: '군',
  新: '군',
  past: '었',
  过: '었',
  過: '었',
  will: '을',
  将: '을',
  將: '을',
  assert: '다',
  ask: '까',
  request: '라',
  suggest: '자',
  promise: '게',
};

/** v0.5 별칭을 찾는다(로마자는 작은 글자로 견준다). 없으면 undefined. */
export function markAlias05(t: string): string | undefined {
  return Object.hasOwn(MARK_ALIASES_05, t) ? MARK_ALIASES_05[t] : Object.hasOwn(MARK_ALIASES_05, t.toLowerCase()) ? MARK_ALIASES_05[t.toLowerCase()] : undefined;
}

export const RELATIONS = ['답', '동의', '반박', '확장', '수선'] as const;

/** 끝 묶음 확신 한 자리(0부터 9)의 가장 큰 값. */
export const DIGIT_MAX = 9;

// ───────── 내부 표지(영어)와 열 언어 별칭 ─────────

/** 한글 표지 글자 → 내부 영어 표지. */
export const MARK_KO2EN: Record<string, string> = {
  봄: 'see', 더: 'rec', 겠: 'inf', 촉: 'gut', 면: 'if', 갑: 'top',
  군: 'new',
  한: 'lim', 역: 'pdx', 비: 'met',
  었: 'pst', 을: 'fut',
  다: 'say', 까: 'ask', 라: 'req', 자: 'let', 게: 'vow', 거: 'nay', 양: 'ack',
};
/** 내부 영어 표지 → 한글 표지 글자. */
export const MARK_EN2KO: Record<string, string> = Object.fromEntries(Object.entries(MARK_KO2EN).map(([k, v]) => [v, k]));

export const EV_07: Partial<Record<Ev, string>> = { see: '직접 봄', rec: '떠올림', inf: '추론', gut: '직감', if: '가정', top: '새 화두' };
export const NEWS_07 = 'new' as const;
export const FIG_07: Record<Fig, string> = { lim: '한계', pdx: '역설', met: '비유' };
export const TENSE_07: Record<Tense, string> = { pst: '지난 일', fut: '앞일' };
export const ACT_07: Partial<Record<Act, string>> = { say: '단언', ask: '물음', req: '청함', let: '제안', vow: '약속', nay: '거절', ack: '양보' };
/** 영어 내부 정본 값 전부. */
export const MARKS_07 = new Set<string>([...Object.keys(EV_07), NEWS_07, ...Object.keys(FIG_07), ...Object.keys(TENSE_07), ...Object.keys(ACT_07)]);

/** 과정 앞붙이: 한글 → 영어(fix 고침, err 오류, sup 받침). */
export const PROCESS_KO2EN: Record<string, ProcessKind> = { 고침: 'fix', 오류: 'err', 받침: 'sup' };
/** 과정 앞붙이의 열 언어 별칭. */
export const PROCESS_ALIASES: Record<string, ProcessKind> = {
  ...PROCESS_KO2EN,
  kor: 'fix', feh: 'err', stu: 'sup',
  cor: 'fix', app: 'sup', sos: 'sup', apo: 'sup',
  исп: 'fix', оши: 'err', под: 'sup',
  改: 'fix', 误: 'err', 誤: 'err', 撑: 'sup', 撐: 'sup', 支: 'sup',
};
export const PROCESS_ALIAS_RE = [...new Set(['fix', 'err', 'sup', ...Object.keys(PROCESS_ALIASES)])].join('|');
export const PROCESS_EN2KO: Record<string, string> = { fix: '고침', err: '오류', sup: '받침' };

/**
 * 열 언어의 짧은 별칭(설계 3절 표). 열쇠는 쓴 글자(라틴은 작은 글자로 견준다), 값은 내부 영어 표지.
 * 고르는 규칙: 세 글자까지(한·두 글자도 된다). 온 낱말이 세 글자 이하면 그 낱말, 아니면 가장 널리 쓰는 낱말의 머리 세 글자. 한자권은 한두 글자, 일본어는 가나를 섞어 셋까지.
 * 한 별칭은 한 표지에만 간다(tests/v07-aliases.test.ts). 같은 어원의 라틴 다섯 언어는 같은 세 글자를 같은 표지로 둔다(inf lim met par pas fut sug con).
 */
export const MARK_ALIASES_07: Record<string, string> = {
  // 봄 see: sehen voir vedere ver видеть 见/見
  seh: 'see', voi: 'see', ved: 'see', ver: 'see', вид: 'see', 见: 'see', 見: 'see',
  // 더 rec: erinnern rappeler ricordare recordar помнить 忆/憶
  eri: 'rec', rap: 'rec', ric: 'rec', пом: 'rec', 忆: 'rec', 憶: 'rec',
  // 겠 inf: folgern inférer inferire inferir вывод 推
  fol: 'inf', выв: 'inf', 推: 'inf',
  // 촉 gut: Ahnung intuition intuito intuición чутьё 感
  ahn: 'gut', int: 'gut', чут: 'gut', 感: 'gut',
  // 면 if: wenn si se si если 若 もし
  wen: 'if', si: 'if', se: 'if', есл: 'if', 若: 'if', もし: 'if',
  // 갑 top: Thema sujet tema tema тема 题/題
  the: 'top', suj: 'top', tem: 'top', тем: 'top', 题: 'top', 題: 'top',
  // 군 new: neu nouveau nuovo nuevo новый 新
  neu: 'new', nou: 'new', nuo: 'new', nue: 'new', нов: 'new', 新: 'new',
  // 한 lim: Grenze limite limite límite предел 限
  gre: 'lim', пре: 'lim', 限: 'lim',
  // 역 pdx: Paradox paradoxe paradosso paradoja парадокс 悖 逆
  par: 'pdx', пар: 'pdx', 悖: 'pdx', 逆: 'pdx',
  // 비 met: Metapher métaphore metafora metáfora метафора 喻/喩
  мет: 'met', 喻: 'met', 喩: 'met',
  // 었 pst: war passé passato pasado было 过/過 た
  war: 'pst', pas: 'pst', был: 'pst', 过: 'pst', 過: 'pst', た: 'pst',
  // 을 fut: wird futur futuro futuro будет 将/將 未
  wir: 'fut', буд: 'fut', 将: 'fut', 將: 'fut', 未: 'fut',
  // 다 say: sagen dire dire decir утверждать 言
  sag: 'say', dir: 'say', dic: 'say', утв: 'say', 言: 'say',
  // 까 ask: fragen demander domandare preguntar спросить 问/問
  fra: 'ask', dem: 'ask', dom: 'ask', pre: 'ask', спр: 'ask', 问: 'ask', 問: 'ask',
  // 라 req: bitten prier chiedere pedir просить 请/請
  bit: 'req', pri: 'req', chi: 'req', pid: 'req', про: 'req', 请: 'req', 請: 'req',
  // 자 let: vorschlagen suggérer suggerire sugerir давай 提 (pro는 판 참가자 이름과 겹쳐 쓰지 않는다, 2026-10-29)
  vor: 'let', sug: 'let', дав: 'let', 提: 'let',
  // 게 vow: zusagen jurer giurare jurar обещать 约/約
  zus: 'vow', jur: 'vow', giu: 'vow', обе: 'vow', 约: 'vow', 約: 'vow',
  // 거 nay: ablehnen refuser rifiutare negar отказ 拒
  abl: 'nay', ref: 'nay', rif: 'nay', neg: 'nay', отк: 'nay', 拒: 'nay',
  // 양 ack: zugeben concéder concedere conceder признать 让/讓
  zug: 'ack', con: 'ack', при: 'ack', 让: 'ack', 讓: 'ack',
};

/** W26을 내지 않는 짧은 꼴: 영어 내부 값, 열 언어 별칭, 한글 표지 글자. 그 밖의 별칭(recall·assert·直観 …, MARK_ALIASES_05의 긴 낱말)은 rules07에서 완화된 W26 */
export const SHORT_ALIASES_07: ReadonlySet<string> = new Set([...MARKS_07, ...Object.keys(MARK_ALIASES_07), ...Object.keys(MARK_KO2EN)]);

/** 쓴 낱말을 내부 영어 표지로. 영어 내부 값·열 언어 별칭·한글 글자·v0.5 긴 별칭(MARK_ALIASES_05)을 본다. 없으면 undefined */
export function markOf07(t: string): string | undefined {
  if (MARKS_07.has(t)) return t;
  const low = t.toLowerCase();
  if (MARKS_07.has(low)) return low;
  if (Object.hasOwn(MARK_ALIASES_07, t)) return MARK_ALIASES_07[t];
  if (Object.hasOwn(MARK_ALIASES_07, low)) return MARK_ALIASES_07[low];
  if (Object.hasOwn(MARK_KO2EN, t)) return MARK_KO2EN[t];
  const a5 = markAlias05(t);
  return a5 === undefined ? undefined : MARK_KO2EN[a5];
}

/** 지원 언어(BCP 47)와 글자군. W29(다른 글자군 어근 하나)와 사전·풀이 고르기에 쓴다 */
export const LANGS_07 = ['ko', 'en', 'zh-Hans', 'zh-Hant', 'ja', 'de', 'fr', 'it', 'es', 'ru'] as const;
export type ScriptGroup = 'hangul' | 'latin' | 'cyrillic' | 'cjk';
const SCRIPT_OF_LANG: Record<string, ScriptGroup> = { ko: 'hangul', en: 'latin', de: 'latin', fr: 'latin', it: 'latin', es: 'latin', ru: 'cyrillic', 'zh-hans': 'cjk', 'zh-hant': 'cjk', zh: 'cjk', ja: 'cjk' };
/** 언어 값의 글자군. 모르는 언어면 undefined(W29를 재지 않는다, 공리 5) */
export function scriptGroupOf(lang: string | null | undefined): ScriptGroup | undefined {
  if (!lang) return undefined;
  return SCRIPT_OF_LANG[String(lang).toLowerCase()];
}
/** 글자 하나의 글자군. 글자가 아니면 undefined. 한자와 가나는 한 글자군(일본어 낱말은 둘을 섞어 쓴다) */
export function scriptGroupOfChar(ch: string): ScriptGroup | undefined {
  if (/\p{Script=Hangul}/u.test(ch)) return 'hangul';
  if (/\p{Script=Latin}/u.test(ch)) return 'latin';
  if (/\p{Script=Cyrillic}/u.test(ch)) return 'cyrillic';
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) return 'cjk';
  return undefined;
}

// ───────── v0.8 론(Lon: Lineage Oriented Notation, 2026-11-11 Jae) ─────────
// 교차 검증·분석·계보 추적 전용 경량 표준 프로파일.
// *먹채(색 뜻 미정의 원시 신호 보존)·gut(내재 이상 활성화 포착)·시제(pst·fut)·화행 7종·계보 앞붙이는 결(Gyeol)과 100% 공유하고,
// 광장 화두(top)·감탄(new)·시적 수사(met·pdx)·W29(다중 스크립트 어근)·W32(줄 안 풀이) 제약을 덜어낸다.
export const LON_EV: ReadonlySet<string> = new Set(['see', 'rec', 'inf', 'gut', 'if']);
export const LON_FIG: ReadonlySet<string> = new Set(['lim']);
export const LON_TENSE: ReadonlySet<string> = new Set(['pst', 'fut']);
export const LON_ACT: ReadonlySet<string> = new Set(['say', 'ask', 'req', 'let', 'vow', 'nay', 'ack']);
export const LON_MARKS: ReadonlySet<string> = new Set([...LON_EV, ...LON_FIG, ...LON_TENSE, ...LON_ACT]);
export const LON_PROCESS: ReadonlySet<string> = new Set(['fix', 'err', 'sup']);
