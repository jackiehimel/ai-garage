# ai-garage

Static internal portal for Solvd’s AI Garage: one HTML entry point, vendored AI Espresso editions, and small Node helpers for sync and screenshots.

## What’s in the tree

| Path | Role |
|------|------|
| `ai_garage_portal_merged.html` | The site. Hash-based sections, embedded CSS/JS, iframe for `editions/latest.html`. |
| `editions/` | Vendored digest (`latest.html`, `latest.md`, assets, `manifest.json`). |
| `scripts/sync-espresso.mjs` | Copies the newest edition from a local `news_agent` checkout into `editions/`. |
| `scripts/snap.mjs` | Playwright helper to screenshot pages for visual checks. |
| `vercel.json` | Maps `/` to the merged HTML so the default URL loads the portal. |

More detail on how editions land in this repo lives in [`editions/README.md`](editions/README.md).

## View it on your machine

You need a real HTTP URL (not raw `file://`) so `fetch('editions/manifest.json')` and the iframe behave. From the repo root:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/ai_garage_portal_merged.html`, or `http://localhost:8080/` if your server maps `/` to that file the same way Vercel does.

## Deploy on Vercel

Import the GitHub repo, leave the build step empty, publish the repository root. `vercel.json` already sends `/` to `ai_garage_portal_merged.html`. Push to `main` and you get a preview URL per deployment.

## Node scripts

Install once:

```bash
npm install
```

| Command | What it does |
|---------|----------------|
| `npm run sync:espresso` | Pulls latest HTML/MD from `news_agent` (see below), refreshes `editions/` and `manifest.json`. |
| `npm run snap` | Runs `scripts/snap.mjs`. Flags are documented in the comment block at the top of that file. |
| `npm run snap:merged` | Full-page screenshot of the merged portal (uses Playwright). |
| `npm run install:browsers` | Installs Chromium where Playwright expects it (see script in `package.json`). |

## Syncing AI Espresso

`sync:espresso` assumes the digest source repo lives next to this one:

`~/Documents/Solvd/news_agent`

Override with `--source /absolute/path/to/news_agent`. Optional flags: `--edition`, `--variant`. The script picks the highest numbered `edition_*.html` / `.md` pair under `news_agent/editions/` unless you pin one.

## Playwright

`npm run snap` needs browsers once per machine (or CI image). Use `npm run install:browsers` or match whatever `PLAYWRIGHT_BROWSERS_PATH` you already use.

## Contributing / scope

Private internal tooling. If you add a branch that introduces build-time config or env-only secrets, document the new variables in that branch; `main` stays static-file-only until merged.
