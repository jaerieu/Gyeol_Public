import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  format,
  rules08,
  parseTurn,
  clauseWithEvidence,
  carryDiff,
} from '../src/index.ts';

test('head snapshot / 통째 round-trips through parse and format', () => {
  const srcEn = 'lon 0.8 · snapshot · lang en\n<1 · [see,say] limit 50 kg *B8↓evd101>';
  const pEn = parse(srcEn, { v08: true, issued: ['evd101'] });
  assert.equal(pEn.diagnostics.filter((d) => d.severity === '오류').length, 0);
  assert.equal(pEn.message.head?.snapshot, true);
  assert.match(format(pEn.message), /^lon 0\.8 · snapshot · lang en/u);

  const srcKo = '론 0.8 · 통째 · 언어 ko\n<1 · [see,say] 한도 50 kg *B8↓evd101>';
  const pKo = parse(srcKo, { v08: true, issued: ['evd101'] });
  assert.equal(pKo.diagnostics.filter((d) => d.severity === '오류').length, 0);
  assert.equal(pKo.message.head?.snapshot, true);
});

test('rules08 W45 detects non-1 start and skipped main numbers in snapshot mode, preserves subclauses', () => {
  const nonOne = parse('lon 0.8 · snapshot · lang en\n<2 · [see,say] second only *B8↓evd101>', {
    v08: true,
    issued: ['evd101'],
  });
  const dNonOne = rules08(nonOne, { profile: 'lon', lang: 'en' });
  assert.ok(dNonOne.some((d) => d.code === 'W45'));

  const skipped = parse(
    'lon 0.8 · snapshot · lang en\n<1 · [see,say] first *B8↓evd101>\n<3 · [inf,say] third *B8↓1>',
    { v08: true, issued: ['evd101'] },
  );
  const dSkipped = rules08(skipped, { profile: 'lon', lang: 'en' });
  assert.ok(dSkipped.some((d) => d.code === 'W45'));

  const contiguousWithSub = parse(
    'lon 0.8 · snapshot · lang en\n<1 · [see,say] first *B8↓evd101>\n<1a · [inf,say] detail *B8↓1>\n<2 · [inf,say] second *B8↓1>',
    { v08: true, issued: ['evd101'] },
  );
  const dOk = rules08(contiguousWithSub, { profile: 'lon', lang: 'en' });
  assert.equal(dOk.some((d) => d.code === 'W45'), false);
});

test('rules08 W40 t1 enabled in snapshot mode even under gyeol profile', () => {
  const msg = parse('gyeol 0.8 · snapshot · lang en\n<1 · [see,say] unsupported sight *B8>', { v08: true });
  const diags = rules08(msg, { profile: 'gyeol', lang: 'en' });
  assert.ok(diags.some((d) => d.code === 'W40'));
});

test('E05 gives prefix-in-brackets hint when fix→N is put inside [...]', () => {
  const bad = parse('lon 0.8 · lang en\n<2 · [rec,fix→1,see,say] limit 40 kg *G8>', { v08: true });
  const e05 = bad.diagnostics.find((d) => d.code === 'E05');
  assert.ok(e05);
  assert.match(e05.message, /앞붙이/u);
});

test('parseTurn strips repeated lon:/결: labels across all lines outside <[ ... ]>', () => {
  const raw = [
    'lon: lon 0.8 · snapshot · lang en',
    'lon: <1 · [see,say] raw dose 5 mg *B8↓evd101>',
    'lon: <2 · fix→1 [see,say] revised dose 10 mg *B8↓evd102> evd102 <[',
    'lon: <1 · [see,say] literal body stays untouched',
    ']>',
  ].join('\n');
  const res = parseTurn(raw, { profile: 'lon', lang: 'en', issued: ['evd101', 'evd102'] });
  assert.equal(res.errors.length, 0);
  assert.equal(res.message.clauses.length, 2);
  assert.match(res.message.clauses[1].evidences?.[0]?.text ?? '', /lon: <1/u);
});

test('clauseWithEvidence and carryDiff catch silent edits, drops, and reordering', () => {
  const t1 = parse(
    'lon 0.8 · snapshot · lang en\n<1 · [see,say] limit 50 kg *B8↓evd101> evd101 <[ max 50 kg ]>\n<2 · [inf,say] safe margin 10 kg *B8↓1>',
    { v08: true },
  );
  const t2Ok = parse(
    'lon 0.8 · snapshot · lang en\n<1 · [see,say] limit 50 kg *B8↓evd101> evd101 <[ max 50 kg ]>\n<2 · [inf,say] safe margin 10 kg *B8↓1>\n<3 · fix→1 [see,say] limit 40 kg *G8↓evd102>',
    { v08: true, issued: ['evd102'] },
  );
  const okDiff = carryDiff(t1.message.clauses, t2Ok.message.clauses);
  assert.equal(okDiff.ok, true);
  assert.deepEqual(okDiff.preserved, ['1', '2']);
  assert.deepEqual(okDiff.added, ['3']);
  assert.match(clauseWithEvidence(t1.message.clauses[0]), /evd101 <\[max 50 kg\]>/u);

  const t2Tampered = parse(
    'lon 0.8 · snapshot · lang en\n<1 · [see,say] limit 40 kg *B8↓evd101> evd101 <[ max 40 kg ]>\n<3 · [inf,say] jumped *B8↓1>',
    { v08: true },
  );
  const badDiff = carryDiff(t1.message.clauses, t2Tampered.message.clauses);
  assert.equal(badDiff.ok, false);
  assert.deepEqual(badDiff.dropped, ['2']);
  assert.equal(badDiff.altered.length, 1);
  assert.equal(badDiff.altered[0].label, '1');
  assert.deepEqual(badDiff.added, ['3']);
});
