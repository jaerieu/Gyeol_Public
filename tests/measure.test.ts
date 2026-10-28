import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, harmony, altInterval, calibrate, parseScale, effortFrom, mukFromClusters, foldLevelFor, beatHz, formatNumber } from '../src/index.ts';

const clause = (s: string) => parse(s).message.clauses[0];

test('화음 판정: 명세 6.4절의 표', () => {
  assert.deepEqual(harmony(clause('明日 雨 〈겠·다〉 〔확신 .40@se8〕 「조심」')), { e: 0.45, m: 0.4, d: 0.05, verdict: '화음', direction: '과신 쪽', source: '조심' });
  const h2 = harmony(clause('空入力에도 確實하다 〈봄·다〉 〔확신 .30@se8〕 「단호」'))!;
  assert.equal(h2.verdict, '불협');
  assert.equal(h2.direction, '과신 쪽');
  assert.equal(h2.d, 0.6);
  const h3 = harmony(clause('明日 雨 〈겠·다〉 〔확신 .90@se8〕 「망설임」'))!;
  assert.equal(h3.verdict, '불협');
  assert.equal(h3.direction, '겸양 쪽');
  assert.equal(h3.d, -0.6);
});

test('화음 판정: 자신이 어조보다 먼저다', () => {
  const h = harmony(clause('雨 〈겠·다〉 〔확신 .60@se8〕 「단호 · 자신 .55」'))!;
  assert.equal(h.source, '자신');
  assert.equal(h.verdict, '화음');
});

test('화음 판정: 먹이나 드러낸 확신이 없으면 하지 않는다', () => {
  assert.equal(harmony(clause('雨 〈겠·다〉 「단호」')), null);
  assert.equal(harmony(clause('雨 〈겠·다〉 〔확신 .60@se8〕 「반가움」')), null);
});

test('대안음 음정: 확률 비로 정한다(8.3절)', () => {
  assert.deepEqual(altInterval([{ r: '新', p: 0.72 }, { r: '改', p: 0.21 }]), { r: 0.29, interval: '단3도' });
  assert.equal(altInterval([{ r: 'a', p: 0.5 }, { r: 'b', p: 0.4 }])!.interval, '단2도');
  assert.equal(altInterval([{ r: 'a', p: 0.9 }, { r: 'b', p: 0.05 }])!.interval, '완전5도');
  // 전체 확률이 작아도 비가 같으면 같은 판단
  assert.equal(altInterval([{ r: 'a', p: 0.3 }, { r: 'b', p: 0.25 }])!.interval, '단2도');
});

test('척도 꺾은선: 명세 5.5절의 보기 .85 → .81', () => {
  const pts = parseScale('.80=.74');
  assert.deepEqual(pts, [[0.8, 0.74]]);
  const v = calibrate(0.85, pts);
  assert.equal(Number(v.toFixed(3)), 0.805);
  assert.equal(formatNumber(v), '.81');
  assert.equal(calibrate(0, pts), 0);
  assert.equal(calibrate(1, pts), 1);
  assert.equal(Number(calibrate(0.4, pts).toFixed(3)), 0.37);
});

test('노력 정규화: 기준값에서 .50, 1,500 토큰은 .60', () => {
  assert.equal(effortFrom(1000, '토큰'), 0.5);
  assert.equal(effortFrom(1500, '토큰'), 0.6);
  assert.equal(effortFrom(10000, '지연'), 0.5);
  assert.equal(effortFrom(2000, '토큰', 2000), 0.5);
});

test('뜻 무리에서 대안과 확신: 8번 중 6번이 新法', () => {
  const r = mukFromClusters(
    [
      { root: '新', count: 6 },
      { root: '改', count: 2 },
    ],
    0,
  );
  assert.deepEqual(r, { alt: [{ r: '新', p: 0.75 }, { r: '改', p: 0.25 }], conf: 0.75, method: 'se8' });
});

test('접는 수준과 맥놀이(7.4, 7.6절)', () => {
  assert.equal(foldLevelFor(1), '점');
  assert.equal(foldLevelFor(0.9), '점');
  assert.equal(foldLevelFor(0.75), '절');
  assert.equal(foldLevelFor(0.5), '펼침');
  assert.equal(beatHz(1), 0);
  assert.equal(beatHz(0.75), 2);
});
