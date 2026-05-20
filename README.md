# ai-garage

Static internal portal for Solvd’s AI Garage: one HTML entry point, vendored AI Espresso editions, and a Node script to pull new editions from AI Espresso's published artifact manifest.

## What’s in the tree

| Path | Role |
|------|------|
| `ai_garage_portal_merged.html` | The site. Hash-based sections, embedded CSS/JS, iframe for `editions/latest.html`. |
| `editions/` | Vendored digest (`latest.html`, `latest.md`, assets, `manifest.json`). |
| `scripts/sync-espresso-from-manifest.mjs` | Downloads latest HTML/MD/assets from AI Espresso publish manifest into `editions/`. |
| `.github/workflows/sync-espresso.yml` | Daily GitHub Action: fetch manifest, sync artifacts, push if `editions/` changed. |
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

`sync:espresso` reads AI Espresso's published manifest:

`https://raw.githubusercontent.com/jackiehimel/ai-espresso-finalized/main/editions/publish/latest.json`

Override with `--manifest-url <url>` if needed.

## Automatic sync on GitHub

[`.github/workflows/sync-espresso.yml`](.github/workflows/sync-espresso.yml) runs daily at **~8:00 AM Eastern** and on demand (**Actions** → **Sync AI Espresso editions** → **Run workflow**). It fetches AI Espresso's publish manifest, downloads the declared artifacts, and pushes a commit to `main` when `editions/` changes. The AI Espresso publish job runs at **~7:00 AM Eastern**.

1. **Repo settings:** **Actions** → **General** → *Workflow permissions* → allow **Read and write** so the workflow can push commits.
2. **Manifest source override (optional):** set repository variable `AI_ESPRESSO_MANIFEST_URL` if you need a non-default contract URL.

## Optional screenshot helper

`scripts/snap.mjs` plus `npm run snap` / `npm run snap:merged` use Playwright to grab PNGs of the portal for manual layout checks. You can ignore all of that if you only care about hosting the static files: nothing in deploy or `sync:espresso` depends on Playwright. If you do run snap, you need `npm install` once and `npm run install:browsers` once (Chromium for Playwright). Flags are in the comment block at the top of `scripts/snap.mjs`.

## Contributing / scope

Private internal tooling. If you add a branch that introduces build-time config or env-only secrets, document the new variables in that branch; `main` stays static-file-only until merged.
