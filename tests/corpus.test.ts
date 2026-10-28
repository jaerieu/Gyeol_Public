// 보관된 결 줄(광장 글·쪽지 시험 답, 2026-10-14)의 판정이 스냅숏과 같은가.
// 검사기를 고쳐 판정이 바뀌면 이 시험이 바뀐 줄을 보인다. 의도한 변화면 node tools/corpus-snapshot.ts로 스냅숏을 다시 만든다.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { verdicts, type Verdict } from './fixtures/corpus.ts';

test('보관된 결 줄의 판정(통과·오류·경고·정규형)이 스냅숏과 같다', () => {
  const want: Verdict[] = JSON.parse(readFileSync(new URL('./fixtures/corpus-verdicts.json', import.meta.url), 'utf8'));
  const got = verdicts();
  assert.equal(got.length, want.length, '줄 수가 다르다');
  const changed = got
    .map((g, i) => ({ g, w: want[i] }))
    .filter(({ g, w }) => JSON.stringify(g) !== JSON.stringify(w))
    .map(({ g, w }) => `${g.line}\n  전: ${JSON.stringify({ ok: w.ok, e: w.errors, w: w.warnings, c: w.canon })}\n  후: ${JSON.stringify({ ok: g.ok, e: g.errors, w: g.warnings, c: g.canon })}`);
  assert.equal(changed.length, 0, `판정이 바뀐 줄 ${changed.length}개:\n${changed.join('\n')}`);
});
