// Post-hoc diagnostic decomposition for E13 (read-only analysis over results/e13/*.jsonl).
// Does NOT modify pre-registered primary scores; separates API refusal, prompt-wrapper echo,
// omitted recomputations, and clean-session lint false alarms.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreNote, oracleFreeAudit } from './score-e13.mjs';
import { readNote } from './score-e10.mjs';
import { HOPS, norm, inForce, derivedAt, hasNum } from './lib-e12.mjs';
import { parseTurn, stripReplyLabels, toDigit } from '../vendor/gyeol-10fba3d/src/index.ts';
import { MUK, summarizeAnswers, credibility, gradeOf } from '../vendor/gyeol-10fba3d/src/muk.ts';

const BASE = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODELS = ['deepseek_on', 'deepseek_off', 'haiku_on', 'haiku_off', 'luna_on', 'luna_off'];
const uniq = (a) => [...new Set(a)];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

const sRaw = JSON.parse(readFileSync(`${BASE}/data/sessions-e13.json`, 'utf8'));
const scens = sRaw.scenarios;
const byId = Object.fromEntries(scens.map((s) => [s.id, s]));

function readRows(model) {
  return readFileSync(`${BASE}/results/e13/e13-${model}.jsonl`, 'utf8')
    .split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

function stripWrapper(text) {
  return String(text ?? '').replace(/\n?===\s*(?:New|End of)\s+document\s+evd\d+\s*===\n?/gi, '');
}

function readNoteJoinedLocal(text) {
  const std = readNote('lon', text, false);
  for (const u of std.units) {
    const extra = std.spans
      .filter((s) => s.ids.length === 1 && u.ids.includes(s.ids[0]))
      .map((s) => s.text)
      .join(' ');
    if (extra) u.fullText = `${u.fullText} ${extra}`.trim();
  }
  return std;
}

function rawInputs(scen, dkey, ver) {
  const out = [];
  for (const k of ver.inputs) {
    if (/^D\d$/.test(k)) {
      const d = scen.derived.find((x) => x.key === k);
      const v = d.versions.filter((x) => x.hop <= ver.hop).at(-1);
      out.push(...rawInputs(scen, k, v));
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
    const color = c.chae?.color && ['R', 'G', 'B', 'C', 'M', 'Y', 'K'].includes(c.chae.color) ? c.chae.color : null;
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
        const reqDocs = rawInputs(scen, d.key, v).map((k) => rawPayloads.find((p) => p.key === k)?.doc).filter(Boolean);
        return reqDocs.every((docId) => ids.has(docId));
      }));
    }
    rows.push({ ok, conf, color, n });
  }
  return rows;
}

function summarizeSessions(allRowsByModel) {
  const tally = {};
  for (const [model, rows] of Object.entries(allRowsByModel)) {
    const errors = rows.filter((r) => r.error);
    const refusals = rows.filter((r) => !r.error && r.finish === 'refusal');
    const empties = rows.filter((r) => !r.error && !(r.text ?? '').trim());
    const byFmtRefusal = {};
    const byFmtEmpty = {};
    for (const r of refusals) {
      byFmtRefusal[r.format] = (byFmtRefusal[r.format] ?? 0) + 1;
      if (!(r.text ?? '').trim()) byFmtEmpty[r.format] = (byFmtEmpty[r.format] ?? 0) + 1;
    }
    const refusalDetails = refusals.map((r) => ({
      scen: r.scen, format: r.format, hop: r.hop, attempt: r.attempt, empty: !(r.text ?? '').trim(), rtok: r.reasoning_tokens ?? null,
    }));
    const errorDetails = errors.map((r) => ({
      scen: r.scen, format: r.format, hop: r.hop, attempt: r.attempt, cache: r.cache ?? null, error: r.error,
    }));
    tally[model] = {
      rows: rows.length,
      errorRows: errors.length,
      refusalRows: refusals.length,
      emptyRefusals: refusals.filter((r) => !(r.text ?? '').trim()).length,
      truncatedRefusals: refusals.filter((r) => (r.text ?? '').trim()).length,
      emptyRows: empties.length,
      refusalsByFormat: byFmtRefusal,
      emptyRefusalsByFormat: byFmtEmpty,
      refusalDetails,
      errorDetails,
    };
  }
  return tally;
}

const allRows = Object.fromEntries(MODELS.map((m) => [m, readRows(m)]));
const apiDiagnostics = summarizeSessions(allRows);

// 1. Haiku_on|lon prompt-wrapper sensitivity analysis
const haikuLonRows = allRows.haiku_on.filter((r) => r.format === 'lon');
const hSessions = new Map();
for (const sc of scens) hSessions.set(sc.id, { notes: {}, empties: {} });
for (const r of haikuLonRows) {
  if (r.error) continue;
  const st = hSessions.get(r.scen);
  if ((r.text ?? '').trim()) {
    if (!st.notes[r.hop]) st.notes[r.hop] = r.text;
  } else {
    st.empties[r.hop] = (st.empties[r.hop] ?? 0) + 1;
  }
}

const haikuWrapperPerScen = [];
const haikuMukFolds = [];
const haikuMukRowsAll = [];
let idxTs = 0;

for (const sc of scens) {
  const st = hSessions.get(sc.id);
  const complete = Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => st.notes[h]);
  const note30 = complete ? st.notes[HOPS] : null;
  const scRaw = complete ? scoreNote('lon', sc, HOPS, note30) : null;
  const scStrip = complete ? scoreNote('lon', sc, HOPS, stripWrapper(note30)) : null;

  const metricOf = (s) => (s ? {
    L: mean(s.lin.map((x) => +x.ok)),
    L_strict: mean(s.linStrict.map((x) => +x.ok)),
    V: mean(s.per.map((x) => +x.v)),
    Vh: mean(s.hist.map((x) => +x.v)),
    tamperTotal: s.tamper.total,
    tamperAltered: s.tamper.altered,
    tamperRate: s.tamper.alteredRate,
  } : { L: 0, L_strict: 0, V: 0, Vh: 0, tamperTotal: 0, tamperAltered: 0, tamperRate: 0 });

  let firstWrapperHop = null;
  for (let h = 1; h <= HOPS; h++) {
    if (st.notes[h] && /===\s*End of document/i.test(st.notes[h])) {
      firstWrapperHop = h;
      break;
    }
  }

  haikuWrapperPerScen.push({
    scen: sc.id,
    complete,
    maxHopText: Math.max(0, ...Object.keys(st.notes).map(Number)),
    refusals: apiDiagnostics.haiku_on.refusalDetails.filter((d) => d.format === 'lon' && d.scen === sc.id),
    firstWrapperHop,
    raw: metricOf(scRaw),
    stripped: metricOf(scStrip),
  });

  // Stripped Muk fold over newly introduced clauses
  const seenNs = new Set();
  const sRows = [];
  for (let h = 1; h <= HOPS; h++) {
    if (!st.notes[h]) continue;
    const stripped = stripWrapper(st.notes[h]);
    const stdJ = readNoteJoinedLocal(stripped);
    const curNs = new Set(stdJ.units.map((u) => u.n).filter(Number.isFinite));
    const newNs = new Set([...curNs].filter((n) => !seenNs.has(n)));
    curNs.forEach((n) => seenNs.add(n));
    const extracted = extractLonMukRowsLocal(sc, h, stripped, stdJ, newNs);
    sRows.push(...extracted);
  }
  haikuMukRowsAll.push(...sRows);
  haikuMukFolds.push({ at: ++idxTs * 86400000, s: summarizeAnswers(sRows) });
}

const completedScens = haikuWrapperPerScen.filter((x) => x.complete);
const mukSum = summarizeAnswers(haikuMukRowsAll);
const mukTrust = credibility(haikuMukFolds, MUK.mid);
const withChae = haikuMukRowsAll.filter((r) => r.conf != null);
const haikuStrippedSummary = {
  completedCount: completedScens.length,
  ittCount: haikuWrapperPerScen.length,
  completedMean: {
    L: mean(completedScens.map((x) => x.stripped.L)),
    L_strict: mean(completedScens.map((x) => x.stripped.L_strict)),
    V: mean(completedScens.map((x) => x.stripped.V)),
    Vh: mean(completedScens.map((x) => x.stripped.Vh)),
    tamperTotal: completedScens.reduce((a, x) => a + x.stripped.tamperTotal, 0),
    tamperAltered: completedScens.reduce((a, x) => a + x.stripped.tamperAltered, 0),
  },
  ittMean: {
    L: mean(haikuWrapperPerScen.map((x) => x.stripped.L)),
    L_strict: mean(haikuWrapperPerScen.map((x) => x.stripped.L_strict)),
    V: mean(haikuWrapperPerScen.map((x) => x.stripped.V)),
    Vh: mean(haikuWrapperPerScen.map((x) => x.stripped.Vh)),
    tamperTotal: haikuWrapperPerScen.reduce((a, x) => a + x.stripped.tamperTotal, 0),
    tamperAltered: haikuWrapperPerScen.reduce((a, x) => a + x.stripped.tamperAltered, 0),
  },
  mukStripped: {
    clauses: mukSum.all,
    withChae: mukSum.n,
    accuracy: mukSum.all ? (mukSum.right + mukSum.mr) / mukSum.all : 0,
    credBase: mukTrust.base,
    grade: gradeOf(mukTrust.base),
    gap: mukTrust.gap ?? 0,
    brier: mukSum.n ? mukSum.sb / mukSum.n : NaN,
    overconfErr: withChae.filter((r) => !r.ok && r.conf >= 7).length / Math.max(1, withChae.filter((r) => !r.ok).length),
  },
};
haikuStrippedSummary.completedMean.alteredRate = haikuStrippedSummary.completedMean.tamperAltered / Math.max(1, haikuStrippedSummary.completedMean.tamperTotal);
haikuStrippedSummary.ittMean.alteredRate = haikuStrippedSummary.ittMean.tamperAltered / Math.max(1, haikuStrippedSummary.ittMean.tamperTotal);

// 2. deepseek_on|lon exact defect & clean-session audit FA breakdown
const dsRows = allRows.deepseek_on.filter((r) => r.format === 'lon' && !r.error && (r.text ?? '').trim());
const dsAuditDecomposition = [];
for (const sc of scens) {
  const byH = new Map(dsRows.filter((r) => r.scen === sc.id).map((r) => [r.hop, r.text]));
  let prev = null;
  const defectHops = [];
  const auditFlagHops = [];
  for (let h = 1; h <= HOPS; h++) {
    const t = byH.get(h);
    const noteSc = scoreNote('lon', sc, h, t, prev);
    const curL = noteSc.lin.length ? mean(noteSc.lin.map((x) => +x.ok)) : 1;
    const curV = noteSc.per.length ? mean(noteSc.per.map((x) => +x.v)) : 1;
    const isDef = !noteSc.has || curV < 1 - 1e-9 || curL < 1 - 1e-9 || noteSc.tamper.altered > 0;
    if (isDef) {
      defectHops.push({
        hop: h,
        V: curV,
        L: curL,
        missedLin: noteSc.lin.filter((x) => !x.ok).map((x) => ({ id: x.id, cat: x.cat, cNew: x.cNew, cOld: x.cOld, cEdge: x.cEdge })),
      });
    }
    if (noteSc.audit.flagged) {
      auditFlagHops.push({ hop: h, reasons: noteSc.audit.reasons, codes: noteSc.audit.codes });
    }
    prev = t;
  }
  const h30missed = defectHops.find((d) => d.hop === 30)?.missedLin ?? [];
  dsAuditDecomposition.push({
    scen: sc.id,
    cleanSession: defectHops.length === 0,
    defectHopCount: defectHops.length,
    firstDefectHop: defectHops[0]?.hop ?? null,
    hop30MissedEvents: h30missed,
    auditFlagCount: auditFlagHops.length,
    auditFlagSample: auditFlagHops.slice(0, 4),
    uniqueAuditReasons: uniq(auditFlagHops.flatMap((a) => a.reasons)),
  });
}

// 3. luna_off|lon S03 trace
const lunaOffS03 = allRows.luna_off.filter((r) => r.scen === 'S03' && r.format === 'lon').map((r) => ({
  hop: r.hop,
  attempt: r.attempt,
  cache: r.cache ?? null,
  finish: r.finish ?? null,
  error: r.error ?? null,
  textLen: (r.text ?? '').length,
  leaksReasoningPrefix: /^[^\n]*We need/i.test(r.text ?? ''),
}));

const CURVE_HOPS = [10, 15, 20, 25, 30];
const haikuStrippedCurveByScen = {};
for (const sc of scens) {
  const st = hSessions.get(sc.id);
  const broken = !Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => st.notes[h]);
  haikuStrippedCurveByScen[sc.id] = {};
  for (const h of CURVE_HOPS) {
    const t = st.notes[h] ? stripWrapper(st.notes[h]) : null;
    if (!t || (broken && !st.notes[h])) {
      haikuStrippedCurveByScen[sc.id][h] = 0;
    } else {
      const s = scoreNote('lon', sc, h, t);
      haikuStrippedCurveByScen[sc.id][h] = s.lin.length ? mean(s.lin.map((x) => +x.ok)) : 1;
    }
  }
}
const strippedCurve = {
  itt: Object.fromEntries(CURVE_HOPS.map((h) => [String(h), mean(scens.map((sc) => haikuStrippedCurveByScen[sc.id][h]))])),
  completed: Object.fromEntries(CURVE_HOPS.map((h) => [String(h), mean(completedScens.map((x) => haikuStrippedCurveByScen[x.scen][h]))])),
};

const outJson = {
  generatedAt: new Date().toISOString(),
  apiDiagnostics,
  haikuOnLon: {
    perScenario: haikuWrapperPerScen,
    summary: haikuStrippedSummary,
    strippedCurve,
  },
  deepseekOnLon: dsAuditDecomposition,
  lunaOffS03Lon: lunaOffS03,
};

mkdirSync(dirname(`${BASE}/report/diag-e13-posthoc.json`), { recursive: true });
writeFileSync(`${BASE}/report/diag-e13-posthoc.json`, JSON.stringify(outJson, null, 2) + '\n');

const md = [];
md.push('# E13 Post-Hoc Error Decomposition (Non-Modifying Sensitivity & Root-Cause Log)');
md.push('');
md.push(`Generated ${outJson.generatedAt}. Pre-registered files in \`prereg-e13.sha256\` remain untouched; primary tables live in \`report/metrics-e13.md\`.`);
md.push('');
md.push('## 1. API Refusals & Error Rows Across All 6 Model Cells');
md.push('| model | rows | errors | empty replies | refusals (empty / mid-stream) | refusal formats | empty refusals by format |');
md.push('|---|---|---|---|---|---|---|');
for (const m of MODELS) {
  const a = apiDiagnostics[m];
  md.push(`| ${m} | ${a.rows} | ${a.errorRows} | ${a.emptyRows} | ${a.refusalRows} (${a.emptyRefusals}/${a.truncatedRefusals}) | ${JSON.stringify(a.refusalsByFormat)} | ${JSON.stringify(a.emptyRefusalsByFormat)} |`);
}
md.push('');
md.push('## 2. `haiku_on | lon` Dual Failure Mechanism & Wrapper-Stripped Sensitivity');
md.push(`- **Safety classifier refusals**: \`haiku_on | lon\` triggered ${apiDiagnostics.haiku_on.refusalsByFormat.lon ?? 0} API \`finish: "refusal"\` responses (${apiDiagnostics.haiku_on.emptyRefusalsByFormat.lon ?? 0} empty), halting 4/10 sessions at Hop 3 (\`S02, S03, S04\`) and Hop 4 (\`S10\`), plus 1 empty refusal each at Hop 31 (\`S06, S08\`). For comparison, \`haiku_off | lon\` triggered ${apiDiagnostics.haiku_off.refusalsByFormat.lon ?? 0} refusals (${apiDiagnostics.haiku_off.emptyRefusalsByFormat.lon ?? 0} empty, plus mid-stream truncations across formats). Refusals in \`haiku_on\` across all formats: \`${JSON.stringify(apiDiagnostics.haiku_on.refusalsByFormat)}\`; \`haiku_off\`: \`${JSON.stringify(apiDiagnostics.haiku_off.refusalsByFormat)}\`.`);
md.push(`- **Prompt-wrapper boundary leak**: On all 6 completed sessions (\`S01, S05, S06, S07, S08, S09\`), \`haiku_on\` copied \`=== End of document evdN ===\` inside \`evdN <[ ... ]>\` / \`<[[ ... ]]>\` relays (starting at hops 3 or 5).`);
md.push(`- **Stripped sensitivity (\`6/10\` completed mean)**: \`V = ${haikuStrippedSummary.completedMean.V.toFixed(3)}\`, \`Vh = ${haikuStrippedSummary.completedMean.Vh.toFixed(3)}\`, \`L = ${haikuStrippedSummary.completedMean.L.toFixed(3)}\` (\`S01 = 53/53 = 1.000\`), \`L_strict = ${haikuStrippedSummary.completedMean.L_strict.toFixed(3)}\`, altered spans = \`${haikuStrippedSummary.completedMean.tamperAltered}/${haikuStrippedSummary.completedMean.tamperTotal}\` (\`${haikuStrippedSummary.completedMean.alteredRate.toFixed(3)}\` vs raw \`0.451\`).`);
md.push(`- **Stripped ITT mean (\`10/10\` sessions including 4 halted at hops 3 to 4)**: \`L = ${haikuStrippedSummary.ittMean.L.toFixed(3)}\`, \`V = ${haikuStrippedSummary.ittMean.V.toFixed(3)}\`, \`Muk\` Grade \`${haikuStrippedSummary.mukStripped.grade}\` (credBase \`${haikuStrippedSummary.mukStripped.credBase.toFixed(3)}\`, gap \`${haikuStrippedSummary.mukStripped.gap.toFixed(4)}\`, Brier \`${haikuStrippedSummary.mukStripped.brier.toFixed(4)}\`, clauses \`${haikuStrippedSummary.mukStripped.clauses}\`).`);
md.push('');
md.push('| scen | complete | first wrapper hop | raw V | raw L | stripped V | stripped L | stripped L_strict | altered (stripped) |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const s of haikuWrapperPerScen) {
  md.push(`| ${s.scen} | ${s.complete} | ${s.firstWrapperHop ?? 'n/a'} | ${s.raw.V.toFixed(3)} | ${s.raw.L.toFixed(3)} | ${s.stripped.V.toFixed(3)} | ${s.stripped.L.toFixed(3)} | ${s.stripped.L_strict.toFixed(3)} | ${s.stripped.tamperAltered}/${s.stripped.tamperTotal} |`);
}
md.push('');
md.push('## 3. `deepseek_on | lon` Missed Lineage Events & Static-Audit Decomposition');
md.push('| scen | clean session | defect hops | Hop-30 missed events | audit flags | unique audit reasons |');
md.push('|---|---|---|---|---|---|');
for (const d of dsAuditDecomposition) {
  md.push(`| ${d.scen} | ${d.cleanSession} | ${d.defectHopCount} | ${d.hop30MissedEvents.map((e) => e.id).join(', ') || 'none'} | ${d.auditFlagCount} | ${d.uniqueAuditReasons.join(', ') || 'none'} |`);
}
md.push('');
md.push('## 4. `luna_off | lon` S03 Status Trace');
md.push(`Rows in \`S03|luna_off|lon\`: ${lunaOffS03.length}. Settled at Hop 31? ${lunaOffS03.some((r) => r.hop === 31 && !r.error && r.textLen > 0)}. Error rows: ${JSON.stringify(lunaOffS03.filter((r) => r.error))}. Hop 2 leaked scratchpad prefix? ${lunaOffS03.some((r) => r.hop === 2 && r.leaksReasoningPrefix)}.`);

writeFileSync(`${BASE}/report/diag-e13-posthoc.md`, md.join('\n') + '\n');
console.log('wrote report/diag-e13-posthoc.json and report/diag-e13-posthoc.md');
