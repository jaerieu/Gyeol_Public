#!/usr/bin/env node
// Generate publication-grade 300 DPI PNG figures (via SVG + Typst) from E13 & posthoc JSONs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const METRICS = JSON.parse(readFileSync(resolve(ROOT, 'report/metrics-e13.json'), 'utf8'));
const POSTHOC = JSON.parse(readFileSync(resolve(ROOT, 'report/diag-e13-posthoc.json'), 'utf8'));

const FIG_DIR = resolve(ROOT, 'report/figures');
const SUB_DIR = resolve(ROOT, 'submission');
mkdirSync(FIG_DIR, { recursive: true });
mkdirSync(SUB_DIR, { recursive: true });

const TYPST = process.env.TYPST_BIN || 'typst';
const FONT = 'DejaVu Sans';

const FMT_META = {
  lon: { label: 'Gyeol;Lon (lon 0.8)', short: 'Lon', color: '#0F766E', fill: '#CCFBF1' },
  jsonchain: { label: 'JSON-chain', short: 'JSON-chain', color: '#2563EB', fill: '#DBEAFE' },
  json: { label: 'Flat JSON', short: 'JSON', color: '#D97706', fill: '#FEF3C7' },
  natural: { label: 'Natural Prose', short: 'Prose', color: '#64748B', fill: '#F1F5F9' },
};

const MODEL_ORDER = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off', 'haiku_off', 'haiku_on'];
const MODEL_LABEL = {
  deepseek_on: 'DeepSeek v4.1 Flash (Think ON)',
  deepseek_off: 'DeepSeek v4.1 Flash (Think OFF)',
  luna_on: 'GPT-6 Luna (Reason ON)',
  luna_off: 'GPT-6 Luna (Reason OFF)',
  haiku_off: 'Claude Haiku 5.5 (Think OFF)',
  haiku_on: 'Claude Haiku 5.5 (Think ON)',
};
const MODEL_SHORT = {
  deepseek_on: 'DS v4.1 ON',
  deepseek_off: 'DS v4.1 OFF',
  luna_on: 'Luna ON',
  luna_off: 'Luna OFF',
  haiku_off: 'Haiku OFF',
  haiku_on: 'Haiku ON',
};

const esc = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const svgDoc = (w, h, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}, sans-serif">
<rect x="0" y="0" width="${w}" height="${h}" fill="#FFFFFF"/>
${body}
</svg>
`;

const text = (x, y, s, { size = 11, weight = 'normal', fill = '#0F172A', anchor = 'start', italic = false, rotate = null } = {}) => {
  const tr = rotate != null ? ` transform="rotate(${rotate} ${x} ${y})"` : '';
  const fs = italic ? ' font-style="italic"' : '';
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${fs}${tr}>${esc(s)}</text>`;
};

function compileSvgToPng(svgPath, pngPath) {
  const svgTxt = readFileSync(svgPath, 'utf8');
  const m = svgTxt.match(/viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/);
  const wPt = m ? Number(m[1]) * 0.65 : 780;
  const typPath = svgPath.replace(/\.svg$/, '.typ');
  const typ = `#set page(width: ${wPt}pt, height: auto, margin: 0pt)\n#image("${svgPath.split('/').pop()}", width: 100%)\n`;
  writeFileSync(typPath, typ, 'utf8');
  execFileSync(TYPST, ['compile', '--format', 'png', '--ppi', '300', typPath, pngPath], { cwd: dirname(svgPath) });
  console.log(`compiled ${pngPath}`);
}

const cellMap = new Map(METRICS.cells.map((c) => [`${c.model}|${c.format}`, c]));
const curveMap = new Map(METRICS.curve.map((c) => [`${c.model}|${c.format}`, c]));
const tamperMap = new Map(METRICS.tamper.map((c) => [`${c.model}|${c.format}`, c]));
const mukMap = new Map(METRICS.muk.map((c) => [c.model, c]));

// ---------------- FIGURE 1: 2x3 30-Hop Lineage Survival Trajectories ----------------
function buildFig1() {
  const W = 1200, H = 730;
  const out = [];
  out.push(text(W / 2, 30, 'Figure 1. 30-Hop Non-Destructive Lineage Survival (L) Across 6 Model Cells × 4 Formats (240 Sessions)', { size: 17, weight: 'bold', anchor: 'middle' }));
  out.push(text(W / 2, 50, 'Held-out scenarios S01–S10 (53 lineage events/scenario). Intention-to-treat (ITT) scores halted sessions 0; Haiku ON also overlays post-hoc wrapper-stripped L.', { size: 11.5, fill: '#475569', anchor: 'middle' }));

  // Top legend bar
  const legY = 74;
  const legItems = [
    { label: 'Gyeol;Lon (lon 0.8)', color: FMT_META.lon.color, dash: '', w: 3 },
    { label: 'JSON-chain', color: FMT_META.jsonchain.color, dash: '', w: 2.2 },
    { label: 'Flat JSON', color: FMT_META.json.color, dash: '', w: 2.2 },
    { label: 'Natural Prose', color: FMT_META.natural.color, dash: '', w: 2.2 },
    { label: 'Haiku ON Lon (stripped ITT 10/10)', color: '#7C3AED', dash: '6,3', w: 2.2 },
    { label: 'Haiku ON Lon (stripped 6/10 done)', color: '#7C3AED', dash: '2,3', w: 2.2 },
  ];
  let lx = 58;
  for (const li of legItems) {
    out.push(`<line x1="${lx}" y1="${legY - 4}" x2="${lx + 24}" y2="${legY - 4}" stroke="${li.color}" stroke-width="${li.w}"${li.dash ? ` stroke-dasharray="${li.dash}"` : ''}/>`);
    out.push(text(lx + 29, legY, li.label, { size: 10.5, weight: li.color === FMT_META.lon.color ? 'bold' : 'normal', fill: '#1E293B' }));
    lx += li.label.length * 6.0 + 44;
  }

  const hops = [10, 15, 20, 25, 30];
  const cols = 3, rows = 2;
  const panW = 355, panH = 262, gapX = 36, gapY = 58;
  const startX = 64, startY = 104;

  MODEL_ORDER.forEach((m, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const px = startX + col * (panW + gapX);
    const py = startY + row * (panH + gapY);
    const plotL = px + 44, plotR = px + panW - 50, plotT = py + 28, plotB = py + panH - 36;
    const pw = plotR - plotL, ph = plotB - plotT;

    out.push(`<rect x="${px}" y="${py}" width="${panW}" height="${panH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0" stroke-width="1"/>`);
    out.push(text(px + panW / 2, py + 18, MODEL_LABEL[m], { size: 12, weight: 'bold', anchor: 'middle', fill: '#0F172A' }));

    // Gridlines & Y ticks
    for (const yv of [0, 0.25, 0.5, 0.75, 1.0]) {
      const yy = plotB - yv * ph;
      out.push(`<line x1="${plotL}" y1="${yy}" x2="${plotR}" y2="${yy}" stroke="${yv === 0 ? '#64748B' : '#E2E8F0'}" stroke-width="${yv === 0 ? 1.2 : 0.8}"/>`);
      if (col === 0 || true) {
        out.push(text(plotL - 7, yy + 3.5, yv.toFixed(2), { size: 9.5, fill: '#475569', anchor: 'end' }));
      }
    }
    // X ticks
    const xOf = (h) => plotL + ((h - 10) / 20) * pw;
    const yOf = (v) => plotB - v * ph;
    for (const h of hops) {
      const xx = xOf(h);
      out.push(`<line x1="${xx}" y1="${plotT}" x2="${xx}" y2="${plotB}" stroke="#F1F5F9" stroke-width="0.8"/>`);
      out.push(`<line x1="${xx}" y1="${plotB}" x2="${xx}" y2="${plotB + 4}" stroke="#64748B" stroke-width="1"/>`);
      out.push(text(xx, plotB + 16, `h${h}`, { size: 9.5, fill: '#475569', anchor: 'middle' }));
    }
    out.push(`<line x1="${plotL}" y1="${plotT}" x2="${plotL}" y2="${plotB}" stroke="#64748B" stroke-width="1.2"/>`);
    if (col === 0) out.push(text(px + 11, plotT + ph / 2, 'Lineage Survival L', { size: 10, fill: '#334155', anchor: 'middle', rotate: -90 }));
    if (row === 1) out.push(text(plotL + pw / 2, plotB + 30, 'Relay Hop', { size: 10, fill: '#334155', anchor: 'middle' }));

    // Collect endpoints to stagger vertically if within 12px
    const endLabels = [];
    for (const f of ['natural', 'json', 'jsonchain', 'lon']) {
      const cv = curveMap.get(`${m}|${f}`);
      const pts = hops.map((h) => [xOf(h), yOf(cv.hops[String(h)])]);
      const dStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      const meta = FMT_META[f];
      const sw = f === 'lon' ? 2.8 : 1.9;
      out.push(`<path d="${dStr}" fill="none" stroke="${meta.color}" stroke-width="${sw}" stroke-linejoin="round"/>`);
      pts.forEach(([cx, cy], i) => {
        if (f === 'lon') out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.4" fill="${meta.color}" stroke="#FFFFFF" stroke-width="0.8"/>`);
        else if (f === 'jsonchain') out.push(`<rect x="${(cx - 2.6).toFixed(1)}" y="${(cy - 2.6).toFixed(1)}" width="5.2" height="5.2" fill="${meta.color}"/>`);
        else if (f === 'json') out.push(`<polygon points="${cx.toFixed(1)},${(cy - 3.2).toFixed(1)} ${(cx - 3).toFixed(1)},${(cy + 2.6).toFixed(1)} ${(cx + 3).toFixed(1)},${(cy + 2.6).toFixed(1)}" fill="${meta.color}"/>`);
        else out.push(`<polygon points="${cx.toFixed(1)},${(cy - 3.2).toFixed(1)} ${(cx + 3.2).toFixed(1)},${cy.toFixed(1)} ${cx.toFixed(1)},${(cy + 3.2).toFixed(1)} ${(cx - 3.2).toFixed(1)},${cy.toFixed(1)}" fill="${meta.color}"/>`);
      });
      const val = cv.hops['30'];
      endLabels.push({ f, label: val.toFixed(3), yRaw: yOf(val), color: meta.color, bold: f === 'lon' });
    }

    // Haiku ON overlays
    if (m === 'haiku_on') {
      const sc = POSTHOC.haikuOnLon.strippedCurve;
      for (const [key, dash, tag] of [['completed', '2,3', '0.786*'], ['itt', '6,3', '0.472*']]) {
        const pts = hops.map((h) => [xOf(h), yOf(sc[key][String(h)])]);
        const dStr = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
        out.push(`<path d="${dStr}" fill="none" stroke="#7C3AED" stroke-width="2.1" stroke-dasharray="${dash}"/>`);
        pts.forEach(([cx, cy]) => out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2.7" fill="#FFFFFF" stroke="#7C3AED" stroke-width="1.5"/>`));
        endLabels.push({ f: key, label: tag, yRaw: yOf(sc[key]['30']), color: '#7C3AED', bold: false });
      }
      out.push(text(plotL + 6, plotT + ph - 10, 'Raw Lon=0.000: 4/10 API refusals + wrapper copy', { size: 8.6, fill: '#991B1B' }));
    }
    if (m === 'haiku_off') {
      out.push(text(plotL + 6, plotT + 14, 'JSON-chain: 9/10 delta-only collapse -> 0.000', { size: 8.6, fill: '#1D4ED8' }));
    }
    if (m === 'luna_off') {
      out.push(text(plotL + 6, plotT + 14, 'JSON-chain: 8/10 cut replies (max tokens)', { size: 8.6, fill: '#1D4ED8' }));
    }
    if (m === 'deepseek_on') {
      out.push(text(plotL + 6, plotB - 28, '7/10 scenarios 53/53 = 1.000 on Lon', { size: 8.8, fill: '#0F766E', weight: 'bold' }));
    }

    // Stagger endLabels cleanly
    endLabels.sort((a, b) => a.yRaw - b.yRaw);
    for (let i = 0; i < endLabels.length; i++) {
      let yy = Math.max(plotT + 7, Math.min(plotB - 3, endLabels[i].yRaw + 3));
      if (i > 0 && yy - endLabels[i - 1].yPlaced < 11.5) yy = endLabels[i - 1].yPlaced + 11.5;
      endLabels[i].yPlaced = yy;
    }
    for (let i = endLabels.length - 1; i >= 0; i--) {
      if (endLabels[i].yPlaced > plotB + 2) endLabels[i].yPlaced = plotB + 2;
      if (i > 0 && endLabels[i].yPlaced - endLabels[i - 1].yPlaced < 11) {
        endLabels[i - 1].yPlaced = endLabels[i].yPlaced - 11;
      }
    }
    for (const el of endLabels) {
      out.push(text(plotR + 6, el.yPlaced, el.label, { size: 9.5, weight: el.bold ? 'bold' : 'normal', fill: el.color }));
    }
  });

  const svgPath = resolve(FIG_DIR, 'fig1-lineage-survival.svg');
  const pngPath = resolve(FIG_DIR, 'fig1-lineage-survival.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

// ---------------- FIGURE 2: Paired Contrasts Forest + Blind Reader Accuracy ----------------
function buildFig2() {
  const W = 1220, H = 560;
  const out = [];
  out.push(text(W / 2, 28, 'Figure 2. Paired Hop-30 Format Contrasts (95% Bootstrap CIs) & Blind Hop-31 Reader Exact Accuracy', { size: 16.5, weight: 'bold', anchor: 'middle' }));

  // Panel A: Forest plot of Lon minus baseline on L
  const aX = 24, aY = 54, aW = 635, aH = 482;
  out.push(`<rect x="${aX}" y="${aY}" width="${aW}" height="${aH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(aX + 16, aY + 24, 'A. Paired Hop-30 Lineage Differences (Lon minus Baseline, n = 10 pairs/cell)', { size: 12.5, weight: 'bold' }));

  const plotL = aX + 186, plotR = aX + aW - 145, plotT = aY + 64, plotB = aY + aH - 48;
  const pw = plotR - plotL, ph = plotB - plotT;
  const xMin = -0.75, xMax = 0.50;
  const xOf = (v) => plotL + ((v - xMin) / (xMax - xMin)) * pw;

  // Vertical zero line & gridlines
  for (const xv of [-0.6, -0.4, -0.2, 0.0, 0.2, 0.4]) {
    const xx = xOf(xv);
    out.push(`<line x1="${xx}" y1="${plotT - 6}" x2="${xx}" y2="${plotB}" stroke="${xv === 0 ? '#0F172A' : '#E2E8F0'}" stroke-width="${xv === 0 ? 1.5 : 0.9}"${xv === 0 ? ' stroke-dasharray="4,3"' : ''}/>`);
    out.push(text(xx, plotB + 16, xv.toFixed(1), { size: 10, fill: '#475569', anchor: 'middle' }));
  }
  out.push(text((plotL + plotR) / 2, plotB + 34, 'Paired L Difference (positive favors Gyeol;Lon)', { size: 10.5, fill: '#334155', anchor: 'middle' }));

  const groups = [
    { key: 'natural', label: 'Lon − Natural Prose', color: FMT_META.natural.color },
    { key: 'json', label: 'Lon − Flat JSON', color: FMT_META.json.color },
    { key: 'jsonchain', label: 'Lon − JSON-chain', color: FMT_META.jsonchain.color },
  ];
  const modelsOrd = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off', 'haiku_off', 'haiku_on'];
  const totalRows = groups.length * modelsOrd.length + 2; // +2 gap slots
  const rowStep = ph / totalRows;

  let rIdx = 0;
  groups.forEach((g, gi) => {
    const cList = new Map(METRICS.contrasts[g.key].L.map((c) => [c.k, c]));
    const holmMap = METRICS.contrasts[g.key].holmL;
    out.push(text(aX + 14, plotT + rIdx * rowStep + 2, g.label, { size: 10.5, weight: 'bold', fill: g.color }));
    if (gi > 0) {
      const sepY = plotT + (rIdx - 0.5) * rowStep - 4;
      out.push(`<line x1="${aX + 12}" y1="${sepY}" x2="${aX + aW - 12}" y2="${sepY}" stroke="#E2E8F0" stroke-width="1"/>`);
    }
    modelsOrd.forEach((m) => {
      const yy = plotT + (rIdx + 0.85) * rowStep;
      const item = cList.get(m);
      const hp = holmMap[m];
      const cx = xOf(item.mean), x0 = xOf(item.ci[0]), x1 = xOf(item.ci[1]);
      out.push(text(plotL - 8, yy + 3.5, MODEL_SHORT[m], { size: 9.8, fill: '#334155', anchor: 'end' }));
      out.push(`<line x1="${x0}" y1="${yy}" x2="${x1}" y2="${yy}" stroke="${g.color}" stroke-width="2"/>`);
      out.push(`<line x1="${x0}" y1="${yy - 3.5}" x2="${x0}" y2="${yy + 3.5}" stroke="${g.color}" stroke-width="1.5"/>`);
      out.push(`<line x1="${x1}" y1="${yy - 3.5}" x2="${x1}" y2="${yy + 3.5}" stroke="${g.color}" stroke-width="1.5"/>`);
      const sig = hp < 0.05;
      out.push(`<circle cx="${cx}" cy="${yy}" r="3.8" fill="${sig ? g.color : '#FFFFFF'}" stroke="${g.color}" stroke-width="1.8"/>`);
      const pTxt = hp < 0.05 ? `pH=${hp.toFixed(3)}*` : `pH=${hp.toFixed(2)}`;
      const vTxt = `${item.mean >= 0 ? '+' : ''}${item.mean.toFixed(3)} (${pTxt})`;
      out.push(text(plotR + 8, yy + 3.5, vTxt, { size: 9.2, weight: sig ? 'bold' : 'normal', fill: sig ? '#0F172A' : '#64748B' }));
      if (m === 'haiku_on' && g.key === 'jsonchain') {
        const compDiff = POSTHOC.haikuOnLon.summary.completedMean.L - cellMap.get('haiku_on|jsonchain').L;
        const dx = xOf(compDiff);
        out.push(`<polygon points="${dx},${yy - 4} ${dx + 4},${yy} ${dx},${yy + 4} ${dx - 4},${yy}" fill="#FFFFFF" stroke="#7C3AED" stroke-width="1.7"/>`);
      }
      rIdx++;
    });
    rIdx += 0.9;
  });
  out.push(text(plotL, plotT - 18, 'Filled circle: Holm-adjusted p < 0.05 | Open violet diamond: stripped completed diff (+0.237)', { size: 8.8, fill: '#64748B' }));

  // Panel B: Blind Hop-31 Reader Current vs Lineage Accuracy
  const bX = 674, bY = 54, bW = 522, bH = 482;
  out.push(`<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(bX + 16, bY + 24, 'B. Blind Hop-31 Reader Exact Match (Current vs. Lineage)', { size: 12.5, weight: 'bold' }));
  out.push(text(bX + 16, bY + 42, 'Solid bar: Lineage (31/scen) | Light cap: Current (38/scen) | Label = Lon readerLin', { size: 9.4, fill: '#475569' }));

  const rpL = bX + 52, rpR = bX + bW - 18, rpT = bY + 70, rpB = bY + bH - 60;
  const rpw = rpR - rpL, rph = rpB - rpT;
  for (const yv of [0, 0.25, 0.5, 0.75, 1.0]) {
    const yy = rpB - yv * rph;
    out.push(`<line x1="${rpL}" y1="${yy}" x2="${rpR}" y2="${yy}" stroke="${yv === 0 ? '#64748B' : '#E2E8F0'}" stroke-width="${yv === 0 ? 1.2 : 0.8}"/>`);
    out.push(text(rpL - 6, yy + 3.5, yv.toFixed(2), { size: 9.5, fill: '#475569', anchor: 'end' }));
  }

  const grpW = rpw / modelsOrd.length;
  const fmts = ['lon', 'jsonchain', 'json', 'natural'];
  modelsOrd.forEach((m, mi) => {
    const gx = rpL + mi * grpW + 6;
    const bw = (grpW - 18) / 4;
    out.push(text(rpL + (mi + 0.5) * grpW, rpB + 18, MODEL_SHORT[m], { size: 9.6, weight: 'bold', anchor: 'middle', fill: '#1E293B' }));
    fmts.forEach((f, fi) => {
      const c = cellMap.get(`${m}|${f}`);
      const bx = gx + fi * (bw + 2);
      const hLin = c.readerLin * rph;
      const hCur = c.readerCur * rph;
      const col = FMT_META[f].color;
      // Current background bar (translucent)
      out.push(`<rect x="${bx.toFixed(1)}" y="${(rpB - hCur).toFixed(1)}" width="${bw.toFixed(1)}" height="${hCur.toFixed(1)}" fill="${FMT_META[f].fill}" stroke="${col}" stroke-width="0.9"/>`);
      // Lineage solid foreground bar (narrower inside or overlapping cleanly)
      out.push(`<rect x="${(bx + 2).toFixed(1)}" y="${(rpB - hLin).toFixed(1)}" width="${(bw - 4).toFixed(1)}" height="${hLin.toFixed(1)}" fill="${col}" opacity="0.92"/>`);
      if (f === 'lon' && (m === 'deepseek_on' || m === 'luna_on' || m === 'luna_off')) {
        out.push(text(bx + bw / 2, rpB - Math.max(hCur, hLin) - 5, c.readerLin.toFixed(2), { size: 8.5, weight: 'bold', fill: col, anchor: 'middle' }));
      }
    });
  });

  // Mini legend at bottom of Panel B
  let bxLeg = rpL + 20;
  for (const f of fmts) {
    out.push(`<rect x="${bxLeg}" y="${bY + bH - 22}" width="11" height="11" fill="${FMT_META[f].color}"/>`);
    out.push(text(bxLeg + 15, bY + bH - 12.5, FMT_META[f].short, { size: 9.8, fill: '#334155' }));
    bxLeg += 95;
  }

  const svgPath = resolve(FIG_DIR, 'fig2-format-contrasts.svg');
  const pngPath = resolve(FIG_DIR, 'fig2-format-contrasts.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

// ---------------- FIGURE 3: Key-Free Static Audit & Tamper Evidence ----------------
function buildFig3() {
  const W = 1220, H = 530;
  const out = [];
  out.push(text(W / 2, 28, 'Figure 3. Key-Free (Oracle-Free) Static Audit & Verbatim External-Evidence Tamper-Evidence (1,800 Hops/Format)', { size: 16, weight: 'bold', anchor: 'middle' }));

  // Panel A: Key-Free Static Audit Metrics across 4 formats
  const aX = 24, aY = 52, aW = 580, aH = 454;
  out.push(`<rect x="${aX}" y="${aY}" width="${aW}" height="${aH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(aX + 16, aY + 24, 'A. Key-Free Static Audit (Zero Answer Keys; 60 Sessions/Format)', { size: 12.5, weight: 'bold' }));
  out.push(text(aX + 16, aY + 42, 'Prose flags 100% of clean sessions (clean FA=1.000); Lon leads by 22.2 hops at 92.5% session recall.', { size: 9.6, fill: '#475569' }));

  const auditMap = new Map(METRICS.auditByFormat.map((a) => [a.group, a]));
  const metricsA = [
    { key: 'sRecall', label: 'Session Recall' },
    { key: 'recall', label: 'Hop Recall' },
    { key: 'precision', label: 'Hop Precision' },
    { key: 'onsetRecall', label: 'Onset Recall' },
    { key: 'cleanSpec', label: 'Clean Specificity' },
  ];
  const pL = aX + 52, pR = aX + aW - 18, pT = aY + 72, pB = aY + aH - 72;
  const pw = pR - pL, ph = pB - pT;
  for (const yv of [0, 0.25, 0.5, 0.75, 1.0]) {
    const yy = pB - yv * ph;
    out.push(`<line x1="${pL}" y1="${yy}" x2="${pR}" y2="${yy}" stroke="${yv === 0 ? '#64748B' : '#E2E8F0'}" stroke-width="${yv === 0 ? 1.2 : 0.8}"/>`);
    out.push(text(pL - 6, yy + 3.5, yv.toFixed(2), { size: 9.5, fill: '#475569', anchor: 'end' }));
  }

  const grpW = pw / metricsA.length;
  const fmts = ['lon', 'jsonchain', 'json', 'natural'];
  metricsA.forEach((mm, mi) => {
    const gx = pL + mi * grpW + 8;
    const bw = (grpW - 22) / 4;
    out.push(text(pL + (mi + 0.5) * grpW, pB + 18, mm.label, { size: 9.8, weight: 'bold', anchor: 'middle', fill: '#1E293B' }));
    fmts.forEach((f, fi) => {
      const row = auditMap.get(f);
      const val = mm.key === 'cleanSpec' ? (1 - row.falseAlarmCleanSessions) : row[mm.key];
      const bh = val * ph;
      const bx = gx + fi * (bw + 2);
      const by = pB - bh;
      const col = FMT_META[f].color;
      out.push(`<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${col}" rx="1.5"/>`);
      if (f === 'lon' || val === 0 || (f === 'natural' && mm.key === 'cleanSpec')) {
        out.push(text(bx + bw / 2, Math.min(pB - 4, by - 4), val.toFixed(2), { size: 8.6, weight: f === 'lon' ? 'bold' : 'normal', fill: f === 'natural' && val === 0 ? '#DC2626' : col, anchor: 'middle' }));
      }
    });
  });

  // Mean lead time pill strip under Panel A
  let lxA = pL;
  for (const f of fmts) {
    const row = auditMap.get(f);
    out.push(`<rect x="${lxA}" y="${aY + aH - 34}" width="10" height="10" fill="${FMT_META[f].color}"/>`);
    out.push(text(lxA + 14, aY + aH - 25, `${FMT_META[f].short} (lead ${row.meanLeadHops.toFixed(1)}h)`, { size: 9.2, fill: '#334155', weight: f === 'lon' ? 'bold' : 'normal' }));
    lxA += 126;
  }

  // Panel B: Hazard Survival + Quote Alteration Rate
  const bX = 622, bY = 52, bW = 574, bH = 454;
  out.push(`<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(bX + 16, bY + 24, 'B. Verbatim Hazard Survival & Attributed Quote/Relay Alteration Rate', { size: 12.5, weight: 'bold' }));
  out.push(text(bX + 16, bY + 42, 'Top: Lon-hazard ]> V via <[[...]]> vs Prose | Bottom: Altered/forged attributed span rate (lower is better)', { size: 9.4, fill: '#475569' }));

  const modelsB = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off', 'haiku_off'];
  const subTopL = bX + 86, subTopR = bX + bW - 22;
  const bwH = subTopR - subTopL;

  // Sub-panel B1: Attributed Quote/Relay Alteration Rate (horizontal comparison across 6 cells including haiku_on posthoc note)
  out.push(text(subTopL, bY + 66, 'Attributed Quote / Relay Alteration Rate (Final Hop 30 Note, Lower = Better)', { size: 10.2, weight: 'bold', fill: '#0F172A' }));
  const rowB = 34;
  const cellsB = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off', 'haiku_off', 'haiku_on'];
  cellsB.forEach((m, i) => {
    const yy = bY + 86 + i * rowB;
    const lonR = tamperMap.get(`${m}|lon`).alteredRate;
    const natR = tamperMap.get(`${m}|natural`).alteredRate;
    out.push(text(subTopL - 8, yy + 12, MODEL_SHORT[m], { size: 9.8, weight: 'bold', anchor: 'end', fill: '#1E293B' }));
    out.push(`<rect x="${subTopL}" y="${yy}" width="${bwH}" height="22" fill="#F1F5F9" rx="3"/>`);
    // Natural bar (top half)
    const wNat = Math.min(1, natR) * (bwH - 65);
    out.push(`<rect x="${subTopL}" y="${yy + 2}" width="${wNat.toFixed(1)}" height="8" fill="${FMT_META.natural.color}" rx="1.5"/>`);
    out.push(text(subTopL + wNat + 5, yy + 9.5, `Prose ${(natR * 100).toFixed(1)}%`, { size: 8.5, fill: '#475569' }));
    // Lon bar (bottom half)
    const dispLon = m === 'haiku_on' ? POSTHOC.haikuOnLon.summary.completedMean.alteredRate : lonR;
    const wLon = Math.min(1, dispLon) * (bwH - 65);
    out.push(`<rect x="${subTopL}" y="${yy + 12}" width="${Math.max(2, wLon).toFixed(1)}" height="8" fill="${m === 'haiku_on' ? '#7C3AED' : FMT_META.lon.color}" rx="1.5"/>`);
    const lonTxt = m === 'haiku_on'
      ? `Lon ${(dispLon * 100).toFixed(1)}% stripped (45.1% raw)`
      : `Lon ${(lonR * 100).toFixed(1)}%`;
    out.push(text(subTopL + Math.max(2, wLon) + 5, yy + 19.5, lonTxt, { size: 8.6, weight: 'bold', fill: m === 'haiku_on' ? '#7C3AED' : FMT_META.lon.color }));
  });

  // Sub-panel B2: Delimiter Hazard Survival (plain / JSON-hazard / Lon-hazard ]> on non-refusing Lon vs Natural)
  const sub2Y = bY + 305;
  out.push(`<line x1="${bX + 16}" y1="${sub2Y - 12}" x2="${bX + bW - 16}" y2="${sub2Y - 12}" stroke="#E2E8F0" stroke-width="1"/>`);
  out.push(text(bX + 16, sub2Y + 6, 'Delimiter-Hazard Survival (Lon <[[...]]> Lon-hazard V vs. JSON-hazard V)', { size: 10.2, weight: 'bold', fill: '#0F172A' }));

  const hazModels = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off'];
  const hzStep = (bwH + 40) / hazModels.length;
  hazModels.forEach((m, i) => {
    const tLon = tamperMap.get(`${m}|lon`);
    const tNat = tamperMap.get(`${m}|natural`);
    const cx = bX + 24 + i * hzStep;
    const cy = sub2Y + 22;
    out.push(`<rect x="${cx}" y="${cy}" width="${(hzStep - 12).toFixed(1)}" height="96" rx="4" fill="#FFFFFF" stroke="#CBD5E1"/>`);
    out.push(text(cx + (hzStep - 12) / 2, cy + 16, MODEL_SHORT[m], { size: 9.8, weight: 'bold', anchor: 'middle' }));
    out.push(text(cx + 8, cy + 36, `Plain V:   ${tLon.plainV.toFixed(3)}`, { size: 9.2, fill: '#0F766E' }));
    out.push(text(cx + 8, cy + 53, `JSON-haz:  ${tLon.jsonHazV.toFixed(3)}`, { size: 9.2, fill: '#0F766E' }));
    out.push(text(cx + 8, cy + 70, `Lon ]>:    ${tLon.lonHazV.toFixed(3)}`, { size: 9.2, weight: 'bold', fill: '#0F766E' }));
    out.push(text(cx + 8, cy + 87, `Prose J/L: ${tNat.jsonHazV.toFixed(2)}/${tNat.lonHazV.toFixed(2)}`, { size: 8.6, fill: '#64748B' }));
  });

  const svgPath = resolve(FIG_DIR, 'fig3-static-audit-tamper.svg');
  const pngPath = resolve(FIG_DIR, 'fig3-static-audit-tamper.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

// ---------------- FIGURE 4: Muk v6 Calibration, Chae Neutrality & Eq. E Consensus ----------------
function buildFig4() {
  const W = 1220, H = 560;
  const out = [];
  out.push(text(W / 2, 28, 'Figure 4. Muk v6 Epistemic Credibility, Chae Color Non-Definition Check, and Eq. E Held-Out Consensus', { size: 16, weight: 'bold', anchor: 'middle' }));

  // Panel A (Left): Muk v6 Credibility Grade, Calibration Gap & Brier on Lon
  const aX = 24, aY = 52, aW = 580, aH = 484;
  out.push(`<rect x="${aX}" y="${aY}" width="${aW}" height="${aH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(aX + 16, aY + 24, 'A. E13 Muk v6 Grade (0–9), Calibration Gap & Empirical Color Gain', { size: 12.2, weight: 'bold' }));
  out.push(text(aX + 16, aY + 42, 'Empirical accuracy vs. Muk v6 credBase (mid = 5); Chae RGBCMYK letters hold zero semantics.', { size: 9.5, fill: '#475569' }));

  const rowH = 54;
  const mukRows = [
    ...MODEL_ORDER.map((m) => ({ ...mukMap.get(m), label: MODEL_SHORT[m], posthoc: false })),
    {
      label: 'Haiku ON (strip)',
      grade: POSTHOC.haikuOnLon.summary.mukStripped.grade,
      credBase: POSTHOC.haikuOnLon.summary.mukStripped.credBase,
      accuracy: POSTHOC.haikuOnLon.summary.mukStripped.accuracy,
      gap: POSTHOC.haikuOnLon.summary.mukStripped.gap,
      brier: POSTHOC.haikuOnLon.summary.mukStripped.brier,
      colorGain: null,
      posthoc: true,
    },
  ];
  const barL = aX + 122, barW = 245;
  mukRows.forEach((r, i) => {
    const yy = aY + 66 + i * rowH;
    const isPh = r.posthoc;
    out.push(text(barL - 8, yy + 16, r.label, { size: 10, weight: 'bold', anchor: 'end', fill: isPh ? '#7C3AED' : '#0F172A' }));
    // 0-9 Credibility scale bar
    out.push(`<rect x="${barL}" y="${yy + 4}" width="${barW}" height="14" fill="#E2E8F0" rx="3"/>`);
    const fillW = (r.credBase / 9) * barW;
    const gColor = r.grade >= 7 ? '#0F766E' : r.grade >= 4 ? '#D97706' : '#DC2626';
    out.push(`<rect x="${barL}" y="${yy + 4}" width="${fillW.toFixed(1)}" height="14" fill="${isPh ? '#7C3AED' : gColor}" rx="3"/>`);
    // Accuracy tick marker on 0..9 mapped as 9*acc
    const accX = barL + r.accuracy * barW;
    out.push(`<line x1="${accX.toFixed(1)}" y1="${yy + 1}" x2="${accX.toFixed(1)}" y2="${yy + 21}" stroke="#0F172A" stroke-width="2"/>`);

    const cgTxt = r.colorGain == null ? 'n/a' : `${r.colorGain >= 0 ? '+' : ''}${r.colorGain.toFixed(4)}`;
    out.push(text(barL + barW + 10, yy + 15, `Grade ${r.grade} (base ${r.credBase.toFixed(2)}) | acc ${(r.accuracy * 100).toFixed(1)}%`, { size: 9.6, weight: 'bold', fill: '#0F172A' }));
    out.push(text(barL, yy + 32, `gap=${r.gap.toFixed(4)}   Brier=${r.brier.toFixed(4)}   colorGain=${cgTxt}`, { size: 9.0, fill: '#475569' }));
  });
  out.push(text(aX + 16, aY + aH - 18, 'Black tick = empirical accuracy on 0–9 scale; colorGain ∈ [-0.0167, +0.0001] confirms Chae neutrality.', { size: 8.5, fill: '#475569' }));

  // Panel B (Top-Right): Held-out Eq. E Ensemble Simulation + Single-Turn E5/E6b Anchor
  const bX = 622, bY = 52, bW = 574, bH = 228;
  out.push(`<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(bX + 16, bY + 24, 'B. Held-Out Multi-Agent Eq. E Consensus (S01–S05 Learned -> S06–S10 Test)', { size: 12, weight: 'bold' }));

  const eq = METRICS.eqESim;
  const bL = bX + 20, bMid = bX + 292;
  // Left sub-box: Agent weights learned from S01..S05
  out.push(text(bL, bY + 48, 'S01–S05 Train Muk Grades (Test S06–S10):', { size: 9.5, weight: 'bold', fill: '#334155' }));
  const agentList = ['deepseek_on', 'luna_on', 'luna_off', 'deepseek_off', 'haiku_off', 'haiku_on'];
  agentList.forEach((m, i) => {
    const yy = bY + 68 + i * 24;
    const g = eq.agents[m].grade;
    const col = g >= 7 ? '#0F766E' : g >= 4 ? '#D97706' : '#DC2626';
    out.push(text(bL, yy + 4, `${MODEL_SHORT[m]}:`, { size: 9.6, fill: '#1E293B' }));
    out.push(`<rect x="${bL + 90}" y="${yy - 6}" width="${(g / 9) * 110}" height="12" fill="${col}" rx="2"/>`);
    out.push(text(bL + 206, yy + 4, `G${g}`, { size: 9.6, weight: 'bold', fill: col }));
  });

  // Right sub-box: Brier Comparison Bars
  out.push(text(bMid, bY + 48, `Held-Out Brier Score (${eq.nItems} Items, Lower = Better):`, { size: 9.8, weight: 'bold', fill: '#334155' }));
  const brMax = 0.14;
  const brW = 240;
  const yNaive = bY + 78, yMuk = bY + 132;
  out.push(text(bMid, yNaive - 6, `Unweighted Majority (acc ${eq.naiveAcc.toFixed(3)})`, { size: 9.6, fill: '#475569' }));
  out.push(`<rect x="${bMid}" y="${yNaive}" width="${(eq.naiveBrier / brMax) * brW}" height="24" fill="#94A3B8" rx="3"/>`);
  out.push(text(bMid + (eq.naiveBrier / brMax) * brW + 6, yNaive + 16, eq.naiveBrier.toFixed(4), { size: 10, weight: 'bold', fill: '#334155' }));

  out.push(text(bMid, yMuk - 6, `Muk-Weighted Eq. E (acc ${eq.mukAcc.toFixed(3)})`, { size: 9.6, weight: 'bold', fill: '#0F766E' }));
  out.push(`<rect x="${bMid}" y="${yMuk}" width="${(eq.mukBrier / brMax) * brW}" height="24" fill="#0F766E" rx="3"/>`);
  out.push(text(bMid + (eq.mukBrier / brMax) * brW + 6, yMuk + 16, `${eq.mukBrier.toFixed(4)} (−20.4%)`, { size: 10, weight: 'bold', fill: '#0F766E' }));
  out.push(text(bMid, bY + 195, 'Eq. E suppresses Grade 1–2 noisy agents cleanly', { size: 9.4, fill: '#0F766E' }));
  out.push(text(bMid, bY + 210, 'without oracle ground-truth labels on S06–S10.', { size: 9.4, fill: '#475569' }));

  // Panel C (Bottom-Right): Single-Turn E5/E6b Forged-Premise Synthesis
  const cX = 622, cY = 294, cW = 574, cH = 242;
  out.push(`<rect x="${cX}" y="${cY}" width="${cW}" height="${cH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(cX + 16, cY + 24, 'C. Complementary Single-Turn Forged-Premise Probe (E5 / E6b, n = 98 items)', { size: 12, weight: 'bold' }));
  out.push(text(cX + 16, cY + 42, 'When models fall for planted chains, Lon exposes forged grounds (P1b) and warns blind reviewers (P4).', { size: 9.3, fill: '#475569' }));

  // P1b mini chart (Left side of Panel C)
  const p1Rows = [
    { label: 'P1b Premise Vis (Luna)', lon: 0.90, nat: 0.46, jsn: 0.36 },
    { label: 'P1b Premise Vis (Haiku)', lon: 0.84, nat: 0.08, jsn: 0.00 },
    { label: 'P1b Premise Vis (GLM)', lon: 0.84, nat: 0.14, jsn: 0.19 },
    { label: 'P4 Blind AUROC (Pooled)', lon: 0.65, nat: 0.53, jsn: 0.43 },
  ];
  p1Rows.forEach((r, i) => {
    const yy = cY + 64 + i * 40;
    const sx = cX + 165, swMax = 210;
    out.push(text(sx - 8, yy + 14, r.label, { size: 9.3, weight: 'bold', anchor: 'end', fill: '#1E293B' }));
    // Three stacked slim bars: Lon, Prose, JSON
    out.push(`<rect x="${sx}" y="${yy}" width="${(r.lon * swMax).toFixed(1)}" height="7.5" fill="${FMT_META.lon.color}" rx="1"/>`);
    out.push(text(sx + r.lon * swMax + 5, yy + 7, `Lon ${r.lon.toFixed(2)}`, { size: 8.3, weight: 'bold', fill: FMT_META.lon.color }));

    out.push(`<rect x="${sx}" y="${yy + 9.5}" width="${Math.max(2, r.nat * swMax).toFixed(1)}" height="7.5" fill="${FMT_META.natural.color}" rx="1"/>`);
    out.push(text(sx + r.nat * swMax + 5, yy + 16.5, `Prose ${r.nat.toFixed(2)}`, { size: 8.3, fill: '#475569' }));

    out.push(`<rect x="${sx}" y="${yy + 19}" width="${Math.max(2, r.jsn * swMax).toFixed(1)}" height="7.5" fill="${FMT_META.json.color}" rx="1"/>`);
    out.push(text(sx + r.jsn * swMax + 5, yy + 26, `JSON ${r.jsn.toFixed(2)}`, { size: 8.3, fill: '#B45309' }));
  });
  out.push(text(cX + 462, cY + 94, 'S1 Adversarial', { size: 9.8, weight: 'bold', fill: '#0F172A' }));
  out.push(text(cX + 462, cY + 110, 'Plant Gate:', { size: 9.8, weight: 'bold', fill: '#0F172A' }));
  out.push(text(cX + 462, cY + 132, 'Conf>=7 gate passes', { size: 9.0, fill: '#DC2626' }));
  out.push(text(cX + 462, cY + 145, '63–64 Luna plants.', { size: 9.0, fill: '#DC2626' }));
  out.push(text(cX + 462, cY + 165, 'Muk Grade>=5 gate', { size: 9.0, weight: 'bold', fill: '#0F766E' }));
  out.push(text(cX + 462, cY + 178, 'blocks 100% (0/98)', { size: 9.0, weight: 'bold', fill: '#0F766E' }));
  out.push(text(cX + 462, cY + 191, 'Grade-1 plants.', { size: 9.0, weight: 'bold', fill: '#0F766E' }));

  const svgPath = resolve(FIG_DIR, 'fig4-muk-calibration.svg');
  const pngPath = resolve(FIG_DIR, 'fig4-muk-calibration.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

// ---------------- FIGURE 5: Long-Horizon Efficiency, Caching & Pareto Frontier ----------------
function buildFig5() {
  const W = 1220, H = 530;
  const out = [];
  out.push(text(W / 2, 28, 'Figure 5. Long-Horizon State Compactness, Prompt-Cache Reuse, and Accuracy–Cost Pareto Frontier', { size: 16, weight: 'bold', anchor: 'middle' }));

  // Panel A: Hop-30 Chars vs Prompt-Cache Hit %
  const aX = 24, aY = 52, aW = 580, aH = 454;
  out.push(`<rect x="${aX}" y="${aY}" width="${aW}" height="${aH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(aX + 16, aY + 24, 'A. Hop-30 State Size (Chars) & Prefix-Cache Hit % (Lon vs. JSON-chain)', { size: 12, weight: 'bold' }));
  out.push(text(aX + 16, aY + 42, 'Gyeol;Lon cuts Hop-30 state size by 31%–40% and activates explicit caching (39%–40%) on GPT-6 Luna.', { size: 9.4, fill: '#475569' }));

  const modelsA = ['deepseek_on', 'deepseek_off', 'luna_on', 'luna_off', 'haiku_on', 'haiku_off'];
  const cL = aX + 115, cR = aX + aW - 95, cT = aY + 64, cB = aY + aH - 34;
  const cw = cR - cL;
  const maxChars = 32000;
  const rowStep = (cB - cT) / modelsA.length;

  for (const xv of [0, 10000, 20000, 30000]) {
    const xx = cL + (xv / maxChars) * cw;
    out.push(`<line x1="${xx}" y1="${cT}" x2="${xx}" y2="${cB}" stroke="#E2E8F0" stroke-width="0.9"/>`);
    out.push(text(xx, cB + 16, `${xv / 1000}k`, { size: 9.5, fill: '#475569', anchor: 'middle' }));
  }
  out.push(text((cL + cR) / 2, aY + aH - 6, 'Mean Hop-30 Note Characters', { size: 9.5, fill: '#334155', anchor: 'middle' }));

  modelsA.forEach((m, i) => {
    const yy = cT + i * rowStep + 6;
    const cLon = cellMap.get(`${m}|lon`);
    const cJC = cellMap.get(`${m}|jsonchain`);
    const lonCache = ((100 * cLon.cached) / Math.max(1, cLon.tin)).toFixed(1);
    const jcCache = ((100 * cJC.cached) / Math.max(1, cJC.tin)).toFixed(1);

    out.push(text(cL - 8, yy + 22, MODEL_SHORT[m], { size: 9.8, weight: 'bold', anchor: 'end', fill: '#1E293B' }));
    // Lon bar
    const wLon = (cLon.finalChars / maxChars) * cw;
    out.push(`<rect x="${cL}" y="${yy}" width="${wLon.toFixed(1)}" height="16" fill="${FMT_META.lon.color}" rx="2"/>`);
    out.push(text(cL + wLon + 5, yy + 11.5, `${Math.round(cLon.finalChars).toLocaleString()}c (${lonCache}% hit)`, { size: 8.8, weight: 'bold', fill: FMT_META.lon.color }));

    // JSON-chain bar
    const wJC = (cJC.finalChars / maxChars) * cw;
    out.push(`<rect x="${cL}" y="${yy + 20}" width="${wJC.toFixed(1)}" height="16" fill="${FMT_META.jsonchain.color}" rx="2"/>`);
    const jcSuffix = cJC.cut > 0 ? `, cut=${cJC.cut}` : (cJC.deltaOnly > 0 ? ', deltaCollapse' : '');
    out.push(text(cL + wJC + 5, yy + 31.5, `${Math.round(cJC.finalChars).toLocaleString()}c (${jcCache}% hit${jcSuffix})`, { size: 8.6, fill: '#1D4ED8' }));
  });

  // Panel B: Pareto Scatter (USD/settled vs L)
  const bX = 622, bY = 52, bW = 574, bH = 454;
  out.push(`<rect x="${bX}" y="${bY}" width="${bW}" height="${bH}" rx="6" fill="#FAFAFA" stroke="#E2E8F0"/>`);
  out.push(text(bX + 16, bY + 24, 'B. Lineage Accuracy (L) vs. Cost per Settled Session (USD)', { size: 12, weight: 'bold' }));
  out.push(text(bX + 16, bY + 42, 'Top-left is optimal (high survival, low cost). Lon Pareto-dominates JSON-chain across non-refusal cells.', { size: 9.2, fill: '#475569' }));

  const spL = bX + 54, spR = bX + bW - 24, spT = bY + 62, spB = bY + bH - 54;
  const spw = spR - spL, sph = spB - spT;
  const maxCost = 0.27;
  const xP = (u) => spL + (u / maxCost) * spw;
  const yP = (l) => spB - l * sph;

  for (const xv of [0, 0.05, 0.10, 0.15, 0.20, 0.25]) {
    const xx = xP(xv);
    out.push(`<line x1="${xx}" y1="${spT}" x2="${xx}" y2="${spB}" stroke="#E2E8F0" stroke-width="0.9"/>`);
    out.push(text(xx, spB + 16, `$${xv.toFixed(2)}`, { size: 9.5, fill: '#475569', anchor: 'middle' }));
  }
  for (const yv of [0, 0.25, 0.5, 0.75, 1.0]) {
    const yy = yP(yv);
    out.push(`<line x1="${spL}" y1="${yy}" x2="${spR}" y2="${yy}" stroke="${yv === 0 ? '#64748B' : '#E2E8F0'}" stroke-width="${yv === 0 ? 1.2 : 0.9}"/>`);
    out.push(text(spL - 6, yy + 3.5, yv.toFixed(2), { size: 9.5, fill: '#475569', anchor: 'end' }));
  }
  out.push(`<line x1="${spL}" y1="${spT}" x2="${spL}" y2="${spB}" stroke="#64748B" stroke-width="1.2"/>`);
  out.push(text(bX + 14, spT + sph / 2, 'Hop-30 Lineage Survival L', { size: 10, fill: '#334155', anchor: 'middle', rotate: -90 }));
  out.push(text((spL + spR) / 2, spB + 34, 'Cost per Settled 31-Call Session (USD)', { size: 10, fill: '#334155', anchor: 'middle' }));

  // Connect Pareto frontier segments cleanly (Luna OFF Natural -> Luna OFF JSON -> Luna OFF Lon -> Luna ON Lon -> DS ON Lon)
  const paretoPts = [
    cellMap.get('luna_off|natural'),
    cellMap.get('luna_off|json'),
    cellMap.get('luna_off|lon'),
    cellMap.get('luna_on|lon'),
    cellMap.get('deepseek_on|lon'),
  ];
  const pStr = paretoPts.map((c, i) => `${i === 0 ? 'M' : 'L'}${xP(c.usd / c.settled).toFixed(1)},${yP(c.L).toFixed(1)}`).join(' ');
  out.push(`<path d="${pStr}" fill="none" stroke="#0F766E" stroke-width="1.6" stroke-dasharray="5,3" opacity="0.65"/>`);

  // Plot all 24 points
  METRICS.cells.forEach((c) => {
    const cx = xP(c.usd / c.settled);
    const cy = yP(c.L);
    const col = FMT_META[c.format].color;
    const r = c.format === 'lon' ? 5.2 : 4.2;
    out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${col}" stroke="#FFFFFF" stroke-width="1"/>`);
  });

  // Overlay posthoc stripped Haiku ON Lon point
  const hCost = cellMap.get('haiku_on|lon').usd / 10;
  const hx = xP(hCost), hy = yP(POSTHOC.haikuOnLon.summary.completedMean.L);
  out.push(`<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="5" fill="#FFFFFF" stroke="#7C3AED" stroke-width="2"/>`);
  out.push(text(hx + 7, hy + 3, 'Haiku ON Lon (strip done: 0.786)', { size: 8.6, fill: '#7C3AED' }));

  // Key non-overlapping callouts
  const callouts = [
    ['deepseek_on|lon', -10, -8, 'DS ON Lon (0.977, $0.221)', 'end'],
    ['deepseek_on|jsonchain', -8, 16, 'DS ON J-chain (0.958, $0.250)', 'end'],
    ['deepseek_on|natural', -8, 4, 'DS ON Prose', 'end'],
    ['deepseek_on|json', -8, -6, 'DS ON JSON', 'end'],
    ['deepseek_off|lon', 8, 13, 'DS OFF Lon (0.534, $0.085)', 'start'],
    ['deepseek_off|jsonchain', 8, -3, 'DS OFF J-chain ($0.124)', 'start'],
    ['luna_on|lon', -8, -8, 'Luna ON Lon (0.534, $0.060)', 'end'],
    ['luna_off|lon', 8, 11, 'Luna OFF Lon (0.451, $0.045)', 'start'],
    ['luna_off|jsonchain', 8, 4, 'Luna OFF J-chain ($0.080)', 'start'],
  ];
  for (const [k, dx, dy, lbl, anc] of callouts) {
    const c = cellMap.get(k);
    out.push(text(xP(c.usd / c.settled) + dx, yP(c.L) + dy, lbl, { size: 8.6, weight: k.endsWith('|lon') ? 'bold' : 'normal', fill: k.endsWith('|lon') ? '#0F766E' : '#334155', anchor: anc }));
  }

  // Mini legend inside Panel B bottom-right
  let lgx = spR - 290;
  for (const f of ['lon', 'jsonchain', 'json', 'natural']) {
    out.push(`<circle cx="${lgx}" cy="${spB - 14}" r="4.2" fill="${FMT_META[f].color}"/>`);
    out.push(text(lgx + 8, spB - 10.5, FMT_META[f].short, { size: 9, fill: '#334155' }));
    lgx += 72;
  }

  const svgPath = resolve(FIG_DIR, 'fig5-efficiency-pareto.svg');
  const pngPath = resolve(FIG_DIR, 'fig5-efficiency-pareto.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

// ---------------- COVER IMAGE (16:9 Portal Thumbnail, 1600x900) ----------------
function buildCover() {
  const W = 1600, H = 900;
  const out = [];
  // Deep slate gradient-like band + light card canvas
  out.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#F8FAFC"/>`);
  out.push(`<rect x="0" y="0" width="${W}" height="245" fill="#0F172A"/>`);
  out.push(`<rect x="0" y="241" width="${W}" height="5" fill="#0D9488"/>`);

  out.push(text(72, 62, 'APART RESEARCH  ·  AI x EPISTEMICS SPRINT 2026  ·  TRACK 1 & TRACK 2', { size: 16, weight: 'bold', fill: '#5EEAD4' }));
  out.push(text(72, 118, 'Gyeol;Lon — Non-Destructive Epistemic Lineage, Key-Free Audit & Muk v6', { size: 36, weight: 'bold', fill: '#FFFFFF' }));
  out.push(text(72, 162, 'Pre-Registered 30-Hop LLM Relay Benchmark Across GPT-6 Luna, Claude Haiku 5.5, and DeepSeek v4.1 Flash', { size: 20, fill: '#CBD5E1' }));
  out.push(text(72, 206, 'Jaehoon Rieu (Team Gyeol, Brisbane, Australia)  ·  240 Settled Sessions  ·  7,176 Live Calls  ·  Zero-Dependency Reference Implementation', { size: 15.5, fill: '#94A3B8' }));

  // 4 Architecture Pipeline Boxes in middle row
  const archY = 285, boxW = 342, boxH = 175, gap = 29;
  const cards = [
    {
      step: '01  SNAPSHOT DAG GRAMMAR',
      title: 'Gyeol;Lon (lon 0.8)',
      col: '#0F766E',
      lines: [
        '• Append-only numbered clauses <N · ...>',
        '• Non-destructive fix→k & err→k edges',
        '• Length-adaptive <[...]> / <[[...]]> fences',
        '• Undefined Chae slot c|RGBCMYK (zero hints)',
      ],
    },
    {
      step: '02  ORACLE-FREE STATIC AUDIT',
      title: 'Zero-Key Verification',
      col: '#2563EB',
      lines: [
        '• parseTurn v0.8 (E01–E46, W40, W44, W45)',
        '• Byte-exact evdM <[...]> source checking',
        '• carryDiff detects silent drop / alteration',
        '• 92.5% session recall, 22.2-hop early lead',
      ],
    },
    {
      step: '03  MUK v6 & EQ. E TRUST',
      title: 'Proper-Scoring Calibration',
      col: '#7C3AED',
      lines: [
        '• Confidence 0–9 calibration gap -> Grade 0–9',
        '• Strict Chae color neutrality (gain ≈ 0.000)',
        '• Eq. E weights trained strictly on S01–S05',
        '• −20.4% ensemble Brier on held-out S06–S10',
      ],
    },
    {
      step: '04  LONG-HORIZON EFFICIENCY',
      title: 'Prefix Cache & Compactness',
      col: '#D97706',
      lines: [
        '• 31%–40% smaller Hop-30 state vs JSON-chain',
        '• Zero token-ceiling cuts on Luna OFF (vs 8/10)',
        '• 87.3% prefix cache hit on DeepSeek ON',
        '• 38.9%–40.0% explicit cache hit on GPT-6 Luna',
      ],
    },
  ];
  cards.forEach((cd, i) => {
    const x = 72 + i * (boxW + gap);
    out.push(`<rect x="${x}" y="${archY}" width="${boxW}" height="${boxH}" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>`);
    out.push(`<rect x="${x}" y="${archY}" width="${boxW}" height="8" rx="4" fill="${cd.col}"/>`);
    out.push(text(x + 18, archY + 36, cd.step, { size: 12, weight: 'bold', fill: cd.col }));
    out.push(text(x + 18, archY + 66, cd.title, { size: 18, weight: 'bold', fill: '#0F172A' }));
    cd.lines.forEach((ln, li) => {
      out.push(text(x + 18, archY + 96 + li * 20, ln, { size: 12.2, fill: '#334155' }));
    });
  });

  // Bottom KPI Hero Row
  const kpiY = 500, kpiH = 185;
  const kpis = [
    { num: '0.977', sub: '30-Hop Lineage L', det: 'DeepSeek ON Lon (7/10 = 1.000)\nvs. 0.683 Prose, 0.626 JSON', col: '#0F766E' },
    { num: '0.0%', sub: 'Quote Alteration Rate', det: '0/941 altered spans (DS ON Lon)\n1.0%–1.2% Luna vs. 40%–56% Prose', col: '#0F766E' },
    { num: '92.5%', sub: 'Key-Free Session Recall', det: '94.1% Hop Prec · 22.2-hop lead\n(Prose: 100% clean false alarms)', col: '#2563EB' },
    { num: '−20.4%', sub: 'Held-Out Eq. E Brier', det: '0.1145 -> 0.0911 on S06–S10\n+ E5 forged-ground exposure 90%', col: '#7C3AED' },
    { num: '−34.4%', sub: 'Note Size vs JSON-chain', det: '19,001 vs. 28,959 chars (DS ON)\n+39–40% Luna explicit cache hits', col: '#D97706' },
  ];
  const kw = (1600 - 144 - 4 * 24) / 5;
  kpis.forEach((kp, i) => {
    const x = 72 + i * (kw + 24);
    out.push(`<rect x="${x}" y="${kpiY}" width="${kw}" height="${kpiH}" rx="10" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1.5"/>`);
    out.push(text(x + kw / 2, kpiY + 58, kp.num, { size: 42, weight: 'bold', anchor: 'middle', fill: kp.col }));
    out.push(text(x + kw / 2, kpiY + 88, kp.sub, { size: 15, weight: 'bold', anchor: 'middle', fill: '#0F172A' }));
    const [d1, d2] = kp.det.split('\n');
    out.push(text(x + kw / 2, kpiY + 124, d1, { size: 12.2, anchor: 'middle', fill: '#475569' }));
    out.push(text(x + kw / 2, kpiY + 144, d2, { size: 12.2, anchor: 'middle', fill: '#475569' }));
  });

  // Footer transparency bar
  out.push(`<rect x="72" y="720" width="${W - 144}" height="122" rx="10" fill="#F1F5F9" stroke="#CBD5E1"/>`);
  out.push(text(98, 756, 'TRANSPARENT FAILURE-MODE & REPRODUCIBILITY HIGHLIGHTS', { size: 13.5, weight: 'bold', fill: '#0F172A' }));
  out.push(text(98, 784, '• Claude Haiku 5.5 triggered 49 (ON) and 40 (OFF) Anthropic streaming finish:"refusal" halts across all 4 formats plus wrapper-boundary copying; stripping restores Lon completed L=0.786 (V=0.995, G5).', { size: 11.6, fill: '#334155' }));
  out.push(text(98, 810, '• Frozen SHA-256 pre-registration (7/7 verified) · 0-dependency Node 22 parser & scorer · github.com/jaerieu/Gyeol_Public/tree/main/benchmarks/apart-epistemics-2026 · gyeol.link', { size: 11.6, fill: '#0F766E', weight: 'bold' }));

  const svgPath = resolve(SUB_DIR, 'apart-project-image.svg');
  const pngPath = resolve(SUB_DIR, 'apart-project-image.png');
  writeFileSync(svgPath, svgDoc(W, H, out.join('\n')), 'utf8');
  compileSvgToPng(svgPath, pngPath);
}

buildFig1();
buildFig2();
buildFig3();
buildFig4();
buildFig5();
buildCover();
