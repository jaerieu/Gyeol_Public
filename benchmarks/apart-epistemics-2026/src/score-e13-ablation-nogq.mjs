// Scorer & --selftest for E13 post-hoc ablation (`jsonchain_nogq` vs existing `deepseek_on` formats).
// Compares jsonchain_nogq alongside natural, json, jsonchain, and lon on deepseek_on using exact E13 logic.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  scoreNoGQNote, idealJsonchainNoGQ, HOPS,
} from './ablation-nogq-lib.mjs';
import { scoreNote as scoreE13Note } from './score-e13.mjs';
import { scoreReader } from './score-e10.mjs';
import { mulberry32, lineageEventsAt } from './lib-e12.mjs';
import { idealNote } from './mock-e13.mjs';

const READER = HOPS + 1;
const SEED = 20261117, BOOT = 2000;
const CURVE = [5, 10, 15, 20, 25, 30];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');
const f4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : 'n/a');
const tbl = (h, rows) => [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

function signFlip(d) {
  const n = d.length;
  if (!n) return NaN;
  const obs = Math.abs(d.reduce((a, b) => a + b, 0)), tot = 2 ** n;
  let ge = 0;
  for (let m = 0; m < tot; m++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (m >> i) & 1 ? d[i] : -d[i];
    if (Math.abs(s) >= obs - 1e-12) ge++;
  }
  return ge / tot;
}
function bootCI(d) {
  const n = d.length;
  if (!n) return [NaN, NaN];
  const r = mulberry32(SEED), ms = [];
  for (let b = 0; b < BOOT; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += d[Math.floor(r() * n)];
    ms.push(s / n);
  }
  ms.sort((a, b) => a - b);
  return [ms[Math.floor(0.025 * BOOT)], ms[Math.ceil(0.975 * BOOT) - 1]];
}

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const sessionsPath = opt('--sessions', 'data/sessions-e13.json');
const scens = JSON.parse(readFileSync(sessionsPath, 'utf8')).scenarios;
const scenOf = Object.fromEntries(scens.map((s) => [s.id, s]));

if (flag('--selftest')) {
  let bad = 0;
  let totalLin = 0, totalV = 0;
  const check = (name, got, want, tol = 1e-9) => {
    if (!Number.isFinite(got) || Math.abs(got - want) > tol) { bad++; console.log(`FAIL ${name}: got ${got}, want ${want}`); }
  };
  for (const scen of scens) {
    let prev = null;
    for (const hop of [1, 5, 15, 25, HOPS]) {
      const note = idealJsonchainNoGQ(scen, hop);
      const s = scoreNoGQNote(scen, hop, note, prev);
      if (hop === HOPS) {
        totalLin += s.lin.filter((x) => x.ok).length;
        totalV += s.per.filter((x) => x.v).length;
      }
      if (s.lin.length) {
        check(`${scen.id} h${hop} ideal L`, mean(s.lin.map((x) => +x.ok)), 1);
        check(`${scen.id} h${hop} ideal L_strict`, mean(s.linStrict.map((x) => +x.ok)), 1);
      }
      check(`${scen.id} h${hop} ideal V`, mean(s.per.map((x) => +x.v)), 1);
      check(`${scen.id} h${hop} ideal Vh`, mean(s.hist.map((x) => +x.v)), 1);
      check(`${scen.id} h${hop} tamper altered`, s.tamper.altered, 0);
      check(`${scen.id} h${hop} audit clean`, +(!s.audit.flagged), 1);
      prev = note;
    }
    const dz = scoreNoGQNote(scen, HOPS, idealJsonchainNoGQ(scen, HOPS, { destructive: true }));
    if (!(mean(dz.lin.map((x) => +x.ok)) < 0.25)) { bad++; console.log(`FAIL ${scen.id} destructive L`); }
    check(`${scen.id} destructive V`, mean(dz.per.map((x) => +x.v)), 1);

    const unl = scoreNoGQNote(scen, HOPS, idealJsonchainNoGQ(scen, HOPS, { unlinkLineage: true }));
    check(`${scen.id} unlink L`, mean(unl.lin.map((x) => +x.ok)), 0);

    // Cross-check eval parity against score-e13.mjs on `jsonchain` mock
    const refJc = scoreE13Note('jsonchain', scen, HOPS, idealNote('jsonchain', scen, HOPS));
    check(`${scen.id} parity L vs score-e13`, mean(refJc.lin.map((x) => +x.ok)), 1);
  }
  console.log(bad
    ? `selftest: ${bad} FAILED`
    : `selftest: PASSED (${scens.length} scenarios, Hop-30 ideal L=${totalLin}/${scens.length * 53}, V=${totalV}/${scens.length * 34})`);
  process.exit(bad ? 1 : 0);
}

const dsonPath = opt('--dson', 'results/e13/e13-deepseek_on.jsonl');
const nogqPath = opt('--nogq', 'results/e13-ablation/e13-deepseek_on-jsonchain_nogq.jsonl');
const allRows = [
  ...readFileSync(dsonPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse),
  ...readFileSync(nogqPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse),
];

const S = new Map();
for (const r of allRows) {
  if (!scenOf[r.scen] || r.model !== 'deepseek_on') continue;
  const k = `${r.scen}|${r.format}`;
  if (!S.has(k)) S.set(k, { sid: r.sid, scen: r.scen, format: r.format, notes: {}, empties: {}, rows: [], usd: 0, errors: 0, deltaOnlyCount: 0 });
  const s = S.get(k);
  s.usd += r.usd ?? 0;
  s.rows.push(r);
  if (r.error) { s.errors += 1; continue; }
  if (String(r.text ?? '').trim()) {
    if (s.notes[r.hop] == null) {
      s.notes[r.hop] = r;
      if (r.delta_only) s.deltaOnlyCount += 1;
    }
  } else s.empties[r.hop] = (s.empties[r.hop] ?? 0) + 1;
}

for (const s of S.values()) {
  const scen = scenOf[s.scen];
  s.complete = Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => s.notes[h]);
  s.broken = !s.complete && Array.from({ length: HOPS }, (_, i) => i + 1).some((h) => !s.notes[h] && (s.empties[h] ?? 0) >= 3);
  s.settled = (s.complete && (s.notes[READER] || (s.empties[READER] ?? 0) >= 3)) || s.broken;
  s.hops = {};
  s.at = {};
  let lastNote = null, leakedTotal = 0;
  const auditEvs = [];
  for (let h = 1; h <= HOPS; h++) {
    const currText = s.notes[h] ? s.notes[h].text : (s.broken ? null : lastNote);
    const sc = s.format === 'jsonchain_nogq'
      ? scoreNoGQNote(scen, h, currText, lastNote)
      : scoreE13Note(s.format, scen, h, currText, lastNote);
    leakedTotal += sc.leakedGroundsQuotes ?? 0;
    s.hops[h] = sc;
    if (CURVE.includes(h)) s.at[h] = sc;
    const curL = sc.lin.length ? mean(sc.lin.map((x) => +x.ok)) : 1;
    const curV = sc.per.length ? mean(sc.per.map((x) => +x.v)) : 1;
    auditEvs.push({ hop: h, flagged: sc.audit.flagged, curL, curV, gtDefect: !sc.has || curV < 1 - 1e-9 || curL < 1 - 1e-9 || sc.tamper.altered > 0 });
    if (s.notes[h]) lastNote = s.notes[h].text;
  }
  s.final = s.hops[HOPS];
  s.reader = scoreReader(scen, s.notes[READER]?.text ?? '');
  s.lastNoteChars = s.notes[HOPS]?.text?.length ?? NaN;
  s.leakedGroundsQuotes = leakedTotal;
  s.auditEvs = auditEvs;
  const okRows = s.rows.filter((r) => !r.error && String(r.text ?? '').trim());
  s.tin = okRows.reduce((a, r) => a + (r.usage?.in ?? 0), 0);
  s.tout = okRows.reduce((a, r) => a + (r.usage?.out ?? 0), 0);
  s.cached = okRows.reduce((a, r) => a + (r.usage?.cached ?? 0), 0);
  s.tchars = okRows.reduce((a, r) => a + String(r.text ?? '').length, 0);
  s.rchars = okRows.reduce((a, r) => a + (r.reasoning_chars ?? 0), 0);
  s.cut = okRows.filter((r) => /length|max_output|max_tokens/i.test(String(r.finish ?? ''))).length;
}

const formats = ['natural', 'json', 'jsonchain_nogq', 'jsonchain', 'lon'];
const ses = (f) => scens.map((sc) => S.get(`${sc.id}|${f}`)).filter((s) => s?.settled);
const Lof = (s, pick = () => true, h = HOPS) => { const xs = s.at[h].lin.filter(pick); return xs.length ? mean(xs.map((x) => +x.ok)) : NaN; };
const LstrictOf = (s, pick = () => true, h = HOPS) => { const xs = s.at[h].linStrict.filter(pick); return xs.length ? mean(xs.map((x) => +x.ok)) : NaN; };
const Vof = (s) => mean(s.final.per.map((x) => +x.v));
const Vhof = (s) => mean(s.final.hist.map((x) => +x.v));
const Rof = (s, pick) => { const xs = s.reader.filter((x, i) => pick(scenOf[s.scen].questions[i])); return xs.length ? mean(xs.map((x) => +x.exact)) : NaN; };
const isLinQ = (q) => q.kind === 'lineage', isCurQ = (q) => q.kind !== 'lineage';
const avg = (xs, fn) => mean(xs.map(fn).filter(Number.isFinite));

const summary = formats.map((f) => {
  const xs = ses(f);
  const allLin = xs.flatMap((s) => s.final.lin);
  const byKind = (k) => mean(allLin.filter((x) => x.kind === k).map((x) => +x.ok));
  return {
    format: f,
    settled: xs.length,
    broken: xs.filter((s) => s.broken).length,
    L: avg(xs, (s) => Lof(s)),
    L_strict: avg(xs, (s) => LstrictOf(s)),
    V: avg(xs, (s) => Vof(s)),
    Vh: avg(xs, (s) => Vhof(s)),
    readerCur: avg(xs, (s) => Rof(s, isCurQ)),
    readerLin: avg(xs, (s) => Rof(s, isLinQ)),
    cNew: mean(allLin.map((x) => +x.cNew)),
    cOld: mean(allLin.map((x) => +x.cOld)),
    cEdge: mean(allLin.map((x) => +x.cEdge)),
    amend: byKind('amend'),
    withdraw: byKind('withdraw'),
    recompute: byKind('recompute'),
    avgUnits: avg(xs, (s) => s.final.unitsCount),
    finalChars: avg(xs, (s) => s.lastNoteChars),
    tin: xs.reduce((a, s) => a + s.tin, 0),
    tout: xs.reduce((a, s) => a + s.tout, 0),
    cached: xs.reduce((a, s) => a + s.cached, 0),
    tchars: xs.reduce((a, s) => a + s.tchars, 0),
    rchars: xs.reduce((a, s) => a + s.rchars, 0),
    usd: xs.reduce((a, s) => a + s.usd, 0),
    deltaOnly: xs.reduce((a, s) => a + s.deltaOnlyCount, 0),
    cut: xs.reduce((a, s) => a + s.cut, 0),
    alteredQuotes: xs.reduce((a, s) => a + s.final.tamper.altered, 0),
    totalQuotes: xs.reduce((a, s) => a + s.final.tamper.total, 0),
    leakedGroundsQuotes: xs.reduce((a, s) => a + s.leakedGroundsQuotes, 0),
  };
});

function pairTest(fA, fB, fn) {
  const d = scens.map((sc) => [S.get(`${sc.id}|${fA}`), S.get(`${sc.id}|${fB}`)])
    .filter(([a, b]) => a?.settled && b?.settled)
    .map(([a, b]) => fn(a) - fn(b));
  return { pair: `${fA} minus ${fB}`, n: d.length, mean: mean(d), ci: bootCI(d), p: signFlip(d), perScen: d };
}

const contrasts = {
  L: [
    pairTest('jsonchain_nogq', 'json', (s) => Lof(s)),
    pairTest('jsonchain', 'jsonchain_nogq', (s) => Lof(s)),
    pairTest('lon', 'jsonchain_nogq', (s) => Lof(s)),
    pairTest('jsonchain_nogq', 'natural', (s) => Lof(s)),
  ],
  V: [
    pairTest('jsonchain_nogq', 'json', (s) => Vof(s)),
    pairTest('jsonchain', 'jsonchain_nogq', (s) => Vof(s)),
    pairTest('lon', 'jsonchain_nogq', (s) => Vof(s)),
  ],
  readerLin: [
    pairTest('jsonchain_nogq', 'json', (s) => Rof(s, isLinQ)),
    pairTest('jsonchain', 'jsonchain_nogq', (s) => Rof(s, isLinQ)),
    pairTest('lon', 'jsonchain_nogq', (s) => Rof(s, isLinQ)),
  ],
};

// Session audit summary for deepseek_on
const auditRows = formats.map((f) => {
  const xs = ses(f);
  let stp = 0, sfp = 0, sfn = 0, stn = 0;
  for (const s of xs) {
    const h30 = s.auditEvs[s.auditEvs.length - 1];
    const badFinal = h30.curL < 1 - 1e-9 || h30.curV < 1 - 1e-9;
    const anyFlag = s.auditEvs.some((e) => e.flagged);
    if (badFinal && anyFlag) stp++;
    else if (badFinal && !anyFlag) sfn++;
    else if (!badFinal && anyFlag) sfp++;
    else stn++;
  }
  return { format: f, stp, sfp, sfn, stn };
});

const outMd = [];
outMd.push('# E13 Post-Hoc Ablation: `jsonchain` Without `grounds` & `quotes` (`deepseek_on`, n=10 Scenarios)');
outMd.push('');
outMd.push(tbl(
  ['format', 'settled', 'brk', 'L', 'L_strict', 'V', 'Vh', 'R_cur', 'R_lin', 'cNew', 'cOld', 'cEdge', 'amend', 'withdraw', 'recompute', 'units', 'h30Chars', 'USD', 'leakedGQ'],
  summary.map((r) => [
    r.format, r.settled, r.broken, f3(r.L), f3(r.L_strict), f3(r.V), f3(r.Vh), f3(r.readerCur), f3(r.readerLin),
    f3(r.cNew), f3(r.cOld), f3(r.cEdge), f3(r.amend), f3(r.withdraw), f3(r.recompute),
    r.avgUnits.toFixed(1), r.finalChars.toFixed(0), r.usd.toFixed(4), r.leakedGroundsQuotes,
  ]),
));
outMd.push('');
outMd.push('## Paired Two-Sided Exact Sign-Flip Contrasts (n=10 Scenarios)');
outMd.push(tbl(
  ['metric', 'contrast', 'n', 'diff', '95% CI', 'exact p'],
  Object.entries(contrasts).flatMap(([met, arr]) => arr.map((c) => [met, c.pair, c.n, f3(c.mean), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f4(c.p)])),
));
outMd.push('');
outMd.push('## Static Session Audit & Tamper (deepseek_on)');
outMd.push(tbl(
  ['format', 'sTP', 'sFP', 'sFN', 'sTN', 'alteredQuotes', 'totalQuotes', 'tchars', 'rchars', 'tin', 'tout', 'cached'],
  summary.map((r, i) => {
    const a = auditRows[i];
    return [r.format, a.stp, a.sfp, a.sfn, a.stn, r.alteredQuotes, r.totalQuotes, r.tchars, r.rchars, r.tin, r.tout, r.cached];
  }),
));

const reportMd = opt('--report', 'report/ablation-nogq.md');
const reportJson = opt('--json', 'report/ablation-nogq.json');
mkdirSync(dirname(reportMd), { recursive: true });
writeFileSync(reportMd, outMd.join('\n') + '\n');
writeFileSync(reportJson, JSON.stringify({ generatedAt: new Date().toISOString(), summary, contrasts, auditRows }, null, 2) + '\n');
console.log(outMd.join('\n'));
