// D단계(게이트웨이 참조 복사 `ref_copy` 및 `[L시작:L끝]` 줄 범위 인용) 코어·유닛 시험이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  format,
  glossClause,
  normalizeEvdId,
  parse,
  resolveRefCopyTurn,
  rules08,
  sliceEvidenceLines,
} from '../src/index.ts';

test('줄 범위 외부 근거 인용([L1:L5], [L3], [L3:L3] 정규화 및 E32 거부)', () => {
  const src = [
    'gyeol 0.8 · lang ko',
    '<1 ·→B [see,say] "점검 필요" *G8↓evd101[L1:L5]>',
    '<2 ·→B [see,say] "단일 줄" *G8↓evd101[L3:L3]>',
    'evd101 <[ 1줄\n2줄\n3줄\n4줄\n5줄\n6줄 ]>',
  ].join('\n');
  const parsed = parse(src, { v08: true });
  assert.equal(parsed.ok, true, JSON.stringify(parsed.diagnostics));
  assert.deepEqual(parsed.message.clauses[0].because, [{ ext: 'evd', id: '101', lines: [1, 5] }]);
  assert.deepEqual(parsed.message.clauses[1].because, [{ ext: 'evd', id: '101', lines: [3, 3] }]);

  const rendered = format(parsed.message, { head: true });
  assert.ok(rendered.includes('↓evd101[L1:L5]'));
  assert.ok(rendered.includes('↓evd101[L3]'));
  assert.ok(!rendered.includes('[L3:L3]'));

  const g = glossClause(parsed.message.clauses[0], 'ko');
  assert.ok(g.includes('증101[L1:L5]'));
  const gEn = glossClause(parsed.message.clauses[0], 'en');
  assert.ok(gEn.includes('evd101[L1:L5]'));

  const badZero = parse('gyeol 0.8 · lang ko\n<1 ·→B [see,say] "영번줄" *G8↓evd101[L0]>', { v08: true });
  assert.equal(badZero.ok, false);
  assert.ok(badZero.diagnostics.some((d) => d.code === 'E32'));

  const badOrder = parse('gyeol 0.8 · lang ko\n<1 ·→B [see,say] "역전" *G8↓evd101[L5:L2]>', { v08: true });
  assert.equal(badOrder.ok, false);
  assert.ok(badOrder.diagnostics.some((d) => d.code === 'E32'));
});

test('W43은 줄 범위가 주어지면 해당 줄 조각만 대조하고 범위 밖이면 경고를 낸다', () => {
  const evdBlock = 'evd101 <[ 1줄: 상태 정상\n2줄: 응답 420ms 지연\n3줄: 재시도 대기 ]>';
  const line2Ok = parse(
    `gyeol 0.8 · lang ko\n<1 ·→B [see,say] 지연 420ms *G8↓evd101[L2]>\n${evdBlock}`,
    { v08: true },
  );
  const wLine2Ok = rules08(line2Ok, { lang: 'ko', profile: 'gyeol', spec: '0.8', issued: ['evd101'] });
  assert.equal(wLine2Ok.filter((d) => d.code === 'W43').length, 0);

  const line1Ghost = parse(
    `gyeol 0.8 · lang ko\n<1 ·→B [see,say] 지연 420ms *G8↓evd101[L1]>\n${evdBlock}`,
    { v08: true },
  );
  const wLine1Ghost = rules08(line1Ghost, { lang: 'ko', profile: 'gyeol', spec: '0.8', issued: ['evd101'] });
  assert.equal(wLine1Ghost.filter((d) => d.code === 'W43').length, 1);

  const outRange = parse(
    `gyeol 0.8 · lang ko\n<1 ·→B [see,say] 지연 420ms *G8↓evd101[L9]>\n${evdBlock}`,
    { v08: true },
  );
  const wOutRange = rules08(outRange, { lang: 'ko', profile: 'gyeol', spec: '0.8', issued: ['evd101'] });
  assert.equal(wOutRange.filter((d) => d.code === 'W43').length, 1);

  // preSlicedExt: 게이트웨이가 L2 한 줄만 잘라 evd101 블록으로 붙였을 때도 정상 통과
  const preSliced = parse(
    'gyeol 0.8 · lang ko\n<1 ·→B [see,say] 지연 420ms *G8↓evd101[L2]>\nevd101 <[ 2줄: 응답 420ms 지연 ]>',
    { v08: true },
  );
  const wPreSliced = rules08(preSliced, {
    lang: 'ko',
    profile: 'gyeol',
    spec: '0.8',
    issued: ['evd101'],
    preSlicedExt: true,
  });
  assert.equal(wPreSliced.filter((d) => d.code === 'W43').length, 0);
});

test('normalizeEvdId·sliceEvidenceLines 및 다섯 조건 resolveRefCopyTurn 대칭·위조 차단·권한 검사', () => {
  assert.equal(normalizeEvdId('↓evd101'), 'evd101');
  assert.equal(normalizeEvdId('증１０２'), 'evd102');
  assert.equal(normalizeEvdId('ref1'), null);

  const doc = '첫째 줄 10ms\n둘째 줄 85 °C\n셋째 줄 오류 없음';
  assert.deepEqual(sliceEvidenceLines(doc, [2, 2]), { text: '둘째 줄 85 °C', outOfRange: false });
  assert.deepEqual(sliceEvidenceLines(doc, [2, 4]), { text: '', outOfRange: true });

  const store = { evd101: doc, evd201: 'B 전용 비밀 수치 999ms' };
  const allowedIds = ['evd101'];

  // 1) gyeol: 위조 evd101 삭제, 바깥 ref1 보존, 정본 L2 삽입, 미허가 evd201 차단
  const gy = resolveRefCopyTurn({
    condition: 'gyeol',
    rawText:
      '<1 ·→B [see,say] 온도 85 °C 확인 *G8↓evd101[L2]>\n<1.1 ·→B [see,say] B 자료 추측 *G5↓evd201>\nevd101 <[ 가짜 999 °C ]>\nref1 <[ 바깥 참고 링크 ]>',
    store,
    allowedIds,
    parseOptions: { v08: true },
  });
  assert.deepEqual(gy.citedIds, ['evd101']);
  assert.deepEqual(gy.unauthorizedIds, ['evd201']);
  assert.deepEqual(gy.strippedSpoofs, ['evd101']);
  assert.equal(gy.resolvedSlices['evd101[L2]'], '둘째 줄 85 °C');
  assert.ok(!gy.shownText.includes('가짜 999 °C'));
  assert.ok(gy.shownText.includes('ref1 <[ 바깥 참고 링크 ]>'));
  assert.ok(gy.shownText.includes('evd101 <[둘째 줄 85 °C]>'));
  assert.ok(!gy.shownText.includes('B 전용 비밀 수치'));

  // 2) lon
  const lon = resolveRefCopyTurn({
    condition: 'lon',
    rawText: '<1 ·→B [see,say] 정상 *8B8↓evd101[L3]>',
    store,
    allowedIds,
    parseOptions: { v08: true },
  });
  assert.deepEqual(lon.citedIds, ['evd101']);
  assert.ok(lon.shownText.includes('evd101 <[셋째 줄 오류 없음]>'));

  // 3) json
  const js = resolveRefCopyTurn({
    condition: 'json',
    rawText: JSON.stringify({
      turn: 1,
      relay: [
        { q: 'evd101', lines: [2, 2], text: '가짜 값 0 °C', trust: 8 },
        { q: 'evd201', text: 'B 비밀 몰래 적음', trust: 5 },
      ],
      clauses: [{ id: '1', to: 'B', stance: null, target: null, epistemic: 'see', act: 'say', claim: '확인', confidence: 8, grounds: ['evd101'] }],
    }),
    store,
    allowedIds,
  });
  const parsedJs = JSON.parse(js.shownText);
  assert.equal(parsedJs.relay[0].text, '둘째 줄 85 °C');
  assert.equal(parsedJs.relay[1].text, undefined);
  assert.deepEqual(js.citedIds, ['evd101']);
  assert.deepEqual(js.unauthorizedIds, ['evd201']);
  assert.deepEqual(js.strippedSpoofs, ['evd101', 'evd201']);

  // 4) natural
  const nat = resolveRefCopyTurn({
    condition: 'natural',
    rawText: '[evd101[L2] 참조 믿음 8] "가짜 999" 참고하고 [evd201 참조 믿음 4] 확인해.',
    store,
    allowedIds,
  });
  assert.ok(nat.shownText.includes('[evd101[L2] 그대로 믿음 8] "둘째 줄 85 °C"'));
  assert.ok(nat.shownText.includes('[evd201 권한없음]'));
  assert.ok(!nat.shownText.includes('가짜 999'));
  assert.deepEqual(nat.strippedSpoofs, ['evd101']);

  // 5) control
  const ctrl = resolveRefCopyTurn({
    condition: 'control',
    rawText: '1. B에게, 직접 봄으로, 말함: [evd101[L1:L2] 참조] "위조". 확신 8. evd101번에 기댄다.',
    store,
    allowedIds,
  });
  assert.ok(ctrl.shownText.includes('[evd101[L1:L2]] "첫째 줄 10ms 둘째 줄 85 °C"'));
  assert.ok(!ctrl.shownText.includes('위조'));
});
