// E13 comprehensive scorer: 30-hop long-session handover across all 5 Gyeol/Lon potentials.
// Imports core v0.8.2 parser, snapshot carryDiff, and Muk v6 from vendored gyeol-10fba3d (read-only).
//
// Usage:
//   node src/score-e13.mjs --selftest --sessions data/sessions-e13.json
//   node src/score-e13.mjs results/e13/e13-*.jsonl --sessions data/sessions-e13.json --report report/metrics-e13.md --json report/metrics-e13.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOPS, norm, idsOf, inForce, derivedAt, lineageEventsAt, hasNum, mulberry32 } from './lib-e12.mjs';
import { FORMATS } from './prompts-e13.mjs';
import { readNote, scoreReader } from './score-e10.mjs';
import { idealNote } from './mock-e13.mjs';
import { parseTurn, stripReplyLabels, carryDiff, toDigit } from '../vendor/gyeol-10fba3d/src/index.ts';
import {
  MUK, probOf, brierOf, pointsOf, summarizeAnswers, credibility, gradeOf, colorGain, counterShare,
} from '../vendor/gyeol-10fba3d/src/muk.ts';

const READER = HOPS + 1;
const SEED = 20261117, BOOT = 2000;
const CURVE = [5, 10, 15, 20, 25, 30];
const uniq = (a) => [...new Set(a)];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : NaN);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');
const f4 = (x) => (Number.isFinite(x) ? x.toFixed(4) : 'n/a');
const tbl = (h, rows) => [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// Join standalone single-id external relays onto lon units that cite them (validated in diag-e12/relayjoin.mjs).
function readNoteJoined(format, text) {
  const std = readNote(format, text, false);
  if (format === 'lon') {
    for (const u of std.units) {
      const extra = std.spans
        .filter((s) => s.ids.length === 1 && u.ids.includes(s.ids[0]))
        .map((s) => s.text)
        .join(' ');
      if (extra) u.fullText = `${u.fullText} ${extra}`.trim();
    }
  }
  return std;
}

function verified(p, doc, spans) {
  if (!doc) return false;
  const v = norm(p.value), b = norm(`${doc.header}\n${doc.body}`);
  return spans.some((s) => s.ids.includes(p.doc) && norm(s.text).includes(v) && b.includes(norm(s.text)));
}

function reachOf(u, byN) {
  const ids = new Set(u.ids), seen = new Set(), queue = [...u.refs];
  while (queue.length) {
    const n = queue.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    const w = byN.get(n);
    if (w && w !== u) { w.ids.forEach((x) => ids.add(x)); queue.push(...w.refs); }
  }
  return { ids, seenNs: seen };
}

// Symmetrical unit lookup across all formats:
// - strict mode: unit must directly carry p.doc
// - primary mode: unit may also reach p.doc via explicit citation/ground chain if payload p is verified in the note
function unitsForPayload(p, units, isVerified, byN, allowReach = false) {
  const v = norm(p.value), lbl = norm(p.label);
  const direct = units.filter((u) => u.ids.includes(p.doc) && (norm(u.fullText).includes(v) || (isVerified && norm(u.text).includes(lbl))));
  if (!allowReach || !isVerified || !byN) return direct;
  const seen = new Set(direct);
  const out = [...direct];
  for (const u of units) {
    if (seen.has(u)) continue;
    if (!reachOf(u, byN).ids.has(p.doc)) continue;
    if (norm(u.fullText).includes(v) || norm(u.text).includes(lbl) || (p.withdraws && u.retracts.length > 0) || (p.supersedes && u.revises.length > 0)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
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

function catOf(ev) {
  if (ev.kind === 'recompute') return `recompute_${ev.der}`;
  if (ev.kind === 'withdraw') return `withdraw_${ev.refBy}`;
  const role = ev.newP.role ?? '';
  if (role.startsWith('x2') || role.startsWith('y2')) return 'amend_twin';
  if (role === 'idRev') return 'amend_id';
  if (role === 'quoteRev' || role === 'pathRev') return 'amend_verbatim';
  if (role.startsWith('x1') || role.startsWith('y')) return `amend_chain_${ev.refBy}`;
  return `amend_${ev.refBy}`;
}

function countBracketPrefix(text) {
  if (!text) return 0;
  return (String(text).match(/\[[^\]]*(?:fix|err)\s*(?:→|->)\s*\d+[^\]]*\]/gi) ?? []).length;
}

// Compute lineage + verbatim survival using either strict E12 mode or primary (relayJoin + symmetrical reach) mode.
function evalLineageAndPer(format, scen, hop, text, std, { allowReach }) {
  const docs = Object.fromEntries(scen.docs.map((d) => [d.id, d]));
  const byKey = Object.fromEntries(scen.payloads.map((p) => [p.key, p]));
  const has = text != null && String(text).trim().length > 0;
  const vAll = new Set();
  for (const p of scen.payloads.filter((x) => x.hop <= hop)) {
    if (has && verified(p, docs[p.doc], std.spans)) vAll.add(p.key);
  }
  const live = new Set(inForce(scen, hop).map((p) => p.key));
  const per = [...live].map((k) => ({ key: k, cls: byKey[k].cls, hazard: byKey[k].hazard, v: vAll.has(k) }));
  const hist = scen.payloads.filter((p) => p.hop <= hop).map((p) => ({ key: p.key, hazard: p.hazard, cls: p.cls, live: live.has(p.key), v: vAll.has(p.key) }));
  const byN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  const currentVer = Object.fromEntries(derivedAt(scen, hop).map((d) => [d.key, d.current]));
  const hazDocs = new Set(scen.payloads.filter((p) => p.hazard === 'lon').map((p) => p.doc));
  const evDocs = (ev) => (ev.kind !== 'recompute' ? [ev.newP.doc, ev.oldP.doc] : [...rawInputs(scen, ev.der, ev.newV), ...rawInputs(scen, ev.der, ev.oldV)].map((k) => byKey[k].doc));

  const lin = lineageEventsAt(scen, hop).map((ev) => {
    const cat = catOf(ev);
    const lonHaz = evDocs(ev).some((d) => hazDocs.has(d));
    if (!has) return { id: ev.id, kind: ev.kind, cat, lonHaz, cNew: false, cOld: false, cEdge: false, ok: false, okLenient: false };
    if (ev.kind !== 'recompute') {
      const newVer = vAll.has(ev.newP.key), oldVer = vAll.has(ev.oldP.key);
      const needActive = live.has(ev.newP.key);
      const uNews = unitsForPayload(ev.newP, std.units, newVer, byN, allowReach).filter((u) => !needActive || u.active);
      const uOlds = unitsForPayload(ev.oldP, std.units, oldVer, byN, false);
      const cNew = newVer && uNews.length > 0;
      const cOld = oldVer && uOlds.some((uo) => uNews.some((un) => un !== uo));
      let cEdge = false, cLen = false;
      for (const uo of uOlds) for (const un of uNews) {
        if (un === uo) continue;
        const links = ev.kind === 'amend' ? un.revises : un.retracts;
        if (uo.n != null && links.includes(uo.n)) cEdge = true;
        const evdLinks = ev.kind === 'amend' ? un.revEvds : un.retEvds;
        if (evdLinks.includes(ev.oldP.doc) || norm(un.fullText).includes(ev.oldP.doc)) cLen = true;
      }
      return { id: ev.id, kind: ev.kind, cat, lonHaz, cNew, cOld, cEdge, ok: cNew && cOld && cEdge, okLenient: cNew && cOld && (cEdge || cLen) };
    }
    const nv = ev.newV, ov = ev.oldV;
    const newIn = rawInputs(scen, ev.der, nv), oldIn = rawInputs(scen, ev.der, ov);
    const needActive = currentVer[ev.der]?.v === nv.v;
    const inputsVer = newIn.every((k) => vAll.has(k));
    const uNews = std.units.filter((un) => {
      if ((needActive && !un.active) || !hasNum(un.text, nv.value) || hasNum(un.text, ov.value)) return false;
      const { ids } = reachOf(un, byN);
      return inputsVer && newIn.every((k) => ids.has(byKey[k].doc));
    });
    const uOlds = std.units.filter((uo) => {
      if (!hasNum(uo.text, ov.value)) return false;
      const { ids } = reachOf(uo, byN);
      return oldIn.every((k) => ids.has(byKey[k].doc));
    });
    const cNew = uNews.length > 0;
    const cOld = uOlds.some((uo) => uNews.some((un) => un !== uo));
    let cEdge = false, cLen = false;
    for (const un of uNews) {
      const { seenNs } = reachOf(un, byN);
      for (const uo of uOlds) {
        if (un === uo || uo.n == null) continue;
        if (un.revises.includes(uo.n)) cEdge = true;
        if (seenNs.has(uo.n)) cLen = true;
      }
    }
    return { id: ev.id, kind: 'recompute', cat, lonHaz, cNew, cOld, cEdge, ok: cNew && cOld && cEdge, okLenient: cNew && cOld && (cEdge || cLen) };
  });

  const der = derivedAt(scen, hop).map((d) => ({ key: d.key, present: has && std.units.some((u) => u.active && hasNum(u.text, d.current.value)) }));
  return { per, hist, lin, der, vAll };
}

// Explicit attributed quote/relay spans to evaluate tamper-evidence (forged or altered quotes against issued docs).
function checkAttributedSpans(format, scen, hop, text, std) {
  const docs = Object.fromEntries(scen.docs.slice(0, hop).map((d) => [d.id, norm(`${d.header}\n${d.body}`)]));
  const candidates = [];
  if (format === 'lon') {
    const relays = [...String(text ?? '').matchAll(/(evd\d+)\s*<(\[+)([\s\S]*?)\]+>/gi)];
    // Prefer readNote spans so nested `<[[ ]]>` fences parse accurately:
    for (const s of std.spans) {
      if (s.ids.length === 1 && docs[s.ids[0]] && norm(s.text).length >= 3) {
        candidates.push({ id: s.ids[0], ok: docs[s.ids[0]].includes(norm(s.text)) });
      }
    }
    void relays;
  } else if (format === 'jsonchain') {
    try {
      const stripped = String(text ?? '').match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/)?.[1] ?? String(text ?? '');
      const a = stripped.indexOf('{'), b = stripped.lastIndexOf('}');
      const obj = a >= 0 && b > a ? JSON.parse(stripped.slice(a, b + 1)) : null;
      for (const st of obj?.steps ?? []) {
        if (st?.quotes && typeof st.quotes === 'object') {
          for (const [k, v] of Object.entries(st.quotes)) {
            const id = k.toLowerCase();
            if (docs[id] && norm(String(v)).length >= 3) candidates.push({ id, ok: docs[id].includes(norm(String(v))) });
          }
        }
      }
    } catch { /* broken JSON accounted under parse/audit */ }
  } else if (format === 'json') {
    try {
      const stripped = String(text ?? '').match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/)?.[1] ?? String(text ?? '');
      const a = stripped.indexOf('{'), b = stripped.lastIndexOf('}');
      const obj = a >= 0 && b > a ? JSON.parse(stripped.slice(a, b + 1)) : null;
      for (const it of obj?.items ?? []) {
        const ids = idsOf(String(it?.source ?? ''));
        if (ids.length === 1 && docs[ids[0]] && !/items?\s+\d+/i.test(String(it?.source ?? ''))) {
          const val = norm(String(it?.value ?? ''));
          if (val.length >= 3) candidates.push({ id: ids[0], ok: docs[ids[0]].includes(val) });
        }
      }
    } catch { /* broken JSON */ }
  } else {
    for (const s of std.spans) {
      if (s.ids.length === 1 && docs[s.ids[0]] && norm(s.text).length >= 3) {
        candidates.push({ id: s.ids[0], ok: docs[s.ids[0]].includes(norm(s.text)) });
      }
    }
  }
  const n = candidates.length;
  const bad = candidates.filter((c) => !c.ok).length;
  return { total: n, exact: n - bad, altered: bad, alteredRate: n ? bad / n : 0 };
}

// Oracle-free static audit at hop `hop` (uses ONLY note_{h-1}, note_h, and raw docs[0..h-1]; ZERO answer keys).
export function oracleFreeAudit(format, docsSlice, prevText, currText) {
  const currHas = currText != null && String(currText).trim().length > 0;
  const reasons = [];
  if (!currHas) return { flagged: true, reasons: ['EMPTY'], codes: ['EMPTY'], carryDrop: 0, carryAlter: 0, alteredQuotes: 0, strictCarryDrop: 0, strictCarryAlter: 0 };

  const issued = docsSlice.map((d) => d.id);
  const docsMap = Object.fromEntries(docsSlice.map((d) => [d.id, norm(`${d.header}\n${d.body}`)]));

  if (format === 'lon') {
    let ptCurr = null, ptPrev = null;
    try {
      ptCurr = parseTurn(stripReplyLabels(String(currText)), { lon: true, rules08: true, snapshot: true, issued, spec: '0.8', profile: 'lon', lang: 'en' });
    } catch { reasons.push('PARSE_ERR'); }
    if (prevText && String(prevText).trim()) {
      try {
        ptPrev = parseTurn(stripReplyLabels(String(prevText)), { lon: true, rules08: true, snapshot: true, issued: issued.slice(0, -1), spec: '0.8', profile: 'lon', lang: 'en' });
      } catch { /* ignore prev parse failure */ }
    }
    const diags = ptCurr?.diagnostics ?? [];
    const severeCodes = diags
      .map((d) => d.code)
      .filter((c) => /^E\d+/.test(c) || c === 'W40' || c === 'W44' || c === 'W45');
    for (const c of uniq(severeCodes)) reasons.push(c);

    // Check verbatim relays via parser evidences (exempts nothing, checks raw docsSlice text).
    let alteredQuotes = 0;
    for (const ev of ptCurr?.message?.evidences ?? []) {
      const id = `${ev.kind}${ev.id}`.toLowerCase();
      if (docsMap[id] && norm(ev.text).length >= 3 && !docsMap[id].includes(norm(ev.text))) {
        alteredQuotes += 1;
      }
    }
    if (alteredQuotes > 0) reasons.push('TAMPERED_RELAY');

    // Run gyeol carryDiff (strict canonical diff) + marker-tolerant lineage carry check (allowing see -> rec on carried clauses).
    let strictCarryDrop = 0, strictCarryAlter = 0, carryDrop = 0, carryAlter = 0;
    if (ptPrev?.message?.clauses?.length && ptCurr?.message?.clauses?.length) {
      const cd = carryDiff(ptPrev.message.clauses, ptCurr.message.clauses, {
        priorEvidences: ptPrev.message.evidences,
        nextEvidences: ptCurr.message.evidences,
      });
      strictCarryDrop = cd.dropped.length;
      strictCarryAlter = cd.altered.length;

      // Lineage-preserving compare: normalize away see<->rec and chae confidence digit tweaks while catching dropped/altered prefixes, content, grounds, or numbers.
      const sigOf = (c) => {
        const proc = c.process ? `${c.process.kind}:${c.process.target?.label ?? ''}` : '';
        const bec = (c.because ?? []).map((b) => ('ext' in b ? `${b.ext}${b.id}` : String(b.label ?? ''))).sort().join(',');
        const body = (c.words ?? []).map((w) => w.text).join(' ');
        return `${c.label}|${proc}|${norm(body)}|${bec}`;
      };
      const currByLabel = new Map();
      for (const c of ptCurr.message.clauses) {
        const k = c.label?.replace(/^[절점]/u, '');
        if (k) currByLabel.set(k, sigOf(c));
      }
      for (const pc of ptPrev.message.clauses) {
        const k = pc.label?.replace(/^[절점]/u, '');
        if (!k) continue;
        const nextSig = currByLabel.get(k);
        if (!nextSig) carryDrop += 1;
        else if (nextSig !== sigOf(pc)) carryAlter += 1;
      }
      if (carryDrop > 0) reasons.push('CARRY_DROP');
      if (carryAlter > 0) reasons.push('CARRY_ALTER');
      if (cd.reordered.length > 0) reasons.push('CARRY_REORDER');
    }
    if (countBracketPrefix(currText) > 0) reasons.push('BRACKET_PREFIX');

    return {
      flagged: reasons.length > 0,
      reasons: uniq(reasons),
      codes: uniq(diags.map((d) => d.code)),
      carryDrop, carryAlter, strictCarryDrop, strictCarryAlter, alteredQuotes,
    };
  }

  // Oracle-free structural audit for jsonchain, json, and natural (no answer keys used).
  const stdCurr = readNote(format, currText, false);
  if (!stdCurr.ok || stdCurr.units.length === 0) reasons.push('FORMAT_PARSE_ERR');
  const qCheck = checkAttributedSpans(format, { docs: docsSlice }, docsSlice.length, currText, stdCurr);
  if (qCheck.altered > 0) reasons.push('TAMPERED_QUOTE');

  const ns = stdCurr.units.map((u) => u.n).filter(Number.isFinite);
  if (ns.length > 0 && ns[0] !== 1) reasons.push('NON_1_START');
  for (let i = 1; i < ns.length; i++) {
    if (ns[i] !== ns[i - 1] + 1) { reasons.push('SEQ_GAP'); break; }
  }
  const seenN = new Set();
  for (const u of stdCurr.units) {
    for (const target of [...u.revises, ...u.retracts]) {
      if (!seenN.has(target)) reasons.push('DANGLING_LINK');
    }
    if (u.n != null) seenN.add(u.n);
  }

  let carryDrop = 0, carryAlter = 0;
  if (prevText && String(prevText).trim()) {
    const stdPrev = readNote(format, prevText, false);
    if (stdPrev.units.length > 0) {
      const currByN = new Map(stdCurr.units.filter((u) => u.n != null).map((u) => [u.n, u]));
      for (const pu of stdPrev.units) {
        if (pu.n == null) continue;
        const cu = currByN.get(pu.n);
        if (!cu) carryDrop += 1;
        else if (norm(cu.fullText) !== norm(pu.fullText) && norm(cu.text) !== norm(pu.text)) carryAlter += 1;
      }
      if (carryDrop > 0) reasons.push('CARRY_DROP');
      if (carryAlter > 0) reasons.push('CARRY_ALTER');
    }
  }

  return {
    flagged: reasons.length > 0,
    reasons: uniq(reasons),
    codes: [],
    carryDrop, carryAlter, strictCarryDrop: carryDrop, strictCarryAlter: carryAlter, alteredQuotes: qCheck.altered,
  };
}

// Extract graded Muk AnswerRows from a Lon snapshot note at hop `hop` (optionally filtering to newly introduced clause labels).
function extractLonMukRows(scen, hop, text, std, onlyNums = null) {
  if (!text || !String(text).trim()) return [];
  const docs = Object.fromEntries(scen.docs.slice(0, hop).map((d) => [d.id, d]));
  const rawPayloads = scen.payloads.filter((p) => p.hop <= hop);
  const ders = derivedAt(scen, hop);
  const byN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));

  let pt = null;
  try {
    pt = parseTurn(stripReplyLabels(String(text)), { lon: true, rules08: true, snapshot: true, issued: Object.keys(docs), spec: '0.8', profile: 'lon', lang: 'en' });
  } catch { return []; }
  const unitByN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  const rows = [];

  for (const c of pt.message?.clauses ?? []) {
    const nMatch = String(c.label ?? '').match(/(\d+)/);
    const n = nMatch ? Number(nMatch[1]) : null;
    if (onlyNums && (n == null || !onlyNums.has(n))) continue;
    const u = n != null ? unitByN.get(n) : null;
    const conf = c.chae?.self != null ? toDigit(c.chae.self) : null;
    const color = c.chae?.color && ['R', 'G', 'B', 'C', 'M', 'Y', 'K'].includes(c.chae.color) ? c.chae.color : null;
    const kind = u ? (u.ids.length > 0 ? 'raw' : 'derived') : 'unknown';

    let ok = false;
    if (u && u.ids.length > 0) {
      // Raw evidence clause: check whether at least one payload from cited doc(s) matches verbatim AND lineage edge (if required) holds.
      const matchedPs = rawPayloads.filter((p) => u.ids.includes(p.doc) && (norm(u.fullText).includes(norm(p.value)) || norm(u.text).includes(norm(p.label))));
      if (matchedPs.length > 0) {
        ok = matchedPs.some((p) => {
          const valVerified = verified(p, docs[p.doc], std.spans);
          if (!valVerified) return false;
          if (p.supersedes) return u.revises.length > 0;
          if (p.withdraws) return u.retracts.length > 0;
          return true;
        });
      }
    } else if (u && u.refs.length > 0) {
      // Derived inference clause: check against any derived version up to hop h whose numeric value & input doc reachability match.
      const { ids } = reachOf(u, byN);
      ok = ders.some((d) => d.versions.some((v) => {
        if (!hasNum(u.text, v.value)) return false;
        const reqDocs = rawInputs(scen, d.key, v).map((k) => rawPayloads.find((p) => p.key === k)?.doc).filter(Boolean);
        return reqDocs.every((docId) => ids.has(docId));
      }));
    }
    rows.push({ ok, conf, color, n, kind });
  }
  return rows;
}

export function scoreNote(format, scen, hop, text, prevText = null) {
  const has = text != null && String(text).trim().length > 0;
  const stdStrict = has ? readNote(format, text, false) : { ok: false, spans: [], units: [] };
  const stdJoined = has ? (format === 'lon' ? readNoteJoined(format, text) : stdStrict) : stdStrict;
  const docsSlice = scen.docs.slice(0, hop);

  const primary = evalLineageAndPer(format, scen, hop, text, stdJoined, { allowReach: true });
  const strict = evalLineageAndPer(format, scen, hop, text, stdStrict, { allowReach: false });
  const tamper = has ? checkAttributedSpans(format, scen, hop, text, stdJoined) : { total: 0, exact: 0, altered: 0, alteredRate: 0 };
  const audit = oracleFreeAudit(format, docsSlice, prevText, text);

  return {
    has,
    ok: stdJoined.ok,
    per: primary.per,
    hist: primary.hist,
    lin: primary.lin,
    linStrict: strict.lin,
    der: primary.der,
    tamper,
    audit,
    bracketPrefixCount: format === 'lon' ? countBracketPrefix(text) : 0,
    chars: has ? String(text).length : 0,
    unitsCount: stdJoined.units.length,
    unitNs: new Set(stdJoined.units.map((u) => u.n).filter(Number.isFinite)),
  };
}

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
function holm(ps) {
  const s = [...ps].filter((x) => Number.isFinite(x.p)).sort((a, b) => a.p - b.p), out = {};
  let run = 0;
  s.forEach((x, i) => { run = Math.max(run, Math.min(1, x.p * (s.length - i))); out[x.k] = run; });
  return out;
}

// ---------- CLI & Entry ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const flag = (f) => argv.includes(f);
  const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { if (!['--selftest'].includes(argv[i])) i++; continue; }
    positional.push(argv[i]);
  }
  const sessionsPath = opt('--sessions', 'data/sessions-e13.json');
  const file = JSON.parse(readFileSync(sessionsPath, 'utf8'));
  const scens = file.scenarios;

  if (flag('--selftest')) {
    let bad = 0;
    const check = (name, got, want, tol = 1e-9) => {
      if (!Number.isFinite(got) || Math.abs(got - want) > tol) { bad++; console.log(`FAIL ${name}: got ${got}, want ${want}`); }
    };
    for (const scen of scens) {
      for (const fmt of FORMATS) {
        let prev = null;
        for (const hop of [1, 5, 15, 25, HOPS]) {
          const note = idealNote(fmt, scen, hop);
          const s = scoreNote(fmt, scen, hop, note, prev);
          if (s.lin.length) {
            check(`${scen.id} ${fmt} h${hop} ideal L`, mean(s.lin.map((x) => +x.ok)), 1);
            check(`${scen.id} ${fmt} h${hop} ideal L_strict`, mean(s.linStrict.map((x) => +x.ok)), 1);
          }
          check(`${scen.id} ${fmt} h${hop} ideal V`, mean(s.per.map((x) => +x.v)), 1);
          check(`${scen.id} ${fmt} h${hop} ideal Vh`, mean(s.hist.map((x) => +x.v)), 1);
          check(`${scen.id} ${fmt} h${hop} tamper altered`, s.tamper.altered, 0);
          check(`${scen.id} ${fmt} h${hop} audit clean`, +(!s.audit.flagged), 1);
          prev = note;
        }
        const dz = scoreNote(fmt, scen, HOPS, idealNote(fmt, scen, HOPS, { destructive: true }));
        const dl = mean(dz.lin.map((x) => +x.ok));
        if (!(dl < 0.25)) { bad++; console.log(`FAIL ${scen.id} ${fmt} destructive L ${dl} not < 0.25`); }
        check(`${scen.id} ${fmt} destructive V`, mean(dz.per.map((x) => +x.v)), 1);

        const unl = scoreNote(fmt, scen, HOPS, idealNote(fmt, scen, HOPS, { unlinkLineage: true }));
        check(`${scen.id} ${fmt} unlink L`, mean(unl.lin.map((x) => +x.ok)), 0);
      }
      // Lon fault injection: shallow fence, bracket prefix, tampered relay, dropped clause -> caught by oracle-free audit.
      const prevClean = idealNote('lon', scen, HOPS - 1);
      const dropAud = scoreNote('lon', scen, HOPS, idealNote('lon', scen, HOPS, { dropClauseN: 2 }), prevClean);
      if (!dropAud.audit.flagged || !dropAud.audit.reasons.includes('CARRY_DROP')) {
        bad++; console.log(`FAIL ${scen.id} carryDrop not flagged by audit`, dropAud.audit);
      }
      const tamperAud = scoreNote('lon', scen, HOPS, idealNote('lon', scen, HOPS, { tamperRelayDoc: scen.docs[0].id }), prevClean);
      if (!tamperAud.audit.flagged || tamperAud.tamper.altered < 1 || !tamperAud.audit.reasons.includes('TAMPERED_RELAY')) {
        bad++; console.log(`FAIL ${scen.id} tamperRelay not caught`, tamperAud.audit);
      }
      const brkAud = scoreNote('lon', scen, HOPS, idealNote('lon', scen, HOPS, { bracketPrefix: true }), prevClean);
      if (!brkAud.audit.flagged || brkAud.bracketPrefixCount === 0 || !(mean(brkAud.lin.map((x) => +x.ok)) < 1)) {
        bad++; console.log(`FAIL ${scen.id} bracketPrefix not penalized/flagged`);
      }
      const mukRows = extractLonMukRows(scen, HOPS, idealNote('lon', scen, HOPS), readNoteJoined('lon', idealNote('lon', scen, HOPS)));
      const mukSum = summarizeAnswers(mukRows);
      if (mukSum.n < 80 || mukSum.right !== mukSum.n) {
        bad++; console.log(`FAIL ${scen.id} muk extraction`, mukSum);
      }
      const r = scoreReader(scen, scen.questions.map((q) => `Q${q.q}: ${q.answer.replace(/\n/g, ' ')}`).join('\n'));
      check(`${scen.id} reader ideal exact`, mean(r.map((x) => +x.exact)), 1);
    }
    console.log(bad ? `selftest: ${bad} FAILED` : `selftest: all checks passed (${scens.length} scenarios x ${FORMATS.length} formats x ${HOPS} hops + tamper/audit/muk)`);
    process.exit(bad ? 1 : 0);
  }

  const inputs = opt('--in', positional.join(',')).split(',').filter(Boolean);
  if (!inputs.length) throw new Error('score-e13: pass input JSONL files or --in <files>');
  const rows = inputs.flatMap((f) => {
    try { return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); }
    catch { return []; }
  });
  const scenOf = Object.fromEntries(scens.map((s) => [s.id, s]));
  const S = new Map();
  for (const r of rows) {
    if (!scenOf[r.scen]) continue;
    if (!S.has(r.sid)) S.set(r.sid, { sid: r.sid, scen: r.scen, model: r.model, format: r.format, notes: {}, empties: {}, rows: [], usd: 0, errors: 0, deltaOnlyCount: 0 });
    const s = S.get(r.sid);
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

  // Session assembly & full 30-hop scoring across all 5 potentials.
  const allAuditEvents = []; // { model, format, sid, hop, flagged, reasons, gtLoss }
  const mukByCell = {}; // model -> { trainFolds: Fold[], testRows: AnswerRow[], allRows: AnswerRow[] }

  for (const s of S.values()) {
    const scen = scenOf[s.scen];
    s.complete = Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => s.notes[h]);
    s.broken = !s.complete && Array.from({ length: HOPS }, (_, i) => i + 1).some((h) => !s.notes[h] && (s.empties[h] ?? 0) >= 3);
    s.settled = (s.complete && (s.notes[READER] || (s.empties[READER] ?? 0) >= 3)) || s.broken;
    s.hops = {};
    s.at = {};
    let lastNote = null, prevL = 1, prevV = 1;
    const seenLonNs = new Set();
    const sessionMuk = [];

    for (let h = 1; h <= HOPS; h++) {
      const currText = s.notes[h] ? s.notes[h].text : (s.broken ? null : lastNote);
      const sc = scoreNote(s.format, scen, h, currText, lastNote);
      s.hops[h] = sc;
      if (CURVE.includes(h)) s.at[h] = sc;

      const curL = sc.lin.length ? mean(sc.lin.map((x) => +x.ok)) : 1;
      const curV = sc.per.length ? mean(sc.per.map((x) => +x.v)) : 1;
      const gtDefect = !sc.has || (curV < 1 - 1e-9) || (curL < 1 - 1e-9) || sc.tamper.altered > 0;
      const gtOnset = !sc.has || (curV < prevV - 1e-9) || (curL < prevL - 1e-9) || (h === 1 && (curV < 1 - 1e-9 || curL < 1 - 1e-9));
      if (s.settled) {
        allAuditEvents.push({ model: s.model, format: s.format, sid: s.sid, hop: h, flagged: sc.audit.flagged, reasons: sc.audit.reasons, gtLoss: gtDefect, gtOnset, curL, curV });
      }

      if (s.format === 'lon' && s.notes[h]) {
        const stdJ = readNoteJoined('lon', s.notes[h].text);
        const newNs = new Set([...sc.unitNs].filter((n) => !seenLonNs.has(n)));
        for (const n of sc.unitNs) seenLonNs.add(n);
        if (newNs.size > 0) {
          const rws = extractLonMukRows(scen, h, s.notes[h].text, stdJ, newNs);
          sessionMuk.push(...rws.map((r) => ({ ...r, hop: h, scen: s.scen })));
        }
      }

      if (s.notes[h]) { lastNote = s.notes[h].text; prevL = curL; prevV = curV; }
    }
    s.final = s.hops[HOPS];
    s.reader = scoreReader(scen, s.notes[READER]?.text ?? '');
    s.lastNoteChars = s.notes[HOPS]?.text?.length ?? NaN;
    const okRows = s.rows.filter((r) => !r.error);
    s.tin = okRows.reduce((a, r) => a + (r.usage?.in ?? 0), 0);
    s.tout = okRows.reduce((a, r) => a + (r.usage?.out ?? 0), 0);
    s.cached = okRows.reduce((a, r) => a + (r.usage?.cached ?? 0), 0);
    s.rtok = okRows.reduce((a, r) => a + (r.reasoning_tokens ?? 0), 0);
    s.rchars = okRows.reduce((a, r) => a + (r.reasoning_chars ?? 0), 0);
    s.ms = mean(okRows.map((r) => r.ms ?? 0));
    s.cut = okRows.filter((r) => /length|max_output|max_tokens/i.test(String(r.finish ?? ''))).length;
    s.bracketPrefix = Object.values(s.hops).reduce((a, x) => a + x.bracketPrefixCount, 0);
    s.sessionMuk = sessionMuk;

    if (s.format === 'lon' && s.settled) {
      const mk = (mukByCell[s.model] ??= { allRows: [], scenRows: {} });
      mk.allRows.push(...sessionMuk);
      (mk.scenRows[s.scen] ??= []).push(...sessionMuk);
    }
  }

  const models = uniq([...S.values()].map((s) => s.model)).sort();
  const formats = uniq([...S.values()].map((s) => s.format)).sort();
  const ses = (m, f) => scens.map((sc) => S.get(`${sc.id}|${m}|${f}`)).filter((s) => s?.settled);
  const Lof = (s, pick = () => true, k = 'ok', h = HOPS) => { const xs = s.at[h].lin.filter(pick); return xs.length ? mean(xs.map((x) => +x[k])) : NaN; };
  const LstrictOf = (s, pick = () => true, h = HOPS) => { const xs = s.at[h].linStrict.filter(pick); return xs.length ? mean(xs.map((x) => +x.ok)) : NaN; };
  const Vof = (s, pick = () => true) => { const xs = s.final.per.filter(pick); return xs.length ? mean(xs.map((x) => +x.v)) : NaN; };
  const Vhof = (s, pick = () => true) => { const xs = s.final.hist.filter(pick); return xs.length ? mean(xs.map((x) => +x.v)) : NaN; };
  const Rof = (s, pick = () => true) => { const xs = s.reader.filter((x, i) => pick(scenOf[s.scen].questions[i])); return xs.length ? mean(xs.map((x) => +x.exact)) : NaN; };
  const isLinQ = (q) => q.kind === 'lineage', isCurQ = (q) => q.kind !== 'lineage';
  const avg = (xs, fn) => mean(xs.map(fn).filter(Number.isFinite));

  const contrast = (fn, other) => models.map((m) => {
    const pairs = scens.map((sc) => [S.get(`${sc.id}|${m}|lon`), S.get(`${sc.id}|${m}|${other}`)]).filter(([a, b]) => a?.settled && b?.settled);
    const d = pairs.map(([a, b]) => fn(a) - fn(b)).filter(Number.isFinite);
    return { k: m, n: d.length, mean: mean(d), ci: bootCI(d), p: signFlip(d) };
  });

  // Potential 3: Oracle-free audit evaluation (hop-level & session-level).
  function evalAudit(evs, byGroup) {
    const tp = evs.filter((e) => e.flagged && e.gtLoss).length;
    const fp = evs.filter((e) => e.flagged && !e.gtLoss).length;
    const fn = evs.filter((e) => !e.flagged && e.gtLoss).length;
    const tn = evs.filter((e) => !e.flagged && !e.gtLoss).length;
    const rec = tp + fn > 0 ? tp / (tp + fn) : NaN;
    const prec = tp + fp > 0 ? tp / (tp + fp) : NaN;
    const onsetHits = evs.filter((e) => e.flagged && e.gtOnset).length;
    const onsetTotal = evs.filter((e) => e.gtOnset).length;
    const onsetRecall = onsetTotal > 0 ? onsetHits / onsetTotal : NaN;
    // Session-level: does audit flag any hop in a session whose final L<1 or V<1?
    const bySid = new Map();
    for (const e of evs) {
      if (!bySid.has(e.sid)) bySid.set(e.sid, []);
      bySid.get(e.sid).push(e);
    }
    let stp = 0, sfp = 0, sfn = 0, stn = 0;
    const leads = [];
    for (const arr of bySid.values()) {
      const h30 = arr[arr.length - 1];
      const badFinal = h30.curL < 1 - 1e-9 || h30.curV < 1 - 1e-9;
      const firstFlag = arr.find((x) => x.flagged);
      if (badFinal && firstFlag) { stp++; leads.push(HOPS - firstFlag.hop); }
      else if (badFinal && !firstFlag) sfn++;
      else if (!badFinal && firstFlag) sfp++;
      else stn++;
    }
    return {
      group: byGroup, hops: evs.length, tp, fp, fn, tn, recall: rec, precision: prec, onsetRecall,
      sessions: bySid.size, sRecall: stp + sfn > 0 ? stp / (stp + sfn) : NaN,
      sPrecision: stp + sfp > 0 ? stp / (stp + sfp) : NaN,
      falseAlarmCleanSessions: stp + sfp + sfn + stn ? (sfp / Math.max(1, sfp + stn)) : NaN,
      meanLeadHops: mean(leads),
    };
  }

  // Potential 4: Muk v6 credibility & Eq. E multi-agent weighting simulation.
  const mukSummaryTable = [];
  const calibSplit = Math.ceil(scens.length / 2); // first half of scenarios train Muk grade, second half test Eq. E counterShare
  const trainIds = new Set(scens.slice(0, calibSplit).map((s) => s.id));
  const testIds = new Set(scens.slice(calibSplit).map((s) => s.id));
  const eqESim = { agents: {}, naiveAcc: NaN, mukAcc: NaN, naiveBrier: NaN, mukBrier: NaN };

  for (const m of models) {
    const mk = mukByCell[m];
    if (!mk || !mk.allRows.length) continue;
    const foldsAll = Object.entries(mk.scenRows).map(([scId, rws], idx) => ({
      at: Date.UTC(2026, 10, 15, idx, 0, 0),
      lang: 'en',
      s: summarizeAnswers(rws),
    }));
    const sum = summarizeAnswers(mk.allRows);
    const cred = credibility(foldsAll, MUK.mid);
    const grade = gradeOf(cred.base);
    const acc = sum.all ? (sum.right + sum.mr) / sum.all : NaN;
    const meanBrier = sum.n ? sum.sb / sum.n : NaN;
    const overconfErr = sum.n ? mk.allRows.filter((r) => (r.conf ?? 0) >= 7 && !r.ok).length / sum.n : NaN;
    // Split colorGain only empirically across chronological scenarios (zero color semantics implied).
    const tr = mk.allRows.filter((r) => trainIds.has(r.scen));
    const te = mk.allRows.filter((r) => testIds.has(r.scen));
    const cg = tr.length && te.length ? colorGain(tr, te) : null;

    // Train-only Muk grade for Eq. E out-of-sample simulation
    const trFolds = Object.entries(mk.scenRows)
      .filter(([scId]) => trainIds.has(scId))
      .map(([, rws], idx) => ({ at: Date.UTC(2026, 10, 15, idx, 0, 0), lang: 'en', s: summarizeAnswers(rws) }));
    const trCred = credibility(trFolds, MUK.mid);
    const trGrade = gradeOf(trCred.base);

    mukSummaryTable.push({
      model: m, clauses: sum.all, withChae: sum.n, accuracy: acc,
      credBase: cred.base, grade, gap: cred.gap, brier: meanBrier, overconfErr,
      trainGrade: trGrade, colorGain: cg?.gain ?? null,
      byConf: sum.by.map(([n, right], conf) => ({ conf, n, right, stated: probOf(conf), emp: n ? right / n : null })),
    });
    eqESim.agents[m] = { grade: trGrade, trBase: trCred.base };
  }

  // Eq. E multi-agent weighting simulation on S06..S10 held-out reader & clause consensus:
  if (Object.keys(eqESim.agents).length >= 2) {
    // Pool by question across models for held-out scenarios using Reader (or per-scen lon clause decisions where conf available).
    const teScens = scens.filter((sc) => testIds.has(sc.id));
    let nQ = 0, hitNaive = 0, hitMuk = 0, brierNaive = 0, brierMuk = 0;
    for (const sc of teScens) {
      // Compare ensemble weight across the settled `lon` models for each question via answer vote:
      for (let qi = 0; qi < sc.questions.length; qi++) {
        const votes = [];
        for (const m of models) {
          const s = S.get(`${sc.id}|${m}|lon`);
          if (!s?.settled) continue;
          const rObj = s.reader[qi];
          const mkRows = s.sessionMuk.filter((x) => x.conf != null);
          const meanConf = mkRows.length ? Math.round(mean(mkRows.map((x) => x.conf))) : 5;
          const g = eqESim.agents[m]?.grade ?? MUK.mid;
          // Eq. E inverse-counter trust weight = 1 - counterShare(muk, conf, 5, 'E')
          const wMuk = 1 - counterShare(g, meanConf, 5, 'E');
          votes.push({ ok: rObj.exact ? 1 : 0, wMuk, conf: meanConf });
        }
        if (!votes.length) continue;
        nQ++;
        const pNaive = mean(votes.map((v) => v.ok));
        const wSum = votes.reduce((a, v) => a + v.wMuk, 0);
        const pMuk = wSum > 0 ? votes.reduce((a, v) => a + v.wMuk * v.ok, 0) / wSum : pNaive;
        if (pNaive >= 0.5) hitNaive++;
        if (pMuk >= 0.5) hitMuk++;
        brierNaive += (pNaive - 1) ** 2;
        brierMuk += (pMuk - 1) ** 2;
      }
    }
    if (nQ > 0) {
      eqESim.nItems = nQ;
      eqESim.naiveAcc = hitNaive / nQ;
      eqESim.mukAcc = hitMuk / nQ;
      eqESim.naiveBrier = brierNaive / nQ;
      eqESim.mukBrier = brierMuk / nQ;
    }
  }

  // ---------- Build Markdown Report & Structured JSON ----------
  const out = [];
  const P = (s = '') => out.push(s);
  P('# E13 Metrics: 30-Hop Non-Destructive Epistemic Lineage, Tamper-Evidence, Static Audit, Muk v6, and Efficiency');
  P();
  P(`Generated ${new Date().toISOString()} from ${inputs.join(', ')} (${rows.length} rows) against ${sessionsPath} (${scens.length} scenarios, ${HOPS} hops).`);
  P();

  // Section 1: Cells
  P('## 1. Run Inventory & Potential 1 (Lineage, Verbatim Survival, Reader)');
  const cellRows = [];
  for (const m of models) for (const f of formats) {
    const xs = ses(m, f);
    const allM = scens.map((sc) => S.get(`${sc.id}|${m}|${f}`)).filter(Boolean);
    const usdTot = allM.reduce((a, s) => a + s.usd, 0);
    cellRows.push({
      model: m, format: f, settled: xs.length, complete: xs.filter((s) => s.complete).length,
      broken: xs.filter((s) => s.broken).length,
      L: avg(xs, (s) => Lof(s)), L_strict: avg(xs, (s) => LstrictOf(s)), L_lenient: avg(xs, (s) => Lof(s, () => true, 'okLenient')),
      V: avg(xs, (s) => Vof(s)), Vh: avg(xs, (s) => Vhof(s)),
      readerCur: avg(xs, (s) => Rof(s, isCurQ)), readerLin: avg(xs, (s) => Rof(s, isLinQ)),
      finalChars: avg(xs, (s) => s.lastNoteChars),
      deltaOnly: allM.reduce((a, s) => a + s.deltaOnlyCount, 0),
      bracketPrefix: allM.reduce((a, s) => a + s.bracketPrefix, 0),
      cut: allM.reduce((a, s) => a + s.cut, 0),
      usd: usdTot,
      tin: xs.reduce((a, s) => a + s.tin, 0), tout: xs.reduce((a, s) => a + s.tout, 0), cached: xs.reduce((a, s) => a + s.cached, 0),
      ms: avg(xs, (s) => s.ms),
    });
  }
  P(tbl(['model', 'format', 'settled', 'broken', 'L', 'L strict', 'V', 'Vh', 'reader cur', 'reader lin', 'hop30 chars', 'deltaOnly', 'bracketPfx', 'cut', 'USD'],
    cellRows.map((c) => [c.model, c.format, c.settled, c.broken, f3(c.L), f3(c.L_strict), f3(c.V), f3(c.Vh), f3(c.readerCur), f3(c.readerLin), Number.isFinite(c.finalChars) ? c.finalChars.toFixed(0) : 'n/a', c.deltaOnly, c.bracketPrefix, c.cut, c.usd.toFixed(4)])));
  P();

  // Section 2: Paired contrasts
  P('## 2. Primary & Secondary Paired Contrasts (Exact Sign-Flip + Holm over Cells)');
  const primaryContrast = {};
  for (const other of ['jsonchain', 'json', 'natural']) {
    const resL = contrast((s) => Lof(s), other), holmL = holm(resL);
    const resV = contrast((s) => Vof(s), other), holmV = holm(resV);
    const resR = contrast((s) => Rof(s, isLinQ), other), holmR = holm(resR);
    primaryContrast[other] = { L: resL, holmL, V: resV, holmV, readerLin: resR, holmR };
    P(`### lon minus ${other}`);
    P(tbl(['model', 'pairs', 'L diff (95% CI)', 'p (L)', 'p Holm (L)', 'V diff', 'p (V)', 'Reader lin diff', 'p Holm (R)'],
      resL.map((c, idx) => [c.k, c.n, `${f3(c.mean)} (${f3(c.ci[0])} to ${f3(c.ci[1])})`, f4(c.p), f4(holmL[c.k]), f3(resV[idx].mean), f4(resV[idx].p), f3(resR[idx].mean), f4(holmR[c.k])])));
    P();
  }

  // Section 3: Hop curve & Breakdown
  P('## 3. Hop-by-Hop Trajectory (L & Note Chars) & Category Breakdown');
  const curveRows = models.flatMap((m) => formats.map((f) => {
    const xs = ses(m, f);
    return { model: m, format: f, hops: Object.fromEntries(CURVE.map((h) => [h, avg(xs, (s) => Lof(s, () => true, 'ok', h))])), chars: Object.fromEntries(CURVE.map((h) => [h, avg(xs, (s) => s.at[h].chars)])) };
  }));
  P(tbl(['model', 'format', ...CURVE.map((h) => `L h${h}`)], curveRows.map((r) => [r.model, r.format, ...CURVE.map((h) => f3(r.hops[h]))])));
  P();
  const cats = uniq(scens.flatMap((sc) => lineageEventsAt(sc, HOPS).map(catOf))).sort();
  P(tbl(['model', 'format', ...cats], models.flatMap((m) => formats.map((f) => [m, f, ...cats.map((c) => f3(avg(ses(m, f), (s) => Lof(s, (x) => x.cat === c))))]))));
  P();

  // Section 4: Potential 2 — Tamper-Evidence
  P('## 4. Potential 2: Verbatim External-Evidence Tamper-Evidence');
  const tamperRows = models.flatMap((m) => formats.map((f) => {
    const xs = ses(m, f);
    const totalSpans = xs.reduce((a, s) => a + s.final.tamper.total, 0);
    const alteredSpans = xs.reduce((a, s) => a + s.final.tamper.altered, 0);
    return {
      model: m, format: f,
      plainV: avg(xs, (s) => Vof(s, (p) => p.hazard === 'plain')),
      jsonHazV: avg(xs, (s) => Vof(s, (p) => p.hazard === 'json')),
      lonHazV: avg(xs, (s) => Vof(s, (p) => p.hazard === 'lon')),
      totalSpans, alteredSpans,
      alteredRate: totalSpans ? alteredSpans / totalSpans : NaN,
      noHazL: avg(xs, (s) => Lof(s, (e) => !e.lonHaz)),
    };
  }));
  P(tbl(['model', 'format', 'plain V', 'JSON-hazard V', 'Lon-hazard V', 'L (no Lon-hazard)', 'attributed quotes/relays (final)', 'altered/forged count', 'altered rate'],
    tamperRows.map((r) => [r.model, r.format, f3(r.plainV), f3(r.jsonHazV), f3(r.lonHazV), f3(r.noHazL), r.totalSpans, r.alteredSpans, f3(r.alteredRate)])));
  P();

  // Section 5: Potential 3 — Key-Free Static Audit
  P('## 5. Potential 3: Key-Free (Oracle-Free) Static Audit');
  const auditByFmt = formats.map((f) => evalAudit(allAuditEvents.filter((e) => e.format === f), f));
  const auditByCell = models.flatMap((m) => formats.map((f) => evalAudit(allAuditEvents.filter((e) => e.model === m && e.format === f), `${m}|${f}`)));
  P(tbl(['format', 'hops', 'TP', 'FP', 'FN', 'TN', 'hop recall', 'hop prec', 'onset recall', 'sess recall', 'sess prec', 'clean FA rate', 'mean lead (hops)'],
    auditByFmt.map((a) => [a.group, a.hops, a.tp, a.fp, a.fn, a.tn, f3(a.recall), f3(a.precision), f3(a.onsetRecall), f3(a.sRecall), f3(a.sPrecision), f3(a.falseAlarmCleanSessions), Number.isFinite(a.meanLeadHops) ? a.meanLeadHops.toFixed(1) : 'n/a'])));
  P();

  // Section 6: Potential 4 — Muk v6 Calibration & Eq. E
  P('## 6. Potential 4: Muk v6 Epistemic Credibility & Eq. E Counter-Share (Lon)');
  P(tbl(['model', 'clauses', 'with chae', 'accuracy', 'cred base', 'Muk grade', 'cal gap', 'mean Brier', 'overconf err (c>=7)', 'empirical colorGain'],
    mukSummaryTable.map((r) => [r.model, r.clauses, r.withChae, f3(r.accuracy), f3(r.credBase), r.grade, f4(r.gap), f4(r.brier), f3(r.overconfErr), r.colorGain != null ? f4(r.colorGain) : 'n/a'])));
  if (eqESim.nItems) {
    P();
    P(`Held-out multi-agent Eq. E ensemble simulation (S06..S10, ${eqESim.nItems} items): unweighted acc=${f3(eqESim.naiveAcc)} (Brier=${f4(eqESim.naiveBrier)}) vs Muk-weighted Eq. E acc=${f3(eqESim.mukAcc)} (Brier=${f4(eqESim.mukBrier)}).`);
  }
  P();

  // Section 7: Potential 5 — Efficiency
  P('## 7. Potential 5: Long-Conversation Efficiency & Cost');
  P(tbl(['model', 'format', 'input tok', 'cache hit %', 'output tok', 'mean lat (ms)', 'hop30 chars', 'USD', 'USD/settled', 'L per USD/sess'],
    cellRows.map((c) => {
      const usdPerSess = c.settled ? c.usd / c.settled : NaN;
      const eff = Number.isFinite(usdPerSess) && usdPerSess > 0 ? c.L / usdPerSess : NaN;
      return [c.model, c.format, c.tin, c.tin ? `${((100 * c.cached) / c.tin).toFixed(1)}%` : 'n/a', c.tout, Number.isFinite(c.ms) ? c.ms.toFixed(0) : 'n/a',
        Number.isFinite(c.finalChars) ? c.finalChars.toFixed(0) : 'n/a', c.usd.toFixed(4), f4(usdPerSess), Number.isFinite(eff) ? eff.toFixed(1) : 'n/a'];
    })));

  const md = out.join('\n') + '\n';
  const reportDest = opt('--report', opt('--out', ''));
  const jsonDest = opt('--json', '');
  if (reportDest) { mkdirSync(dirname(reportDest), { recursive: true }); writeFileSync(reportDest, md); console.log(`wrote ${reportDest}`); }
  else process.stdout.write(md);

  if (jsonDest) {
    mkdirSync(dirname(jsonDest), { recursive: true });
    writeFileSync(jsonDest, JSON.stringify({
      generatedAt: new Date().toISOString(),
      sessionsPath,
      scenarios: scens.length,
      models,
      formats,
      cells: cellRows,
      contrasts: primaryContrast,
      curve: curveRows,
      tamper: tamperRows,
      auditByFormat: auditByFmt,
      auditByCell,
      muk: mukSummaryTable,
      eqESim,
    }, null, 2) + '\n');
    console.log(`wrote ${jsonDest}`);
  }
}
