#!/usr/bin/env node
// writes root site-config.json from env for static deploy (e.g. vercel build).
// never put tokens in html; this file is gitignored and produced in ci only.
// optional: GARAGE_ESPRESSO_REPO (org/name), GARAGE_ESPRESSO_SOURCE_URL (override full url).

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "site-config.json");

const repo = process.env.GARAGE_ESPRESSO_REPO?.trim() ?? "";
const explicitUrl = process.env.GARAGE_ESPRESSO_SOURCE_URL?.trim() ?? "";
const derivedUrl =
  explicitUrl || (repo ? `https://github.com/${repo}` : "");

const payload = {
  espressoSourceRepo: repo,
  espressoSourceUrl: derivedUrl,
};

await fs.writeFile(OUT, JSON.stringify(payload, null, 2) + "\n");
console.log("wrote", path.relative(ROOT, OUT), payload);
