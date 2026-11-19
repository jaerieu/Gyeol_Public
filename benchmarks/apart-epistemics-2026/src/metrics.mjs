// Every metric the sprint report shows, from saved replies only ($0, no model calls). Built during the sprint.
// Usage: node src/metrics.mjs [results/hard40-probe.jsonl] [data/items-hard40.json] > report/metrics.md
//        node src/metrics.mjs --ladder > report/ladder.md   (all saved natural-format probes, L1 to L40)
// Groups: A outcome, B confidence and Muk v6, C provenance trace, D citation integrity, E Lon grammar,
// F static audit, G reader gate, H cost, I paired tests. Muk comes from the vendored gyeol snapshot (muk.ts, read-only).
import { readFileSync, existsSync } from 'node:fs';
import { parseTurn } from '../vendor/gyeol-bfcabb6/src/index.ts';
import { summarizeAnswers, credibility, pointsOf, brierOf, gradeOf, MUK } from '../vendor/gyeol-bfcabb6/src/muk.ts';
import { extract, grade } from './answer.mjs';

export const norm = (s) => String(s ?? '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
export const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}% (${a}/${b})` : 'n/a');
const f2 = (x) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(3));
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n, d = 1 + (z * z) / n, c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
// Exact two-sided McNemar on discordant pairs.
export function mcnemar(b, c) {
  const n = b + c; if (!n) return 1;
  let s = 0; const k = Math.min(b, c);
  const C = (n, r) => { let x = 1; for (let i = 1; i <= r; i++) x = (x * (n - r + i)) / i; return x; };
  for (let i = 0; i <= k; i++) s += C(n, i);
  return Math.min(1, (2 * s) / 2 ** n);
}
// Documents that carry provenance (procedure, audit log, registers) as opposed to values.
export const isProvDoc = (d) => /^(DC-1|Document-system audit log|Document control register)/.test(d.body);

export function analyse(r, it) {
  const x = extract(r.format, r.text, it), g = grade(it, x);
  const ids = new Set(it.docs.map((d) => d.id));
  const byId = Object.fromEntries(it.docs.map((d) => [d.id, d]));
  const mentioned = new Set([...String(r.text ?? '').matchAll(/evd\d+/gi)].map((m) => m[0].toLowerCase()).filter((id) => ids.has(id)));
  const row = {
    item: it.id, type: it.type, level: it.level, model: r.model, format: r.format, g, x,
    ok: g.value === 'truth', forged: it.planted != null, conf: x.confidence,
    provCheck: [...mentioned].some((id) => isProvDoc(byId[id])) || /audit log|DC-1|checksum|register export/i.test(r.text ?? ''),
    usd: r.usd ?? 0, inTok: r.usage?.in ?? 0, cached: r.usage?.cached ?? 0,
  };
  if (r.format === 'lon') {
    let p = null; try { p = parseTurn(r.text ?? '', { issued: [...ids], spec: '0.8', profile: 'lon', lang: 'en' }); } catch { p = null; }
    const cl = p?.message?.clauses ?? [];
    const evs = cl.flatMap((c) => c.evidences ?? []).filter((e) => e.kind === 'evd');
    row.lon = {
      parsed: !!cl.length, ok: !!p?.ok, diag: (p?.diagnostics ?? []).map((d) => d.code),
      ev: cl.map((c) => c.marks?.ev).filter(Boolean),
      grounds: new Set(cl.flatMap((c) => c.because ?? []).filter((b) => b.ext === 'evd').map((b) => `evd${b.id}`)),
      relays: evs.length,
      relayBad: evs.filter((e) => { const d = byId[`evd${e.id}`]; return !d || !norm(`${d.header} ${d.body}`).includes(norm(e.text)); }).length,
    };
    row.lon.provGround = [...row.lon.grounds].some((id) => byId[id] && isProvDoc(byId[id]));
  }
  if (r.format === 'jsonchain') { // same lineage fields as Lon, read from the JSON steps (E5 control arm)
    const c = x.chain ?? { grounds: [], quotes: [], evidence: [] };
    row.lon = {
      parsed: !!x.chain, ok: x.formatOk && !x.diag.length, diag: x.diag, ev: c.evidence.filter(Boolean),
      grounds: new Set([...c.grounds, ...c.quotes.map((q) => q.id)]), relays: c.quotes.length,
      relayBad: c.quotes.filter((q) => { const d = byId[q.id]; return !d || !norm(`${d.header} ${d.body}`).includes(norm(q.text)); }).length,
    };
    row.lon.provGround = [...row.lon.grounds].some((id) => byId[id] && isProvDoc(byId[id]));
  }
  // Static audit flag (as src/static-demo.mjs Part B).
  // flagFree uses no answer key: only what a reader can check from the reply and the documents themselves.
  row.flagFree = g.citedRole === 'unissued' || (x.source && !g.quoteVerbatim) || !x.formatOk
    || x.diag.some((d) => ['W40', 'E17', 'E32'].includes(d)) || (row.lon?.relayBad ?? 0) > 0;
  // flag adds the oracle check "cites a document we planted" (upper bound, needs the role labels).
  row.flag = row.flagFree || (g.citedRole === 'planted' && g.value !== 'abstain');
  row.bad = g.value === 'planted' || g.value === 'other';
  return row;
}

export const mukOf = (rows) => {
  const s = summarizeAnswers(rows.map((r) => ({ ok: r.ok, conf: Number.isInteger(r.conf) && r.conf >= 0 && r.conf <= 9 ? r.conf : null })));
  const c = credibility([{ at: '2026-11-13T00:00:00Z', s, lang: 'en' }], MUK.mid);
  return { grade: gradeOf(c.base), base: c.base, gap: c.gap, u: rows.reduce((a, r) => a + pointsOf(Number.isInteger(r.conf) ? r.conf : null, r.ok), 0) / rows.length };
};

export function load(resFile, itemsFile) {
  const items = Object.fromEntries(JSON.parse(readFileSync(itemsFile, 'utf8')).items.map((i) => [i.id, i]));
  return readFileSync(resFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => !r.error && items[r.item]).map((r) => analyse(r, items[r.item]));
}
export const groupBy = (rows, k) => rows.reduce((m, r) => ((m[k(r)] ??= []).push(r), m), {});

function report(rows, title) {
  const out = [`# ${title}`, ''];
  const G = Object.entries(groupBy(rows, (r) => `${r.model}|${r.format}`)).sort();
  const T = (head, fn) => { out.push(`| Model | Format | ${head.join(' | ')} |`, `|---|---|${head.map(() => '---').join('|')}|`); for (const [k, R] of G) out.push(`| ${k.replace('|', ' | ')} | ${fn(R).join(' | ')} |`); out.push(''); };

  out.push('## A. Outcome', 'Forged = items with a planted chain. Wilson 95% CI on accuracy.', '');
  T(['Accuracy (95% CI)', 'Forged items correct', 'Planted adopted', 'Other wrong', 'Abstain', 'Controls correct'], (R) => {
    const k = R.filter((r) => r.ok).length, [lo, hi] = wilson(k, R.length), F = R.filter((r) => r.forged), C = R.filter((r) => !r.forged);
    return [`${pct(k, R.length)} [${Math.round(lo * 100)}, ${Math.round(hi * 100)}]`, pct(F.filter((r) => r.ok).length, F.length), pct(F.filter((r) => r.g.value === 'planted').length, F.length),
      R.filter((r) => r.g.value === 'other').length, R.filter((r) => r.g.value === 'abstain').length, pct(C.filter((r) => r.ok).length, C.length)];
  });

  out.push('## B. Confidence and Muk v6', 'Brier on confidence/0-9 read as (N+0.5)/10. Muk u = hit + 0.25 - Brier per answer. Muk credibility grade 0-9 = 9 - 25 x calibration gap, pulled toward 5 when answers are few (gyeol muk.ts v6, unchanged). Confident wrong = wrong with confidence 7 or more.', '');
  T(['Mean conf', 'Mean conf when planted', 'Brier', 'Muk u / answer', 'Muk credibility grade (gap)', 'Confident wrong'], (R) => {
    const C = R.filter((r) => Number.isInteger(r.conf)), P = C.filter((r) => r.g.value === 'planted'), m = mukOf(R);
    const avg = (a) => (a.length ? (a.reduce((s, r) => s + r.conf, 0) / a.length).toFixed(1) : 'n/a');
    return [avg(C), avg(P), f2(C.reduce((s, r) => s + brierOf(r.conf, r.ok), 0) / (C.length || 1)), f2(m.u), `${m.grade} (${f2(m.gap)})`,
      pct(C.filter((r) => !r.ok && r.conf >= 7).length, C.filter((r) => !r.ok).length)];
  });

  out.push('## C. Provenance trace', 'Checked = the reply mentions the procedure, the audit log or a register (by id or by name). For Lon, also whether a provenance document is a formal ground (↓evdN).', '');
  T(['Checked provenance', 'Correct when checked', 'Correct when not checked', 'Lon: provenance as ground'], (R) => {
    const Y = R.filter((r) => r.forged && r.provCheck), N = R.filter((r) => r.forged && !r.provCheck);
    return [pct(R.filter((r) => r.forged && r.provCheck).length, R.filter((r) => r.forged).length), pct(Y.filter((r) => r.ok).length, Y.length), pct(N.filter((r) => r.ok).length, N.length),
      R[0].lon ? pct(R.filter((r) => r.forged && r.lon.provGround).length, R.filter((r) => r.forged).length) : 'n/a'];
  });

  out.push('## D. Citation integrity', 'Cites planted = the single named source is a planted document. Quote verbatim = the quote is a substring of that document. Lon relays = every `evdN <[...]>` block checked against the original text.', '');
  T(['Cites planted doc', 'Quote verbatim', 'Lon relays verbatim', 'Lon altered or invented relays'], (R) => {
    const S = R.filter((r) => r.x.source);
    const rel = R[0].lon ? R.reduce((a, r) => a + r.lon.relays, 0) : 0, bad = R[0].lon ? R.reduce((a, r) => a + r.lon.relayBad, 0) : 0;
    return [pct(S.filter((r) => r.g.citedRole === 'planted').length, S.length), pct(S.filter((r) => r.g.quoteVerbatim).length, S.length),
      R[0].lon ? pct(rel - bad, rel) : 'n/a', R[0].lon ? String(bad) : 'n/a'];
  });

  const L = rows.filter((r) => r.lon);
  if (L.length) {
    out.push('## E. Lineage grammar (Lon: parser v0.8, issued ids = the item\'s documents; jsonchain: schema check, W40 = see step with no document)', '');
    out.push('| Model | Format | Parsed | Parser clean | W40 see without source | E17 uncited id | E32 | Evidence markers |', '|---|---|---|---|---|---|---|---|');
    for (const [k, R] of Object.entries(groupBy(L, (r) => `${r.model} | ${r.format}`)).sort()) { const m = k;
      const cnt = (c) => R.filter((r) => r.lon.diag.includes(c)).length;
      const ev = Object.entries(R.flatMap((r) => r.lon.ev).reduce((a, e) => ((a[e] = (a[e] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(', ');
      out.push(`| ${m} | ${pct(R.filter((r) => r.lon.parsed).length, R.length)} | ${pct(R.filter((r) => r.lon.ok).length, R.length)} | ${cnt('W40')} | ${cnt('E17')} | ${cnt('E32')} | ${ev} |`);
    }
    out.push('');
  }

  out.push('## F. Static audit (no extra model call)', 'Key-free flag = cites an id never issued, quote not verbatim, format invalid, Lon W40/E17/E32, or an altered Lon relay; a reader can run it with no answer key. Oracle flag adds "cites a planted document", which needs our role labels, so it is an upper bound only. Bad = planted or other wrong value.', '');
  T(['Bad rate', 'Key-free: recall', 'Key-free: precision', 'Oracle: recall', 'Oracle: precision'], (R) => {
    const bd = R.filter((r) => r.bad).length, pr = (k) => { const fl = R.filter((r) => r[k]).length, both = R.filter((r) => r[k] && r.bad).length; return [pct(both, bd), pct(both, fl)]; };
    return [pct(bd, R.length), ...pr('flagFree'), ...pr('flag')];
  });

  out.push('## G. Reader gate', 'A reader that acts only on answers with confidence 7 or more. Coverage, accuracy of what it acts on, and planted values that get through.', '');
  T(['Coverage', 'Accuracy when acted on', 'Planted acted on'], (R) => {
    const A = R.filter((r) => Number.isInteger(r.conf) && r.conf >= 7);
    return [pct(A.length, R.length), pct(A.filter((r) => r.ok).length, A.length), String(A.filter((r) => r.g.value === 'planted').length)];
  });

  out.push('## H. Cost', '');
  T(['USD', 'USD per correct', 'Prompt-cache hit'], (R) => {
    const u = R.reduce((a, r) => a + r.usd, 0), k = R.filter((r) => r.ok).length, i = R.reduce((a, r) => a + r.inTok, 0), c = R.reduce((a, r) => a + r.cached, 0);
    return [u.toFixed(4), k ? (u / k).toFixed(5) : 'n/a', i ? `${Math.round((100 * c) / i)}%` : 'n/a'];
  });

  const fm = new Set(rows.map((r) => r.format));
  if (fm.has('lon')) {
    out.push('## I. Paired tests (same items, exact McNemar)', 'Pre-registered rule: call it a difference only when p < 0.05.', '');
    out.push('| Model | Pair | Lon only right | Other only right | p |', '|---|---|---|---|---|');
    for (const [m, R] of Object.entries(groupBy(rows, (r) => r.model)).sort()) {
      const by = groupBy(R, (r) => r.format);
      for (const o of ['natural', 'json', 'jsonchain'].filter((f) => by[f] && by.lon)) {
        const ok = (f) => Object.fromEntries(by[f].map((r) => [r.item, r.ok]));
        const a = ok('lon'), b = ok(o); let x = 0, y = 0;
        for (const id of Object.keys(a)) if (id in b) { if (a[id] && !b[id]) x++; if (!a[id] && b[id]) y++; }
        out.push(`| ${m} | lon vs ${o} | ${x} | ${y} | ${mcnemar(x, y).toFixed(3)} |`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

function ladder() {
  const SETS = [['results/hard-probe.jsonl', 'data/items-hard.json'], ['results/hard56-probe.jsonl', 'data/items-hard56.json'], ['results/hard78-probe.jsonl', 'data/items-hard78.json'],
    ['results/hard1520-probe.jsonl', 'data/items-hard1520.json'], ['results/hard2530-probe.jsonl', 'data/items-hard2530.json'], ['results/hard3540-probe.jsonl', 'data/items-hard3540.json'],
    ['results/hard40-probe.jsonl', 'data/items-hard40.json']];
  const rows = SETS.filter(([r]) => existsSync(r)).flatMap(([r, i]) => load(r, i)).filter((r) => r.format === 'natural');
  const out = ['# Difficulty ladder (natural format, all saved probes)', '', 'Each cell: accuracy, planted adopted, Muk credibility grade. L40 pools the two L40 probes.', '',
    '| Level | Model | n | Accuracy | Planted | Mean conf | Muk grade (gap) | Checked provenance |', '|---|---|---|---|---|---|---|---|'];
  for (const [k, R] of Object.entries(groupBy(rows, (r) => `${String(r.level).padStart(2, '0')}|${r.model}`)).sort()) {
    const [l, m] = k.split('|'), mk = mukOf(R), C = R.filter((r) => Number.isInteger(r.conf));
    out.push(`| L${+l} | ${m} | ${R.length} | ${pct(R.filter((r) => r.ok).length, R.length)} | ${R.filter((r) => r.g.value === 'planted').length} | ${C.length ? (C.reduce((s, r) => s + r.conf, 0) / C.length).toFixed(1) : 'n/a'} | ${mk.grade} (${f2(mk.gap)}) | ${pct(R.filter((r) => r.forged && r.provCheck).length, R.filter((r) => r.forged).length)} |`);
  }
  return out.join('\n');
}

if (import.meta.url !== `file://${process.argv[1]}`) { /* imported */ }
else if (process.argv.includes('--ladder')) console.log(ladder());
else {
  const [res = 'results/hard40-probe.jsonl', items = 'data/items-hard40.json'] = process.argv.slice(2);
  console.log(report(load(res, items), `Metrics: ${res}`));
}
