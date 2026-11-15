// Post-hoc reviewer-verification diagnostics (read-only over locked E13 logs, prompts, and pre-registered metrics).
// Does NOT modify any file in prereg-e13.sha256 or prereg-e5-e6.sha256.
// Outputs report/diag-e13-posthoc2.json and report/diag-e13-posthoc2.md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreNote } from './score-e13.mjs';
import { readNote, scoreReader } from './score-e10.mjs';
import { HOPS, derivedAt, hasNum, norm } from './lib-e12.mjs';
import { hopPrompt } from './prompts-e13.mjs';
import { parseTurn, stripReplyLabels, carryDiff, toDigit } from '../vendor/gyeol-10fba3d/src/index.ts';
import { counterShare } from '../vendor/gyeol-10fba3d/src/muk.ts';

const BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = ['deepseek_on', 'luna_on', 'haiku_on', 'deepseek_off', 'luna_off', 'haiku_off'];
const BASELINES = ['natural', 'json', 'jsonchain'];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

// Log-gamma and regularized incomplete beta for exact two-sided Student-t p-values.
function lgamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z);
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-30;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
function betainc(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}
function studentTPValue(tAbs, df) {
  if (!Number.isFinite(tAbs) || df <= 0) return NaN;
  return betainc(df / 2, 0.5, df / (df + tAbs * tAbs));
}

// Exact Clopper-Pearson two-sided (1 - alpha) binomial confidence interval via bisection.
function clopperPearson(k, n, alpha = 0.05) {
  if (n <= 0) return [NaN, NaN];
  const binomPmf = (i, m, p) => {
    let logC = 0;
    for (let j = 1; j <= i; j++) logC += Math.log(m - j + 1) - Math.log(j);
    if (p <= 0) return i === 0 ? 1 : 0;
    if (p >= 1) return i === m ? 1 : 0;
    return Math.exp(logC + i * Math.log(p) + (m - i) * Math.log(1 - p));
  };
  const upperTail = (kMin, m, p) => {
    let s = 0;
    for (let i = kMin; i <= m; i++) s += binomPmf(i, m, p);
    return s;
  };
  const lowerTail = (kMax, m, p) => {
    let s = 0;
    for (let i = 0; i <= kMax; i++) s += binomPmf(i, m, p);
    return s;
  };
  let lo = 0;
  if (k > 0) {
    let a = 0, b = 1;
    for (let iter = 0; iter < 80; iter++) {
      const mid = 0.5 * (a + b);
      if (upperTail(k, n, mid) > alpha / 2) b = mid;
      else a = mid;
    }
    lo = 0.5 * (a + b);
  }
  let hi = 1;
  if (k < n) {
    let a = 0, b = 1;
    for (let iter = 0; iter < 80; iter++) {
      const mid = 0.5 * (a + b);
      if (lowerTail(k, n, mid) > alpha / 2) a = mid;
      else b = mid;
    }
    hi = 0.5 * (a + b);
  }
  return [lo, hi];
}

const metrics = JSON.parse(readFileSync(`${BASE}/report/metrics-e13.json`, 'utf8'));
const scensData = JSON.parse(readFileSync(`${BASE}/data/sessions-e13.json`, 'utf8'));
const scens = scensData.scenarios;
const scenOf = Object.fromEntries(scens.map((s) => [s.id, s]));

// 1. 18 Paired L Contrasts (6 cells x 3 baselines)
const contrasts18 = [];
const talliesHolm = {};
const talliesRaw = {};
let totalHolmW = 0, totalHolmT = 0, totalHolmL = 0;
let totalRawW = 0, totalRawT = 0, totalRawL = 0;

for (const base of BASELINES) {
  const cObj = metrics.contrasts[base];
  const rowsL = cObj.L;
  const holmL = cObj.holmL;
  const rowsR = cObj.readerLin;
  const holmR = cObj.holmR;
  let wH = 0, tH = 0, lH = 0;
  let wR = 0, tR = 0, lR = 0;
  for (const m of MODELS) {
    const r = rowsL.find((x) => x.k === m);
    const pH = holmL[m];
    const rR = rowsR.find((x) => x.k === m);
    const pHR = holmR[m];
    const outcomeHolm = pH < 0.05 ? (r.mean > 0 ? 'W' : 'L') : 'T';
    const outcomeRaw = r.p < 0.05 ? (r.mean > 0 ? 'W' : 'L') : 'T';
    if (outcomeHolm === 'W') { wH++; totalHolmW++; }
    else if (outcomeHolm === 'L') { lH++; totalHolmL++; }
    else { tH++; totalHolmT++; }
    if (outcomeRaw === 'W') { wR++; totalRawW++; }
    else if (outcomeRaw === 'L') { lR++; totalRawL++; }
    else { tR++; totalRawT++; }
    contrasts18.push({
      baseline: base,
      model: m,
      diffL: r.mean,
      ci95: r.ci,
      pRaw: r.p,
      pHolm: pH,
      outcomeHolm,
      outcomeRaw,
      diffReaderLin: rR.mean,
      pHolmReaderLin: pHR,
    });
  }
  talliesHolm[base] = { W: wH, T: tH, L: lH };
  talliesRaw[base] = { W: wR, T: tR, L: lR };
}

// Simultaneous Holm step-down across all m = 18 L contrasts (sensitivity analysis).
const sortedAll18 = [...contrasts18].sort((a, b) => a.pRaw - b.pRaw);
let runHolm18 = 0;
let holm18W = 0, holm18T = 0, holm18L = 0;
sortedAll18.forEach((c, idx) => {
  runHolm18 = Math.max(runHolm18, Math.min(1, c.pRaw * (sortedAll18.length - idx)));
  c.pHolmAll18 = runHolm18;
  c.outcomeHolm18 = runHolm18 < 0.05 ? (c.diffL > 0 ? 'W' : 'L') : 'T';
  if (c.outcomeHolm18 === 'W') holm18W++;
  else if (c.outcomeHolm18 === 'L') holm18L++;
  else holm18T++;
});

// 2. Event-Category Survival & Hop-30 Unit Count / Component Breakdown from Raw JSONL
function readModelRows(m) {
  return readFileSync(`${BASE}/results/e13/e13-${m}.jsonl`, 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function assembleSessions() {
  const S = new Map();
  for (const m of ['deepseek_on', 'deepseek_off', 'haiku_on', 'haiku_off', 'luna_on', 'luna_off']) {
    for (const r of readModelRows(m)) {
      if (!scenOf[r.scen]) continue;
      if (!S.has(r.sid)) S.set(r.sid, { sid: r.sid, scen: r.scen, model: r.model, format: r.format, notes: {}, empties: {}, rows: [] });
      const s = S.get(r.sid);
      s.rows.push(r);
      if (r.error) continue;
      if (String(r.text ?? '').trim()) {
        if (s.notes[r.hop] == null) s.notes[r.hop] = r;
      } else {
        s.empties[r.hop] = (s.empties[r.hop] ?? 0) + 1;
      }
    }
  }
  for (const s of S.values()) {
    const scen = scenOf[s.scen];
    s.complete = Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => s.notes[h]);
    s.broken = !s.complete && Array.from({ length: HOPS }, (_, i) => i + 1).some((h) => !s.notes[h] && (s.empties[h] ?? 0) >= 3);
    s.settled = (s.complete && (s.notes[HOPS + 1] || (s.empties[HOPS + 1] ?? 0) >= 3)) || s.broken;
    const h30Text = s.notes[HOPS]?.text ?? null;
    s.score30 = scoreNote(s.format, scen, HOPS, h30Text);
    s.reader = scoreReader(scen, s.notes[HOPS + 1]?.text ?? '');
  }
  return S;
}

const sessionsMap = assembleSessions();
const catTable = [];
for (const [m, f] of [
  ['deepseek_on', 'lon'],
  ['deepseek_on', 'jsonchain'],
  ['deepseek_on', 'json'],
  ['deepseek_on', 'natural'],
  ['luna_on', 'lon'],
  ['deepseek_off', 'lon'],
  ['luna_off', 'lon'],
]) {
  const xs = scens.map((sc) => sessionsMap.get(`${sc.id}|${m}|${f}`)).filter((s) => s?.settled);
  const byKind = (kind) => {
    const evs = xs.flatMap((s) => s.score30.lin.filter((e) => e.kind === kind));
    return {
      nEvents: evs.length / Math.max(1, xs.length),
      ok: mean(evs.map((e) => +e.ok)),
      cNew: mean(evs.map((e) => +e.cNew)),
      cOld: mean(evs.map((e) => +e.cOld)),
      cEdge: mean(evs.map((e) => +e.cEdge)),
    };
  };
  catTable.push({
    model: m,
    format: f,
    meanUnitsH30: mean(xs.map((s) => s.score30.unitsCount)),
    amend: byKind('amend'),
    withdraw: byKind('withdraw'),
    recompute: byKind('recompute'),
  });
}

// 3. Audit Base Rates & Exact Clopper-Pearson 95% CIs
// Count defective sessions cleanly per format from auditByFormat + session status in sessionsMap
const auditRates = metrics.auditByFormat.map((a) => {
  const fmtSessions = scens.flatMap((sc) => MODELS.map((m) => sessionsMap.get(`${sc.id}|${m}|${a.group}`))).filter((s) => s?.settled);
  const defectiveSess = fmtSessions.filter((s) => {
    const l30 = mean(s.score30.lin.map((x) => +x.ok));
    const v30 = mean(s.score30.per.map((x) => +x.v));
    return l30 < 1 - 1e-9 || v30 < 1 - 1e-9;
  }).length;
  const cleanSess = fmtSessions.length - defectiveSess;
  const cleanFaCount = Math.round(a.falseAlarmCleanSessions * cleanSess);
  const gtBadHops = a.tp + a.fn;
  return {
    format: a.group,
    sessions: a.sessions,
    defectiveSessions: defectiveSess,
    cleanSessions: cleanSess,
    cleanFaCount,
    cleanFaRate: a.falseAlarmCleanSessions,
    cleanFaCI95: cleanSess > 0 ? clopperPearson(cleanFaCount, cleanSess) : null,
    flagAllSessionPrec: defectiveSess / a.sessions,
    gtBadHops,
    hops: a.hops,
    flagAllHopPrec: gtBadHops / a.hops,
    sRecall: a.sRecall,
    sPrecision: a.sPrecision,
    hopRecall: a.recall,
    hopPrecision: a.precision,
  };
});
const lonContentCleanCI = clopperPearson(0, 7);

// 4. Static Prompt Character & Token Overhead Decomposition
const sampleScen = scens[0];
const srcPrompts = readFileSync(`${BASE}/src/prompts-e13.mjs`, 'utf8');
const lonBaseTxt = readFileSync(`${BASE}/prompts/lon-base-10fba3d-en.txt`, 'utf8').trim();
const roleMatch = srcPrompts.match(/const ROLE = '([^']+)';/);
const policyMatch = srcPrompts.match(/const POLICY = `([\s\S]*?)`;/);
const roleChars = roleMatch ? roleMatch[1].length : NaN;
const policyChars = policyMatch ? policyMatch[1].length : NaN;
const sharedCommonChars = roleChars + policyChars + 6; // ROLE + "\n\n" + POLICY + "\n\n" + trailing "\n\n"

const promptDecomposition = {};
for (const fmt of ['natural', 'json', 'jsonchain', 'lon']) {
  const { sharedChars } = hopPrompt(fmt, sampleScen, 1, null);
  const blockChars = sharedChars - sharedCommonChars;
  const dsOnCell = metrics.cells.find((c) => c.model === 'deepseek_on' && c.format === fmt);
  const lunaOnCell = metrics.cells.find((c) => c.model === 'luna_on' && c.format === fmt);
  promptDecomposition[fmt] = {
    roleChars,
    policyChars,
    sharedRolePlusPolicyWithSeps: sharedCommonChars,
    formatBlockChars: blockChars,
    totalStaticChars: sharedChars,
    lonBaseChars: fmt === 'lon' ? lonBaseTxt.length : null,
    lonSnapshotSuffixChars: fmt === 'lon' ? blockChars - lonBaseTxt.length - 2 : null,
    dsOnTotalTin: dsOnCell.tin,
    lunaOnTotalTin: lunaOnCell.tin,
  };
}
const tinOverhead = {
  dsOnLonVsJsonchainPct: (promptDecomposition.lon.dsOnTotalTin / promptDecomposition.jsonchain.dsOnTotalTin - 1) * 100,
  lunaOnLonVsJsonchainPct: (promptDecomposition.lon.lunaOnTotalTin / promptDecomposition.jsonchain.lunaOnTotalTin - 1) * 100,
};

// 5. Held-out S06..S10 Per-Scenario Brier Ensemble Comparison (5 strategies)
const trainScens = scens.slice(0, 5); // S01..S05
const testScens = scens.slice(5);     // S06..S10
const trainReaderAcc = {};
for (const m of MODELS) {
  const accs = trainScens.flatMap((sc) => sessionsMap.get(`${sc.id}|${m}|lon`).reader.map((r) => +r.exact));
  trainReaderAcc[m] = mean(accs);
}
// Recompute per-session mean confidence using the same extraction rule as score-e13.mjs.

function readNoteJoinedLocal(text) {
  const std = readNote('lon', text, false);
  for (const u of std.units) {
    const extra = std.spans.filter((s) => s.ids.length === 1 && u.ids.includes(s.ids[0])).map((s) => s.text).join(' ');
    if (extra) u.fullText = `${u.fullText} ${extra}`.trim();
  }
  return std;
}
function rawInputsLocal(scen, dkey, ver) {
  const out = [];
  for (const k of ver.inputs) {
    if (/^D\d$/.test(k)) {
      const d = scen.derived.find((x) => x.key === k);
      const v = d.versions.filter((x) => x.hop <= ver.hop).at(-1);
      out.push(...rawInputsLocal(scen, k, v));
    } else out.push(k);
  }
  return out;
}
function verifiedLocal(p, doc, spans) {
  if (!doc) return false;
  const v = norm(p.value), b = norm(`${doc.header}\n${doc.body}`);
  return spans.some((s) => s.ids.includes(p.doc) && norm(s.text).includes(v) && b.includes(norm(s.text)));
}
function reachOfLocal(u, byN) {
  const ids = new Set(u.ids), seen = new Set(), queue = [...u.refs];
  while (queue.length) {
    const n = queue.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    const w = byN.get(n);
    if (w && w !== u) { w.ids.forEach((x) => ids.add(x)); queue.push(...w.refs); }
  }
  return { ids };
}
function extractLonMukRowsLocal(scen, hop, text, std, onlyNums) {
  if (!text || !String(text).trim()) return [];
  const docs = Object.fromEntries(scen.docs.slice(0, hop).map((d) => [d.id, d]));
  const rawPayloads = scen.payloads.filter((p) => p.hop <= hop);
  const ders = derivedAt(scen, hop);
  const byN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  let pt = null;
  try {
    pt = parseTurn(stripReplyLabels(String(text)), { lon: true, rules08: true, snapshot: true, issued: Object.keys(docs), spec: '0.8', profile: 'lon', lang: 'en' });
  } catch { return []; }
  const rows = [];
  for (const c of pt.message?.clauses ?? []) {
    const m = String(c.label ?? '').match(/(\d+)/);
    const n = m ? Number(m[1]) : null;
    if (onlyNums && (n == null || !onlyNums.has(n))) continue;
    const u = n != null ? byN.get(n) : null;
    const conf = c.chae?.self != null ? toDigit(c.chae.self) : null;
    let ok = false;
    if (u && u.ids.length > 0) {
      const matched = rawPayloads.filter((p) => u.ids.includes(p.doc) && (norm(u.fullText).includes(norm(p.value)) || norm(u.text).includes(norm(p.label))));
      ok = matched.some((p) => {
        if (!verifiedLocal(p, docs[p.doc], std.spans)) return false;
        if (p.supersedes) return u.revises.length > 0;
        if (p.withdraws) return u.retracts.length > 0;
        return true;
      });
    } else if (u && u.refs.length > 0) {
      const { ids } = reachOfLocal(u, byN);
      ok = ders.some((d) => d.versions.some((v) => {
        if (!hasNum(u.text, v.value)) return false;
        const reqDocs = rawInputsLocal(scen, d.key, v).map((k) => rawPayloads.find((p) => p.key === k)?.doc).filter(Boolean);
        return reqDocs.every((docId) => ids.has(docId));
      }));
    }
    rows.push({ ok, conf });
  }
  return rows;
}

const meanConfBySession = new Map();
for (const m of MODELS) {
  for (const sc of scens) {
    const s = sessionsMap.get(`${sc.id}|${m}|lon`);
    const seen = new Set();
    const mRows = [];
    for (let h = 1; h <= HOPS; h++) {
      if (!s.notes[h]) continue;
      const stdJ = readNoteJoinedLocal(s.notes[h].text);
      const unitNs = new Set(stdJ.units.map((u) => u.n).filter(Number.isFinite));
      const newNs = new Set([...unitNs].filter((n) => !seen.has(n)));
      for (const n of unitNs) seen.add(n);
      if (newNs.size > 0) mRows.push(...extractLonMukRowsLocal(sc, h, s.notes[h].text, stdJ, newNs));
    }
    const confs = mRows.filter((x) => x.conf != null).map((x) => x.conf);
    meanConfBySession.set(`${sc.id}|${m}`, confs.length ? Math.round(mean(confs)) : 5);
  }
}

const trainGrades = Object.fromEntries(MODELS.map((m) => [m, metrics.eqESim.agents[m].grade]));
const sortedAccModels = [...MODELS].sort((a, b) => trainReaderAcc[b] - trainReaderAcc[a]);
const top4AccSet = new Set(sortedAccModels.slice(0, 4));
const mukGe5Set = new Set(MODELS.filter((m) => trainGrades[m] >= 5));

const scenarioBrier = [];
const agg = { unweighted: [], eqE: [], mukGe5: [], readerAccLin: [], readerAccTop4: [] };

for (const sc of testScens) {
  const bU = [], bE = [], bG5 = [], bAccLin = [], bTop4 = [];
  const aU = [], aE = [], aG5 = [], aAccLin = [], aTop4 = [];
  for (let qi = 0; qi < sc.questions.length; qi++) {
    const votes = MODELS.map((m) => {
      const s = sessionsMap.get(`${sc.id}|${m}|lon`);
      const ok = s.reader[qi].exact ? 1 : 0;
      const mc = meanConfBySession.get(`${sc.id}|${m}`) ?? 5;
      const g = trainGrades[m];
      const wE = 1 - counterShare(g, mc, 5, 'E');
      const wG5 = mukGe5Set.has(m) ? 1 : 0;
      const wLin = trainReaderAcc[m];
      const wTop4 = top4AccSet.has(m) ? 1 : 0;
      return { ok, wE, wG5, wLin, wTop4 };
    });
    const wAvg = (fn) => {
      const ws = votes.reduce((a, v) => a + fn(v), 0);
      return ws > 0 ? votes.reduce((a, v) => a + fn(v) * v.ok, 0) / ws : mean(votes.map((v) => v.ok));
    };
    const pU = mean(votes.map((v) => v.ok));
    const pE = wAvg((v) => v.wE);
    const pG5 = wAvg((v) => v.wG5);
    const pLin = wAvg((v) => v.wLin);
    const pT4 = wAvg((v) => v.wTop4);

    bU.push((pU - 1) ** 2); aU.push(+(pU >= 0.5));
    bE.push((pE - 1) ** 2); aE.push(+(pE >= 0.5));
    bG5.push((pG5 - 1) ** 2); aG5.push(+(pG5 >= 0.5));
    bAccLin.push((pLin - 1) ** 2); aAccLin.push(+(pLin >= 0.5));
    bTop4.push((pT4 - 1) ** 2); aTop4.push(+(pT4 >= 0.5));
  }
  const row = {
    scen: sc.id,
    nItems: sc.questions.length,
    unweightedBrier: mean(bU),
    eqEBrier: mean(bE),
    mukGe5Brier: mean(bG5),
    readerAccLinBrier: mean(bAccLin),
    readerAccTop4Brier: mean(bTop4),
    eqEDiff: mean(bE) - mean(bU),
    mukGe5Diff: mean(bG5) - mean(bU),
    mukGe5VsReaderLinDiff: mean(bG5) - mean(bAccLin),
    unweightedAcc: mean(aU),
    eqEAcc: mean(aE),
    mukGe5Acc: mean(aG5),
  };
  scenarioBrier.push(row);
  agg.unweighted.push(...bU);
  agg.eqE.push(...bE);
  agg.mukGe5.push(...bG5);
  agg.readerAccLin.push(...bAccLin);
  agg.readerAccTop4.push(...bTop4);
}

const brierSummary = {
  nTotalItems: agg.unweighted.length,
  trainReaderAcc,
  trainGrades,
  mukGe5Set: [...mukGe5Set],
  top4ReaderAccSet: [...top4AccSet],
  setsIdentical: [...mukGe5Set].sort().join(',') === [...top4AccSet].sort().join(','),
  unweightedBrier: mean(agg.unweighted),
  eqEBrier: mean(agg.eqE),
  mukGe5Brier: mean(agg.mukGe5),
  readerAccLinBrier: mean(agg.readerAccLin),
  readerAccTop4Brier: mean(agg.readerAccTop4),
  eqEScenImprovedCount: scenarioBrier.filter((r) => r.eqEDiff < 0).length,
  mukGe5ScenImprovedCount: scenarioBrier.filter((r) => r.mukGe5Diff < 0).length,
  mukGe5BeatsReaderLinCount: scenarioBrier.filter((r) => r.mukGe5VsReaderLinDiff < 0).length,
};

// 6. Exact Call Accounting across 240 sessions x 31 steps = 7,440 planned calls
let totalLoggedRows = 0;
let unexecutedCalls = 0;
let unexecutedRelayCalls = 0;
let unexecutedReaderCalls = 0;
let terminalEmptyRefusalRetries = 0;
let terminalRelayRetries = 0;
let terminalReaderRetries = 0;
let recoveredTransientRetries = 0;
let brokenMidRelayCount = 0;
for (const s of sessionsMap.values()) {
  totalLoggedRows += s.rows.length;
  if (s.broken) brokenMidRelayCount++;
  for (let h = 1; h <= HOPS + 1; h++) {
    const hRows = s.rows.filter((r) => r.hop === h);
    if (hRows.length === 0) {
      unexecutedCalls++;
      if (h <= HOPS) unexecutedRelayCalls++;
      else unexecutedReaderCalls++;
    } else if (hRows.length > 1) {
      const extra = hRows.length - 1;
      if (!s.notes[h] && (s.empties[h] ?? 0) >= 3) {
        terminalEmptyRefusalRetries += extra;
        if (h <= HOPS) terminalRelayRetries += extra;
        else terminalReaderRetries += extra;
      } else {
        recoveredTransientRetries += extra;
      }
    }
  }
}
const callAccounting = {
  plannedCalls: sessionsMap.size * (HOPS + 1),
  brokenMidRelaySessions: brokenMidRelayCount,
  unexecutedCalls,
  unexecutedRelayCalls,
  unexecutedReaderCalls,
  retryRowsTotal: terminalEmptyRefusalRetries + recoveredTransientRetries,
  terminalEmptyRefusalRetries,
  terminalRelayRetries,
  terminalReaderRetries,
  recoveredTransientRetries,
  totalLoggedRows,
  identityVerified: sessionsMap.size * (HOPS + 1) - unexecutedCalls + terminalEmptyRefusalRetries + recoveredTransientRetries === totalLoggedRows,
};

// 7. Deterministic Post-Hoc 3-Tier Lon Audit (1,800 hops across 60 lon sessions)
const parseLonSafe = (txt, docsSlice) => {
  try {
    return parseTurn(stripReplyLabels(String(txt)), {
      lon: true, rules08: true, snapshot: true,
      issued: docsSlice.map((d) => d.id), spec: '0.8', profile: 'lon', lang: 'en',
    });
  } catch { return null; }
};
const numsOfText = (s) => (String(s).match(/\d+(?:\.\d+)?/g) ?? []).join(',');
const sigFullClause = (c) => {
  const proc = c.process ? `${c.process.kind}:${c.process.target?.label ?? ''}` : '';
  const bec = (c.because ?? []).map((b) => ('ext' in b ? `${b.ext}${b.id}` : String(b.label ?? ''))).sort().join(',');
  const body = (c.words ?? []).map((w) => w.text).join(' ');
  return `${c.label}|${proc}|${norm(body)}|${bec}`;
};
const sigValLinkClause = (c) => {
  const proc = c.process ? `${c.process.kind}:${c.process.target?.label ?? ''}` : '';
  const bec = (c.because ?? []).map((b) => ('ext' in b ? `${b.ext}${b.id}` : String(b.label ?? ''))).sort().join(',');
  const body = (c.words ?? []).map((w) => w.text).join(' ');
  return `${c.label}|${proc}|${numsOfText(body)}|${bec}`;
};

const lonHopEvents = [];
const s09Hop28Examples = [];
for (const sc of scens) {
  for (const m of MODELS) {
    const s = sessionsMap.get(`${sc.id}|${m}|lon`);
    let lastNote = null;
    for (let h = 1; h <= HOPS; h++) {
      const currText = s.notes[h] ? s.notes[h].text : (s.broken ? null : lastNote);
      const sn = scoreNote('lon', sc, h, currText, lastNote);
      const curL = sn.lin.length ? mean(sn.lin.map((x) => +x.ok)) : 1;
      const curV = sn.per.length ? mean(sn.per.map((x) => +x.v)) : 1;
      const gtLoss = !sn.has || curV < 1 - 1e-9 || curL < 1 - 1e-9 || sn.tamper.altered > 0;
      const reasons = new Set(sn.audit.reasons);

      let substantiveCarryAlter = false;
      let fmtCarryAlter = false;
      if (reasons.has('CARRY_ALTER') && lastNote && currText) {
        const ptPrev = parseLonSafe(lastNote, sc.docs.slice(0, Math.max(1, h - 1)));
        const ptCurr = parseLonSafe(currText, sc.docs.slice(0, h));
        if (ptPrev?.message?.clauses && ptCurr?.message?.clauses) {
          const mapCurr = new Map();
          for (const c of ptCurr.message.clauses) {
            const k = c.label?.replace(/^[절점]/u, '');
            if (k) mapCurr.set(k, c);
          }
          for (const pc of ptPrev.message.clauses) {
            const k = pc.label?.replace(/^[절점]/u, '');
            if (!k || !mapCurr.has(k)) continue;
            const cc = mapCurr.get(k);
            if (sigFullClause(pc) !== sigFullClause(cc)) {
              if (sigValLinkClause(pc) !== sigValLinkClause(cc)) substantiveCarryAlter = true;
              else {
                fmtCarryAlter = true;
                if (m === 'deepseek_on' && sc.id === 'S09' && h === 28) {
                  const reK = new RegExp(`^lon:\\s*<${k}\\s*·`);
                  const rawPrevLine = String(lastNote).split('\n').find((ln) => reK.test(ln.trim())) ?? '';
                  const rawCurrLine = String(currText).split('\n').find((ln) => reK.test(ln.trim())) ?? '';
                  s09Hop28Examples.push({
                    clause: k,
                    prevLen: rawPrevLine.length,
                    currLen: rawCurrLine.length,
                  });
                }
              }
            }
          }
        }
      }

      const t1 = [...reasons].some((c) => /^E\d+/.test(c) || c === 'W44' || c === 'PARSE_ERR' || c === 'BRACKET_PREFIX');
      const t2 = reasons.has('W40') || reasons.has('W45') || reasons.has('CARRY_REORDER') || fmtCarryAlter;
      const t3 = reasons.has('EMPTY') || reasons.has('TAMPERED_RELAY') || reasons.has('CARRY_DROP') || substantiveCarryAlter;
      lonHopEvents.push({ sid: s.sid, scen: sc.id, model: m, hop: h, gtLoss, curL, curV, all: sn.audit.flagged, t1, t2, t3 });
      if (s.notes[h]) lastNote = s.notes[h].text;
    }
  }
}

function summarizeAuditTier(key) {
  const tp = lonHopEvents.filter((e) => e[key] && e.gtLoss).length;
  const fp = lonHopEvents.filter((e) => e[key] && !e.gtLoss).length;
  const fn = lonHopEvents.filter((e) => !e[key] && e.gtLoss).length;
  const tn = lonHopEvents.filter((e) => !e[key] && !e.gtLoss).length;
  const bySid = new Map();
  for (const e of lonHopEvents) {
    if (!bySid.has(e.sid)) bySid.set(e.sid, []);
    bySid.get(e.sid).push(e);
  }
  let sTP = 0, sFP = 0, sFN = 0, sTN = 0;
  const falseCleanScens = [];
  for (const arr of bySid.values()) {
    const h30 = arr[arr.length - 1];
    const badFinal = h30.curL < 1 - 1e-9 || h30.curV < 1 - 1e-9;
    const flg = arr.some((x) => x[key]);
    if (badFinal && flg) sTP++;
    else if (badFinal && !flg) sFN++;
    else if (!badFinal && flg) { sFP++; falseCleanScens.push(`${h30.model}|${h30.scen}`); }
    else sTN++;
  }
  return {
    tp, fp, fn, tn,
    hopPrecision: tp + fp > 0 ? tp / (tp + fp) : NaN,
    hopRecall: tp + fn > 0 ? tp / (tp + fn) : NaN,
    sTP, sFP, sFN, sTN,
    sRecall: sTP + sFN > 0 ? sTP / (sTP + sFN) : NaN,
    sPrecision: sTP + sFP > 0 ? sTP / (sTP + sFP) : NaN,
    cleanFaRate: sFP + sTN > 0 ? sFP / (sFP + sTN) : NaN,
    cleanFaCI95: clopperPearson(sFP, sFP + sTN),
    falseCleanSessions: falseCleanScens,
  };
}
const lonThreeTierAudit = {
  pooledPreReg: summarizeAuditTier('all'),
  tier1Form: summarizeAuditTier('t1'),
  tier2Provenance: summarizeAuditTier('t2'),
  tier3Content: summarizeAuditTier('t3'),
  s09Hop28Examples,
};

// 8. 54-Session Completed `lon` Cell-FE OLS of Reader Accuracy on Form-Lint Instances
const olsObs = [];
for (const m of MODELS) {
  for (const sc of scens) {
    const s = sessionsMap.get(`${sc.id}|${m}|lon`);
    if (!s?.complete) continue;
    const pt30 = parseLonSafe(s.notes[HOPS].text, sc.docs);
    const diags30 = (pt30?.diagnostics ?? []).filter((d) => /^E\d+/.test(d.code) || d.code === 'W44');
    let cumCount = 0;
    for (let h = 1; h <= HOPS; h++) {
      const ptH = parseLonSafe(s.notes[h].text, sc.docs.slice(0, h));
      cumCount += (ptH?.diagnostics ?? []).filter((d) => /^E\d+/.test(d.code) || d.code === 'W44').length;
    }
    const rAll = mean(s.reader.map((r) => +r.exact));
    const rLin = mean(s.reader.filter((_, qi) => sc.questions[qi].kind === 'lineage').map((r) => +r.exact));
    olsObs.push({ model: m, scen: sc.id, xH30: diags30.length, xCum: cumCount, rAll, rLin });
  }
}
function fitCellFeOls(xKey, yKey) {
  const byCell = new Map();
  for (const o of olsObs) {
    if (!byCell.has(o.model)) byCell.set(o.model, []);
    byCell.get(o.model).push(o);
  }
  const mx = Object.fromEntries([...byCell.entries()].map(([m, arr]) => [m, mean(arr.map((z) => z[xKey]))]));
  const my = Object.fromEntries([...byCell.entries()].map(([m, arr]) => [m, mean(arr.map((z) => z[yKey]))]));
  let sxx = 0, sxy = 0, syy = 0;
  for (const o of olsObs) {
    const dx = o[xKey] - mx[o.model];
    const dy = o[yKey] - my[o.model];
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  const n = olsObs.length;
  const kCells = byCell.size;
  const df = n - kCells - 1;
  const beta = sxx > 0 ? sxy / sxx : 0;
  const rss = syy - beta * sxy;
  const se = sxx > 0 && df > 0 ? Math.sqrt(Math.max(0, rss) / (df * sxx)) : NaN;
  const tStat = se > 0 ? beta / se : NaN;
  const pVal = studentTPValue(Math.abs(tStat), df);
  return {
    nSessions: n,
    nCells: kCells,
    df,
    nonZeroPredictorSessions: olsObs.filter((o) => o[xKey] > 0).length,
    beta,
    se,
    tStat,
    pVal,
  };
}
const formLintCellFeOls = {
  hop30OnReaderAll: fitCellFeOls('xH30', 'rAll'),
  hop30OnReaderLin: fitCellFeOls('xH30', 'rLin'),
  cum1to30OnReaderAll: fitCellFeOls('xCum', 'rAll'),
};

// 9. Strictly Proper Multiclass Brier on Held-Out S06..S10 (345 items, exact emitted answers)
const stripQAns = (a) => {
  let s = String(a ?? '').trim();
  for (let i = 0; i < 2; i++) {
    if (/^`[\s\S]*`$/.test(s) && s.length > 1) s = s.slice(1, -1).trim();
    if (/^["“][\s\S]*["”]$/.test(s) && s.length > 1) s = s.slice(1, -1).trim();
  }
  return s;
};
function readerAnswerClassMap(scen, text) {
  const ans = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = line.match(/^\s*\**Q(\d+)\**\s*[:.]\s*(.*)$/);
    if (m && ans[m[1]] == null) ans[m[1]] = m[2];
  }
  const sr = scoreReader(scen, text);
  return sr.map((r, qi) => {
    if (r.exact) return '__Y_STAR__';
    const raw = ans[scen.questions[qi].q];
    if (r.missing || raw == null) return '__MISSING__';
    const cleaned = norm(stripQAns(raw).replace(/^`|`$/g, ''));
    return `W:${cleaned}`;
  });
}
const mcAgg = { unweighted: [], eqE: [], mukGe5: [], readerAccLin: [], readerAccTop4: [] };
for (const sc of testScens) {
  const clsByModel = Object.fromEntries(MODELS.map((m) => {
    const s = sessionsMap.get(`${sc.id}|${m}|lon`);
    return [m, readerAnswerClassMap(sc, s.notes[HOPS + 1]?.text ?? '')];
  }));
  for (let qi = 0; qi < sc.questions.length; qi++) {
    const votes = MODELS.map((m) => {
      const mc = meanConfBySession.get(`${sc.id}|${m}`) ?? 5;
      const g = trainGrades[m];
      return {
        cls: clsByModel[m][qi],
        wU: 1,
        wE: 1 - counterShare(g, mc, 5, 'E'),
        wG5: mukGe5Set.has(m) ? 1 : 0,
        wLin: trainReaderAcc[m],
        wT4: top4AccSet.has(m) ? 1 : 0,
      };
    });
    const mcBrier = (wKey) => {
      const ws = votes.reduce((a, v) => a + v[wKey], 0);
      const probs = new Map();
      for (const v of votes) {
        const w = ws > 0 ? v[wKey] / ws : 1 / votes.length;
        probs.set(v.cls, (probs.get(v.cls) ?? 0) + w);
      }
      let loss = (1 - (probs.get('__Y_STAR__') ?? 0)) ** 2;
      for (const [cls, p] of probs.entries()) {
        if (cls !== '__Y_STAR__') loss += p * p;
      }
      return loss;
    };
    mcAgg.unweighted.push(mcBrier('wU'));
    mcAgg.eqE.push(mcBrier('wE'));
    mcAgg.mukGe5.push(mcBrier('wG5'));
    mcAgg.readerAccLin.push(mcBrier('wLin'));
    mcAgg.readerAccTop4.push(mcBrier('wT4'));
  }
}
const multiclassBrier = {
  nItems: mcAgg.unweighted.length,
  unweighted: mean(mcAgg.unweighted),
  eqE: mean(mcAgg.eqE),
  mukGe5: mean(mcAgg.mukGe5),
  readerAccLin: mean(mcAgg.readerAccLin),
  readerAccTop4: mean(mcAgg.readerAccTop4),
  eqEReductionPct: ((mean(mcAgg.eqE) / mean(mcAgg.unweighted)) - 1) * 100,
  mukGe5ReductionPct: ((mean(mcAgg.mukGe5) / mean(mcAgg.unweighted)) - 1) * 100,
};

// 10. Chae Empirical Letter Distribution Across Deduplicated Newly Emitted Clauses (zero letter definitions)
const CHAE_LETTERS = ['R', 'G', 'B', 'C', 'M', 'Y', 'K'];
const chaeByCell = {};
const chaeTotals = Object.fromEntries(CHAE_LETTERS.map((c) => [c, 0]));
let chaeTotalWithLetter = 0;
for (const m of MODELS) {
  const counts = Object.fromEntries(CHAE_LETTERS.map((c) => [c, 0]));
  let total = 0;
  for (const sc of scens) {
    const s = sessionsMap.get(`${sc.id}|${m}|lon`);
    const seenNs = new Set();
    for (let h = 1; h <= HOPS; h++) {
      if (!s.notes[h]) continue;
      const pt = parseLonSafe(s.notes[h].text, sc.docs.slice(0, h));
      if (!pt?.message?.clauses) continue;
      for (const c of pt.message.clauses) {
        const lm = String(c.label ?? '').match(/(\d+)/);
        const n = lm ? Number(lm[1]) : null;
        if (n == null || seenNs.has(n)) continue;
        seenNs.add(n);
        const col = c.chae?.color;
        if (col && counts[col] != null) {
          counts[col]++;
          chaeTotals[col]++;
          total++;
          chaeTotalWithLetter++;
        }
      }
    }
  }
  const pcts = Object.fromEntries(CHAE_LETTERS.map((c) => [c, total ? (100 * counts[c]) / total : 0]));
  chaeByCell[m] = { totalWithChae: total, counts, pcts };
}
const chaeDistribution = {
  totalDeduplicatedWithChae: chaeTotalWithLetter,
  totals: chaeTotals,
  byCell: chaeByCell,
};

// 11. Haiku 89 Streaming Refusal Breakdown (scenario x format x hop)
const refusalByModelFormat = {};
const haikuOnTripleEmptyHalts = [];
for (const m of ['haiku_on', 'haiku_off']) {
  refusalByModelFormat[m] = {};
  for (const f of ['natural', 'json', 'jsonchain', 'lon']) {
    let total = 0, empty = 0, midStream = 0;
    for (const sc of scens) {
      const s = sessionsMap.get(`${sc.id}|${m}|${f}`);
      for (const r of s.rows) {
        if (String(r.finish ?? '') === 'refusal') {
          total++;
          if (String(r.text ?? '').trim()) midStream++;
          else empty++;
        }
      }
      if (m === 'haiku_on') {
        for (let h = 1; h <= HOPS + 1; h++) {
          if (!s.notes[h] && (s.empties[h] ?? 0) >= 3) {
            haikuOnTripleEmptyHalts.push({ scen: sc.id, format: f, hop: h });
          }
        }
      }
    }
    refusalByModelFormat[m][f] = { total, empty, midStream };
  }
}
const refusalTotalsByFormat = Object.fromEntries(
  ['natural', 'json', 'jsonchain', 'lon'].map((f) => [
    f,
    refusalByModelFormat.haiku_on[f].total + refusalByModelFormat.haiku_off[f].total,
  ]),
);
const haikuRefusalBreakdown = {
  totalRefusals: Object.values(refusalTotalsByFormat).reduce((a, b) => a + b, 0),
  byFormatTotal: refusalTotalsByFormat,
  byModelFormat: refusalByModelFormat,
  haikuOnTripleEmptyHalts,
};

const outJson = {
  generatedAt: new Date().toISOString(),
  note: 'Post-hoc verification diagnostics over locked E13 logs and pre-registered metrics (prereg files unmodified).',
  contrasts18: {
    holmWTL: { total: { W: totalHolmW, T: totalHolmT, L: totalHolmL }, byBaseline: talliesHolm },
    holmAll18WTL: { total: { W: holm18W, T: holm18T, L: holm18L } },
    rawWTL: { total: { W: totalRawW, T: totalRawT, L: totalRawL }, byBaseline: talliesRaw },
    rows: contrasts18,
  },
  callAccounting,
  eventCategories: catTable,
  auditBaseRatesAndCIs: {
    byFormat: auditRates,
    lonPostHocContentTierCleanFA: { k: lonThreeTierAudit.tier3Content.sFP, n: 7, rate: 0, ci95: lonContentCleanCI },
  },
  lonThreeTierAudit,
  formLintCellFeOls,
  promptDecomposition: {
    byFormat: promptDecomposition,
    tinOverhead,
  },
  heldOutEnsembleBrier: {
    summary: brierSummary,
    perScenario: scenarioBrier,
    multiclassBrier,
  },
  chaeDistribution,
  haikuRefusalBreakdown,
};

mkdirSync(dirname(`${BASE}/report/diag-e13-posthoc2.json`), { recursive: true });
writeFileSync(`${BASE}/report/diag-e13-posthoc2.json`, JSON.stringify(outJson, null, 2) + '\n');

// Markdown Summary
const md = [];
md.push('# E13 Post-Hoc Verification Diagnostics (Review Audit Matrix)');
md.push('');
md.push(`Generated ${outJson.generatedAt} strictly post-hoc from locked logs without altering preregistered files.`);
md.push('');
const BT = '`';
md.push('## 1. 18 Paired `L` Contrasts (`6` Cells x `3` Baselines)');
md.push(`- **Holm-adjusted per baseline (${BT}m = 6${BT}, ${BT}p_Holm < 0.05${BT}):** ${totalHolmW} Wins, ${totalHolmT} Ties (n.s.), ${totalHolmL} Losses (${BT}natural${BT} ${talliesHolm.natural.W}W/${talliesHolm.natural.T}T/${talliesHolm.natural.L}L; ${BT}json${BT} ${talliesHolm.json.W}W/${talliesHolm.json.T}T/${talliesHolm.json.L}L; ${BT}jsonchain${BT} ${talliesHolm.jsonchain.W}W/${talliesHolm.jsonchain.T}T/${talliesHolm.jsonchain.L}L).`);
md.push(`- **Simultaneous Holm across all 18 contrasts (${BT}m = 18${BT} sensitivity):** ${holm18W} Wins, ${holm18T} Ties, ${holm18L} Losses (discrete sign-flip floor ${BT}2/1024 = 0.00195${BT} requires unanimous 10/10 sign agreement to reach ${BT}p_Holm < 0.05${BT} when ${BT}m = 18${BT}).`);
md.push(`- **Raw (${BT}p < 0.05${BT}):** ${totalRawW} Wins, ${totalRawT} Ties, ${totalRawL} Losses (${BT}jsonchain${BT} ${talliesRaw.jsonchain.W}W/${talliesRaw.jsonchain.T}T/${talliesRaw.jsonchain.L}L). All 4 Holm-significant losses occur in ${BT}haiku_on${BT}/${BT}haiku_off${BT}.`);
md.push('');
md.push('| Baseline | Cell | L Diff | 95% Boot CI | p Raw | p Holm (m=6) | p Holm (m=18) | Outcome (m=6) |');
md.push('|---|---|---:|---|---:|---:|---:|:---:|');
for (const c of contrasts18) {
  md.push(`| ${c.baseline} | ${c.model} | ${c.diffL.toFixed(3)} | [${c.ci95[0].toFixed(3)}, ${c.ci95[1].toFixed(3)}] | ${c.pRaw.toFixed(4)} | ${c.pHolm.toFixed(4)} | ${c.pHolmAll18.toFixed(4)} | ${c.outcomeHolm} |`);
}
md.push('');
md.push('## 1b. Exact Call Accounting (`7,440` Planned -> `7,176` Logged Rows)');
md.push(`- **Accounting:** ${BT}${callAccounting.plannedCalls} − ${callAccounting.unexecutedCalls}${BT} unexecuted calls across ${BT}${callAccounting.brokenMidRelaySessions}${BT} mid-relay ITT-halted Haiku sessions (${BT}${callAccounting.unexecutedRelayCalls}${BT} relay hops + ${BT}${callAccounting.unexecutedReaderCalls}${BT} Hop-31 Reader calls) + ${BT}${callAccounting.retryRowsTotal}${BT} retry rows (${BT}${callAccounting.terminalEmptyRefusalRetries}${BT} retries across 15 3-strike empty-refusal halts [${BT}${callAccounting.terminalRelayRetries}${BT} relay + ${BT}${callAccounting.terminalReaderRetries}${BT} Reader] + ${BT}${callAccounting.recoveredTransientRetries}${BT} recovered retries) = ${BT}${callAccounting.totalLoggedRows}${BT} (verified: ${BT}${callAccounting.identityVerified}${BT}).`);
md.push('');
md.push('## 2. Event-Category Breakdown (`amend`, `withdraw`, `recompute`) & Unit Counts');
md.push('| Cell | Fmt | Hop-30 Units | Amend L | Withdraw L | Recompute L (cNew / cOld / cEdge) |');
md.push('|---|---|---:|---:|---:|---|');
for (const r of catTable) {
  const rc = r.recompute;
  md.push(`| ${r.model} | ${r.format} | ${r.meanUnitsH30.toFixed(1)} | ${r.amend.ok.toFixed(3)} | ${r.withdraw.ok.toFixed(3)} | ${rc.ok.toFixed(3)} (${rc.cNew.toFixed(3)} / ${rc.cOld.toFixed(3)} / ${rc.cEdge.toFixed(3)}) |`);
}
md.push('');
md.push('## 3. Audit Base Rates, Post-Hoc 3-Tier `lon` Decomposition & Cell-FE OLS');
md.push('| Format | Defective / Total Sess | Flag-All Sess Prec | Flag-All Hop Prec | Audit Sess Prec | Clean FA (`k/n`) | Clean FA 95% CI |');
md.push('|---|---|---|---|---|---|---|');
for (const a of auditRates) {
  const ci = a.cleanFaCI95 ? `[${a.cleanFaCI95[0].toFixed(3)}, ${a.cleanFaCI95[1].toFixed(3)}]` : 'n/a (0/0)';
  md.push(`| ${a.format} | ${a.defectiveSessions}/${a.sessions} | ${a.flagAllSessionPrec.toFixed(3)} | ${a.flagAllHopPrec.toFixed(3)} | ${a.sPrecision.toFixed(3)} | ${a.cleanFaCount}/${a.cleanSessions} (${a.cleanFaRate.toFixed(3)}) | ${ci} |`);
}
md.push('');
md.push('| `lon` Audit Operating Point | TP | FP | Hop Prec | Hop Rec | Sess Rec | Clean FA (`k/7`) | Clean FA 95% CI |');
md.push('|---|---:|---:|---:|---:|---:|---|---|');
for (const [lbl, t] of [
  ['Pooled Pre-Reg (`ALL`)', lonThreeTierAudit.pooledPreReg],
  ['Post-hoc Tier 1 (Form lint)', lonThreeTierAudit.tier1Form],
  ['Post-hoc Tier 2 (Provenance/fmt)', lonThreeTierAudit.tier2Provenance],
  ['Post-hoc Tier 3 (Content integrity)', lonThreeTierAudit.tier3Content],
]) {
  md.push(`| ${lbl} | ${t.tp} | ${t.fp} | ${t.hopPrecision.toFixed(3)} | ${t.hopRecall.toFixed(3)} | ${t.sRecall.toFixed(3)} (${t.sTP}/${t.sTP + t.sFN}) | ${t.sFP}/7 (${t.cleanFaRate.toFixed(3)}) | [${t.cleanFaCI95[0].toFixed(3)}, ${t.cleanFaCI95[1].toFixed(3)}] |`);
}
md.push(`- **Cell-FE Form-Lint OLS (${BT}54${BT} completed ${BT}lon${BT} sessions, ${BT}df = 47${BT}):** Hop-30 form-lint count (${BT}${formLintCellFeOls.hop30OnReaderAll.nonZeroPredictorSessions}/54${BT} non-zero) on Reader Overall Acc: ${BT}beta = ${formLintCellFeOls.hop30OnReaderAll.beta.toFixed(5)}${BT}, ${BT}SE = ${formLintCellFeOls.hop30OnReaderAll.se.toFixed(5)}${BT}, ${BT}t = ${formLintCellFeOls.hop30OnReaderAll.tStat.toFixed(3)}${BT}, ${BT}p = ${formLintCellFeOls.hop30OnReaderAll.pVal.toFixed(3)}${BT} (Reader Lineage Acc: ${BT}beta = ${formLintCellFeOls.hop30OnReaderLin.beta.toFixed(5)}${BT}, ${BT}t = ${formLintCellFeOls.hop30OnReaderLin.tStat.toFixed(3)}${BT}, ${BT}p = ${formLintCellFeOls.hop30OnReaderLin.pVal.toFixed(3)}${BT}).`);
if (s09Hop28Examples.length) {
  md.push(`- **Post-hoc ${BT}S09${BT} Hop 28 formatting example:** ${s09Hop28Examples.map((e) => `clause ${e.clause} (${e.prevLen} -> ${e.currLen} chars)`).join(', ')}.`);
}
md.push('');
md.push('## 4. Static Prompt Character & Input Token Decomposition');
md.push('| Format | Shared ROLE+POLICY+Sep | Format Block | Total Static Chars | ds_on Total `tin` | luna_on Total `tin` |');
md.push('|---|---:|---:|---:|---:|---:|');
for (const fmt of ['natural', 'json', 'jsonchain', 'lon']) {
  const p = promptDecomposition[fmt];
  md.push(`| ${fmt} | ${p.sharedRolePlusPolicyWithSeps} | ${p.formatBlockChars} | ${p.totalStaticChars} | ${p.dsOnTotalTin.toLocaleString('en-US')} | ${p.lunaOnTotalTin.toLocaleString('en-US')} |`);
}
md.push(`- **${BT}lon${BT} vs ${BT}jsonchain${BT} total ${BT}tin${BT}:** ${BT}ds_on +${tinOverhead.dsOnLonVsJsonchainPct.toFixed(1)}%${BT}, ${BT}luna_on +${tinOverhead.lunaOnLonVsJsonchainPct.toFixed(1)}%${BT}. Note ${BT}lon${BT}'s ${BT}${promptDecomposition.lon.formatBlockChars}${BT}-char block = ${BT}${promptDecomposition.lon.lonBaseChars}${BT} general lexicon/grammar + ${BT}${promptDecomposition.lon.lonSnapshotSuffixChars}${BT} snapshot syntax.`);
md.push('');
md.push('## 5. Held-Out `S06..S10` Brier Ensemble Per-Scenario Check (`345` Items)');
md.push(`- **Single-target Brier:** Unweighted ${BT}${brierSummary.unweightedBrier.toFixed(4)}${BT}, ${BT}Eq. E${BT} ${BT}${brierSummary.eqEBrier.toFixed(4)}${BT} (${brierSummary.eqEScenImprovedCount}/5 scenarios improved), linear ${BT}S01..S05${BT} Reader-Acc ${BT}${brierSummary.readerAccLinBrier.toFixed(4)}${BT}, hard ${BT}Muk >= 5${BT} ${BT}${brierSummary.mukGe5Brier.toFixed(4)}${BT} (${brierSummary.mukGe5ScenImprovedCount}/5 improved vs unweighted; ${brierSummary.mukGe5BeatsReaderLinCount}/5 better than linear Reader-Acc), Top-4 Reader-Acc ${BT}${brierSummary.readerAccTop4Brier.toFixed(4)}${BT} (identical 4-cell set without requiring Reader labels: ${brierSummary.setsIdentical}).`);
md.push(`- **Strictly proper multiclass Brier (Gneiting & Raftery, 2007):** Unweighted ${BT}${multiclassBrier.unweighted.toFixed(4)}${BT}, ${BT}Eq. E${BT} ${BT}${multiclassBrier.eqE.toFixed(4)}${BT} (${multiclassBrier.eqEReductionPct.toFixed(1)}%), linear ${BT}Reader-Acc${BT} ${BT}${multiclassBrier.readerAccLin.toFixed(4)}${BT}, hard ${BT}Muk >= 5${BT} / Top-4 ${BT}${multiclassBrier.mukGe5.toFixed(4)}${BT} (${multiclassBrier.mukGe5ReductionPct.toFixed(1)}%).`);
md.push('');
md.push('| Scen | Unweighted | Eq. E | Muk >= 5 | Reader-Acc Lin | Top-4 Reader-Acc | Eq. E − Unw | Muk>=5 − Unw | Muk>=5 − RLin |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of scenarioBrier) {
  md.push(`| ${r.scen} | ${r.unweightedBrier.toFixed(4)} | ${r.eqEBrier.toFixed(4)} | ${r.mukGe5Brier.toFixed(4)} | ${r.readerAccLinBrier.toFixed(4)} | ${r.readerAccTop4Brier.toFixed(4)} | ${r.eqEDiff.toFixed(4)} | ${r.mukGe5Diff.toFixed(4)} | ${r.mukGe5VsReaderLinDiff.toFixed(4)} |`);
}
md.push('');
md.push(`## 6. Empirical ${BT}Chae${BT} Distribution (${BT}${chaeDistribution.totalDeduplicatedWithChae}${BT} Deduplicated Clauses) & Haiku ${BT}${haikuRefusalBreakdown.totalRefusals}${BT} Refusals`);
md.push('| Cell | Clauses | R | G | B | C | M | Y | K |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const m of MODELS) {
  const c = chaeByCell[m];
  md.push(`| ${m} | ${c.totalWithChae} | ${c.counts.R} (${c.pcts.R.toFixed(1)}%) | ${c.counts.G} (${c.pcts.G.toFixed(1)}%) | ${c.counts.B} (${c.pcts.B.toFixed(1)}%) | ${c.counts.C} | ${c.counts.M} | ${c.counts.Y} | ${c.counts.K} |`);
}
md.push('');
md.push(`- **Haiku ${BT}finish="refusal"${BT} (${BT}${haikuRefusalBreakdown.totalRefusals}${BT} total):** ${BT}lon ${refusalTotalsByFormat.lon}${BT}, ${BT}jsonchain ${refusalTotalsByFormat.jsonchain}${BT}, ${BT}natural ${refusalTotalsByFormat.natural}${BT}, ${BT}json ${refusalTotalsByFormat.json}${BT}. On ${BT}haiku_on${BT}, ${BT}S02${BT} Hop 3 halted across all 4 formats simultaneously, while ${BT}lon${BT} additionally halted ${BT}S03, S04${BT} (Hop 3) and ${BT}S10${BT} (Hop 4).`);

writeFileSync(`${BASE}/report/diag-e13-posthoc2.md`, md.join('\n') + '\n');
console.log('wrote report/diag-e13-posthoc2.json and report/diag-e13-posthoc2.md');
