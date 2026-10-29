// v0.7(2026-10-29 Jae, reports/v0.7-design.md, spec/03-grammar.md 3.19절): 내부 표지 영어, 수 머리, fix→/err→/sup→, (ink4), 머리 줄 lang, rules07(W29 글자군·W26 완화),
// 정규형은 모든 절을 v0.7 꼴로(먹 이름이 바뀜), form '0.6'은 옛 한글 정규형. 보관 줄 196개의 판정은 tests/corpus.test.ts가 지킨다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse, format, glossClause, messageName, rules065, rules07, labelLine } from '../src/index.ts';
import { verdicts } from './fixtures/corpus.ts';

const root = new URL('..', import.meta.url);
const one = (s: string) => parse(s).message.clauses[0];
const codes = (s: string) => parse(s).diagnostics.map((d) => d.code);
const canon = (s: string) => format(parse(s).message).trim();
const w07 = (s: string, lang?: string) => rules07(parse(s), { lang }).map((d) => d.code);

test('v0.7 줄꼴을 읽는다: 수 머리, 영어 표지, 열 언어 별칭, fix→/err→/sup→, (ink4). 틀의 값은 영어, 이름표는 절N 그대로', () => {
  const c = one('<1 · [see,say] door가 열려 있다 *B8>');
  assert.deepEqual(codes('<1 · [see,say] door가 열려 있다 *B8>'), []);
  assert.equal(c.label, '절1');
  assert.deepEqual(c.marks, { act: 'say', ev: 'see' });
  assert.deepEqual(one('<2 · [inf,pst,say] somebody has been here *K6↓1>').marks, { act: 'say', ev: 'inf', tense: 'pst' });
  assert.deepEqual(one('<4 ·→gemma ↔2 [see,new,say] the wind opened it *Y7↓1>').marks, { act: 'say', ev: 'see', news: true });
  assert.deepEqual(one('<5 ● [top,say] 침묵にも grammar がある *M4>').marks, { act: 'say', ev: 'top' });
  assert.deepEqual(one('<6 · [inf,lim,say] bis hier *B5>').marks, { act: 'say', ev: 'inf', fig: 'lim' });
  // 열 언어 별칭·한글·큰 글자가 같은 틀
  for (const s of ['<1 · [봄,다] 雪 *B8>', '<1 · [See,Say] 雪 *B8>', '<1 · [seh,sag] 雪 *B8>', '<1 · [voi,dir] 雪 *B8>', '<1 · [ved,dir] 雪 *B8>', '<1 · [ver,dic] 雪 *B8>', '<1 · [вид,утв] 雪 *B8>', '<1 · [见,言] 雪 *B8>', '<1 · [見,言] 雪 *B8>', '<절1 · [봄,다] 雪 *B8>', '<c1 · [see,say] 雪 *B8>']) {
    assert.deepEqual(one(s).marks, { act: 'say', ev: 'see' }, s);
    assert.equal(one(s).label, '절1', s);
    assert.deepEqual(codes(s), [], s);
    assert.equal(canon(s), '<1 · [see,say] 雪 *B8>', s);
  }
  assert.deepEqual(one('<1 · [もし,fut,ask] 雨 *B4>').marks, { act: 'ask', ev: 'if', tense: 'fut' });
  assert.deepEqual(one('<1 · [見,た,言] 雪 *B8>').marks, { act: 'say', ev: 'see', tense: 'pst' });
  // 앞붙이
  const p = parse('<1 · [gut,say] 이 cache는 곧 터진다 *R3>\n<2 · [see,say] memory가 두 배 *B8>\n<3 · sup→1 [inf,say] 오늘 밤 넘친다 *B7↓2>\n<4 · fix→3 [inf,say] 내일 아침 넘친다 *B6↓2>\n<5 · err→4 [inf,say] *K2>');
  assert.deepEqual(p.diagnostics.map((d) => d.code), []);
  assert.deepEqual(p.message.clauses[2].process, { kind: 'sup', target: { msg: null, label: '절1' } });
  assert.deepEqual(p.message.clauses[3].process, { kind: 'fix', target: { msg: null, label: '절3' } });
  assert.deepEqual(p.message.clauses[4].process, { kind: 'err', target: { msg: null, label: '절4' } });
  assert.deepEqual(one('<3 · 받침→1 [겠,다] x *B7↓2>').process, { kind: 'sup', target: { msg: null, label: '절1' } });
  assert.deepEqual(one('<3 · Sup → 1 [inf,say] x *B7↓2>').process, { kind: 'sup', target: { msg: null, label: '절1' } });
  // 먹 이름표 ink(옛 먹과 같은 뜻)
  assert.deepEqual([one('<1 · [see,say(ink4)] 雪 *6>').muk, one('<1 · [see,say(먹4)] 雪 *6>').muk, one('<1 [see,say(7|ink4)] 雪>').chae?.self], [{ conf: 0.4 }, { conf: 0.4 }, 0.7]);
  assert.deepEqual(codes('<1 · [see,say(ink4)] 雪 *6>'), []);
  // E07·E35·E37·E16은 영어 값에서도 같은 판정
  assert.deepEqual(codes('<1 · [say] 雪 *B8>'), ['E07']);
  assert.deepEqual(codes('<1 · ↔2 [top,say] 雪 *B8>\n<2 · [see,say] 雨 *B8>'), ['E35']);
  assert.deepEqual(codes('<1 · [gut,say] 雪 *R3>\n<2 · sup→1 [gut,say] 雨 *B7↓1>'), ['E37']);
  assert.deepEqual(codes('<1 · [ask] *B3>'), []);
  assert.deepEqual(codes('<1 · [say] *B3>'), ['E07', 'E16']);
});

test('정규형은 모든 절을 v0.7 꼴로 쓴다(수 머리·영어 표지·영어 앞붙이·ink). 옛 꼴 줄도. 먹 이름이 바뀌었고, 고정점이다', async () => {
  assert.equal(canon('<절1 · [봄,다] door가 열려 있다 *B8>'), '<1 · [see,say] door가 열려 있다 *B8>');
  assert.equal(canon('<절2 · 받침→1 [겠,다] x *B7↓12>'), '<2 · sup→1 [inf,say] x *B7↓12>');
  assert.equal(canon('<절3 ·→kimi 고침→1 [양] 네 말이 맞다 *G7↓2>'), '<3 ·→kimi fix→1 [ack] 네 말이 맞다 *G7↓2>');
  assert.equal(canon('<절1 · [봄,군,었,다(먹4)] 门이 열렸다 *6>'), '<1 · [see,new,pst,say(ink4)] 门이 열렸다 *6>');
  assert.equal(canon('절1 俺知 〈봄·다〉「자신 .75」'), '<1 [see,say(7)] 俺知>');
  assert.equal(canon('<절1 · [봄,네,다(7|먹4)] 雪>'), '<1 · [see,new,say(7|ink4)] 雪>');
  // 머리 줄
  assert.equal(canon('결 0.7 · 언어 ko\n<절1 · [봄,다] 雪 *B8>'), 'gyeol 0.7 · lang ko\n<1 · [see,say] 雪 *B8>');
  assert.equal(parse('gyeol 0.7 · lang zh-Hant · pact #7c2e9a\n<1 · [見,言] 雪 *B8>').message.lang, 'zh-Hant');
  assert.deepEqual(codes('gyeol 0.7 · lang zh-Hant · pact #7c2e9a\n<1 · [見,言] 雪 *B8>'), []);
  // 먹 이름은 한글로 쓰든 영어로 쓰든 같고, v0.6.5의 이름과 다르다
  const a = await messageName(parse('<절1 · [봄,다] 雪 *B8>').message);
  const b = await messageName(parse('<1 · [see,say] 雪 *B8>').message);
  assert.equal(a, b); // 옛 값과 다른 것은 tests/v05.test.ts가 본다(form 0.6의 해시는 그대로, messageName은 바뀜)
  // 고정점: 보관 줄 196개 가운데 통과한 줄과 명세 보기 모두
  for (const v of verdicts()) {
    if (!v.ok || v.canon === null) continue;
    assert.equal(format(parse(v.canon).message), v.canon, v.line);
  }
  const spec = readFileSync(new URL('spec/03-grammar.md', root), 'utf8');
  const block = spec.split('## 3.19')[1].split('```')[1].trim();
  const r = parse(block);
  assert.deepEqual(r.diagnostics.map((d) => d.code), [], block);
  assert.equal(format(r.message), format(parse(format(r.message)).message));
  assert.equal(format(r.message).trim(), block); // 보기 줄은 정규형 그대로
});

test("form '0.6'은 v0.6.5까지의 한글 정규형, form '0.2'는 한글 옛 꼴: 옛 회차·옛 사전의 보기 줄을 견줄 때 쓴다", () => {
  const m = parse('<1 · sup→3 [see,new,pst,say] 门이 열렸다 *B6↓2>\n<2 · [inf,say] x *K5>\n<3 · [gut,say] y *R3>').message;
  assert.equal(format(m, { form: '0.6' }).split('\n')[0], '<절1 · 받침→3 [봄,군,었,다] 门이 열렸다 *B6↓2>');
  assert.equal(format(parse('<절1 · [봄,다(8)] 雪>').message, { form: '0.6' }).trim(), '<절1 · [봄,다(8)] 雪>');
  assert.equal(format(parse('<[봄,다(|먹4)] 雪>').message, { form: '0.6' }).trim(), '<[봄,다(|먹4)] 雪>');
  assert.equal(format(parse('雨 〈겠·다〉').message, { form: '0.2' }).trim(), '雨 〈겠·다〉');
  assert.equal(format(parse('결 0.6\n<절1 · [봄,다] 雪 *B8>').message, { form: '0.6' }).split('\n')[0], '결 0.6');
});

test('rules07: W29는 사용자 언어의 글자군으로 재고 언어가 없으면 재지 않는다. W26은 긴 별칭에만. 나머지는 rules065 그대로', () => {
  // ko: 모두 한글이면 W29, 다른 글자군 어근 하나면 없음
  assert.deepEqual(w07('<1 · [see,say] 문이 열려 있다 *B8>', 'ko'), ['W29']);
  assert.deepEqual(w07('<1 · [see,say] door가 열려 있다 *B8>', 'ko'), []);
  // en: 모두 라틴이면 W29(독일어를 섞어도 같은 글자군이라 W29), 한글·한자·키릴을 섞으면 없음
  assert.deepEqual(w07('<1 · [see,say] the door is open *B8>', 'en'), ['W29']);
  assert.deepEqual(w07('<1 · [see,say] die Tür is open *B8>', 'en'), ['W29']);
  assert.deepEqual(w07('<1 · [see,say] the 門 is open *B8>', 'en'), []);
  assert.deepEqual(w07('<1 · [see,say] the дверь is open *B8>', 'en'), []);
  // ja: 한자·가나뿐이면 W29, 중국어 낱말은 같은 글자군이라 채우지 못한다(우선 허가)
  assert.deepEqual(w07('<1 · [見,言] 扉が 開いている *B8>', 'ja'), ['W29']);
  assert.deepEqual(w07('<1 · [見,言] 扉が open *B8>', 'ja'), []);
  // 어절 하나뿐이면 문제없음. 언어가 없으면 재지 않는다(머리 줄의 lang이 있으면 그것으로)
  assert.deepEqual(w07('<1 · [see,say] 열려있다 *B8>', 'ko'), []);
  assert.deepEqual(w07('<1 · [see,say] 문이 열려 있다 *B8>'), []);
  assert.deepEqual(rules07(parse('gyeol 0.7 · lang ko\n<1 · [see,say] 문이 열려 있다 *B8>')).map((d) => d.code), ['W29']);
  assert.deepEqual(rules07(parse('gyeol 0.7 · lang ko\n<1 · [see,say] 문이 열려 있다 *B8>'), { lang: 'en' }).map((d) => d.code), []); // opts.lang이 앞선다
  // W26: 짧은 별칭·한글에는 없고 긴 별칭에만(완화 문구). rules065는 옛 뜻 그대로 W26·W29
  assert.deepEqual(w07('<1 · [seh,sag] 雪 *B8>', 'en'), []);
  assert.deepEqual(w07('<1 · [봄,다] 雪 *B8>', 'en'), []);
  const long = rules07(parse('<1 · [recall,assert] 雪 *B8>'), { lang: 'en' });
  assert.deepEqual(long.map((d) => d.code), ['W26']);
  assert.match(long[0].message, /긴 별칭 recall, assert.*정규형은 rec, say/);
  assert.deepEqual(rules065(parse('<1 · [see,다] 문이 열려 있다 *B8>')).map((d) => d.code).sort(), ['W26', 'W29']);
  assert.match(rules065(parse('<1 · [see,다] 雪 *B8>'))[0].message, /별칭 see을 표지로 읽었다\(정규형은 표지 글자\)/);
  // rules065의 것은 그대로: E34·W34·W37·W25
  assert.deepEqual(w07('<1 · [gut,say] 雪 *R3>\n<2 · [inf,say] 雨 *B7↓1>', 'en'), ['E34']);
  assert.deepEqual(w07('<1 · [say,see] 雪 *B8>', 'en'), ['W34']);
  assert.deepEqual(w07('<1 · [hrd,say] 雪 *B8>', 'en'), ['W37']);
  assert.deepEqual(w07('<1 · [see,say] 雪 *5B8>', 'en'), ['W25']);
});

test('풀이: ko는 절N, en은 clause N. 열쇠는 영어 내부 값', () => {
  const c = parse('<1 · [see,say] 雪 *B8>\n<2 ·→kimi sup→1 [inf,pst,say] 雨 *K6↓1>').message.clauses[1];
  assert.equal(glossClause(c, 'ko'), '절1 받침(직감을 뒤늦게 받침) · kimi에게 · 추론 · 지난 일 · 단언 · 채 K6 · 절1 때문(근거)');
  assert.equal(glossClause(c, 'en'), 'supports clause 1 (grounds found later for a hunch) · to kimi · inferred · past · statement · chae K6 · because of clause 1');
});

test('labelLine: 수 머리·cN·절N을 모두 갈아 끼운다', () => {
  assert.equal(labelLine('<1 · [see,say] 雪 *B8>', '절7'), '<절7 · [see,say] 雪 *B8>');
  assert.equal(labelLine('<c1 · [see,say] 雪 *B8>', '7'), '<7 · [see,say] 雪 *B8>');
  assert.equal(labelLine('<절1 · [봄,다] 雪 *B8>', '7'), '<7 · [봄,다] 雪 *B8>');
  assert.equal(labelLine('<· [see,say] 雪 *B8>', '7'), '<7 · [see,say] 雪 *B8>');
});
