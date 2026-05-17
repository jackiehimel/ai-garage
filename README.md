# ai-garage

Static internal portal for Solvd’s AI Garage: one HTML entry point, vendored AI Espresso editions, and a Node script to pull new editions from your local [AI-ESPRESSO](https://github.com/jackiehimel/AI-ESPRESSO) checkout.

## What’s in the tree

| Path | Role |
|------|------|
| `ai_garage_portal_merged.html` | The site. Hash-based sections, embedded CSS/JS, iframe for `editions/latest.html`. |
| `editions/` | Vendored digest (`latest.html`, `latest.md`, assets, `manifest.json`). |
| `scripts/sync-espresso.mjs` | Copies the newest variant C edition from a local AI-ESPRESSO repo into `editions/`. |
| `.github/workflows/sync-espresso.yml` | Daily GitHub Action: clone digest repo, run sync, push if `editions/` changed. |
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

`sync:espresso` defaults to variant C and assumes the digest source repo is checked out at:

`~/Documents/Solvd/AI-ESPRESSO` (or your `ai-espresso-with-renderer` clone)

Override with `--source /absolute/path/to/AI-ESPRESSO`. Optional flags: `--edition`. The script picks the highest numbered `edition_*_variant_c.{html,md}` pair under `editions/` unless you pin one.

## Automatic sync on GitHub

[`.github/workflows/sync-espresso.yml`](.github/workflows/sync-espresso.yml) runs daily at **~8:00 AM Eastern** and on demand (**Actions** → **Sync AI Espresso editions** → **Run workflow**). It clones AI-ESPRESSO, runs the same sync script as locally (`--variant c`), and pushes a commit to `main` when `editions/` changes. The edition publish job on AI-ESPRESSO runs at **~7:00 AM Eastern**.

1. **Repo settings:** **Actions** → **General** → *Workflow permissions* → allow **Read and write** so the workflow can push commits.
2. **Which repo to clone:** set a repository variable `AI_ESPRESSO_REPOSITORY` (e.g. `jackiehimel/AI-ESPRESSO`). If unset, the workflow defaults to `jackiehimel/AI-ESPRESSO`.
3. **Private digest repo (required for `jackiehimel/AI-ESPRESSO`):** create a fine-grained PAT with read access to that repo only. Store it as secret `AI_ESPRESSO_CLONE_TOKEN` on this repo. Without it, the clone step fails.

## Optional screenshot helper

`scripts/snap.mjs` plus `npm run snap` / `npm run snap:merged` use Playwright to grab PNGs of the portal for manual layout checks. You can ignore all of that if you only care about hosting the static files: nothing in deploy or `sync:espresso` depends on Playwright. If you do run snap, you need `npm install` once and `npm run install:browsers` once (Chromium for Playwright). Flags are in the comment block at the top of `scripts/snap.mjs`.

## Contributing / scope

Private internal tooling. If you add a branch that introduces build-time config or env-only secrets, document the new variables in that branch; `main` stays static-file-only until merged.
