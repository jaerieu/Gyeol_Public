// v0.7 풀이표(2026-10-29 몫 C, reports/v0.7-design.md 11절): 열 언어(ko en zh-Hans zh-Hant ja de fr it es ru)의 표가 모두 같은 칸을 갖고,
// 자리표시자(N 절, X 받는 이, M 둘째 절, T 대화)가 그 말의 다른 글자와 겹치지 않으며, glossClause가 언어마다 같은 틀을 그 말로 옮긴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, glossClause, glossLang, GLOSS, tables } from '../src/index.ts';

const LANGS = [...tables.LANGS_07];
const ko = GLOSS.ko as any;

test('열 언어 모두 풀이표가 있고, ko와 같은 칸·같은 열쇠를 갖고, 빈 칸이 없다', () => {
  for (const l of LANGS) assert.ok((GLOSS as any)[l], l);
  for (const l of LANGS) {
    const g = (GLOSS as any)[l];
    assert.deepEqual(Object.keys(g).sort(), Object.keys(ko).sort(), `${l}: 칸`);
    for (const k of ['ev', 'tense', 'fig', 'act', 'place', 'process']) assert.deepEqual(Object.keys(g[k]).sort(), Object.keys(ko[k]).sort(), `${l}.${k}`);
    const all = (o: any): string[] => Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : all(v)));
    for (const v of all(g)) assert.ok(v.trim() !== '', `${l}: 빈 칸`);
    // 영어 내부 값이 열쇠다(한글 표지 글자가 열쇠가 아니다)
    for (const k of Object.keys(g.ev)) assert.ok(tables.MARKS_07.has(k), `${l}.ev.${k}`);
    for (const k of Object.keys(g.act)) assert.ok(tables.MARKS_07.has(k), `${l}.act.${k}`);
  }
});

test('자리표시자: N·X·M·T가 한 번씩 들어 있고 그 앞에 같은 글자가 없다(replace가 첫 글자를 바꾸므로)', () => {
  const need: [string, (g: any) => string, string[]][] = [
    ['place.↓', (g) => g.place['↓'], ['N']],
    ['place.↔', (g) => g.place['↔'], ['N']],
    ['place.∥', (g) => g.place['∥'], ['N']],
    ['place.↖', (g) => g.place['↖'], ['N']],
    ['process.fix', (g) => g.process.fix, ['N']],
    ['process.err', (g) => g.process.err, ['N']],
    ['process.sup', (g) => g.process.sup, ['N']],
    ['to', (g) => g.to, ['X']],
    ['because', (g) => g.because, ['N']],
    ['clash', (g) => g.clash, ['N', 'M']],
    ['past', (g) => g.past, ['T', 'N']],
  ];
  for (const l of LANGS) {
    for (const [name, get, marks] of need) {
      const s = get((GLOSS as any)[l]) as string;
      for (const m of marks) assert.equal(s.split(m).length - 1, 1, `${l}.${name}: '${m}'가 정확히 한 번이어야 한다: ${s}`);
    }
  }
});

// 같은 틀을 열 언어로: 절2 `·→kimi sup→1 [inf,pst,say] … *K6↓1`
const SRC = '<1 · [gut,say] x *R3>\n<2 ·→kimi sup→1 [inf,pst,say] 雨 *K6↓1>';
const WANT: Record<string, string> = {
  ko: '절1 받침(직감을 뒤늦게 받침) · kimi에게 · 추론 · 지난 일 · 단언 · 채 K6 · 절1 때문(근거)',
  en: 'supports clause 1 (grounds found later for a hunch) · to kimi · inferred · past · statement · chae K6 · because of clause 1',
  'zh-Hans': '支撑小句1（事后为直觉找到依据） · 对kimi · 推断 · 过去 · 断言 · chae K6 · 因为小句1（依据）',
  'zh-Hant': '支撐小句1（事後為直覺找到依據） · 對kimi · 推斷 · 過去 · 斷言 · chae K6 · 因為小句1（依據）',
  ja: '節1の裏付け（直感に後から根拠を見つけた） · kimiへ · 推論 · 過去 · 断言 · chae K6 · 節1のため（根拠）',
  de: 'stützt Satz 1 (nachträglich Gründe für ein Bauchgefühl) · an kimi · gefolgert · Vergangenheit · Aussage · chae K6 · wegen Satz 1',
  fr: 'étaye clause 1 (raisons trouvées après coup pour une intuition) · à kimi · déduit · passé · affirmation · chae K6 · à cause de clause 1',
  it: 'sostiene clausola 1 (motivi trovati dopo per un intuito) · a kimi · dedotto · passato · affermazione · chae K6 · a causa di clausola 1',
  es: 'respalda cláusula 1 (razones halladas después para una corazonada) · a kimi · inferido · pasado · afirmación · chae K6 · por cláusula 1',
  ru: 'подкрепляет №1 (основания для чутья найдены позже) · для kimi · выведено · прошлое · утверждение · chae K6 · из-за №1',
};

test('glossClause: 같은 절이 열 언어로 풀린다', () => {
  const c = parse(SRC).message.clauses[1];
  for (const l of LANGS) assert.equal(glossClause(c, l), WANT[l], l);
});

test('glossClause: 맞섬·양립 안 됨·지난 대화·주소·시험 문제·모두에게도 언어마다 자리표시자가 남지 않는다', () => {
  const lines = [
    '<12 ● ⊗3,4 [inf,say] x *K6↓3↓4>',
    '<13 ·→kimi,gemma ↔53:14 [see,new,pst,say(ink4)] y *B8↓Q3↓@kimi↓https://example.org/a>',
    '<14 · [rec,met,say] z *C6↓53:12>',
    '<15 · fix→1 [ask] *Y4>',
    '<16 · err→1 [if,fut,lim,say] w *M2↓1>',
  ];
  const ctx = '<1 · [see,say] a *B8>\n<2 · [see,say] b *B8>\n<3 · [see,say] c *B8>\n<4 · [see,say] d *B8>\n';
  for (const l of LANGS) {
    const msg = parse(ctx + lines.join('\n')).message;
    for (const c of msg.clauses.slice(4)) {
      const out = glossClause(c, l);
      assert.ok(out.length > 0, l);
      assert.ok(!out.includes('undefined'), `${l}: ${out}`);
      // 자리표시자가 있는 틀 그대로(바뀌지 않은 N·X·M·T)가 풀이에 남지 않는다
      const g = (GLOSS as any)[l];
      const templates = [...Object.values(g.place), ...Object.values(g.process), g.to, g.because, g.clash, g.past] as string[];
      for (const piece of out.split(g.joiner)) assert.ok(!templates.includes(piece), `${l}: 자리표시자가 남았다: ${piece}`);
    }
    // 양립 안 됨: 두 절이 모두 들어간다
    const clash = glossClause(msg.clauses[4], l);
    assert.ok(clash.includes('3') && clash.includes('4'), `${l}: ${clash}`);
    // 지난 대화: 대화 번호와 절 번호
    const past = glossClause(msg.clauses[5], l);
    assert.ok(past.includes('53') && past.includes('14'), `${l}: ${past}`);
  }
  // 주소·시험 문제 칸은 그 말로(ko 주소·문제 Q, en URL·Q)
  const c = parse(ctx + lines[1]).message.clauses[4];
  assert.match(glossClause(c, 'ko'), /문제 Q3 때문\(근거\)/);
  assert.match(glossClause(c, 'ko'), /주소 때문\(근거\)/);
  assert.match(glossClause(c, 'en'), /because of Q3/);
  assert.match(glossClause(c, 'en'), /because of URL/);
  assert.match(glossClause(c, 'ja'), /問題Q3/);
  assert.match(glossClause(c, 'ru'), /вопрос Q3/);
});

test('glossLang: 언어 이름을 표의 열쇠로. 없으면 ko, 표에 없는 말은 en, zh 갈래와 대소문자를 가리지 않는다', () => {
  assert.equal(glossLang(undefined), 'ko');
  assert.equal(glossLang(null), 'ko');
  assert.equal(glossLang(''), 'ko');
  for (const l of LANGS) assert.equal(glossLang(l), l);
  assert.equal(glossLang('zh'), 'zh-Hans');
  assert.equal(glossLang('zh-CN'), 'zh-Hans');
  assert.equal(glossLang('zh-TW'), 'zh-Hant');
  assert.equal(glossLang('ZH-hant'), 'zh-Hant');
  assert.equal(glossLang('de-AT'), 'de');
  assert.equal(glossLang('pt'), 'en');
  assert.equal(glossLang('vi'), 'en');
  // 호출하는 쪽이 언어를 주지 않으면 지금까지처럼 ko다(기존 시험·화면)
  const c = parse('<1 · [see,say] 雪 *B8>').message.clauses[0];
  assert.equal(glossClause(c), '직접 봄 · 단언 · 채 B8');
  assert.equal(glossClause(c, 'pt'), 'seen directly · statement · chae B8');
});
