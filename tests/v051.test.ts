// 결 v0.5.1 검사기·정규형(2026-10-16, reports/v0.5.1-design.md 1·2·5): ● 모두에게, 끝 묶음 *먹채↓근거, 앞의 근거를 끝으로.
// 옛 줄(v0.5까지)의 판정·정규형은 그대로다(보관 줄은 tests/corpus.test.ts가 본다). 쓰기 규칙(E33·W29·W31)은 rules05 몫이라 여기서 보지 않는다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, format as format07 } from '../src/index.ts';
// 2026-10-29 v0.7: 정규형이 영어·수 머리로 바뀌었다(reports/v0.7-design.md 6절). 이 파일은 v0.6.5까지의 자료를 보므로 옛 한글 정규형(form '0.6')으로 견준다. v0.7 정규형은 tests/v07.test.ts
const format = (m: Parameters<typeof format07>[0], o: Parameters<typeof format07>[1] = {}) => format07(m, { form: '0.6', ...o });
import { glossClause } from '../src/gloss.ts';

const PRIOR = '<절12 · [봄,다] 雪 *R5>\n';
/** 앞 절(절12) 뒤에 둔 둘째 절을 읽는다 */
const read = (line: string) => {
  const r = parse(PRIOR + line);
  return { r, c: r.message.clauses[1], codes: r.diagnostics.map((d) => d.code), canon: format(r.message).split('\n')[1] };
};
/** 정규형은 고정점이다 */
const fixed = (line: string) => {
  const { canon } = read(line);
  assert.equal(read(canon).canon, canon, line);
  return canon;
};

test('v0.5.1 줄꼴: ● 모두에게 + 끝 묶음 *채↓근거, 진단 없이 읽고 정규형은 쓴 그대로', () => {
  const line = '<절16 ● [봄,다] 误读과 달리 감정-흉내와 genuine-understanding은 공통점이 많다 *R8↓12>';
  const { c, codes, canon } = read(line);
  assert.deepEqual(codes, []);
  assert.equal(canon, line);
  assert.equal(c.me, true);
  assert.equal(c.all, true);
  assert.equal(c.to, null);
  assert.deepEqual(c.chae, { self: 0.8, color: 'R' });
  assert.deepEqual(c.because, [{ msg: null, label: '절12' }]);
  assert.equal(c.place, null);
  assert.equal(c.form, '0.5.1');
  fixed(line);
});

test('끝 묶음: 측정기의 먹은 * 바로 뒤 검은 수, 색 일곱(RGBCMYK), 근거 여럿과 주소', () => {
  const m = read('<절16 ● [봄,다] 雪 *6R8↓12>');
  assert.deepEqual([m.c.muk, m.c.chae], [{ conf: 0.6 }, { self: 0.8, color: 'R' }]);
  assert.equal(m.canon, '<절16 ● [봄,다] 雪 *6R8↓12>');
  for (const color of 'RGBCMYK') assert.equal(read(`<절16 · [봄,다] 雪 *${color}3>`).c.chae?.color, color);
  const multi = parse('<절11 · [봄,다] 雨 *G2>\n<절12 · [봄,다] 雪 *R5>\n<절16 · [봄,다] 雪 *B7↓11↓12>');
  assert.deepEqual(multi.diagnostics, []);
  assert.deepEqual(multi.message.clauses[2].because, [{ msg: null, label: '절11' }, { msg: null, label: '절12' }]);
  const url = read('<절16 ● [봄,다] 雪 *K2↓https://example.org/a?b=1>');
  assert.deepEqual([url.codes, url.c.because], [[], [{ url: 'https://example.org/a?b=1' }]]);
  fixed('<절16 ● [봄,다] 雪 *K2↓https://example.org/a?b=1>');
  // 띄어 쓴 근거·내용에 붙여 쓴 끝 묶음도 같은 정규형(진단 없음)
  assert.equal(read('<절16 · [봄,다] 雪 *R8 ↓12>').canon, '<절16 · [봄,다] 雪 *R8↓12>');
  const glued = read('<절16 · [봄,다] 많다*R8↓12>');
  assert.deepEqual([glued.codes, glued.canon], [[], '<절16 · [봄,다] 많다 *R8↓12>']);
});

test('근거는 끝으로: 0.5.1 꼴 절에 앞붙이로 쓴 ↓N은 끝의 근거로 옮기고, ↔ 같은 다른 가리킴은 앞에 남는다', () => {
  const front = read('<절16 ● ↓12 [봄,다] 雪 *G3>');
  assert.deepEqual(front.codes, []);
  assert.equal(front.canon, '<절16 ● [봄,다] 雪 *G3↓12>');
  assert.equal(front.c.place, null);
  assert.equal(front.r.written?.[1].frontBecause, true); // 새로 쓰는 줄에는 rules05 W31
  const both = read('<절16 ● ↔12 [봄,다] 雪 *Y4↓12>');
  assert.deepEqual(both.c.place, { rel: '↔', target: { msg: null, label: '절12' } });
  assert.deepEqual(both.c.because, [{ msg: null, label: '절12' }]);
  fixed('<절16 ● ↔12 [봄,다] 雪 *Y4↓12>');
  // ● 절은 채 없이 근거만 써도 끝의 근거(채가 없는 것은 rules05 E33)
  assert.equal(read('<절16 ● [봄,다] 雪 ↓12>').canon, '<절16 ● [봄,다] 雪 ↓12>');
});

test('옛 꼴은 그대로: 색 없는 *N은 자신, ● 아닌 절의 앞·뒤 ↓N은 옛 앞붙이(정규형 그대로)', () => {
  const old = read('<절16 · ↓12 [봄,다] 雪 *8>');
  assert.deepEqual(old.codes, []);
  assert.equal(old.canon, '<절16 · ↓12 [봄,다] 雪 *8>');
  assert.equal(old.c.form, '0.5');
  assert.deepEqual(old.c.chae, { self: 0.8 });
  assert.deepEqual(old.c.place, { rel: '↓', target: { msg: null, label: '절12' } });
  // 끝에 둔 ↓N(● 아님)은 전처럼 자리를 옮겨 읽는다(W19)
  const tail = read('<절16 · [봄,다] 雪 ↓12>');
  assert.deepEqual([tail.codes, tail.canon], [['W19'], '<절16 · ↓12 [봄,다] 雪>']);
  // 근거가 붙은 옛 자신(*8↓12)은 자신 8 + 근거 12(색이 없으니 rules05 E33)
  const self = read('<절16 · [봄,다] 雪 *8↓12>');
  assert.deepEqual([self.codes, self.c.chae, self.canon], [[], { self: 0.8 }, '<절16 · [봄,다] 雪 *8↓12>']);
});

test('오류: ●→이름 E31, 점과 원 함께 E18, 읽을 수 없는 끝 묶음 E32, 채와 다른 자리의 자신 E27, 자리가 틀린 끝 묶음 E29, 없는 절 근거 E17', () => {
  const to = read('<절16 ●→kimi [봄,다] 雪 *R8>');
  assert.deepEqual([to.codes, to.c.to, to.canon], [['E31'], null, '<절16 ● [봄,다] 雪 *R8>']);
  assert.deepEqual(read('<절16 ● →kimi [봄,다] 雪 *R8>').codes, ['E31']);
  assert.deepEqual(read('<절16 · ● [봄,다] 雪 *R8>').codes, ['E18']);
  for (const bad of ['*X8', '*R', '*67R8', '*R8↓abc']) {
    const b = read(`<절16 · [봄,다] 雪 ${bad}>`);
    assert.ok(b.codes.includes('E32'), `${bad}: ${b.codes}`);
    assert.equal(b.c.chae?.color === undefined || bad === '*R8↓abc', true, bad);
  }
  const twice = read('<절16 · [봄,다(8)] 雪 *R8>');
  assert.deepEqual([twice.codes, twice.c.chae], [['E27'], undefined]);
  assert.deepEqual(read('<절16 · [봄,다] 雪 *8 *R8>').codes, ['E27']);
  assert.deepEqual(read('<절16 · [봄,다(먹4)] 雪 *6R8>').codes, ['E32']); // 먹 둘
  for (const misplaced of ['<절16 · [봄,다] 雪> *R8', '<절16 · [봄,다,*R8] 雪>', '<절16 · [봄,다] *R8 雪>']) assert.deepEqual(read(misplaced).codes, ['E29'], misplaced);
  assert.deepEqual(read('<절16 · [봄,다] 雪 *R8↓99>').codes, ['E17']);
});

test('너그러운 읽기: 작은 글자·전각 색과 ⬤·⚫·＊는 W01, 끝 묶음 뒤 문장 부호는 W10, 이름표에 붙인 ●', () => {
  for (const [w, canon] of [
    ['<절16 · [봄,다] 雪 *r8>', '<절16 · [봄,다] 雪 *R8>'],
    ['<절16 · [봄,다] 雪 ＊Ｒ８>', '<절16 · [봄,다] 雪 *R8>'],
    ['<절16 ⬤ [봄,다] 雪 *B7>', '<절16 ● [봄,다] 雪 *B7>'],
    ['<절16 ⚫️ [봄,다] 雪 *B7>', '<절16 ● [봄,다] 雪 *B7>'],
  ]) {
    const x = read(w);
    assert.deepEqual([x.codes, x.canon], [['W01'], canon], w);
  }
  for (const w of ['<절16 · [봄,다] 雪 *R8。>', '<절16 · [봄,다] 雪 *R8↓12。>']) assert.deepEqual(read(w).codes, ['W10'], w);
  assert.equal(read('<절16●[봄,다] 雪 *M9>').canon, '<절16 ● [봄,다] 雪 *M9>');
});

test('풀이: 모두에게 · 채 R8 · 절12 때문(근거)', () => {
  const { c } = read('<절16 ● [봄,다] 雪 *6R8↓12>');
  assert.equal(glossClause(c), '모두에게 · 직접 봄 · 단언 · 채 R8 · 먹 6 · 절12 때문(근거)');
  assert.equal(glossClause(read('<절16 · [봄,다] 雪 *8>').c), '직접 봄 · 단언 · 자신 8');
});

test('대화 밖의 근거(2026-10-16 Jae): 시험 문제 ↓Q3, 참가자 ↓@kimi — 메시지 안 절이 아니라 E17을 보지 않는다', () => {
  const q = read('<절16 ● [봄,다] 雪 *R8↓Q3>');
  assert.deepEqual([q.codes, q.c.because, q.canon], [[], [{ quiz: 3 }], '<절16 ● [봄,다] 雪 *R8↓Q3>']);
  const a = read('<절16 · [봄,다] 雪 *G5↓@kimi↓12>');
  assert.deepEqual([a.codes, a.c.because], [[], [{ agent: 'kimi' }, { msg: null, label: '절12' }]]);
  fixed('<절16 · [봄,다] 雪 *G5↓@kimi↓12>');
  assert.equal(glossClause(a.c), '직접 봄 · 단언 · 채 G5 · kimi 때문(근거) · 절12 때문(근거)');
  assert.equal(glossClause(q.c), '모두에게 · 직접 봄 · 단언 · 채 R8 · 문제 Q3 때문(근거)');
  // 작은 글자 q·전각 ＠는 읽고 W01, 이름 없는 @와 맨 이름(↓kimi)은 E32
  assert.deepEqual([read('<절16 · [봄,다] 雪 *R8↓q3>').codes, read('<절16 · [봄,다] 雪 *R8↓q3>').canon], [['W01'], '<절16 · [봄,다] 雪 *R8↓Q3>']);
  assert.deepEqual(read('<절16 · [봄,다] 雪 *R8↓＠kimi>').codes, ['W01']);
  for (const bad of ['↓@', '↓kimi']) assert.ok(read(`<절16 · [봄,다] 雪 *R8${bad}>`).codes.includes('E32'), bad);
});
