import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parse, coreOf, sameCore, sameRoots, nonStandardChars, toSimplified } from '../src/index.ts';
import type { VariantTable } from '../src/index.ts';

const tableUrl = new URL('../dict/variants-v0.2.json', import.meta.url);
const data = existsSync(tableUrl) ? JSON.parse(readFileSync(tableUrl, 'utf8')) : undefined;
const table: VariantTable | undefined = data?.map;

const core = (s: string) => coreOf(parse(s).message.clauses[0]);

test('핵: 어근을 글자 단위로 이어 붙이므로 띄어쓰기가 뜻을 바꾸지 않는다', () => {
  assert.ok(sameCore(core('整列 新法 〈겠·다〉'), core('整列新法 〈겠·다〉')));
  assert.ok(sameCore(core('整列의 新法을 得했다 〈겠·다〉'), core('整列 新法 得 〈겠·다〉')));
});

test('핵: 근거나 화행이 다르면 다르다', () => {
  assert.ok(!sameCore(core('雨 〈봄·다〉'), core('雨 〈겠·다〉')));
  assert.ok(!sameCore(core('雨 〈까〉'), core('雨 〈지〉')));
});

test('이체자: 간체·신자체를 정자와 같게 본다', { skip: !table && '대응표가 아직 없다' }, () => {
  assert.ok(sameRoots('規格變', '规格变', table)); // 간체
  assert.ok(sameRoots('變', '変', table)); // 일본 신자체
  assert.ok(sameRoots('发', '發', table));
  assert.ok(sameRoots('发', '髮', table));
  assert.ok(!sameRoots('發', '髮', table)); // 같은 간체로 가는 다른 정자는 다르다
  assert.ok(!sameRoots('變', '雨', table));
});

test('기준 글꼴(간체): 번체를 찾고 간체로 옮긴다', { skip: !table && '대응표가 아직 없다' }, () => {
  const map = data.to_simplified;
  assert.deepEqual(nonStandardChars('规格变更', map), []);
  assert.deepEqual(nonStandardChars('規格變更', map), ['規', '變']);
  assert.equal(toSimplified('規格 變 〈들·다〉', map), '规格 变 〈들·다〉'); // 한글 표지는 그대로
  assert.equal(toSimplified('檢討를 請한다 〈라〉', map), '检讨를 请한다 〈라〉');
  assert.equal(toSimplified('整列 新法 雨', map), '整列 新法 雨'); // 바뀔 것이 없다
});
