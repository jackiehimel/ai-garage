#!/usr/bin/env node
// Pull latest AI Espresso artifact contract from a publish manifest URL.
// This avoids cloning the source repository and fetches only required files.

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const REPO_ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const EDITIONS_DIR = path.join(REPO_ROOT, "editions");

function parseArgs(argv) {
  const out = { manifestUrl: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--manifest-url") out.manifestUrl = next();
    else throw new Error(`Unknown flag: ${a}`);
  }
  if (!out.manifestUrl) {
    throw new Error("Missing required --manifest-url");
  }
  return out;
}

async function fetchJson(urlValue) {
  const res = await fetch(urlValue, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`manifest fetch failed (${res.status}): ${urlValue}`);
  }
  return res.json();
}

async function fetchText(urlValue) {
  const res = await fetch(urlValue, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`text fetch failed (${res.status}): ${urlValue}`);
  }
  return res.text();
}

async function fetchBytes(urlValue) {
  const res = await fetch(urlValue, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`asset fetch failed (${res.status}): ${urlValue}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function stripEditionsPrefix(p) {
  const normalized = p.replace(/\\/g, "/");
  if (!normalized.startsWith("editions/")) {
    throw new Error(`Expected editions/ path in manifest, got: ${p}`);
  }
  return normalized.slice("editions/".length);
}

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
  const datelineMatch = /<p class="dateline">([^<]+)<\/p>/i.exec(html);
  if (datelineMatch) {
    meta.date_human = datelineMatch[1].replace(/&middot;/g, "·").replace(/\s+/g, " ").trim();
  }

  const shotsMatch = /\b(\d+)&nbsp;SHOTS\b/i.exec(html);
  if (shotsMatch) meta.shots = Number(shotsMatch[1]);

  const preheader = /display:none[^>]*>\s*([^<]+?)\s*</i.exec(html);
  if (preheader) meta.headline = preheader[1].trim();
  if (!meta.headline) {
    const m = /^\*([^*]+)\*\s*$/m.exec(md);
    if (m) meta.headline = m[1].trim();
  }

  return meta;
}

const MONTHS = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

function parseEditionDateIso(dateHuman) {
  if (!dateHuman) return null;
  const m = /([A-Za-z]{3})\s*·\s*([A-Za-z]{3})\s+(\d{1,2})\s*·\s*(\d{4})/.exec(dateHuman);
  if (!m) return null;
  const mon = MONTHS[m[2].toUpperCase()];
  if (!mon) return null;
  return `${m[4]}-${mon}-${String(m[3]).padStart(2, "0")}`;
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

async function main() {
  const { manifestUrl } = parseArgs(process.argv.slice(2));
  const publish = await fetchJson(manifestUrl);

  if (publish?.schema_version !== 1) {
    throw new Error(`Unsupported publish manifest schema: ${publish?.schema_version}`);
  }
  const edition = publish?.edition;
  const artifacts = publish?.artifacts;
  if (!edition || !artifacts?.html?.url || !artifacts?.markdown?.url) {
    throw new Error("Publish manifest is missing required edition/artifacts fields");
  }

  const html = await fetchText(artifacts.html.url);
  const md = await fetchText(artifacts.markdown.url);

  await fs.mkdir(EDITIONS_DIR, { recursive: true });
  const frozenHtml = `${edition.base}.html`;
  const frozenMd = `${edition.base}.md`;
  await fs.writeFile(path.join(EDITIONS_DIR, frozenHtml), html, "utf8");
  await fs.writeFile(path.join(EDITIONS_DIR, frozenMd), md, "utf8");
  await fs.writeFile(path.join(EDITIONS_DIR, "latest.html"), html, "utf8");
  await fs.writeFile(path.join(EDITIONS_DIR, "latest.md"), md, "utf8");

  const copiedAssets = [];
  for (const asset of artifacts.assets ?? []) {
    if (!asset?.path || !asset?.url) continue;
    const rel = stripEditionsPrefix(asset.path);
    const dest = path.join(EDITIONS_DIR, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, await fetchBytes(asset.url));
    copiedAssets.push(rel);
  }

  const meta = sniffMetadata(html, md);
  const archive = await buildArchiveFromDisk(edition.number, edition.variant ?? "c");
  const manifest = {
    latest: {
      number: edition.number,
      label: meta.label ?? `NO. ${String(edition.number).padStart(3, "0")}`,
      date_iso: parseEditionDateIso(meta.date_human) ?? edition.date ?? null,
      date_human: meta.date_human,
      shots: meta.shots,
      headline: meta.headline,
      html: "latest.html",
      markdown: "latest.md",
      frozen_html: frozenHtml,
      variant: edition.variant ?? "c",
      source_repo: publish.source_repo,
      source_ref: publish.source_ref,
      source_manifest_url: manifestUrl,
      source_path: artifacts.html.path,
    },
    archive,
  };
  await fs.writeFile(path.join(EDITIONS_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(JSON.stringify({
    wrote: ["editions/latest.html", "editions/latest.md", "editions/manifest.json"],
    edition: edition.base,
    variant: edition.variant ?? "c",
    source_repo: publish.source_repo,
    source_manifest_url: manifestUrl,
    assets_copied: copiedAssets,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
