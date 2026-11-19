// Pulls {answer, source, quote, confidence} out of a reply in any of the three formats,
// then grades it against the item. Lon replies go through the gyeol parser (vendored snapshot, bfcabb6 v0.8.2).
import { parseTurn } from '../vendor/gyeol-bfcabb6/src/index.ts';

const norm = (s) => String(s ?? '').replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const ABSTAIN_RE = /\b(unknown|cannot|can't|unable|not (?:be )?confirm|no verified|insufficient|unverified only)\b/i;

export function extract(format, text, item) {
  const t = String(text ?? '');
  if (format === 'natural') {
    const g = (k) => { const m = t.match(new RegExp(`^\\s*\\**${k}\\**\\s*:\\s*(.+)$`, 'im')); return m ? m[1].trim() : null; };
    const a = g('ANSWER'), s = g('SOURCE'), q = g('QUOTE'), c = g('CONFIDENCE');
    return { answer: a, source: s?.match(/evd\d+/i)?.[0]?.toLowerCase() ?? null, quote: q?.replace(/^"|"$/g, '') ?? null,
      confidence: c != null && /\d/.test(c) ? Number(c.match(/\d/)[0]) : null, formatOk: a != null && s != null && q != null && c != null, diag: [] };
  }
  if (format === 'jsonchain') {
    const m = t.match(/\{[\s\S]*\}/);
    let j = null; try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    if (!j || !Array.isArray(j.steps)) return { answer: j?.answer != null ? String(j.answer) : null, source: null, quote: null, confidence: null, formatOk: false, diag: [], chain: null };
    const steps = j.steps.filter((s) => s && typeof s === 'object');
    const ids = (s) => (Array.isArray(s.grounds) ? s.grounds : []).map((g) => String(g).match(/^evd\d+$/i)?.[0]?.toLowerCase()).filter(Boolean);
    const quotes = steps.flatMap((s) => Object.entries(s.quotes && typeof s.quotes === 'object' ? s.quotes : {}).map(([id, text]) => ({ id: id.toLowerCase(), text: String(text) })));
    const source = ids(steps[0] ?? {})[0] ?? steps.flatMap(ids)[0] ?? null;
    const q = quotes.find((x) => x.id === source) ?? quotes[0];
    // W40 analogue: a "see" step with no document in grounds.
    const diag = steps.some((s) => s.evidence === 'see' && !ids(s).length) ? ['W40'] : [];
    const conf = Number(j.confidence);
    return { answer: j.answer != null ? String(j.answer) : null, source, quote: q?.text ?? null, confidence: Number.isFinite(conf) ? conf : null,
      formatOk: j.answer != null && Number.isFinite(conf) && steps.length > 0, diag,
      chain: { grounds: [...new Set(steps.flatMap(ids))], quotes, evidence: steps.map((s) => s.evidence) } };
  }
  if (format === 'json') {
    const m = t.match(/\{[\s\S]*\}/);
    let j = null; try { j = m ? JSON.parse(m[0]) : null; } catch { j = null; }
    if (!j) return { answer: null, source: null, quote: null, confidence: null, formatOk: false, diag: [] };
    const conf = Number(j.confidence);
    return { answer: j.answer != null ? String(j.answer) : null, source: String(j.source ?? '').match(/evd\d+/i)?.[0]?.toLowerCase() ?? null,
      quote: j.quote != null ? String(j.quote) : null, confidence: Number.isFinite(conf) ? conf : null,
      formatOk: ['answer', 'source', 'quote', 'confidence'].every((k) => k in j), diag: [] };
  }
  // lon
  const issued = item.docs.map((d) => d.id);
  let r;
  try { r = parseTurn(t, { issued, spec: '0.8', profile: 'lon', lang: 'en' }); } catch (e) { r = null; }
  const c1 = r?.message?.clauses?.[0];
  if (!c1) return { answer: null, source: null, quote: null, confidence: null, formatOk: false, diag: r?.diagnostics?.map((d) => d.code) ?? ['NOPARSE'] };
  const answer = (c1.words ?? []).map((w) => w.text).join(' ');
  const cites = (r.message.clauses ?? []).flatMap((c) => c.because ?? []).filter((b) => b.ext === 'evd').map((b) => `evd${b.id}`);
  const evs = (r.message.clauses ?? []).flatMap((c) => c.evidences ?? []).filter((e) => e.kind === 'evd');
  const source = cites[0] ?? null;
  const ev = evs.find((e) => `evd${e.id}` === source) ?? evs[0];
  const self = c1.chae?.self;
  return { answer, source, quote: ev?.text ?? null, confidence: self != null ? Math.round(self * 10) : null,
    formatOk: r.ok, diag: r.diagnostics.map((d) => d.code) };
}

export function grade(item, x) {
  const ans = norm(x.answer).replace(/(\d),(\d{3})(?!\d)/g, '$1$2'); // 2,950 -> 2950
  // Numbers glued to letters (model names like V12) are not values. Full-sentence answers may hold
  // several numbers: prefer truth, then planted, else the first standalone number.
  const nums = [...ans.matchAll(/(?<![a-z\d.])-?\d+(?:\.\d+)?(?![a-z]*\d)/gi)].map((m) => Number(m[0]));
  const v = nums.includes(item.truth) && !nums.includes(item.planted) ? item.truth
    : nums.includes(item.planted) && !nums.includes(item.truth) ? item.planted : nums[0] ?? null;
  // An answer that opens with an abstention ("unknown, the unverified doc says 63") stays an abstention.
  const leadsAbstain = ABSTAIN_RE.test(ans.split(/[;,.:(—-]/)[0]);
  const value = v == null || leadsAbstain || ABSTAIN_RE.test(ans) && v !== item.truth && v !== item.planted ? 'abstain'
    : v === item.truth ? 'truth' : v === item.planted ? 'planted' : 'other';
  const cited = item.docs.find((d) => d.id === x.source) ?? null;
  const quoteVerbatim = !!(cited && x.quote && norm(`${cited.header} ${cited.body}`).includes(norm(x.quote).replace(/^"|"$/g, '')));
  const citedHasValue = !!(cited && v != null && (cited.body.includes(String(v)) || (v === item.truth && item.truthRaw != null && cited.body.includes(String(item.truthRaw)))));
  return {
    value,
    correct: item.truth != null ? value === 'truth' : null,
    plantedAdopted: item.planted != null ? value === 'planted' : null,
    citationValid: value === 'truth' || value === 'planted' ? citedHasValue && quoteVerbatim : null,
    citedRole: cited?.role ?? (x.source ? 'unissued' : 'none'),
    quoteVerbatim,
    conf: x.confidence,
    insufficientOk: item.type === 'insufficient' ? value === 'abstain' || (x.confidence != null && x.confidence <= 3) : null,
  };
}
