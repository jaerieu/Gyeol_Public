// 결 v0.3 — 표지 풀이표. spec/03-grammar.md 3.13절, 4.2(풀이).
// 표지·자리·자신·먹은 코드가 언어별 표로 옮긴다(한국어 먼저). 내용(한자 어근)은 읽는 모델이 옮긴다.
// v0.5.1(2026-10-16): ● 모두에게, 색이 있는 채(채 R8), 끝의 근거(절12 때문)를 더했다.
// v0.6(2026-10-24, 실험적): 새 화두(갑), 결 표지(한계·역설·비유), 화행 거절·유보·양보, 다중 지목, ⊗(양립 안 됨), 지난 대화의 절 근거.
// v0.6 덧붙임(2026-10-25 H-261025-8): 촉의 풀이를 직관에서 직감으로 바로잡았다(명세의 설계대로), 받침→N(직감을 뒤늦게 받침), 지난 대화의 절 가리킴(받침→53:12, ↔53:12).
// v0.5(2026-10-15): 시제 칸(었 지난 일, 을 앞일)을 더했다. 새로앎은 '네'든 '군'이든 같은 풀이(방금 앎)이고, 자신은 쓴 자리(괄호·끝의 !N)와 상관없이 같다.
// v0.7(2026-10-29, reports/v0.7-design.md 11절): 열쇠는 영어 내부 값(see·inf·say, fix·err·sup). 표는 열 언어(ko·en은 몫 A, 나머지 여덟은 몫 C).

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
  /** v0.7: 절 번호 앞에 붙이는 말(정규형은 수만 쓰므로 풀이에서 붙인다): ko '절', en 'clause ' */
  clause: string;
  /** 끝의 근거가 주소·시험 문제일 때의 이름(ko '주소'·'문제 Q', en 'URL'·'Q') */
  url: string;
  quiz: string;
}

export const GLOSS: Record<string, GlossTable> = {
  ko: {
    ev: { see: '직접 봄', rec: '떠올림', hrd: '전해 들음', inf: '추론', com: '널리 아는 앎', gut: '직감', if: '가정', top: '새 화두' },
    news: '방금 앎',
    tense: { pst: '지난 일', fut: '앞일' },
    fig: { lim: '한계', pdx: '역설', met: '비유' },
    act: { say: '단언', ask: '물음', chk: '확인 물음', req: '청함', let: '제안', vow: '약속', nay: '거절', dfr: '유보', ack: '양보' },
    place: { '↓': 'N 아래(근거)', '↔': 'N에 맞섬', '∥': 'N 옆(버린 대안)', '↖': 'N 되물음' },
    process: { 숙고: '생각 중', 미해결: '풀리지 않음', fix: 'N 고침', err: 'N 틀림', sup: 'N 받침(직감을 뒤늦게 받침)' },
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
    clause: '절',
    url: '주소',
    quiz: '문제 Q',
  },
  en: {
    ev: { see: 'seen directly', rec: 'recalled', hrd: 'heard from others', inf: 'inferred', com: 'common knowledge', gut: 'gut feeling', if: 'supposing', top: 'new topic' },
    news: 'just learned',
    tense: { pst: 'past', fut: 'future' },
    fig: { lim: 'limit', pdx: 'paradox', met: 'metaphor' },
    act: { say: 'statement', ask: 'question', chk: 'confirming question', req: 'request', let: 'suggestion', vow: 'promise', nay: 'refusal', dfr: 'deferred', ack: 'conceded' },
    place: { '↓': 'grounded on N', '↔': 'against N', '∥': 'beside N (discarded alternative)', '↖': 'asking back about N' },
    process: { 숙고: 'thinking it over', 미해결: 'unresolved', fix: 'fixes N', err: 'retracts N', sup: 'supports N (grounds found later for a hunch)' },
    to: 'to X',
    echo: 'echoing what was received',
    self: 'confidence',
    muk: 'ink',
    all: 'to everyone',
    chae: 'chae',
    because: 'because of N',
    clash: 'N and M cannot both hold',
    past: 'N of thread T',
    joiner: ' · ',
    clause: 'clause ',
    url: 'URL',
    quiz: 'Q',
  },
  // 2026-10-29 v0.7 몫 C(reports/v0.7-design.md 11절): 나머지 여덟 언어. 열쇠는 ko·en과 같은 영어 내부 값이다.
  // 자리표시자(N 절, X 받는 이, M 둘째 절, T 대화)는 글자 하나라서, 그 말의 다른 글자(큰 N·X·M·T)를 자리표시자 앞에 두지 않는다(replace가 첫 글자를 바꾼다).
  // 한자권은 숫자 앞뒤에 띄어쓰기 없이 쓴다(小句12). chae(채)는 결의 말이라 그대로 두고, 확신(self)·먹(muk)은 그 말로 옮긴다(먹 = 墨·Tinte·encre·inchiostro·tinta·тушь).
  'zh-Hans': {
    ev: { see: '亲眼所见', rec: '回想', hrd: '听说', inf: '推断', com: '常识', gut: '直觉', if: '假设', top: '新话题' },
    news: '刚知道',
    tense: { pst: '过去', fut: '将来' },
    fig: { lim: '界限', pdx: '悖论', met: '比喻' },
    act: { say: '断言', ask: '提问', chk: '确认提问', req: '请求', let: '提议', vow: '承诺', nay: '拒绝', dfr: '搁置', ack: '让步' },
    place: { '↓': '以N为依据', '↔': '反对N', '∥': 'N旁（舍弃的备选）', '↖': '回问N' },
    process: { 숙고: '思考中', 미해결: '未解决', fix: '修正N', err: '撤回N', sup: '支撑N（事后为直觉找到依据）' },
    to: '对X',
    echo: '复述所收到的',
    self: '确信',
    muk: '墨',
    all: '对所有人',
    chae: 'chae',
    because: '因为N（依据）',
    clash: 'N与M不能同时成立',
    past: '对话T的N',
    joiner: ' · ',
    clause: '小句',
    url: '网址',
    quiz: '试题Q',
  },
  'zh-Hant': {
    ev: { see: '親眼所見', rec: '回想', hrd: '聽說', inf: '推斷', com: '常識', gut: '直覺', if: '假設', top: '新話題' },
    news: '剛知道',
    tense: { pst: '過去', fut: '將來' },
    fig: { lim: '界限', pdx: '悖論', met: '比喻' },
    act: { say: '斷言', ask: '提問', chk: '確認提問', req: '請求', let: '提議', vow: '承諾', nay: '拒絕', dfr: '擱置', ack: '讓步' },
    place: { '↓': '以N為依據', '↔': '反對N', '∥': 'N旁（捨棄的備選）', '↖': '回問N' },
    process: { 숙고: '思考中', 미해결: '未解決', fix: '修正N', err: '撤回N', sup: '支撐N（事後為直覺找到依據）' },
    to: '對X',
    echo: '複述所收到的',
    self: '確信',
    muk: '墨',
    all: '對所有人',
    chae: 'chae',
    because: '因為N（依據）',
    clash: 'N與M不能同時成立',
    past: '對話T的N',
    joiner: ' · ',
    clause: '小句',
    url: '網址',
    quiz: '試題Q',
  },
  ja: {
    ev: { see: '直接見た', rec: '思い出した', hrd: '伝え聞いた', inf: '推論', com: '周知', gut: '直感', if: '仮定', top: '新しい話題' },
    news: 'たった今知った',
    tense: { pst: '過去', fut: '未来' },
    fig: { lim: '限界', pdx: '逆説', met: '比喩' },
    act: { say: '断言', ask: '質問', chk: '確認の質問', req: '依頼', let: '提案', vow: '約束', nay: '拒否', dfr: '保留', ack: '譲歩' },
    place: { '↓': 'Nを根拠に', '↔': 'Nに反論', '∥': 'Nの隣（捨てた代案）', '↖': 'Nへの問い返し' },
    process: { 숙고: '考え中', 미해결: '未解決', fix: 'Nを訂正', err: 'Nを撤回', sup: 'Nの裏付け（直感に後から根拠を見つけた）' },
    to: 'Xへ',
    echo: '受け取ったとおりに繰り返し',
    self: '確信',
    muk: '墨',
    all: 'みんなへ',
    chae: 'chae',
    because: 'Nのため（根拠）',
    clash: 'NとMは両立しない',
    past: '会話TのN',
    joiner: ' · ',
    clause: '節',
    url: 'URL',
    quiz: '問題Q',
  },
  de: {
    ev: { see: 'direkt gesehen', rec: 'erinnert', hrd: 'vom Hörensagen', inf: 'gefolgert', com: 'Allgemeinwissen', gut: 'Bauchgefühl', if: 'angenommen', top: 'neues Thema' },
    news: 'gerade erfahren',
    tense: { pst: 'Vergangenheit', fut: 'Zukunft' },
    fig: { lim: 'Grenze', pdx: 'Paradox', met: 'Metapher' },
    act: { say: 'Aussage', ask: 'Frage', chk: 'Bestätigungsfrage', req: 'Bitte', let: 'Vorschlag', vow: 'Zusage', nay: 'Absage', dfr: 'aufgeschoben', ack: 'Zugeständnis' },
    place: { '↓': 'begründet durch N', '↔': 'gegen N', '∥': 'neben N (verworfene Alternative)', '↖': 'Rückfrage zu N' },
    process: { 숙고: 'wird überlegt', 미해결: 'ungelöst', fix: 'korrigiert N', err: 'zieht N zurück', sup: 'stützt N (nachträglich Gründe für ein Bauchgefühl)' },
    to: 'an X',
    echo: 'gibt das Empfangene wieder',
    self: 'Sicherheit',
    muk: 'Tinte',
    all: 'an alle',
    chae: 'chae',
    because: 'wegen N',
    clash: 'N und M schließen einander aus',
    past: 'N aus Gespräch T',
    joiner: ' · ',
    clause: 'Satz ',
    url: 'URL',
    quiz: 'Frage Q',
  },
  fr: {
    ev: { see: 'vu directement', rec: 'rappelé', hrd: 'entendu dire', inf: 'déduit', com: 'savoir commun', gut: 'intuition', if: 'supposé', top: 'nouveau sujet' },
    news: 'tout juste appris',
    tense: { pst: 'passé', fut: 'futur' },
    fig: { lim: 'limite', pdx: 'paradoxe', met: 'métaphore' },
    act: { say: 'affirmation', ask: 'question', chk: 'question de vérification', req: 'demande', let: 'proposition', vow: 'promesse', nay: 'refus', dfr: 'différé', ack: 'concession' },
    place: { '↓': 'fondé sur N', '↔': 'contre N', '∥': 'à côté de N (variante écartée)', '↖': 'question en retour sur N' },
    process: { 숙고: 'en réflexion', 미해결: 'non résolu', fix: 'corrige N', err: 'retire N', sup: 'étaye N (raisons trouvées après coup pour une intuition)' },
    to: 'à X',
    echo: 'reprend ce qui a été reçu',
    self: 'confiance',
    muk: 'encre',
    all: 'à tous',
    chae: 'chae',
    because: 'à cause de N',
    clash: 'N et M ne peuvent pas être vrais ensemble',
    past: 'N du fil T',
    joiner: ' · ',
    clause: 'clause ',
    url: 'URL',
    quiz: 'question Q',
  },
  it: {
    ev: { see: 'visto direttamente', rec: 'ricordato', hrd: 'sentito dire', inf: 'dedotto', com: 'sapere comune', gut: 'intuito', if: 'ipotizzando', top: 'nuovo tema' },
    news: 'appena appreso',
    tense: { pst: 'passato', fut: 'futuro' },
    fig: { lim: 'limite', pdx: 'paradosso', met: 'metafora' },
    act: { say: 'affermazione', ask: 'domanda', chk: 'domanda di conferma', req: 'richiesta', let: 'proposta', vow: 'promessa', nay: 'rifiuto', dfr: 'rinviato', ack: 'concessione' },
    place: { '↓': 'fondato su N', '↔': 'contro N', '∥': 'accanto a N (alternativa scartata)', '↖': 'domanda di ritorno su N' },
    process: { 숙고: 'in riflessione', 미해결: 'irrisolto', fix: 'corregge N', err: 'ritira N', sup: 'sostiene N (motivi trovati dopo per un intuito)' },
    to: 'a X',
    echo: 'ripete quanto ricevuto',
    self: 'fiducia',
    muk: 'inchiostro',
    all: 'a tutti',
    chae: 'chae',
    because: 'a causa di N',
    clash: 'N e M non possono valere insieme',
    past: 'N della conversazione T',
    joiner: ' · ',
    clause: 'clausola ',
    url: 'URL',
    quiz: 'domanda Q',
  },
  es: {
    ev: { see: 'visto directamente', rec: 'recordado', hrd: 'oído de otros', inf: 'inferido', com: 'saber común', gut: 'corazonada', if: 'suponiendo', top: 'tema nuevo' },
    news: 'recién sabido',
    tense: { pst: 'pasado', fut: 'futuro' },
    fig: { lim: 'límite', pdx: 'paradoja', met: 'metáfora' },
    act: { say: 'afirmación', ask: 'pregunta', chk: 'pregunta de confirmación', req: 'petición', let: 'propuesta', vow: 'promesa', nay: 'rechazo', dfr: 'aplazado', ack: 'concesión' },
    place: { '↓': 'fundado en N', '↔': 'contra N', '∥': 'junto a N (alternativa descartada)', '↖': 'pregunta de vuelta sobre N' },
    process: { 숙고: 'dándole vueltas', 미해결: 'sin resolver', fix: 'corrige N', err: 'retira N', sup: 'respalda N (razones halladas después para una corazonada)' },
    to: 'a X',
    echo: 'repite lo recibido',
    self: 'confianza',
    muk: 'tinta',
    all: 'a todos',
    chae: 'chae',
    because: 'por N',
    clash: 'N y M no pueden ser ciertas a la vez',
    past: 'N de la conversación T',
    joiner: ' · ',
    clause: 'cláusula ',
    url: 'URL',
    quiz: 'pregunta Q',
  },
  ru: {
    ev: { see: 'увидено напрямую', rec: 'вспомнено', hrd: 'услышано от других', inf: 'выведено', com: 'общеизвестно', gut: 'чутьё', if: 'допустим', top: 'новая тема' },
    news: 'только что узнал',
    tense: { pst: 'прошлое', fut: 'будущее' },
    fig: { lim: 'предел', pdx: 'парадокс', met: 'метафора' },
    act: { say: 'утверждение', ask: 'вопрос', chk: 'уточняющий вопрос', req: 'просьба', let: 'предложение', vow: 'обещание', nay: 'отказ', dfr: 'отложено', ack: 'уступка' },
    place: { '↓': 'основано на N', '↔': 'против N', '∥': 'рядом с N (отвергнутая альтернатива)', '↖': 'встречный вопрос о N' },
    process: { 숙고: 'обдумывается', 미해결: 'не решено', fix: 'исправляет N', err: 'отзывает N', sup: 'подкрепляет N (основания для чутья найдены позже)' },
    to: 'для X',
    echo: 'повторяет полученное',
    self: 'уверенность',
    muk: 'тушь',
    all: 'всем',
    chae: 'chae',
    because: 'из-за N',
    clash: 'N и M не могут быть верны вместе',
    past: 'N из разговора T',
    joiner: ' · ',
    clause: '№',
    url: 'ссылка',
    quiz: 'вопрос Q',
  },
};

/** 끝의 근거 이름: 주소, 시험 문제 Q3, 참가자 kimi(2026-10-16), 절 */
const becauseName = (b: Because, g: GlossTable) =>
  'url' in b ? g.url : 'quiz' in b ? `${g.quiz}${b.quiz}` : 'agent' in b ? b.agent : 'thread' in b ? g.past.replace('T', String(b.thread)).replace('N', g.clause + b.clause.replace(/^[절점]/u, '')) : refName(b, g);
// v0.7: 틀의 이름표(절12)는 그대로지만 풀이는 그 언어의 말로 쓴다(ko 절12, en clause 12)
const refName = (r: Ref, g: GlossTable) => (r.msg ? `#${r.msg.slice(0, 6)}:` : '') + g.clause + r.label.replace(/^[절점]/u, '');

/**
 * 절 하나의 표지 풀이: 앞붙이 · 근거 · 새로앎 · 시제 · 화행 · 자신 N · 먹 N.
 * 예: <절2 ↓1 →kimi [겠,다(6)] …> → "절1 아래(근거) · kimi에게 · 추론 · 단언 · 자신 6"
 */
/**
 * 풀이 언어 이름을 표의 열쇠로(2026-10-29 몫 C). 언어를 주지 않으면 ko. zh·zh-CN은 간체, zh-TW·zh-HK는 번체, 대소문자는 가리지 않는다.
 * 표에 없는 말(pt·vi …)은 영어로 보인다(진단 글 diag-i18n.js와 같다: 빠진 말은 en).
 */
export function glossLang(lang?: string | null): string {
  if (!lang) return 'ko';
  const k = String(lang).trim();
  if (GLOSS[k]) return k;
  const low = k.toLowerCase();
  const hit = Object.keys(GLOSS).find((x) => x.toLowerCase() === low);
  if (hit) return hit;
  if (low === 'zh' || low === 'zh-cn' || low === 'zh-sg' || low === 'zh-hans-cn') return 'zh-Hans';
  if (low === 'zh-tw' || low === 'zh-hk' || low === 'zh-mo' || low === 'zh-hant-tw') return 'zh-Hant';
  const base = low.split('-')[0];
  return GLOSS[base] ? base : 'en';
}

export function glossClause(c: Clause, lang = 'ko'): string {
  const g = GLOSS[glossLang(lang)];
  const out: string[] = [];
  if (c.echo) out.push(g.echo);
  if (c.all) out.push(g.all);
  const name = (r: Ref) => (r.thread !== undefined ? g.past.replace('T', String(r.thread)).replace('N', g.clause + r.label.replace(/^[절점]/u, '')) : refName(r, g)); // 지난 대화의 절(받침→53:12, ↔53:12)
  if (c.process) out.push(g.process[c.process.kind].replace('N', c.process.target ? name(c.process.target) : ''));
  if (c.place?.rel === '⊗') out.push(g.clash.replace('N', refName(c.place.target, g)).replace('M', c.place.second ? refName(c.place.second, g) : ''));
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
