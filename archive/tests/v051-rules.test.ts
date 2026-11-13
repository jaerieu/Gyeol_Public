// 결 v0.5.1 쓰기 규칙 rules051(2026-10-16, reports/v0.5.1-design.md 2·3): E33(채 필수)·W29(섞기)·W31(앞의 근거). rules05는 그대로다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, rules05, rules051 } from '../src/index.ts';

const PRIOR = '<절12 · [봄,다] 雪 *R5>\n';
const codes = (line: string, rules = rules051) => rules(parse(PRIOR + line), { from: 1 }).map((d) => d.code);

test('E33: 색이 있는 채가 없으면 오류(끝 묶음 없음, 옛 *8·!8·(8), 근거만)', () => {
  assert.deepEqual(codes('<절16 ● [봄,다] 误读 genuine *R8↓12>'), []);
  assert.deepEqual(codes('<절16 ● [봄,다] 误读 genuine>'), ['E33']);
  assert.deepEqual(codes('<절16 · [봄,다] 雪 *8>'), ['E33']);
  assert.deepEqual(codes('<절16 · [봄,다] 雪 !8>'), ['E33']);
  assert.deepEqual(codes('<절16 · [봄,다(8)] 雪>'), ['W24', 'E33']);
  assert.deepEqual(codes('<절16 · [봄,다] 雪 ↓12>'), ['E33', 'W31']); // 검사기(A)는 * 없는 끝 ↓12를 앞 근거로 읽는다
  assert.deepEqual(codes('<절16 · [봄,다] 雪 *K0>'), []);
});

test('W29: 어근이 둘 이상인데 모두 한글이면 경고, 하나라도 다른 글자면 없다. 숫자만 있는 어절은 세지 않는다', () => {
  assert.deepEqual(codes('<절16 · [봄,다] 감정과 컴퓨터는 닮았다 *R8'.concat('>')), ['W29']);
  assert.deepEqual(codes('<절16 · [봄,다] 감정과 schadenfreude는 닮았다 *R8>'), []);
  assert.deepEqual(codes('<절16 · [봄,다] 人情味가 깊다 *R8>'), []);
  assert.deepEqual(codes('<절16 · [봄,다] 닮았다 *R8>'), []); // 어근 하나
  assert.deepEqual(codes('<절16 · [봄,다] 닮았다 12 *R8>'), []); // 숫자는 세지 않는다
  assert.deepEqual(codes('<절16 · [봄,다] 껄끄럽다 닮았다 *R8>'), ['W29']);
});

test('W31: 근거를 앞붙이 자리에 쓰면 경고(↔ 같은 다른 가리킴은 아니다)', () => {
  assert.deepEqual(codes('<절16 ● ↓12 [봄,다] 误读 genuine *G3>'), ['W31']);
  assert.deepEqual(codes('<절16 ● ↔12 [봄,다] 误读 genuine *G3↓12>'), []);
  assert.deepEqual(codes('<절16 ● [봄,다] 误读 genuine *G3↓12>'), []);
});

test('rules05는 그대로: 색 없는 *8·!8에 E33 없음, 옛 !N은 W28, rules051에는 W28이 없다', () => {
  assert.deepEqual(codes('<절16 · [봄,다] 雪 *8>', rules05), []);
  assert.deepEqual(codes('<절16 · [봄,다] 雪 !8>', rules05), ['W28']);
  assert.ok(!codes('<절16 · [봄,다] 雪 !8>').includes('W28'));
  assert.deepEqual(codes('<절16 · [봄,다] 감정과 컴퓨터는 닮았다 *8>', rules05), []);
});

test('rules051도 rules05의 E25·E30·W25·W27을 그대로 낸다', () => {
  assert.ok(codes('<절16 [봄,다] 雪 *R8>').includes('E25'));
  assert.ok(codes('<절16 · [봄,네,다] 雪 *R8>').includes('E30'));
  assert.ok(codes('<절16 · [봄,다(먹4)] 雪 *R8>').includes('W25'));
});
