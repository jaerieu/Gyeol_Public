// 결 v0.8.5 통합 코어 시험 (gyeol 0.8.5 · lon 0.8.5 · Muk 0.8.5 · 2계층 진단 · calcN · LedgerContext · RFC 8785 JCS · 520건 왕복 퍼징)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MUK,
  MUK_SPEC_VERSION,
  agentMuk,
  commitTurn,
  consensusWeight,
  counterShare,
  credibility,
  evaluateCalcExpression,
  format,
  formatLedgerView,
  formatMukToken,
  formatTurn,
  generateEbnf,
  generateGbnf,
  jcsSha256,
  jcsStringify,
  LedgerContext,
  mukStatusOf,
  parse,
  parseTurn,
  poolConsensus,
  propagateCalculations,
  rules08,
  summarizeAnswers,
  tierOfCode,
  verifyMessageCalculations,
} from '../src/index.ts';

const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);

test('Muk 0.8.5: 상태 분리(unmeasured/provisional/calibrated), Kish n_eff, 비대칭 과신 벌점, expectedConf 및 lon 면제', () => {
  assert.equal(MUK.version, '0.8.5');
  assert.equal(MUK_SPEC_VERSION, '0.8.5');
  assert.equal(mukStatusOf(0), 'unmeasured');
  assert.equal(mukStatusOf(1), 'provisional');
  assert.equal(mukStatusOf(11), 'provisional');
  assert.equal(mukStatusOf(12), 'calibrated');

  const unm = agentMuk({}, NOW);
  assert.equal(unm.status, 'unmeasured');
  assert.equal(unm.grade, 5);
  assert.equal(formatMukToken(unm), '?');

  const prov = agentMuk({ folds: [{ at: NOW, s: summarizeAnswers(Array.from({ length: 6 }, () => ({ ok: true, conf: 9 }))) }] }, NOW);
  assert.equal(prov.status, 'provisional');
  assert.equal(prov.n, 6);
  assert.equal(credibility([{ at: NOW, s: summarizeAnswers(Array.from({ length: 6 }, () => ({ ok: true, conf: 9 }))) }], 5).rawAll, 6);

  // Kish n_eff 추적: 여러 회차 감쇠 후에도 neff가 양수이며 rawAll 이하
  const oldFold = { at: NOW - 86_400_000 * 5, s: summarizeAnswers(Array.from({ length: 20 }, (_, i) => ({ ok: i < 17, conf: 8 }))) };
  const newFold = { at: NOW, s: summarizeAnswers(Array.from({ length: 20 }, (_, i) => ({ ok: i < 17, conf: 8 }))) };
  const cal = credibility([oldFold, newFold], 5);
  assert.equal(cal.status, 'calibrated');
  assert.ok(cal.neff > 25 && cal.neff <= 40, `unexpected neff=${cal.neff}`);

  // 비대칭 과신 벌점: 같은 크기의 편차라도 과신(p=0.95, hit=0.65)이 신중한 과소확신(p=0.65, hit=0.95)보다 gap이 크다
  const overConf = credibility([{ at: NOW, s: summarizeAnswers(Array.from({ length: 40 }, (_, i) => ({ ok: i < 26, conf: 9 }))) }], 5);
  const underConf = credibility([{ at: NOW, s: summarizeAnswers(Array.from({ length: 40 }, (_, i) => ({ ok: i < 38, conf: 6 }))) }], 5);
  assert.ok((overConf.gap ?? 0) > (underConf.gap ?? 0), `over=${overConf.gap} under=${underConf.gap}`);

  // continuous expectedConf 훅 지원
  const contSummary = summarizeAnswers([
    { ok: true, expectedConf: 8.6 },
    { ok: false, expectedConf: 2.2 },
    { ok: true, expectedConf: 7.4 },
  ]);
  assert.ok(Array.isArray(contSummary.ps));
  assert.equal(contSummary.n, 3);
  assert.equal(contSummary.miss, 0);

  // lon 0.8.5 Chae 부재 페널티 면제: color=null이어도 conf가 있으면 miss=0, conf가 없으면 miss=1
  const lonSummary = summarizeAnswers([
    { ok: true, conf: 8, color: null, profile: 'lon' },
    { ok: false, conf: null, color: null, profile: 'lon' },
  ]);
  assert.equal(lonSummary.n, 1);
  assert.equal(lonSummary.miss, 1);

  // counterShare 대 consensusWeight 및 poolConsensus(불량 셀 Grade<=2 감쇠)
  const wBad = consensusWeight({ grade: 2, status: 'calibrated' }, 9);
  const wGood = consensusWeight({ grade: 9, status: 'calibrated' }, 9);
  assert.equal(wBad, 0);
  assert.ok(wGood > 0.7);
  assert.ok(counterShare(2, 9) >= MUK.share.floor);
  const pooled = poolConsensus([
    { prob: 0.99, muk: { grade: 1, status: 'calibrated' }, conf: 9 },
    { prob: 0.10, muk: { grade: 9, status: 'calibrated' }, conf: 9 },
  ], { mode: 'log-odds' });
  assert.ok(pooled.prob < 0.25, `bad cell leaked into pool: ${pooled.prob}`);
});

test('프로파일별 꼬리 분기 및 정규화: gyeol 0.8.5(*5B8 / *?B8 / E33) 대 lon 0.8.5(*5:8 / *?:8 / *:8 / W47 / W48)', () => {
  // gyeol 0.8.5: *?B8 허용, *5:8은 E32, Chae 누락은 E33
  const gUnm = parse('gyeol 0.8.5 · lang en\n<1 · ● [see,say] baseline metric 10 *?B8↓T0>');
  assert.deepEqual(gUnm.diagnostics, []);
  assert.equal(format(gUnm.message), 'gyeol 0.8.5 · lang en\n<1 · ● [see,say] baseline metric 10 *?B8↓T0>\n');
  assert.ok(parse('gyeol 0.8.5 · lang en\n<1 · ● [see,say] colon tail rejected *5:8>').diagnostics.some((d) => d.code === 'E32'));
  assert.ok(parse('gyeol 0.8.5 · lang en\n<1 · ● [see,say] malformed chae *58>').diagnostics.some((d) => d.code === 'E26'));
  assert.ok(rules08(parse('gyeol 0.8.5 · lang en\n<1 · ● [see,say] missing chae>')).some((d) => d.code === 'E33'));

  // lon 0.8.5: *:8, *8 -> formatTurn 정규형 *:8 / 스탬프 *5:8 / 미측정 *?:8
  for (const rawTail of ['*:8', '*8']) {
    const r = parseTurn(`lon:\n<1 · ● [see,say] latency 12ms ${rawTail}↓evd1> evd1 <[ latency 12ms ]>`, { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
    assert.deepEqual(r.errors, [], rawTail);
    assert.equal(formatTurn(r), '<1 · ● [see,say] latency 12ms *:8↓evd1> evd1 <[latency 12ms]>\n');
    assert.equal(formatTurn(r, { stampInk: 5 }), '<1 · ● [see,say] latency 12ms *5:8↓evd1> evd1 <[latency 12ms]>\n');
    assert.equal(formatTurn(r, { stampInk: '?' }), '<1 · ● [see,say] latency 12ms *?:8↓evd1> evd1 <[latency 12ms]>\n');
  }
  const rHeaded = parseTurn(`lon 0.8.5 · delta · lang en\n<1 · ● [see,say] latency 12ms *8↓evd1> evd1 <[ latency 12ms ]>`, { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
  assert.equal(formatTurn(rHeaded, { stampInk: 5 }), 'lon 0.8.5 · delta · lang en\n<1 · ● [see,say] latency 12ms *5:8↓evd1> evd1 <[latency 12ms]>\n');

  // lon 0.8.5 구식 Chae(*5B8) 자동 정규화(W47, tier='form') 및 중복 꼬리 복구(W48, tier='form')
  const legacyChae = parseTurn('<1 · ● [see,say] reading 42ms *5B8↓evd1> evd1 <[ 42ms ]>', { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
  assert.equal(legacyChae.errors.length, 0);
  assert.ok(legacyChae.warnings.some((w) => w.code === 'W47' && w.tier === 'form'));
  assert.equal(format(legacyChae.message), '<1 · ● [see,say] reading 42ms *5:8↓evd1> evd1 <[42ms]>\n');

  const dupTail = parseTurn('<1 · [see,say] sensor ok *5:8 *5:8↓evd1> evd1 <[ ok ]>', { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
  assert.equal(dupTail.errors.length, 0);
  assert.ok(dupTail.warnings.some((w) => w.code === 'W48' && w.tier === 'form'));
});

test('진단 2계층(form vs content) 및 [inf,lim] 화행 자동 복원(W49) & 본문 화살표 스팬 격리', () => {
  assert.equal(tierOfCode('W47'), 'form');
  assert.equal(tierOfCode('W48'), 'form');
  assert.equal(tierOfCode('W49'), 'form');
  assert.equal(tierOfCode('W43'), 'content');
  assert.equal(tierOfCode('E_CALC_SYNTAX'), 'content');
  assert.equal(tierOfCode('E_CALC_MISMATCH'), 'content');
  assert.equal(tierOfCode('E_STALE_INF'), 'content');

  // lon 0.8.5 [inf,lim] -> [inf,lim,say] (W49, tier='form')
  const limNoAct = parseTurn('<1 · [see,say] A is 10 *?:8↓T0>\n<2 · ↔1 [inf,lim] conflict unresolved *?:8↓T0>', { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
  assert.equal(limNoAct.errors.length, 0);
  assert.ok(limNoAct.warnings.some((w) => w.code === 'W49' && w.tier === 'form'));
  assert.equal(limNoAct.message.clauses[1].marks.act, 'say');

  // [표지] 뒤 본문 내부 화살표 스팬 격리 vs 앞부분 오타 E19 유지
  const isolated = parse('gyeol 0.8.5 · lang ko\n<1 · ● [see,say] 로그에서 sup→로 전파되고 fix→하루참 뒤 ↔로 이어졌다 *5B8↓T0>');
  assert.deepEqual(isolated.diagnostics, []);
  const badPrefix = parse('gyeol 0.8.5 · lang ko\n<1 · ● sup→ [inf,say] 앞부분 접두사 오류 *5B8↓T0>');
  assert.ok(badPrefix.diagnostics.some((d) => d.code === 'E19'));
});

test('calcN 파생 수식 평가기·불일치(E_CALC_MISMATCH)·미갱신(E_STALE_INF) 및 위상 연쇄 전파(propagateCalculations)', () => {
  // 순수 재귀 하강 평가기 단위 검증
  const ev = evaluateCalcExpression('round((@1 * 1.2 + min(@2, 50)) / 3, 2)', (k) => ({ '1': 100, '2': 80 })[k] ?? null);
  assert.equal(ev.ok, true);
  assert.equal(ev.value, 56.67);
  assert.deepEqual(ev.deps.sort(), ['1', '2']);

  // 정상 calcN 일치 (0 오류)
  const goodDoc = [
    'lon 0.8.5 · delta · lang en',
    '<1 · [see,say] price is 40 *5:9↓evd1> evd1 <[ price = 40 ]>',
    '<2 · [see,say] tax is 8 *5:9↓evd2> evd2 <[ tax = 8 ]>',
    '<3 · [inf,say] total is 48 *5:9↓1↓2↓calc3> calc3 <[@1 + @2]>',
  ].join('\n');
  const pGood = parseTurn(goodDoc, { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' });
  assert.deepEqual(pGood.diagnostics, []);

  // 계산 불일치 -> E_CALC_MISMATCH (tier='content')
  const badMath = parseTurn(
    'lon 0.8.5 · delta · lang en\n<1 · [see,say] price is 40 *5:9↓evd1> evd1 <[ price = 40 ]>\n<2 · [inf,say] doubled is 99 *5:9↓1↓calc2> calc2 <[@1 * 2]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' },
  );
  assert.ok(badMath.errors.some((d) => d.code === 'E_CALC_MISMATCH' && d.tier === 'content'));

  // 잘못된 수식 토큰 -> E_CALC_SYNTAX
  const badSyntax = parseTurn(
    'lon 0.8.5 · delta · lang en\n<1 · [inf,say] hacked is 42 *5:9↓calc1> calc1 <[process.exit(1)]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en' },
  );
  assert.ok(badSyntax.errors.some((d) => d.code === 'E_CALC_SYNTAX' && d.tier === 'content'));
});

test('LedgerContext, RFC 8785 JCS 해시 체인 및 다중 턴 E_STALE_INF + propagateCalculations', async () => {
  assert.equal(jcsStringify({ b: -0, a: [true, 'x'] }), '{"a":[true,"x"],"b":0}');
  assert.equal(await jcsSha256({ z: 1, a: 2 }), await jcsSha256({ a: 2, z: 1 }));

  const ledger = new LedgerContext();
  const t1 = parseTurn(
    [
      'lon 0.8.5 · delta · lang en',
      '<1 · [see,say] base cost is 100 *5:9↓evd1> evd1 <[ cost = 100 ]>',
      '<2 · [inf,say] doubled budget is 200 *5:9↓1↓calc2> calc2 <[@1 * 2]>',
      '<3 · [inf,say] with buffer is 220 *5:9↓2↓calc3> calc3 <[@2 + 20]>',
    ].join('\n'),
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger },
  );
  assert.deepEqual(t1.errors, []);
  const b1 = await commitTurn(ledger, t1.message, { turn: 1 });
  assert.equal(b1.turn, 1);

  // turnNo 일치(1.1) 및 불일치(E46) 검증
  const subTurn = parseTurn('lon 0.8.5 · delta · lang en\n<1 · [see,say] a *5:8↓T0>\n<1.1 · [inf,say] b *5:8↓1>', { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', turnNo: 1 });
  assert.deepEqual(subTurn.errors, []);
  const badTurn = parseTurn('lon 0.8.5 · delta · lang en\n<2 · [see,say] wrong *5:8↓T0>', { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', turnNo: 1 });
  assert.ok(badTurn.errors.some((d) => d.code === 'E46'));

  // Turn 2: <4 · fix→1>로 원가 150 수정만 하고 하위 <2>, <3> 미갱신 시 E_STALE_INF 경보
  const t2Stale = parseTurn(
    'lon 0.8.5 · delta · lang en\n<4 · fix→1 [see,say] base cost is 150 *5:9↓evd2> evd2 <[ cost = 150 ]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger },
  );
  assert.ok(t2Stale.errors.some((d) => d.code === 'E_STALE_INF' && d.tier === 'content'));

  // 호스트 결정론적 연쇄 재계산 전파(S2): calc2(@1*2 -> 300) 및 calc3(@2+20 -> 320) 자동 fix→ 생성
  const ledgerAuto = new LedgerContext();
  await commitTurn(ledgerAuto, t1.message, { turn: 1 });
  const t2Root = parse('lon 0.8.5 · delta · lang en\n<4 · fix→1 [see,say] base cost is 150 *5:9↓evd2> evd2 <[ cost = 150 ]>', {
    profile: 'lon',
    spec: '0.8.5',
    priorClauses: [...ledgerAuto.activeClausesMap().values()],
    priorEvidences: ledgerAuto.priorEvidences,
  });
  await commitTurn(ledgerAuto, t2Root.message, { turn: 2 });
  const fixes = propagateCalculations({
    activeClauses: ledgerAuto.activeClausesMap(),
    dependentsOf: ledgerAuto.dependentsOf,
    changedTargets: ['1'],
    nextClauseNumStart: 5,
    profile: 'lon',
    defaultTail: '*5:9',
  });
  assert.equal(fixes.length, 2);
  assert.equal(fixes[0].newValue, 300);
  assert.equal(fixes[1].newValue, 320);
  const cascade = verifyMessageCalculations(
    parseTurn('lon 0.8.5 · delta · lang en\n' + fixes.map((f) => f.line).join('\n'), {
      profile: 'lon',
      spec: '0.8.5',
      mode: 'delta',
      lang: 'en',
      ledger: ledgerAuto,
    }).message,
    { priorClauseByNum: ledgerAuto.activeClausesMap(), dependentsOf: ledgerAuto.dependentsOf, alreadySuperseded: ledgerAuto.supersededSet() },
  );
  assert.deepEqual(cascade.diagnostics, []);

  // openConflicts 추출(↔k + lim)
  const tConflict = parseTurn(
    'lon 0.8.5 · delta · lang en\n<5 · ↔1 [see,lim,say] audit shows cost is 180 *5:6↓evd3> evd3 <[ cost = 180 ]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger },
  );
  await commitTurn(ledger, tConflict.message, { turn: 2 });
  assert.equal(ledger.openConflicts.length, 1);
  assert.equal(ledger.openConflicts[0].targetNum, '1');
});

test('EBNF / GBNF 문법 생성기 및 schema/gyeol-0.8.5.schema.json 정합성', () => {
  const ebnf = generateEbnf({ profile: 'lon', edition: '0.8.5', mode: 'delta' });
  const gbnfLon = generateGbnf({ profile: 'lon', edition: '0.8.5', mode: 'delta' });
  const gbnf = generateGbnf({ profile: 'gyeol', edition: '0.8.5' });
  assert.match(ebnf, /lon 0\.8\.5/);
  assert.match(ebnf, /tail\s*=\s*"\*" , \[ digit \| "\?" \] , ":" , digit/);
  assert.match(gbnfLon, /"\*" \(\[0-9\] \| "\?"\)\? ":" \[0-9\]/);
  assert.match(gbnf, /gyeol 0\.8\.5/);
  const schema = JSON.parse(readFileSync(new URL('../schema/gyeol-0.8.5.schema.json', import.meta.url), 'utf8'));
  assert.ok(String(schema.$id).endsWith('gyeol-0.8.5.schema.json'));
  assert.equal(schema.properties.gyeol.pattern, '^\\d+\\.\\d+(?:\\.\\d+)?$');
  assert.deepEqual(schema.properties.profile.enum, ['gyeol', 'lon']);
});

test('결정론적 시드 기반 520건 왕복 퍼징(gyeol 0.8.5 · lon 0.8.5 delta/snapshot · JCS SHA-256 항등성)', async () => {
  let seed = 0x51a7085;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000;
  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];

  const LANGS = ['en', 'ko', 'ja', 'de'] as const;
  const ACTS = ['see', 'rec', 'inf', 'if'] as const;
  const COLORS = ['R', 'G', 'B', 'C', 'M', 'Y', 'K'] as const;
  const BODIES: Record<string, readonly string[]> = {
    en: ['node alpha metric', 'batch latency ratio', 'relay delta count', 'sensor drift bound'],
    ko: ['핵심 core 수치', '장치 status 확인', 'sup→로 전파된 value', 'fix→하루참 기록 step'],
    ja: ['解析 status 基準', '記録 batch 値', 'センサー delta 値'],
    de: ['Messwert delta norm', 'Status batch wert', 'Knoten alpha index'],
  };

  for (let i = 0; i < 520; i++) {
    const isLon = i % 2 === 1;
    const lang = pick(LANGS);
    const mode = isLon ? (i % 4 === 1 ? 'delta' : 'snapshot') : 'snapshot';
    const header = isLon
      ? `lon 0.8.5 · ${mode} · lang ${lang}`
      : `gyeol 0.8.5 · lang ${lang}`;

    const nClauses = 1 + (i % 4);
    const lines: string[] = [header];
    let hasFirstNum = false;
    let hasCalcOn1 = false;
    const baseVal = 10 + (i % 90);

    for (let c = 1; c <= nClauses; c++) {
      const ev = c === 1 ? 'see' : pick(ACTS);
      const val = c === 1 ? baseVal : c === 2 && hasFirstNum ? baseVal * 2 : baseVal + c;
      if (c === 1) hasFirstNum = true;

      const dot = c % 2 === 0 ? '·→ops1' : '· ●';
      const prefix =
        c >= 2 && rnd() < 0.35
          ? pick(hasCalcOn1 ? ['sup→1', '↔1'] : ['fix→1', 'sup→1', '↔1'])
          : c >= 3 && rnd() < 0.25
            ? `err→2`
            : '';
      const fig = !isLon && rnd() < 0.15 ? 'pdx' : prefix.startsWith('↔') ? 'lim' : !isLon && ev === 'see' && rnd() < 0.15 ? 'new' : '';
      const tense = rnd() < 0.2 ? pick(['pst', 'fut']) : '';
      const act = prefix.startsWith('↔') || fig === 'new' ? 'say' : pick(['say', 'say', 'say', 'ack']);
      const marks = `[${[ev, ...(fig ? [fig] : []), ...(tense ? [tense] : []), act].join(',')}]`;

      const mukTok = rnd() < 0.2 ? '?' : String(Math.floor(rnd() * 10));
      const confDigit = String(Math.floor(rnd() * 10));
      const tailMain = isLon ? `*${mukTok}:${confDigit}` : `*${mukTok}${pick(COLORS)}${confDigit}`;

      const mustBindCalc =
        isLon && mode === 'delta' && ev === 'inf' && act === 'say' && !fig && !prefix.startsWith('fix→') && !prefix.startsWith('err→');
      const useCalc = (c === 2 && !prefix.startsWith('fix→') && !prefix.startsWith('err→') && rnd() < 0.4) || (c >= 2 && mustBindCalc);
      if (useCalc) hasCalcOn1 = true;
      const evdId = `${i * 10 + c}`;
      const grounds = c === 1
        ? `↓evd${evdId}`
        : useCalc
          ? `↓1↓calc${c}`
          : `↓1↓evd${evdId}`;

      const body =
        isLon && mode === 'delta' && ev === 'inf' && act === 'say' && !fig && !useCalc
          ? `${pick(BODIES[lang])} qualitative synthesis`
          : `${pick(BODIES[lang])} is ${val}`;
      let extraBlock = '';
      if (!useCalc) {
        // 외부 근거 블록 내부에는 > / < 등 예약 문자 포함 가능
        const evContent = `record_${i}_${c}: value = ${val}; cmp a > 0 && b < 9`;
        extraBlock = ` evd${evdId} <[${evContent}]>`;
      } else {
        const calcExpr = c === 2 ? `@1 * 2` : `@1 + ${c}`;
        extraBlock = ` calc${c} <[${calcExpr}]>`;
      }

      const headParts = [String(c), dot, ...(prefix ? [prefix] : []), marks, body, `${tailMain}${grounds}`];
      lines.push(`<${headParts.join(' ')}>${extraBlock}`);
    }

    const rawDoc = lines.join('\n');
    const r1 = parse(rawDoc, { v08: true, profile: isLon ? 'lon' : 'gyeol', mode: isLon ? mode : undefined });
    assert.deepEqual(r1.diagnostics, [], `fuzz case ${i} failed parse:\n${rawDoc}`);
    const canon1 = format(r1.message);
    const r2 = parse(canon1, { v08: true, profile: isLon ? 'lon' : 'gyeol', mode: isLon ? mode : undefined });
    assert.deepEqual(r2.diagnostics, [], `fuzz case ${i} failed re-parse:\n${canon1}`);
    const canon2 = format(r2.message);
    assert.equal(canon2, canon1, `fuzz case ${i} non-idempotent format`);
    const h1 = await jcsSha256(r1.message.clauses);
    const h2 = await jcsSha256(r2.message.clauses);
    assert.equal(h2, h1, `fuzz case ${i} JCS SHA-256 mismatch`);
  }
});

test('v0.8.5-rc2: consensusWeight 기저 역량(ability) 단조 증가성 (rate · grade · peer score)', () => {
  // 1. 기저 정답률(rate: 0..1)에 따른 엄격 단조 증가 검증
  const rates = [0.1, 0.35, 0.6, 0.85, 0.92, 0.95, 0.99];
  const wRates = rates.map((r) => consensusWeight({ base: 8.5, status: 'calibrated', acc: r }, 8, { abilityMix: 0.35 }));
  for (let i = 1; i < wRates.length; i++) {
    assert.ok(wRates[i] > wRates[i - 1], `rate 단조 증가 위반: ${rates[i - 1]}(${wRates[i - 1]}) -> ${rates[i]}(${wRates[i]})`);
  }

  // 2. 등급 척도(abilityScale: 'grade', 0..9 — 특히 1과 2 경계 불연속 해소 검증)
  const grades = [0, 1, 2, 4, 6, 8, 9];
  const wGrades = grades.map((g) => consensusWeight({ base: 8.2, status: 'calibrated' }, 8, { ability: g, abilityScale: 'grade', abilityMix: 0.35 }));
  for (let i = 1; i < wGrades.length; i++) {
    assert.ok(wGrades[i] > wGrades[i - 1], `grade 단조 증가 위반: G${grades[i - 1]}(${wGrades[i - 1]}) -> G${grades[i]}(${wGrades[i]})`);
  }

  // 3. 연속 상대 역량 객체(AgentMuk.ability: { grade: 4, score } 동일 정수 등급 내부 변별력 검증)
  const wPeerLow = consensusWeight({ base: 8.6, status: 'calibrated', ability: { grade: 4, score: 0.6 } }, 8, { abilityMix: 0.35 });
  const wPeerHigh = consensusWeight({ base: 8.6, status: 'calibrated', ability: { grade: 4, score: 18.5 } }, 8, { abilityMix: 0.35 });
  assert.ok(wPeerHigh > wPeerLow, `연속 score 변별 실패: ${wPeerLow} vs ${wPeerHigh}`);
});

test('v0.8.5-rc2: 다중 홉 비파괴 propagateCalculations, W50(수식 누락), W51(↔k+fix→k 차단), Compacted-Lineage-View', async () => {
  // 1. W50: lon 0.8.5 delta에서 수치가 든 [inf,say]에 calcN이 없으면 W50(content), 있으면 무경고
  const noCalc = parseTurn(
    'lon 0.8.5 · delta · lang en\n<1 · [see,say] base flow 100 L/min *:8↓evd1> evd1 <[base flow 100 L/min]>\n<2 · [inf,say] doubled flow = 200 L/min *:9↓1>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', issued: ['evd1'] },
  );
  assert.ok(noCalc.warnings.some((w) => w.code === 'W50' && w.tier === 'content'));

  // 2. W51: 동일 대상 절에 ↔1과 fix→1을 함께 적으면 W51(form)을 내고 fix→1을 제거해 정본 절 1을 활성 보존
  const ledgerConf = new LedgerContext();
  const c0 = parseTurn('lon 0.8.5 · delta · lang en\n<1 · [see,say] Pump P-4 flow 310 L/min *:8↓evd1> evd1 <[Pump P-4 flow 310 L/min]>', {
    profile: 'lon',
    spec: '0.8.5',
    mode: 'delta',
    lang: 'en',
    issued: ['evd1'],
  });
  await commitTurn(ledgerConf, c0.message, { turn: 1 });

  const cContradict = parseTurn(
    'lon 0.8.5 · delta · lang en\n<2 · ↔1 fix→1 [rec,lim,say] unverified note claims 190 L/min *:3↓evd2> evd2 <[Pump P-4 flow 190 L/min]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger: ledgerConf, issued: ['evd1', 'evd2'] },
  );
  assert.ok(cContradict.warnings.some((w) => w.code === 'W51' && w.tier === 'form'));
  assert.equal(cContradict.message.clauses[0].process, null);
  assert.equal(cContradict.message.clauses[0].place?.rel, '↔');
  assert.match(format(cContradict.message), /<2 · ↔1 \[rec,lim,say\]/);
  assert.doesNotMatch(format(cContradict.message), /fix→1/);
  await commitTurn(ledgerConf, cContradict.message, { turn: 2 });
  assert.equal(ledgerConf.getClause('1')?.active, true, '정본 절 1이 덮어쓰기되지 않고 활성 유지');
  assert.equal(ledgerConf.openConflicts.length, 1);

  // 3. 다중 세대(Hop 1 -> Hop 2 -> Hop 3) 비파괴 propagateCalculations(ledger, turnAst) 및 최신 ↓근거·@참조 갱신
  const led = new LedgerContext();
  const h1 = parseTurn(
    [
      'lon 0.8.5 · delta · lang en',
      '<1 · [see,say] south flow 5960 L/min *:8↓evd1> evd1 <[Control room bulletin\\nNominal south flow: 5960 L/min]>',
      '<2 · [see,say] throttle 35 percent *:8↓evd2> evd2 <[Quality memo\\nThrottle: 35 percent]>',
      '<3 · [inf,say] Throttled pump flow=2086 L/min *:9↓1↓2> calc3 <[round(@1 * @2 / 100)]>',
      '<4 · [see,say] quay flow 8660 L/min *:8↓evd3> evd3 <[Shift log\\nQuay flow: 8660 L/min]>',
      '<5 · [inf,say] Two-pump working flow=10746 L/min *:9↓3↓4> calc5 <[@3 + @4]>',
    ].join('\n'),
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', issued: ['evd1', 'evd2', 'evd3'] },
  );
  await commitTurn(led, h1.message, { turn: 1 });

  // Hop 2: 절 1이 절 6(3420)으로 1차 개정됨 -> D1(절3->절7: 1197, ↓6↓2) 및 D2(절5->절8: 9857, ↓7↓4) 연쇄 생성
  const h2 = parseTurn(
    'lon 0.8.5 · delta · lang en\n<6 · fix→1 [see,say] south flow 3420 L/min *:9↓evd4> evd4 <[Lab release note\\nNominal south flow: 3420 L/min — supersedes evd1 with extended calibration remarks and shift sign-off block]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger: led, issued: ['evd1', 'evd2', 'evd3', 'evd4'] },
  );
  await commitTurn(led, h2.message, { turn: 2 });
  const fixesH2 = propagateCalculations(led, h2.message);
  assert.equal(fixesH2.length, 2);
  assert.equal(fixesH2[0].newValue, 1197);
  assert.match(fixesH2[0].line, /<7 · fix→3 \[inf,say\] Throttled pump flow=1197 L\/min \*:9↓6↓2> calc7 <\[round\(@6 \* @2 \/ 100\)\]>/);
  assert.equal(fixesH2[1].newValue, 9857);
  assert.match(fixesH2[1].line, /<8 · fix→5 \[inf,say\] Two-pump working flow=9857 L\/min \*:9↓7↓4> calc8 <\[@7 \+ @4\]>/);
  const h2Auto = parseTurn('lon 0.8.5 · delta · lang en\n' + fixesH2.map((f) => f.line).join('\n'), {
    profile: 'lon',
    spec: '0.8.5',
    mode: 'delta',
    lang: 'en',
    ledger: led,
  });
  await commitTurn(led, h2Auto.message, { turn: 2 });

  // Hop 3: 2차 개정! 절 6이 절 9(5000)로 다시 개정됨 -> 절 7->10(1750, ↓9↓2), 절 8->11(10410, ↓10↓4) 완벽 전파 검증
  const h3 = parseTurn(
    'lon 0.8.5 · delta · lang en\n<9 · fix→6 [see,say] south flow 5000 L/min *:9↓evd5> evd5 <[Final QA revision\\nNominal south flow: 5000 L/min]>',
    { profile: 'lon', spec: '0.8.5', mode: 'delta', lang: 'en', ledger: led, issued: ['evd1', 'evd2', 'evd3', 'evd4', 'evd5'] },
  );
  await commitTurn(led, h3.message, { turn: 3 });
  const fixesH3 = propagateCalculations(led, h3.message);
  assert.equal(fixesH3.length, 2);
  assert.equal(fixesH3[0].newValue, 1750);
  assert.match(fixesH3[0].line, /<10 · fix→7 \[inf,say\] Throttled pump flow=1750 L\/min \*:9↓9↓2> calc10 <\[round\(@9 \* @2 \/ 100\)\]>/);
  assert.equal(fixesH3[1].newValue, 10410);
  assert.match(fixesH3[1].line, /<11 · fix→8 \[inf,say\] Two-pump working flow=10410 L\/min \*:9↓10↓4> calc11 <\[@10 \+ @4\]>/);
  const h3Auto = parseTurn('lon 0.8.5 · delta · lang en\n' + fixesH3.map((f) => f.line).join('\n'), {
    profile: 'lon',
    spec: '0.8.5',
    mode: 'delta',
    lang: 'en',
    ledger: led,
  });
  await commitTurn(led, h3Auto.message, { turn: 3 });

  // 4. Compacted-Lineage-View vs Full-Lineage-View 압축 및 1홉/사슬 스텁 보존 검증
  const fullView = formatLedgerView(led, { mode: 'full' });
  const compactView = formatLedgerView(led, { mode: 'compacted' });
  assert.ok(compactView.length < fullView.length, `압축 효과 확인: ${compactView.length} < ${fullView.length}`);
  assert.match(compactView, /<9 · fix→6 \[see,say\] south flow 5000 L\/min \*:9↓evd5> evd5 <\[/);
  assert.match(compactView, /<6 · \[superseded→9\] south flow 3420 L\/min ↓evd4>/);
  assert.match(compactView, /<1 · \[superseded→6\] south flow 5960 L\/min ↓evd1>/);
  assert.doesNotMatch(compactView, /evd4 <\[/);
  assert.doesNotMatch(compactView, /evd1 <\[/);
});
