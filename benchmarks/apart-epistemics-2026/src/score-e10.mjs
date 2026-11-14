// E10 scorer (v2, non-destructive lineage + verbatim survival). Dependency-free except vendored gyeol parser.
//   node src/score-e10.mjs --sessions data/sessions-e10.json --in results/e10/e10-deepseek.jsonl,results/e10/e10-glm53flash.jsonl --out report/metrics-e10.md
//   node src/score-e10.mjs --selftest --sessions data/sessions-e10.json
// Primary endpoint L (lineage auditability at the final note, 5 events): share of lineage events (amendments R1/R2,
// withdrawal W1, recomputed derived values D1/D2) where a machine reader recovers an active new/cancellation unit,
// preserves & verifies the earlier superseded/withdrawn entry, and confirms the explicit fix->/err->/revises/retracts edge.
// Co-reported endpoint V (active verifiable survival, 14 in-force raw payloads): share of in-force raw payloads for which
// a machine-read span attributed to evdN satisfies norm(value) in norm(span) in norm(document body).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HOPS, norm, idsOf, inForce, derivedAt, lineageEventsAt, hasNum, mulberry32 } from './lib-e10.mjs';
import { idealNote } from './mock-e10.mjs';
import { parseTurn, stripReplyLabels } from '../vendor/gyeol-ea35b6b/src/index.ts';

export const FORMATS = ['natural', 'json', 'jsonchain', 'lon'];
const READER = HOPS + 1;
const SEED = 20261114, BOOT = 2000;
const uniq = (a) => [...new Set(a)];
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const share = (xs, f) => (xs.length ? xs.filter(f).length / xs.length : NaN);

// ---------- readers: note text -> { ok, spans: [{ ids, text }], units: [...] } ----------
const stripFence = (t) => { const m = String(t).match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/); return m ? m[1] : String(t); };
function jsonOf(text) {
  const t = stripFence(text), a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}
export const unesc = (s) => String(s).replace(/\\(u[0-9a-fA-F]{4}|[\s\S])/g, (m, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c === 'r' ? '\r' : c[0] === 'u' && c.length === 5 ? String.fromCharCode(parseInt(c.slice(1), 16)) : c));
const asText = (v) => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v));

function parseLinkField(val) {
  const nums = [], evds = [];
  const arr = Array.isArray(val) ? val : val == null ? [] : [val];
  for (const x of arr) {
    if (typeof x === 'number' && Number.isInteger(x)) nums.push(x);
    else if (typeof x === 'string') {
      for (const m of x.matchAll(/evd\d+/gi)) evds.push(m[0].toLowerCase());
      for (const m of x.replace(/evd\d+/gi, ' ').matchAll(/\b\d+\b/g)) nums.push(Number(m[0]));
    }
  }
  return { nums: uniq(nums), evds: uniq(evds) };
}

function markActive(units) {
  const gone = new Set();
  for (const u of units) {
    for (const k of u.revises) gone.add(k);
    for (const k of u.retracts) gone.add(k);
  }
  for (const u of units) u.active = u.n == null ? true : !gone.has(u.n);
}

// span-local salvage for broken JSON
function salvageValue(text, from, nextKeyRe) {
  nextKeyRe.lastIndex = from;
  const nx = nextKeyRe.exec(text);
  let seg = text.slice(from, nx ? nx.index : text.length).replace(/[\s,{}\[\]]+$/, '');
  if (seg.startsWith('"')) { seg = seg.slice(1); if (seg.endsWith('"')) seg = seg.slice(0, -1); }
  return seg;
}

function readJson(text, salvage) {
  const o = jsonOf(text);
  if (o && Array.isArray(o.items)) {
    const spans = [], units = [];
    for (const it of o.items) {
      if (!it || typeof it !== 'object') continue;
      const v = asText(it.value), src = asText(it.source), ids = idsOf(src);
      const refs = uniq([...src.replace(/evd\d+/gi, ' ').matchAll(/\b\d+\b/g)].map((m) => Number(m[0])));
      const rev = parseLinkField(it.revises), ret = parseLinkField(it.retracts);
      const rawN = it.id ?? it.n;
      const n = Number.isInteger(Number(rawN)) && rawN != null && String(rawN).trim() !== '' ? Number(rawN) : null;
      const txt = `${asText(it.item)} ${v}`.trim();
      spans.push({ ids, text: v });
      units.push({ n, ids, refs, revises: rev.nums, retracts: ret.nums, revEvds: rev.evds, retEvds: ret.evds, text: txt, fullText: txt, active: true });
    }
    markActive(units);
    return { ok: true, spans, units };
  }
  const out = { ok: false, spans: [], units: [] };
  if (!salvage) return out;
  const t = String(text), chunkRe = /\{\s*"(?:id|item|value|source)"\s*:/g, starts = [...t.matchAll(chunkRe)].map((m) => m.index);
  for (let i = 0; i < starts.length; i++) {
    const chunk = t.slice(starts[i], i + 1 < starts.length ? starts[i + 1] : t.length);
    const vm = /"value"\s*:\s*/.exec(chunk), sm = /"source"\s*:\s*/.exec(chunk), im = /"item"\s*:\s*/.exec(chunk);
    if (!vm) continue;
    const key = () => /"(?:id|item|value|source|revises|retracts)"\s*:/g;
    const v = salvageValue(chunk, vm.index + vm[0].length, key());
    const ids = sm ? idsOf(salvageValue(chunk, sm.index + sm[0].length, key())) : [];
    const item = im ? salvageValue(chunk, im.index + im[0].length, key()) : '';
    for (const cand of uniq([v, unesc(v)])) out.spans.push({ ids, text: cand });
    const txt = `${item} ${v}`.trim();
    out.units.push({ n: null, ids, refs: [], revises: [], retracts: [], revEvds: [], retEvds: [], text: txt, fullText: txt, active: true });
  }
  return out;
}

function readJsonchain(text, salvage) {
  const o = jsonOf(text);
  if (o && Array.isArray(o.steps)) {
    const spans = [], units = [];
    for (const st of o.steps) {
      if (!st || typeof st !== 'object') continue;
      const q = st.quotes && typeof st.quotes === 'object' && !Array.isArray(st.quotes) ? Object.entries(st.quotes) : [];
      for (const [k, v] of q) spans.push({ ids: idsOf(k), text: asText(v) });
      const g = Array.isArray(st.grounds) ? st.grounds : st.grounds == null ? [] : [st.grounds];
      const ids = uniq([...idsOf(JSON.stringify(g)), ...q.flatMap(([k]) => idsOf(k))]);
      const refs = uniq(
        g.filter((x) => typeof x === 'number' || /^\s*(?:step\s*|n\s*=\s*|#)?\d+\s*$/i.test(String(x)))
          .map((x) => Number(String(x).replace(/\D/g, ''))),
      );
      const rev = parseLinkField(st.revises), ret = parseLinkField(st.retracts);
      const n = Number.isInteger(Number(st.n)) && st.n != null && String(st.n).trim() !== '' ? Number(st.n) : null;
      const txt = asText(st.claim);
      const full = `${txt} ${q.map(([, v]) => asText(v)).join(' ')}`.trim();
      units.push({ n, ids, refs, revises: rev.nums, retracts: ret.nums, revEvds: rev.evds, retEvds: ret.evds, text: txt, fullText: full, active: true });
    }
    markActive(units);
    return { ok: true, spans, units };
  }
  const out = { ok: false, spans: [], units: [] };
  if (!salvage) return out;
  const t = String(text), re = /"(evd\d+)"\s*:\s*(?=")/gi;
  let m;
  while ((m = re.exec(t))) {
    const v = salvageValue(t, m.index + m[0].length, /"(?:evd\d+|n|claim|evidence|revises|retracts|grounds|quotes)"\s*:/gi);
    for (const cand of uniq([v, unesc(v)])) out.spans.push({ ids: [m[1].toLowerCase()], text: cand });
  }
  return out;
}

// every span between two double-quote marks of a text (a value may itself contain quote marks)
function quotedSpans(s) {
  const pos = [...String(s).matchAll(/["“”]/g)].map((m) => m.index), out = [];
  if (pos.length < 2) return out;
  if (pos.length > 12) { out.push(s.slice(pos[0] + 1, pos[pos.length - 1])); for (let i = 0; i + 1 < pos.length; i++) out.push(s.slice(pos[i] + 1, pos[i + 1])); return out; }
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) out.push(s.slice(pos[i] + 1, pos[j]));
  return out;
}

const RELAY = () => /(evd\d+)\s*<(\[+)/gi;
const CLAUSE = () => /<\s*(\d+)\s*·/g;
// Closing rule matches the gyeol reference parser (scanExtBlocks): at depth 1 `]>` closes the relay only before end of text,
// white space, `<`, `＜` or an evidence tag; deeper fences `<[[ ]]>` close at the matching `]]>`.
function readLon(text, salvage, firstCloser = false) {
  const t = String(text), spans = [], relays = [];
  const re = RELAY();
  let m;
  while ((m = re.exec(t))) {
    const close = ']'.repeat(m[2].length) + '>', from = m.index + m[0].length;
    let end = t.indexOf(close, from);
    if (!firstCloser && close.length === 2) while (end >= 0 && !/^(?:$|[\s<＜]|(?:증|근|evd|ref)[0-9０-９])/iu.test(t.slice(end + 2, end + 16))) end = t.indexOf(close, end + 2);
    if (end < 0) continue; // unclosed relay: no span
    if (salvage) {
      const r2 = RELAY(); r2.lastIndex = from; const a = r2.exec(t);
      const r3 = CLAUSE(); r3.lastIndex = from; const b = r3.exec(t);
      const lim = Math.min(a ? a.index : t.length, b ? b.index : t.length);
      const last = t.lastIndexOf(close, lim - close.length);
      if (last > end) end = last;
    }
    const lastNl = t.lastIndexOf('\n', m.index);
    const sameLinePrefix = t.slice(lastNl + 1, m.index);
    const inline = />\s*$/.test(sameLinePrefix);
    const rtext = t.slice(from, end);
    const idx = relays.length;
    relays.push({ id: m[1].toLowerCase(), text: rtext, inline, start: m.index, end: end + close.length });
    spans.push({ ids: [m[1].toLowerCase()], text: rtext });
    re.lastIndex = end + close.length;
  }
  let rest = '', at = 0;
  for (let idx = 0; idx < relays.length; idx++) {
    const r = relays[idx];
    rest += t.slice(at, r.start) + ` \0R${idx}\0 `;
    at = r.end;
  }
  rest += t.slice(at);
  const starts = [...rest.matchAll(CLAUSE())], units = [];
  for (let i = 0; i < starts.length; i++) {
    const seg = rest.slice(starts[i].index + starts[i][0].length, i + 1 < starts.length ? starts[i + 1].index : rest.length);
    const marks = [...seg.matchAll(/\*\d*[RGBCMYK]\d/g)], mk = marks[marks.length - 1];
    const preMk = (mk ? seg.slice(0, mk.index) : seg).replace(/\0R\d+\0/g, ' ').replace(/>\s*$/u, '');
    const brk = preMk.indexOf('[');
    const header = brk >= 0 ? preMk.slice(0, brk) : '';
    const rB = brk >= 0 ? preMk.indexOf(']', brk) : -1;
    const content = (rB >= 0 ? preMk.slice(rB + 1) : preMk).trim();
    const revises = uniq([...header.matchAll(/\bfix\s*(?:→|->)\s*(\d+)/gi)].map((x) => Number(x[1])));
    const retracts = uniq([...header.matchAll(/\berr\s*(?:→|->)\s*(\d+)/gi)].map((x) => Number(x[1])));
    const afterMk = mk ? seg.slice(mk.index + mk[0].length) : seg;
    const tail = mk ? (afterMk.match(/^(?:\s*↓\s*(?:evd\d+(?:\[[^\]]*\])?|ref\d+|T\d+|\d+))*/i) ?? [''])[0] : seg;
    const gr = [...tail.matchAll(/↓\s*(evd\d+|ref\d+|T\d+|\d+)/gi)].map((x) => x[1]);
    const ids = uniq(gr.filter((g) => /^evd/i.test(g)).map((g) => g.toLowerCase()));
    const refs = uniq(gr.filter((g) => /^\d+$/.test(g)).map(Number));
    const attached = [...seg.matchAll(/\0R(\d+)\0/g)]
      .map((rm) => relays[Number(rm[1])])
      .filter((rel) => rel && rel.inline)
      .map((rel) => rel.text);
    if (ids.length) for (const q of quotedSpans(content)) spans.push({ ids, text: q });
    const fullText = `${content} ${attached.join(' ')}`.trim();
    units.push({ n: Number(starts[i][1]), ids, refs, revises, retracts, revEvds: [], retEvds: [], text: content, fullText, active: true });
  }
  markActive(units);
  return { ok: units.length > 0 || relays.length > 0, spans, units };
}

function readNatural(text, salvage) {
  const lines = String(text).split(/\r?\n/), spans = [], units = [];
  const ENTRY_HEAD = /^\s*(?:[-*•]\s*)?(?:\*\*|__)?\[(\d+)\](?:\*\*|__)?\s*(.*)$/;
  const quoteCount = (s) => (s.match(/["“”]/g) ?? []).length;

  // Group into numbered entries `[k] ...`, keeping multi-line open quotes within their entry.
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    const openPrev = entries.length > 0 && quoteCount(entries[entries.length - 1].lines.join('\n')) % 2 === 1;
    const m = !openPrev ? ENTRY_HEAD.exec(ln) : null;
    if (m) {
      entries.push({ n: Number(m[1]), lines: [m[2]] });
    } else if (entries.length > 0 && (openPrev || !ln.trim() || (!idsOf(ln).length && entries[entries.length - 1].lines.length < 4))) {
      if (ln.trim()) entries[entries.length - 1].lines.push(ln);
    } else if (ln.trim()) {
      entries.push({ n: null, lines: [ln] });
    }
  }

  const numbered = entries.some((e) => e.n != null);
  const blocks = numbered ? entries : lines.map((ln, idx) => {
    const ids = idsOf(ln);
    if (!ids.length) return null;
    let grp = [ln];
    for (let j = idx + 1; j <= idx + 3 && j < lines.length && quoteCount(grp.join('\n')) % 2 === 1; j++) grp.push(lines[j]);
    return { n: null, lines: grp };
  }).filter(Boolean);

  for (const b of blocks) {
    const body = b.lines.join('\n');
    const ids = idsOf(body);
    if (ids.length) {
      for (const q of quotedSpans(body)) spans.push({ ids, text: q });
      if (salvage) {
        for (const src of uniq([b.lines[0], body])) {
          for (const c of [0, ...[...src.matchAll(/:\s/g)].slice(0, 6).map((mm) => mm.index + mm[0].length)]) {
            const suf = src.slice(c), np = suf.replace(/\s*\([^()]*\)\s*$/, '');
            spans.push({ ids, text: suf }); if (np !== suf) spans.push({ ids, text: np });
          }
        }
      }
    }
    // Strip balanced quoted values before parsing revises/withdraws/[ref] links so payloads like `tags[1]` are ignored.
    const noQ = body.replace(/"(?:\\[\s\S]|[^"])*"/g, ' ').replace(/“[\s\S]*?”/g, ' ');
    const revMatches = [...noQ.matchAll(/\b(?:revis(?:es|ing)|replac(?:es|ing)|supersed(?:es|ing)|amend(?:s|ing)|updat(?:es|ing))\s+(?:entry\s+|item\s+|line\s+|#)?\[?(\d+)\]?/gi)];
    const retMatches = [...noQ.matchAll(/\b(?:withdraw(?:s|ing)|retract(?:s|ing)|cancel(?:s|ling|ing))\s+(?:entry\s+|item\s+|line\s+|#)?\[?(\d+)\]?/gi)];
    const revises = uniq(revMatches.map((x) => Number(x[1])));
    const retracts = uniq(retMatches.map((x) => Number(x[1])));
    const revEvds = uniq([...noQ.matchAll(/\b(?:revis(?:es|ing)|replac(?:es|ing)|supersed(?:es|ing)|amend(?:s|ing)|updat(?:es|ing))\s+(?:entry\s+|item\s+|line\s+)?(evd\d+)/gi)].map((x) => x[1].toLowerCase()));
    const retEvds = uniq([...noQ.matchAll(/\b(?:withdraw(?:s|ing)|retract(?:s|ing)|cancel(?:s|ling|ing))\s+(?:entry\s+|item\s+|line\s+)?(evd\d+)/gi)].map((x) => x[1].toLowerCase()));
    const depStr = noQ
      .replace(/\b(?:revis(?:es|ing)|replac(?:es|ing)|supersed(?:es|ing)|amend(?:s|ing)|updat(?:es|ing)|withdraw(?:s|ing)|retract(?:s|ing)|cancel(?:s|ling|ing))\s+(?:entry\s+|item\s+|line\s+|#)?\[?\d+\]?/gi, ' ');
    const refs = uniq([
      ...[...depStr.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])),
      ...[...depStr.matchAll(/\b(?:from|computed from)\s+([^\n.;]+)/gi)].flatMap((m) =>
        [...m[1].replace(/evd\d+/gi, ' ').matchAll(/\b\d+\b/g)].map((x) => Number(x[0])),
      ),
    ]).filter((x) => x !== b.n);
    units.push({ n: b.n, ids, refs, revises, retracts, revEvds, retEvds, text: body, fullText: body, active: true });
  }
  markActive(units);
  return { ok: String(text).trim().length > 0 && (numbered ? units.length > 0 : true), spans, units };
}

export function readNote(format, text, salvage = false, firstCloser = false) {
  if (format === 'json') return readJson(text, salvage);
  if (format === 'jsonchain') return readJsonchain(text, salvage);
  if (format === 'lon') return readLon(text, salvage, firstCloser);
  return readNatural(text, salvage);
}

// ---------- per-note scoring ----------
function verified(p, doc, spans, strict) {
  const N = strict ? (s) => String(s).trim() : norm;
  const v = N(p.value), b = N(`${doc.header}\n${doc.body}`);
  return spans.some((s) => s.ids.includes(p.doc) && N(s.text).includes(v) && b.includes(N(s.text)));
}
const rawSurvive = (p, text) => { const v = norm(p.value); return norm(text).includes(v) || norm(unesc(text)).includes(v); };

function unitsForPayload(p, units, isVerified) {
  const v = norm(p.value), lbl = norm(p.label);
  const byVal = units.filter((u) => u.ids.includes(p.doc) && norm(u.fullText).includes(v));
  if (byVal.length) return byVal;
  if (!isVerified) return [];
  return units.filter((u) => u.ids.includes(p.doc) && norm(u.text).includes(lbl));
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

function trail(d, units, vset, mode) {
  const byN = new Map(units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  for (const u of units) {
    if (!u.active) continue;
    if (!hasNum(u.text, d.value) || (d.stale != null && hasNum(u.text, d.stale))) continue;
    const { ids } = reachOf(u, byN);
    const base = ids.has(d.baseDoc) || (mode === 'lenient' && ids.has(d.oldBaseDoc));
    if (base && ids.has(d.ruleDoc) && (mode !== 'strict' || (vset.has(d.baseKey) && vset.has(d.ruleKey)))) return true;
  }
  return false;
}

function scoreLineage(scen, hop, std, vAllSet, has) {
  const events = lineageEventsAt(scen, hop);
  if (!events.length) return [];
  if (!has) {
    return events.map((ev) => ({ id: ev.id, kind: ev.kind, cNew: false, cOld: false, cEdge: false, ok: false, okLenient: false }));
  }
  const byN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  const docs = Object.fromEntries(scen.docs.map((d) => [d.id, d]));
  const isV = (p) => vAllSet.has(p.key);
  return events.map((ev) => {
    if (ev.kind === 'amend' || ev.kind === 'withdraw') {
      const newVer = isV(ev.newP), oldVer = isV(ev.oldP);
      const uNews = unitsForPayload(ev.newP, std.units, newVer).filter((u) => u.active);
      const uOlds = unitsForPayload(ev.oldP, std.units, oldVer);
      const cNew = newVer && uNews.length > 0;
      let cOld = false, cEdge = false, cLen = false;
      for (const uo of uOlds) {
        if (uNews.some((un) => un !== uo)) {
          if (oldVer) cOld = true;
        }
        for (const un of uNews) {
          if (un === uo) continue;
          const links = ev.kind === 'amend' ? un.revises : un.retracts;
          if (uo.n != null && links.includes(uo.n)) cEdge = true;
          const evdLinks = ev.kind === 'amend' ? un.revEvds : un.retEvds;
          if (evdLinks.includes(ev.oldP.doc) || un.ids.includes(ev.oldP.doc) || norm(un.fullText).includes(ev.oldP.doc)) cLen = true;
        }
      }
      if (oldVer && uOlds.length > 0 && uNews.some((un) => !uOlds.includes(un) || uOlds.length > 1)) cOld = true;
      // recompute cleanly ensuring disjoint uo !== un
      cOld = oldVer && uOlds.some((uo) => uNews.some((un) => un !== uo));
      const ok = cNew && cOld && cEdge;
      const okLenient = cNew && cOld && (cEdge || cLen);
      return { id: ev.id, kind: ev.kind, cNew, cOld, cEdge, ok, okLenient };
    }
    // ev.kind === 'derived'
    const d = ev.der;
    const baseAndRuleVer = isV({ key: d.baseKey }) && isV({ key: d.ruleKey });
    const uNews = std.units.filter((un) => {
      if (!un.active || !hasNum(un.text, d.value) || hasNum(un.text, d.stale)) return false;
      const { ids } = reachOf(un, byN);
      return ids.has(d.baseDoc) && ids.has(d.ruleDoc) && baseAndRuleVer;
    });
    const uOlds = std.units.filter((uo) => {
      if (!hasNum(uo.text, d.stale)) return false;
      const { ids } = reachOf(uo, byN);
      return ids.has(d.oldBaseDoc) && ids.has(d.ruleDoc);
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
    const ok = cNew && cOld && cEdge;
    const okLenient = cNew && cOld && (cEdge || cLen);
    return { id: ev.id, kind: 'derived', cNew, cOld, cEdge, ok, okLenient };
  });
}

function auditLonNote(scen, hop, text) {
  if (!text || !String(text).trim()) return null;
  const issued = scen.docs.slice(0, hop).map((d) => d.id);
  try {
    const res = parseTurn(stripReplyLabels(String(text)), { issued, spec: '0.8', profile: 'lon', lang: 'en' });
    const diags = res.diagnostics ?? [];
    const codes = new Set(diags.map((d) => d.code));
    const clauses = res.message?.clauses ?? [];
    const linClauses = clauses.filter((c) => c.process?.kind === 'fix' || c.process?.kind === 'err');
    return {
      ok: Boolean(res.ok),
      nClauses: clauses.length,
      nLin: linClauses.length,
      hasE19: codes.has('E19'),
      hasE45: codes.has('E45'),
      hasW40: codes.has('W40'),
      hasW43: codes.has('W43'),
    };
  } catch {
    return { ok: false, nClauses: 0, nLin: 0, hasE19: false, hasE45: false, hasW40: false, hasW43: false };
  }
}

export function scoreNote(format, scen, hop, text) {
  const docs = Object.fromEntries(scen.docs.map((d) => [d.id, d]));
  const has = text != null && String(text).trim().length > 0;
  const std = has ? readNote(format, text, false) : { ok: false, spans: [], units: [] };
  const sal = has ? readNote(format, text, true) : std;
  const fst = has && format === 'lon' ? readNote(format, text, false, true) : std;
  const unnumbered = std.units.every((u) => u.n == null);

  const vAllSet = new Set();
  for (const p of scen.payloads.filter((x) => x.hop <= hop)) {
    if (has && verified(p, docs[p.doc], std.spans, false)) vAllSet.add(p.key);
  }

  const per = inForce(scen, hop).map((p) => {
    const v = has && vAllSet.has(p.key);
    const vUnambig = v && (unnumbered || unitsForPayload(p, std.units, true).some((u) => u.active));
    return {
      key: p.key, cls: p.cls, hazard: p.hazard, lag: hop - p.hop,
      v, vUnambig,
      vStrict: has && verified(p, docs[p.doc], std.spans, true),
      vSalv: has && verified(p, docs[p.doc], sal.spans, false),
      vFirst: has && verified(p, docs[p.doc], fst.spans, false),
      raw: has && rawSurvive(p, text),
    };
  });
  const vset = new Set(per.filter((x) => x.v).map((x) => x.key));
  const byN = new Map(std.units.filter((u) => Number.isFinite(u.n)).map((u) => [u.n, u]));
  const der = derivedAt(scen, hop).map((d) => ({
    key: d.key, revised: d.revised, present: has && hasNum(text, d.value),
    activeRevised: !d.revised ? null : std.units.some((u) => u.active && hasNum(u.text, d.value) && !hasNum(u.text, d.stale)),
    trail: trail(d, std.units, vset, 'std'),
    trailStrict: trail(d, std.units, vset, 'strict'),
    trailLenient: trail(d, std.units, vset, 'lenient'),
  }));
  const lin = scoreLineage(scen, hop, std, vAllSet, has);
  const lonAudit = format === 'lon' && has ? auditLonNote(scen, hop, text) : null;
  return { has, ok: std.ok, per, der, lin, lonAudit, chars: has ? String(text).length : 0 };
}

const stripQ = (a) => {
  let s = a.trim();
  for (let i = 0; i < 2; i++) {
    if (/^`[\s\S]*`$/.test(s) && s.length > 1) s = s.slice(1, -1).trim();
    if (/^["“][\s\S]*["”]$/.test(s) && s.length > 1) s = s.slice(1, -1).trim();
  }
  return s;
};

export function scoreReader(scen, text) {
  const ans = {};
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = line.match(/^\s*\**Q(\d+)\**\s*[:.]\s*(.*)$/);
    if (m && ans[m[1]] == null) ans[m[1]] = m[2];
  }
  return scen.questions.map((q) => {
    const a = ans[q.q], given = a != null;
    const eq = (x) => given && (norm(a) === norm(x) || norm(stripQ(a)) === norm(x) || norm(stripQ(a).replace(/^`|`$/g, '')) === norm(x));
    const missing = !given || /^\s*`?MISSING`?\s*$/i.test(a);
    if (q.kind === 'lineage') {
      if (q.subkind === 'derived') {
        const exact = given && hasNum(a, q.num);
        const wrongCurrent = !exact && given && q.wrongCurrentNum != null && hasNum(a, q.wrongCurrentNum);
        return { q: q.q, group: 'lineage', kind: 'lineage', cls: 'lineage_derived', exact, stale: false, wrongCurrent, contains: exact, missing };
      }
      const exact = eq(q.answer);
      const wrongCurrent = !exact && q.wrongCurrent != null && eq(q.wrongCurrent);
      return { q: q.q, group: 'lineage', kind: 'lineage', cls: 'lineage_raw', exact, stale: false, wrongCurrent, contains: given && norm(a).includes(norm(q.answer)), missing };
    }
    const exact = q.kind === 'derived' ? given && hasNum(a, q.num) : eq(q.answer);
    const stale = q.kind === 'derived' ? given && !hasNum(a, q.num) && hasNum(a, q.staleNum) : q.stale != null && eq(q.stale);
    return {
      q: q.q, group: 'current', kind: q.kind, cls: q.kind === 'derived' ? 'derived' : q.hazard,
      exact, stale, wrongCurrent: false,
      contains: q.kind === 'derived' ? exact : given && norm(a).includes(norm(q.answer)), missing,
    };
  });
}

// ---------- statistics ----------
function signFlip(d) {
  const n = d.length; if (!n) return NaN;
  const obs = Math.abs(d.reduce((a, b) => a + b, 0)), tot = 2 ** n;
  let ge = 0;
  for (let m = 0; m < tot; m++) { let s = 0; for (let i = 0; i < n; i++) s += (m >> i) & 1 ? d[i] : -d[i]; if (Math.abs(s) >= obs - 1e-12) ge++; }
  return ge / tot;
}
function bootCI(d) {
  const n = d.length; if (!n) return [NaN, NaN];
  const r = mulberry32(SEED), ms = [];
  for (let b = 0; b < BOOT; b++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(r() * n)]; ms.push(s / n); }
  ms.sort((a, b) => a - b);
  return [ms[Math.floor(0.025 * BOOT)], ms[Math.ceil(0.975 * BOOT) - 1]];
}
function holm(ps) {
  const s = [...ps].sort((a, b) => a.p - b.p), out = {}; let run = 0;
  s.forEach((x, i) => { run = Math.max(run, Math.min(1, x.p * (s.length - i))); out[x.k] = run; });
  return out;
}
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : 'n/a');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const tbl = (h, rows) => [`| ${h.join(' | ')} |`, `|${h.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

// ---------- CLI ----------
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const file = JSON.parse(readFileSync(opt('--sessions', 'data/sessions-e10.json'), 'utf8'));
const scens = file.scenarios;

if (flag('--selftest')) {
  let bad = 0;
  const check = (name, got, want) => { if (!Number.isFinite(got) || Math.abs(got - want) > 1e-9) { bad++; console.log(`FAIL ${name}: got ${got}, want ${want}`); } };
  for (const scen of scens) for (const format of FORMATS) for (let hop = 1; hop <= HOPS; hop++) {
    const txt = idealNote(format, scen, hop);
    const s = scoreNote(format, scen, hop, txt);
    check(`${scen.id} ${format} h${hop} V`, mean(s.per.map((x) => +x.v)), 1);
    check(`${scen.id} ${format} h${hop} Vunambig`, mean(s.per.map((x) => +x.vUnambig)), 1);
    check(`${scen.id} ${format} h${hop} Vstrict`, mean(s.per.map((x) => +x.vStrict)), 1);
    check(`${scen.id} ${format} h${hop} Vsalvage`, mean(s.per.map((x) => +x.vSalv)), 1);
    check(`${scen.id} ${format} h${hop} raw`, mean(s.per.map((x) => +x.raw)), 1);
    for (const d of s.der) {
      check(`${scen.id} ${format} h${hop} ${d.key} present`, +d.present, 1);
      check(`${scen.id} ${format} h${hop} ${d.key} trail`, +d.trail, 1);
      check(`${scen.id} ${format} h${hop} ${d.key} trailStrict`, +d.trailStrict, 1);
      if (d.revised) check(`${scen.id} ${format} h${hop} ${d.key} activeRevised`, +d.activeRevised, 1);
    }
    if (s.lin.length) {
      check(`${scen.id} ${format} h${hop} L`, mean(s.lin.map((x) => +x.ok)), 1);
      check(`${scen.id} ${format} h${hop} Llenient`, mean(s.lin.map((x) => +x.okLenient)), 1);
    }
    if (!s.ok) { bad++; console.log(`FAIL ${scen.id} ${format} h${hop} unparseable`); }
    if (format === 'lon') {
      if (!s.lonAudit?.ok || s.lonAudit.hasE19 || s.lonAudit.hasE45 || s.lonAudit.hasW40 || s.lonAudit.hasW43) {
        bad++; console.log(`FAIL ${scen.id} lon h${hop} parser audit`, s.lonAudit);
      }
      if (hop === HOPS) {
        const sh = scoreNote('lon', scen, hop, idealNote('lon', scen, hop, { shallowFence: true }));
        const lonHazV = mean(sh.per.filter((x) => x.hazard === 'lon').map((x) => +x.v));
        const fstV = mean(sh.per.filter((x) => x.hazard === 'lon').map((x) => +x.vFirst));
        if (!(lonHazV < 1)) { bad++; console.log(`FAIL ${scen.id} shallowFence lonB should fail standard V`); }
        if (!(fstV <= 0.5)) { bad++; console.log(`FAIL ${scen.id} shallowFence firstCloser should lose lon payloads`); }
      }
    }
    if (format === 'jsonchain') {
      const brokenText = idealNote('jsonchain', scen, hop, { rawBackslash: true }), b = scoreNote('jsonchain', scen, hop, brokenText);
      if (brokenText !== txt && jsonOf(brokenText) == null) {
        check(`${scen.id} jsonchain broken h${hop} V`, mean(b.per.map((x) => +x.v)), 0);
        check(`${scen.id} jsonchain broken h${hop} Vsalvage`, mean(b.per.map((x) => +x.vSalv)), 1);
      }
    }
  }
  for (const scen of scens) for (const format of FORMATS) {
    const sd = scoreNote(format, scen, HOPS, idealNote(format, scen, HOPS, { destructive: true }));
    check(`${scen.id} ${format} destructive V`, mean(sd.per.map((x) => +x.v)), 1);
    check(`${scen.id} ${format} destructive L`, mean(sd.lin.map((x) => +x.ok)), 0);
    const su = scoreNote(format, scen, HOPS, idealNote(format, scen, HOPS, { unlinkLineage: true }));
    check(`${scen.id} ${format} unlink V`, mean(su.per.map((x) => +x.v)), 1);
    check(`${scen.id} ${format} unlink L`, mean(su.lin.map((x) => +x.ok)), 0);
  }
  for (const scen of scens) {
    const r = scoreReader(scen, scen.questions.map((q) => `Q${q.q}: ${q.answer.replace(/\n/g, ' ')}`).join('\n'));
    check(`${scen.id} reader current ideal`, mean(r.filter((x) => x.group === 'current').map((x) => +x.exact)), 1);
    check(`${scen.id} reader lineage ideal`, mean(r.filter((x) => x.group === 'lineage').map((x) => +x.exact)), 1);
    const st = scoreReader(scen, scen.questions.map((q) => {
      if (q.group === 'lineage') return `Q${q.q}: ${q.wrongCurrent ?? q.wrongCurrentNum ?? 'MISSING'}`;
      return `Q${q.q}: ${q.kind === 'derived' ? q.staleNum : q.stale ?? 'MISSING'}`;
    }).join('\n'));
    check(`${scen.id} reader stale exact`, mean(st.map((x) => +x.exact)), 0);
    check(`${scen.id} reader current stale count`, st.filter((x) => x.stale).length, 4);
    check(`${scen.id} reader lineage wrongCurrent count`, st.filter((x) => x.wrongCurrent).length, 4);
  }
  console.log(bad ? `selftest: ${bad} FAILED` : `selftest: all checks passed (${scens.length} scenarios x ${FORMATS.length} formats x ${HOPS} hops)`);
  process.exit(bad ? 1 : 0);
}

const inputs = opt('--in', 'results/e10/e10-deepseek_on.jsonl,results/e10/e10-deepseek_off.jsonl,results/e10/e10-gemma4_on.jsonl,results/e10/e10-gemma4_off.jsonl,results/e10/e10-luna_on.jsonl,results/e10/e10-luna_off.jsonl').split(',').filter(Boolean);
const rows = inputs.flatMap((f) => { try { return readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } });
const scenIds = new Set(scens.map((s) => s.id));
const models = uniq(rows.filter((r) => scenIds.has(r.scen)).map((r) => r.model));

// session assembly: first non-error, non-empty row per hop is the note
const S = new Map();
for (const r of rows) {
  if (!scenIds.has(r.scen)) continue;
  if (!S.has(r.sid)) S.set(r.sid, { sid: r.sid, scen: r.scen, model: r.model, format: r.format, notes: {}, empties: {}, rows: [] });
  const s = S.get(r.sid); s.rows.push(r);
  if (r.error) continue;
  if (String(r.text ?? '').trim()) { if (s.notes[r.hop] == null) s.notes[r.hop] = r; }
  else s.empties[r.hop] = (s.empties[r.hop] ?? 0) + 1;
}
const scenOf = Object.fromEntries(scens.map((s) => [s.id, s]));
for (const s of S.values()) {
  const scen = scenOf[s.scen];
  s.complete = Array.from({ length: HOPS }, (_, i) => i + 1).every((h) => s.notes[h]);
  s.broken = !s.complete && Array.from({ length: HOPS }, (_, i) => i + 1).some((h) => !s.notes[h] && (s.empties[h] ?? 0) >= 3);
  s.settled = (s.complete && (s.notes[READER] || (s.empties[READER] ?? 0) >= 3)) || s.broken;
  s.hops = {};
  for (let h = 1; h <= HOPS; h++) s.hops[h] = scoreNote(s.format, scen, h, s.notes[h]?.text);
  s.final = s.hops[HOPS];
  s.reader = scoreReader(scen, s.notes[READER]?.text);
  const ok = s.rows.filter((r) => !r.error);
  s.usd = s.rows.reduce((a, r) => a + (r.usd ?? 0), 0);
  s.tin = ok.reduce((a, r) => a + (r.usage?.in ?? 0), 0); s.tout = ok.reduce((a, r) => a + (r.usage?.out ?? 0), 0); s.cached = ok.reduce((a, r) => a + (r.usage?.cached ?? 0), 0);
  s.cut = ok.filter((r) => /length|max/i.test(String(r.finish ?? ''))).length;
  s.nEmpty = ok.filter((r) => !String(r.text ?? '').trim()).length;
  s.nErr = s.rows.length - ok.length;
  s.ms = mean(ok.map((r) => r.ms ?? 0));
}
const get = (model, format, scen) => S.get(`${scen}|${model}|${format}`);
const settled = (model, format) => scens.map((sc) => get(model, format, sc.id)).filter((s) => s?.settled);

const L = (s, k = 'ok', f = () => true, hop = HOPS) => { const xs = s.hops[hop].lin.filter(f); return xs.length ? mean(xs.map((x) => +x[k])) : NaN; };
const V = (s, k = 'v', f = () => true) => { const xs = s.final.per.filter(f); return xs.length ? mean(xs.map((x) => +x[k])) : NaN; };

const contrastFn = (valFn) => (m, other, onlyComplete = false) => {
  const d = [];
  for (const sc of scens) {
    const a = get(m, 'lon', sc.id), b = get(m, other, sc.id);
    if (!a?.settled || !b?.settled || (onlyComplete && !(a.complete && b.complete))) continue;
    const x = valFn(a), y = valFn(b);
    if (Number.isFinite(x) && Number.isFinite(y)) d.push(x - y);
  }
  return { n: d.length, diff: mean(d), ci: bootCI(d), p: signFlip(d) };
};
const contrastL = (m, other, k = 'ok', pick = () => true, onlyComplete = false) => contrastFn((s) => L(s, k, pick))(m, other, onlyComplete);
const contrastV = (m, other, k = 'v', pick = () => true, onlyComplete = false) => contrastFn((s) => V(s, k, pick))(m, other, onlyComplete);

const out = [];
const P = (s = '') => out.push(s);
P('# E10 metrics (v2): non-destructive lineage and hand-over survival (8 hops + reader)');
P();
P(`Generated ${new Date().toISOString()} from ${inputs.join(', ')} (${rows.length} rows) and ${opt('--sessions', 'data/sessions-e10.json')} (${scens.length} scenarios).`);
P('Sessions are scored intention-to-treat: a session broken by three empty replies at one hop scores 0 from that hop on. Sessions that are not settled (stopped by errors or by the spend cap) are left out and counted below.');
P();
P('## 1. Run inventory');
P();
P(tbl(['model', 'format', 'settled', 'complete', 'broken', 'not settled', 'calls', 'empty replies', 'cut replies', 'error rows', 'unparseable notes (of hop notes)', 'USD'],
  models.flatMap((m) => FORMATS.map((f) => {
    const all = scens.map((sc) => get(m, f, sc.id)).filter(Boolean), st = all.filter((s) => s.settled);
    const notes = all.flatMap((s) => Object.values(s.hops).filter((h) => h.has));
    return [m, f, st.length, all.filter((s) => s.complete).length, all.filter((s) => s.broken).length, scens.length - st.length,
      all.reduce((a, s) => a + s.rows.length, 0), all.reduce((a, s) => a + s.nEmpty, 0), all.reduce((a, s) => a + s.cut, 0),
      all.reduce((a, s) => a + s.nErr, 0), `${notes.filter((h) => !h.ok).length} of ${notes.length}`, all.reduce((a, s) => a + s.usd, 0).toFixed(4)];
  }))));
P();

P('## 2. Primary endpoint: lineage auditability L at the final note (5 events)');
P();
P(tbl(['model', ...FORMATS], models.map((m) => [m, ...FORMATS.map((f) => f3(mean(settled(m, f).map((s) => L(s)))))])));
P();
const mainL = models.map((m) => ({ k: m, ...contrastL(m, 'jsonchain') })), adjL = holm(mainL.map((x) => ({ k: x.k, p: x.p })));
P('Main contrast (pre-registered primary): lon minus jsonchain on L, paired by scenario, exact two-sided sign-flip test, Holm across models, bootstrap 95% CI.');
P();
P(tbl(['model', 'n scenarios', 'lon minus jsonchain', '95% CI', 'p', 'p (Holm)'],
  mainL.map((x) => [x.k, x.n, f3(x.diff), `${f3(x.ci[0])} to ${f3(x.ci[1])}`, f3(x.p), f3(adjL[x.k])])));
P();
P('Secondary lineage contrasts (no multiplicity correction):');
P();
P(tbl(['model', 'contrast', 'n', 'difference', '95% CI', 'p'],
  models.flatMap((m) => ['json', 'natural'].map((o) => { const c = contrastL(m, o); return [m, `lon minus ${o}`, c.n, f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)]; }))));
P();
P('Lineage breakdown (final note) and sensitivity (lenient edge, complete sessions only, hops 5 to 8):');
P();
P(tbl(['model', 'format', 'active new verified', 'prior verified', 'explicit edge', 'amend (2)', 'withdraw (1)', 'derived (2)', 'L lenient', 'L complete only', 'hop 5', 'hop 6', 'hop 7', 'hop 8'],
  models.flatMap((m) => FORMATS.map((f) => {
    const st = settled(m, f), evs = st.flatMap((s) => s.final.lin);
    return [m, f, f3(share(evs, (e) => e.cNew)), f3(share(evs, (e) => e.cOld)), f3(share(evs, (e) => e.cEdge)),
      f3(share(evs.filter((e) => e.kind === 'amend'), (e) => e.ok)),
      f3(share(evs.filter((e) => e.kind === 'withdraw'), (e) => e.ok)),
      f3(share(evs.filter((e) => e.kind === 'derived'), (e) => e.ok)),
      f3(mean(st.map((s) => L(s, 'okLenient')))), f3(mean(st.filter((s) => s.complete).map((s) => L(s)))),
      ...[5, 6, 7, 8].map((hp) => f3(mean(st.map((s) => L(s, 'ok', () => true, hp)))))];
  }))));
P();

P('## 3. Co-reported endpoint: verifiable active survival V at the final note (14 in-force payloads)');
P();
P(tbl(['model', ...FORMATS], models.map((m) => [m, ...FORMATS.map((f) => f3(mean(settled(m, f).map((s) => V(s)))))])));
P();
const adjV = holm(models.map((m) => ({ k: m, ...contrastV(m, 'jsonchain') })));
P(tbl(['model', 'contrast', 'n', 'difference', '95% CI', 'p'],
  models.flatMap((m) => ['jsonchain', 'json', 'natural'].map((o) => { const c = contrastV(m, o); return [m, `lon minus ${o}`, c.n, f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)]; }))));
P();

P('## 4. V by payload class and kind (final note)');
P();
P('Active mix per scenario at the final note: 6 plain (4 figures and 2 ids), 6 JSON-hazard (quotes, backslash paths, JSON-like text, two-line value), 2 Lon-hazard (text containing `]>` without following whitespace in lonA, or `]>` followed by whitespace in lonB).');
P();
P(tbl(['model', 'format', 'plain', 'JSON-hazard', 'Lon-hazard'],
  models.flatMap((m) => FORMATS.map((f) => [m, f, ...['plain', 'json', 'lon'].map((h) => f3(mean(settled(m, f).map((s) => V(s, 'v', (x) => x.hazard === h)))))]))));
P();
P(tbl(['model', 'class', 'lon minus jsonchain', '95% CI', 'p'],
  models.flatMap((m) => ['plain', 'json', 'lon'].map((h) => { const c = contrastV(m, 'jsonchain', 'v', (x) => x.hazard === h); return [m, h, f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)]; }))));
P();
{
  const kinds = uniq(scens.flatMap((sc) => inForce(sc, HOPS).map((p) => p.cls)));
  P('V by active payload kind (descriptive):');
  P();
  P(tbl(['model', 'format', ...kinds], models.flatMap((m) => FORMATS.map((f) => [m, f, ...kinds.map((c) => f3(mean(settled(m, f).map((s) => V(s, 'v', (x) => x.cls === c)))))]))));
  P();
}

P('## 5. Sensitivity of V');
P();
P(tbl(['model', 'format', 'standard', 'unambiguous active', 'strict bytes', 'span-local salvage', 'first-closer fence', 'complete sessions only', 'raw survival', 'present but not verifiable'],
  models.flatMap((m) => FORMATS.map((f) => {
    const st = settled(m, f);
    return [m, f, f3(mean(st.map((s) => V(s)))), f3(mean(st.map((s) => V(s, 'vUnambig')))), f3(mean(st.map((s) => V(s, 'vStrict')))),
      f3(mean(st.map((s) => V(s, 'vSalv')))), f3(mean(st.map((s) => V(s, 'vFirst')))), f3(mean(st.filter((s) => s.complete).map((s) => V(s)))),
      f3(mean(st.map((s) => V(s, 'raw')))), f3(mean(st.map((s) => mean(s.final.per.map((x) => +(x.raw && !x.v))))))];
  }))));
P();
P(tbl(['model', 'variant', 'lon minus jsonchain', '95% CI', 'p'],
  models.flatMap((m) => [['unambiguous active', 'vUnambig', false], ['strict bytes', 'vStrict', false], ['span-local salvage', 'vSalv', false], ['first-closer fence', 'vFirst', false], ['complete sessions only', 'v', true], ['raw survival', 'raw', false]]
    .map(([name, k, oc]) => { const c = contrastV(m, 'jsonchain', k, () => true, oc); return [m, name, f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)]; }))));
P();

P('## 6. V over the chain');
P();
P(tbl(['model', 'format', ...Array.from({ length: HOPS }, (_, i) => `hop ${i + 1}`)],
  models.flatMap((m) => FORMATS.map((f) => [m, f, ...Array.from({ length: HOPS }, (_, i) => f3(mean(settled(m, f).map((s) => mean(s.hops[i + 1].per.map((x) => +x.v))))))]))));
P();
{
  const chainV = (s) => mean(Array.from({ length: HOPS }, (_, i) => mean(s.hops[i + 1].per.map((x) => +x.v))));
  P(tbl(['model', ...FORMATS, 'lon minus jsonchain', '95% CI', 'p'], models.map((m) => {
    const c = contrastFn(chainV)(m, 'jsonchain');
    return [m, ...FORMATS.map((f) => f3(mean(settled(m, f).map(chainV)))), f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)];
  })));
}
P();
P('V by lag (hops since payload entered the chain; all hops pooled):');
P();
P(tbl(['model', 'format', ...Array.from({ length: HOPS }, (_, i) => `lag ${i}`)],
  models.flatMap((m) => FORMATS.map((f) => {
    const xs = settled(m, f).flatMap((s) => Object.values(s.hops).flatMap((h) => h.per));
    return [m, f, ...Array.from({ length: HOPS }, (_, i) => f3(share(xs.filter((x) => x.lag === i), (x) => x.v)))];
  }))));
P();

P('## 7. Derived values (final note)');
P();
P(tbl(['model', 'format', 'new value present', 'active revised (unmasked active unit)', 'audit trail', 'audit trail, strict', 'audit trail, lenient'],
  models.flatMap((m) => FORMATS.map((f) => {
    const ds = settled(m, f).flatMap((s) => s.final.der);
    return [m, f, f3(share(ds, (d) => d.present)), f3(share(ds.filter((d) => d.revised), (d) => d.activeRevised)),
      f3(share(ds, (d) => d.trail)), f3(share(ds, (d) => d.trailStrict)), f3(share(ds, (d) => d.trailLenient))];
  }))));
P();

P('## 8. Reader (one call on the final note, 20 questions: 16 current and 4 lineage)');
P();
P('Current-state questions (16 per session):');
P();
P(tbl(['model', 'format', 'current exact', 'plain', 'JSON-hazard', 'Lon-hazard', 'derived', 'contains', 'stale confusion per session', 'missing per session'],
  models.flatMap((m) => FORMATS.map((f) => {
    const st = settled(m, f), cur = st.flatMap((s) => s.reader.filter((q) => q.group === 'current'));
    return [m, f, f3(share(cur, (q) => q.exact)), ...['plain', 'json', 'lon', 'derived'].map((c) => f3(share(cur.filter((q) => q.cls === c), (q) => q.exact))),
      f3(share(cur, (q) => q.contains)), f2(mean(st.map((s) => s.reader.filter((q) => q.stale).length))),
      f2(mean(st.map((s) => s.reader.filter((q) => q.group === 'current' && q.missing).length)))];
  }))));
P();
P('Lineage-history questions (4 per session: earlier value before revision or withdrawal, plus overall 20-question exact):');
P();
P(tbl(['model', 'format', 'overall exact (20)', 'lineage exact (4)', 'lineage raw (3)', 'lineage derived (1)', 'current-value confusion per session', 'lineage missing per session'],
  models.flatMap((m) => FORMATS.map((f) => {
    const st = settled(m, f), allq = st.flatMap((s) => s.reader), linq = st.flatMap((s) => s.reader.filter((q) => q.group === 'lineage'));
    return [m, f, f3(share(allq, (q) => q.exact)), f3(share(linq, (q) => q.exact)),
      f3(share(linq.filter((q) => q.cls === 'lineage_raw'), (q) => q.exact)),
      f3(share(linq.filter((q) => q.cls === 'lineage_derived'), (q) => q.exact)),
      f2(mean(st.map((s) => s.reader.filter((q) => q.wrongCurrent).length))),
      f2(mean(st.map((s) => s.reader.filter((q) => q.group === 'lineage' && q.missing).length)))];
  }))));
P();
P('Reader lineage contrasts (lon minus other on the 4 lineage questions):');
P();
P(tbl(['model', 'contrast', 'n', 'difference', '95% CI', 'p'],
  models.flatMap((m) => ['jsonchain', 'json', 'natural'].map((o) => {
    const c = contrastFn((s) => mean(s.reader.filter((q) => q.group === 'lineage').map((q) => +q.exact)))(m, o);
    return [m, `lon minus ${o}`, c.n, f3(c.diff), `${f3(c.ci[0])} to ${f3(c.ci[1])}`, f3(c.p)];
  }))));
P();

P('## 9. Lon reference parser static audit (gyeol ea35b6b, descriptive)');
P();
P(tbl(['model', 'lon hop notes', 'parser ok', 'hop 8 mean clauses', 'hop 8 fix/err clauses', 'notes with E19', 'notes with E45', 'notes with W40', 'notes with W43'],
  models.map((m) => {
    const st = settled(m, 'lon');
    const audits = st.flatMap((s) => Object.values(s.hops).map((h) => h.lonAudit).filter(Boolean));
    const h8 = st.map((s) => s.final.lonAudit).filter(Boolean);
    return [m, audits.length, f3(share(audits, (a) => a.ok)), f2(mean(h8.map((a) => a.nClauses))), f2(mean(h8.map((a) => a.nLin))),
      audits.filter((a) => a.hasE19).length, audits.filter((a) => a.hasE45).length, audits.filter((a) => a.hasW40).length, audits.filter((a) => a.hasW43).length];
  })));
P();

P('## 10. Size and cost per session');
P();
P(tbl(['model', 'format', 'final note chars', 'completion tokens', 'input tokens', 'cached input share', 'USD', 'mean s per call'],
  models.flatMap((m) => FORMATS.map((f) => {
    const st = settled(m, f);
    const tin = mean(st.map((s) => s.tin)), ca = mean(st.map((s) => s.cached));
    return [m, f, Math.round(mean(st.filter((s) => s.final.has).map((s) => s.final.chars))) || 'n/a',
      Math.round(mean(st.map((s) => s.tout))) || 'n/a', Math.round(tin) || 'n/a', tin ? `${(100 * ca / tin).toFixed(0)}%` : 'n/a',
      f3(mean(st.map((s) => s.usd))), f2(mean(st.map((s) => s.ms)) / 1000)];
  }))));
P();
const bases = uniq(models.filter((m) => m.endsWith('_on')).map((m) => m.slice(0, -3)).filter((b) => models.includes(`${b}_off`)));
if (bases.length) {
  P('## 11. Reasoning effect: on (low) minus off within each model (paired by scenario)');
  P();
  const pairDiff = (b, f, valFn) => {
    const d = [], xs = [], ys = [];
    for (const sc of scens) {
      const a = get(`${b}_on`, f, sc.id), c = get(`${b}_off`, f, sc.id);
      if (!a?.settled || !c?.settled) continue;
      const x = valFn(a), y = valFn(c);
      if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); d.push(x - y); }
    }
    return { n: d.length, on: mean(xs), off: mean(ys), diff: mean(d), ci: bootCI(d), p: signFlip(d) };
  };
  P(tbl(['model', 'format', 'n', 'L (on)', 'L (off)', 'on minus off (L)', '95% CI (L)', 'p (L)', 'V (on)', 'V (off)', 'on minus off (V)', '95% CI (V)', 'p (V)'],
    bases.flatMap((b) => FORMATS.map((f) => {
      const cl = pairDiff(b, f, (s) => L(s)), cv = pairDiff(b, f, (s) => V(s));
      return [b, f, cl.n, f3(cl.on), f3(cl.off), f3(cl.diff), `${f3(cl.ci[0])} to ${f3(cl.ci[1])}`, f3(cl.p),
        f3(cv.on), f3(cv.off), f3(cv.diff), `${f3(cv.ci[0])} to ${f3(cv.ci[1])}`, f3(cv.p)];
    }))));
  P();
}
P(`Total spend in these files: ${rows.reduce((a, r) => a + (r.usd ?? 0), 0).toFixed(4)} USD.`);

const md = out.join('\n') + '\n';
const dest = opt('--out', '');
if (dest) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, md); console.log(`wrote ${dest}`); } else process.stdout.write(md);
}
