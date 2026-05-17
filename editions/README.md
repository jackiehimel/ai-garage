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

Under the hood that runs `node scripts/sync-espresso.mjs`, which:

1. Looks at your AI-ESPRESSO checkout’s `editions/` for the highest-numbered
   `edition_N_variant_c.{html,md}` pair (`npm run sync:espresso` passes
   `--variant c`; override with `--source <path>` or pin with `--edition`).
2. Copies it to `latest.html` and `latest.md` here.
3. If the chosen edition references relative image assets (variant layouts
   do — see `--variant` below), copies those into the matching relative path
   under `editions/` so the iframe can resolve them.
4. Rewrites `manifest.json`, prepending the new entry to the archive (de-duped
   by issue number; a new sync for the same issue replaces the prior entry).

### Variant editions

`ai-espresso` also publishes alternate layouts as
`edition_N_variant_<x>.{html,md}` (e.g. `edition_0_variant_c.html`, the
"Newspaper Comic · Snackable" flavor). Pass `--variant <name>` to pull the
highest-numbered variant of that flavor instead of the plain edition:

```bash
npm run sync:espresso -- --variant c
```

Variant HTML references its image panels via relative paths like
`edition_0/assets/variant_b_01.png`. Those PNGs are vendored alongside
`latest.html` automatically, so they render inside the portal iframe at
`file://` and over HTTP without changes to the portal markup.

The chosen variant (or `null` for the plain edition) is recorded in
`manifest.json` under `latest.variant` and on each archive entry, so the
portal can label issues by flavor later if useful.

The source repo is `jackiehimel/AI-ESPRESSO`. The daily edition workflow on
that repo publishes new `edition_N_variant_c` files; this garage repo’s
GitHub Action syncs them automatically (~8:00 AM Eastern).

## Why a vendored copy instead of a hosted URL

The portal is a single-file static HTML page. We don't currently have a public,
stable URL for individual AI Espresso editions, and the email/Teams delivery
paths aren't a fit for an iframe. Vendoring `latest.html` keeps the portal
self-contained for local viewing (`file://`) and for any static host that
serves the repo as-is.
