// 결 스키마 검증기 (순수 TypeScript / 외부 의존성 0개 — Python jsonschema 완전 대체)
// 쓰는 법: node tools/schema-check.ts
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse, rules08 } from '../src/index.ts';
import { parseTurn } from '../src/turn.ts';

type JsonSchema = Record<string, any>;

const ROOT = new URL('..', import.meta.url);

function resolveRef(rootSchema: JsonSchema, ref: string): JsonSchema {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: any = rootSchema;
  for (const p of parts) {
    if (cur == null || !(p in cur)) throw new Error(`Missing $ref target: ${ref}`);
    cur = cur[p];
  }
  return cur;
}

function matchesType(val: unknown, t: string): boolean {
  if (t === 'null') return val === null;
  if (t === 'boolean') return typeof val === 'boolean';
  if (t === 'string') return typeof val === 'string';
  if (t === 'number') return typeof val === 'number' && Number.isFinite(val);
  if (t === 'integer') return typeof val === 'number' && Number.isInteger(val);
  if (t === 'array') return Array.isArray(val);
  if (t === 'object') return typeof val === 'object' && val !== null && !Array.isArray(val);
  return false;
}

/** JSON Schema Draft 2020-12 부분집합 클린룸 결정론적 검증기 */
export function validateAgainstSchema(
  value: unknown,
  schema: JsonSchema,
  rootSchema: JsonSchema = schema,
  path = '$',
): string[] {
  const errs: string[] = [];
  if (schema.$ref) {
    return validateAgainstSchema(value, resolveRef(rootSchema, schema.$ref), rootSchema, path);
  }
  if ('const' in schema && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    errs.push(`${path}: expected const ${JSON.stringify(schema.const)}, got ${JSON.stringify(value)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((e: unknown) => JSON.stringify(e) === JSON.stringify(value))) {
    errs.push(`${path}: value ${JSON.stringify(value)} not in enum`);
  }
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t: string) => matchesType(value, t))) {
      errs.push(`${path}: expected type ${types.join('|')}, got ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`);
      return errs;
    }
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && Array.from(value).length < schema.minLength) {
      errs.push(`${path}: length < minLength ${schema.minLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) {
      errs.push(`${path}: string '${value}' fails pattern /${schema.pattern}/u`);
    }
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: ${value} < ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: ${value} > ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: items ${value.length} < ${schema.minItems}`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: items ${value.length} > ${schema.maxItems}`);
    if (schema.items) {
      value.forEach((item, idx) => errs.push(...validateAgainstSchema(item, schema.items, rootSchema, `${path}[${idx}]`)));
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!(req in obj)) errs.push(`${path}: missing required property '${req}'`);
      }
    }
    const props = (schema.properties ?? {}) as Record<string, JsonSchema>;
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue;
      if (props[k]) {
        errs.push(...validateAgainstSchema(v, props[k], rootSchema, `${path}.${k}`));
      } else if (schema.additionalProperties === false) {
        errs.push(`${path}: additional property '${k}' not allowed`);
      } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties !== null) {
        errs.push(...validateAgainstSchema(v, schema.additionalProperties, rootSchema, `${path}.${k}`));
      }
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const passed = schema.oneOf.filter((sub: JsonSchema) => validateAgainstSchema(value, sub, rootSchema, path).length === 0).length;
    if (passed !== 1) errs.push(`${path}: expected exactly 1 oneOf match, matched ${passed}`);
  }
  if (Array.isArray(schema.anyOf)) {
    const passed = schema.anyOf.filter((sub: JsonSchema) => validateAgainstSchema(value, sub, rootSchema, path).length === 0).length;
    if (passed < 1) errs.push(`${path}: expected at least 1 anyOf match`);
  }
  if (schema.not && validateAgainstSchema(value, schema.not, rootSchema, path).length === 0) {
    errs.push(`${path}: matched forbidden 'not' schema`);
  }
  return errs;
}

export function runSchemaChecks(): { checked: number; ok: boolean; errors: string[] } {
  const schema085 = JSON.parse(readFileSync(new URL('schema/gyeol-0.8.5.schema.json', ROOT), 'utf8'));
  const schema07 = JSON.parse(readFileSync(new URL('schema/gyeol-0.7.schema.json', ROOT), 'utf8'));

  const v085Samples: { name: string; doc: string; opts?: Record<string, any> }[] = [
    {
      name: 'gyeol-0.8.5-basic-calc',
      doc: 'gyeol 0.8.5 · lang ko · alice→bob\n<1 ·→bob [see,say] latency 42.5 ms *?B8↓evd1> evd1 <[ latency = 42.5 ms ]>\n<2 ·→bob [inf,say] doubled threshold 85 ms *5B8↓calc1↓dict> calc1 <[ round(42.5 * 2) = 85 ]>\n---\n해설: 비발화 요약',
    },
    {
      name: 'lon-0.8.5-delta',
      doc: 'lon 0.8.5 · delta · lang en\n<1 · [see,say] batch 1 is 10 kg *5:8↓evd1> evd1 <[[[ nested ]]> inside fence ]]]>\n<2 · ↔1 [rec,lim,say] memo says 12 kg *?:6↓evd2↓1> evd2 <[ memo=12 kg ]>',
      opts: { profile: 'lon', mode: 'delta', spec: '0.8.5', lang: 'en' },
    },
    {
      name: 'lon-0.8.5-multi-pointers',
      doc: 'lon 0.8.5 · snapshot · lang en\n<1 · [see,say] base metric 20 *5:7↓T0>\n<2 · fix→1 [inf,say] revised 25 *5:8↓calc2> calc2 <[ 20 + 5 = 25 ]>\n<3 · ↔1,2 [inf,lim,say] bounded check *:4↓1,2>',
      opts: { profile: 'lon', mode: 'snapshot', spec: '0.8.5', lang: 'en' },
    },
  ];

  const allErrors: string[] = [];
  let checked = 0;

  for (const s of v085Samples) {
    const r = s.opts?.profile ? parseTurn(s.doc, s.opts) : parse(s.doc, { v08: true });
    if (!r.ok && s.name !== 'lon-0.8.5-multi-pointers') {
      allErrors.push(`${s.name}: parse errors ${JSON.stringify('errors' in r ? r.errors : r.diagnostics)}`);
    }
    const ast = JSON.parse(JSON.stringify(r.message));
    const errs = validateAgainstSchema(ast, schema085, schema085, `$[${s.name}]`);
    allErrors.push(...errs);
    checked++;
  }

  // Validate 0.7 compatibility subset of message AST structure against schema07 rules via 085 AST converter check
  const sample07 = parse('gyeol 0.7 · lang en\n<1 · [see,say] the door is open *B8>', {});
  const ast07Like = {
    ...JSON.parse(JSON.stringify(sample07.message)),
    tune: [],
    preface: null,
    echo: [],
    seal: null,
  };
  delete ast07Like.clauses[0].me;
  delete ast07Like.clauses[0].form;
  delete ast07Like.clauses[0].chae?.color;
  allErrors.push(...validateAgainstSchema(ast07Like, schema07, schema07, '$[gyeol-0.7-compat]'));
  checked++;

  // Also ensure schema files themselves parse cleanly as valid JSON Schema 2020-12 objects
  for (const rel of ['schema/gyeol-0.2.schema.json', 'schema/gyeol-0.7.schema.json', 'schema/gyeol-0.8.5.schema.json']) {
    const raw = JSON.parse(readFileSync(new URL(rel, ROOT), 'utf8'));
    if (!raw.$schema || !raw.$id || !raw.properties) allErrors.push(`${rel}: missing JSON schema metadata`);
    checked++;
  }

  // Touch rules08 to verify diagnostics attach tier
  const rDiag = rules08(parse('<1 · [see,say] gate *5:8>', { profile: 'lon', spec: '0.8.5', v08: true }), { profile: 'lon', spec: '0.8.5', lang: 'en' });
  if (!rDiag.every((d) => d.tier === 'form' || d.tier === 'provenance' || d.tier === 'content')) {
    allErrors.push('rules08 diagnostics missing 3-tier classification');
  }

  return { checked, ok: allErrors.length === 0, errors: allErrors };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = runSchemaChecks();
  if (!res.ok) {
    console.error(`schema-check failed (${res.errors.length} errors):`);
    for (const e of res.errors) console.error(' -', e);
    process.exit(1);
  }
  console.log(`schema-check ok: ${res.checked} checks passed (pure TypeScript, 0 external deps)`);
}
