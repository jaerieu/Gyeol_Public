// v0.6.5 쓰기 규칙 rules065(2026-10-28): rules06 + W37(사전에서 뺀 표지·앞붙이). 읽기·정규형은 그대로.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse, format as format07, rules06, rules065 } from '../src/index.ts';
// 2026-10-29 v0.7: 정규형이 영어·수 머리로 바뀌었다(reports/v0.7-design.md 6절). 이 파일은 v0.6.5까지의 자료를 보므로 옛 한글 정규형(form '0.6')으로 견준다. v0.7 정규형은 tests/v07.test.ts
const format = (m: Parameters<typeof format07>[0], o: Parameters<typeof format07>[1] = {}) => format07(m, { form: '0.6', ...o });

const codes = (s: string) => rules065(parse(s)).map((d) => d.code);

test('W37: 뺀 근거·화행·앞붙이마다 하나씩, 뜻·정규형은 그대로, rules06은 내지 않는다', () => {
  const lines: [string, number][] = [
    ['<절1 · [들,다] rain이 온다 *B6>', 1],
    ['<절1 · [늘,다] 물은 아래로 흐른다 *B8>', 1],
    ['<절1 ·→kimi [지] rain *K4>', 1],
    ['<절1 ·→kimi [유] *K4>', 1],
    ['<절1 · [봄,다] door가 열렸다 *B8> <절2 · ∥1 [겠,다] window였다 *K5>', 1],
    ['<절1 · [봄,다] A *B8> <절2 · [봄,다] B *B8> <절3 · ⊗1,2 [겠,다] 둘 다 참일 수 없다 *K6↓1↓2>', 1],
    ['<절1 · 숙고 [겠,다] 아직 answer를 모른다 *K3>', 1],
    ['<절1 · 미해결 [겠,다] 이 question은 열려 있다 *K3>', 1],
    ['<절1 · [봄,다] rain *B8> <절2 · 받은대로 [봄,다] 절1 *K6↓1>', 1],
  ];
  for (const [s, n] of lines) {
    const r = parse(s);
    assert.deepEqual(r.diagnostics, [], s);
    assert.deepEqual(rules06(r).filter((d) => d.code === 'W37'), [], s);
    const w = rules065(r);
    assert.equal(w.filter((d) => d.code === 'W37').length, n, s);
    assert.equal(format(r.message), format(parse(s).message));
    assert.deepEqual(rules065(r).filter((d) => d.code !== 'W37'), rules06(r), '나머지는 rules06과 같다');
  }
  assert.deepEqual(codes('<절1 · [봄,다] rain이 온다 *B6> <절2 ·→kimi ↔1 [겠,다] snow다 *K5↓1> <절3 ·→kimi ↖1 [까] rain *K3>'), [], '남은 표지·앞붙이는 경고 없음');
  assert.match(rules065(parse('<절1 · [들,다] rain이 온다 *B6>'))[0].message, /근거 들\(hrd\).*겠\(inf\)과 끝의 ↓@이름/);
  // 옛 꼴(v0.2.1)에는 내지 않는다(rules04의 E26이 이미 알렸다)
  assert.ok(!codes('雨 〈들·다〉').includes('W37'));
});
