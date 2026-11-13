import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTrailingEvidences, parse, rules08, scanExtBlocks } from '../src/index.ts';

test('v0.8.2 코어: 이모지 내용 허용 및 숨김 제어문자·문법 기호 E41/E19 유지', () => {
  const codes = (s: string) => {
    const r = parse(s, { v08: true });
    return [...r.diagnostics, ...(rules08(r, { lang: 'en', profile: 'lon' }) ?? [])].map((d) => d.code);
  };
  assert.deepEqual(codes('<1 · ● [inf,say] deploy ok ✅ 🔥 *5B7>'), []);
  assert.deepEqual(codes('<1 · ● [inf,say] family 👨‍👩‍👧‍👦 ok *5B7>'), []);
  assert.ok(codes('<1 · ● [see,say] bad\u202Edir *5B7>').includes('E41'));
  assert.ok(codes('<1 · ● [see,say] bad\u200Bzwsp *5B7>').includes('E41'));
  assert.ok(codes('<1 · ● [see,say] dot●x *5B7>').includes('E19'));
});

test('v0.8.2 코어: 외부 근거 스캐너와 extractTrailingEvidences는 닫히지 않은 블록에서도 선형 시간으로 동작한다', () => {
  const evil = 'aaaa <[ '.repeat(500);
  const t0 = performance.now();
  const spans = scanExtBlocks(evil);
  const ext = extractTrailingEvidences(`<1 · ● [see,say] ok *5B7> ${evil}`);
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 100, `스캐너 응답 지연: ${elapsed.toFixed(1)}ms`);
  assert.equal(spans.length, 0);
  assert.equal(ext.evidences.length, 0);

  const unclosed = parse('<1 · ● [see,say] ok *5B7> evd1 <[ unclosed block', { v08: true });
  assert.ok(unclosed.diagnostics.some((d) => d.code === 'E02'));
});

test('v0.8.2 코어: W43 NUM_UNIT_RE는 두 자리 이상 양수(85 °C)와 부호 있는 수치 대조를 정확히 처리한다', () => {
  const p85 = parse('<1 · ● [see,say] core temp 85 °C normal *6B7↓evd101> evd101 <[온도 85 °C 유지]>', { v08: true });
  assert.equal(p85.ok, true);
  assert.equal(rules08(p85, { lang: 'en', profile: 'lon' }).length, 0);

  const p12 = parse('<1 · ● [see,say] node db-01 latency 12ms delta -5% ≤ limit *6B7↓evd1> evd1 <[db-01 latency=12ms delta=-5% ≤ limit]>', { v08: true });
  assert.equal(p12.ok, true);
  assert.equal(rules08(p12, { lang: 'en', profile: 'lon' }).length, 0);

  for (const signed of ['+85 °C', '-85 °C', '−85 °C']) {
    const p = parse(`<1 · ● [see,say] temp ${signed} ok *6B7↓evd101> evd101 <[temp ${signed}]>`, { v08: true });
    assert.equal(p.ok, true);
    assert.equal(rules08(p, { lang: 'en', profile: 'lon' }).length, 0);
  }

  const flip = parse('<1 · ● [see,say] temp +85 °C *6B7↓evd101> evd101 <[temp -85 °C]>', { v08: true });
  assert.ok(rules08(flip, { lang: 'en', profile: 'lon' }).some((d) => d.code === 'W43'));

  const ghost = parse('<1 · ● [see,say] core temp 95 °C *6B7↓evd101> evd101 <[온도 85 °C 유지]>', { v08: true });
  assert.ok(rules08(ghost, { lang: 'en', profile: 'lon' }).some((d) => d.code === 'W43' && d.message.includes('95')));
});
