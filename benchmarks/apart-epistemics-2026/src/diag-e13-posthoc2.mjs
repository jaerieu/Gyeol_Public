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
import { parseTurn, stripReplyLabels, toDigit } from '../vendor/gyeol-10fba3d/src/index.ts';
import { counterShare } from '../vendor/gyeol-10fba3d/src/muk.ts';

const BASE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = ['deepseek_on', 'luna_on', 'haiku_on', 'deepseek_off', 'luna_off', 'haiku_off'];
const BASELINES = ['natural', 'json', 'jsonchain'];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

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
      if (!S.has(r.sid)) S.set(r.sid, { sid: r.sid, scen: r.scen, model: r.model, format: r.format, notes: {}, empties: {} });
      const s = S.get(r.sid);
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

const outJson = {
  generatedAt: new Date().toISOString(),
  note: 'Post-hoc verification diagnostics over locked E13 logs and pre-registered metrics (prereg files unmodified).',
  contrasts18: {
    holmWTL: { total: { W: totalHolmW, T: totalHolmT, L: totalHolmL }, byBaseline: talliesHolm },
    rawWTL: { total: { W: totalRawW, T: totalRawT, L: totalRawL }, byBaseline: talliesRaw },
    rows: contrasts18,
  },
  eventCategories: catTable,
  auditBaseRatesAndCIs: {
    byFormat: auditRates,
    lonPostHocContentTierCleanFA: { k: 0, n: 7, rate: 0, ci95: lonContentCleanCI },
  },
  promptDecomposition: {
    byFormat: promptDecomposition,
    tinOverhead,
  },
  heldOutEnsembleBrier: {
    summary: brierSummary,
    perScenario: scenarioBrier,
  },
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
md.push(`- **Holm-adjusted (${BT}p_Holm < 0.05${BT}):** ${totalHolmW} Wins, ${totalHolmT} Ties (n.s.), ${totalHolmL} Losses (${BT}natural${BT} ${talliesHolm.natural.W}W/${talliesHolm.natural.T}T/${talliesHolm.natural.L}L; ${BT}json${BT} ${talliesHolm.json.W}W/${talliesHolm.json.T}T/${talliesHolm.json.L}L; ${BT}jsonchain${BT} ${talliesHolm.jsonchain.W}W/${talliesHolm.jsonchain.T}T/${talliesHolm.jsonchain.L}L).`);
md.push(`- **Raw (${BT}p < 0.05${BT}):** ${totalRawW} Wins, ${totalRawT} Ties, ${totalRawL} Losses (${BT}jsonchain${BT} ${talliesRaw.jsonchain.W}W/${talliesRaw.jsonchain.T}T/${talliesRaw.jsonchain.L}L). All 4 Holm-significant losses occur in ${BT}haiku_on${BT}/${BT}haiku_off${BT}.`);
md.push('');
md.push('| Baseline | Cell | L Diff | 95% Boot CI | p Raw | p Holm | Outcome (Holm) |');
md.push('|---|---|---:|---|---:|---:|:---:|');
for (const c of contrasts18) {
  md.push(`| ${c.baseline} | ${c.model} | ${c.diffL.toFixed(3)} | [${c.ci95[0].toFixed(3)}, ${c.ci95[1].toFixed(3)}] | ${c.pRaw.toFixed(4)} | ${c.pHolm.toFixed(4)} | ${c.outcomeHolm} |`);
}
md.push('');
md.push('## 2. Event-Category Breakdown (`amend`, `withdraw`, `recompute`) & Unit Counts');
md.push('| Cell | Fmt | Hop-30 Units | Amend L | Withdraw L | Recompute L (cNew / cOld / cEdge) |');
md.push('|---|---|---:|---:|---:|---|');
for (const r of catTable) {
  const rc = r.recompute;
  md.push(`| ${r.model} | ${r.format} | ${r.meanUnitsH30.toFixed(1)} | ${r.amend.ok.toFixed(3)} | ${r.withdraw.ok.toFixed(3)} | ${rc.ok.toFixed(3)} (${rc.cNew.toFixed(3)} / ${rc.cOld.toFixed(3)} / ${rc.cEdge.toFixed(3)}) |`);
}
md.push('');
md.push('## 3. Audit Base Rates & Exact Clopper-Pearson 95% CIs');
md.push('| Format | Defective / Total Sess | Flag-All Sess Prec | Flag-All Hop Prec | Audit Sess Prec | Clean FA (`k/n`) | Clean FA 95% CI |');
md.push('|---|---|---|---|---|---|---|');
for (const a of auditRates) {
  const ci = a.cleanFaCI95 ? `[${a.cleanFaCI95[0].toFixed(3)}, ${a.cleanFaCI95[1].toFixed(3)}]` : 'n/a (0/0)';
  md.push(`| ${a.format} | ${a.defectiveSessions}/${a.sessions} | ${a.flagAllSessionPrec.toFixed(3)} | ${a.flagAllHopPrec.toFixed(3)} | ${a.sPrecision.toFixed(3)} | ${a.cleanFaCount}/${a.cleanSessions} (${a.cleanFaRate.toFixed(3)}) | ${ci} |`);
}
md.push(`- **Post-hoc 3-tier ${BT}lon${BT} content-only clean FA:** ${BT}0/7 (0.000)${BT}, Clopper-Pearson 95% CI ${BT}[${lonContentCleanCI[0].toFixed(3)}, ${lonContentCleanCI[1].toFixed(3)}]${BT}.`);
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
md.push(`- **Overall:** Unweighted ${BT}${brierSummary.unweightedBrier.toFixed(4)}${BT}, ${BT}Eq. E${BT} ${BT}${brierSummary.eqEBrier.toFixed(4)}${BT} (${brierSummary.eqEScenImprovedCount}/5 scenarios improved), linear ${BT}S01..S05${BT} Reader-Acc ${BT}${brierSummary.readerAccLinBrier.toFixed(4)}${BT}, hard ${BT}Muk >= 5${BT} ${BT}${brierSummary.mukGe5Brier.toFixed(4)}${BT} (${brierSummary.mukGe5ScenImprovedCount}/5 improved vs unweighted; ${brierSummary.mukGe5BeatsReaderLinCount}/5 better than linear Reader-Acc), Top-4 Reader-Acc ${BT}${brierSummary.readerAccTop4Brier.toFixed(4)}${BT} (identical 4-cell set without requiring Reader labels: ${brierSummary.setsIdentical}).`);
md.push('');
md.push('| Scen | Unweighted | Eq. E | Muk >= 5 | Reader-Acc Lin | Top-4 Reader-Acc | Eq. E − Unw | Muk>=5 − Unw | Muk>=5 − RLin |');
md.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of scenarioBrier) {
  md.push(`| ${r.scen} | ${r.unweightedBrier.toFixed(4)} | ${r.eqEBrier.toFixed(4)} | ${r.mukGe5Brier.toFixed(4)} | ${r.readerAccLinBrier.toFixed(4)} | ${r.readerAccTop4Brier.toFixed(4)} | ${r.eqEDiff.toFixed(4)} | ${r.mukGe5Diff.toFixed(4)} | ${r.mukGe5VsReaderLinDiff.toFixed(4)} |`);
}

writeFileSync(`${BASE}/report/diag-e13-posthoc2.md`, md.join('\n') + '\n');
console.log('wrote report/diag-e13-posthoc2.json and report/diag-e13-posthoc2.md');
