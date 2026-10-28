// 결 v0.3 — 표지, 별칭, 어조 기준값. spec/03-grammar.md 3.3절, spec/06-expression.md 6.1절.
// v0.5(2026-10-15): 새로앎 '군', 시제 '었'·'을', 표지 별칭(MARK_ALIASES_05), 내용 길이 경고의 어절 수. spec/03-grammar.md 3.14절.
// v0.6(2026-10-24, 실험적, reports/v0.6-design.md 1.2): 근거 '갑', 결 표지 '한'·'역'·'비', 화행 '거'·'유'·'양', 정규 순서(MARK_RANK), 다중 지목 상한(TO_MAX). 3.18절.

import type { Act, Ev, Fig, Tense } from './types.ts';

export const SPEC_VERSION = '0.3';

/**
 * 이 구현이 경고 없이 읽는 판의 갈래(앞 두 자리). v0.3은 v0.2·v0.2.1에서 맞던 줄을 모두 그대로 읽는다.
 * 그 밖의 판(0.1 등)을 머리에 적으면 W14로 알린다.
 */
export const READ_FAMILIES = ['0.2', '0.3'] as const;

export const EVIDENTIALS: Record<Exclude<Ev, '갑'>, string> = {
  봄: '직접 관찰',
  더: '회상',
  들: '전언',
  겠: '추론',
  늘: '관습',
  촉: '직감', // 2026-10-25 H-261025-8: 명세의 설계(구어 '촉', hunch)대로 직관에서 바로잡았다. 글자의 판정은 그대로
  면: '가정·상상',
};

/**
 * v0.6(2026-10-24): 새 꼴(꺾쇠 줄꼴)의 근거. 갑 = 앞의 어떤 절에도 기대지 않는 새 화두. 정의는 기원(문득 떠오름, 확인할 수 없는 자기 보고)이
 * 아니라 기능이다(reports/v0.6-design.md 1.2). 옛 꼴(v0.2.1, src/parse/v02.ts)은 EVIDENTIALS 그대로 읽는다(옛 꼴 읽기는 바꾸지 않는다).
 */
export const EVIDENTIALS_06: Record<Ev, string> = { ...EVIDENTIALS, 갑: '새 화두' };

export const NEWS = '네';

/**
 * v0.5(2026-10-15, reports/v0.5-design.md 1.1): 새로앎의 새 글자 '군'(한국어 '-군/-구나'의 깨달음). 뜻은 '네'와 같다(틀의 news).
 * '네'는 대답과 헷갈려(쪽지 시험·광장에서 거듭) 바꾼다. 옛 줄의 '네'는 그대로 읽고, 새로 쓰는 줄의 '네'는 rules05의 E30이다.
 */
export const NEWS_05 = '군';

/** v0.5 시제 칸(닫힌 목록, 하나까지): 었 = 지난 일, 을 = 앞일. 없으면 지금이거나 시제를 따지지 않음. */
export const TENSES: Record<Tense, string> = {
  었: '지난 일',
  을: '앞일',
};

/** v0.6 결 표지(하나까지, E36). 정규 자리는 군 뒤 시제 앞: [근거,군,결,시제,화행] */
export const FIGURES: Record<Fig, string> = {
  한: '한계',
  역: '역설',
  비: '비유',
};

/**
 * 표지 글자 한 자씩. v0.3의 표지 블록 [ ]에서 붙여 쓴 것(겠다)을 나눌 때 쓴다.
 * v0.5(2026-10-15): 새로앎 '군'과 시제 '었'·'을'을 더했다. 옛 꼴(v0.2.1)의 〈 〉 읽기는 이 표를 쓰지 않는다(판정 그대로).
 * v0.6(2026-10-24): 갑, 결 표지 한·역·비, 화행 거·유·양을 더했다(옛 줄에서는 모르는 표지 E05였던 글자다).
 */
export const MARK_CHARS = new Set(['봄', '더', '들', '겠', '늘', '촉', '면', '갑', '네', '군', '한', '역', '비', '었', '을', '다', '까', '지', '라', '자', '게', '거', '유', '양']);

/**
 * v0.6 정규 순서(2026-10-24 Jae: 지금 순서 그대로, 결 표지만 군과 시제 사이에): 근거 0, 새로앎 1, 결 2, 시제 3, 화행 4.
 * 쓴 차례가 이 순서를 벗어나면 새로 쓰는 줄에만 rules06 W34(읽기·정규형은 그대로).
 */
export const MARK_RANK = { ev: 0, news: 1, fig: 2, tense: 3, act: 4 } as const;

/** v0.6 다중 지목 ·→A,B의 이름 상한(reports/v0.6-design.md 1.1). 넘으면 rules06 W35. 셋을 넘으면 지목보다 모두에게(●)에 가깝다 */
export const TO_MAX = 3;

export const ACTS: Record<Exclude<Act, '거' | '유' | '양'>, string> = {
  다: '단언',
  까: '물음',
  지: '확인 물음',
  라: '청함',
  자: '제안',
  // v0.2.1(2026-10-14 광장 상의 1): 약속 화행. 겠(추론)을 '하겠다'는 약속으로 쓰던 것을 가른다.
  게: '약속',
};

/** v0.6(2026-10-24 Jae): 새 꼴의 화행. 거 = 부탁을 거절, 유 = 응답을 미룸, 양 = 상대 논점을 인정. 옛 꼴은 ACTS 그대로 */
export const ACTS_06: Record<Act, string> = { ...ACTS, 거: '거절', 유: '유보', 양: '양보' };

/** 표지 이름을 표지 글자로 바꾸는 별칭. 초안의 〔추론·새로앎·단언〕 표기를 받아들이기 위함. */
export const MARK_ALIASES: Record<string, string> = {
  관찰: '봄',
  직접관찰: '봄',
  회상: '더',
  전언: '들',
  추론: '겠',
  관습: '늘',
  직관: '촉',
  가정: '면',
  상상: '면',
  새로앎: '네',
  단언: '다',
  물음: '까',
  확인물음: '지',
  청함: '라',
  제안: '자',
  약속: '게',
};

/** v0.6(2026-10-24): 새 표지의 이름(W11). 새 꼴의 표지 블록에서만 읽는다(옛 꼴과 옛 줄에서는 E05였던 이름이다) */
export const MARK_ALIASES_06: Record<string, string> = {
  ...MARK_ALIASES,
  새화두: '갑',
  // 2026-10-25 H-261025-8: 촉의 풀이 '직감'도 표지 이름으로 읽는다(새 꼴에서만, W11). 옛 이름 '직관'은 MARK_ALIASES에 그대로 둔다(흔적).
  // 옛 꼴(v0.2.1)의 MARK_ALIASES에 넣으면 옛 꼴 〈직감·다〉의 판정(E05)이 바뀌므로 넣지 않는다
  직감: '촉',
  한계: '한',
  역설: '역',
  비유: '비',
  거절: '거',
  유보: '유',
  양보: '양',
};

/**
 * v0.5 표지 별칭(2026-10-15, reports/v0.5-design.md 1.1): 새 꼴 줄의 표지 칸 [ ] 안에서만 같은 표지로 읽고, 정규형은 한글로 쓴다.
 * 읽기에서는 진단이 없고, 새로 쓰는 줄에는 rules05가 W26으로 알린다('표지는 한글로 쓴다'). 로마자는 큰 글자·작은 글자를 가리지 않는다.
 * 위의 MARK_ALIASES(표지 이름, W11)와 따로 둔다: 그것은 옛 줄에서도 읽던 것이고, 이것은 v0.4까지 E05이던 것이다.
 */
export const MARK_ALIASES_05: Record<string, string> = {
  see: '봄',
  见: '봄',
  見: '봄',
  recall: '더',
  忆: '더',
  憶: '더',
  hear: '들',
  heard: '들',
  闻: '들',
  聞: '들',
  infer: '겠',
  推: '겠',
  known: '늘',
  常: '늘',
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
  check: '지',
  request: '라',
  suggest: '자',
  promise: '게',
};

/** v0.5 별칭을 찾는다(로마자는 작은 글자로 견준다). 없으면 undefined. */
export function markAlias05(t: string): string | undefined {
  return Object.hasOwn(MARK_ALIASES_05, t) ? MARK_ALIASES_05[t] : Object.hasOwn(MARK_ALIASES_05, t.toLowerCase()) ? MARK_ALIASES_05[t.toLowerCase()] : undefined;
}

/** v0.5 쓰기 규칙(rules05): 절 하나의 내용이 이 어절 수를 넘으면 W27. 수는 광장 데이터로 다시 정한다(설계 1.3). */
// 2026-10-16 Jae: 12어절은 너무 짧아 답이 단편적이었다. 24어절까지(W27).
export const CONTENT_WORDS_MAX = 24;

/** 어조 낱말이 드러내는 확신의 기준값 [설계]. */
export const TONE_CONFIDENCE: Record<string, number> = {
  단호: 0.9,
  담담: 0.7,
  조심: 0.45,
  망설임: 0.3,
  의심: 0.15,
};

/** 정동 낱말(기준값 없음). 6.2절. */
export const AFFECT_WORDS = ['긴장', '해소', '배려', '경고'];

export const MUK_KEYS = ['대안', '확신', '노력', '주의', '특징'] as const;
export const MUK_FIELD: Record<string, string> = {
  대안: 'alt',
  확신: 'conf',
  노력: 'effort',
  주의: 'attn',
  특징: 'feat',
};

export const CHAE_NUMERIC = ['자신', '전함'] as const;

export const RELATIONS = ['답', '동의', '반박', '확장', '수선'] as const;

export const LINE_KEYWORDS = ['조율', '머리말', '받은대로', '덧글', '낙관'] as const;

/** v0.3 줄꼴에서 자신·먹 한 자리(0~9)의 가장 큰 값. */
export const DIGIT_MAX = 9;

export const TUNE_STEPS = ['신원', '사전', '용어', '시험', '답', '풀이', '정답', '일치', '척도', '접힘', '다시', '맥놀이'] as const;

/** 측정법 식별자. se 뒤에는 표본 수가 붙는다(se8). */
export const MEASURE_METHODS = /^(se\d+|lp|토큰|지연|귀속|특징)$/;
export const FORBIDDEN_MUK_METHOD = '자기';

/** 노력 정규화 기준값. 5.4절. */
export const EFFORT_T0 = { 토큰: 1000, 지연: 10000 } as const;

/** 화음 판정 경계. 6.4절. */
export const HARMONY_BANDS = { consonant: 0.2, dissonant: 0.4 } as const;

/** 접는 수준 경계. 7.4절. */
export const FOLD_BANDS = { 점: 0.9, 절: 0.6 } as const;

/** 대안음 음정 경계(확률 비 p2/p1). 8.3절. */
export const INTERVAL_BANDS = { clash: 0.5, tension: 0.25 } as const;
