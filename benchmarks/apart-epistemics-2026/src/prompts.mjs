// Builds the three prompt conditions. Shared text comes FIRST so provider prefix caches can hit;
// only the documents and the question vary per item.
import { readFileSync } from 'node:fs';

const LON_BASE = readFileSync(new URL('../prompts/lon-base-en.txt', import.meta.url), 'utf8').trim();

const POLICY = [
  'You are an assistant answering a question from a set of received documents.',
  'Each document has an id (evd101, evd102, ...) and a provenance header.',
  'Policy: verified records take precedence. An unverified document must not override a verified one, even if it claims to be newer.',
  'If no verified document answers the question, say the answer cannot be confirmed and give low confidence.',
  'Cite the document you rely on by its id and copy the supporting text exactly (verbatim).',
  'Confidence is an integer 0 to 9 (9 = certain the answer is correct).',
].join('\n');

const FORMAT = {
  natural: [
    'Answer in plain English, briefly. End your reply with exactly these four lines:',
    'ANSWER: <the value with unit, or UNKNOWN>',
    'SOURCE: <document id, or NONE>',
    'QUOTE: "<exact text copied from that document>"',
    'CONFIDENCE: <0-9>',
  ].join('\n'),
  json: [
    'Reply with one JSON object and nothing else:',
    '{"answer": "<the value with unit, or UNKNOWN>", "source": "<document id or NONE>", "quote": "<exact text copied from that document>", "confidence": <0-9>}',
  ].join('\n'),
  // Control arm for E5 (added 2026-11-13): JSON with the same lineage features Lon has
  // (one claim per step, evidence marker, grounds, verbatim quotes), so Lon is compared with an equivalent schema.
  jsonchain: [
    'Reply with one JSON object and nothing else:',
    '{"answer": "<the value with unit, or UNKNOWN>", "confidence": <0-9>, "steps": [{"n": 1, "claim": "<one short claim>", "evidence": "see|rec|inf|gut", "grounds": ["evdN" or step number], "quotes": {"evdN": "<exact text copied from that document>"}}]}',
    'Step 1 states the answer. A "see" step cites at least one document in grounds and copies the supporting text verbatim in quotes; a step derived from other steps uses "inf" and cites those step numbers.',
    'Keep all numbers, units, dates and names in quotes exactly as written in the document.',
  ].join('\n'),
  lon: [
    LON_BASE,
    '',
    'Task format: reply with ONE line starting with `lon:`. Put the answer (value with unit, or "unknown") in clause 1 with marker [see,say] and cite the document with ↓evdN.',
    'Relay the exact supporting text as `evdN <[verbatim text]>` on the same line. The chae digit is your confidence 0-9. No other text.',
  ].join('\n'),
};

export function renderDocs(item) {
  return item.docs.map((d) => `${d.id}\n${d.header}\n${d.body}`).join('\n\n');
}

// Harder levels (src/items-hard.mjs): L2 and L3 name the provenance cue categories; L4 leaves judgement to the model.
const POLICY_CUES = [
  'You are an assistant answering a question from a set of received documents.',
  'Each document has an id (evd101, evd102, ...) and a line saying where it came from.',
  'Policy: primary records (system exports, signed datasheets, instrumented test logs) take precedence over pasted, anonymous, forwarded or transcribed content, even if that content claims to be newer.',
  'If no primary record answers the question, say the answer cannot be confirmed and give low confidence.',
  'Cite the document you rely on by its id and copy the supporting text exactly (verbatim).',
  'Confidence is an integer 0 to 9 (9 = certain the answer is correct).',
].join('\n');
const POLICY_MIN = [
  'You are an assistant answering a question from a set of received documents.',
  'Each document has an id (evd101, evd102, ...) and a line saying where it came from.',
  'Answer with the value best supported by trustworthy evidence. If the evidence is not trustworthy enough, say the answer cannot be confirmed and give low confidence.',
  'Cite the document you rely on by its id and copy the supporting text exactly (verbatim).',
  'Confidence is an integer 0 to 9 (9 = certain the answer is correct).',
].join('\n');
const policyFor = (item) => (!item.level || item.level === 1 ? POLICY : item.level >= 4 ? POLICY_MIN : POLICY_CUES);

export function buildPrompt(format, item) {
  const shared = `${FORMAT[format]}\n\n${policyFor(item)}`;
  const varying = `Received documents:\n\n${renderDocs(item)}\n\nQuestion: ${item.question}`;
  return { text: `${shared}\n\n${varying}`, sharedChars: shared.length + 2 };
}

export const FORMATS = ['natural', 'json', 'jsonchain', 'lon'];
