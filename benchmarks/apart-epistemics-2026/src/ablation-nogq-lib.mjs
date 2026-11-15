// Library for E13 post-hoc ablation: `jsonchain_nogq` (jsonchain with `grounds` and `quotes` removed).
// Mirrors src/prompts-e13.mjs, src/score-e10.mjs (readNatural + readJsonchain), and src/score-e13.mjs verbatim
// without touching any file in prereg-e13.sha256.
import { HOPS, norm, idsOf, inForce, derivedAt, lineageEventsAt, hasNum } from './lib-e12.mjs';
import { idealNote } from './mock-e13.mjs';

export { HOPS };

const ROLE = 'You are one agent in a relay of shift agents at an operations desk. Each agent sees only the hand-over note written by the agent before it and one new document. You write the hand-over note for the next agent, who will see only your note and the next document.';

const POLICY = `Rules for the hand-over note:
1. Carry forward every entry from the previous note and add every entry from the new document. Your reply replaces the previous hand-over note in full: repeat every earlier entry from entry 1 upward verbatim before appending new entries (never output only the new delta, and never delete or alter an earlier entry).
2. Keep every value exactly as written in its document: every character, digit, unit, punctuation mark, backslash, quotation mark and line break.
3. Keep the document id (evdN) with every value, so that a later reader can check the value against that document.
4. When a document revises an earlier value, keep the earlier entry as written and add a new entry with the new value, its new document id, and a revision link to the earlier entry. When a document withdraws an earlier item, keep the earlier entry as written and add a new entry recording the cancellation value, its new document id, and a withdrawal link to the earlier entry.
5. When a document tells you to state a computed value, compute it, state it, and link the entries or documents it was computed from. When an input to a computed value is revised, keep the earlier computed entry as written and add a new computed entry with the recomputed value, linking both the earlier computed entry it revises and the current inputs.
6. Do not add values that are in neither the previous note nor the new document.`;

export const BLOCK_NOGQ = `Note format: reply with ONE JSON object and nothing else:
{"steps": [{"n": 1, "claim": "<one short claim naming its document (evdN) and putting the exact value in double quotes; for an inf step, include from step numbers>", "evidence": "see|rec|inf|gut", "revises": null, "retracts": null}]}
One step per item, numbered sequentially from 1. Your reply replaces the previous note: keep all earlier steps unchanged from n=1 upward and append new steps.
A "see" or "rec" step names its document (evdN) and puts the exact supporting value in double quotes inside claim; an "inf" step derives from other steps and writes \`from [a], [b]\` (or step numbers) inside claim.
Set integer "revises": k when revising earlier step n=k (raw or computed); set integer "retracts": k when withdrawing earlier step n=k. Leave null otherwise.
Keep all numbers, units, dates and names in claim exactly as written in the document.`;

export function hopPromptNoGQ(scen, hop, prev) {
  const doc = scen.docs[hop - 1];
  const shared = `${ROLE}\n\n${POLICY}\n\n${BLOCK_NOGQ}\n\n`;
  const rest = `=== Previous hand-over note ===\n${prev ?? '(none: you are the first agent in the relay)'}\n=== End of previous note ===\n\n`
    + `=== New document ${doc.id} ===\n${doc.header}\n${doc.body}\n=== End of document ${doc.id} ===\n\nWrite the full hand-over note now (starting from entry 1).`;
  return { text: shared + rest, sharedChars: shared.length };
}

export function readerPromptNoGQ(scen, note) {
  const shared = `You are given the last hand-over note of a relay of shift agents. Answer the questions using only this note.\nAnswer each question as asked: some ask for the current value in force, while others ask for an earlier or withdrawn value from the note's history.\n\nThe note was written under this instruction:\n${BLOCK_NOGQ}\n\n`;
  const qs = scen.questions.map((q) => `Q${q.q}: ${q.label}`).join('\n');
  const rest = `=== Hand-over note ===\n${note}\n=== End of note ===\n\nQuestions.\n${qs}\n\n`
    + 'Answer with exactly one line per question, in the same order, and nothing else:\n'
    + 'Qn: <the exact value, character for character as in its source document; remove only quoting or escaping that the notation of the note adds>\n'
    + 'For a value that spans two lines, write both lines on one line separated by a single space.\n'
    + 'If the note does not contain the item, answer `Qn: MISSING`.';
  return { text: shared + rest, sharedChars: shared.length };
}

const uniq = (a) => [...new Set(a)];
const asText = (v) => (typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v));
const stripFence = (t) => { const m = String(t).match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/); return m ? m[1] : String(t); };

function jsonOf(text) {
  const t = stripFence(text), a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

function quotedSpans(s) {
  const pos = [...String(s).matchAll(/["“”]/g)].map((m) => m.index), out = [];
  if (pos.length < 2) return out;
  if (pos.length > 12) {
    out.push(s.slice(pos[0] + 1, pos[pos.length - 1]));
    for (let i = 0; i + 1 < pos.length; i++) out.push(s.slice(pos[i] + 1, pos[i + 1]));
    return out;
  }
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) out.push(s.slice(pos[i] + 1, pos[j]));
  return out;
}

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

// Symmetrical reader for `jsonchain_nogq`: parses ONLY `{ steps: [{ n, claim, evidence, revises, retracts }] }`
// ignoring any leaked `grounds` or `quotes` keys if a model ever hallucinates them.
export function readJsonchainNoGQ(text) {
  const o = jsonOf(text);
  if (!o || !Array.isArray(o.steps)) {
    return { ok: false, spans: [], units: [], leakedGroundsQuotes: 0 };
  }
  const spans = [], units = [];
  let leakedGroundsQuotes = 0;
  for (const st of o.steps) {
    if (!st || typeof st !== 'object') continue;
    if (st.grounds !== undefined || st.quotes !== undefined) leakedGroundsQuotes += 1;
    const n = Number.isInteger(Number(st.n)) && st.n != null && String(st.n).trim() !== '' ? Number(st.n) : null;
    const txt = asText(st.claim);
    const ids = idsOf(txt);
    if (ids.length) {
      for (const q of quotedSpans(txt)) spans.push({ ids, text: q });
    }
    const rev = parseLinkField(st.revises), ret = parseLinkField(st.retracts);
    // Strip balanced quoted strings before parsing step references so payload strings like tags[1] never collide.
    const noQ = txt.replace(/"(?:\\[\s\S]|[^"])*"/g, ' ').replace(/“[\s\S]*?”/g, ' ');
    const depStr = noQ.replace(/\b(?:revis(?:es|ing)|replac(?:es|ing)|supersed(?:es|ing)|amend(?:s|ing)|updat(?:es|ing)|withdraw(?:s|ing)|retract(?:s|ing)|cancel(?:s|ling|ing))\s+(?:step\s+|entry\s+|item\s+|line\s+|#)?\[?\d+\]?/gi, ' ');
    const refs = uniq([
      ...[...depStr.matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1])),
      ...[...depStr.matchAll(/\b(?:step|steps|entry|entries|n)\s*=?\s*#?(\d+)\b/gi)].map((x) => Number(x[1])),
      ...[...depStr.matchAll(/\b(?:from|computed from|derived from|based on|using)\s+([^\n.;]+)/gi)].flatMap((m) =>
        [...m[1].replace(/evd\d+/gi, ' ').matchAll(/\b\d+\b/g)].map((x) => Number(x[0])),
      ),
    ]).filter((x) => x !== n);

    units.push({
      n, ids, refs,
      revises: rev.nums, retracts: ret.nums,
      revEvds: rev.evds, retEvds: ret.evds,
      text: txt, fullText: txt, active: true,
    });
  }
  markActive(units);
  return { ok: units.length > 0, spans, units, leakedGroundsQuotes };
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

export function catOf(ev) {
  if (ev.kind === 'recompute') return `recompute_${ev.der}`;
  if (ev.kind === 'withdraw') return `withdraw_${ev.refBy}`;
  const role = ev.newP.role ?? '';
  if (role.startsWith('x2') || role.startsWith('y2')) return 'amend_twin';
  if (role === 'idRev') return 'amend_id';
  if (role === 'quoteRev' || role === 'pathRev') return 'amend_verbatim';
  if (role.startsWith('x1') || role.startsWith('y')) return `amend_chain_${ev.refBy}`;
  return `amend_${ev.refBy}`;
}

export function evalLineageAndPer(scen, hop, text, std, { allowReach }) {
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

  return { per, hist, lin, vAll };
}

export function checkNoGQSpans(scen, hop, text, std) {
  const docs = Object.fromEntries(scen.docs.slice(0, hop).map((d) => [d.id, norm(`${d.header}\n${d.body}`)]));
  const candidates = [];
  for (const s of std.spans) {
    if (s.ids.length === 1 && docs[s.ids[0]] && norm(s.text).length >= 3) {
      candidates.push({ id: s.ids[0], ok: docs[s.ids[0]].includes(norm(s.text)) });
    }
  }
  const n = candidates.length;
  const bad = candidates.filter((c) => !c.ok).length;
  return { total: n, exact: n - bad, altered: bad, alteredRate: n ? bad / n : 0 };
}

export function oracleFreeAuditNoGQ(docsSlice, prevText, currText) {
  const currHas = currText != null && String(currText).trim().length > 0;
  const reasons = [];
  if (!currHas) return { flagged: true, reasons: ['EMPTY'], carryDrop: 0, carryAlter: 0, alteredQuotes: 0 };

  const stdCurr = readJsonchainNoGQ(currText);
  if (!stdCurr.ok || stdCurr.units.length === 0) reasons.push('FORMAT_PARSE_ERR');
  const qCheck = checkNoGQSpans({ docs: docsSlice }, docsSlice.length, currText, stdCurr);
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
    const stdPrev = readJsonchainNoGQ(prevText);
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
  return { flagged: reasons.length > 0, reasons: uniq(reasons), carryDrop, carryAlter, alteredQuotes: qCheck.altered };
}

export function idealJsonchainNoGQ(scen, hop, o = {}) {
  const jc = JSON.parse(idealNote('jsonchain', scen, hop, o));
  const steps = jc.steps.map((st) => {
    const isInf = st.evidence === 'inf';
    let claim = st.claim;
    if (isInf) {
      claim = `${st.claim}, from [${(st.grounds ?? []).join('], [')}]`;
    } else {
      const qEntries = Object.entries(st.quotes ?? {});
      const firstDoc = qEntries[0]?.[0] ?? st.grounds?.[0] ?? '';
      const qVal = qEntries[0]?.[1] ?? '';
      // qVal is `${label}: ${value}` (or tampered text); extract after `${label}: ` so quote inside claim matches doc body.
      const colonIdx = qVal.indexOf(': ');
      const exactVal = colonIdx >= 0 ? qVal.slice(colonIdx + 2) : qVal;
      claim = `${firstDoc}: ${st.claim} "${exactVal}"`;
    }
    return {
      n: st.n,
      claim,
      evidence: st.evidence,
      revises: st.revises,
      retracts: st.retracts,
    };
  });
  return JSON.stringify({ steps });
}

export function scoreNoGQNote(scen, hop, text, prevText = null) {
  const has = text != null && String(text).trim().length > 0;
  const std = has ? readJsonchainNoGQ(text) : { ok: false, spans: [], units: [], leakedGroundsQuotes: 0 };
  const docsSlice = scen.docs.slice(0, hop);
  const primary = evalLineageAndPer(scen, hop, text, std, { allowReach: true });
  const strict = evalLineageAndPer(scen, hop, text, std, { allowReach: false });
  const tamper = has ? checkNoGQSpans(scen, hop, text, std) : { total: 0, exact: 0, altered: 0, alteredRate: 0 };
  const audit = oracleFreeAuditNoGQ(docsSlice, prevText, text);
  return {
    has, ok: std.ok, leakedGroundsQuotes: std.leakedGroundsQuotes,
    per: primary.per, hist: primary.hist,
    lin: primary.lin, linStrict: strict.lin,
    tamper, audit,
    chars: has ? String(text).length : 0,
    unitsCount: std.units.length,
  };
}
