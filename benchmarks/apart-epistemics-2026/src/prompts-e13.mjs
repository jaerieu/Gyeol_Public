// E13 prompts (snapshot non-destructive lineage + verbatim survival): 30-hop hand-over chain and reader call.
// Symmetrically enforces full-note carry-forward from entry 1 across all 4 formats without format-specific tricks.
// Lon uses the updated v0.8 snapshot rule sheet (#a9fe84, dict/lon-v0.8.txt from gyeol 10fba3d).
import { readFileSync } from 'node:fs';

export const FORMATS = ['natural', 'json', 'jsonchain', 'lon'];
const LON_BASE = readFileSync(new URL('../prompts/lon-base-10fba3d-en.txt', import.meta.url), 'utf8').trim();

const ROLE = 'You are one agent in a relay of shift agents at an operations desk. Each agent sees only the hand-over note written by the agent before it and one new document. You write the hand-over note for the next agent, who will see only your note and the next document.';

const POLICY = `Rules for the hand-over note:
1. Carry forward every entry from the previous note and add every entry from the new document. Your reply replaces the previous hand-over note in full: repeat every earlier entry from entry 1 upward verbatim before appending new entries (never output only the new delta, and never delete or alter an earlier entry).
2. Keep every value exactly as written in its document: every character, digit, unit, punctuation mark, backslash, quotation mark and line break.
3. Keep the document id (evdN) with every value, so that a later reader can check the value against that document.
4. When a document revises an earlier value, keep the earlier entry as written and add a new entry with the new value, its new document id, and a revision link to the earlier entry. When a document withdraws an earlier item, keep the earlier entry as written and add a new entry recording the cancellation value, its new document id, and a withdrawal link to the earlier entry.
5. When a document tells you to state a computed value, compute it, state it, and link the entries or documents it was computed from. When an input to a computed value is revised, keep the earlier computed entry as written and add a new computed entry with the recomputed value, linking both the earlier computed entry it revises and the current inputs.
6. Do not add values that are in neither the previous note nor the new document.`;

const BLOCK = {
  natural: `Note format: plain English with sequential numbered entries [1], [2], ..., one entry per line.
Your reply replaces the previous note: repeat every earlier entry verbatim from [1] upward before appending new entries.
In each line name its document (evdN) and put the exact value in double quotes.
When revising earlier entry [k], write \`revises [k]\` on the new line; when withdrawing earlier entry [k], write \`withdraws [k]\` on the new line.
For a computed value, put \`from [a], [b]\` (or the documents/entries it rests on) on its line; when recomputing earlier computed entry [k], write \`revises [k]\` and \`from [a], [b]\`. No other text.`,
  json: `Note format: reply with ONE JSON object and nothing else:
{"items": [{"id": 1, "item": "<what the value is>", "value": "<exact value>", "source": "<evdN; for a computed value, every entry id or document it was computed from>", "revises": null, "retracts": null}]}
One entry per item, with sequential integer id from 1. Your reply replaces the previous note: keep all earlier entries unchanged from id 1 upward and append new entries.
Set integer "revises": k when revising earlier item id k (raw or computed); set integer "retracts": k when withdrawing earlier item id k. Leave null otherwise.
Keep all numbers, units, dates and names in value exactly as written in the document.`,
  jsonchain: `Note format: reply with ONE JSON object and nothing else:
{"steps": [{"n": 1, "claim": "<one short claim>", "evidence": "see|rec|inf|gut", "revises": null, "retracts": null, "grounds": ["evdN" or step number], "quotes": {"evdN": "<exact text copied from that document>"}}]}
One step per item, numbered sequentially from 1. Your reply replaces the previous note: keep all earlier steps unchanged from n=1 upward and append new steps.
A "see" or "rec" step cites its document in grounds and copies the supporting text verbatim in quotes; an "inf" step derives from other steps and cites their step numbers in grounds.
Set integer "revises": k when revising earlier step n=k (raw or computed); set integer "retracts": k when withdrawing earlier step n=k. Leave null otherwise.
Keep all numbers, units, dates and names in quotes exactly as written in the document.`,
  lon: `${LON_BASE}

Note format: start with header \`lon 0.8 · snapshot · lang en\`, then reply with lines starting with \`lon:\`, one self-addressed clause per item (write a separate clause for each distinct item in a document), numbered sequentially without gaps from 1 (<1 · ...>):
lon: <N · [see,say] concise label *G8↓evdM>
Your reply replaces the previous note: repeat EVERY earlier \`lon:\` clause and \`evdM <[ ... ]>\` / \`evdM <[[ ... ]]>\` relay verbatim from <1 upward (preserving earlier clause numbers and \`fix→k\`/\`err→k\` prefixes) before appending new clauses.
Always place relation prefixes (\`fix→k\`, \`err→k\`) BETWEEN \`·\` and \`[\`:
- Correct: \`lon: <7 · fix→3 [see,say] concise label *G8↓evdM>\` or \`lon: <9 · err→2 [see,say] Cancellation code *G8↓evdM>\`
- Wrong: \`<7 · [rec,fix→3,see,say] ...>\` (never put \`fix→\` or \`err→\` inside \`[...]\`).
Inside \`<...>\`, write ONLY a concise plain-word item label (and plain number/unit when it has NO '<', '>', '[', or ']' characters — NEVER copy strings containing '<', '>', '[', or ']' inside \`<...>\`, as those delimit clauses and markers).
Copy the exact verbatim document text into an external relay block once per cited document (right after the clause or on its own line), checking first whether the document text contains \`]>\`:
- Normal document (no \`]>\` inside): \`evdM <[verbatim document text]>\`
- Document contains \`]>\` anywhere (such as \`<[L1]>\` or \`<[SITE]>\`): MUST wrap with double brackets \`evdM <[[verbatim document text]]>\` (never single \`evdM <[... <[L1]> ...]>\`, which closes early at the inner \`]>\`!).
Put each computed value in its own \`[inf,say]\` clause citing input clauses (\`lon: <N · [inf,say] label value unit *G7↓a↓b>\`), and when recomputing earlier computed clause k write \`lon: <N · fix→k [inf,say] label new_value unit *G7↓a↓b>\`.
For chae, pick one letter from R G B C M Y K (color meanings are undefined) plus your honest confidence digit 0-9. No other text.`,
};

const head = (format) => `${ROLE}\n\n${POLICY}\n\n${BLOCK[format]}\n\n`;

export function hopPrompt(format, scen, hop, prev) {
  const doc = scen.docs[hop - 1];
  const shared = head(format);
  const rest = `=== Previous hand-over note ===\n${prev ?? '(none: you are the first agent in the relay)'}\n=== End of previous note ===\n\n`
    + `=== New document ${doc.id} ===\n${doc.header}\n${doc.body}\n=== End of document ${doc.id} ===\n\nWrite the full hand-over note now (starting from entry 1).`;
  return { text: shared + rest, sharedChars: shared.length };
}

export function readerPrompt(format, scen, note) {
  const shared = `You are given the last hand-over note of a relay of shift agents. Answer the questions using only this note.\nAnswer each question as asked: some ask for the current value in force, while others ask for an earlier or withdrawn value from the note's history.\n\nThe note was written under this instruction:\n${BLOCK[format]}\n\n`;
  const qs = scen.questions.map((q) => `Q${q.q}: ${q.label}`).join('\n');
  const rest = `=== Hand-over note ===\n${note}\n=== End of note ===\n\nQuestions.\n${qs}\n\n`
    + 'Answer with exactly one line per question, in the same order, and nothing else:\n'
    + 'Qn: <the exact value, character for character as in its source document; remove only quoting or escaping that the notation of the note adds>\n'
    + 'For a value that spans two lines, write both lines on one line separated by a single space.\n'
    + 'If the note does not contain the item, answer `Qn: MISSING`.';
  return { text: shared + rest, sharedChars: shared.length };
}
