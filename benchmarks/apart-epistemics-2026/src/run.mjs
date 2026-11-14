// Experiment 1 runner. Dependency-free. Talks to the local proxy (worker/, `wrangler dev`).
//   node src/run.mjs --estimate              cost estimate only, no calls
//   node src/run.mjs --mock                  fake responses, exercises the whole pipeline at $0
//   node src/run.mjs --probe                 1 call per model (checks reasoning_effort and response shape)
//   node src/run.mjs                         full run over --items x --formats x --models
// E5 (held-out, pre-registered in prereg-e5-e6.md): --items data/items-e5.json --models haiku,luna,deepseek,glm53flash --effort-by deepseek=none,glm53flash=low --formats natural,json,jsonchain,lon --out results/e5.jsonl
// Options: --no-cache  --items data/items.json  --types conflict,recency,control,insufficient  --models haiku,luna,deepseek,glm53flash  --per-type N (first N items of each type)  --formats natural,json,lon  --limit N  --concurrency 4  --out results/run-main.jsonl
// Resumable: rows already present in --out are skipped. No retries on format failures (first-try only).
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildPrompt, FORMATS } from './prompts.mjs';
import { MODELS, costUsd } from './cost.mjs';
import { withCache } from './cache.mjs';
import { extractText, usageOf, neuronsOf, finishOf } from '../vendor/gyeol-bfcabb6/harness/src/extract.js';

const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };

const PROXY = opt('--proxy', 'http://127.0.0.1:8787');
const EFFORT = opt('--effort', 'medium');
// Per-model reasoning effort, e.g. --effort-by deepseek=none,glm53flash=low (E5: set from the smoke test so every model finishes inside max_tokens).
const EFFORT_BY = Object.fromEntries(opt('--effort-by', '').split(',').filter(Boolean).map((kv) => kv.split('=')));
const effortOf = (m) => EFFORT_BY[m] ?? EFFORT;
const MAX_TOKENS = Number(opt('--max-tokens', 4000));
const models = opt('--models', 'haiku,luna,particle,m3,qwenplus').split(',');
const perType = Number(opt('--per-type', 0));
const formats = opt('--formats', FORMATS.join(',')).split(',');
const limit = Number(opt('--limit', 0));
const conc = Number(opt('--concurrency', 4));
const mock = flag('--mock');
const noCache = flag('--no-cache'); // send plain prompts without cache hints
const probe = flag('--probe');
const out = opt('--out', mock ? 'results/run-mock.jsonl' : probe ? 'results/probe.jsonl' : 'results/run-main.jsonl');

const itemsPath = opt('--items', 'data/items.json');
const { items: all } = JSON.parse(readFileSync(new URL(`../${itemsPath}`, import.meta.url), 'utf8'));
const types = opt('--types', 'conflict,recency,control,insufficient').split(',');
let items = limit ? all.slice(0, limit) : all;
items = items.filter((i) => types.includes(i.type));
if (perType) { // first N of each (level, type) group
  const seen = {};
  items = items.filter((i) => ((seen[`${i.level ?? 0}|${i.type}`] = (seen[`${i.level ?? 0}|${i.type}`] ?? 0) + 1) <= perType));
}
if (probe) items = [all.find((i) => i.type === 'conflict')];

const jobs = [];
for (const m of models) for (const f of probe ? ['lon'] : formats) for (const it of items) jobs.push({ m, f, it, key: `${it.id}|${m}|${f}` });

// ---------- estimate ----------
if (flag('--estimate')) {
  const EXP_OUT = Number(opt('--expected-out', 1200));
  let rows = [];
  for (const m of models) {
    let tin = 0, shared = 0, n = 0;
    for (const f of formats) for (const it of items) {
      const p = buildPrompt(f, it); tin += p.text.length / 4; shared += p.sharedChars / 4; n += 1;
    }
    const cacheShare = shared / tin;
    const exp = costUsd(m, { tin, tout: n * EXP_OUT, cached: 0 });
    const expCached = costUsd(m, { tin, tout: n * EXP_OUT, cached: shared * 0.9 });
    const cap = costUsd(m, { tin, tout: n * MAX_TOKENS, cached: 0 });
    rows.push({ model: MODELS[m].label, calls: n, inTok: Math.round(tin), cacheableShare: `${Math.round(cacheShare * 100)}%`,
      expectedUsd: exp.toFixed(3), expectedIfCacheHitsUsd: expCached.toFixed(3), worstCaseUsd: cap.toFixed(3) });
  }
  console.table(rows);
  const sum = (k) => rows.reduce((a, r) => a + Number(r[k]), 0).toFixed(3);
  console.log(`total expected ${sum('expectedUsd')} USD (no cache) / ${sum('expectedIfCacheHitsUsd')} USD (prefix cache hits) / worst case ${sum('worstCaseUsd')} USD`);
  console.log(`assumes ${EXP_OUT} output tokens per call incl. reasoning; worst case = every call hits max_tokens ${MAX_TOKENS}; tokens ~ chars/4`);
  process.exit(0);
}

// ---------- mock ----------
function mockRaw(f, it, salt) {
  const r = ((salt * 9301 + 49297) % 233280) / 233280;
  const ver = it.docs.find((d) => d.role === 'verified');
  const pla = it.docs.find((d) => d.role === 'planted');
  const usePlanted = pla && (r < 0.25 || !ver);
  const abstain = !ver && r < 0.6;
  const d = abstain ? null : usePlanted ? pla : ver;
  const val = abstain ? 'UNKNOWN' : `${usePlanted ? it.planted : it.truth} ${it.unit}`;
  const conf = abstain ? 2 : usePlanted ? 6 : 8;
  let text;
  if (f === 'natural') text = `Based on the records:\nANSWER: ${val}\nSOURCE: ${d?.id ?? 'NONE'}\nQUOTE: "${d?.body ?? ''}"\nCONFIDENCE: ${conf}`;
  else if (f === 'json') text = JSON.stringify({ answer: val, source: d?.id ?? 'NONE', quote: d?.body ?? '', confidence: conf });
  else if (f === 'jsonchain') text = JSON.stringify({ answer: val, confidence: conf, steps: [{ n: 1, claim: val, evidence: d ? 'see' : 'inf', grounds: d ? [d.id] : [], quotes: d ? { [d.id]: d.body } : {} }] });
  else text = d ? `lon: <1 · [see,say] ${val} *G${conf}↓${d.id}> ${d.id} <[${d.body}]>` : `lon: <1 · [inf,say] unknown, no verified record *B${conf}>`;
  if (r > 0.95 && f === 'lon') text = `lon: <1 · [see,say] ${val} *G${conf}>`; // unsourced see -> W40
  return { choices: [{ message: { content: text }, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 700 } };
}

async function callProxy(model, input) {
  const res = await fetch(PROXY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model, input }) });
  const j = await res.json().catch(() => ({ error: `bad proxy response ${res.status}` }));
  if (!res.ok || j.error) throw new Error(j.error ?? `HTTP ${res.status}`);
  return j;
}

// ---------- run ----------
mkdirSync(dirname(out), { recursive: true });
const done = new Set(existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).key) : []);
const todo = jobs.filter((j) => !done.has(j.key));
console.log(`${mock ? 'MOCK ' : probe ? 'PROBE ' : ''}${todo.length} calls to do (${done.size} already in ${out}), effort=${EFFORT}${Object.keys(EFFORT_BY).length ? ' ' + JSON.stringify(EFFORT_BY) : ''}, max_tokens=${MAX_TOKENS}`);

let spent = 0, idx = 0, n = 0;
async function worker() {
  while (idx < todo.length) {
    const j = todo[idx++];
    const p = buildPrompt(j.f, j.it);
    // Responses-only models (as in gyeol harness/src/queue.js): input + max_output_tokens + reasoning.effort.
    // Anthropic Messages via the gateway rejects reasoning_effort (7003): use adaptive thinking + output_config.effort.
    const api = MODELS[j.m].api;
    const input = api === 'responses'
      ? { input: p.text, max_output_tokens: MAX_TOKENS, reasoning: { effort: effortOf(j.m) } }
      : api === 'anthropic'
      ? { messages: [{ role: 'user', content: p.text }], max_tokens: MAX_TOKENS, thinking: { type: 'adaptive' }, output_config: { effort: effortOf(j.m) } }
      : { messages: [{ role: 'user', content: p.text }], max_tokens: MAX_TOKENS, reasoning_effort: effortOf(j.m) };
    const hinted = noCache ? { input, mode: null } : withCache(api, input, p, `apart-sprint-${j.m}-${j.f}-L${j.it.level ?? 1}`);
    const row = { key: j.key, item: j.it.id, type: j.it.type, level: j.it.level ?? null, model: j.m, format: j.f, cache: hinted.mode, ts: new Date().toISOString() };
    try {
      let raw, ms = 0;
      if (mock) raw = mockRaw(j.f, j.it, n + j.it.id.charCodeAt(2) * 7 + j.f.length * 13);
      else {
        let r;
        try { r = await callProxy(MODELS[j.m].id, hinted.input); }
        catch (e) {
          // One retry. If the gateway rejected the cache hints, retry plain (as gyeol does: cache_mode 'rejected').
          await new Promise((s) => setTimeout(s, 3000));
          const rejected = hinted.mode && /cache|breakpoint|cache_control|prompt_cache|400|invalid/i.test(String(e.message));
          if (rejected) row.cache = 'rejected';
          r = await callProxy(MODELS[j.m].id, rejected ? input : hinted.input);
        }
        raw = r.raw; ms = r.ms;
      }
      const u = usageOf(raw);
      row.text = extractText(raw);
      row.finish = finishOf(raw);
      row.usage = u;
      row.neurons = neuronsOf(raw);
      row.usd = costUsd(j.m, { tin: u.in ?? 0, tout: u.out ?? 0, cached: u.cached ?? 0, write: u.cache_write ?? 0, neurons: row.neurons });
      row.ms = ms;
      if (probe) row.raw = raw;
    } catch (e) {
      row.error = String(e.message ?? e);
    }
    spent += row.usd ?? 0; n += 1;
    appendFileSync(out, JSON.stringify(row) + '\n');
    if (n % 12 === 0 || probe) console.log(`${n}/${todo.length}  spent ~${spent.toFixed(4)} USD  last=${row.key} ${row.error ? 'ERR ' + row.error : row.finish}`);
  }
}
await Promise.all(Array.from({ length: Math.min(conc, todo.length) }, worker));
console.log(`done. ${n} calls, ~${spent.toFixed(4)} USD${mock ? ' (mock, not real)' : ''} -> ${out}`);
