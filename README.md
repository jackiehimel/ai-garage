# ai-garage

Static internal portal for Solvd’s AI Garage: one HTML entry point, vendored AI Espresso editions, and a Node script to pull new editions from your local `news_agent` checkout.

## What’s in the tree

| Path | Role |
|------|------|
| `ai_garage_portal_merged.html` | The site. Hash-based sections, embedded CSS/JS, iframe for `editions/latest.html`. |
| `editions/` | Vendored digest (`latest.html`, `latest.md`, assets, `manifest.json`). |
| `scripts/sync-espresso.mjs` | Copies the newest edition from a local `news_agent` repo into `editions/`. |
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

## Syncing AI Espresso

Install deps if you use the sync script:

```bash
npm install
npm run sync:espresso
```

`sync:espresso` assumes the digest source repo lives next to this one:

`~/Documents/Solvd/news_agent`

Override with `--source /absolute/path/to/news_agent`. Optional flags: `--edition`, `--variant`. The script picks the highest numbered `edition_*.html` / `.md` pair under `news_agent/editions/` unless you pin one.

## Optional screenshot helper

`scripts/snap.mjs` plus `npm run snap` / `npm run snap:merged` use Playwright to grab PNGs of the portal for manual layout checks. You can ignore all of that if you only care about hosting the static files: nothing in deploy or `sync:espresso` depends on Playwright. If you do run snap, you need `npm install` once and `npm run install:browsers` once (Chromium for Playwright). Flags are in the comment block at the top of `scripts/snap.mjs`.

## Contributing / scope

Private internal tooling. If you add a branch that introduces build-time config or env-only secrets, document the new variables in that branch; `main` stays static-file-only until merged.
