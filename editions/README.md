# editions/

Vendored AI Espresso daily editions, surfaced live on the **AI Espresso** page of
`ai_garage_portal_merged.html` (the Garage portal) via an iframe.

## Files

- `latest.html` — the current edition's email HTML. Loaded in the portal iframe.
- `latest.md` — the same edition as Markdown, linked from the portal.
- `manifest.json` — issue metadata (number, label, date, headline, archive). The
  portal reads this client-side to populate the "Latest issue" header and the
  archive table when served over HTTP.

## Refreshing

Run from the repo root:

```bash
npm run sync:espresso
```

Under the hood that runs `node scripts/sync-espresso-from-manifest.mjs`, which:

1. Fetches AI Espresso's publish contract at `editions/publish/latest.json`.
2. Downloads the declared `html`, `markdown`, and asset files only.
3. Writes `latest.html` / `latest.md` and stores the frozen edition file.
4. Rewrites `manifest.json` with provenance (`source_repo`, `source_ref`, `source_manifest_url`).

Variant HTML references its image panels via relative paths like
`edition_0/assets/variant_b_01.png`. Those PNGs are vendored alongside
`latest.html` automatically, so they render inside the portal iframe at
`file://` and over HTTP without changes to the portal markup.

The chosen variant (or `null` for the plain edition) is recorded in
`manifest.json` under `latest.variant` and on each archive entry, so the
portal can label issues by flavor later if useful.

The source repo is `jackiehimel/ai-espresso-finalized`. Its daily workflow
publishes a stable manifest at `editions/publish/latest.json`; this garage
repo's GitHub Action consumes that manifest automatically (~8:00 AM Eastern).

## Why a vendored copy instead of direct iframe to source URL

The portal is a single-file static HTML page. We still vendor `latest.html`
to keep local and static-host behavior deterministic, but now fetch only the
published artifact contract instead of cloning the entire source repository.
