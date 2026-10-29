// 결 v0.3 — 표지, 별칭, 어조 기준값. spec/03-grammar.md 3.3절, spec/06-expression.md 6.1절.
// v0.5(2026-10-15): 새로앎 '군', 시제 '었'·'을', 표지 별칭(MARK_ALIASES_05), 내용 길이 경고의 어절 수. spec/03-grammar.md 3.14절.
// v0.6(2026-10-24, 실험적, reports/v0.6-design.md 1.2): 근거 '갑', 결 표지 '한'·'역'·'비', 화행 '거'·'유'·'양', 정규 순서(MARK_RANK), 다중 지목 상한(TO_MAX). 3.18절.
// v0.7(2026-10-29 Jae, reports/v0.7-design.md 3절): 내부 표지(틀·정규형·먹 이름)는 영어 세 글자까지(see·inf·say …)다. 한글 표지는 첫째 별칭 묶음으로 영원히 읽고,
//   열 언어(ko en zh-Hans zh-Hant ja de fr it es ru)의 짧은 별칭을 한 표에서 읽는다(한 별칭 한 표지, tests/v07-aliases.test.ts). 아래 한글 열쇠 표(EVIDENTIALS·ACTS …)는
//   옛 꼴(v0.2.1) 읽기와 옛 꼴로 되돌려 쓰기(format form '0.2')에만 쓰고, 읽은 값은 MARK_KO2EN으로 영어 내부 값이 된다. 3.19절.

import type { Act, Ev, Fig, ProcessKind, Tense } from './types.ts';

export const SPEC_VERSION = '0.7';

/**
 * 이 구현이 경고 없이 읽는 판의 갈래(앞 두 자리). v0.3은 v0.2·v0.2.1에서 맞던 줄을 모두 그대로 읽는다.
 * 그 밖의 판(0.1 등)을 머리에 적으면 W14로 알린다.
 */
export const READ_FAMILIES = ['0.2', '0.3', '0.7'] as const;

export const EVIDENTIALS: Record<string, string> = {
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
export const EVIDENTIALS_06: Record<string, string> = { ...EVIDENTIALS, 갑: '새 화두' };

export const NEWS = '네';

/**
 * v0.5(2026-10-15, reports/v0.5-design.md 1.1): 새로앎의 새 글자 '군'(한국어 '-군/-구나'의 깨달음). 뜻은 '네'와 같다(틀의 news).
 * '네'는 대답과 헷갈려(쪽지 시험·광장에서 거듭) 바꾼다. 옛 줄의 '네'는 그대로 읽고, 새로 쓰는 줄의 '네'는 rules05의 E30이다.
 */
export const NEWS_05 = '군';

/** v0.5 시제 칸(닫힌 목록, 하나까지): 었 = 지난 일, 을 = 앞일. 없으면 지금이거나 시제를 따지지 않음. */
export const TENSES: Record<string, string> = {
  었: '지난 일',
  을: '앞일',
};

/** v0.6 결 표지(하나까지, E36). 정규 자리는 군 뒤 시제 앞: [근거,군,결,시제,화행] */
export const FIGURES: Record<string, string> = {
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

export const ACTS: Record<string, string> = {
  다: '단언',
  까: '물음',
  지: '확인 물음',
  라: '청함',
  자: '제안',
  // v0.2.1(2026-10-14 광장 상의 1): 약속 화행. 겠(추론)을 '하겠다'는 약속으로 쓰던 것을 가른다.
  게: '약속',
};

/** v0.6(2026-10-24 Jae): 새 꼴의 화행. 거 = 부탁을 거절, 유 = 응답을 미룸, 양 = 상대 논점을 인정. 옛 꼴은 ACTS 그대로 */
export const ACTS_06: Record<string, string> = { ...ACTS, 거: '거절', 유: '유보', 양: '양보' };

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

// ───────── v0.7 내부 표지(영어)와 열 언어 별칭 (2026-10-29, reports/v0.7-design.md 3절) ─────────

/** 한글 표지 글자 → 내부 영어 표지. 새로앎은 네·군 모두 new. 읽기(옛 꼴·새 꼴 모두)가 쓴다 */
export const MARK_KO2EN: Record<string, string> = {
  봄: 'see', 더: 'rec', 들: 'hrd', 겠: 'inf', 늘: 'com', 촉: 'gut', 면: 'if', 갑: 'top',
  네: 'new', 군: 'new',
  한: 'lim', 역: 'pdx', 비: 'met',
  었: 'pst', 을: 'fut',
  다: 'say', 까: 'ask', 지: 'chk', 라: 'req', 자: 'let', 게: 'vow', 거: 'nay', 유: 'dfr', 양: 'ack',
};
/** 내부 영어 표지 → 한글 표지 글자(옛 꼴로 되돌려 쓸 때, 풀이의 한글 이름). new는 군 */
export const MARK_EN2KO: Record<string, string> = Object.fromEntries(Object.entries(MARK_KO2EN).filter(([k]) => k !== '네').map(([k, v]) => [v, k]));

/** v0.7 근거(내부 영어). hrd(들)·com(늘)은 v0.6.5 사전에서 뺀 것이라 읽기만 한다(W37) */
export const EV_07: Record<Ev, string> = { see: '직접 봄', rec: '떠올림', hrd: '전해 들음', inf: '추론', com: '널리 아는 앎', gut: '직감', if: '가정', top: '새 화두' };
export const NEWS_07 = 'new' as const;
export const FIG_07: Record<Fig, string> = { lim: '한계', pdx: '역설', met: '비유' };
export const TENSE_07: Record<Tense, string> = { pst: '지난 일', fut: '앞일' };
/** v0.7 화행. chk(지)·dfr(유)는 v0.6.5 사전에서 뺀 것이라 읽기만 한다(W37) */
export const ACT_07: Record<Act, string> = { say: '단언', ask: '물음', chk: '확인 물음', req: '청함', let: '제안', vow: '약속', nay: '거절', dfr: '유보', ack: '양보' };
/** 영어 내부 값 전부(한 표지 한 글자가 아니라 세 글자까지의 낱말이다) */
export const MARKS_07 = new Set<string>([...Object.keys(EV_07), NEWS_07, ...Object.keys(FIG_07), ...Object.keys(TENSE_07), ...Object.keys(ACT_07)]);

/** 과정 앞붙이: 한글 → 영어(fix 고침, err 오류, sup 받침). 숙고·미해결은 v0.6.5에서 뺀 것이라 한글 그대로 읽기만 한다 */
export const PROCESS_KO2EN: Record<string, ProcessKind> = { 고침: 'fix', 오류: 'err', 받침: 'sup' };
/**
 * 과정 앞붙이의 열 언어 별칭(2026-10-29 Jae: 표지처럼 앞붙이도 그 대화의 언어로 쓴다). 한글이 첫째 별칭, 내부 값은 영어 그대로(정규형·먹 이름 불변).
 * 세 글자까지(한자는 한 글자). 한 별칭은 한 앞붙이에만 간다. fr·it·es의 cor·err처럼 겹치는 별칭은 같은 뜻이라 함께 둔다. 쓰는 쪽 표는 site/src/marks-i18n.js PREFIX_WORDS(이 표와 시험으로 맞춘다).
 */
export const PROCESS_ALIASES: Record<string, ProcessKind> = {
  ...PROCESS_KO2EN,
  // de: korrigieren · Fehler · stützen
  kor: 'fix', feh: 'err', stu: 'sup',
  // fr·it·es: corriger/correggere/corregir · erreur/errore/error · appuyer / sostenere / apoyar
  cor: 'fix', app: 'sup', sos: 'sup', apo: 'sup',
  // ru: исправить · ошибка · поддержать
  исп: 'fix', оши: 'err', под: 'sup',
  // zh-Hans · zh-Hant · ja
  改: 'fix', 误: 'err', 誤: 'err', 撑: 'sup', 撐: 'sup', 支: 'sup',
};
/** 앞붙이 별칭을 읽는 정규식 조각: (고침|오류|받침|fix|err|sup|kor|…) */
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
  // 자 let: vorschlagen suggérer suggerire sugerir давай 提 (pro는 광장 참가자 이름과 겹쳐 쓰지 않는다, 2026-10-29)
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
