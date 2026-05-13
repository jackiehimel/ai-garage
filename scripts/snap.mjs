#!/usr/bin/env node
// Drive an HTML page with Playwright and capture screenshots so the assistant
// can visually verify what's on screen without manual user screenshots.
//
// Usage examples:
//   node scripts/snap.mjs --file ai_garage_portal_merged.html
//   node scripts/snap.mjs --file ai_garage_portal_merged.html --full
//   node scripts/snap.mjs --file ai_garage_portal_merged.html --viewport 390x844 --out mobile-home
//   node scripts/snap.mjs --file ai_garage_portal_merged.html --click "text=Projects" --out projects
//   node scripts/snap.mjs --url https://example.com --full --out example
//
// Flags:
//   --file <path>         Local HTML file (relative to repo root) to load via file://
//   --url <url>           Remote URL to load (mutually exclusive with --file)
//   --out <name>          Output filename (no extension). Defaults to timestamp.
//   --viewport <WxH>      Viewport size, e.g. 1440x900 (default) or 390x844
//   --device <name>       Playwright device descriptor name (overrides --viewport)
//   --full                Capture full-page screenshot instead of viewport only
//   --wait <ms>           Extra wait after load (default 300)
//   --click <selector>    Click a selector before capture. Repeatable.
//   --scroll <px>         Scroll window.scrollY by N pixels before capture.
//   --selector <selector> Capture only the element matching this selector.
//   --headed              Run with a visible browser window (useful for debugging).

import path from "node:path";
import url from "node:url";
import fs from "node:fs/promises";
import os from "node:os";

// Pin the browser cache to a persistent location so runs work regardless of
// what PLAYWRIGHT_BROWSERS_PATH the parent shell happens to inject (some
// sandboxes point it at an ephemeral cache that gets wiped between runs).
// `npm run install:browsers` writes the binaries to this same path.
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(
  os.homedir(),
  ".cache",
  "ms-playwright",
);

const { chromium, devices } = await import("playwright");

const REPO_ROOT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  "..",
);
const SHOT_DIR = path.join(REPO_ROOT, "screenshots");

function parseArgs(argv) {
  const opts = {
    file: null,
    url: null,
    out: null,
    viewport: "1440x900",
    device: null,
    full: false,
    wait: 300,
    clicks: [],
    scroll: 0,
    selector: null,
    headed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--file":
        opts.file = next();
        break;
      case "--url":
        opts.url = next();
        break;
      case "--out":
        opts.out = next();
        break;
      case "--viewport":
        opts.viewport = next();
        break;
      case "--device":
        opts.device = next();
        break;
      case "--full":
        opts.full = true;
        break;
      case "--wait":
        opts.wait = Number(next());
        break;
      case "--click":
        opts.clicks.push(next());
        break;
      case "--scroll":
        opts.scroll = Number(next());
        break;
      case "--selector":
        opts.selector = next();
        break;
      case "--headed":
        opts.headed = true;
        break;
      default:
        throw new Error(`Unknown flag: ${a}`);
    }
  }
  if (!opts.file && !opts.url) {
    throw new Error("Provide --file <path> or --url <url>");
  }
  return opts;
}

function parseViewport(spec) {
  const m = /^(\d+)x(\d+)$/.exec(spec);
  if (!m) throw new Error(`Invalid --viewport: ${spec}`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

function defaultOutName(opts) {
  const base = opts.file
    ? path.basename(opts.file, path.extname(opts.file))
    : "url";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${base}-${ts}`;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  await fs.mkdir(SHOT_DIR, { recursive: true });

  const target = opts.file
    ? url.pathToFileURL(path.resolve(REPO_ROOT, opts.file)).href
    : opts.url;

  const browser = await chromium.launch({ headless: !opts.headed });
  const contextOpts = opts.device
    ? { ...devices[opts.device] }
    : { viewport: parseViewport(opts.viewport) };
  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ name: err.name, message: err.message });
  });

  await page.goto(target, { waitUntil: "networkidle" });
  if (opts.wait > 0) await page.waitForTimeout(opts.wait);

  for (const sel of opts.clicks) {
    await page.locator(sel).first().click();
    await page.waitForTimeout(Math.max(opts.wait, 150));
  }
  if (opts.scroll) {
    await page.evaluate((y) => window.scrollBy(0, y), opts.scroll);
    await page.waitForTimeout(150);
  }

  const outName = opts.out ?? defaultOutName(opts);
  const outPath = path.join(SHOT_DIR, `${outName}.png`);

  if (opts.selector) {
    await page.locator(opts.selector).first().screenshot({ path: outPath });
  } else {
    await page.screenshot({ path: outPath, fullPage: opts.full });
  }

  const title = await page.title();
  const viewport = page.viewportSize();

  await browser.close();

  const summary = {
    target,
    output: path.relative(REPO_ROOT, outPath),
    title,
    viewport,
    fullPage: opts.full,
    consoleMessages,
    pageErrors,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
