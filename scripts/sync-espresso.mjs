#!/usr/bin/env node
// sync-espresso.mjs — pull the most recent AI Espresso edition from the
// ai-espresso repo into garage/editions/ so the portal's "AI Espresso" page
// renders today's digest without depending on any deployed URL.
//
// Defaults assume both repos sit side-by-side:
//   ~/Documents/Solvd/garage       (this repo)
//   ~/Documents/Solvd/ai-espresso  (digest source)
//
// Override with --source <abs path to ai-espresso>.
//
// What this does:
//   1. Picks the highest-numbered editions/edition_N.{html,md} in ai-espresso
//      (falls back to edition_0 if that's all that exists). When --variant is
//      passed, matches edition_N_variant_<name>.{html,md} instead.
//   2. Mirrors every edition_N_variant_<X>.{html,md} into garage/editions/
//      (frozen per-issue files, not only latest.html).
//   3. Copies latest.html / latest.md from the highest issue number.
//   4. Vendors relative image assets beside each edition HTML.
//   5. Updates editions/manifest.json — archive rows link to frozen HTML paths.
//
// Usage:
//   node scripts/sync-espresso.mjs
//   node scripts/sync-espresso.mjs --source /path/to/ai-espresso
//   node scripts/sync-espresso.mjs --edition edition_3            # pin a specific one
//   node scripts/sync-espresso.mjs --variant c                    # latest variant C
//   node scripts/sync-espresso.mjs --edition edition_0 --variant c

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import os from "node:os";

const REPO_ROOT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
);
const EDITIONS_DIR = path.join(REPO_ROOT, "editions");

function parseArgs(argv) {
  const out = { source: null, edition: null, variant: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--source") out.source = next();
    else if (a === "--edition") out.edition = next();
    else if (a === "--variant") out.variant = next();
    else throw new Error(`Unknown flag: ${a}`);
  }
  if (out.variant) {
    out.variant = out.variant.toLowerCase().replace(/^variant[_-]?/, "");
    if (!/^[a-z0-9]+$/.test(out.variant)) {
      throw new Error(
        `Invalid --variant value: ${out.variant} (expected a short slug like 'c')`,
      );
    }
  }
  return out;
}

function defaultSource() {
  return path.join(os.homedir(), "Documents", "Solvd", "ai-espresso");
}

async function pickLatestEdition(sourceEditions, variant) {
  const entries = await fs.readdir(sourceEditions, { withFileTypes: true });
  // edition_N.html (plain) or edition_N_variant_X.html (variant), depending on
  // whether --variant was passed. Pick the largest N that has both .html and
  // .md alongside.
  const pattern = variant
    ? new RegExp(`^edition_(\\d+)_variant_${variant}\\.html$`)
    : /^edition_(\d+)\.html$/;
  const candidates = entries
    .filter((e) => e.isFile() && pattern.test(e.name))
    .map((e) => {
      const m = pattern.exec(e.name);
      const num = Number(m[1]);
      const base = variant
        ? `edition_${m[1]}_variant_${variant}`
        : `edition_${m[1]}`;
      return { num, base, variant: variant ?? null };
    })
    .sort((a, b) => b.num - a.num);

  for (const c of candidates) {
    const html = path.join(sourceEditions, `${c.base}.html`);
    const md = path.join(sourceEditions, `${c.base}.md`);
    try {
      await fs.access(html);
      await fs.access(md);
      return { ...c, htmlPath: html, mdPath: md };
    } catch {
      // try next
    }
  }
  return null;
}

async function listAllVariantEditions(sourceEditions, variant) {
  const entries = await fs.readdir(sourceEditions, { withFileTypes: true });
  const pattern = new RegExp(`^edition_(\\d+)_variant_${variant}\\.html$`);
  const candidates = entries
    .filter((e) => e.isFile() && pattern.test(e.name))
    .map((e) => {
      const m = pattern.exec(e.name);
      const num = Number(m[1]);
      const base = `edition_${m[1]}_variant_${variant}`;
      return { num, base, variant };
    })
    .sort((a, b) => a.num - b.num);

  const picks = [];
  for (const c of candidates) {
    const htmlPath = path.join(sourceEditions, `${c.base}.html`);
    const mdPath = path.join(sourceEditions, `${c.base}.md`);
    try {
      await fs.access(htmlPath);
      await fs.access(mdPath);
      picks.push({ ...c, htmlPath, mdPath });
    } catch {
      // skip incomplete pairs
    }
  }
  return picks;
}

async function copyAssetsForHtml(html, sourceHtmlDir) {
  const assetRefs = extractRelativeAssets(html);
  const copiedAssets = [];
  const missingAssets = [];
  for (const rel of assetRefs) {
    const src = path.resolve(sourceHtmlDir, rel);
    const dest = path.resolve(EDITIONS_DIR, rel);
    if (!dest.startsWith(EDITIONS_DIR + path.sep)) continue;
    try {
      await fs.access(src);
    } catch {
      missingAssets.push(rel);
      continue;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    copiedAssets.push(rel);
  }
  return { copiedAssets, missingAssets };
}

async function writeFrozenEdition(pick) {
  const html = await fs.readFile(pick.htmlPath, "utf8");
  const md = await fs.readFile(pick.mdPath, "utf8");
  const frozenHtml = `${pick.base}.html`;
  const frozenMd = `${pick.base}.md`;
  await fs.writeFile(path.join(EDITIONS_DIR, frozenHtml), html);
  await fs.writeFile(path.join(EDITIONS_DIR, frozenMd), md);
  const sourceHtmlDir = path.dirname(pick.htmlPath);
  const assets = await copyAssetsForHtml(html, sourceHtmlDir);
  return { frozenHtml, frozenMd, ...assets };
}

async function buildArchiveFromDisk(latestNumber, variant) {
  const entries = await fs.readdir(EDITIONS_DIR, { withFileTypes: true });
  const pattern = new RegExp(`^edition_(\\d+)_variant_${variant}\\.html$`);
  const archive = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = pattern.exec(e.name);
    if (!m) continue;
    const number = Number(m[1]);
    if (number === latestNumber) continue;
    const htmlPath = path.join(EDITIONS_DIR, e.name);
    const mdPath = path.join(EDITIONS_DIR, e.name.replace(/\.html$/, ".md"));
    let md = "";
    try {
      md = await fs.readFile(mdPath, "utf8");
    } catch {
      continue;
    }
    const html = await fs.readFile(htmlPath, "utf8");
    const meta = sniffMetadata(html, md);
    archive.push({
      number,
      label: meta.label ?? `NO. ${String(number).padStart(3, "0")}`,
      date_iso: parseEditionDateIso(meta.date_human) ?? null,
      date_human: meta.date_human,
      headline: meta.headline,
      html: e.name,
      markdown: e.name.replace(/\.html$/, ".md"),
      variant,
    });
  }
  archive.sort((a, b) => b.number - a.number);
  return archive;
}

// Best-effort metadata sniffer. Looks for the preheader/header strings the
// edition_0 template emits, with markdown- and variant-aware fallbacks for
// alternate layouts (variant_c has no preheader strip and a different
// dateline format). If the format changes later, manifest.json can be
// hand-edited; this script only writes defaults.
function sniffMetadata(html, md) {
  const meta = { label: null, date_human: null, headline: null, shots: null };

  const labelMatch = /NO\.&nbsp;(\d{3,})/i.exec(html);
  if (labelMatch) meta.label = `NO. ${labelMatch[1]}`;

  const dateMatch =
    /(MON|TUE|WED|THU|FRI|SAT|SUN)&nbsp;(?:&middot;|·)\s*([A-Z]{3})&nbsp;(\d{1,2})&nbsp;(?:&middot;|·)\s*(\d{4})/i.exec(
      html,
    );
  if (dateMatch) {
    meta.date_human = `${dateMatch[1]} · ${dateMatch[2]} ${dateMatch[3]} · ${dateMatch[4]}`;
  }
  const legacyDateMatch =
    /(MON|TUE|WED|THU|FRI|SAT|SUN)&nbsp;(\d{2}\.\d{2}\.\d{2})/i.exec(html);
  if (!meta.date_human && legacyDateMatch) {
    meta.date_human = `${legacyDateMatch[1]} ${legacyDateMatch[2]}`;
  }
  const datelineMatch = /<p class="dateline">([^<]+)<\/p>/i.exec(html);
  if (datelineMatch) {
    meta.date_human = datelineMatch[1]
      .replace(/&middot;/g, "·")
      .replace(/\s+/g, " ")
      .trim();
  }

  const shotsMatch = /\b(\d+)&nbsp;SHOTS\b/i.exec(html);
  if (shotsMatch) meta.shots = Number(shotsMatch[1]);

  const preheader = /display:none[^>]*>\s*([^<]+?)\s*</i.exec(html);
  if (preheader) meta.headline = preheader[1].trim();

  // Markdown fallback for headline (italic line under the masthead).
  if (!meta.headline) {
    const m = /^\*([^*]+)\*\s*$/m.exec(md);
    if (m) meta.headline = m[1].trim();
  }

  // Markdown fallback for date_human: variants emit a bold all-caps dateline
  // like **MON · MAY 11 · 2026**. Take the first bold line that looks like a
  // date (contains a 4-digit year and at least one separator).
  if (!meta.date_human) {
    const lines = md.split(/\r?\n/);
    for (const line of lines) {
      const m = /^\*\*\s*(.+?)\s*\*\*\s*$/.exec(line);
      if (!m) continue;
      const text = m[1];
      if (/\b\d{4}\b/.test(text) && /[·.\-/]/.test(text)) {
        meta.date_human = text;
        break;
      }
    }
  }

  // Fallback shot count: number of <article> blocks in variant layouts (news
  // cards + prompt card). edition_0's plain template already matched the
  // SHOTS regex above, so this only kicks in for variants.
  if (meta.shots == null) {
    const articleCount = (html.match(/<article\b/gi) || []).length;
    if (articleCount > 0) meta.shots = articleCount;
  }

  return meta;
}

// Extract relative asset references (img/script/link/source/etc.) from the
// edition HTML so we can vendor them alongside latest.html. Only matches
// same-document relative paths — anything starting with a scheme, "//", "/",
// "#", "data:", "mailto:", or trying to escape via ".." is skipped.
function extractRelativeAssets(html) {
  const found = new Set();
  const re = /\b(?:src|href)\s*=\s*"([^"]+)"|\b(?:src|href)\s*=\s*'([^']+)'/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] ?? m[2] ?? "").trim();
    if (!raw) continue;
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|#|data:|mailto:|tel:)/i.test(raw)) {
      continue;
    }
    const noFragment = raw.split("#")[0].split("?")[0];
    if (!noFragment) continue;
    if (noFragment.split("/").some((seg) => seg === "..")) continue;
    found.add(noFragment);
  }
  return [...found];
}

const MONTHS = {
  JAN: "01",
  FEB: "02",
  MAR: "03",
  APR: "04",
  MAY: "05",
  JUN: "06",
  JUL: "07",
  AUG: "08",
  SEP: "09",
  OCT: "10",
  NOV: "11",
  DEC: "12",
};

/** Parse "Thu · May 21 · 2026" (from dateline) to YYYY-MM-DD. */
function parseEditionDateIso(dateHuman) {
  if (!dateHuman) return null;
  const m = /([A-Za-z]{3})\s*·\s*([A-Za-z]{3})\s+(\d{1,2})\s*·\s*(\d{4})/.exec(
    dateHuman,
  );
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  if (!mon) return null;
  return `${m[4]}-${mon}-${String(m[3]).padStart(2, "0")}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const sourceRoot = opts.source ?? defaultSource();
  const sourceEditions = path.join(sourceRoot, "editions");

  try {
    await fs.access(sourceEditions);
  } catch {
    throw new Error(
      `ai-espresso editions dir not found at ${sourceEditions}. Pass --source <path>.`,
    );
  }

  let pick;
  if (opts.edition) {
    // Allow --edition to be either a plain base ("edition_3") or a variant
    // base ("edition_3_variant_c"). If --variant is also passed and the base
    // doesn't already encode it, append the variant suffix.
    let base = opts.edition.replace(/\.(html|md)$/i, "");
    if (opts.variant && !/_variant_[a-z0-9]+$/i.test(base)) {
      base = `${base}_variant_${opts.variant}`;
    }
    const variantMatch = /_variant_([a-z0-9]+)$/i.exec(base);
    pick = {
      num: Number((/edition_(\d+)/.exec(base) || [])[1] ?? 0),
      base,
      variant: variantMatch ? variantMatch[1].toLowerCase() : null,
      htmlPath: path.join(sourceEditions, `${base}.html`),
      mdPath: path.join(sourceEditions, `${base}.md`),
    };
  } else {
    pick = await pickLatestEdition(sourceEditions, opts.variant);
  }
  if (!pick) {
    const desc = opts.variant
      ? `edition_N_variant_${opts.variant}.{html,md}`
      : "edition_N.{html,md}";
    throw new Error(`No ${desc} pair found under ${sourceEditions}.`);
  }

  await fs.mkdir(EDITIONS_DIR, { recursive: true });

  const variant = pick.variant ?? opts.variant ?? "c";
  const allPicks =
    variant && !opts.edition
      ? await listAllVariantEditions(sourceEditions, variant)
      : [pick];

  let copiedAssets = [];
  let missingAssets = [];
  for (const p of allPicks) {
    const assets = await writeFrozenEdition(p);
    copiedAssets = [...copiedAssets, ...assets.copiedAssets];
    missingAssets = [...missingAssets, ...assets.missingAssets];
  }

  const html = await fs.readFile(pick.htmlPath, "utf8");
  const md = await fs.readFile(pick.mdPath, "utf8");
  await fs.writeFile(path.join(EDITIONS_DIR, "latest.html"), html);
  await fs.writeFile(path.join(EDITIONS_DIR, "latest.md"), md);

  const meta = sniffMetadata(html, md);
  const number = pick.num;
  const label = meta.label ?? `NO. ${String(number).padStart(3, "0")}`;
  const date_iso = parseEditionDateIso(meta.date_human) ?? new Date().toISOString().slice(0, 10);
  const frozenHtml = `${pick.base}.html`;

  // Archive = other frozen editions on disk (each with its own html path).
  const archive = variant
    ? await buildArchiveFromDisk(number, variant)
    : [];

  const manifest = {
    latest: {
      number,
      label,
      date_iso,
      date_human: meta.date_human,
      shots: meta.shots,
      headline: meta.headline,
      html: "latest.html",
      markdown: "latest.md",
      frozen_html: frozenHtml,
      variant: pick.variant,
      source_repo: "jackiehimel/AI-ESPRESSO",
      source_path: path.relative(sourceRoot, pick.htmlPath),
    },
    archive,
  };

  await fs.writeFile(
    path.join(EDITIONS_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );

  console.log(
    JSON.stringify(
      {
        wrote: ["editions/latest.html", "editions/latest.md", "editions/manifest.json"],
        edition: pick.base,
        variant: pick.variant,
        label,
        date_iso,
        assets_copied: copiedAssets,
        assets_missing: missingAssets,
        source: path.relative(REPO_ROOT, pick.htmlPath),
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
